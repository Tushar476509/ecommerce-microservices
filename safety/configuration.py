from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POLICY = ROOT / "safety/config/policy.json"


class ConfigurationError(ValueError):
    pass


def load_policy(path: Path = DEFAULT_POLICY) -> dict[str, Any]:
    policy = json.loads(path.read_text(encoding="utf-8"))
    validate_policy(policy)
    return policy


def validate_policy(policy: dict[str, Any]) -> None:
    required_sections = {
        "schemaVersion",
        "policyVersion",
        "sandbox",
        "faults",
        "timing",
        "admission",
        "abort",
        "monitoring",
        "profiles",
    }
    missing = required_sections - policy.keys()
    if missing:
        raise ConfigurationError(f"Policy is missing sections: {sorted(missing)}")
    if policy["schemaVersion"] != 1:
        raise ConfigurationError("Unsupported policy schema version")
    if policy["sandbox"].get("enabled") is not True:
        raise ConfigurationError("Sandbox mode must be explicitly enabled")
    faults = policy["faults"]
    if faults.get("allowedTypes") != ["container-pause"]:
        raise ConfigurationError("MVP supports only container-pause")
    if faults.get("maximumConcurrentTargets") != 1:
        raise ConfigurationError("MVP requires exactly one fault target")
    if not 1 <= int(faults.get("maximumDurationSeconds", 0)) <= 60:
        raise ConfigurationError("Maximum fault duration must be between 1 and 60 seconds")
    excluded = {"postgres", "mongodb", "redis", "rabbitmq", "prometheus", "grafana", "cadvisor"}
    if excluded.intersection(faults.get("allowedTargets", [])):
        raise ConfigurationError("Infrastructure and monitoring services cannot be fault targets")
    for name, profile in policy["profiles"].items():
        if profile.get("target") not in faults["allowedTargets"]:
            raise ConfigurationError(f"Profile {name} has an unauthorized target")
        if profile.get("faultType") not in faults["allowedTypes"]:
            raise ConfigurationError(f"Profile {name} has an unsupported fault")
        if not 1 <= int(profile.get("durationSeconds", 0)) <= faults["maximumDurationSeconds"]:
            raise ConfigurationError(f"Profile {name} duration is outside policy bounds")
    urls = [probe.get("url", "") for probe in policy["monitoring"].get("probes", [])]
    if not urls or any(not url.startswith("http://localhost:") for url in urls):
        raise ConfigurationError("All MVP probes must use fixed loopback URLs")


def resolve_policy_path(policy: dict[str, Any], value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path

