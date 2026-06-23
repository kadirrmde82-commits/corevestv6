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
import { siteContent, users } from "@db/schema";
import { eq } from "drizzle-orm";

const app = new Hono<{ Bindings: HttpBindings }>();

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

  const bytes = Buffer.from(await image.arrayBuffer());
  const dataUrl = `data:${image.type};base64,${bytes.toString("base64")}`;
  const key = "announcement.imageUrl";
  const existing = await db.query.siteContent.findFirst({
    where: eq(siteContent.key, key),
  });

  if (existing) {
    await db.update(siteContent).set({ value: dataUrl }).where(eq(siteContent.key, key));
  } else {
    await db.insert(siteContent).values({ key, value: dataUrl });
  }

  return c.json({ success: true, imageUrl: dataUrl });
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  await ensureAdminAccount();
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
