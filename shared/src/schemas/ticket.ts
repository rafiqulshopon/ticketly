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
  id: z.number().int(),
  subject: z.string(),
  status: ticketStatusEnum,
  category: ticketCategoryEnum.nullable(),
  priority: priorityEnum,
  requesterEmail: z.string().email(),
  requesterName: z.string(),
  assigneeId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Ticket = z.infer<typeof ticketSchema>;

/**
 * Input for creating a ticket from an inbound request (email-like). Drives the
 * POST /tickets body parse. `status`/`priority` are not part of the payload —
 * they fall back to the Prisma defaults (OPEN / NORMAL). `category` is optional
 * and stored as null when omitted (it is assigned later by the AI classify step,
 * so the column has no default). `requesterName` is required.
 * The SendGrid Inbound Parse webhook (Phase 3) will populate the same fields
 * after parsing the raw MIME; messageId/inReplyTo are filled in there, not here.
 */
export const createTicketSchema = z.object({
  requesterEmail: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email")
    .refine((value) => !/\s/.test(value), { message: "Email cannot contain spaces" }),
  requesterName: z.string().trim().min(1, "Name is required"),
  subject: z.string().trim().min(1, "Subject is required"),
  bodyText: z.string().min(1, "Body is required"),
  bodyHtml: z.string().optional(),
  category: ticketCategoryEnum.optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

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
