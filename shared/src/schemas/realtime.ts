import { z } from "zod";
import { ticketActivitySchema } from "./activity";
import { ticketMessageSchema } from "./ticket";

/**
 * The events the backend pushes to a logged-in user over the realtime SSE stream
 * (`GET /api/realtime`). Consumed by both the api (emitter) and the web client
 * (listener), so the wire shape lives here in shared and is validated on receipt.
 *
 * The audience is resolved server-side (admins ∪ the ticket's assignee, minus the
 * AI agent) — a user only ever receives events for tickets they may see, so the
 * payload is safe to surface directly.
 */
export const realtimeEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("new_message"),
    ticketId: z.number(),
    ticketSubject: z.string(),
    requesterName: z.string().nullable(),
    // The full wire message so the client can append it to the open thread
    // without a refetch. Only inbound customer replies are pushed today.
    message: ticketMessageSchema,
  }),
  z.object({
    type: z.literal("new_ticket"),
    ticketId: z.number(),
    ticketSubject: z.string(),
    requesterName: z.string().nullable(),
  }),
  z.object({
    type: z.literal("ticket_activity"),
    ticketId: z.number(),
    // The full activity item so the open Activity tab can prepend it live without
    // a refetch. Pushed for every recorded event (replies + property changes) so
    // server-side events like an AI auto-resolve surface instantly.
    activity: ticketActivitySchema,
  }),
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

/** A `new_message` event, narrowed for handlers that only care about replies. */
export type NewMessageEvent = Extract<RealtimeEvent, { type: "new_message" }>;

/** A `new_ticket` event. */
export type NewTicketEvent = Extract<RealtimeEvent, { type: "new_ticket" }>;

/** A `ticket_activity` event. */
export type TicketActivityEvent = Extract<RealtimeEvent, { type: "ticket_activity" }>;
