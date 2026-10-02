import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  createSlackAuthorizationUrl,
  handleSlackOAuthCallback,
} from "../services/slack.service.js";

const router = Router();

router.get("/authorize-url", requireAuth, (req, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const authorizationUrl = createSlackAuthorizationUrl(
      req.userId,
    );

    res.status(200).json({
      success: true,
      authorizationUrl,
    });
  } catch (error) {
    console.error("Slack authorization URL error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create Slack authorization URL.",
    });
  }
});

router.get("/callback", async (req, res) => {
  const code =
    typeof req.query.code === "string"
      ? req.query.code
      : undefined;

  const state =
    typeof req.query.state === "string"
      ? req.query.state
      : undefined;

  const frontendUrl =
    process.env.FRONTEND_URL ??
    "http://localhost:5173";

  if (!code || !state) {
    res.redirect(
      `${frontendUrl}/?slack=error`,
    );
    return;
  }

  try {
    await handleSlackOAuthCallback(code, state);

    res.redirect(
      `${frontendUrl}/?slack=connected`,
    );
  } catch (error) {
    console.error("Slack OAuth callback error:", error);

    res.redirect(
      `${frontendUrl}/?slack=error`,
    );
  }
});

export default router;