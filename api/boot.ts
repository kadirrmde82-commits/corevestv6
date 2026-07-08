import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { ensureAdminAccount } from "./bootstrap";
import { verifyLocalToken } from "./local-auth";
import { getDb } from "./queries/connection";
import { siteAssets, siteContent, users } from "@db/schema";
import { eq, sql } from "drizzle-orm";

const app = new Hono<{ Bindings: HttpBindings }>();

async function ensureSiteAssetsTable() {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS site_assets (
      \`key\` varchar(64) NOT NULL,
      \`mimeType\` varchar(128) NOT NULL,
      \`data\` longtext NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`key\`)
    )
  `);
}

async function ensureVipBonusesTable() {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vip_bonuses (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`userId\` bigint unsigned NOT NULL,
      \`vipLevel\` int NOT NULL,
      \`amount\` decimal(12,2) NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    )
  `);
}

async function ensureWalletAddressesTable() {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wallet_addresses (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`key\` varchar(16) NOT NULL,
      \`label\` varchar(64) NOT NULL,
      \`address\` varchar(128) NOT NULL,
      \`color\` varchar(16) NOT NULL,
      \`active\` int NOT NULL DEFAULT 1,
      \`sortOrder\` int NOT NULL DEFAULT 0,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`wallet_addresses_key_unique\` (\`key\`)
    )
  `);
}

async function ensureSystemTables() {
  const db = getDb();
  const tryExecute = async (query: ReturnType<typeof sql>) => {
    try {
      await db.execute(query);
    } catch {
      // Column likely already exists on older MySQL versions that do not support IF NOT EXISTS cleanly.
    }
  };
  await ensureVipBonusesTable();
  await ensureWalletAddressesTable();
  await tryExecute(sql`ALTER TABLE deposits ADD COLUMN \`cryptoType\` enum('trc20','sol','trx','eth') NOT NULL DEFAULT 'trc20'`);
  await tryExecute(sql`ALTER TABLE deposits ADD COLUMN \`userNote\` varchar(255)`);
  await tryExecute(sql`ALTER TABLE users ADD COLUMN \`publicId\` int`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`adminUserId\` bigint unsigned NOT NULL,
      \`action\` varchar(128) NOT NULL,
      \`targetType\` varchar(64),
      \`targetId\` bigint unsigned,
      \`details\` text,
      \`ipAddress\` varchar(64),
      \`userAgent\` text,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_login_events (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`userId\` bigint unsigned NOT NULL,
      \`ipAddress\` varchar(64),
      \`country\` varchar(128),
      \`city\` varchar(128),
      \`userAgent\` text,
      \`success\` int NOT NULL DEFAULT 1,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    )
  `);
  await tryExecute(sql`ALTER TABLE user_login_events ADD COLUMN \`country\` varchar(128)`);
  await tryExecute(sql`ALTER TABLE user_login_events ADD COLUMN \`city\` varchar(128)`);
  await tryExecute(sql`ALTER TABLE profiles ADD COLUMN \`withdrawalAccess\` int NOT NULL DEFAULT 0`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_notifications (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`userId\` bigint unsigned NOT NULL,
      \`title\` varchar(160) NOT NULL,
      \`message\` text NOT NULL,
      \`type\` varchar(32) NOT NULL DEFAULT 'info',
      \`readAt\` timestamp NULL,
      \`createdBy\` bigint unsigned,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS click_earnings (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`userId\` bigint unsigned NOT NULL,
      \`vipLevel\` int NOT NULL,
      \`dailyRate\` decimal(5,2) NOT NULL,
      \`amount\` decimal(12,2) NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_presence (
      \`userId\` bigint unsigned NOT NULL,
      \`lastSeenAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`path\` varchar(255),
      \`ipAddress\` varchar(64),
      \`userAgent\` text,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`userId\`)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS system_settings (
      \`key\` varchar(64) NOT NULL,
      \`value\` text NOT NULL,
      \`updatedBy\` bigint unsigned,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`key\`)
    )
  `);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

app.post("/api/admin/announcement-image", async (c) => {
  try {
    const token = c.req.header("x-local-auth-token");
    if (!token) return c.json({ error: "Unauthorized" }, 401);

    const claim = await verifyLocalToken(token);
    if (!claim) return c.json({ error: "Unauthorized" }, 401);

    const db = getDb();
    const admin = await db.query.users.findFirst({
      where: eq(users.id, claim.userId),
    });
    if (!admin || admin.role !== "admin") return c.json({ error: "Forbidden" }, 403);

    const form = await c.req.formData();
    const image = form.get("image");
    if (!(image instanceof File)) {
      return c.json({ error: "Görsel bulunamadı" }, 400);
    }
    if (!image.type.startsWith("image/")) {
      return c.json({ error: "Sadece görsel dosyası yükleyebilirsiniz" }, 400);
    }
    if (image.size > 4 * 1024 * 1024) {
      return c.json({ error: "Görsel en fazla 4MB olabilir" }, 400);
    }

    await ensureSiteAssetsTable();

    const bytes = Buffer.from(await image.arrayBuffer());
    const assetKey = "announcement.image";
    const imageUrl = `/api/site-assets/${assetKey}?v=${Date.now()}`;
    const existingAsset = await db.query.siteAssets.findFirst({
      where: eq(siteAssets.key, assetKey),
    });

    if (existingAsset) {
      await db
        .update(siteAssets)
        .set({ mimeType: image.type, data: bytes.toString("base64") })
        .where(eq(siteAssets.key, assetKey));
    } else {
      await db.insert(siteAssets).values({
        key: assetKey,
        mimeType: image.type,
        data: bytes.toString("base64"),
      });
    }

    const contentKey = "announcement.imageUrl";
    const existingContent = await db.query.siteContent.findFirst({
      where: eq(siteContent.key, contentKey),
    });

    if (existingContent) {
      await db.update(siteContent).set({ value: imageUrl }).where(eq(siteContent.key, contentKey));
    } else {
      await db.insert(siteContent).values({ key: contentKey, value: imageUrl });
    }

    return c.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Announcement image upload failed", error);
    return c.json({ error: `Görsel yüklenemedi: ${errorMessage(error)}` }, 500);
  }
});

app.get("/api/site-assets/:key", async (c) => {
  const key = c.req.param("key");
  await ensureSiteAssetsTable();
  const db = getDb();
  const asset = await db.query.siteAssets.findFirst({
    where: eq(siteAssets.key, key),
  });
  if (!asset) return c.notFound();

  const bytes = Buffer.from(asset.data, "base64");
  return new Response(bytes, {
    headers: {
      "content-type": asset.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
});

app.get("/api/health", (c) => c.json({ ok: true, service: "corevest", ts: Date.now() }));

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  void (async () => {
    try {
      if (env.adminPassword) {
        await ensureAdminAccount();
      } else {
        console.error("ADMIN_PASSWORD is not configured; skipping admin bootstrap");
      }
      await ensureSystemTables();
      console.log("Startup database checks completed");
    } catch (error) {
      console.error("Startup database checks failed", error);
    }
  })();
}
