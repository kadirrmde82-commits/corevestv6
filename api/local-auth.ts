// Local email/password authentication
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import * as cookie from "cookie";
import * as jose from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";

const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.APP_SECRET || "corevest-local-auth-secret-key-2024"
);

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, salt, hash] = stored.split(":");
  if (algorithm === "scrypt" && salt && hash) {
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  // Eski SHA-256 kayıtlarıyla geriye dönük uyumluluk.
  const [legacySalt, legacyHash] = stored.split(":");
  if (!legacySalt || !legacyHash) return false;
  const check = createHash("sha256").update(password + legacySalt).digest("hex");
  return check === legacyHash;
}

export async function signLocalToken(userId: number): Promise<string> {
  return new jose.SignJWT({ userId, type: "local" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET_KEY);
}

export async function verifyLocalToken(
  token: string
): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET_KEY, {
      clockTolerance: 60,
    });
    if (payload.type !== "local" || typeof payload.userId !== "number") {
      return null;
    }
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export async function authenticateLocalRequest(headers: Headers) {
  const cookies = cookie.parse(headers.get("cookie") || "");
  const token = cookies["local_session"];
  if (!token) return null;

  const claim = await verifyLocalToken(token);
  if (!claim) return null;

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, claim.userId),
  });
  return user || null;
}
