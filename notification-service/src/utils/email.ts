import nodemailer from "nodemailer";
import { logger } from "./logger";

const getTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT || 1025),
    secure: false,
  });

export const verifyEmailTransport = async () => getTransporter().verify();

export const sendEmail = async (
  to: string,
  subject: string,
  html: string
) => {
  const info = await getTransporter().sendMail({
    from: process.env.FROM_EMAIL || "noreply@ecommerce.com",
    to,
    subject,
    html,
  });

  logger.info(`Email accepted by MailHog for ${to}: ${subject}`, {
    messageId: info.messageId,
  });
};
