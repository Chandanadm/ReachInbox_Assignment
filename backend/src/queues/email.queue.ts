import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not configured.");
}

const redis = new URL(redisUrl);

export const emailQueue = new Queue("email-scheduler", {
  connection: {
    host: redis.hostname,
    port: Number(redis.port || 6379),
    username: redis.username || undefined,
    password: redis.password || undefined,
    tls: {
      rejectUnauthorized: true,
    },
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400,
      count: 10000,
    },
    removeOnFail: {
      age: 604800,
    },
  },
});