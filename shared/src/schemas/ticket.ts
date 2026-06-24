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
 *
 * Every string field is length-capped: this schema drives the untrusted inbound
 * webhook (`inboundEmailSchema` extends it, so the caps propagate), and an
 * unbounded `bodyHtml` would both bloat storage and drive a multi-second
 * DOMPurify parse (jsdom is O(n)). Caps accept any realistic email while
 * blocking MB-scale payloads.
 */
export const createTicketSchema = z.object({
  requesterEmail: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Enter a valid email")
    .refine((value) => !/\s/.test(value), { message: "Email cannot contain spaces" }),
  requesterName: z.string().trim().min(1, "Name is required").max(255, "Name is too long"),
  subject: z.string().trim().min(1, "Subject is required").max(500, "Subject is too long"),
  bodyText: z.string().min(1, "Body is required").max(100_000, "Body is too long"),
  // Untrusted email HTML — sanitized (DOMPurify) at the storage chokepoint in
  // TicketsService.create before persistence. Capped higher than `bodyText`
  // because HTML carries markup overhead and still runs through jsdom.
  bodyHtml: z.string().max(500_000, "HTML body is too long").optional(),
  category: ticketCategoryEnum.optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

/**
 * Input for replying to a ticket. Drives POST /tickets/:id/replies. Only the
 * plain-text body is accepted — `bodyHtml` is intentionally absent (the detail
 * view drops untrusted email HTML to avoid XSS, and there is no rich-text
 * composer). The backend derives the email envelope (from/to/subject/inReplyTo)
 * and `senderType` from the ticket + the signed-in sender.
 */
export const createReplySchema = z.object({
  bodyText: z.string().trim().min(1, "Reply cannot be empty"),
});

export type CreateReplyInput = z.infer<typeof createReplySchema>;

/**
 * Input for AI-polishing a drafted reply. Drives POST /tickets/:id/polish. Like
 * `createReplySchema` it carries only the plain-text body — the conversation
 * context is read server-side (the agent is polishing a reply to the ticket they
 * already have open). Length-capped higher than a reply to bound the prompt size
 * without rejecting a long draft.
 */
export const polishReplySchema = z.object({
  bodyText: z.string().trim().min(1, "Reply cannot be empty").max(20_000, "Reply is too long"),
});

export type PolishReplyInput = z.infer<typeof polishReplySchema>;

/** Output of the polish endpoint — the improved reply body, plain text. */
export const polishReplyResultSchema = z.object({
  bodyText: z.string(),
});

export type PolishReplyResult = z.infer<typeof polishReplyResultSchema>;

/**
 * Output of the summarize endpoint — a plain-text digest of the ticket and its
 * conversation. There is no request schema: the endpoint is keyed by the ticket
 * id alone (`POST /tickets/:id/summarize`) and reads the thread server-side. The
 * summary is generated fresh on every call and never persisted, so a client
 * regenerates it simply by calling again.
 */
export const summarizeTicketResultSchema = z.object({
  summary: z.string(),
});

export type SummarizeTicketResult = z.infer<typeof summarizeTicketResultSchema>;

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

/** Who authored a message: the staff agent ("agent") or the ticket requester
 *  ("customer"). Mirrors the Postgres `MessageSenderType` enum — keep in sync. */
export const messageSenderTypeEnum = z.enum(["agent", "customer"]);

/** A single message in a ticket's conversation thread. `senderName` is the
 *  staff agent for outbound replies (resolved from the `sender` relation) and
 *  null for inbound messages, where the author is the external `fromEmail`.
 *  Only `bodyText` is surfaced — `bodyHtml` is untrusted email HTML and is
 *  omitted to avoid XSS. Timestamps are ISO strings. */
export const ticketMessageSchema = z.object({
  id: z.string(),
  direction: messageDirectionEnum,
  senderType: messageSenderTypeEnum,
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
 * Partial update payload for a ticket — every field is optional, so a PATCH can
 * change one field without touching the others (`undefined` = leave unchanged).
 * `assigneeId`/`category` are nullable (`null` = unassign / clear category).
 * Invalid enum values are rejected by Zod at parse time. Drives PATCH /tickets/:id.
 */
export const updateTicketSchema = z.object({
  assigneeId: z.string().nullable().optional(),
  status: ticketStatusEnum.optional(),
  category: ticketCategoryEnum.nullable().optional(),
  priority: priorityEnum.optional(),
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
