import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { users } from "@db/schema";
import { getDb } from "./queries/connection";

export async function createUniqueMemberId(): Promise<number> {
  const db = getDb();
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = randomInt(10_000, 1_000_000);
    const existing = await db.query.users.findFirst({
      where: eq(users.publicId, candidate),
      columns: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error("Benzersiz üye ID'si oluşturulamadı.");
}

export async function backfillMemberIds(): Promise<void> {
  const db = getDb();
  const members = await db.query.users.findMany({
    columns: { id: true, publicId: true },
  });

  for (const member of members) {
    if (member.publicId !== null) continue;
    await db
      .update(users)
      .set({ publicId: await createUniqueMemberId() })
      .where(eq(users.id, member.id));
  }
}
