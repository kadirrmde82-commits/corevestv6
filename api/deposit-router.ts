import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { deposits, profiles, users } from "@db/schema";
import { awardReferralWheelBonus } from "./wheel-router";

export const depositRouter = createRouter({
  // Create a new deposit request
  create: authedQuery
    .input(
      z.object({
        amount: z.number().positive(),
        email: z.string().email().min(1),
        cryptoType: z.enum(["trc20", "sol", "trx", "eth"]),
        userNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const txid = "TX-" + Math.floor(Math.random() * 900000 + 100000);
      const result = await db.insert(deposits).values({
        userId: ctx.user.id,
        amount: String(input.amount),
        txid,
        email: input.email,
        cryptoType: input.cryptoType,
        userNote: input.userNote || null,
      });
      return { id: Number(result[0].insertId), txid };
    }),

  // List current user's deposits
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db.query.deposits.findMany({
      where: eq(deposits.userId, ctx.user.id),
      orderBy: [desc(deposits.createdAt)],
    });
  }),

  // ─── Admin Only ───

  // List all deposits (admin) - with user info
  listAll: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: deposits.id,
        userId: deposits.userId,
        userPublicId: users.publicId,
        amount: deposits.amount,
        txid: deposits.txid,
        email: deposits.email,
        cryptoType: deposits.cryptoType,
        userNote: deposits.userNote,
        status: deposits.status,
        createdAt: deposits.createdAt,
        userEmail: users.email,
        userName: users.name,
      })
      .from(deposits)
      .leftJoin(users, eq(deposits.userId, users.id))
      .orderBy(desc(deposits.createdAt));
    return rows;
  }),

  // Approve a deposit (admin)
  approve: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const deposit = await db.query.deposits.findFirst({
        where: eq(deposits.id, input.id),
      });
      if (!deposit) throw new Error("Deposit not found");

      // Update deposit status
      await db
        .update(deposits)
        .set({ status: "approved" })
        .where(eq(deposits.id, input.id));

      // Add to user's investment
      const userProfile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, deposit.userId),
      });
      if (userProfile) {
        const currentInvestment = Number(userProfile.investment);
        const depositAmount = Number(deposit.amount);
        const newInvestment = currentInvestment + depositAmount;
        await db
          .update(profiles)
          .set({ investment: String(newInvestment) })
          .where(eq(profiles.userId, deposit.userId));

        // Award wheel bonus spins to tier-1 referrer if $100+ deposit
        await awardReferralWheelBonus(db, deposit.userId, depositAmount);
      }

      return { success: true };
    }),

  // Reject a deposit (admin)
  reject: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(deposits)
        .set({ status: "rejected" })
        .where(eq(deposits.id, input.id));
      return { success: true };
    }),
});
