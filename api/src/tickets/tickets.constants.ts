import type { TicketStatus } from "../generated/prisma/client";

/**
 * The system "AI" agent — a bare `User` (no login credentials) that new tickets
 * are assigned to while the auto-resolver attempts to handle them. Looked up by
 * email because the seed generates its id (a UUID, not a fixed value). Kept in
 * this standalone module (not tickets.service.ts) so the seed can import it
 * without pulling in the service's heavy transitive deps (AiService, pg-boss…).
 */
export const SYSTEM_AGENT_EMAIL = "ai@ticketly.local";

/** Terminal statuses — a ticket counts as resolved once it reaches either.
 *  Shared by the dashboard stats and the ticket-list `view` filter so the two
 *  can't drift apart. */
export const RESOLVED_STATUSES: TicketStatus[] = ["RESOLVED", "CLOSED"];

/** Statuses a customer reply should reopen from → OPEN. Resolved/Closed are
 *  terminal (the follow-up invalidates "done"); Awaiting_Student means we were
 *  waiting on the student, who just replied. Open is already active; New/
 *  Processing belong to the AI pipeline and are left alone. */
export const REOPENABLE_STATUSES: TicketStatus[] = ["AWAITING_STUDENT", "RESOLVED", "CLOSED"];
