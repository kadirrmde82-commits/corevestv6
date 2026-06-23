import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { marketPrices } from "../db/schema";
import { enrichMarketPrices } from "./market-live";

export const marketPriceRouter = createRouter({
  // Public: list all active market prices
  list: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(marketPrices)
      .where(eq(marketPrices.active, 1));
    return enrichMarketPrices(rows);
  }),

  // Admin: list all prices (including inactive)
  listAll: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(marketPrices);
    return rows;
  }),

  // Admin: create new coin
  create: adminQuery
    .input(
      z.object({
        symbol: z.string().min(1).max(16),
        name: z.string().min(1).max(64),
        basePrice: z.string().or(z.number()),
        change: z.string().or(z.number()),
        color: z.string().min(1).max(16),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db
        .select()
        .from(marketPrices)
        .where(eq(marketPrices.symbol, input.symbol));
      if (existing.length > 0) {
        throw new Error("Bu sembol zaten mevcut");
      }
      await db.insert(marketPrices).values({
        symbol: input.symbol.toUpperCase(),
        name: input.name,
        basePrice: String(input.basePrice),
        change: String(input.change),
        color: input.color,
        active: 1,
      });
      return { success: true };
    }),

  // Admin: update coin
  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        symbol: z.string().min(1).max(16).optional(),
        name: z.string().min(1).max(64).optional(),
        basePrice: z.string().or(z.number()).optional(),
        change: z.string().or(z.number()).optional(),
        color: z.string().min(1).max(16).optional(),
        active: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      if (data.symbol !== undefined) updateData.symbol = data.symbol.toUpperCase();
      if (data.name !== undefined) updateData.name = data.name;
      if (data.basePrice !== undefined) updateData.basePrice = String(data.basePrice);
      if (data.change !== undefined) updateData.change = String(data.change);
      if (data.color !== undefined) updateData.color = data.color;
      if (data.active !== undefined) updateData.active = data.active;

      await db
        .update(marketPrices)
        .set(updateData)
        .where(eq(marketPrices.id, id));
      return { success: true };
    }),

  // Admin: delete coin
  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(marketPrices).where(eq(marketPrices.id, input.id));
      return { success: true };
    }),
});
