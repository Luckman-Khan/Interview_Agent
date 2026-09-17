import Redis from "ioredis";

let redisClient: Redis | null = null;

function normalizeRedisUrl(redisUrl: string) {
  const normalized = redisUrl
    .trim()
    .replace(/^redis-cli\s+--tls\s+-u\s+/i, "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\(?=:\/\/|@)/g, "");

  if (normalized.includes("upstash.io") && normalized.startsWith("redis://")) {
    return normalized.replace(/^redis:\/\//, "rediss://");
  }

  return normalized;
}

export function getRedisClient() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured.");
  }

  if (redisClient?.status === "end") {
    redisClient = null;
  }

  if (!redisClient) {
    redisClient = new Redis(normalizeRedisUrl(redisUrl), {
      db: 0,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 250, 2000);
      },
    });

    redisClient.on("error", (error) => {
      console.error("Redis connection error:", error);
    });

    redisClient.on("end", () => {
      redisClient = null;
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

      redisClient = null;
      throw connectionError;
    }
  }

  return client;
}
