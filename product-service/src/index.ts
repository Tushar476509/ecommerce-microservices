import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import dotenv from "dotenv";
import productRoutes from "./routes/productRoutes";
import { connectRedis } from "./utils/cache";
import { logger } from "./utils/logger";
import { redisClient } from "./utils/cache";
import { errorHandler } from "./middlewares/errorHandler";
import { metricsMiddleware, metricsRegistry } from "./utils/metrics";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(metricsMiddleware);

app.get("/health/live", (_req, res) => res.json({ status: "ok", service: "product-service" }));
app.get("/health/ready", (_req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisReady = redisClient.isReady;
  const ready = mongoReady && redisReady;

  return res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    service: "product-service",
    dependencies: {
      mongodb: mongoReady ? "up" : "down",
      redis: redisReady ? "up" : "down",
    },
  });
});
app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", metricsRegistry.contentType);
  return res.send(await metricsRegistry.metrics());
});

app.use("/", productRoutes);
app.use(errorHandler);

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://ecommerce:ecommerce123@localhost:27017/ecommerce?authSource=admin");
    logger.info("Connected to MongoDB");

    await connectRedis();

    app.listen(PORT, () => {
      logger.info(`Product service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start product service:", error);
    process.exit(1);
  }
};

start();
