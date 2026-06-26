import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, profiles, referrals, userLoginEvents } from "@db/schema";
import {
  hashPassword,
  verifyPassword,
  signLocalToken,
  authenticateLocalRequest,
} from "./local-auth";
import { createUniqueMemberId } from "./member-id";

function generateReferralCode(): string {
  return "CV" + Math.random().toString(36).substring(2, 7).toUpperCase();
}

function ipFromRequest(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

function headerText(req: Request, names: string[]) {
  for (const name of names) {
    const value = req.headers.get(name);
    if (value) return decodeURIComponent(value);
  }
  return null;
}

function isPublicIp(ip: string) {
  if (!ip || ip === "unknown" || ip === "::1" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return false;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return false;
  return true;
}

async function getGeoFromRequest(req: Request, ip: string) {
  const headerCountry = headerText(req, ["cf-ipcountry", "x-vercel-ip-country"]);
  const headerCity = headerText(req, ["x-vercel-ip-city"]);
  if (headerCountry || headerCity) {
    return { country: headerCountry, city: headerCity };
  }

  if (!isPublicIp(ip)) return { country: null, city: null };

  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { accept: "application/json", "user-agent": "CoreVest login geo" },
      signal: AbortSignal.timeout(1200),
    });
    if (!response.ok) return { country: null, city: null };
    const data = await response.json() as { country_name?: string; country?: string; city?: string };
    return {
      country: data.country_name || data.country || null,
      city: data.city || null,
    };
  } catch {
    return { country: null, city: null };
  }
}

export const localAuthRouter = createRouter({
  // Register a new local user
  register: publicQuery
    .input(
      z.object({
        email: z.string().email().min(1),
        password: z.string().min(6),
        name: z.string().optional(),
        referralCode: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Check if email already exists
      const existing = await db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email is already registered.",
        });
      }

      const normalizedReferralCode = input.referralCode?.trim().toUpperCase();
      const directReferrer = normalizedReferralCode ? await db.query.profiles.findFirst({
        where: eq(profiles.referralCode, normalizedReferralCode),
      }) : null;
      if (normalizedReferralCode && !directReferrer) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Referans kodu bulunamadı. Lütfen kontrol edip tekrar deneyin.",
        });
      }

      // Create user
      const passwordHash = hashPassword(input.password);
      const result = await db.insert(users).values({
        publicId: await createUniqueMemberId(),
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name || input.email.split("@")[0],
        role: "user",
      });
      const userId = Number(result[0].insertId);

      // Create profile with $5 balance and unique referral code
      const code = generateReferralCode();
      await db.insert(profiles).values({
        userId,
        referralCode: code,
        balance: "5.00",
        referredBy: normalizedReferralCode || null,
      });

      if (normalizedReferralCode && directReferrer) {
        if (!directReferrer || directReferrer.userId === userId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Referans kodu bulunamadı. Lütfen kontrol edip tekrar deneyin.",
          });
        }

        const chain: { referrerId: number; tier: number }[] = [
          { referrerId: directReferrer.userId, tier: 1 },
        ];
        const tier2Record = await db.query.referrals.findFirst({
          where: eq(referrals.referredUserId, directReferrer.userId),
        });
        if (tier2Record) {
          chain.push({ referrerId: tier2Record.referrerUserId, tier: 2 });
          const tier3Record = await db.query.referrals.findFirst({
            where: eq(referrals.referredUserId, tier2Record.referrerUserId),
          });
          if (tier3Record) {
            chain.push({ referrerId: tier3Record.referrerUserId, tier: 3 });
          }
        }

        for (const link of chain) {
          await db.insert(referrals).values({
            referrerUserId: link.referrerId,
            referredUserId: userId,
            tier: link.tier,
          });
        }
      }

      // Generate token
      const token = await signLocalToken(userId);

      return {
        success: true,
        token,
        user: {
          id: userId,
          publicId: (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.publicId,
          email: input.email.toLowerCase(),
          name: input.name || input.email.split("@")[0],
        },
      };
    }),

  // Login with email/password
  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const user = await db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      if (!verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      // Update last sign in
      await db
        .update(users)
        .set({ lastSignInAt: new Date() })
        .where(eq(users.id, user.id));

      const ipAddress = ipFromRequest(ctx.req);
      const geo = await getGeoFromRequest(ctx.req, ipAddress);
      await db.insert(userLoginEvents).values({
        userId: user.id,
        ipAddress,
        country: geo.country,
        city: geo.city,
        userAgent: ctx.req.headers.get("user-agent") || null,
        success: 1,
      });

      const token = await signLocalToken(user.id);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          publicId: user.publicId,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }),

  // Check if a token is valid (used by frontend on load)
  me: publicQuery.query(async ({ ctx }) => {
    const user = await authenticateLocalRequest(ctx.req.headers);
    if (!user) return null;
    return {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }),
});
