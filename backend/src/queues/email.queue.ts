import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not configured.");
}

const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 10000,
  keepAlive: 10000,
});

redisConnection.on("connect", () => {
  console.log("BullMQ Redis connection established.");
});

redisConnection.on("ready", () => {
  console.log("BullMQ Redis connection ready.");
});

redisConnection.on("error", (error) => {
  console.error("BullMQ Redis error:", error.message);
});

export const emailQueue = new Queue("email-scheduler", {
  connection: redisConnection,
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