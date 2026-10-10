import amqp from "amqplib";
import { OrderEvent } from "../types";
import { sendEmail } from "../utils/email";
import { NotificationModel } from "../models/Notification";
import { logger } from "../utils/logger";
import {
  orderCreatedTemplate,
  paymentConfirmedTemplate,
  orderShippedTemplate,
  orderDeliveredTemplate,
} from "../templates/emails";
import { notificationDuration, notificationEvents } from "../utils/metrics";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://ecommerce:ecommerce123@localhost:5672";

const getRecipient = (data: OrderEvent) =>
  data.email || process.env.DEFAULT_NOTIFICATION_EMAIL || "customer@example.com";

const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      logger.warn(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error("All retries exhausted");
};

const handleOrderCreated = async (data: OrderEvent) => {
  logger.info(`Processing order.created: ${data.orderId}`);
  const recipient = getRecipient(data);

  const html = orderCreatedTemplate({
    orderId: data.orderId,
    total: data.total || 0,
    items: data.items || [],
  });

  await retryWithBackoff(async () => {
    await sendEmail(
      recipient,
      `Order Confirmed - #${data.orderId}`,
      html
    );
    return true;
  });

  await NotificationModel.create({
    type: "order.created",
    email: recipient,
    subject: `Order Confirmed - #${data.orderId}`,
    html,
    metadata: data,
    status: "sent",
  });
};

const handlePaymentConfirmed = async (data: OrderEvent) => {
  logger.info(`Processing payment.confirmed: ${data.orderId}`);
  const recipient = getRecipient(data);

  const html = paymentConfirmedTemplate({ orderId: data.orderId });

  await retryWithBackoff(async () => {
    await sendEmail(
      recipient,
      `Payment Confirmed - #${data.orderId}`,
      html
    );
    return true;
  });

  await NotificationModel.create({
    type: "payment.confirmed",
    email: recipient,
    subject: `Payment Confirmed - #${data.orderId}`,
    html,
    metadata: data,
    status: "sent",
  });
};

const handleOrderShipped = async (data: OrderEvent) => {
  logger.info(`Processing order.shipped: ${data.orderId}`);
  const recipient = getRecipient(data);

  const html = orderShippedTemplate({
    orderId: data.orderId,
    trackingNumber: data.trackingNumber || "",
    estimatedDelivery: data.estimatedDelivery || "",
  });

  await retryWithBackoff(async () => {
    await sendEmail(
      recipient,
      `Your Order Has Shipped - #${data.orderId}`,
      html
    );
    return true;
  });

  await NotificationModel.create({
    type: "order.shipped",
    email: recipient,
    subject: `Your Order Has Shipped - #${data.orderId}`,
    html,
    metadata: data,
    status: "sent",
  });
};

const handleOrderDelivered = async (data: OrderEvent) => {
  logger.info(`Processing order.delivered: ${data.orderId}`);
  const recipient = getRecipient(data);

  const html = orderDeliveredTemplate({ orderId: data.orderId });

  await retryWithBackoff(async () => {
    await sendEmail(
      recipient,
      `Order Delivered - #${data.orderId}`,
      html
    );
    return true;
  });

  await NotificationModel.create({
    type: "order.delivered",
    email: recipient,
    subject: `Order Delivered - #${data.orderId}`,
    html,
    metadata: data,
    status: "sent",
  });
};

export const startConsumer = async () => {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertExchange("orders", "topic", { durable: true });

  const queue = await channel.assertQueue("notifications", { durable: true });

  const routingKeys = [
    "order.created",
    "payment.confirmed",
    "order.shipped",
    "order.delivered",
  ];

  for (const key of routingKeys) {
    await channel.bindQueue(queue.queue, "orders", key);
  }

  const handlers: Record<string, (data: OrderEvent) => Promise<void>> = {
    "order.created": handleOrderCreated,
    "payment.confirmed": handlePaymentConfirmed,
    "order.shipped": handleOrderShipped,
    "order.delivered": handleOrderDelivered,
  };

  channel.consume(queue.queue, async (msg) => {
    if (!msg) return;

    const routingKey = msg.fields.routingKey;
    const stopTimer = notificationDuration.startTimer({ routing_key: routingKey });

    try {
      const data: OrderEvent = JSON.parse(msg.content.toString());
      logger.info(`Received event: ${routingKey}`, data);
      const handler = handlers[routingKey];
      if (handler) {
        await handler(data);
      }
      notificationEvents.inc({ routing_key: routingKey, status: "success" });
      channel.ack(msg);
    } catch (error) {
      notificationEvents.inc({ routing_key: routingKey, status: "failure" });
      logger.error(`Error processing ${routingKey}:`, error);
      channel.nack(msg, false, true);
    } finally {
      stopTimer();
    }
  });

  logger.info("Notification consumer started");
};
