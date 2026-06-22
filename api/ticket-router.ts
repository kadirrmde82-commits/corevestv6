import { z } from "zod";
import { eq, desc, and, gte } from "drizzle-orm";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { tickets, ticketMessages } from "@db/schema";

export const ticketRouter = createRouter({
  // Create a new support ticket
  create: authedQuery
    .input(z.object({ subject: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Check 24h limit
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentTickets = await db.query.tickets.findMany({
        where: and(
          eq(tickets.userId, ctx.user.id),
          gte(tickets.createdAt, twentyFourHoursAgo)
        ),
      });
      if (recentTickets.length > 0) {
        throw new Error("You can only create one ticket per 24 hours");
      }

      const result = await db.insert(tickets).values({
        userId: ctx.user.id,
        subject: input.subject,
      });
      const ticketId = Number(result[0].insertId);

      // Add initial message
      await db.insert(ticketMessages).values({
        ticketId,
        sender: "user",
        text: input.subject,
      });

      return { id: ticketId };
    }),

  // List current user's tickets with messages
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userTickets = await db.query.tickets.findMany({
      where: eq(tickets.userId, ctx.user.id),
      orderBy: [desc(tickets.createdAt)],
    });

    // Fetch messages for each ticket
    const ticketsWithMessages = await Promise.all(
      userTickets.map(async (ticket) => {
        const messages = await db.query.ticketMessages.findMany({
          where: eq(ticketMessages.ticketId, ticket.id),
          orderBy: [ticketMessages.createdAt],
        });
        return {
          ...ticket,
          messages: messages.map((m) => ({
            sender: m.sender,
            text: m.text,
            time: m.createdAt.toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })),
        };
      })
    );

    return ticketsWithMessages;
  }),

  // Add a message to a ticket
  addMessage: authedQuery
    .input(
      z.object({
        ticketId: z.number(),
        text: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verify ticket belongs to user
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, input.ticketId),
      });
      if (!ticket) throw new Error("Ticket not found");
      if (ticket.userId !== ctx.user.id) {
        // Allow admins to send messages via admin router
        throw new Error("Unauthorized");
      }
      if (ticket.status === "closed") {
        throw new Error("Ticket is closed");
      }

      await db.insert(ticketMessages).values({
        ticketId: input.ticketId,
        sender: "user",
        text: input.text,
      });

      return { success: true };
    }),

  // Close a ticket
  close: authedQuery
    .input(z.object({ ticketId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, input.ticketId),
      });
      if (!ticket || ticket.userId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      await db
        .update(tickets)
        .set({ status: "closed" })
        .where(eq(tickets.id, input.ticketId));

      return { success: true };
    }),

  // ─── Admin Only ───

  // List all tickets with user info (admin)
  listAll: adminQuery.query(async () => {
    const db = getDb();
    const allTickets = await db.query.tickets.findMany({
      orderBy: [desc(tickets.createdAt)],
      with: {
        user: true,
      },
    });

    const ticketsWithMessages = await Promise.all(
      allTickets.map(async (ticket) => {
        const messages = await db.query.ticketMessages.findMany({
          where: eq(ticketMessages.ticketId, ticket.id),
          orderBy: [ticketMessages.createdAt],
        });
        return {
          ...ticket,
          userEmail: ticket.user?.email || "unknown",
          messages: messages.map((m) => ({
            sender: m.sender,
            text: m.text,
            time: m.createdAt.toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })),
        };
      })
    );

    return ticketsWithMessages;
  }),

  // Admin reply to a ticket
  adminReply: adminQuery
    .input(
      z.object({
        ticketId: z.number(),
        text: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, input.ticketId),
      });
      if (!ticket) throw new Error("Ticket not found");
      if (ticket.status === "closed") throw new Error("Ticket is closed");

      await db.insert(ticketMessages).values({
        ticketId: input.ticketId,
        sender: "admin",
        text: input.text,
      });

      return { success: true };
    }),

  // Resolve a ticket (admin)
  resolve: adminQuery
    .input(z.object({ ticketId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(tickets)
        .set({ status: "resolved" })
        .where(eq(tickets.id, input.ticketId));
      return { success: true };
    }),

  // Close a ticket (admin)
  adminClose: adminQuery
    .input(z.object({ ticketId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(tickets)
        .set({ status: "closed" })
        .where(eq(tickets.id, input.ticketId));
      return { success: true };
    }),

  // Delete a ticket (admin) - removes ticket and its messages
  delete: adminQuery
    .input(z.object({ ticketId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Delete messages first (foreign key constraint)
      await db
        .delete(ticketMessages)
        .where(eq(ticketMessages.ticketId, input.ticketId));
      // Delete ticket
      await db
        .delete(tickets)
        .where(eq(tickets.id, input.ticketId));
      return { success: true };
    }),
});
