import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createRouter, adminQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  adminActivityLogs,
  deposits,
  profiles,
  referralEarnings,
  referrals,
  systemSettings,
  ticketMessages,
  tickets,
  userLoginEvents,
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
        userAgent: userLoginEvents.userAgent,
        success: userLoginEvents.success,
        createdAt: userLoginEvents.createdAt,
      })
      .from(userLoginEvents)
      .leftJoin(users, eq(userLoginEvents.userId, users.id))
      .orderBy(desc(userLoginEvents.createdAt))
      .limit(100);
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
      withdrawals: await db.select().from(withdrawals),
      referrals: await db.select().from(referrals),
      referralEarnings: await db.select().from(referralEarnings),
      tickets: await db.select().from(tickets),
      ticketMessages: await db.select().from(ticketMessages),
      wheelSpins: await db.select().from(wheelSpins),
      wheelReferralBonuses: await db.select().from(wheelReferralBonuses),
      vipBonuses: await db.select().from(vipBonuses),
    };
  }),
});
