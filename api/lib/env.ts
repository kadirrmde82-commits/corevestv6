import "dotenv/config";

function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production" && fallback === "") {
    console.error(`Missing environment variable: ${name}`);
  }
  return value ?? fallback;
}

function databaseUrl(): string {
  const value = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (!value && process.env.NODE_ENV === "production") {
    console.error("Missing environment variable: DATABASE_URL or MYSQL_URL");
  }
  return value ?? "";
}

export const env = {
  appSecret: optional("APP_SECRET", "corevest-local-auth-secret-key-2024"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: databaseUrl(),
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@corevest.com",
  adminPassword: optional("ADMIN_PASSWORD"),
};
