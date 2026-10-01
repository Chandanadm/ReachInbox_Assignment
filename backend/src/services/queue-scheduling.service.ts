import { emailQueue } from "../queues/email.queue.js";

interface QueueEmailInput {
  emailId: string;
  scheduledAt: Date;
}

export const scheduleEmailJob = async ({
  emailId,
  scheduledAt,
}: QueueEmailInput): Promise<string> => {
  const delay = Math.max(
    0,
    scheduledAt.getTime() - Date.now(),
  );

  const job = await emailQueue.add(
    "send-email",
    {
      emailId,
    },
    {
      jobId: `email-${emailId}`,
      delay,
    },
  );

  if (!job.id) {
    throw new Error(
      `Unable to create BullMQ job for email ${emailId}.`,
    );
  }

  return job.id;
};