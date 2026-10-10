import copy
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from chaos.planner import build_plan, upstream_services
from safety.configuration import ROOT, ConfigurationError, load_policy
from safety.controller import ControllerError, SafetyController, load_baseline
from safety.models import Baseline, MetricValue, MonitoringSnapshot, ProbeValue, ReasonCode, Validity
from safety.policy import SafetyPolicyEvaluator


class PlanningSafetyTests(unittest.TestCase):
    def setUp(self):
        self.policy = load_policy()
        self.graph = json.loads((ROOT / "safety/config/dependency-map.json").read_text())["services"]
        self.baseline = Baseline("fixture", "fixture", {"product-service": 0},
                                 {"product-service": 20}, {"product-service": 200})
        def metric(service, value, unit="boolean"):
            return MetricValue(service, value, unit, 100, 200, Validity.HEALTHY, 100)
        self.snapshot = MonitoringSnapshot(
            100, {name: metric(name, 1) for name in self.policy["monitoring"]["requiredJobs"]},
            {"product-service": metric("product-service", 0, "fraction")},
            {"product-service": metric("product-service", 20, "milliseconds")},
            {probe["id"]: ProbeValue(probe["id"], 200, 5, True, 100)
             for probe in self.policy["monitoring"]["probes"]})

    def test_escalation_requires_successful_smaller_run(self):
        plan = build_plan(self.policy, self.graph)
        self.assertEqual(plan["experiments"][0]["profile"], "notification-pause-acceptance")
        self.assertFalse(plan["experiments"][1]["eligible"])
        history = [{"profile": "notification-pause-acceptance", "policyVersion": self.policy["policyVersion"],
                    "state": "COMPLETED", "cleanupStatus": "verified", "recoveryStatus": "confirmed"}]
        self.assertTrue(all(item["eligible"] for item in build_plan(self.policy, self.graph, history)["experiments"]))
        history.append({**history[0], "state": "ABORTED"})
        self.assertFalse(any(item["eligible"] for item in build_plan(self.policy, self.graph, history)["experiments"]))

    def test_old_policy_and_unverified_cleanup_cannot_unlock_escalation(self):
        for version, cleanup in [("old", "verified"), (self.policy["policyVersion"], "failed")]:
            history = [{"profile": "notification-pause-acceptance", "policyVersion": version,
                        "state": "COMPLETED", "cleanupStatus": cleanup, "recoveryStatus": "confirmed"}]
            candidates = build_plan(self.policy, self.graph, history)["experiments"]
            self.assertFalse(next(item for item in candidates if item["profile"] == "notification-pause")["eligible"])

    def test_graph_cycles_terminate_and_infrastructure_cannot_be_proposed(self):
        self.assertEqual(upstream_services({"a": ["b"], "b": ["a"], "c": ["a"]}, "a"), ["b", "c"])
        policy = copy.deepcopy(self.policy)
        policy["profiles"]["invalid"] = {"target": "postgres", "faultType": "container-pause", "durationSeconds": 10}
        with self.assertRaises(ConfigurationError):
            build_plan(policy, self.graph)

    def test_preflight_rejects_incomplete_stale_and_unhealthy_metrics(self):
        controller = SafetyController(self.policy, None, None)
        controller._healthy_preflight(self.snapshot)
        variants = []
        missing = copy.deepcopy(self.snapshot)
        missing.target_up.pop("order-service")
        variants.append(missing)
        missing_probe = copy.deepcopy(self.snapshot)
        missing_probe.probes.clear()
        variants.append(missing_probe)
        stale = copy.deepcopy(self.snapshot)
        stale.target_up["order-service"].source_timestamp = 0
        variants.append(stale)
        for value in [0.02, float("nan"), -1]:
            unhealthy = copy.deepcopy(self.snapshot)
            unhealthy.error_fraction["product-service"].value = value
            variants.append(unhealthy)
        traffic = copy.deepcopy(self.snapshot)
        traffic.p95_latency_ms["product-service"].request_count = 0
        variants.append(traffic)
        for snapshot in variants:
            with self.subTest(snapshot=snapshot), self.assertRaises(ControllerError):
                controller._healthy_preflight(snapshot)

    def test_monitoring_loss_aborts_even_without_top_level_error(self):
        now = [0]
        evaluator = SafetyPolicyEvaluator(self.policy, lambda: now[0], True)
        self.snapshot.target_up.pop("order-service")
        self.assertIsNone(evaluator.evaluate(self.snapshot, self.baseline))
        now[0] = 10
        self.assertEqual(evaluator.evaluate(self.snapshot, self.baseline).reason, ReasonCode.TELEMETRY_UNAVAILABLE)

    def test_threshold_hold_resets_after_healthy_sample(self):
        now = [0]
        evaluator = SafetyPolicyEvaluator(self.policy, lambda: now[0], True)
        self.snapshot.error_fraction["product-service"].value = 0.1
        self.assertIsNone(evaluator.evaluate(self.snapshot, self.baseline))
        now[0] = 14
        self.snapshot.error_fraction["product-service"].value = 0
        self.assertIsNone(evaluator.evaluate(self.snapshot, self.baseline))
        now[0] = 15
        self.snapshot.error_fraction["product-service"].value = 0.1
        self.assertIsNone(evaluator.evaluate(self.snapshot, self.baseline))
        now[0] = 30
        self.assertEqual(evaluator.evaluate(self.snapshot, self.baseline).reason, ReasonCode.ERROR_RATE)

    def test_invalid_latency_cannot_silently_disable_watchdog(self):
        for validity, value, expected in [
                (Validity.HEALTHY, float("nan"), ReasonCode.TELEMETRY_UNAVAILABLE),
                (Validity.INSUFFICIENT_TRAFFIC, None, ReasonCode.INSUFFICIENT_TRAFFIC)]:
            with self.subTest(validity=validity):
                now = [0]
                evaluator = SafetyPolicyEvaluator(self.policy, lambda: now[0], True)
                self.snapshot.p95_latency_ms["product-service"].validity = validity
                self.snapshot.p95_latency_ms["product-service"].value = value
                self.assertIsNone(evaluator.evaluate(self.snapshot, self.baseline))
                now[0] = 15
                self.assertEqual(evaluator.evaluate(self.snapshot, self.baseline).reason, expected)

    def test_expected_target_absence_does_not_hide_other_missing_targets(self):
        now = [0]
        evaluator = SafetyPolicyEvaluator(self.policy, lambda: now[0], True)
        self.snapshot.target_up.pop("notification-service")
        self.assertIsNone(evaluator.evaluate(self.snapshot, self.baseline,
                                            expected_absent_target="notification-service"))
        now[0] = 20
        self.assertIsNone(evaluator.evaluate(self.snapshot, self.baseline,
                                            expected_absent_target="notification-service"))
        self.snapshot.target_up.pop("order-service")
        evaluator.evaluate(self.snapshot, self.baseline, expected_absent_target="notification-service")
        now[0] = 30
        self.assertEqual(evaluator.evaluate(self.snapshot, self.baseline,
                                            expected_absent_target="notification-service").reason,
                         ReasonCode.TELEMETRY_UNAVAILABLE)

    def test_recorded_baseline_missing_counts_blocks_admission(self):
        with self.assertRaises(ControllerError):
            load_baseline(self.policy)

    def test_baseline_rejects_nonfinite_and_future_values(self):
        artifact = json.loads((ROOT / "observability/baseline.json").read_text())
        artifact["capturedAt"] = datetime.now(timezone.utc).isoformat()
        artifact["workload"]["serviceRequestCounts"] = {"product-service": 200}
        with TemporaryDirectory(dir=ROOT) as directory:
            path = Path(directory) / "baseline.json"
            policy = copy.deepcopy(self.policy)
            policy["admission"]["baselineArtifact"] = str(path)
            artifact["http"]["failureRate"] = float("nan")
            path.write_text(json.dumps(artifact))
            with self.assertRaises(ControllerError):
                load_baseline(policy)
            artifact["http"]["failureRate"] = 0
            artifact["capturedAt"] = "2099-01-01T00:00:00+00:00"
            path.write_text(json.dumps(artifact))
            with self.assertRaises(ControllerError):
                load_baseline(policy)


if __name__ == "__main__":
    unittest.main()
