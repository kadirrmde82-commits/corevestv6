import { desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { createRouter, adminQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  adminActivityLogs,
  clickEarnings,
  deposits,
  profiles,
  referralEarnings,
  referrals,
  systemSettings,
  ticketMessages,
  tickets,
  userLoginEvents,
  userNotifications,
  users,
  vipBonuses,
  wheelReferralBonuses,
  wheelSpins,
  withdrawals,
} from "@db/schema";

function ipFromRequest(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

export async function logAdminActivity(input: {
  adminUserId: number;
  action: string;
  targetType?: string;
  targetId?: number;
  details?: unknown;
  req?: Request;
}) {
  try {
    const db = getDb();
    await db.insert(adminActivityLogs).values({
      adminUserId: input.adminUserId,
      action: input.action,
      targetType: input.targetType || null,
      targetId: input.targetId || null,
      details: input.details === undefined ? null : JSON.stringify(input.details).slice(0, 6000),
      ipAddress: input.req ? ipFromRequest(input.req) : null,
      userAgent: input.req?.headers.get("user-agent") || null,
    });
  } catch (error) {
    console.warn("Admin log yazılamadı", error);
  }
}

function getRiskLabels(params: {
  amount: number;
  balance: number;
  investment: number;
  totalClicks: number;
  consecutiveClicks: number;
  joinDate?: Date | null;
  sameWalletCount: number;
}) {
  const labels: string[] = [];
  const daysSinceJoin = params.joinDate
    ? (Date.now() - params.joinDate.getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  if (daysSinceJoin < 7) labels.push("Yeni üye");
  if (params.amount >= 1000) labels.push("Yüksek tutar");
  if (params.sameWalletCount > 1) labels.push("Aynı cüzdan başka üyelerde var");
  if (params.totalClicks < 5) labels.push("Az tıklama geçmişi");
  if (params.consecutiveClicks < 5) labels.push("5 gün tıklama şartı eksik");
  if (params.investment <= 0) labels.push("Yatırım yok");
  if (params.balance > 0 && params.amount > params.balance * 0.8) labels.push("Bakiyenin çoğu çekiliyor");

  return labels;
}

export const adminSystemRouter = createRouter({
  publicMaintenance: publicQuery.query(async () => {
    const db = getDb();
    const setting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, "maintenance.enabled"),
    });
    return { enabled: setting?.value === "true" };
  }),

  overview: adminQuery.query(async () => {
    const db = getDb();
    const [allDeposits, allWithdrawals, allTickets, allUsers] = await Promise.all([
      db.query.deposits.findMany({ orderBy: [desc(deposits.createdAt)] }),
      db.query.withdrawals.findMany({ orderBy: [desc(withdrawals.createdAt)] }),
      db.query.tickets.findMany({ orderBy: [desc(tickets.createdAt)] }),
      db.query.users.findMany({ orderBy: [desc(users.createdAt)] }),
    ]);

    const now = Date.now();
    const newUsers24h = allUsers.filter((user) => now - user.createdAt.getTime() < 24 * 60 * 60 * 1000).length;

    return {
      notifications: [
        { type: "deposit", title: "Bekleyen yatırım", count: allDeposits.filter((item) => item.status === "pending").length },
        { type: "withdrawal", title: "Bekleyen çekim", count: allWithdrawals.filter((item) => item.status === "pending").length },
        { type: "ticket", title: "Açık destek talebi", count: allTickets.filter((item) => item.status === "open").length },
        { type: "user", title: "Son 24 saat yeni üye", count: newUsers24h },
      ],
    };
  }),

  analytics: adminQuery.query(async () => {
    const db = getDb();
    const [allUsers, allProfiles, allDeposits, allWithdrawals, allReferrals] = await Promise.all([
      db.query.users.findMany({ orderBy: [desc(users.createdAt)] }),
      db.query.profiles.findMany(),
      db.query.deposits.findMany(),
      db.query.withdrawals.findMany(),
      db.query.referrals.findMany(),
    ]);

    const dayMs = 24 * 60 * 60 * 1000;
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today.getTime() - (6 - index) * dayMs);
      const key = date.toISOString().slice(0, 10);
      return {
        key,
        label: date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
        deposits: 0,
        withdrawals: 0,
        users: 0,
      };
    });
    const dayMap = new Map(last7Days.map((item) => [item.key, item]));

    for (const deposit of allDeposits) {
      if (deposit.status !== "approved") continue;
      const row = dayMap.get(deposit.createdAt.toISOString().slice(0, 10));
      if (row) row.deposits += Number(deposit.amount);
    }
    for (const withdrawal of allWithdrawals) {
      if (withdrawal.status !== "approved") continue;
      const row = dayMap.get(withdrawal.createdAt.toISOString().slice(0, 10));
      if (row) row.withdrawals += Number(withdrawal.amount);
    }
    for (const user of allUsers) {
      const row = dayMap.get(user.createdAt.toISOString().slice(0, 10));
      if (row) row.users += 1;
    }

    const vipCounts = new Map<number, number>();
    for (const profile of allProfiles) {
      vipCounts.set(profile.vipLevel, (vipCounts.get(profile.vipLevel) ?? 0) + 1);
    }

    const topBalances = allProfiles
      .sort((a, b) => Number(b.balance) - Number(a.balance))
      .slice(0, 8)
      .map((profile) => ({
        userId: profile.userId,
        vipLevel: profile.vipLevel,
        balance: Number(profile.balance),
        investment: Number(profile.investment),
      }));

    const totals = {
      users: allUsers.length,
      activeUsers: allProfiles.filter((profile) => profile.totalClicks > 0).length,
      totalBalance: allProfiles.reduce((sum, profile) => sum + Number(profile.balance), 0),
      totalInvestment: allProfiles.reduce((sum, profile) => sum + Number(profile.investment), 0),
      approvedDeposits: allDeposits.filter((item) => item.status === "approved").reduce((sum, item) => sum + Number(item.amount), 0),
      approvedWithdrawals: allWithdrawals.filter((item) => item.status === "approved").reduce((sum, item) => sum + Number(item.amount), 0),
      pendingDeposits: allDeposits.filter((item) => item.status === "pending").length,
      pendingWithdrawals: allWithdrawals.filter((item) => item.status === "pending").length,
      referrals: allReferrals.length,
    };

    return {
      totals,
      daily: last7Days,
      vipDistribution: Array.from({ length: 7 }, (_, level) => ({
        level: `VIP ${level}`,
        count: vipCounts.get(level) ?? 0,
      })),
      topBalances,
    };
  }),

  withdrawalRisks: adminQuery.query(async () => {
    const db = getDb();
    const [allWithdrawals, allProfiles] = await Promise.all([
      db.query.withdrawals.findMany({ orderBy: [desc(withdrawals.createdAt)] }),
      db.query.profiles.findMany(),
    ]);
    const profileByUser = new Map(allProfiles.map((profile) => [profile.userId, profile]));
    const walletCounts = new Map<string, number>();
    for (const withdrawal of allWithdrawals) {
      walletCounts.set(withdrawal.wallet, (walletCounts.get(withdrawal.wallet) ?? 0) + 1);
    }

    return allWithdrawals.slice(0, 100).map((withdrawal) => {
      const profile = profileByUser.get(withdrawal.userId);
      const labels = getRiskLabels({
        amount: Number(withdrawal.amount),
        balance: Number(profile?.balance ?? 0),
        investment: Number(profile?.investment ?? 0),
        totalClicks: profile?.totalClicks ?? 0,
        consecutiveClicks: profile?.consecutiveClicks ?? 0,
        joinDate: profile?.joinDate,
        sameWalletCount: walletCounts.get(withdrawal.wallet) ?? 1,
      });

      return {
        id: withdrawal.id,
        userId: withdrawal.userId,
        amount: Number(withdrawal.amount),
        wallet: withdrawal.wallet,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
        riskScore: labels.length,
        labels,
      };
    });
  }),

  loginEvents: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: userLoginEvents.id,
        userId: userLoginEvents.userId,
        email: users.email,
        name: users.name,
        ipAddress: userLoginEvents.ipAddress,
        country: userLoginEvents.country,
        city: userLoginEvents.city,
        userAgent: userLoginEvents.userAgent,
        success: userLoginEvents.success,
        createdAt: userLoginEvents.createdAt,
      })
      .from(userLoginEvents)
      .leftJoin(users, eq(userLoginEvents.userId, users.id))
      .orderBy(desc(userLoginEvents.createdAt))
      .limit(100);
  }),

  clearLoginEvents: adminQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    await db.delete(userLoginEvents);
    await logAdminActivity({
      adminUserId: ctx.user.id,
      action: "login_events.cleared",
      targetType: "security",
      req: ctx.req,
    });
    return { success: true };
  }),

  userNotifications: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: userNotifications.id,
        userId: userNotifications.userId,
        email: users.email,
        name: users.name,
        title: userNotifications.title,
        message: userNotifications.message,
        type: userNotifications.type,
        readAt: userNotifications.readAt,
        createdAt: userNotifications.createdAt,
      })
      .from(userNotifications)
      .leftJoin(users, eq(userNotifications.userId, users.id))
      .orderBy(desc(userNotifications.createdAt))
      .limit(100);
  }),

  sendNotification: adminQuery
    .input(z.object({
      targetUserId: z.number().int().positive().optional(),
      title: z.string().min(2).max(160),
      message: z.string().min(2).max(2000),
      type: z.enum(["info", "success", "warning"]).default("info"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const targetUsers = input.targetUserId
        ? await db.query.users.findMany({ where: or(eq(users.id, input.targetUserId), eq(users.publicId, input.targetUserId)) })
        : await db.query.users.findMany({ where: eq(users.role, "user") });

      if (targetUsers.length === 0) {
        return { success: false, count: 0 };
      }

      await db.insert(userNotifications).values(targetUsers.map((user) => ({
        userId: user.id,
        title: input.title,
        message: input.message,
        type: input.type,
        createdBy: ctx.user.id,
      })));

      await logAdminActivity({
        adminUserId: ctx.user.id,
        action: "notification.sent",
        targetType: input.targetUserId ? "user" : "all_users",
        targetId: input.targetUserId,
        details: { title: input.title, count: targetUsers.length },
        req: ctx.req,
      });

      return { success: true, count: targetUsers.length };
    }),

  logs: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: adminActivityLogs.id,
        adminUserId: adminActivityLogs.adminUserId,
        adminEmail: users.email,
        action: adminActivityLogs.action,
        targetType: adminActivityLogs.targetType,
        targetId: adminActivityLogs.targetId,
        details: adminActivityLogs.details,
        ipAddress: adminActivityLogs.ipAddress,
        userAgent: adminActivityLogs.userAgent,
        createdAt: adminActivityLogs.createdAt,
      })
      .from(adminActivityLogs)
      .leftJoin(users, eq(adminActivityLogs.adminUserId, users.id))
      .orderBy(desc(adminActivityLogs.createdAt))
      .limit(150);
  }),

  maintenance: adminQuery.query(async () => {
    const db = getDb();
    const setting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, "maintenance.enabled"),
    });
    return { enabled: setting?.value === "true", updatedAt: setting?.updatedAt ?? null };
  }),

  setMaintenance: adminQuery
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, "maintenance.enabled"),
      });
      if (existing) {
        await db.update(systemSettings).set({ value: String(input.enabled), updatedBy: ctx.user.id }).where(eq(systemSettings.key, "maintenance.enabled"));
      } else {
        await db.insert(systemSettings).values({ key: "maintenance.enabled", value: String(input.enabled), updatedBy: ctx.user.id });
      }
      await logAdminActivity({
        adminUserId: ctx.user.id,
        action: input.enabled ? "maintenance.enabled" : "maintenance.disabled",
        targetType: "system",
        details: { enabled: input.enabled },
        req: ctx.req,
      });
      return { success: true };
    }),

  backup: adminQuery.query(async ({ ctx }) => {
    const db = getDb();
    await logAdminActivity({
      adminUserId: ctx.user.id,
      action: "backup.download",
      targetType: "system",
      req: ctx.req,
    });
    return {
      generatedAt: new Date().toISOString(),
      users: await db.select().from(users),
      profiles: await db.select().from(profiles),
      deposits: await db.select().from(deposits),
      clickEarnings: await db.select().from(clickEarnings),
      withdrawals: await db.select().from(withdrawals),
      referrals: await db.select().from(referrals),
      referralEarnings: await db.select().from(referralEarnings),
      tickets: await db.select().from(tickets),
      ticketMessages: await db.select().from(ticketMessages),
      wheelSpins: await db.select().from(wheelSpins),
      wheelReferralBonuses: await db.select().from(wheelReferralBonuses),
      vipBonuses: await db.select().from(vipBonuses),
      userNotifications: await db.select().from(userNotifications),
    };
  }),
});
