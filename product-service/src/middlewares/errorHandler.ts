import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error("Unhandled product-service error:", err);
  return res.status(500).json({ error: "Internal server error" });
};
