import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, profiles } from "@db/schema";
import {
  hashPassword,
  verifyPassword,
  signLocalToken,
  authenticateLocalRequest,
} from "./local-auth";

function generateReferralCode(): string {
  return "CV" + Math.random().toString(36).substring(2, 7).toUpperCase();
}

export const localAuthRouter = createRouter({
  // Register a new local user
  register: publicQuery
    .input(
      z.object({
        email: z.string().email().min(1),
        password: z.string().min(6),
        name: z.string().optional(),
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

      // Create user
      const passwordHash = hashPassword(input.password);
      const result = await db.insert(users).values({
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
      });

      // Generate token
      const token = await signLocalToken(userId);

      return {
        success: true,
        token,
        user: {
          id: userId,
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
    .mutation(async ({ input }) => {
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

      const token = await signLocalToken(user.id);

      return {
        success: true,
        token,
        user: {
          id: user.id,
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
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }),
});
