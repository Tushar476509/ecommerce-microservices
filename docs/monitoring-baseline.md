# Monitoring baseline

Captured on 2026-10-10 under a repeatable two-minute local workload.

## Workload

- Five concurrent browsing users.
- Three checkout arrivals per minute.
- 1,793 HTTP requests at 14.30 requests/second.
- 601 completed iterations.

Run the same workload again with:

```bash
docker compose --profile tools run --rm k6
```

## Normal behavior

HTTP request metrics exclude `/metrics` and `/health/*` so latency and error
rates describe application traffic rather than observability probes.

| Signal | Baseline |
|---|---:|
| HTTP failures | 0 / 1,793 (0%) |
| Checks | 1,791 / 1,791 (100%) |
| Checkout success | 6 / 6 (100%) |
| Average latency | 9.01 ms |
| Overall p95 latency | 19.17 ms |
| Auth p95 latency | 38.68 ms |
| Product p95 latency | 18.90 ms |
| Order p95 latency | 32.82 ms |
| Notification processing p95 | 97.50 ms |
| RabbitMQ ready messages | 0 |
| Container restarts | 0 |
| Firing alerts | 0 |

The machine-readable result is stored in
[`observability/baseline.json`](../observability/baseline.json), and the raw k6
summary is stored in
[`observability/results/k6-summary.json`](../observability/results/k6-summary.json).

## Safety thresholds derived from the baseline

- Abort if HTTP 5xx rate exceeds 5% for 15 seconds.
- Abort if service p95 latency exceeds 100 ms for 15 seconds.
- Abort if any application target is down for 15 seconds.
- Abort if the RabbitMQ ready-message backlog exceeds 50.
- Affect no more than one target per experiment.
- Limit an experiment to 20 seconds and require recovery within 30 seconds.

Prometheus evaluates the observable thresholds from
`observability/prometheus/alert-rules.yml`. The remaining execution limits must
also be enforced by the chaos safety controller.

Rate and latency alerts require at least 0.1 requests/second so a single event
cannot create a false percentage or histogram alert. The bcrypt-backed login
route is excluded from the general 100 ms API latency threshold because its
intentional password hashing cost has a separate performance profile.
