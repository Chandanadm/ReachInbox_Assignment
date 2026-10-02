import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  searchEmails,
} from "../services/elasticsearch.service.js";

const router = Router();

router.get(
  "/emails",
  requireAuth,
  async (req, res) => {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message:
            "Authentication required.",
        });
        return;
      }

      const query =
        typeof req.query.q === "string"
          ? req.query.q.trim()
          : "";

      if (!query) {
        res.status(400).json({
          success: false,
          message:
            "Search query is required.",
        });
        return;
      }

      const results =
        await searchEmails(
          req.userId,
          query,
        );

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error(
        "Email search error:",
        error,
      );

      res.status(500).json({
        success: false,
        message:
          "Email search is currently unavailable.",
      });
    }
  },
);

export default router;