import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { userPresence, users } from "@db/schema";

function ipFromRequest(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

export const presenceRouter = createRouter({
  heartbeat: authedQuery
    .input(z.object({ path: z.string().max(255).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const now = new Date();
      const existing = await db.query.userPresence.findFirst({
        where: eq(userPresence.userId, ctx.user.id),
      });
      const values = {
        lastSeenAt: now,
        path: input?.path || null,
        ipAddress: ipFromRequest(ctx.req),
        userAgent: ctx.req.headers.get("user-agent") || null,
      };

      if (existing) {
        await db
          .update(userPresence)
          .set(values)
          .where(eq(userPresence.userId, ctx.user.id));
      } else {
        await db.insert(userPresence).values({
          userId: ctx.user.id,
          ...values,
        });
      }

      return { success: true };
    }),

  adminList: adminQuery.query(async () => {
    const db = getDb();
    const onlineWindowMs = 2 * 60 * 1000;
    const now = Date.now();
    const rows = await db
      .select({
        userId: users.id,
        publicId: users.publicId,
        email: users.email,
        name: users.name,
        role: users.role,
        lastSeenAt: userPresence.lastSeenAt,
        path: userPresence.path,
        ipAddress: userPresence.ipAddress,
        userAgent: userPresence.userAgent,
      })
      .from(users)
      .leftJoin(userPresence, eq(users.id, userPresence.userId))
      .orderBy(desc(userPresence.lastSeenAt));

    return rows.map((row) => {
      const lastSeenAt = row.lastSeenAt ?? null;
      const secondsAgo = lastSeenAt ? Math.floor((now - lastSeenAt.getTime()) / 1000) : null;
      return {
        ...row,
        online: secondsAgo !== null && secondsAgo <= onlineWindowMs / 1000,
        secondsAgo,
      };
    }).sort((a, b) => Number(b.online) - Number(a.online));
  }),
});
