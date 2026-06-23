import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  decimal,
  bigint,
  longtext,
} from "drizzle-orm/mysql-core";

// ─── Users (OAuth + Local Auth unified) ───
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  // Public-facing member number. Internal relations continue using `id`.
  publicId: int("publicId"),
  // OAuth fields (nullable for local users)
  unionId: varchar("unionId", { length: 255 }).unique(),
  // Local auth fields (nullable for OAuth users)
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  // Common fields
  name: varchar("name", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Corevest User Profiles ───
export const profiles = mysqlTable("profiles", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .unique(),
  vipLevel: int("vipLevel").default(0).notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("5.00").notNull(),
  investment: decimal("investment", { precision: 12, scale: 2 }).default("0.00").notNull(),
  referralCode: varchar("referralCode", { length: 16 }).notNull().unique(),
  referredBy: varchar("referredBy", { length: 16 }),
  totalEarned: decimal("totalEarned", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalClicks: int("totalClicks").default(0).notNull(),
  consecutiveClicks: int("consecutiveClicks").default(0).notNull(),
  lastWithdrawalAt: timestamp("lastWithdrawalAt"),
  monthlyWithdrawalCount: int("monthlyWithdrawalCount").default(0).notNull(),
  lastWithdrawalResetAt: timestamp("lastWithdrawalResetAt"),
  joinDate: timestamp("joinDate").defaultNow().notNull(),
  lastClickAt: timestamp("lastClickAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

// ─── Deposits ───
export const deposits = mysqlTable("deposits", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  txid: varchar("txid", { length: 64 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  cryptoType: mysqlEnum("cryptoType", ["trc20", "sol", "trx", "eth"]).default("trc20").notNull(),
  userNote: varchar("userNote", { length: 255 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Deposit = typeof deposits.$inferSelect;
export type InsertDeposit = typeof deposits.$inferInsert;

// ─── Withdrawals ───
export const withdrawals = mysqlTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  wallet: varchar("wallet", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = typeof withdrawals.$inferInsert;

// ─── Support Tickets ───
export const tickets = mysqlTable("tickets", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["open", "resolved", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;

// ─── Ticket Messages ───
export const ticketMessages = mysqlTable("ticket_messages", {
  id: serial("id").primaryKey(),
  ticketId: bigint("ticketId", { mode: "number", unsigned: true }).notNull(),
  sender: mysqlEnum("sender", ["user", "admin"]).notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TicketMessage = typeof ticketMessages.$inferSelect;
export type InsertTicketMessage = typeof tickets.$inferInsert;

// ─── Referrals ───
export const referrals = mysqlTable("referrals", {
  id: serial("id").primaryKey(),
  referrerUserId: bigint("referrerUserId", { mode: "number", unsigned: true }).notNull(),
  referredUserId: bigint("referredUserId", { mode: "number", unsigned: true }).notNull(),
  tier: int("tier").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// ─── Wheel Spins ───
export const wheelSpins = mysqlTable("wheel_spins", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  prize: decimal("prize", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WheelSpin = typeof wheelSpins.$inferSelect;
export type InsertWheelSpin = typeof wheelSpins.$inferInsert;

// ─── Wheel Referral Bonuses ───
// Tracks bonus spins earned when tier-1 referrals deposit $100+
export const wheelReferralBonuses = mysqlTable("wheel_referral_bonuses", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  referredUserId: bigint("referredUserId", { mode: "number", unsigned: true }).notNull(),
  investmentAmount: decimal("investmentAmount", { precision: 12, scale: 2 }).notNull(),
  spinsEarned: int("spinsEarned").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WheelReferralBonus = typeof wheelReferralBonuses.$inferSelect;
export type InsertWheelReferralBonus = typeof wheelReferralBonuses.$inferInsert;

// ─── Market Prices (Admin-managed) ───
export const vipBonuses = mysqlTable("vip_bonuses", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  vipLevel: int("vipLevel").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VipBonus = typeof vipBonuses.$inferSelect;
export type InsertVipBonus = typeof vipBonuses.$inferInsert;

export const marketPrices = mysqlTable("market_prices", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 16 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  basePrice: decimal("basePrice", { precision: 18, scale: 8 }).notNull(),
  change: decimal("change", { precision: 8, scale: 2 }).notNull(),
  color: varchar("color", { length: 16 }).notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type MarketPrice = typeof marketPrices.$inferSelect;
export type InsertMarketPrice = typeof marketPrices.$inferInsert;

// ─── Wallet Addresses (Admin-managed crypto addresses) ───
export const walletAddresses = mysqlTable("wallet_addresses", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 16 }).notNull().unique(),
  label: varchar("label", { length: 64 }).notNull(),
  address: varchar("address", { length: 128 }).notNull(),
  color: varchar("color", { length: 16 }).notNull(),
  active: int("active").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type WalletAddress = typeof walletAddresses.$inferSelect;
export type InsertWalletAddress = typeof walletAddresses.$inferInsert;

// ─── Editable Site Content ───
export const siteContent = mysqlTable("site_content", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: longtext("value").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type SiteContent = typeof siteContent.$inferSelect;
export type InsertSiteContent = typeof siteContent.$inferInsert;

// ─── Uploaded Site Assets ───
export const siteAssets = mysqlTable("site_assets", {
  key: varchar("key", { length: 64 }).primaryKey(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  data: longtext("data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type SiteAsset = typeof siteAssets.$inferSelect;
export type InsertSiteAsset = typeof siteAssets.$inferInsert;

// ─── Referral Earnings ───
// Tracks commission earnings from referral clicks (tier 1: 10%, tier 2: 6%, tier 3: 3%)
export const referralEarnings = mysqlTable("referral_earnings", {
  id: serial("id").primaryKey(),
  referrerUserId: bigint("referrerUserId", { mode: "number", unsigned: true }).notNull(),
  referredUserId: bigint("referredUserId", { mode: "number", unsigned: true }).notNull(),
  tier: int("tier").notNull(),
  clickEarning: decimal("clickEarning", { precision: 12, scale: 2 }).notNull(),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: decimal("commissionAmount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReferralEarning = typeof referralEarnings.$inferSelect;
export type InsertReferralEarning = typeof referralEarnings.$inferInsert;
