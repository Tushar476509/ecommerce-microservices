# Safety review and intelligent experiment planning

Reviewed on 2026-10-10 against the supplied Bosch solution plan. The document
provides requirements context; the existing Docker Compose stack is retained.

## Verdict: safety is partially implemented, acceptance remains pending

The latest repository is ahead of the old screenshot. `safety/actuator.py` and
`safety/journal.py` implement independent lease expiry, absolute deadlines,
persistent kill latching, generation revocation, rollback intent, restart
reconciliation, and verified unpause with retries. Target identity is checked
against Compose project/service/working-directory labels. Policy excludes
infrastructure targets, permits one container, and caps duration at 60 seconds.
`safety/policy.py` evaluates sustained error/latency limits, telemetry loss,
staleness, traffic validity, and critical probes.

However, safety cannot yet be marked complete:

- The committed baseline lacks `workload.serviceRequestCounts`, so the current
  controller refuses admission for product-service. Aggregate workload totals
  cannot substitute for measured per-service counts.
- Preflight and recovery previously checked probes and target health without
  checking metric freshness, completeness, error rate, latency, or traffic.
  This change adds those checks and rejects nonfinite/future baseline values.
- Missing required telemetry/probes could bypass monitoring-loss detection;
  the evaluator now treats these as unknown monitoring.
- No live acceptance results are committed for the new pause actuator. The old
  `chaos/results/notification-service-crash.json` exercises a different stop
  runner and cannot establish pause-watchdog/crash safety.

The historical baseline is preserved rather than backfilled with invented data.
No Docker executable was available during this review; tests use controlled
telemetry and do not establish live Docker rollback or business-flow recovery.

## Planning preview

Run from the repository root with Python 3.10 or later:

```bash
python -m chaos.planner
python -m chaos.planner --history history.json --output plan.json
python -m unittest discover -s tests -v
```

The planner implements the solution plan's deterministic option A. It emits
JSON proposals with policy version, baseline admission status, ranked approved
profiles, hypotheses, dependencies/upstream reachability, score components,
abort thresholds, and escalation blockers. It never injects faults or changes
policy. A candidate's `eligible` field describes history prerequisites only;
baseline admission and controller live preflight are separate mandatory gates.

Score = criticality * fragilityProxy / cost. Criticality uses upstream
reachability and checkout roles, dependency count is an explicit fragility proxy,
and cost uses upstream exposure and duration. These are explainable heuristics,
not probabilities. The configured graph is not runtime propagation evidence.
There is no LLM dependency or authority to execute proposed faults.

Only the existing notification-pause profiles are proposed. The 12-second
acceptance profile comes first; the 20-second profile requires the latest shorter
run under the current policy version to have `state=COMPLETED`,
`cleanupStatus=verified`, and `recoveryStatus=confirmed`. Latest failed/aborted
runs block retry and escalation. History is a JSON array of controller results,
oldest first; controller results now include `profile`. Old container-stop
results and older policy versions cannot unlock escalation.

## Required sandbox acceptance

1. Refresh the baseline under steady load with measured per-service counts,
   current capture time, per-service p95, and actual restart evidence. Product
   needs at least 100 requests in the artifact and in each live 60-second window.
   Keep browse load running during recovery.
2. On Linux/WSL with Docker's Unix socket, start
   `python -m safety.actuator --serve`. The Unix-socket actuator is not intended
   to run directly on this Windows host.
3. Exercise `SafetyController.run("notification-pause-acceptance")` against the
   live monitoring adapter and actuator client. Deliberately breach a threshold,
   invoke manual kill, interrupt the controller, expire a lease, and restart the
   actuator with unfinished journal state. Verify actual unpause and sustained
   healthy protected metrics/probes.
4. Retain journal and controller results before declaring safety complete or
   expanding the approved experiment catalog.

Queue draining, checkout correctness, measured propagation, and broader fault
types remain outside this preview's verified coverage. The legacy stop runner's
file kill switch is separate from the newer actuator's journaled kill latch.
