/**
 * Shared queue definitions — the producer (`TicketsService`) and the consumer
 * (`ClassifyTicketConsumer`) both import from here so the queue name, the job
 * payload shape, and the send options stay in one place.
 */

/** pg-boss queue name for ticket auto-classification. */
export const CLASSIFY_TICKET_QUEUE = "classify-ticket";

/** Payload enqueued for each ticket that needs classifying. */
export interface ClassifyTicketJobData {
  ticketId: number;
  subject: string;
  body: string;
}

/**
 * Bounded retries with exponential backoff: a transient LLM/network/DB blip
 * shouldn't strand a ticket uncategorized. After `retryLimit` attempts the job
 * sits in pg-boss's failed state (inspectable in the `pgboss` schema) and the
 * ticket is simply left without a category — same outcome as today's swallowed
 * error, but now visible and durable instead of silent.
 */
export const CLASSIFY_TICKET_SEND_OPTIONS = {
  retryLimit: 3,
  retryBackoff: true,
} as const;

/** pg-boss queue name for ticket auto-resolution (knowledge-base lookup on arrival). */
export const AUTO_RESOLVE_TICKET_QUEUE = "auto-resolve-ticket";

/** Payload enqueued for each newly created ticket. The consumer re-reads the
 *  ticket + its first message from the DB so the payload stays minimal and the
 *  job can't act on stale snapshot data. */
export interface AutoResolveTicketJobData {
  ticketId: number;
}

/** Same retry posture as classify: transient blips get a few retries with
 *  backoff. (AI-call failures are also caught in the consumer and degrade the
 *  ticket to OPEN, so a persistently failing model never strands a ticket in
 *  PROCESSING — invisible — forever.) */
export const AUTO_RESOLVE_TICKET_SEND_OPTIONS = {
  retryLimit: 3,
  retryBackoff: true,
} as const;
