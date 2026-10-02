import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import passport from "passport";

import prisma from "./config/database.js";
import configureGoogleAuth from "./config/auth.js";

import authRoutes from "./routes/auth.routes.js";
import emailRoutes from "./routes/email.routes.js";
import slackRoutes from "./routes/slack.routes.js";
import searchRoutes from "./routes/search.routes.js";

import bullBoard from "./config/bull-board.js";
import {
  initializeEmailIndex,
} from "./services/elasticsearch.service.js";

const app = express();

configureGoogleAuth();

/*
 * Initialize Elasticsearch index.
 *
 * If Elasticsearch is unavailable, the application still starts.
 * The error is logged so the rest of the application remains usable.
 */
void initializeEmailIndex().catch((error) => {
  console.error(
    "Elasticsearch initialization failed:",
    error,
  );
});

/*
 * Security middleware
 */
app.use(helmet());

/*
 * CORS
 */
app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ??
      "http://localhost:5174",
    credentials: true,
  }),
);

/*
 * Request body parsing
 */
app.use(
  express.json({
    limit: "2mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
  }),
);

/*
 * HTTP request logging
 */
app.use(morgan("dev"));

/*
 * Passport initialization
 */
app.use(passport.initialize());

/*
 * Health check
 */
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

/*
 * Authentication routes
 *
 * /api/auth/google
 * /api/auth/google/callback
 * /api/auth/me
 */
app.use(
  "/api/auth",
  authRoutes,
);

/*
 * Email routes
 *
 * /api/emails/schedule
 * /api/emails/scheduled
 * /api/emails/sent
 * /api/emails/stats
 */
app.use(
  "/api/emails",
  emailRoutes,
);

/*
 * Slack OAuth and notification routes
 */
app.use(
  "/api/slack",
  slackRoutes,
);

/*
 * Elasticsearch search routes
 *
 * GET /api/search/emails?q=...
 */
app.use(
  "/api/search",
  searchRoutes,
);

/*
 * BullMQ dashboard
 *
 * Open:
 * http://localhost:5000/admin/queues
 */
app.use(
  "/admin/queues",
  bullBoard.getRouter(),
);

/*
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/*
 * Global error handler
 */
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(
      "Unhandled application error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Internal server error.";

    res.status(500).json({
      success: false,
      message,
    });
  },
);

export default app;