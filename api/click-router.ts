import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { profiles, referrals, referralEarnings } from "@db/schema";
import { capAmount, getRandomDailyRate, getVipInfo, getVipLevel } from "./vip-config";

export const REFERRAL_COMMISSIONS = {
  tier1: 10,
  tier2: 6,
  tier3: 3,
};

function getTRTime(ts: number): number {
  const turkeyOffset = 3;
  const utc = ts + new Date().getTimezoneOffset() * 60000;
  return utc + 3600000 * turkeyOffset;
}

function canClick(lastClickAt: Date | null): boolean {
  if (!lastClickAt) return true;
  const now = Date.now();
  const last = lastClickAt.getTime();

  if (now - last >= 24 * 60 * 60 * 1000) return true;

  const trNow = getTRTime(now);
  const trLast = getTRTime(last);
  const today8am = new Date(trNow);
  today8am.setHours(8, 0, 0, 0);

  return trNow >= today8am.getTime() && trLast < today8am.getTime();
}

function getTimeRemaining(lastClickAt: Date | null): {
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  type: "24h" | "08:00";
} {
  const now = Date.now();

  let next24h = now + 24 * 60 * 60 * 1000;
  if (lastClickAt) next24h = lastClickAt.getTime() + 24 * 60 * 60 * 1000;

  const trNow = getTRTime(now);
  const today8am = new Date(trNow);
  today8am.setHours(8, 0, 0, 0);
  let next8am = today8am.getTime();
  if (new Date(trNow).getHours() >= 8) next8am += 24 * 60 * 60 * 1000;

  const use24h = next24h <= next8am;
  const target = use24h ? next24h : next8am;
  const diff = Math.max(0, target - now);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { hours, minutes, seconds, total: diff, type: use24h ? "24h" : "08:00" };
}

async function getTier1ReferralCount(userId: number) {
  const db = getDb();
  const rows = await db
    .select({ count: count() })
    .from(referrals)
    .where(and(eq(referrals.referrerUserId, userId), eq(referrals.tier, 1)));
  return rows[0]?.count ?? 0;
}

export const clickRouter = createRouter({
  status: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, ctx.user.id),
    });

    if (!profile) {
      return {
        canClick: false,
        timeRemaining: getTimeRemaining(null),
        consecutiveClicks: 0,
        vipLevel: 0,
        dailyRate: 0,
        dailyRateMin: 0,
        dailyRateMax: 0,
        dailyEarning: 0,
        dailyEarningMin: 0,
        dailyEarningMax: 0,
        balanceCap: 0,
        balanceCapReached: false,
        investment: 0,
        activeRefs: 0,
      };
    }

    const activeRefs = await getTier1ReferralCount(ctx.user.id);
    const investment = Number(profile.investment);
    const balance = Number(profile.balance);
    const vipLevel = getVipLevel(investment, activeRefs);
    const vipInfo = getVipInfo(vipLevel);
    const dailyEarningMin = (investment * vipInfo.rateMin) / 100;
    const dailyEarningMax = (investment * vipInfo.rateMax) / 100;
    const lastClick = profile.lastClickAt;
    const balanceCapReached = vipInfo.balanceCap > 0 && balance >= vipInfo.balanceCap;

    return {
      canClick: canClick(lastClick) && vipLevel > 0 && !balanceCapReached,
      timeRemaining: getTimeRemaining(lastClick),
      vipLevel,
      dailyRate: vipInfo.rate,
      dailyRateMin: vipInfo.rateMin,
      dailyRateMax: vipInfo.rateMax,
      dailyEarning: (dailyEarningMin + dailyEarningMax) / 2,
      dailyEarningMin,
      dailyEarningMax,
      balanceCap: vipInfo.balanceCap,
      balanceCapReached,
      investment,
      lastClickAt: lastClick,
      consecutiveClicks: profile.consecutiveClicks,
      activeRefs,
    };
  }),

  record: authedQuery
    .input(z.object({ earning: z.number().positive().optional() }).optional())
    .mutation(async ({ ctx }) => {
      const db = getDb();
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      });
      if (!profile) throw new Error("Profile not found");

      const activeRefs = await getTier1ReferralCount(ctx.user.id);
      const vipLevel = getVipLevel(Number(profile.investment), activeRefs);
      if (vipLevel === 0) throw new Error("Must have active investment and enough referrals to click");
      if (!canClick(profile.lastClickAt)) throw new Error("Cannot click yet");

      const dailyRate = getRandomDailyRate(vipLevel);
      const calculatedEarning = (Number(profile.investment) * dailyRate) / 100;
      const actualEarning = capAmount(Number(profile.balance), calculatedEarning, vipLevel);
      if (actualEarning <= 0) throw new Error("VIP balance limit reached");

      const newBalance = Number(profile.balance) + actualEarning;
      const newTotalEarned = Number(profile.totalEarned) + actualEarning;
      const newConsecutiveClicks = profile.consecutiveClicks + 1;

      await db
        .update(profiles)
        .set({
          balance: String(newBalance),
          totalEarned: String(newTotalEarned),
          totalClicks: profile.totalClicks + 1,
          consecutiveClicks: newConsecutiveClicks,
          lastClickAt: new Date(),
          vipLevel,
        })
        .where(eq(profiles.userId, ctx.user.id));

      const commissionsGiven: { tier: number; amount: number; toUserId: number }[] = [];
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

        const commission = (actualEarning * ratePercent) / 100;
        const referrerProfile = await db.query.profiles.findFirst({
          where: eq(profiles.userId, ref.referrerUserId),
        });

        let paidCommission = 0;
        if (referrerProfile) {
          const refActiveRefs = await getTier1ReferralCount(ref.referrerUserId);
          const refVipLevel = getVipLevel(Number(referrerProfile.investment), refActiveRefs);
          paidCommission = capAmount(Number(referrerProfile.balance), commission, refVipLevel);

          if (paidCommission > 0) {
            await db
              .update(profiles)
              .set({
                balance: String(Number(referrerProfile.balance) + paidCommission),
                totalEarned: String(Number(referrerProfile.totalEarned) + paidCommission),
                vipLevel: refVipLevel,
              })
              .where(eq(profiles.userId, ref.referrerUserId));
          }
        }

        await db.insert(referralEarnings).values({
          referrerUserId: ref.referrerUserId,
          referredUserId: ctx.user.id,
          tier: ref.tier,
          clickEarning: String(actualEarning),
          commissionRate: String(ratePercent),
          commissionAmount: String(paidCommission),
        });

        commissionsGiven.push({ tier: ref.tier, amount: paidCommission, toUserId: ref.referrerUserId });
      }

      return {
        success: true,
        earned: actualEarning,
        dailyRate,
        newBalance,
        totalClicks: profile.totalClicks + 1,
        consecutiveClicks: newConsecutiveClicks,
        commissionsGiven,
      };
    }),
});
