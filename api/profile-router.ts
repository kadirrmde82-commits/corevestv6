import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { profiles } from "@db/schema";

// Generate unique referral code
function generateReferralCode(): string {
  return 'CV' + Math.random().toString(36).substring(2, 7).toUpperCase();
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
      return { ...newProfile!, userId: ctx.user.id };
    }

    return { ...profile, userId: ctx.user.id };
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
