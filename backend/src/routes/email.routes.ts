import { Router } from "express";
import {
  getEmailStats,
  getScheduledEmails,
  getSentEmails,
  scheduleEmail,
} from "../controllers/email.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/schedule", requireAuth, scheduleEmail);

router.get("/scheduled", requireAuth, getScheduledEmails);

router.get("/sent", requireAuth, getSentEmails);

router.get("/stats", requireAuth, getEmailStats);

export default router;