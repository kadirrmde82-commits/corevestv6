import { eq, count, and, desc } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { deposits, profiles, wheelSpins, referrals, wheelReferralBonuses, vipBonuses } from "@db/schema";
import { capAmount, getVipLevel } from "./vip-config";

// Wheel prizes displayed on the wheel (user sees these)
export const WHEEL_PRIZES = [
  { label: "$10", value: 10, color: "#10b981" },
  { label: "$25", value: 25, color: "#FFD700" },
  { label: "$50", value: 50, color: "#f97316" },
  { label: "$100", value: 100, color: "#ef4444" },
  { label: "$250", value: 250, color: "#8b5cf6" },
  { label: "$500", value: 500, color: "#3b82f6" },
  { label: "$750", value: 750, color: "#ec4899" },
  { label: "$1,000", value: 1000, color: "#FFD700" },
];

// ALWAYS gives $10 regardless of what the wheel shows
const ACTUAL_PRIZE = 10;

async function getOwnFirstDepositSpin(db: ReturnType<typeof getDb>, userId: number) {
  const approvedDeposits = await db.query.deposits.findMany({
    where: and(eq(deposits.userId, userId), eq(deposits.status, "approved")),
    orderBy: [desc(deposits.createdAt)],
  });

  return approvedDeposits.some((deposit) => Number(deposit.amount) >= 100) ? 1 : 0;
}

function calculateReferralBonusSpins(
  bonuses: Array<{ referredUserId: number; spinsEarned: number }>
) {
  let manualSpins = 0;
  const referredUsersWithBonus = new Set<number>();

  for (const bonus of bonuses) {
    if (bonus.referredUserId === 0) {
      manualSpins += bonus.spinsEarned;
    } else if (bonus.spinsEarned > 0) {
      referredUsersWithBonus.add(bonus.referredUserId);
    }
  }

  return manualSpins + referredUsersWithBonus.size;
}

