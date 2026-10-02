import {
  DelayedError,
  Worker,
  type Job,
} from "bullmq";
import nodemailer from "nodemailer";
import prisma from "../config/database.js";
import {
  reserveEmailSendSlot,
} from "../services/rate-limit.service.js";
import {
  notifyHourlyLimitReached,
} from "../services/slack.service.js";
import { indexEmail } from "../services/elasticsearch.service.js";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not configured.");
}

const redis = new URL(redisUrl);

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(
  process.env.SMTP_PORT ?? 587,
);
const smtpUser = process.env.SMTP_USER;
const smtpPassword =
  process.env.SMTP_PASSWORD;
const smtpFrom = process.env.SMTP_FROM;

if (
  !smtpHost ||
  !smtpUser ||
  !smtpPassword ||
  !smtpFrom
) {
  throw new Error(
    "SMTP configuration is incomplete.",
  );
}

const transporter =
  nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

interface EmailJobData {
  emailId: string;
}

const concurrency = Math.max(
  1,
  Number(
    process.env.WORKER_CONCURRENCY ?? 5,
  ),
);

export const emailWorker =
  new Worker<EmailJobData>(
    "email-scheduler",
    async (
      job: Job<EmailJobData>,
      token?: string,
    ) => {
      const { emailId } = job.data;

      const email =
        await prisma.email.findUnique({
          where: {
            id: emailId,
          },
          include: {
            batch: true,
          },
        });

      if (!email) {
        throw new Error(
          `Email ${emailId} not found.`,
        );
      }

      if (
        email.status === "SENT" ||
        email.sentAt
      ) {
        return {
          success: true,
          emailId,
          skipped: true,
        };
      }

      /*
       * Claim the email atomically.
       * Only one worker can change SCHEDULED -> PROCESSING.
       */
      const claimed =
        await prisma.email.updateMany({
          where: {
            id: emailId,
            status: "SCHEDULED",
            sentAt: null,
          },
          data: {
            status: "PROCESSING",
            attemptCount: {
              increment: 1,
            },
          },
        });

      if (claimed.count !== 1) {
        return {
          success: true,
          emailId,
          skipped: true,
        };
      }

      const hourlyLimit =
        email.batch.hourlyLimit ?? 100000;

      const rate =
        await reserveEmailSendSlot(
          email.userId,
          email.id,
          hourlyLimit,
          email.batch.delaySeconds,
        );

      if (
        rate.allowedAt >
        Date.now()
      ) {
        /*
         * Return the email to SCHEDULED before moving
         * the BullMQ job to delayed state.
         */
        await prisma.email.update({
          where: {
            id: emailId,
          },
          data: {
            status: "SCHEDULED",
          },
        });

        if (!token) {
          throw new Error(
            "BullMQ worker token is missing.",
          );
        }

        await job.moveToDelayed(
          rate.allowedAt,
          token,
        );

        /*
         * Only notify when the delay crosses into
         * another hourly window.
         */
        const currentWindow =
          Math.floor(
            Date.now() / 3600000,
          ) * 3600000;

        if (
          rate.hourlyWindowStart >
          currentWindow
        ) {
          try {
            await notifyHourlyLimitReached(
              email.userId,
              currentWindow,
              hourlyLimit,
            );
          } catch (error) {
            console.error(
              "Slack notification failed:",
              error,
            );
          }
        }

        throw new DelayedError();
      }

      try {
        const info =
          await transporter.sendMail({
            from: smtpFrom,
            to: email.recipientEmail,
            subject: email.subject,
            text: email.body,
            html: email.body.replace(
              /\n/g,
              "<br />",
            ),
          });

        const sentAt = new Date();

        await prisma.email.update({
          where: {
            id: emailId,
          },
          data: {
            status: "SENT",
            sentAt,
            failureReason: null,
          },
        });

        await prisma.emailRecipient.update({
          where: {
            emailId,
          },
          data: {
            status: "SENT",
            sentAt,
            failureReason: null,
          },
        });

        /*
         * Index the successfully sent email in Elasticsearch.
         *
         * Elasticsearch failure must not mark the actual
         * email as FAILED because the email was already sent.
         */
        try {
          await indexEmail({
            userId: email.userId,
            emailId: email.id,
            recipientEmail:
              email.recipientEmail,
            recipientName:
              email.recipientName,
            subject: email.subject,
            body: email.body,
            status: "SENT",
            scheduledAt:
              email.scheduledAt.toISOString(),
            sentAt: sentAt.toISOString(),
            failureReason: null,
          });

          console.log(
            `Email indexed in Elasticsearch: ${emailId}`,
          );
        } catch (error) {
          console.error(
            `Elasticsearch indexing failed for email ${emailId}:`,
            error,
          );
        }

        console.log(
          `Email sent successfully: ${emailId}`,
        );

        if (info.messageId) {
          console.log(
            `Ethereal message ID: ${info.messageId}`,
          );
        }

        return {
          success: true,
          emailId,
          messageId: info.messageId,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown email sending error.";

        await prisma.email.update({
          where: {
            id: emailId,
          },
          data: {
            status: "FAILED",
            failureReason: message,
          },
        });

        await prisma.emailRecipient.update({
          where: {
            emailId,
          },
          data: {
            status: "FAILED",
            failureReason: message,
          },
        });

        throw error;
      }
    },
    {
      connection: {
        host: redis.hostname,
        port: Number(
          redis.port || 6379,
        ),
        username:
          redis.username || undefined,
        password:
          redis.password || undefined,
        tls: {
          rejectUnauthorized: true,
        },
      },
      concurrency,
    },
  );

emailWorker.on(
  "completed",
  (job) => {
    console.log(
      `Email job completed: ${job.id}`,
    );
  },
);

emailWorker.on(
  "failed",
  (job, error) => {
    console.error(
      `Email job failed: ${
        job?.id ?? "unknown"
      }`,
      error.message,
    );
  },
);

emailWorker.on(
  "error",
  (error) => {
    console.error(
      "Email worker error:",
      error.message,
    );
  },
);