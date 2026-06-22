import { z } from "zod";
import { eq, count } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { profiles, referrals, referralEarnings } from "@db/schema";

// ─── VIP Table ───
export const VIP_TABLE = [
  { level: 0, min: 0, max: 99, rate: 0, refsRequired: 0 },
  { level: 1, min: 50, max: 299, rate: 2.20, refsRequired: 0 },
  { level: 2, min: 300, max: 1499, rate: 2.90, refsRequired: 5 },
  { level: 3, min: 1500, max: 3999, rate: 3.60, refsRequired: 10 },
  { level: 4, min: 4000, max: 9999, rate: 4.00, refsRequired: 16 },
  { level: 5, min: 10000, max: 19999, rate: 4.60, refsRequired: 25 },
  { level: 6, min: 20000, max: Infinity, rate: 5.20, refsRequired: 40 },
];

// ─── Referral Commission Rates ───
export const REFERRAL_COMMISSIONS = {
  tier1: 10,
  tier2: 6,
  tier3: 3,
};

// Get VIP level based on BOTH investment AND active tier-1 referrals
function getVipLevel(investment: number, activeRefs: number): number {
  for (let i = VIP_TABLE.length - 1; i >= 0; i--) {
    if (
      investment >= VIP_TABLE[i].min &&
      activeRefs >= VIP_TABLE[i].refsRequired
    ) {
      return VIP_TABLE[i].level;
    }
  }
  return 0;
}

function getDailyRate(level: number): number {
  const vip = VIP_TABLE.find((v) => v.level === level);
  return vip ? vip.rate : 0;
}

// Convert timestamp to Turkey time (UTC+3)
function getTRTime(ts: number): number {
  const turkeyOffset = 3;
  const utc = ts + new Date().getTimezoneOffset() * 60000;
  return utc + 3600000 * turkeyOffset;
}

// Check if user can click:
// 1. 24h cooldown since last click, OR
// 2. Daily reset at TR 08:00 (whichever comes first)
function canClick(lastClickAt: Date | null): boolean {
  if (!lastClickAt) return true;
  const now = Date.now();
  const last = lastClickAt.getTime();

  // 24h cooldown check
  if (now - last >= 24 * 60 * 60 * 1000) return true;

  // Daily 08:00 TR reset check
  const trNow = getTRTime(now);
  const trLast = getTRTime(last);

  const today8am = new Date(trNow);
  today8am.setHours(8, 0, 0, 0);

  // If now is after 08:00 and last click was before today's 08:00
  if (trNow >= today8am.getTime() && trLast < today8am.getTime()) return true;

  return false;
}

// Get time remaining until next available click
// Returns the shorter of: 24h cooldown OR next 08:00 TR reset
function getTimeRemaining(lastClickAt: Date | null): {
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  type: '24h' | '08:00';
} {
  const now = Date.now();

  // Calculate 24h cooldown end
  let next24h = now + 24 * 60 * 60 * 1000;
  if (lastClickAt) {
    next24h = lastClickAt.getTime() + 24 * 60 * 60 * 1000;
  }

  // Calculate next 08:00 TR
  const trNow = getTRTime(now);
  const today8am = new Date(trNow);
  today8am.setHours(8, 0, 0, 0);
  let next8am = today8am.getTime();
  if (new Date(trNow).getHours() >= 8) {
    next8am += 24 * 60 * 60 * 1000;
  }

  // Pick whichever comes first
  const use24h = next24h <= next8am;
  const target = use24h ? next24h : next8am;
  const diff = Math.max(0, target - now);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { hours, minutes, seconds, total: diff, type: use24h ? '24h' : '08:00' };
}

