import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { userNotifications } from "@db/schema";

export const notificationRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db.query.userNotifications.findMany({
      where: eq(userNotifications.userId, ctx.user.id),
      orderBy: [desc(userNotifications.createdAt)],
      limit: 50,
    });
  }),

  unreadCount: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const list = await db.query.userNotifications.findMany({
      where: eq(userNotifications.userId, ctx.user.id),
      columns: { id: true, readAt: true },
    });
    return { count: list.filter((item) => !item.readAt).length };
  }),

  markRead: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(userNotifications)
        .set({ readAt: new Date() })
        .where(and(eq(userNotifications.id, input.id), eq(userNotifications.userId, ctx.user.id)));
      return { success: true };
    }),

  markAllRead: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(eq(userNotifications.userId, ctx.user.id));
    return { success: true };
  }),

  clearAll: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .delete(userNotifications)
      .where(eq(userNotifications.userId, ctx.user.id));
    return { success: true };
  }),
});
