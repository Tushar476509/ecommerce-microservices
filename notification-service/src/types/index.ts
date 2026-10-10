export interface OrderEvent {
  orderId: string;
  userId: string;
  email?: string;
  total?: number;
  items?: { name: string; price: number; quantity: number }[];
  status?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

export interface Notification {
  type: string;
  email: string;
  subject: string;
  html: string;
  metadata: Record<string, any>;
  createdAt: Date;
}
