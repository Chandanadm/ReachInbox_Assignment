import prisma from "../config/database.js";
import { scheduleEmailJob } from "./queue-scheduling.service.js";
import type { ScheduleEmailInput } from "../validators/email.validator.js";

export const createEmailCampaign = async (
  userId: string,
  input: ScheduleEmailInput,
) => {
  const startTime = new Date(input.startTime);

  if (Number.isNaN(startTime.getTime())) {
    throw new Error("Invalid start time.");
  }

  if (startTime.getTime() <= Date.now()) {
    throw new Error("Start time must be in the future.");
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const batch = await tx.emailBatch.create({
        data: {
          userId,
          totalRecipients:
            input.recipients.length,
          startTime,
          delaySeconds:
            input.delaySeconds,
          hourlyLimit:
            input.hourlyLimit,
        },
      });

      const emails = [];

      for (
        const [index, recipient]
        of input.recipients.entries()
      ) {
        const scheduledAt = new Date(
          startTime.getTime() +
            index *
              input.delaySeconds *
              1000,
        );

        const email = await tx.email.create({
          data: {
            userId,
            batchId: batch.id,
            recipientEmail:
              recipient.email,
            recipientName:
              recipient.name,
            subject: input.subject,
            body: input.body,
            scheduledAt,
            idempotencyKey:
              `${batch.id}:${recipient.email}`,
          },
        });

        await tx.emailRecipient.create({
          data: {
            emailId: email.id,
            email: recipient.email,
            name: recipient.name,
          },
        });

        emails.push(email);
      }

      return {
        batch,
        emails,
      };
    },
  );

  const queuedEmails = [];

  for (const email of result.emails) {
    const jobId = await scheduleEmailJob({
      emailId: email.id,
      scheduledAt: email.scheduledAt,
    });

    await prisma.email.update({
      where: {
        id: email.id,
      },
      data: {
        bullJobId: jobId,
      },
    });

    queuedEmails.push({
      emailId: email.id,
      jobId,
    });
  }

  return {
    ...result,
    queuedEmails,
  };
};