import { eq } from "drizzle-orm";
import { profiles, users } from "@db/schema";
import { env } from "./lib/env";
import { hashPassword } from "./local-auth";
import { getDb } from "./queries/connection";
import { backfillMemberIds, createUniqueMemberId } from "./member-id";

function referralCode() {
  return `CV${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

export async function ensureAdminAccount() {
  const db = getDb();
  const email = env.adminEmail.toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (existing) {
    await db
      .update(users)
      .set({ role: "admin", passwordHash: hashPassword(env.adminPassword) })
      .where(eq(users.id, existing.id));
    await backfillMemberIds();
    return;
  }

  const result = await db.insert(users).values({
    email,
    publicId: await createUniqueMemberId(),
    passwordHash: hashPassword(env.adminPassword),
    name: "Admin",
    role: "admin",
  });
  await backfillMemberIds();
  await db.insert(profiles).values({
    userId: Number(result[0].insertId),
    referralCode: referralCode(),
    balance: "0.00",
  });
  console.log(`Admin hesabı oluşturuldu: ${email}`);
}
