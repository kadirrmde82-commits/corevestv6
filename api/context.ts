import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { authenticateLocalRequest, verifyLocalToken } from "./local-auth";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };

  // 1. Try header-based local auth (from frontend localStorage)
  try {
    const localToken = opts.req.headers.get("x-local-auth-token");
    if (localToken) {
      const claim = await verifyLocalToken(localToken);
      if (claim) {
        const db = getDb();
        const user = await db.query.users.findFirst({
          where: eq(users.id, claim.userId),
        });
        if (user) {
          ctx.user = user ?? undefined;
          return ctx;
        }
      }
    }
  } catch {
    // Header auth failed
  }

  // 2. Try cookie-based local auth
  if (!ctx.user) {
    try {
      const localUser = await authenticateLocalRequest(opts.req.headers);
      ctx.user = localUser ?? undefined;
    } catch {
      // Local cookie auth failed
    }
  }

  return ctx;
}
