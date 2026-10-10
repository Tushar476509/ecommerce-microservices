import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import { startConsumer } from "./consumers/orderConsumer";
import { logger } from "./utils/logger";
import { verifyEmailTransport } from "./utils/email";
import { metricsRegistry } from "./utils/metrics";

dotenv.config();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const healthApp = express();
const HEALTH_PORT = Number(process.env.HEALTH_PORT || 3004);
let consumerReady = false;

healthApp.get("/health/live", (_req, res) => {
  res.json({ status: "ok", service: "notification-service" });
});

healthApp.get("/health/ready", async (_req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  let smtpReady = false;

  try {
    await verifyEmailTransport();
    smtpReady = true;
  } catch {
    smtpReady = false;
  }

  const ready = mongoReady && consumerReady && smtpReady;
  return res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    service: "notification-service",
    dependencies: {
      mongodb: mongoReady ? "up" : "down",
      rabbitmq: consumerReady ? "up" : "down",
      mailhog: smtpReady ? "up" : "down",
    },
  });
});

healthApp.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", metricsRegistry.contentType);
  return res.send(await metricsRegistry.metrics());
});

const start = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://ecommerce:ecommerce123@localhost:27017/ecommerce?authSource=admin"
    );
    logger.info("Connected to MongoDB");
  } catch (error) {
    logger.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }

  let retries = 10;
  while (retries > 0) {
    try {
      await startConsumer();
      consumerReady = true;
      healthApp.listen(HEALTH_PORT, () => {
        logger.info(`Notification health server running on port ${HEALTH_PORT}`);
      });
      logger.info("Notification service running");
      return;
    } catch (error) {
      retries--;
      if (retries === 0) {
        logger.error("Failed to start consumer after retries:", error);
        process.exit(1);
      }
      logger.warn(`RabbitMQ not ready, retrying... (${retries} left)`);
      await wait(5000);
    }
  }
};

start();
