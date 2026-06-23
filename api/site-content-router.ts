import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { createRouter, adminQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { siteContent } from "@db/schema";
import { DEFAULT_SITE_CONTENT, mergeSiteContent } from "@contracts/site-content";

const editableKeys = Object.keys(DEFAULT_SITE_CONTENT);

async function loadSiteContent() {
  const db = getDb();
  const rows = await db
    .select()
    .from(siteContent)
    .where(inArray(siteContent.key, editableKeys));

  return mergeSiteContent(Object.fromEntries(rows.map((row) => [row.key, row.value])));
}

export const siteContentRouter = createRouter({
  public: publicQuery.query(async () => {
    return loadSiteContent();
  }),

  adminList: adminQuery.query(async () => {
    return loadSiteContent();
  }),

  updateMany: adminQuery
    .input(
      z.object({
        values: z.record(z.enum(editableKeys as [string, ...string[]]), z.string().max(5000)),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      for (const [key, value] of Object.entries(input.values)) {
        const existing = await db.query.siteContent.findFirst({
          where: (fields, { eq }) => eq(fields.key, key),
        });

        if (existing) {
          await db.update(siteContent).set({ value }).where(eq(siteContent.key, key));
        } else {
          await db.insert(siteContent).values({ key, value });
        }
      }

      return { success: true };
    }),
});
