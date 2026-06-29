import { z } from "zod";

/**
 * A ticket's lifecycle timeline — one row per notable event. Written inline at
 * each mutation site (best-effort) and read newest-first on the detail page's
 * Activity tab. Mirrors the `TicketActivityType` Prisma enum — keep the two in
 * sync (the codebase convention for every closed enum set).
 *
 * Event kinds:
 *  - `ticket_created`   — the ticket arrived (system event; no actor).
 *  - `customer_replied` — an inbound customer message (no actor).
 *  - `agent_replied`    — a human staff reply (actor = the agent).
 *  - `ai_replied`       — a reply authored by the system AI agent.
 *  - `status_changed` / `priority_changed` / `category_changed` / `assignee_changed`
 *    — a property edit; carries `changeField` + `changeFrom`/`changeTo`.
 */
export const ticketActivityTypeSchema = z.enum([
  "ticket_created",
  "customer_replied",
  "agent_replied",
  "ai_replied",
  "status_changed",
  "priority_changed",
  "category_changed",
  "assignee_changed",
]);

export type TicketActivityType = z.infer<typeof ticketActivityTypeSchema>;

/**
 * One activity row on the wire. `actorName` is a snapshot captured at write time
 * so the feed renders without a join (a deleted agent's past actions still
 * label). The change fields are populated only for `*_changed` events, null
 * otherwise; for `assignee_changed` they hold display names (or "(unassigned)").
 * Timestamps are ISO strings.
 */
export const ticketActivitySchema = z.object({
  id: z.string(),
  ticketId: z.number().int(),
  type: ticketActivityTypeSchema,
  actorUserId: z.string().nullable(),
  actorName: z.string().nullable(),
  changeField: z.string().nullable(),
  changeFrom: z.string().nullable(),
  changeTo: z.string().nullable(),
  createdAt: z.string(),
});

export type TicketActivityItem = z.infer<typeof ticketActivitySchema>;
