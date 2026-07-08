import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>> | undefined;
let pool: Pool;

export function getDb() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL or MYSQL_URL is not configured");
  }
  if (!instance) {
    pool = createPool({
      uri: env.databaseUrl,
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      maxIdle: Number(process.env.MYSQL_MAX_IDLE || 5),
      idleTimeout: 60_000,
      queueLimit: 0,
      connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT || 8_000),
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    instance = drizzle(pool as any, {
      mode: "planetscale",
      schema: fullSchema,
    });
  }
  return instance;
}

export function getDbPool() {
  getDb();
  return pool;
}
