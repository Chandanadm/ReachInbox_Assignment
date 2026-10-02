import IORedis from "ioredis";
import prisma from "../config/database.js";

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  team?: {
    id?: string;
    name?: string;
  };
  incoming_webhook?: {
    channel_id?: string;
    channel?: string;
    url?: string;
  };
  error?: string;
}

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not configured.");
}

const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

const getSlackConfig = () => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Slack OAuth configuration is incomplete.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
};

export const createSlackAuthorizationUrl = (
  userId: string,
): string => {
  const { clientId, redirectUri } =
    getSlackConfig();

  const state = Buffer.from(
    JSON.stringify({
      userId,
      createdAt: Date.now(),
    }),
  ).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "incoming-webhook",
    redirect_uri: redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
};

export const handleSlackOAuthCallback = async (
  code: string,
  state: string,
): Promise<void> => {
  const {
    clientId,
    clientSecret,
    redirectUri,
  } = getSlackConfig();

  let stateData: {
    userId: string;
    createdAt: number;
  };

  try {
    stateData = JSON.parse(
      Buffer.from(state, "base64url").toString(
        "utf8",
      ),
    );
  } catch {
    throw new Error("Invalid Slack OAuth state.");
  }

  if (
    !stateData.userId ||
    !stateData.createdAt
  ) {
    throw new Error(
      "Invalid Slack OAuth state data.",
    );
  }

  if (
    Date.now() - stateData.createdAt >
    10 * 60 * 1000
  ) {
    throw new Error(
      "Slack OAuth request expired.",
    );
  }

  const response = await fetch(
    "https://slack.com/api/oauth.v2.access",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    },
  );

  const result =
    (await response.json()) as SlackOAuthResponse;

  // Diagnostic log — does NOT expose access token or webhook URL
  console.log(
    "Slack OAuth response:",
    JSON.stringify(
      {
        ok: result.ok,
        error: result.error,
        team: result.team,
        incoming_webhook: result.incoming_webhook
          ? {
              channel:
                result.incoming_webhook.channel,
              channel_id:
                result.incoming_webhook.channel_id,
              url_received: Boolean(
                result.incoming_webhook.url,
              ),
            }
          : null,
      },
      null,
      2,
    ),
  );

  if (
    !result.ok ||
    !result.access_token
  ) {
    throw new Error(
      `Slack OAuth failed: ${
        result.error ?? "Unknown error"
      }`,
    );
  }

  const webhookUrl =
    result.incoming_webhook?.url;

  if (!webhookUrl) {
    throw new Error(
      "Slack did not provide an incoming webhook URL.",
    );
  }

  await prisma.slackConnection.upsert({
    where: {
      userId: stateData.userId,
    },
    update: {
      accessToken: result.access_token,
      webhookUrl,
      teamId: result.team?.id ?? null,
      teamName: result.team?.name ?? null,
      channelId:
        result.incoming_webhook?.channel_id ??
        null,
      channelName:
        result.incoming_webhook?.channel ??
        null,
      connectedAt: new Date(),
    },
    create: {
      userId: stateData.userId,
      accessToken: result.access_token,
      webhookUrl,
      teamId: result.team?.id ?? null,
      teamName: result.team?.name ?? null,
      channelId:
        result.incoming_webhook?.channel_id ??
        null,
      channelName:
        result.incoming_webhook?.channel ??
        null,
    },
  });

  console.log(
    "Slack connection saved successfully.",
  );
};

export const sendSlackMessage = async (
  userId: string,
  message: string,
): Promise<boolean> => {
  const connection =
    await prisma.slackConnection.findUnique({
      where: { userId },
    });

  if (!connection?.webhookUrl) {
    console.log(
      "Slack is not connected. Notification skipped.",
    );

    return false;
  }

  const response = await fetch(
    connection.webhookUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: message,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Slack webhook failed with HTTP ${response.status}.`,
    );
  }

  return true;
};

export const notifyHourlyLimitReached =
  async (
    userId: string,
    hourlyWindowStart: number,
    hourlyLimit: number,
  ): Promise<boolean> => {
    const key =
      `reachinbox:slack:limit:${userId}:${hourlyWindowStart}`;

    const acquired = await redis.set(
      key,
      "sent",
      "EX",
      7200,
      "NX",
    );

    if (acquired !== "OK") {
      return false;
    }

    const nextWindow =
      new Date(
        hourlyWindowStart +
          60 * 60 * 1000,
      );

    const message =
      `🚨 ReachInbox hourly email limit reached.\n\n` +
      `Hourly limit: ${hourlyLimit}\n` +
      `Emails will continue automatically in the next available window.\n` +
      `Next window: ${nextWindow.toLocaleString("en-IN")}`;

    try {
      return await sendSlackMessage(
        userId,
        message,
      );
    } catch (error) {
      await redis.del(key);
      throw error;
    }
  };