export const wheelRouter = createRouter({
  // List user's wheel spin history
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const spins = await db.query.wheelSpins.findMany({
      where: eq(wheelSpins.userId, ctx.user.id),
      orderBy: [desc(wheelSpins.createdAt)],
    });
    const bonuses = await db.query.vipBonuses.findMany({
      where: eq(vipBonuses.userId, ctx.user.id),
      orderBy: [desc(vipBonuses.createdAt)],
    });

    return [
      ...spins.map((spin) => ({
        id: `wheel-${spin.id}`,
        type: "wheel" as const,
        prize: spin.prize,
        amount: spin.prize,
        createdAt: spin.createdAt,
      })),
      ...bonuses.map((bonus) => ({
        id: `vip-${bonus.id}`,
        type: "vip" as const,
        vipLevel: bonus.vipLevel,
        prize: bonus.amount,
        amount: bonus.amount,
        createdAt: bonus.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }),

  // Get wheel status: available spins from own investment + referral bonuses
  status: authedQuery.query(async ({ ctx }) => {
    const db = getDb();

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, ctx.user.id),
    });
    if (!profile) {
      return {
        availableSpins: 0,
        totalSpins: 0,
        investment: 0,
        referralBonusSpins: 0,
        prizes: WHEEL_PRIZES,
      };
    }

    const investment = Number(profile.investment);

    // Own investment spin: only one spin for the first approved $100+ deposit.
    const ownSpins = await getOwnFirstDepositSpin(db, ctx.user.id);

    // Referral bonus spins: when tier-1 referrals deposit $100+
    const referralBonuses = await db
      .select()
      .from(wheelReferralBonuses)
      .where(eq(wheelReferralBonuses.userId, ctx.user.id));
    const referralBonusSpins = calculateReferralBonusSpins(referralBonuses);

    const totalEarnedSpins = ownSpins + referralBonusSpins;

    // Count used spins
    const spinsUsedResult = await db
      .select({ count: count() })
      .from(wheelSpins)
      .where(eq(wheelSpins.userId, ctx.user.id));
    const totalSpinsUsed = spinsUsedResult[0]?.count ?? 0;

    const availableSpins = Math.max(0, totalEarnedSpins - totalSpinsUsed);

    return {
      availableSpins,
      totalSpins: totalSpinsUsed,
      investment,
      totalEarnedSpins,
      referralBonusSpins,
      ownSpins,
      prizes: WHEEL_PRIZES,
    };
  }),

  // Spin the wheel - ALWAYS awards $10
  spin: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();

    // 1. Get profile
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, ctx.user.id),
    });
    if (!profile) throw new Error("Profile not found");

    // 2. Calculate available spins
    const ownSpins = await getOwnFirstDepositSpin(db, ctx.user.id);

    // Referral bonus spins
    const referralBonuses = await db
      .select()
      .from(wheelReferralBonuses)
      .where(eq(wheelReferralBonuses.userId, ctx.user.id));
    const referralBonusSpins = calculateReferralBonusSpins(referralBonuses);

    const totalEarnedSpins = ownSpins + referralBonusSpins;

    const spinsUsedResult = await db
      .select({ count: count() })
      .from(wheelSpins)
      .where(eq(wheelSpins.userId, ctx.user.id));
    const totalSpinsUsed = spinsUsedResult[0]?.count ?? 0;
    const availableSpins = totalEarnedSpins - totalSpinsUsed;

    if (availableSpins <= 0) {
      throw new Error(
        "Cark cevirme hakkınız kalmadı. Daha fazla yatırım yapin veya referanslarınızın yatırım yapmasıni saglayin."
      );
    }

    // 3. Visual prize is ALWAYS $10 (wheel always lands on $10)
    const visualPrize = WHEEL_PRIZES[0]; // $10 segment

    const activeRefsResult = await db
      .select({ count: count() })
      .from(referrals)
      .where(and(eq(referrals.referrerUserId, ctx.user.id), eq(referrals.tier, 1)));
    const vipLevel = getVipLevel(Number(profile.investment), activeRefsResult[0]?.count ?? 0);

    // 4. ALWAYS award $10, capped by the member's VIP balance limit
    const actualPrize = capAmount(Number(profile.balance), ACTUAL_PRIZE, vipLevel);
    if (actualPrize <= 0) {
      throw new Error("VIP bakiye limitine ulaştınız.");
    }
    const newBalance = Number(profile.balance) + actualPrize;

    // 5. Record the spin
    await db.insert(wheelSpins).values({
      userId: ctx.user.id,
      prize: String(actualPrize),
    });

    // 6. Add to balance
    await db
      .update(profiles)
      .set({ balance: String(newBalance) })
      .where(eq(profiles.userId, ctx.user.id));

    return {
      success: true,
      visualPrize: visualPrize.label,
      actualPrize,
      newBalance,
      remainingSpins: availableSpins - 1,
    };
  }),
});

// Helper: Award 1 referral bonus spin only once when a direct tier-1 referral makes a $100+ deposit.
// Called from deposit-router.ts when a deposit is approved
export async function awardReferralWheelBonus(
  db: ReturnType<typeof getDb>,
  referredUserId: number,
  depositAmount: number
) {
  // Find who referred this user (tier 1)
  const referral = await db.query.referrals.findFirst({
    where: and(
      eq(referrals.referredUserId, referredUserId),
      eq(referrals.tier, 1)
    ),
  });
  if (!referral) return; // No referrer

  const referrerId = referral.referrerUserId;

  if (depositAmount < 100) return;

  const existingBonus = await db.query.wheelReferralBonuses.findFirst({
    where: and(
      eq(wheelReferralBonuses.referredUserId, referredUserId),
      eq(wheelReferralBonuses.userId, referrerId)
    ),
  });
  if (existingBonus) return;

  // Award bonus spins to the referrer
  await db.insert(wheelReferralBonuses).values({
    userId: referrerId,
    referredUserId,
    investmentAmount: String(depositAmount),
    spinsEarned: 1,
  });
}
