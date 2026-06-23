import { z } from "zod";
import { eq, desc, like, or, count } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { hashPassword } from "./local-auth";
import {
  users,
  profiles,
  wheelSpins,
  wheelReferralBonuses,
  deposits,
  withdrawals,
  tickets,
  ticketMessages,
  referrals,
  referralEarnings,
} from "@db/schema";
import { logAdminActivity } from "./admin-system-router";

export const adminMemberRouter = createRouter({
  // List all members with profiles
  list: adminQuery
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(50),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const search = input?.search?.trim();

      let query;
      if (search) {
        const searchPattern = `%${search}%`;
        query = db
          .select()
          .from(users)
          .leftJoin(profiles, eq(users.id, profiles.userId))
          .where(
            or(
              like(users.email, searchPattern),
              like(users.name, searchPattern),
              like(profiles.referralCode, searchPattern),
              ...(Number.isInteger(Number(search)) ? [eq(users.publicId, Number(search))] : [])
            )
          )
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset((page - 1) * limit);
      } else {
        query = db
          .select()
          .from(users)
          .leftJoin(profiles, eq(users.id, profiles.userId))
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset((page - 1) * limit);
      }

      const results = await query;

      // Get total count
      let countQuery;
      if (search) {
        const searchPattern = `%${search}%`;
        countQuery = db
          .select({ count: count() })
          .from(users)
          .leftJoin(profiles, eq(users.id, profiles.userId))
          .where(
            or(
              like(users.email, searchPattern),
              like(users.name, searchPattern),
              like(profiles.referralCode, searchPattern),
              ...(Number.isInteger(Number(search)) ? [eq(users.publicId, Number(search))] : [])
            )
          );
      } else {
        countQuery = db.select({ count: count() }).from(users);
      }
      const totalResult = await countQuery;
      const total = totalResult[0]?.count ?? 0;

      const members = results.map((r: any) => ({
        id: r.users.id,
        publicId: r.users.publicId,
        email: r.users.email,
        name: r.users.name,
        role: r.users.role,
        createdAt: r.users.createdAt,
        referralCode: r.profiles?.referralCode ?? "",
        balance: Number(r.profiles?.balance ?? 0),
        investment: Number(r.profiles?.investment ?? 0),
        vipLevel: r.profiles?.vipLevel ?? 0,
        totalClicks: r.profiles?.totalClicks ?? 0,
        consecutiveClicks: r.profiles?.consecutiveClicks ?? 0,
        monthlyWithdrawalCount: r.profiles?.monthlyWithdrawalCount ?? 0,
        joinDate: r.profiles?.joinDate,
      }));

      return { members, total, page, limit };
    }),

  exportData: adminQuery.query(async () => {
    const db = getDb();
    const memberRows = await db
      .select()
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .orderBy(desc(users.createdAt));

    const allDeposits = await db.select().from(deposits);
    const allWithdrawals = await db.select().from(withdrawals);
    const allReferrals = await db.select().from(referrals);
    const allReferralEarnings = await db.select().from(referralEarnings);

    const sumByUser = <T extends { userId: number; amount: unknown; status?: string }>(
      rows: T[],
      status?: string
    ) => {
      const map = new Map<number, number>();
      for (const row of rows) {
        if (status && row.status !== status) continue;
        map.set(row.userId, (map.get(row.userId) ?? 0) + Number(row.amount));
      }
      return map;
    };

    const countByUser = <T extends { userId: number; status?: string }>(
      rows: T[],
      status?: string
    ) => {
      const map = new Map<number, number>();
      for (const row of rows) {
        if (status && row.status !== status) continue;
        map.set(row.userId, (map.get(row.userId) ?? 0) + 1);
      }
      return map;
    };

    const depositApproved = sumByUser(allDeposits, "approved");
    const depositPendingCount = countByUser(allDeposits, "pending");
    const withdrawalApproved = sumByUser(allWithdrawals, "approved");
    const withdrawalPendingCount = countByUser(allWithdrawals, "pending");

    const referralCounts = new Map<number, { tier1: number; tier2: number; tier3: number }>();
    for (const referral of allReferrals) {
      const current = referralCounts.get(referral.referrerUserId) ?? { tier1: 0, tier2: 0, tier3: 0 };
      if (referral.tier === 1) current.tier1 += 1;
      if (referral.tier === 2) current.tier2 += 1;
      if (referral.tier === 3) current.tier3 += 1;
      referralCounts.set(referral.referrerUserId, current);
    }

    const referralEarningsByUser = new Map<number, number>();
    for (const earning of allReferralEarnings) {
      referralEarningsByUser.set(
        earning.referrerUserId,
        (referralEarningsByUser.get(earning.referrerUserId) ?? 0) + Number(earning.commissionAmount)
      );
    }

    return memberRows.map((row: any) => {
      const user = row.users;
      const profile = row.profiles;
      const refs = referralCounts.get(user.id) ?? { tier1: 0, tier2: 0, tier3: 0 };

      return {
        id: user.id,
        publicId: user.publicId,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        referralCode: profile?.referralCode ?? "",
        referredBy: profile?.referredBy ?? "",
        vipLevel: profile?.vipLevel ?? 0,
        balance: Number(profile?.balance ?? 0),
        investment: Number(profile?.investment ?? 0),
        totalEarned: Number(profile?.totalEarned ?? 0),
        totalClicks: profile?.totalClicks ?? 0,
        consecutiveClicks: profile?.consecutiveClicks ?? 0,
        monthlyWithdrawalCount: profile?.monthlyWithdrawalCount ?? 0,
        lastClickAt: profile?.lastClickAt ?? null,
        lastWithdrawalAt: profile?.lastWithdrawalAt ?? null,
        joinDate: profile?.joinDate ?? user.createdAt,
        approvedDepositTotal: depositApproved.get(user.id) ?? 0,
        pendingDepositCount: depositPendingCount.get(user.id) ?? 0,
        approvedWithdrawalTotal: withdrawalApproved.get(user.id) ?? 0,
        pendingWithdrawalCount: withdrawalPendingCount.get(user.id) ?? 0,
        referralTier1: refs.tier1,
        referralTier2: refs.tier2,
        referralTier3: refs.tier3,
        referralEarningsTotal: referralEarningsByUser.get(user.id) ?? 0,
      };
    });
  }),

  // Update member user info (name + email)
  updateUser: adminQuery
    .input(
      z.object({
        userId: z.number(),
        name: z.string().min(1).max(255).optional(),
        email: z.string().email().max(320).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { userId, ...data } = input;
      const updateData: Record<string, any> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId));
      await logAdminActivity({ adminUserId: ctx.user.id, action: "member.updateUser", targetType: "user", targetId: userId, details: updateData, req: ctx.req });
      return { success: true };
    }),

  // Get member detail
  detail: adminQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const user = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, input.userId),
      });
      const spins = await db
        .select({ count: count() })
        .from(wheelSpins)
        .where(eq(wheelSpins.userId, input.userId));
      const bonuses = await db
        .select()
        .from(wheelReferralBonuses)
        .where(eq(wheelReferralBonuses.userId, input.userId));
      const refEarnings = await db
        .select()
        .from(referralEarnings)
        .where(eq(referralEarnings.referrerUserId, input.userId))
        .orderBy(desc(referralEarnings.createdAt));

      if (!user) throw new Error("User not found");

      // Calculate available spins (same logic as wheel-router)
      const investment = profile ? Number(profile.investment) : 0;
      const ownSpins = Math.floor(investment / 100);
      const referralBonusSpins = bonuses.reduce((sum, b) => sum + b.spinsEarned, 0);
      const totalEarnedSpins = ownSpins + referralBonusSpins;
      const totalSpinsUsed = spins[0]?.count ?? 0;
      const availableSpins = Math.max(0, totalEarnedSpins - totalSpinsUsed);

      return {
        id: user.id,
        publicId: user.publicId,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        profile: profile
          ? {
              referralCode: profile.referralCode,
              balance: Number(profile.balance),
              investment: Number(profile.investment),
              vipLevel: profile.vipLevel,
              totalEarned: Number(profile.totalEarned),
              totalClicks: profile.totalClicks,
              consecutiveClicks: profile.consecutiveClicks,
              monthlyWithdrawalCount: profile.monthlyWithdrawalCount,
              lastWithdrawalAt: profile.lastWithdrawalAt,
              lastClickAt: profile.lastClickAt,
              joinDate: profile.joinDate,
            }
          : null,
        wheelSpinsUsed: totalSpinsUsed,
        availableSpins,
        ownSpins,
        referralBonusSpins,
        totalEarnedSpins,
        referralBonuses: bonuses,
        referralEarnings: refEarnings.map(e => ({
          id: e.id,
          referredUserId: e.referredUserId,
          tier: e.tier,
          clickEarning: Number(e.clickEarning),
          commissionRate: Number(e.commissionRate),
          commissionAmount: Number(e.commissionAmount),
          createdAt: e.createdAt,
        })),
        totalReferralEarnings: refEarnings.reduce((sum, e) => sum + Number(e.commissionAmount), 0),
      };
    }),

  // Update member balance
  updateBalance: adminQuery
    .input(
      z.object({
        userId: z.number(),
        newBalance: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(profiles)
        .set({ balance: String(input.newBalance) })
        .where(eq(profiles.userId, input.userId));
      await logAdminActivity({ adminUserId: ctx.user.id, action: "member.updateBalance", targetType: "user", targetId: input.userId, details: { newBalance: input.newBalance }, req: ctx.req });
      return { success: true, newBalance: input.newBalance };
    }),

  // Update member investment
  updateInvestment: adminQuery
    .input(
      z.object({
        userId: z.number(),
        newInvestment: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(profiles)
        .set({ investment: String(input.newInvestment) })
        .where(eq(profiles.userId, input.userId));
      await logAdminActivity({ adminUserId: ctx.user.id, action: "member.updateInvestment", targetType: "user", targetId: input.userId, details: { newInvestment: input.newInvestment }, req: ctx.req });
      return { success: true, newInvestment: input.newInvestment };
    }),

  // Update VIP level
  updateVip: adminQuery
    .input(
      z.object({
        userId: z.number(),
        vipLevel: z.number().min(0).max(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(profiles)
        .set({ vipLevel: input.vipLevel })
        .where(eq(profiles.userId, input.userId));
      await logAdminActivity({ adminUserId: ctx.user.id, action: "member.updateVip", targetType: "user", targetId: input.userId, details: { vipLevel: input.vipLevel }, req: ctx.req });
      return { success: true, vipLevel: input.vipLevel };
    }),

  // Grant or remove wheel spins (positive = add, negative = remove)
  adjustWheelSpins: adminQuery
    .input(
      z.object({
        userId: z.number(),
        spins: z.number().int().min(-1000).max(1000),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.insert(wheelReferralBonuses).values({
        userId: input.userId,
        referredUserId: 0,
        investmentAmount: "0",
        spinsEarned: input.spins,
      });
      await logAdminActivity({ adminUserId: ctx.user.id, action: "member.adjustWheelSpins", targetType: "user", targetId: input.userId, details: { spins: input.spins, note: input.note }, req: ctx.req });
      return { success: true, spinsAdjusted: input.spins };
    }),

  // Reset consecutive clicks (after withdrawal approval)
  resetClicks: adminQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(profiles)
        .set({ consecutiveClicks: 0 })
        .where(eq(profiles.userId, input.userId));
      return { success: true };
    }),

  // Reset member password (admin sets new password)
  resetPassword: adminQuery
    .input(
      z.object({
        userId: z.number(),
        newPassword: z.string().min(6).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const passwordHash = hashPassword(input.newPassword);
      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, input.userId));
      await logAdminActivity({ adminUserId: ctx.user.id, action: "member.resetPassword", targetType: "user", targetId: input.userId, req: ctx.req });
      return { success: true };
    }),

  // Delete a member and all related data
  delete: adminQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const uid = input.userId;

      // Delete all related records first (to avoid FK constraint errors)
      // 1. Ticket messages
      const userTickets = await db.query.tickets.findMany({
        where: eq(tickets.userId, uid),
      });
      for (const t of userTickets) {
        await db
          .delete(ticketMessages)
          .where(eq(ticketMessages.ticketId, t.id));
      }

      // 2. Tickets
      await db.delete(tickets).where(eq(tickets.userId, uid));

      // 3. Deposits
      await db.delete(deposits).where(eq(deposits.userId, uid));

      // 4. Withdrawals
      await db.delete(withdrawals).where(eq(withdrawals.userId, uid));

      // 5. Wheel spins
      await db.delete(wheelSpins).where(eq(wheelSpins.userId, uid));

      // 6. Wheel referral bonuses (as userId)
      await db
        .delete(wheelReferralBonuses)
        .where(eq(wheelReferralBonuses.userId, uid));

      // 7. Wheel referral bonuses (as referredUserId)
      await db
        .delete(wheelReferralBonuses)
        .where(eq(wheelReferralBonuses.referredUserId, uid));

      // 8. Referrals where user is referrer
      await db
        .delete(referrals)
        .where(eq(referrals.referrerUserId, uid));

      // 9. Referrals where user is referred
      await db
        .delete(referrals)
        .where(eq(referrals.referredUserId, uid));

      // 10. Profile
      await db.delete(profiles).where(eq(profiles.userId, uid));

      // 11. User (finally)
      await db.delete(users).where(eq(users.id, uid));

      await logAdminActivity({ adminUserId: ctx.user.id, action: "member.delete", targetType: "user", targetId: uid, req: ctx.req });

      return { success: true };
    }),

  // Get stats
  stats: adminQuery.query(async () => {
    const db = getDb();
    const totalUsers = await db.select({ count: count() }).from(users);
    const totalProfiles = await db.select({ count: count() }).from(profiles);
    const totalInvested = await db
      .select()
      .from(profiles);
    const totalInvestment = totalInvested.reduce(
      (sum, p) => sum + Number(p.investment),
      0
    );
    const totalBalance = totalInvested.reduce(
      (sum, p) => sum + Number(p.balance),
      0
    );

    return {
      totalUsers: totalUsers[0]?.count ?? 0,
      totalProfiles: totalProfiles[0]?.count ?? 0,
      totalInvestment,
      totalBalance,
    };
  }),
});
