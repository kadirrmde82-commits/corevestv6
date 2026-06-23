import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { withdrawals, profiles } from "@db/schema";
import { logAdminActivity } from "./admin-system-router";

const WITHDRAWAL_FEE_PERCENT = 5; // %5 kesinti
const MIN_WITHDRAWAL_AMOUNT = 50; // Minimum çekim 50$
const MAX_WITHDRAWAL_AMOUNT = 20000; // Tek seferde max 20.000$

// Helpers for withdrawal restrictions
function canWithdraw(profile: {
  consecutiveClicks: number;
  lastWithdrawalAt: Date | null;
}): { allowed: boolean; reason?: string } {
  // Must have 5 consecutive clicks
  if (profile.consecutiveClicks < 5) {
    return {
      allowed: false,
      reason: `Çekim için 5 gün tıklama yapmalısınız. (${profile.consecutiveClicks}/5)`,
    };
  }

  // Must wait 72h after last withdrawal
  if (profile.lastWithdrawalAt) {
    const hoursSince =
      (Date.now() - profile.lastWithdrawalAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 72) {
      const hoursRemaining = Math.ceil(72 - hoursSince);
      return {
        allowed: false,
        reason: `Sonraki çekim için ${hoursRemaining} saat beklemelisiniz.`,
      };
    }
  }

  return { allowed: true };
}

// Check monthly cycle and fee eligibility
// Rule: First withdrawal each month is FREE only after 30 days of membership
// Before 30 days: ALL withdrawals have 5% fee
function getMonthlyWithdrawalInfo(profile: {
  monthlyWithdrawalCount: number;
  lastWithdrawalResetAt: Date | null;
  joinDate: Date;
}) {
  const now = new Date();
  let count = profile.monthlyWithdrawalCount;

  // Check if we need to reset (new month)
  if (profile.lastWithdrawalResetAt) {
    const resetDate = new Date(profile.lastWithdrawalResetAt);
    if (
      resetDate.getMonth() !== now.getMonth() ||
      resetDate.getFullYear() !== now.getFullYear()
    ) {
      count = 0; // New month, reset count
    }
  }

  // Check if 30 days of membership has passed
  const daysSinceJoin =
    (Date.now() - profile.joinDate.getTime()) / (1000 * 60 * 60 * 24);
  const is30DaysPassed = daysSinceJoin >= 30;

  // First withdrawal is free ONLY after 30 days
  // Before 30 days: always 5% fee
  const isFirstFree = is30DaysPassed && count === 0;
  const feePercent = isFirstFree ? 0 : WITHDRAWAL_FEE_PERCENT;

  return {
    count,
    isFirstFree,
    feePercent,
    is30DaysPassed,
    daysSinceJoin: Math.floor(daysSinceJoin),
    daysUntil30: Math.max(0, Math.ceil(30 - daysSinceJoin)),
  };
}

