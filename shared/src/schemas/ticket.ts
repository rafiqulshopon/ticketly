import { z } from "zod";

/** Mirrors the Postgres enums in api/prisma/schema.prisma — keep in sync. */
export const ticketStatusEnum = z.enum([
  "OPEN",
  "AWAITING_STUDENT",
  "RESOLVED",
  "CLOSED",
]);

export const ticketCategoryEnum = z.enum([
  "GENERAL_QUESTION",
  "TECHNICAL_QUESTION",
  "REFUND_REQUEST",
  "SPAM",
]);

export const priorityEnum = z.enum(["LOW", "NORMAL", "HIGH"]);

export const ticketSchema = z.object({
  id: z.string().uuid(),
  subject: z.string(),
  status: ticketStatusEnum,
  category: ticketCategoryEnum,
  priority: priorityEnum,
  requesterEmail: z.string().email(),
  requesterName: z.string().nullable(),
  assigneeId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Ticket = z.infer<typeof ticketSchema>;

/** Inbound payload shape for listing/filtering tickets (Phase 2). */
export const listTicketsQuerySchema = z.object({
  status: ticketStatusEnum.optional(),
  category: ticketCategoryEnum.optional(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
