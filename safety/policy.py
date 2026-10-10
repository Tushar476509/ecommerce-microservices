from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable

from .models import Baseline, MonitoringSnapshot, ReasonCode, Validity


@dataclass(frozen=True)
class AbortDecision:
    reason: ReasonCode
    details: dict[str, object]


class SafetyPolicyEvaluator:
    def __init__(self, policy: dict, clock: Callable[[], float], require_traffic: bool):
        self.policy = policy
        self.clock = clock
        self.require_traffic = require_traffic
        self.started: dict[str, float] = {}
        self.probe_failures: dict[str, int] = {}

    def _sustained(
        self,
        key: str,
        unhealthy: bool,
        healthy: bool,
        duration: float,
        now: float,
    ) -> bool:
        if unhealthy:
            self.started.setdefault(key, now)
            return now - self.started[key] >= duration
        if healthy:
            self.started.pop(key, None)
        return False

    def evaluate(
        self,
        snapshot: MonitoringSnapshot,
        baseline: Baseline,
        *,
        expected_absent_target: str | None = None,
    ) -> AbortDecision | None:
        now = self.clock()
        abort = self.policy["abort"]

        if snapshot.unexpected_container_event:
            return AbortDecision(
                ReasonCode.UNEXPECTED_CONTAINER_EVENT,
                {"event": snapshot.unexpected_container_event},
            )

        required = set(self.policy["monitoring"]["requiredJobs"]) - {expected_absent_target}
        required_probes = {probe["id"] for probe in self.policy["monitoring"]["probes"]}
        telemetry_unknown = (
            bool(snapshot.telemetry_error)
            or bool(required - snapshot.target_up.keys())
            or bool(required_probes - snapshot.probes.keys())
            or any(snapshot.target_up[name].validity == Validity.UNKNOWN
                   for name in required & snapshot.target_up.keys())
            or any(service not in values or values[service].validity == Validity.UNKNOWN
                   or (values[service].validity == Validity.HEALTHY
                       and (values[service].value is None
                            or not math.isfinite(values[service].value)))
                   for service in self.policy["monitoring"]["protectedHttpServices"]
                   for values in (snapshot.error_fraction, snapshot.p95_latency_ms))
        )
        if self._sustained(
            "telemetry-unavailable",
            telemetry_unknown,
            not telemetry_unknown,
            float(abort["telemetryUnavailableSeconds"]),
            now,
        ):
            return AbortDecision(
                ReasonCode.TELEMETRY_UNAVAILABLE,
                {"error": snapshot.telemetry_error},
            )

        for service, metric in snapshot.target_up.items():
            if service == expected_absent_target:
                continue
            if metric.validity == Validity.UNHEALTHY:
                return AbortDecision(
                    ReasonCode.CRITICAL_PROBE_FAILED,
                    {"service": service, "source": "prometheus-up"},
                )

        failure_limit = int(abort["criticalProbeConsecutiveFailures"])
        for probe_id, probe in snapshot.probes.items():
            if probe.valid:
                self.probe_failures[probe_id] = 0
            else:
                self.probe_failures[probe_id] = self.probe_failures.get(probe_id, 0) + 1
                if self.probe_failures[probe_id] >= failure_limit:
                    return AbortDecision(
                        ReasonCode.CRITICAL_PROBE_FAILED,
                        {"probe": probe_id, "failures": self.probe_failures[probe_id]},
                    )

        maximum_source_age = float(abort["maximumSourceAgeSeconds"])
        stale = False
        stale_service = None
        for service, metric in snapshot.target_up.items():
            if service == expected_absent_target:
                continue
            if metric.source_timestamp is None or snapshot.observed_at - metric.source_timestamp > maximum_source_age:
                stale = True
                stale_service = service
                break
        if self._sustained(
            "telemetry-stale",
            stale,
            not stale,
            float(abort["telemetryStaleSeconds"]),
            now,
        ):
            return AbortDecision(
                ReasonCode.TELEMETRY_STALE,
                {"service": stale_service, "maximumAgeSeconds": maximum_source_age},
            )

        insufficient = False
        insufficient_service = None
        for service, metric in [*snapshot.error_fraction.items(), *snapshot.p95_latency_ms.items()]:
            if metric.validity == Validity.INSUFFICIENT_TRAFFIC:
                insufficient = True
                insufficient_service = service
                break
        if self.require_traffic and self._sustained(
            "insufficient-traffic",
            insufficient,
            not insufficient,
            float(abort["insufficientTrafficSeconds"]),
            now,
        ):
            return AbortDecision(
                ReasonCode.INSUFFICIENT_TRAFFIC,
                {"service": insufficient_service},
            )

        hold = float(abort["sustainedBreachSeconds"])
        for service, metric in snapshot.error_fraction.items():
            valid = metric.validity == Validity.HEALTHY and metric.value is not None
            unhealthy = valid and metric.value > float(abort["maximumErrorFraction"])
            if self._sustained(f"error:{service}", unhealthy, valid and not unhealthy, hold, now):
                return AbortDecision(
                    ReasonCode.ERROR_RATE,
                    {
                        "service": service,
                        "observed": metric.value,
                        "unit": "fraction",
                        "threshold": abort["maximumErrorFraction"],
                        "requestCount": metric.request_count,
                    },
                )

        for service, metric in snapshot.p95_latency_ms.items():
            valid = (
                metric.validity == Validity.HEALTHY
                and metric.value is not None
                and math.isfinite(metric.value)
            )
            baseline_p95 = baseline.p95_latency_ms.get(service)
            relative_threshold = max(
                float(abort["relativeP95FloorMilliseconds"]),
                float(abort["relativeP95Multiplier"]) * baseline_p95
                if baseline_p95 is not None
                else float(abort["relativeP95FloorMilliseconds"]),
            )
            threshold = min(relative_threshold, float(abort["absoluteP95Milliseconds"]))
            unhealthy = valid and metric.value > threshold
            if self._sustained(f"latency:{service}", unhealthy, valid and not unhealthy, hold, now):
                return AbortDecision(
                    ReasonCode.LATENCY,
                    {
                        "service": service,
                        "observed": metric.value,
                        "unit": "milliseconds",
                        "threshold": threshold,
                        "baseline": baseline_p95,
                        "requestCount": metric.request_count,
                    },
                )
        return None

