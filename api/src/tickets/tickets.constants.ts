/**
 * The system "AI" agent — a bare `User` (no login credentials) that new tickets
 * are assigned to while the auto-resolver attempts to handle them. Looked up by
 * email because the seed generates its id (a UUID, not a fixed value). Kept in
 * this standalone module (not tickets.service.ts) so the seed can import it
 * without pulling in the service's heavy transitive deps (AiService, pg-boss…).
 */
export const SYSTEM_AGENT_EMAIL = "ai@ticketly.local";
