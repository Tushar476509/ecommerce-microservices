from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class Lifecycle(str, Enum):
    PREFLIGHT = "PREFLIGHT"
    BASELINING = "BASELINING"
    ARMED = "ARMED"
    RUNNING = "RUNNING"
    CLEANING_UP = "CLEANING_UP"
    RECOVERING = "RECOVERING"
    COMPLETED = "COMPLETED"
    ABORTED = "ABORTED"
    CLEANUP_FAILED = "CLEANUP_FAILED"
    RECOVERY_FAILED = "RECOVERY_FAILED"


TERMINAL_STATES = {
    Lifecycle.COMPLETED.value,
    Lifecycle.ABORTED.value,
    Lifecycle.CLEANUP_FAILED.value,
    Lifecycle.RECOVERY_FAILED.value,
}


class ReasonCode(str, Enum):
    MANUAL_KILL = "MANUAL_KILL"
    MAX_DURATION = "MAX_DURATION"
    ERROR_RATE = "ERROR_RATE"
    LATENCY = "LATENCY"
    CRITICAL_PROBE_FAILED = "CRITICAL_PROBE_FAILED"
    TELEMETRY_UNAVAILABLE = "TELEMETRY_UNAVAILABLE"
    TELEMETRY_STALE = "TELEMETRY_STALE"
    INSUFFICIENT_TRAFFIC = "INSUFFICIENT_TRAFFIC"
    UNEXPECTED_CONTAINER_EVENT = "UNEXPECTED_CONTAINER_EVENT"
    WATCHDOG_EXPIRED = "WATCHDOG_EXPIRED"
    CLEANUP_FAILED = "CLEANUP_FAILED"
    RECOVERY_TIMEOUT = "RECOVERY_TIMEOUT"
    CONTROLLER_CANCELLED = "CONTROLLER_CANCELLED"
    NORMAL_COMPLETION = "NORMAL_COMPLETION"


class Validity(str, Enum):
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"
    INSUFFICIENT_TRAFFIC = "insufficient_traffic"


@dataclass(frozen=True)
class FaultSpec:
    experiment_id: str
    target_service: str
    fault_type: str
    duration_seconds: int
    generation: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class MetricValue:
    service: str
    value: float | None
    unit: str
    source_timestamp: float | None
    request_count: int | None
    validity: Validity
    last_successful_observation: float | None

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["validity"] = self.validity.value
        return result


@dataclass
class ProbeValue:
    probe_id: str
    status_code: int | None
    latency_ms: float | None
    valid: bool
    observed_at: float
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class MonitoringSnapshot:
    observed_at: float
    target_up: dict[str, MetricValue]
    error_fraction: dict[str, MetricValue]
    p95_latency_ms: dict[str, MetricValue]
    probes: dict[str, ProbeValue]
    telemetry_error: str | None = None
    unexpected_container_event: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "observedAt": self.observed_at,
            "targetUp": {key: value.to_dict() for key, value in self.target_up.items()},
            "errorFraction": {key: value.to_dict() for key, value in self.error_fraction.items()},
            "p95LatencyMs": {key: value.to_dict() for key, value in self.p95_latency_ms.items()},
            "probes": {key: value.to_dict() for key, value in self.probes.items()},
            "telemetryError": self.telemetry_error,
            "unexpectedContainerEvent": self.unexpected_container_event,
        }


@dataclass
class Baseline:
    reference: str
    captured_at: str
    error_fraction: dict[str, float]
    p95_latency_ms: dict[str, float]
    request_counts: dict[str, int]
    artifact: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

