import { z } from "zod";
import { userRoleEnum } from "./user";

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
  q: z
    .string()
    .trim()
    .optional(),
  status: ticketStatusEnum.optional(),
  category: ticketCategoryEnum.optional(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().optional(),
  // Sortable columns are a closed enum — the values are the column ids everywhere
  // (TanStack column id, the wire param, and the backend Prisma field name).
  // Priority/category/id are intentionally excluded (alphabetical enum sort is
  // misleading); severity-weighted priority sort is a separate future task.
  sortBy: z.enum(["createdAt", "subject", "requesterName", "status"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

/**
 * Ticket list wire shape. Timestamps are ISO strings (Nest serializes `Date` →
 * ISO); the web consumes these as types only, mirroring `userListItemSchema`.
 */
export const ticketListItemSchema = z.object({
  id: z.number().int(),
  subject: z.string(),
  status: ticketStatusEnum,
  category: ticketCategoryEnum.nullable(),
  priority: priorityEnum,
  requesterEmail: z.string(),
  requesterName: z.string(),
  assigneeId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ticketListResponseSchema = z.object({
  items: z.array(ticketListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type TicketListItem = z.infer<typeof ticketListItemSchema>;
export type TicketListResponse = z.infer<typeof ticketListResponseSchema>;

/** Direction of a message relative to the support inbox. The Prisma column is a
 *  plain `String`; this enum constrains the known values (written by the create
 *  path). */
export const messageDirectionEnum = z.enum(["inbound", "outbound"]);

/** A single message in a ticket's conversation thread. `senderName` is the
 *  staff agent for outbound replies (resolved from the `sender` relation) and
 *  null for inbound messages, where the author is the external `fromEmail`.
 *  Only `bodyText` is surfaced — `bodyHtml` is untrusted email HTML and is
 *  omitted to avoid XSS. Timestamps are ISO strings. */
export const ticketMessageSchema = z.object({
  id: z.string(),
  direction: messageDirectionEnum,
  fromEmail: z.string(),
  toEmail: z.string(),
  senderName: z.string().nullable(),
  bodyText: z.string(),
  createdAt: z.string(),
});

export type TicketMessage = z.infer<typeof ticketMessageSchema>;

/**
 * Single-ticket detail wire shape. Same scalar fields as `ticketListItemSchema`,
 * but the assignee relation is resolved server-side into human-readable
 * name/email (the list shape only carries the internal `assigneeId`); both are
 * null when unassigned. `messages` is the conversation thread, oldest-first.
 * Timestamps are ISO strings, matching the list shape so the web client
 * consumes them identically.
 */
export const ticketDetailSchema = z.object({
  id: z.number().int(),
  subject: z.string(),
  status: ticketStatusEnum,
  category: ticketCategoryEnum.nullable(),
  priority: priorityEnum,
  requesterEmail: z.string(),
  requesterName: z.string(),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  assigneeEmail: z.string().nullable(),
  messages: z.array(ticketMessageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TicketDetail = z.infer<typeof ticketDetailSchema>;

/**
 * Update payload for a ticket. Today only `assigneeId` is updatable (set to a
 * staff user id, or `null` to unassign); the shape is generic so status/priority
 * can be added later. Drives the PATCH /tickets/:id body parse.
 */
export const updateTicketSchema = z.object({
  assigneeId: z.string().nullable(),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

/**
 * A staff member available for assignment (admin or agent). Lightweight by
 * design — only what the assignee picker needs; no email/account fields, so the
 * staff-wide `GET /tickets/assignees` endpoint doesn't leak the admin directory.
 */
export const assigneeOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: userRoleEnum,
});

export type AssigneeOption = z.infer<typeof assigneeOptionSchema>;
