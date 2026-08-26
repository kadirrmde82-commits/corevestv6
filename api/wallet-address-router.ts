import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { walletAddresses } from "../db/schema";
import { sql } from "drizzle-orm";

let walletAddressesTablePromise: Promise<void> | null = null;
let publicWalletAddressCache: Array<typeof walletAddresses.$inferSelect> | null = null;
let publicWalletAddressCacheExpiresAt = 0;
const PUBLIC_WALLET_CACHE_MS = 30_000;

function clearPublicWalletAddressCache() {
  publicWalletAddressCache = null;
  publicWalletAddressCacheExpiresAt = 0;
}

async function runWalletAddressesTableCheck() {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wallet_addresses (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`key\` varchar(16) NOT NULL,
      \`label\` varchar(64) NOT NULL,
      \`address\` varchar(128) NOT NULL,
      \`color\` varchar(16) NOT NULL,
      \`active\` int NOT NULL DEFAULT 1,
      \`sortOrder\` int NOT NULL DEFAULT 0,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`wallet_addresses_key_unique\` (\`key\`)
    )
  `);
}

async function ensureWalletAddressesTable() {
  if (!walletAddressesTablePromise) {
    walletAddressesTablePromise = runWalletAddressesTableCheck().catch((error) => {
      walletAddressesTablePromise = null;
      throw error;
    });
  }
  return walletAddressesTablePromise;
}

export const walletAddressRouter = createRouter({
  // Public: list active wallet addresses
  list: publicQuery.query(async () => {
    if (publicWalletAddressCache && Date.now() < publicWalletAddressCacheExpiresAt) {
      return publicWalletAddressCache;
    }

    // The table is created during awaited application startup. Avoid repeating
    // a schema check on the first customer request after every deployment.
    const db = getDb();
    const activeRows = await db
      .select()
      .from(walletAddresses)
      .where(eq(walletAddresses.active, 1))
      .orderBy(asc(walletAddresses.sortOrder));

    if (activeRows.length > 0) {
      publicWalletAddressCache = activeRows;
      publicWalletAddressCacheExpiresAt = Date.now() + PUBLIC_WALLET_CACHE_MS;
      return activeRows;
    }

    const allRows = await db
      .select()
      .from(walletAddresses)
      .orderBy(asc(walletAddresses.sortOrder));
    publicWalletAddressCache = allRows;
    publicWalletAddressCacheExpiresAt = Date.now() + PUBLIC_WALLET_CACHE_MS;
    return allRows;
  }),

  // Admin: list all
  listAll: adminQuery.query(async () => {
    await ensureWalletAddressesTable();
    const db = getDb();
    return db
      .select()
      .from(walletAddresses)
      .orderBy(asc(walletAddresses.sortOrder));
  }),

  // Admin: create
  create: adminQuery
    .input(
      z.object({
        key: z.string().min(1).max(16),
        label: z.string().min(1).max(64),
        address: z.string().min(1).max(128),
        color: z.string().min(1).max(16),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input }) => {
      await ensureWalletAddressesTable();
      const db = getDb();
      await db.insert(walletAddresses).values({
        key: input.key.toLowerCase(),
        label: input.label,
        address: input.address,
        color: input.color,
        active: 1,
        sortOrder: input.sortOrder,
      });
      clearPublicWalletAddressCache();
      return { success: true };
    }),

  // Admin: update
  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        key: z.string().min(1).max(16).optional(),
        label: z.string().min(1).max(64).optional(),
        address: z.string().min(1).max(128).optional(),
        color: z.string().min(1).max(16).optional(),
        active: z.number().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await ensureWalletAddressesTable();
      const db = getDb();
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      if (data.key !== undefined) updateData.key = data.key.toLowerCase();
      if (data.label !== undefined) updateData.label = data.label;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.active !== undefined) updateData.active = data.active;
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

      await db
        .update(walletAddresses)
        .set(updateData)
        .where(eq(walletAddresses.id, id));
      clearPublicWalletAddressCache();
      return { success: true };
    }),

  // Admin: delete
  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await ensureWalletAddressesTable();
      const db = getDb();
      await db.delete(walletAddresses).where(eq(walletAddresses.id, input.id));
      clearPublicWalletAddressCache();
      return { success: true };
    }),
});
