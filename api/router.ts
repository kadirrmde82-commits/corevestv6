import { authRouter } from "./auth-router";
import { localAuthRouter } from "./local-auth-router";
import { profileRouter } from "./profile-router";
import { depositRouter } from "./deposit-router";
import { withdrawalRouter } from "./withdrawal-router";
import { ticketRouter } from "./ticket-router";
import { referralRouter } from "./referral-router";
import { clickRouter } from "./click-router";
import { wheelRouter } from "./wheel-router";
import { adminMemberRouter } from "./admin-member-router";
import { marketPriceRouter } from "./market-price-router";
import { walletAddressRouter } from "./wallet-address-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  localAuth: localAuthRouter,
  profile: profileRouter,
  deposit: depositRouter,
  withdrawal: withdrawalRouter,
  ticket: ticketRouter,
  referral: referralRouter,
  click: clickRouter,
  wheel: wheelRouter,
  adminMember: adminMemberRouter,
  marketPrice: marketPriceRouter,
  walletAddress: walletAddressRouter,
});

export type AppRouter = typeof appRouter;
