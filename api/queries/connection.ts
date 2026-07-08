import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool, type PoolOptions } from "mysql2";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>> | undefined;
let pool: Pool;

function createPoolOptions(connectionString: string): PoolOptions {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || undefined,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 5),
    maxIdle: Number(process.env.MYSQL_MAX_IDLE || 2),
    idleTimeout: 60_000,
    queueLimit: 0,
    connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT || 8_000),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    supportBigNumbers: true,
    ssl: process.env.MYSQL_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

export function getDb() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL or MYSQL_URL is not configured");
  }
  if (!instance) {
    pool = createPool(createPoolOptions(env.databaseUrl));

    instance = drizzle(pool, {
      mode: "default",
      schema: fullSchema,
    });
  }
  return instance;
}

export function getDbPool() {
  getDb();
  return pool;
}