export const withdrawalRouter = createRouter({
  // Check if user can withdraw (returns restriction info + fee info)
  canWithdraw: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, ctx.user.id),
    });
    if (!profile) {
      return {
        allowed: false,
        reason: "Profil bulunamadi",
        consecutiveClicks: 0,
        lastWithdrawalAt: null as Date | null,
        monthlyCount: 0,
        isFirstFree: false,
        feePercent: 5,
        is30DaysPassed: false,
        daysSinceJoin: 0,
        daysUntil30: 30,
      };
    }

    // Check monthly cycle
    const monthlyInfo = getMonthlyWithdrawalInfo({
      monthlyWithdrawalCount: profile.monthlyWithdrawalCount,
      lastWithdrawalResetAt: profile.lastWithdrawalResetAt,
      joinDate: profile.joinDate,
    });

    // Check click + cooldown restrictions
    const result = canWithdraw({
      consecutiveClicks: profile.consecutiveClicks,
      lastWithdrawalAt: profile.lastWithdrawalAt,
    });

    return {
      ...result,
      consecutiveClicks: profile.consecutiveClicks,
      lastWithdrawalAt: profile.lastWithdrawalAt,
      monthlyCount: monthlyInfo.count,
      isFirstFree: monthlyInfo.isFirstFree,
      feePercent: monthlyInfo.feePercent,
      is30DaysPassed: monthlyInfo.is30DaysPassed,
      daysSinceJoin: monthlyInfo.daysSinceJoin,
      daysUntil30: monthlyInfo.daysUntil30,
    };
  }),

  // Calculate net amount after fee
  calculateNet: authedQuery
    .input(z.object({ amount: z.number().min(MIN_WITHDRAWAL_AMOUNT).max(MAX_WITHDRAWAL_AMOUNT) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      });
      if (!profile) {
        return {
          gross: input.amount,
          fee: 0,
          net: input.amount,
          feePercent: 5,
          isFirstFree: false,
          is30DaysPassed: false,
        };
      }

      const monthlyInfo = getMonthlyWithdrawalInfo({
        monthlyWithdrawalCount: profile.monthlyWithdrawalCount,
        lastWithdrawalResetAt: profile.lastWithdrawalResetAt,
        joinDate: profile.joinDate,
      });

      const fee = monthlyInfo.isFirstFree
        ? 0
        : (input.amount * WITHDRAWAL_FEE_PERCENT) / 100;
      const net = input.amount - fee;

      return {
        gross: input.amount,
        fee,
        net,
        feePercent: monthlyInfo.feePercent,
        isFirstFree: monthlyInfo.isFirstFree,
        is30DaysPassed: monthlyInfo.is30DaysPassed,
        daysUntil30: monthlyInfo.daysUntil30,
      };
    }),

  create: authedQuery
    .input(
      z.object({
        amount: z.number().positive(),
        email: z.string().email(),
        wallet: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      });
      if (!profile) throw new Error("Profile not found");

      // Check minimum withdrawal limit
      if (input.amount < MIN_WITHDRAWAL_AMOUNT) {
        throw new Error(`Minimum çekim tutarı $${MIN_WITHDRAWAL_AMOUNT} olmalıdır.`);
      }

      // Check max withdrawal limit
      if (input.amount > MAX_WITHDRAWAL_AMOUNT) {
        throw new Error(`Tek seferde en fazla $${MAX_WITHDRAWAL_AMOUNT.toLocaleString()} cekebilirsiniz.`);
      }

      // Check withdrawal restrictions (5 clicks + 72h cooldown)
      const check = canWithdraw({
        consecutiveClicks: profile.consecutiveClicks,
        lastWithdrawalAt: profile.lastWithdrawalAt,
      });
      if (!check.allowed) {
        throw new Error(check.reason);
      }

      // Calculate fee
      const monthlyInfo = getMonthlyWithdrawalInfo({
        monthlyWithdrawalCount: profile.monthlyWithdrawalCount,
        lastWithdrawalResetAt: profile.lastWithdrawalResetAt,
        joinDate: profile.joinDate,
      });

      const totalDeduction = monthlyInfo.isFirstFree
        ? input.amount
        : input.amount + (input.amount * WITHDRAWAL_FEE_PERCENT) / 100;

      // Check balance (enough for amount + fee)
      if (Number(profile.balance) < totalDeduction) {
        if (monthlyInfo.isFirstFree) {
          throw new Error("Yetersiz bakiye");
        } else {
          throw new Error(
            `Yetersiz bakiye. Cekim ${input.amount}$ + %${WITHDRAWAL_FEE_PERCENT} kesinti = ${totalDeduction}$ gereklidir.`
          );
        }
      }

      // Deduct balance (amount + fee if applicable)
      await db
        .update(profiles)
        .set({
          balance: String(Number(profile.balance) - totalDeduction),
          consecutiveClicks: 0, // Reset clicks after withdrawal
        })
        .where(eq(profiles.userId, ctx.user.id));

      // Create withdrawal record (store gross amount)
      const result = await db.insert(withdrawals).values({
        userId: ctx.user.id,
        amount: String(input.amount),
        email: input.email,
        wallet: input.wallet,
      });

      return {
        id: Number(result[0].insertId),
        fee: monthlyInfo.isFirstFree
          ? 0
          : (input.amount * WITHDRAWAL_FEE_PERCENT) / 100,
        isFirstFree: monthlyInfo.isFirstFree,
      };
    }),

  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db.query.withdrawals.findMany({
      where: eq(withdrawals.userId, ctx.user.id),
      orderBy: [desc(withdrawals.createdAt)],
    });
  }),

  cancel: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const withdrawal = await db.query.withdrawals.findFirst({
        where: eq(withdrawals.id, input.id),
      });
      if (!withdrawal || withdrawal.status !== "pending") {
        throw new Error("Withdrawal not found or not pending");
      }
      if (withdrawal.userId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      });
      if (profile) {
        await db
          .update(profiles)
          .set({
            balance: String(
              Number(profile.balance) + Number(withdrawal.amount)
            ),
          })
          .where(eq(profiles.userId, ctx.user.id));
      }

      await db
        .update(withdrawals)
        .set({ status: "cancelled" })
        .where(eq(withdrawals.id, input.id));

      return { success: true };
    }),

  // ─── Admin ───
  listAll: adminQuery.query(async () => {
    const db = getDb();
    return db.query.withdrawals.findMany({
      orderBy: [desc(withdrawals.createdAt)],
    });
  }),

  approve: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const withdrawal = await db.query.withdrawals.findFirst({
        where: eq(withdrawals.id, input.id),
      });
      if (!withdrawal) throw new Error("Withdrawal not found");

      // Mark withdrawal as approved
      await db
        .update(withdrawals)
        .set({ status: "approved" })
        .where(eq(withdrawals.id, input.id));

      // Update user's lastWithdrawalAt and monthly count
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, withdrawal.userId),
      });
      if (profile) {
        const now = new Date();
        let newCount = profile.monthlyWithdrawalCount;
        let newResetAt = profile.lastWithdrawalResetAt;

        // Check if new month
        if (profile.lastWithdrawalResetAt) {
          const resetDate = new Date(profile.lastWithdrawalResetAt);
          if (
            resetDate.getMonth() !== now.getMonth() ||
            resetDate.getFullYear() !== now.getFullYear()
          ) {
            newCount = 0;
            newResetAt = now;
          }
        } else {
          newResetAt = now;
        }
        newCount += 1;

        await db
          .update(profiles)
          .set({
            lastWithdrawalAt: now,
            monthlyWithdrawalCount: newCount,
            lastWithdrawalResetAt: newResetAt,
          })
          .where(eq(profiles.userId, withdrawal.userId));
      }

      await logAdminActivity({ adminUserId: ctx.user.id, action: "withdrawal.approve", targetType: "withdrawal", targetId: input.id, details: { userId: withdrawal.userId, amount: withdrawal.amount }, req: ctx.req });

      return { success: true };
    }),

  reject: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const withdrawal = await db.query.withdrawals.findFirst({
        where: eq(withdrawals.id, input.id),
      });
      if (!withdrawal) throw new Error("Withdrawal not found");

      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, withdrawal.userId),
      });
      if (profile) {
        await db
          .update(profiles)
          .set({
            balance: String(
              Number(profile.balance) + Number(withdrawal.amount)
            ),
          })
          .where(eq(profiles.userId, withdrawal.userId));
      }

      await db
        .update(withdrawals)
        .set({ status: "rejected" })
        .where(eq(withdrawals.id, input.id));
      await logAdminActivity({ adminUserId: ctx.user.id, action: "withdrawal.reject", targetType: "withdrawal", targetId: input.id, details: { userId: withdrawal.userId, amount: withdrawal.amount }, req: ctx.req });
      return { success: true };
    }),
});
