import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { referrals, profiles, referralEarnings } from "@db/schema";

export const referralRouter = createRouter({
  // Create referral relationships when a new user registers with a referral code.
  // This creates up to 3 tier records following the chain:
  //   Tier 1 = direct referrer (code owner)
  //   Tier 2 = referrer's referrer
  //   Tier 3 = referrer's referrer's referrer
  create: authedQuery
    .input(z.object({ referralCode: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const newUserId = ctx.user.id;

      // 1. Find the direct referrer by their referral code
      const directReferrer = await db.query.profiles.findFirst({
        where: eq(profiles.referralCode, input.referralCode.toUpperCase()),
      });
      if (!directReferrer) {
        throw new Error("Invalid referral code");
      }
      // Prevent self-referral
      if (directReferrer.userId === newUserId) {
        throw new Error("Cannot refer yourself");
      }

      // 2. Check if this user already has any referral records
      const existing = await db.query.referrals.findFirst({
        where: eq(referrals.referredUserId, newUserId),
      });
      if (existing) {
        return { success: false, message: "Referral already recorded for this user" };
      }

      // 3. Build the referral chain: find up to 3 levels of referrers
      const chain: { referrerId: number; tier: number }[] = [];

      // Tier 1: direct referrer (the code owner)
      chain.push({ referrerId: directReferrer.userId, tier: 1 });

      // Tier 2: find who referred the direct referrer
      const tier2Record = await db.query.referrals.findFirst({
        where: eq(referrals.referredUserId, directReferrer.userId),
      });
      if (tier2Record) {
        chain.push({ referrerId: tier2Record.referrerUserId, tier: 2 });

        // Tier 3: find who referred the tier 2 referrer
        const tier3Record = await db.query.referrals.findFirst({
          where: eq(referrals.referredUserId, tier2Record.referrerUserId),
        });
        if (tier3Record) {
          chain.push({ referrerId: tier3Record.referrerUserId, tier: 3 });
        }
      }

      // 4. Insert all referral records in the chain
      for (const link of chain) {
        await db.insert(referrals).values({
          referrerUserId: link.referrerId,
          referredUserId: newUserId,
          tier: link.tier,
        });
      }

      // 5. Update the new user's profile to record who referred them
      await db
        .update(profiles)
        .set({ referredBy: input.referralCode.toUpperCase() })
        .where(eq(profiles.userId, newUserId));

      return {
        success: true,
        tiersCreated: chain.length,
        tiers: chain.map(c => c.tier),
      };
    }),

  // List current user's direct referrals (tier 1) with full chain info
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();

    // Get all referrals where current user is the referrer
    const userReferrals = await db.query.referrals.findMany({
      where: eq(referrals.referrerUserId, ctx.user.id),
      with: {
        referred: {
          with: {
            profile: true,
          },
        },
      },
    });

    return userReferrals.map((r) => ({
      id: r.id,
      referredUserId: r.referredUserId,
      name: r.referred?.name || "Kullanici",
      email: r.referred?.email || "",
      date: r.createdAt.toISOString().split("T")[0],
      tier: r.tier as 1 | 2 | 3,
    }));
  }),

  // List all referrals grouped by tier (for the current user)
  myNetwork: authedQuery.query(async ({ ctx }) => {
    const db = getDb();

    const allMyReferrals = await db.query.referrals.findMany({
      where: eq(referrals.referrerUserId, ctx.user.id),
      with: {
        referred: true,
      },
    });

    const byTier = {
      tier1: allMyReferrals.filter(r => r.tier === 1).map(r => ({
        id: r.id,
        name: r.referred?.name || "Kullanici",
        email: r.referred?.email || "",
        date: r.createdAt.toISOString().split("T")[0],
      })),
      tier2: allMyReferrals.filter(r => r.tier === 2).map(r => ({
        id: r.id,
        name: r.referred?.name || "Kullanici",
        email: r.referred?.email || "",
        date: r.createdAt.toISOString().split("T")[0],
      })),
      tier3: allMyReferrals.filter(r => r.tier === 3).map(r => ({
        id: r.id,
        name: r.referred?.name || "Kullanici",
        email: r.referred?.email || "",
        date: r.createdAt.toISOString().split("T")[0],
      })),
    };

    return byTier;
  }),

  // Count active referrals per tier
  count: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const allReferrals = await db.query.referrals.findMany({
      where: eq(referrals.referrerUserId, ctx.user.id),
    });
    return {
      tier1: allReferrals.filter(r => r.tier === 1).length,
      tier2: allReferrals.filter(r => r.tier === 2).length,
      tier3: allReferrals.filter(r => r.tier === 3).length,
      total: allReferrals.length,
    };
  }),

  earningsSummary: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db.query.referralEarnings.findMany({
      where: eq(referralEarnings.referrerUserId, ctx.user.id),
    });

    return {
      total: rows.reduce((sum, row) => sum + Number(row.commissionAmount), 0),
      tier1: rows.filter((row) => row.tier === 1).reduce((sum, row) => sum + Number(row.commissionAmount), 0),
      tier2: rows.filter((row) => row.tier === 2).reduce((sum, row) => sum + Number(row.commissionAmount), 0),
      tier3: rows.filter((row) => row.tier === 3).reduce((sum, row) => sum + Number(row.commissionAmount), 0),
    };
  }),

  earningsList: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db.query.referralEarnings.findMany({
      where: eq(referralEarnings.referrerUserId, ctx.user.id),
      orderBy: [desc(referralEarnings.createdAt)],
    });

    return rows.map((row) => ({
      id: row.id,
      tier: row.tier,
      clickEarning: Number(row.clickEarning),
      commissionRate: Number(row.commissionRate),
      commissionAmount: Number(row.commissionAmount),
      createdAt: row.createdAt,
    }));
  }),
});
