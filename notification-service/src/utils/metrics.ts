import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();
metricsRegistry.setDefaultLabels({ service: "notification-service" });
collectDefaultMetrics({ register: metricsRegistry });

export const notificationEvents = new Counter({
  name: "notification_events_processed_total",
  help: "Total notification events processed",
  labelNames: ["routing_key", "status"] as const,
  registers: [metricsRegistry],
});

export const notificationDuration = new Histogram({
  name: "notification_processing_duration_seconds",
  help: "Notification event processing duration in seconds",
  labelNames: ["routing_key"] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});
