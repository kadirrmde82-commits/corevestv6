import { z } from "zod";
import { eq, desc, like, or, count, and } from "drizzle-orm";
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
  clickEarnings,
  vipBonuses,
  userLoginEvents,
} from "@db/schema";
import { logAdminActivity } from "./admin-system-router";
import { awardReferralWheelBonus } from "./wheel-router";
import { capAmount, getVipInfo, getVipLevel } from "./vip-config";
import { getQualifiedTier1ReferralCount } from "./referral-qualification";

async function getTier1ReferralCountForUser(userId: number) {
  return getQualifiedTier1ReferralCount(userId);
}

async function deductMemberEarning(
  userId: number,
  amount: number,
  options: { deductTotalEarned?: boolean; deductTotalClicks?: boolean } = {}
) {
  const db = getDb();
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!profile) return;

  await db
    .update(profiles)
    .set({
      balance: String(Math.max(0, Number(profile.balance) - amount)),
      totalEarned: options.deductTotalEarned
        ? String(Math.max(0, Number(profile.totalEarned) - amount))
        : profile.totalEarned,
      totalClicks: options.deductTotalClicks
        ? Math.max(0, Number(profile.totalClicks) - 1)
        : profile.totalClicks,
    })
    .where(eq(profiles.userId, userId));
}

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
      const spinRows = await db.query.wheelSpins.findMany({
        where: eq(wheelSpins.userId, input.userId),
        orderBy: [desc(wheelSpins.createdAt)],
      });
      const bonuses = await db
        .select()
        .from(wheelReferralBonuses)
        .where(eq(wheelReferralBonuses.userId, input.userId));
      const memberClickEarnings = await db.query.clickEarnings.findMany({
        where: eq(clickEarnings.userId, input.userId),
        orderBy: [desc(clickEarnings.createdAt)],
      });
      const memberVipBonuses = await db.query.vipBonuses.findMany({
        where: eq(vipBonuses.userId, input.userId),
        orderBy: [desc(vipBonuses.createdAt)],
      });
      const refEarnings = await db
        .select()
        .from(referralEarnings)
        .where(eq(referralEarnings.referrerUserId, input.userId))
        .orderBy(desc(referralEarnings.createdAt));
      const approvedDeposits = await db.query.deposits.findMany({
        where: and(eq(deposits.userId, input.userId), eq(deposits.status, "approved")),
      });
      const memberDeposits = await db.query.deposits.findMany({
        where: eq(deposits.userId, input.userId),
        orderBy: [desc(deposits.createdAt)],
      });
      const latestLogin = await db.query.userLoginEvents.findFirst({
        where: eq(userLoginEvents.userId, input.userId),
        orderBy: [desc(userLoginEvents.createdAt)],
      });

      if (!user) throw new Error("User not found");

      // Calculate available spins (same logic as wheel-router)
      const ownSpins = approvedDeposits.some((deposit) => Number(deposit.amount) >= 100) ? 1 : 0;
      const referralBonusSpins = bonuses.reduce((sum, bonus) => {
        if (bonus.referredUserId === 0) return sum + bonus.spinsEarned;
        return sum;
      }, 0) + new Set(bonuses.filter((bonus) => bonus.referredUserId !== 0 && bonus.spinsEarned > 0).map((bonus) => bonus.referredUserId)).size;
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
              withdrawalAccess: profile.withdrawalAccess,
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
        wheelSpins: spinRows.map((spin) => ({
          id: spin.id,
          prize: Number(spin.prize),
          createdAt: spin.createdAt,
        })),
        clickEarnings: memberClickEarnings.map((earning) => ({
          id: earning.id,
          vipLevel: earning.vipLevel,
          dailyRate: Number(earning.dailyRate),
          amount: Number(earning.amount),
          createdAt: earning.createdAt,
        })),
        vipBonuses: memberVipBonuses.map((bonus) => ({
          id: bonus.id,
          vipLevel: bonus.vipLevel,
          amount: Number(bonus.amount),
          createdAt: bonus.createdAt,
        })),
        deposits: memberDeposits.map((deposit) => ({
          id: deposit.id,
          amount: Number(deposit.amount),
          txid: deposit.txid,
          email: deposit.email,
          cryptoType: deposit.cryptoType,
          status: deposit.status,
          createdAt: deposit.createdAt,
        })),
        latestLogin: latestLogin ? {
          ipAddress: latestLogin.ipAddress,
          country: latestLogin.country,
          city: latestLogin.city,
          userAgent: latestLogin.userAgent,
          createdAt: latestLogin.createdAt,
        } : null,
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

  addDeposit: adminQuery
    .input(
      z.object({
        userId: z.number(),
        amount: z.number().positive(),
        email: z.string().email().optional(),
        cryptoType: z.string().min(1).max(32).default("trc20"),
        status: z.enum(["pending", "approved"]).default("approved"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
      if (!user) throw new Error("User not found");
      const txid = `ADMIN-${Math.floor(Math.random() * 900000 + 100000)}`;
      const result = await db.insert(deposits).values({
        userId: input.userId,
        amount: String(input.amount),
        txid,
        email: input.email || user.email || "admin@corevest.local",
        cryptoType: input.cryptoType,
        status: input.status,
        userNote: "Admin tarafından eklendi",
      });

      if (input.status === "approved") {
        const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, input.userId) });
        if (profile) {
          const currentInvestment = Number(profile.investment);
          const newInvestment = currentInvestment + input.amount;
          const activeRefs = await getTier1ReferralCountForUser(input.userId);
          const previousVipLevel = getVipLevel(currentInvestment, activeRefs);
          const newVipLevel = getVipLevel(newInvestment, activeRefs);
          let newBalance = Number(profile.balance) + input.amount;
          let bonusTotal = 0;

          for (let level = previousVipLevel + 1; level <= newVipLevel; level++) {
            const vipInfo = getVipInfo(level);
            if (vipInfo.bonus <= 0) continue;
            const alreadyAwarded = await db.query.vipBonuses.findFirst({
              where: and(eq(vipBonuses.userId, input.userId), eq(vipBonuses.vipLevel, level)),
            });
            if (alreadyAwarded) continue;
            const actualBonus = capAmount(newBalance, vipInfo.bonus, newVipLevel);
            if (actualBonus <= 0) continue;
            newBalance += actualBonus;
            bonusTotal += actualBonus;
            await db.insert(vipBonuses).values({
              userId: input.userId,
              vipLevel: level,
              amount: String(actualBonus),
            });
          }

          await db
            .update(profiles)
            .set({
              investment: String(newInvestment),
              balance: String(newBalance),
              totalEarned: String(Number(profile.totalEarned) + bonusTotal),
              vipLevel: newVipLevel,
            })
            .where(eq(profiles.userId, input.userId));

          await awardReferralWheelBonus(db, input.userId, input.amount);
        }
      }

      await logAdminActivity({
        adminUserId: ctx.user.id,
        action: "member.addDeposit",
        targetType: "user",
        targetId: input.userId,
        details: { amount: input.amount, status: input.status, depositId: Number(result[0].insertId) },
        req: ctx.req,
      });

      return { success: true, id: Number(result[0].insertId) };
    }),

  deleteDeposit: adminQuery
    .input(z.object({ depositId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const deposit = await db.query.deposits.findFirst({ where: eq(deposits.id, input.depositId) });
      if (!deposit) throw new Error("Deposit not found");

      if (deposit.status === "approved") {
        const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, deposit.userId) });
        if (profile) {
          const amount = Number(deposit.amount);
          const newInvestment = Math.max(0, Number(profile.investment) - amount);
          const newBalance = Math.max(0, Number(profile.balance) - amount);
          const activeRefs = await getTier1ReferralCountForUser(deposit.userId);
          const newVipLevel = getVipLevel(newInvestment, activeRefs);
          await db
            .update(profiles)
            .set({
              investment: String(newInvestment),
              balance: String(newBalance),
              vipLevel: newVipLevel,
            })
            .where(eq(profiles.userId, deposit.userId));
        }
      }

      await db.delete(deposits).where(eq(deposits.id, input.depositId));
      await logAdminActivity({
        adminUserId: ctx.user.id,
        action: "member.deleteDeposit",
        targetType: "deposit",
        targetId: input.depositId,
        details: { userId: deposit.userId, amount: deposit.amount, status: deposit.status },
        req: ctx.req,
      });
      return { success: true };
    }),

  deleteClickEarning: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const earning = await db.query.clickEarnings.findFirst({ where: eq(clickEarnings.id, input.id) });
      if (!earning) throw new Error("Click earning not found");

      await deductMemberEarning(earning.userId, Number(earning.amount), {
        deductTotalEarned: true,
        deductTotalClicks: true,
      });
      await db.delete(clickEarnings).where(eq(clickEarnings.id, input.id));
      await logAdminActivity({
        adminUserId: ctx.user.id,
        action: "member.deleteClickEarning",
        targetType: "click_earning",
        targetId: input.id,
        details: { userId: earning.userId, amount: earning.amount },
        req: ctx.req,
      });
      return { success: true };
    }),

  deleteWheelSpin: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const spin = await db.query.wheelSpins.findFirst({ where: eq(wheelSpins.id, input.id) });
      if (!spin) throw new Error("Wheel spin not found");

      await deductMemberEarning(spin.userId, Number(spin.prize), { deductTotalEarned: false });
      await db.delete(wheelSpins).where(eq(wheelSpins.id, input.id));
      await logAdminActivity({
        adminUserId: ctx.user.id,
        action: "member.deleteWheelSpin",
        targetType: "wheel_spin",
        targetId: input.id,
        details: { userId: spin.userId, amount: spin.prize },
        req: ctx.req,
      });
      return { success: true };
    }),

  deleteVipBonus: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const bonus = await db.query.vipBonuses.findFirst({ where: eq(vipBonuses.id, input.id) });
      if (!bonus) throw new Error("VIP bonus not found");

      await deductMemberEarning(bonus.userId, Number(bonus.amount), { deductTotalEarned: true });
      await db.delete(vipBonuses).where(eq(vipBonuses.id, input.id));
      await logAdminActivity({
        adminUserId: ctx.user.id,
        action: "member.deleteVipBonus",
        targetType: "vip_bonus",
        targetId: input.id,
        details: { userId: bonus.userId, amount: bonus.amount, vipLevel: bonus.vipLevel },
        req: ctx.req,
      });
      return { success: true };
    }),

  deleteReferralEarning: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const earning = await db.query.referralEarnings.findFirst({ where: eq(referralEarnings.id, input.id) });
      if (!earning) throw new Error("Referral earning not found");

      await deductMemberEarning(earning.referrerUserId, Number(earning.commissionAmount), {
        deductTotalEarned: true,
      });
      await db.delete(referralEarnings).where(eq(referralEarnings.id, input.id));
      await logAdminActivity({
        adminUserId: ctx.user.id,
        action: "member.deleteReferralEarning",
        targetType: "referral_earning",
        targetId: input.id,
        details: { userId: earning.referrerUserId, referredUserId: earning.referredUserId, amount: earning.commissionAmount },
        req: ctx.req,
      });
      return { success: true };
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

  setWithdrawalAccess: adminQuery
    .input(
      z.object({
        userId: z.number(),
        access: z.number().int().min(0).max(2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(profiles)
        .set({ withdrawalAccess: input.access })
        .where(eq(profiles.userId, input.userId));
      await logAdminActivity({
        adminUserId: ctx.user.id,
        action: "member.setWithdrawalAccess",
        targetType: "user",
        targetId: input.userId,
        details: { access: input.access },
        req: ctx.req,
      });
      return { success: true, access: input.access };
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

      await db.delete(clickEarnings).where(eq(clickEarnings.userId, uid));

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
