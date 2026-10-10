import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import orderRoutes from "./routes/orderRoutes";
import { connectRabbitMQ, getChannel } from "./utils/rabbitmq";
import { logger } from "./utils/logger";
import { errorHandler } from "./middlewares/errorHandler";
import { PrismaClient } from "@prisma/client";
import { metricsMiddleware, metricsRegistry } from "./utils/metrics";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));

app.use("/webhook/stripe", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(metricsMiddleware);

app.get("/health/live", (_req, res) => res.json({ status: "ok", service: "order-service" }));
app.get("/health/ready", async (_req, res) => {
  try {
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      getChannel().checkExchange("orders"),
    ]);
    return res.json({
      status: "ready",
      service: "order-service",
      dependencies: { postgres: "up", rabbitmq: "up" },
    });
  } catch (error) {
    logger.error("Order readiness check failed:", error);
    return res.status(503).json({
      status: "not_ready",
      service: "order-service",
      dependencies: { postgres: "unknown", rabbitmq: "unknown" },
    });
  }
});
app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", metricsRegistry.contentType);
  return res.send(await metricsRegistry.metrics());
});

app.use("/", orderRoutes);

app.use(errorHandler);

const start = async () => {
  try {
    await connectRabbitMQ();

    app.listen(PORT, () => {
      logger.info(`Order service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start order service:", error);
    process.exit(1);
  }
};

start();
