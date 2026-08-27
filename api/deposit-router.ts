import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { deposits, profiles, users, vipBonuses, referrals, referralEarnings, promotionBonuses, type Deposit } from "@db/schema";
import { awardReferralWheelBonus } from "./wheel-router";
import { capAmount, getVipInfo, getVipLevel } from "./vip-config";
import { logAdminActivity } from "./admin-system-router";
import { getQualifiedTier1ReferralCount } from "./referral-qualification";
import { notifyNewDeposit, queueDiscordNotification } from "./discord";
import {
  MEMBER_PROMOTION_BONUS,
  REFERRER_PROMOTION_BONUS,
  qualifiesForDepositPromotion,
} from "./deposit-promotion";

async function applyDepositPromotion(db: ReturnType<typeof getDb>, deposit: Deposit) {
  if (!qualifiesForDepositPromotion({
    amount: Number(deposit.amount),
    promotionEligible: deposit.promotionEligible,
    promotionApplied: deposit.promotionApplied,
  })) {
    return;
  }

  await db.transaction(async (tx) => {
    const lockedRows = await tx
      .select()
      .from(deposits)
      .where(eq(deposits.id, deposit.id))
      .for("update");
    const currentDeposit = lockedRows[0];
    if (!currentDeposit || !qualifiesForDepositPromotion({
      amount: Number(currentDeposit.amount),
      promotionEligible: currentDeposit.promotionEligible,
      promotionApplied: currentDeposit.promotionApplied,
    })) return;

    const memberProfile = await tx.query.profiles.findFirst({
      where: eq(profiles.userId, currentDeposit.userId),
      columns: { userId: true },
    });
    if (!memberProfile) throw new Error("Promotion member profile not found");

    await tx
      .update(profiles)
      .set({
        balance: sql`${profiles.balance} + ${MEMBER_PROMOTION_BONUS}`,
        totalEarned: sql`${profiles.totalEarned} + ${MEMBER_PROMOTION_BONUS}`,
      })
      .where(eq(profiles.userId, currentDeposit.userId));
    await tx.insert(promotionBonuses).values({
      depositId: currentDeposit.id,
      beneficiaryUserId: currentDeposit.userId,
      sourceUserId: currentDeposit.userId,
      type: "member",
      amount: String(MEMBER_PROMOTION_BONUS),
    });

    const directReferral = await tx.query.referrals.findFirst({
      where: and(eq(referrals.referredUserId, currentDeposit.userId), eq(referrals.tier, 1)),
      columns: { referrerUserId: true },
    });
    let referrerUserId = directReferral?.referrerUserId;

    // Compatibility fallback for older members whose profile has a referral
    // code but who do not yet have a row in the referrals table.
    if (!referrerUserId) {
      const referredProfile = await tx.query.profiles.findFirst({
        where: eq(profiles.userId, currentDeposit.userId),
        columns: { referredBy: true },
      });
      if (referredProfile?.referredBy) {
        const referrerProfileByCode = await tx.query.profiles.findFirst({
          where: eq(profiles.referralCode, referredProfile.referredBy),
          columns: { userId: true },
        });
        referrerUserId = referrerProfileByCode?.userId;
      }
    }

    if (referrerUserId) {
      const referrerProfile = await tx.query.profiles.findFirst({
        where: eq(profiles.userId, referrerUserId),
        columns: { userId: true },
      });
      if (!referrerProfile) referrerUserId = undefined;
    }

    if (referrerUserId) {
      await tx
        .update(profiles)
        .set({
          balance: sql`${profiles.balance} + ${REFERRER_PROMOTION_BONUS}`,
          totalEarned: sql`${profiles.totalEarned} + ${REFERRER_PROMOTION_BONUS}`,
        })
        .where(eq(profiles.userId, referrerUserId));
      const referralEarningResult = await tx.insert(referralEarnings).values({
        referrerUserId,
        referredUserId: currentDeposit.userId,
        tier: 1,
        clickEarning: String(currentDeposit.amount),
        commissionRate: "0",
        commissionAmount: String(REFERRER_PROMOTION_BONUS),
      });
      await tx.insert(promotionBonuses).values({
        depositId: currentDeposit.id,
        beneficiaryUserId: referrerUserId,
        sourceUserId: currentDeposit.userId,
        referralEarningId: Number(referralEarningResult[0].insertId),
        type: "referrer",
        amount: String(REFERRER_PROMOTION_BONUS),
      });
    }

    await tx
      .update(deposits)
      .set({ promotionApplied: 1 })
      .where(eq(deposits.id, currentDeposit.id));
  });
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
      const startedAt = Date.now();
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
        promotionEligible: 1,
      });
      const depositId = Number(result[0].insertId);
      console.info(`[deposit] request created: id=${depositId} userId=${targetUserId}`);

      // Discord is an admin-only side channel. A webhook problem must never
      // block or roll back the customer's successfully created deposit request.
      await queueDiscordNotification("deposit", () => notifyNewDeposit({
        depositId,
        publicUserId: input.targetPublicId ?? ctx.user.publicId,
        amount: input.amount,
        cryptoType: input.cryptoType,
        email: input.email,
      }));

      console.info(`[deposit] request completed: id=${depositId} durationMs=${Date.now() - startedAt}`);
      return { id: depositId, txid };
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
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const deposit = await db.query.deposits.findFirst({
        where: eq(deposits.id, input.id),
      });
      if (!deposit) throw new Error("Deposit not found");
      if (deposit.status === "approved") {
        await applyDepositPromotion(db, deposit);
        return { success: true };
      }

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

        await applyDepositPromotion(db, deposit);

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
      const db = getDb();
      await db
        .update(deposits)
        .set({ status: "rejected" })
        .where(eq(deposits.id, input.id));
      await logAdminActivity({ adminUserId: ctx.user.id, action: "deposit.reject", targetType: "deposit", targetId: input.id, req: ctx.req });
      return { success: true };
    }),
});
