import type { Request, Response } from "express";
import prisma from "../config/database.js";
import { createEmailCampaign } from "../services/email-scheduling.service.js";
import { scheduleEmailSchema } from "../validators/email.validator.js";

export const scheduleEmail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const validationResult = scheduleEmailSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Invalid campaign data.",
        errors: validationResult.error.flatten(),
      });
      return;
    }

    const campaign = await createEmailCampaign(
      userId,
      validationResult.data,
    );

    res.status(201).json({
      success: true,
      message: "Email campaign scheduled successfully.",
      data: {
        batchId: campaign.batch.id,
        totalRecipients: campaign.emails.length,
        startTime: campaign.batch.startTime,
        delaySeconds: campaign.batch.delaySeconds,
        hourlyLimit: campaign.batch.hourlyLimit,
      },
    });
  } catch (error) {
    console.error("Schedule email error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to schedule email campaign.";

    res.status(500).json({
      success: false,
      message,
    });
  }
};

export const getScheduledEmails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const emails = await prisma.email.findMany({
      where: {
        userId,
        status: {
          in: ["SCHEDULED", "PROCESSING"],
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      select: {
        id: true,
        recipientEmail: true,
        recipientName: true,
        subject: true,
        scheduledAt: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      success: true,
      data: emails,
      count: emails.length,
    });
  } catch (error) {
    console.error("Get scheduled emails error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch scheduled emails.",
    });
  }
};

export const getSentEmails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const emails = await prisma.email.findMany({
      where: {
        userId,
        status: {
          in: ["SENT", "FAILED"],
        },
      },
      orderBy: {
        sentAt: "desc",
      },
      select: {
        id: true,
        recipientEmail: true,
        recipientName: true,
        subject: true,
        sentAt: true,
        status: true,
        failureReason: true,
      },
    });

    res.status(200).json({
      success: true,
      data: emails,
      count: emails.length,
    });
  } catch (error) {
    console.error("Get sent emails error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch sent emails.",
    });
  }
};

export const getEmailStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const [scheduled, sent, campaigns] = await Promise.all([
      prisma.email.count({
        where: {
          userId,
          status: {
            in: ["SCHEDULED", "PROCESSING"],
          },
        },
      }),

      prisma.email.count({
        where: {
          userId,
          status: "SENT",
        },
      }),

      prisma.emailBatch.count({
        where: {
          userId,
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        scheduled,
        sent,
        campaigns,
      },
    });
  } catch (error) {
    console.error("Get email stats error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch email statistics.",
    });
  }
};