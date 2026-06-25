import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { clickEarnings, profiles, referralEarnings, vipBonuses, wheelSpins } from "@db/schema";

// Generate unique referral code
function generateReferralCode(): string {
  return 'CV' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

function turkeyDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function yesterdayTurkeyKey() {
  return turkeyDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

async function getEarningsSummary(userId: number) {
  const db = getDb();
  const [clickRows, wheelRows, vipRows, referralRows] = await Promise.all([
    db.query.clickEarnings.findMany({ where: eq(clickEarnings.userId, userId) }),
    db.query.wheelSpins.findMany({ where: eq(wheelSpins.userId, userId) }),
    db.query.vipBonuses.findMany({ where: eq(vipBonuses.userId, userId) }),
    db.query.referralEarnings.findMany({ where: eq(referralEarnings.referrerUserId, userId) }),
  ]);

  const todayKey = turkeyDateKey(new Date());
  const yesterdayKey = yesterdayTurkeyKey();
  const entries = [
    ...clickRows.map((row) => ({ amount: Number(row.amount), createdAt: row.createdAt })),
    ...wheelRows.map((row) => ({ amount: Number(row.prize), createdAt: row.createdAt })),
    ...vipRows.map((row) => ({ amount: Number(row.amount), createdAt: row.createdAt })),
    ...referralRows.map((row) => ({ amount: Number(row.commissionAmount), createdAt: row.createdAt })),
  ];

  return entries.reduce(
    (summary, entry) => {
      const key = turkeyDateKey(entry.createdAt);
      if (key === todayKey) summary.today += entry.amount;
      if (key === yesterdayKey) summary.yesterday += entry.amount;
      summary.total += entry.amount;
      return summary;
    },
    { today: 0, yesterday: 0, total: 0 }
  );
}

export const profileRouter = createRouter({
  // Get current user's profile + user id
  me: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, ctx.user.id),
    });

    // Auto-create profile if it doesn't exist
    if (!profile) {
      const code = generateReferralCode();
      await db.insert(profiles).values({
        userId: ctx.user.id,
        referralCode: code,
      });
      const newProfile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, ctx.user.id),
      });
      return { ...newProfile!, userId: ctx.user.id, publicId: ctx.user.publicId, email: ctx.user.email, earningsSummary: { today: 0, yesterday: 0, total: 0 } };
    }

    const earningsSummary = await getEarningsSummary(ctx.user.id);
    return { ...profile, userId: ctx.user.id, publicId: ctx.user.publicId, email: ctx.user.email, earningsSummary };
  }),

  // Update profile (balance, investment, etc.)
  update: authedQuery
    .input(
      z.object({
        balance: z.number().optional(),
        investment: z.number().optional(),
        totalEarned: z.number().optional(),
        totalClicks: z.number().optional(),
        vipLevel: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const updates: Record<string, string | number | undefined> = {};
      if (input.vipLevel !== undefined) updates.vipLevel = input.vipLevel;
      if (input.totalClicks !== undefined) updates.totalClicks = input.totalClicks;
      if (input.balance !== undefined) updates.balance = String(input.balance);
      if (input.investment !== undefined) updates.investment = String(input.investment);
      if (input.totalEarned !== undefined) updates.totalEarned = String(input.totalEarned);
      await db
        .update(profiles)
        .set(updates)
        .where(eq(profiles.userId, ctx.user.id));
      return { success: true };
    }),

  // Get profile by referral code
  byReferralCode: authedQuery
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.profiles.findFirst({
        where: eq(profiles.referralCode, input.code),
      });
    }),
});
