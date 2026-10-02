import { Router } from "express";
import passport from "passport";

import {
  createAuthToken,
  getUserById,
} from "../services/auth.service.js";

const router = Router();

/* =========================================================
   GOOGLE LOGIN
========================================================= */

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

/* =========================================================
   GOOGLE CALLBACK
========================================================= */

router.get(
  "/google/callback",

  passport.authenticate("google", {
    session: false,

    failureRedirect:
      `${process.env.FRONTEND_URL}/login?error=google_auth_failed`,
  }),

  (req, res) => {
    const user = req.user as {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
    };

    const token = createAuthToken(user);

    const frontendUrl =
      process.env.FRONTEND_URL ||
      "http://localhost:5174";

    res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(
        token,
      )}`,
    );
  },
);

/* =========================================================
   CURRENT USER
========================================================= */

router.get("/me", async (req, res) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
    });

    return;
  }

  try {
    const jwtToken = authorization
      .substring("Bearer ".length)
      .trim();

    const jwt = await import("jsonwebtoken");

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error(
        "JWT_SECRET is not configured.",
      );
    }

    const decoded = jwt.default.verify(
      jwtToken,
      secret,
    ) as {
      userId: string;
    };

    const user = await getUserById(
      decoded.userId,
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found.",
      });

      return;
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch {
    res.status(401).json({
      success: false,
      message:
        "Invalid or expired authentication token.",
    });
  }
});

export default router;