# Day 1 manual kill-switch acceptance

The existing stop experiment demonstrates automatic rollback at its 15-second
outage limit. The missing check is whether an externally engaged kill switch
also removes the fault and restores the application.

## Reproduce in a local Docker sandbox

Run from the repository root, with Docker Compose and Python 3.10 or later:

```bash
docker compose up -d --build --wait --wait-timeout 240
python -m chaos.accept_manual_kill
```

Wait for Prometheus to scrape all four application services before starting the
test. The acceptance command starts the normal experiment in a separate process.
After that process records both the notification outage and a buffered message,
the acceptance operator creates `chaos/KILL_SWITCH`, exactly as a person would
from a second terminal. The runner must report `termination=kill_switch`, restart
the target, and verify that checkout succeeded, all application targets recovered,
the message queue drained, and the buffered email was delivered within the
recovery deadline. A threshold-triggered stop or dry run does not count.

Two files retain the actual observations:

- `chaos/results/manual-kill-experiment.json`: fault samples, canary checkout,
  kill reason, recovery timing, and before/after state.
- `chaos/results/manual-kill-acceptance.json`: acceptance assertions and timestamps.

The test refuses to start if the kill switch is already engaged. It clears only
the switch it created after every acceptance assertion passes; otherwise it
leaves the switch engaged for inspection. It does not overwrite the historical
automatic rollback result. The runner also checks for kill before taking another
monitoring sample and preserves earlier errors even when rollback succeeds.

## GitHub Actions demonstration

The `Day 1 live acceptance` workflow creates a disposable Docker sandbox, runs
the same test, and retains the result files and container logs in the
`day1-kill-switch-evidence` artifact even when the test fails. It removes only the
workflow's disposable Compose containers and volumes afterward.

Run this workflow manually from Actions after merging it. A successful workflow
and a `status=passed` acceptance report provide the missing kill-switch evidence.
Unit tests exercise decision handling with mocked infrastructure and are not
substitutes for that live report.

This validates the existing Day 1 container-stop path. It does not certify the
new container-pause actuator or resolve that controller's separate baseline and
live watchdog acceptance requirements.
