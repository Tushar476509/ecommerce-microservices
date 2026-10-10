import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { AuthRequest, CreateOrderBody, ORDER_STATUS_FLOW } from "../types";
import { publishEvent } from "../utils/rabbitmq";
import { generateInvoice } from "../utils/invoice";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();
const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey.startsWith("sk_live") || stripeKey.startsWith("sk_test_") && !stripeKey.includes("placeholder")
  ? new Stripe(stripeKey)
  : null;

export const createOrder = async (req: AuthRequest, res: Response) => {
  const { items, shippingAddress, paymentMethod } = req.body as CreateOrderBody;

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const shipping = subtotal > 100 ? 0 : 10;
  const total = subtotal + shipping;

  const order = await prisma.order.create({
    data: {
      userId: req.user!.id,
      subtotal,
      shipping,
      total,
      shippingAddress,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
        })),
      },
    },
    include: { items: true },
  });

  if (paymentMethod === "stripe" && stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: "usd",
        metadata: { orderId: order.id },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { paymentIntentId: paymentIntent.id },
      });

      await publishEvent("order.created", {
        orderId: order.id,
        userId: req.user!.id,
        email: req.user!.email,
        total,
        items,
      });

      logger.info(`Order created with Stripe: ${order.id}`);
      return res.status(201).json({
        order,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (stripeError) {
      logger.error("Stripe payment failed, order created without payment:", stripeError);
    }
  }

  await publishEvent("order.created", {
    orderId: order.id,
    userId: req.user!.id,
    email: req.user!.email,
    total,
    items,
  });

  logger.info(`Order created: ${order.id}`);
  return res.status(201).json({ order });
};

export const getOrders = async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (req.user!.role !== "ADMIN") {
    where.userId = req.user!.id;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count({ where }),
  ]);

  return res.json({
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};

export const getOrderById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  if (req.user!.role !== "ADMIN" && order.userId !== req.user!.id) {
    return res.status(403).json({ error: "Access denied" });
  }

  return res.json(order);
};

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  const allowedTransitions = ORDER_STATUS_FLOW[order.status] || [];
  if (!allowedTransitions.includes(status)) {
    return res.status(400).json({
      error: `Cannot transition from ${order.status} to ${status}`,
      allowedTransitions: allowedTransitions,
    });
  }

  const updateData: any = { status };

  if (status === "paid" || status === "confirmed") {
    updateData.paidAt = new Date();
  }

  if (status === "shipped") {
    updateData.trackingNumber =
      "BR" + Math.random().toString(36).substring(2, 10).toUpperCase();
    updateData.estimatedDelivery = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );
  }

  const updated = await prisma.order.update({
    where: { id },
    data: updateData,
    include: { items: true },
  });

  const eventMap: Record<string, string> = {
    confirmed: "order.confirmed",
    shipped: "order.shipped",
    delivered: "order.delivered",
    cancelled: "order.cancelled",
  };

  if (eventMap[status]) {
    await publishEvent(eventMap[status], {
      orderId: id,
      userId: order.userId,
      status,
      trackingNumber: updated.trackingNumber,
      estimatedDelivery: updated.estimatedDelivery,
    });
  }

  logger.info(`Order ${id} status updated to ${status}`);
  return res.json(updated);
};

export const getOrderTracking = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      trackingNumber: true,
      estimatedDelivery: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  if (req.user!.role !== "ADMIN" && order.id !== id) {
    return res.status(403).json({ error: "Access denied" });
  }

  return res.json(order);
};

export const downloadInvoice = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  if (req.user!.role !== "ADMIN" && order.userId !== req.user!.id) {
    return res.status(403).json({ error: "Access denied" });
  }

  const pdf = await generateInvoice({
    orderId: order.id,
    customerName: req.user!.email,
    customerEmail: req.user!.email,
    items: order.items,
    subtotal: order.subtotal,
    shipping: order.shipping,
    discount: order.discount,
    total: order.total,
    createdAt: order.createdAt,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=invoice-${order.id}.pdf`
  );
  res.send(pdf);
};

export const stripeWebhook = async (req: AuthRequest, res: Response) => {
  if (!stripe) {
    return res.status(400).json({ error: "Stripe not configured" });
  }

  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch {
    return res.status(400).json({ error: "Invalid signature" });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;

    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "confirmed", paidAt: new Date() },
      });

      await publishEvent("payment.confirmed", { orderId });
      logger.info(`Payment confirmed for order ${orderId}`);
    }
  }

  return res.json({ received: true });
};
