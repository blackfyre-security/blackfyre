import { Redis } from "ioredis";
import type { Config } from "../config.js";

let connection: Redis | null = null;

export function getRedisConnection(config: Config): Redis {
  if (!connection) {
    connection = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
