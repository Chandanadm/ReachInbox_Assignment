import { Worker } from "bullmq";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not configured.");
}

const redis = new URL(redisUrl);

export const emailWorker = new Worker(
  "email-scheduler",
  async (job) => {
    console.log(
      `Processing email job: ${job.id}`,
    );

    console.log(
      `Email ID: ${job.data.emailId}`,
    );

    // Email sending will be implemented next.
    // For now, this confirms that BullMQ
    // can receive and process a scheduled job.

    return {
      success: true,
      emailId: job.data.emailId,
    };
  },
  {
    connection: {
      host: redis.hostname,
      port: Number(redis.port || 6379),
      username:
        redis.username || undefined,
      password:
        redis.password || undefined,
      tls: {
        rejectUnauthorized: true,
      },
    },

    concurrency: Number(
      process.env.WORKER_CONCURRENCY ?? 5,
    ),
  },
);

emailWorker.on("completed", (job) => {
  console.log(
    `Email job completed: ${job.id}`,
  );
});

emailWorker.on("failed", (job, error) => {
  console.error(
    `Email job failed: ${job?.id ?? "unknown"}`,
    error.message,
  );
});

emailWorker.on("error", (error) => {
  console.error(
    "Email worker error:",
    error.message,
  );
});