import Redis from "ioredis";

let redisClient: Redis | null = null;
let redisInitializationError: Error | null = null;

function normalizeRedisUrl(redisUrl: string) {
  return redisUrl.trim().replace(/^['"]|['"]$/g, "");
}

export function getRedisClient() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured.");
  }

  if (redisInitializationError) {
    throw redisInitializationError;
  }

  if (!redisClient) {
    redisClient = new Redis(normalizeRedisUrl(redisUrl), {
      db: 0,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    redisClient.on("error", (error) => {
      redisInitializationError = error;
      console.error("Redis connection error:", error);
    });
  }

  return redisClient;
}

export async function ensureRedisConnection() {
  const client = getRedisClient();

  if (client.status === "wait") {
    try {
      await client.connect();
    } catch (error) {
      const connectionError =
        error instanceof Error
          ? error
          : new Error("Failed to connect to Redis.");

      redisInitializationError = connectionError;
      throw connectionError;
    }
  }

  return client;
}
