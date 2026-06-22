import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function databaseUrl(): string {
  const value = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("Missing required environment variable: DATABASE_URL or MYSQL_URL");
  }
  return value ?? "";
}

export const env = {
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: databaseUrl(),
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@corevest.com",
  adminPassword: required("ADMIN_PASSWORD"),
};
