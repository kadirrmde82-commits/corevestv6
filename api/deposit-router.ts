import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { deposits, profiles, users, vipBonuses } from "@db/schema";
import { awardReferralWheelBonus } from "./wheel-router";
import { capAmount, getVipInfo, getVipLevel } from "./vip-config";
import { logAdminActivity } from "./admin-system-router";
import { getQualifiedTier1ReferralCount } from "./referral-qualification";

let depositCompatibilityPromise: Promise<void> | null = null;

async function runDepositCompatibilityChecks() {
  const db = getDb();
  const tryExecute = async (query: ReturnType<typeof sql>) => {
    try {
      await db.execute(query);
    } catch {
      // Already exists or the database version does not support the exact ALTER form.
    }
  };

  await tryExecute(sql`ALTER TABLE deposits ADD COLUMN \`cryptoType\` varchar(32) NOT NULL DEFAULT 'trc20'`);
  await tryExecute(sql`ALTER TABLE deposits MODIFY COLUMN \`cryptoType\` varchar(32) NOT NULL DEFAULT 'trc20'`);
  await tryExecute(sql`ALTER TABLE deposits ADD COLUMN \`userNote\` varchar(255)`);
  await tryExecute(sql`ALTER TABLE users ADD COLUMN \`publicId\` int`);
}

async function ensureDepositCompatibility() {
  if (!depositCompatibilityPromise) {
    depositCompatibilityPromise = runDepositCompatibilityChecks().catch((error) => {
      depositCompatibilityPromise = null;
      throw error;
    });
  }
  return depositCompatibilityPromise;
}

export const depositRouter = createRouter({
  // Create a new deposit request
  create: authedQuery
    .input(
      z.object({
        amount: z.number().min(50, "Minimum yatırım tutarı 50$ olmalıdır."),
        email: z.string().email().min(1),
        cryptoType: z.string().min(1).max(32),
        targetPublicId: z.number().int().positive().optional(),
        userNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureDepositCompatibility();
      const db = getDb();
      let targetUserId = ctx.user.id;

      if (input.targetPublicId && input.targetPublicId !== ctx.user.publicId) {
        const targetUser = await db.query.users.findFirst({
          where: eq(users.publicId, input.targetPublicId),
          columns: { id: true },
        });
        if (!targetUser) throw new Error("Bu üye ID bulunamadı. Lütfen ID'yi kontrol edin.");
        targetUserId = targetUser.id;
      }

      const txid = "TX-" + Math.floor(Math.random() * 900000 + 100000);
      const result = await db.insert(deposits).values({
        userId: targetUserId,
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
    await ensureDepositCompatibility();
    const db = getDb();
    return db.query.deposits.findMany({
      where: eq(deposits.userId, ctx.user.id),
      orderBy: [desc(deposits.createdAt)],
    });
  }),

  // ─── Admin Only ───

  // List all deposits (admin) - with user info
  listAll: adminQuery.query(async () => {
    await ensureDepositCompatibility();
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
    .mutation(async ({ ctx, input }) => {
      await ensureDepositCompatibility();
      const db = getDb();
      const deposit = await db.query.deposits.findFirst({
        where: eq(deposits.id, input.id),
      });
      if (!deposit) throw new Error("Deposit not found");
      if (deposit.status === "approved") return { success: true };

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
        const activeRefs = await getQualifiedTier1ReferralCount(deposit.userId);
        const previousVipLevel = getVipLevel(currentInvestment, activeRefs);
        const newVipLevel = getVipLevel(newInvestment, activeRefs);
        let balanceAfterBonuses = Number(userProfile.balance) + depositAmount;

        for (let level = previousVipLevel + 1; level <= newVipLevel; level++) {
          const vipInfo = getVipInfo(level);
          if (vipInfo.bonus <= 0) continue;

          const alreadyAwarded = await db.query.vipBonuses.findFirst({
            where: and(eq(vipBonuses.userId, deposit.userId), eq(vipBonuses.vipLevel, level)),
          });
          if (alreadyAwarded) continue;

          const actualBonus = capAmount(balanceAfterBonuses, vipInfo.bonus, newVipLevel);
          if (actualBonus <= 0) continue;

          balanceAfterBonuses += actualBonus;
          await db.insert(vipBonuses).values({
            userId: deposit.userId,
            vipLevel: level,
            amount: String(actualBonus),
          });
        }

        await db
          .update(profiles)
          .set({
            investment: String(newInvestment),
            vipLevel: newVipLevel,
            balance: String(balanceAfterBonuses),
            totalEarned: String(Number(userProfile.totalEarned) + (balanceAfterBonuses - Number(userProfile.balance) - depositAmount)),
          })
          .where(eq(profiles.userId, deposit.userId));

        // Award wheel bonus spins to tier-1 referrer if $100+ deposit
        await awardReferralWheelBonus(db, deposit.userId, depositAmount);
      }

      await logAdminActivity({ adminUserId: ctx.user.id, action: "deposit.approve", targetType: "deposit", targetId: input.id, details: { userId: deposit.userId, amount: deposit.amount }, req: ctx.req });

      return { success: true };
    }),

  // Reject a deposit (admin)
  reject: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ensureDepositCompatibility();
      const db = getDb();
      await db
        .update(deposits)
        .set({ status: "rejected" })
        .where(eq(deposits.id, input.id));
      await logAdminActivity({ adminUserId: ctx.user.id, action: "deposit.reject", targetType: "deposit", targetId: input.id, req: ctx.req });
      return { success: true };
    }),
});
