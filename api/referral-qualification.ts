import { and, eq, sql } from "drizzle-orm";
import { deposits, referrals } from "@db/schema";
import { getDb } from "./queries/connection";

export async function getQualifiedTier1ReferralCount(userId: number) {
  const db = getDb();
  const qualifiedRows = await db
    .select({
      referredUserId: referrals.referredUserId,
      totalApproved: sql<string>`COALESCE(SUM(${deposits.amount}), 0)`,
    })
    .from(referrals)
    .innerJoin(
      deposits,
      and(eq(deposits.userId, referrals.referredUserId), eq(deposits.status, "approved"))
    )
    .where(and(eq(referrals.referrerUserId, userId), eq(referrals.tier, 1)))
    .groupBy(referrals.referredUserId)
    .having(sql`COALESCE(SUM(${deposits.amount}), 0) >= 100`);

  return qualifiedRows.length;
}
