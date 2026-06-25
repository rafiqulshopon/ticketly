import { z } from "zod";

/** One day's ticket count in the per-day series — UTC calendar day (YYYY-MM-DD). */
export const ticketDayCountSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().min(0),
});
export type TicketDayCount = z.infer<typeof ticketDayCountSchema>;

/** Aggregate metrics returned by `GET /api/dashboard/stats` (admin only). */
export const dashboardStatsSchema = z.object({
  /** Every ticket, regardless of status. */
  totalTickets: z.number().int().min(0),
  /** Tickets that aren't resolved — NEW, PROCESSING, OPEN, AWAITING_STUDENT. */
  openTickets: z.number().int().min(0),
  /** Tickets in a terminal status (RESOLVED or CLOSED). The AI-rate denominator. */
  totalResolved: z.number().int().min(0),
  /** Resolved tickets whose resolving reply was an AI message (no human author). */
  resolvedByAi: z.number().int().min(0),
  /** `resolvedByAi / totalResolved * 100`, rounded to 1 dp; 0 when none resolved. */
  aiResolutionRate: z.number().min(0).max(100),
  /** Mean `resolvedAt − createdAt` in ms over resolved tickets; null if none. */
  avgResolutionTimeMs: z.number().int().min(0).nullable(),
  /** Tickets created per UTC day for the last 30 days, oldest → newest (zero-filled). */
  ticketsPerDay: z.array(ticketDayCountSchema),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
