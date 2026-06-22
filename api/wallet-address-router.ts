import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { walletAddresses } from "../db/schema";

export const walletAddressRouter = createRouter({
  // Public: list active wallet addresses
  list: publicQuery.query(async () => {
    const db = getDb();
    return db
      .select()
      .from(walletAddresses)
      .where(eq(walletAddresses.active, 1))
      .orderBy(asc(walletAddresses.sortOrder));
  }),

  // Admin: list all
  listAll: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select()
      .from(walletAddresses)
      .orderBy(asc(walletAddresses.sortOrder));
  }),

  // Admin: create
  create: adminQuery
    .input(
      z.object({
        key: z.string().min(1).max(16),
        label: z.string().min(1).max(64),
        address: z.string().min(1).max(128),
        color: z.string().min(1).max(16),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(walletAddresses).values({
        key: input.key.toLowerCase(),
        label: input.label,
        address: input.address,
        color: input.color,
        active: 1,
        sortOrder: input.sortOrder,
      });
      return { success: true };
    }),

  // Admin: update
  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        key: z.string().min(1).max(16).optional(),
        label: z.string().min(1).max(64).optional(),
        address: z.string().min(1).max(128).optional(),
        color: z.string().min(1).max(16).optional(),
        active: z.number().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      if (data.key !== undefined) updateData.key = data.key.toLowerCase();
      if (data.label !== undefined) updateData.label = data.label;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.active !== undefined) updateData.active = data.active;
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

      await db
        .update(walletAddresses)
        .set(updateData)
        .where(eq(walletAddresses.id, id));
      return { success: true };
    }),

  // Admin: delete
  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(walletAddresses).where(eq(walletAddresses.id, input.id));
      return { success: true };
    }),
});
