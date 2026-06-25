import { and, desc, eq } from "drizzle-orm";
import { deposits, referrals } from "@db/schema";
import { getDb } from "./queries/connection";

export async function getQualifiedTier1ReferralCount(userId: number) {
  const db = getDb();
  const directReferrals = await db.query.referrals.findMany({
    where: and(eq(referrals.referrerUserId, userId), eq(referrals.tier, 1)),
    orderBy: [desc(referrals.createdAt)],
  });

  let qualifiedCount = 0;
  for (const referral of directReferrals) {
    const approvedDeposits = await db.query.deposits.findMany({
      where: and(eq(deposits.userId, referral.referredUserId), eq(deposits.status, "approved")),
    });
    const totalApproved = approvedDeposits.reduce((sum, deposit) => sum + Number(deposit.amount), 0);
    if (totalApproved >= 100) qualifiedCount += 1;
  }

  return qualifiedCount;
}
