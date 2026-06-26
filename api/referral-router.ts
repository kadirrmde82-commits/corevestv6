import { z } from "zod";
import { desc, eq, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { referrals, profiles, referralEarnings, users } from "@db/schema";

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
    const currentProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, ctx.user.id),
    });

    const allMyReferrals = await db.query.referrals.findMany({
      where: eq(referrals.referrerUserId, ctx.user.id),
      with: {
        referred: true,
      },
    });

    const byReferredUserId = new Map<number, {
      id: number;
      referredUserId: number;
      name: string;
      email: string;
      date: string;
      tier: 1 | 2 | 3;
      source: "relation" | "profile";
    }>();

    for (const r of allMyReferrals) {
      byReferredUserId.set(r.referredUserId, {
        id: r.id,
        referredUserId: r.referredUserId,
        name: r.referred?.name || "Kullanici",
        email: r.referred?.email || "",
        date: r.createdAt.toISOString().split("T")[0],
        tier: r.tier as 1 | 2 | 3,
        source: "relation",
      });
    }

    if (currentProfile?.referralCode) {
      const directRows = await db
        .select({
          userId: profiles.userId,
          referralCode: profiles.referralCode,
          createdAt: profiles.createdAt,
          name: users.name,
          email: users.email,
        })
        .from(profiles)
        .leftJoin(users, eq(profiles.userId, users.id))
        .where(eq(profiles.referredBy, currentProfile.referralCode));

      for (const row of directRows) {
        if (!byReferredUserId.has(row.userId)) {
          byReferredUserId.set(row.userId, {
            id: row.userId,
            referredUserId: row.userId,
            name: row.name || "Kullanici",
            email: row.email || "",
            date: row.createdAt.toISOString().split("T")[0],
            tier: 1,
            source: "profile",
          });
        }
      }

      const tier1Codes = directRows.map((row) => row.referralCode).filter(Boolean);
      const tier2Rows = tier1Codes.length > 0 ? await db
        .select({
          userId: profiles.userId,
          referralCode: profiles.referralCode,
          createdAt: profiles.createdAt,
          name: users.name,
          email: users.email,
        })
        .from(profiles)
        .leftJoin(users, eq(profiles.userId, users.id))
        .where(inArray(profiles.referredBy, tier1Codes)) : [];

      for (const row of tier2Rows) {
        if (!byReferredUserId.has(row.userId)) {
          byReferredUserId.set(row.userId, {
            id: row.userId,
            referredUserId: row.userId,
            name: row.name || "Kullanici",
            email: row.email || "",
            date: row.createdAt.toISOString().split("T")[0],
            tier: 2,
            source: "profile",
          });
        }
      }

      const tier2Codes = tier2Rows.map((row) => row.referralCode).filter(Boolean);
      const tier3Rows = tier2Codes.length > 0 ? await db
        .select({
          userId: profiles.userId,
          createdAt: profiles.createdAt,
          name: users.name,
          email: users.email,
        })
        .from(profiles)
        .leftJoin(users, eq(profiles.userId, users.id))
        .where(inArray(profiles.referredBy, tier2Codes)) : [];

      for (const row of tier3Rows) {
        if (!byReferredUserId.has(row.userId)) {
          byReferredUserId.set(row.userId, {
            id: row.userId,
            referredUserId: row.userId,
            name: row.name || "Kullanici",
            email: row.email || "",
            date: row.createdAt.toISOString().split("T")[0],
            tier: 3,
            source: "profile",
          });
        }
      }
    }

    const networkRows = Array.from(byReferredUserId.values());
    const byTier = {
      tier1: networkRows.filter(r => r.tier === 1).map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        date: r.date,
      })),
      tier2: networkRows.filter(r => r.tier === 2).map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        date: r.date,
      })),
      tier3: networkRows.filter(r => r.tier === 3).map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        date: r.date,
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
    const tier1 = new Set<number>();
    const tier2 = new Set<number>();
    const tier3 = new Set<number>();

    for (const referral of allReferrals) {
      if (referral.tier === 1) tier1.add(referral.referredUserId);
      if (referral.tier === 2) tier2.add(referral.referredUserId);
      if (referral.tier === 3) tier3.add(referral.referredUserId);
    }

    const currentProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, ctx.user.id),
    });
    if (currentProfile?.referralCode) {
      const directRows = await db
        .select({ userId: profiles.userId, referralCode: profiles.referralCode })
        .from(profiles)
        .where(eq(profiles.referredBy, currentProfile.referralCode));
      for (const row of directRows) tier1.add(row.userId);

      const tier1Codes = directRows.map((row) => row.referralCode).filter(Boolean);
      const tier2Rows = tier1Codes.length > 0 ? await db
        .select({ userId: profiles.userId, referralCode: profiles.referralCode })
        .from(profiles)
        .where(inArray(profiles.referredBy, tier1Codes)) : [];
      for (const row of tier2Rows) tier2.add(row.userId);

      const tier2Codes = tier2Rows.map((row) => row.referralCode).filter(Boolean);
      const tier3Rows = tier2Codes.length > 0 ? await db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(inArray(profiles.referredBy, tier2Codes)) : [];
      for (const row of tier3Rows) tier3.add(row.userId);
    }

    return {
      tier1: tier1.size,
      tier2: tier2.size,
      tier3: tier3.size,
      total: tier1.size + tier2.size + tier3.size,
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
