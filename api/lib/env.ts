import "dotenv/config";

function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production" && fallback === "") {
    console.error(`Missing environment variable: ${name}`);
  }
  return value ?? fallback;
}

function databaseUrl(): string {
  const value = process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (!value && process.env.NODE_ENV === "production") {
    console.error("Missing environment variable: MYSQL_PUBLIC_URL, MYSQL_URL or DATABASE_URL");
  }
  return value ?? "";
}

function databaseUrlSource(): string {
  if (process.env.MYSQL_PUBLIC_URL) return "MYSQL_PUBLIC_URL";
  if (process.env.MYSQL_URL) return "MYSQL_URL";
  if (process.env.DATABASE_URL) return "DATABASE_URL";
  return "missing";
}

function databaseHost(): string {
  const value = databaseUrl();
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return "invalid-url";
  }
}

export const env = {
  appSecret: optional("APP_SECRET", "corevest-local-auth-secret-key-2024"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: databaseUrl(),
  databaseUrlSource: databaseUrlSource(),
  databaseHost: databaseHost(),
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@corevest.com",
  adminPassword: optional("ADMIN_PASSWORD"),
};
