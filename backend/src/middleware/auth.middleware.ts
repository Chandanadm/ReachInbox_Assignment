import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return secret;
};

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
    return;
  }

  const token = authorization.substring("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;

    if (!decoded.userId || !decoded.email) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
      return;
    }

    req.userId = decoded.userId;
    req.userEmail = decoded.email;

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
};