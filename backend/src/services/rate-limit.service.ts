import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not configured.");
}

const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 10000,
  keepAlive: 10000,
});

redis.on("error", (error) => {
  console.error("Rate limiter Redis error:", error.message);
});

export interface RateLimitResult {
  allowedAt: number;
  hourlyWindowStart: number;
  hourlyLimitReached: boolean;
}

const RESERVE_SLOT_SCRIPT = `
local emailId = ARGV[1]
local now = tonumber(ARGV[2])
local hourlyLimit = tonumber(ARGV[3])
local minimumDelayMs = tonumber(ARGV[4])
local nextSendKey = KEYS[1]
local reservationPrefix = ARGV[5]

local existingReservationKey =
  nextSendKey .. ":reservation:" .. emailId

local existingReservation =
  redis.call("GET", existingReservationKey)

if existingReservation then
  local existingTime = tonumber(existingReservation)
  local existingWindow =
    math.floor(existingTime / 3600000) * 3600000

  return {
    existingTime,
    existingWindow,
    0
  }
end

local candidate = now

local previousNextSend =
  redis.call("GET", nextSendKey)

if previousNextSend then
  local previousTime =
    tonumber(previousNextSend)

  if previousTime > candidate then
    candidate = previousTime
  end
end

while true do
  local windowStart =
    math.floor(candidate / 3600000) * 3600000

  local windowEnd =
    windowStart + 3600000

  local windowKey =
    reservationPrefix .. ":" .. tostring(windowStart)

  local count =
    redis.call("ZCARD", windowKey)

  if count < hourlyLimit then
    local member =
      emailId .. ":" .. tostring(candidate)

    redis.call(
      "ZADD",
      windowKey,
      candidate,
      member
    )

    redis.call(
      "EXPIRE",
      windowKey,
      10800
    )

    local nextAvailable =
      candidate + minimumDelayMs

    redis.call(
      "SET",
      nextSendKey,
      nextAvailable
    )

    redis.call(
      "SET",
      existingReservationKey,
      candidate,
      "EX",
      10800
    )

    return {
      candidate,
      windowStart,
      0
    }
  end

  candidate = windowEnd
end
`;

export const reserveEmailSendSlot = async (
  userId: string,
  emailId: string,
  hourlyLimit: number,
  minimumDelaySeconds: number,
): Promise<RateLimitResult> => {
  const now = Date.now();

  const nextSendKey =
    `reachinbox:rate:${userId}:next-send`;

  const reservationPrefix =
    `reachinbox:rate:${userId}:hour`;

  const result = (await redis.eval(
    RESERVE_SLOT_SCRIPT,
    1,
    nextSendKey,
    emailId,
    now,
    hourlyLimit,
    minimumDelaySeconds * 1000,
    reservationPrefix,
  )) as [
    string | number,
    string | number,
    string | number,
  ];

  const allowedAt = Number(result[0]);
  const hourlyWindowStart = Number(result[1]);

  return {
    allowedAt,
    hourlyWindowStart,
    hourlyLimitReached: allowedAt > now,
  };
};