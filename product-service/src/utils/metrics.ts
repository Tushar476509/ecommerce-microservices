import { NextFunction, Request, Response } from "express";
import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();
metricsRegistry.setDefaultLabels({ service: "product-service" });
collectDefaultMetrics({ register: metricsRegistry });

const httpRequests = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [metricsRegistry],
});

const httpDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/metrics" || req.path.startsWith("/health/")) {
    return next();
  }

  const end = httpDuration.startTimer();
  res.on("finish", () => {
    const route = `${req.baseUrl}${req.route?.path || req.path}`;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequests.inc(labels);
    end(labels);
  });
  next();
};
