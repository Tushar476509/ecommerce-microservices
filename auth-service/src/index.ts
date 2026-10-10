import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import { errorHandler } from "./middlewares/errorHandler";
import { logger } from "./utils/logger";
import { PrismaClient } from "@prisma/client";
import { metricsMiddleware, metricsRegistry } from "./utils/metrics";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(metricsMiddleware);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later" },
  skip: (req) => req.path === "/metrics" || req.path.startsWith("/health/"),
});
app.use(limiter);

app.get("/health/live", (_req, res) => res.json({ status: "ok", service: "auth-service" }));
app.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "ready", service: "auth-service", dependencies: { postgres: "up" } });
  } catch (error) {
    logger.error("Auth readiness check failed:", error);
    return res.status(503).json({ status: "not_ready", service: "auth-service", dependencies: { postgres: "down" } });
  }
});
app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", metricsRegistry.contentType);
  return res.send(await metricsRegistry.metrics());
});

app.use("/", authRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Auth service running on port ${PORT}`);
});