export const clickRouter = createRouter({
  status: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, ctx.user.id),
    });

    // Count tier-1 referrals
    const tier1Count = profile
      ? await db
          .select({ count: count() })
          .from(referrals)
          .where(
            eq(referrals.referrerUserId, ctx.user.id) &&
              eq(referrals.tier, 1)
          )
      : [{ count: 0 }];
    const activeRefs = tier1Count[0]?.count ?? 0;

    if (!profile) {
      return {
        canClick: false,
        timeRemaining: getTimeRemaining(null),
        consecutiveClicks: 0,
        vipLevel: 0,
        dailyRate: 0,
        dailyEarning: 0,
        investment: 0,
        activeRefs: 0,
      };
    }

    const vipLevel = getVipLevel(Number(profile.investment), activeRefs);
    const dailyRate = getDailyRate(vipLevel);
    const dailyEarning = (Number(profile.investment) * dailyRate) / 100;
    const lastClick = profile.lastClickAt;
    const canClickNow = canClick(lastClick) && vipLevel > 0;

    return {
      canClick: canClickNow,
      timeRemaining: getTimeRemaining(lastClick),
      vipLevel,
      dailyRate,
      dailyEarning,
      investment: Number(profile.investment),
      lastClickAt: lastClick,
      consecutiveClicks: profile.consecutiveClicks,
      activeRefs,
    };
  }),

  record: authedQuery
    .input(z.object({ earning: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      });
      if (!profile) throw new Error("Profile not found");

      // Count tier-1 referrals for VIP check
      const tier1Count = await db
        .select({ count: count() })
        .from(referrals)
        .where(
          eq(referrals.referrerUserId, ctx.user.id) && eq(referrals.tier, 1)
        );
      const activeRefs = tier1Count[0]?.count ?? 0;

      const vipLevel = getVipLevel(Number(profile.investment), activeRefs);
      if (vipLevel === 0)
        throw new Error(
          "Must have active investment and enough referrals to click"
        );
      if (!canClick(profile.lastClickAt))
        throw new Error("Cannot click yet");

      const newBalance = Number(profile.balance) + input.earning;
      const newTotalEarned = Number(profile.totalEarned) + input.earning;
      const newConsecutiveClicks = profile.consecutiveClicks + 1;

      await db
        .update(profiles)
        .set({
          balance: String(newBalance),
          totalEarned: String(newTotalEarned),
          totalClicks: profile.totalClicks + 1,
          consecutiveClicks: newConsecutiveClicks,
          lastClickAt: new Date(),
        })
        .where(eq(profiles.userId, ctx.user.id));

      // ─── Distribute referral commissions ───
      // When a user clicks, their tier-1/2/3 referrers earn commission
      // based on the clicker's earning: tier1: 10%, tier2: 6%, tier3: 3%
      const commissionsGiven: { tier: number; amount: number; toUserId: number }[] = [];

      // Find all referrers of the clicking user (tiers 1, 2, 3)
      const userReferrers = await db
        .select()
        .from(referrals)
        .where(eq(referrals.referredUserId, ctx.user.id));

      for (const ref of userReferrers) {
        const ratePercent =
          ref.tier === 1 ? REFERRAL_COMMISSIONS.tier1 :
          ref.tier === 2 ? REFERRAL_COMMISSIONS.tier2 :
          ref.tier === 3 ? REFERRAL_COMMISSIONS.tier3 : 0;

        if (ratePercent <= 0) continue;

        const commission = (input.earning * ratePercent) / 100;

        // 1. Add commission to referrer's balance
        const referrerProfile = await db.query.profiles.findFirst({
          where: eq(profiles.userId, ref.referrerUserId),
        });
        if (referrerProfile) {
          const refNewBalance = Number(referrerProfile.balance) + commission;
          const refNewTotalEarned = Number(referrerProfile.totalEarned) + commission;
          await db
            .update(profiles)
            .set({
              balance: String(refNewBalance),
              totalEarned: String(refNewTotalEarned),
            })
            .where(eq(profiles.userId, ref.referrerUserId));
        }

        // 2. Record the earning
        await db.insert(referralEarnings).values({
          referrerUserId: ref.referrerUserId,
          referredUserId: ctx.user.id,
          tier: ref.tier,
          clickEarning: String(input.earning),
          commissionRate: String(ratePercent),
          commissionAmount: String(commission),
        });

        commissionsGiven.push({ tier: ref.tier, amount: commission, toUserId: ref.referrerUserId });
      }

      return {
        success: true,
        earned: input.earning,
        newBalance,
        totalClicks: profile.totalClicks + 1,
        consecutiveClicks: newConsecutiveClicks,
        commissionsGiven,
      };
    }),
});
