import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import passport from "passport";

import prisma from "./config/database.js";
import configureGoogleAuth from "./config/auth.js";

import authRoutes from "./routes/auth.routes.js";
import emailRoutes from "./routes/email.routes.js";

const app = express();

configureGoogleAuth();

app.use(helmet());

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ??
      "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

app.use(passport.initialize());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: "ReachInbox backend is healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Database health check failed:",
      error,
    );

    res.status(503).json({
      success: false,
      message:
        "ReachInbox backend is running, but database is unavailable",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

app.use("/api/auth", authRoutes);

app.use("/api/emails", emailRoutes);

export default app;