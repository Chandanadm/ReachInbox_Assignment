import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.",
  );
}

export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

export const testRedisConnection = async (): Promise<void> => {
  const result = await redis.ping();

  if (result !== "PONG") {
    throw new Error("Redis health check failed.");
  }

  console.log("Upstash Redis connection ready.");
};

export default redis;