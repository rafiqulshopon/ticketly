import { Injectable, Logger } from "@nestjs/common";
import type { DashboardStats, TicketDayCount } from "@ticketly/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SystemAgentService } from "../system-agent/system-agent.service";
import { RESOLVED_STATUSES } from "../tickets/tickets.constants";

/**
 * Read-only aggregate metrics for the admin dashboard. `@Roles(["admin"])` on the
 * controller gates every call, so these counts are global (no per-agent scoping).
 * Counts run concurrently in one `Promise.all`, matching the list() style in
 * TicketsService; average resolution time averages `resolvedAt − createdAt` over
 * the resolved subset in JS because Prisma's `aggregate._avg` can't do date
 * arithmetic.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemAgent: SystemAgentService,
  ) {}

  async getStats(): Promise<DashboardStats> {
    // AI replies are attributed to the system AI user (senderId = its id); legacy
    // replies (pre-attribution) have senderId null. Count both so the metric holds.
    const aiAgentId = await this.systemAgent.getAiAgentId();
    const [totalTickets, openTickets, totalResolved, resolvedByAi, resolved, ticketsPerDay] = await Promise.all([
      this.prisma.ticket.count(),
      // "Open" = everything that isn't resolved (NEW, PROCESSING, OPEN, AWAITING_STUDENT).
      this.prisma.ticket.count({ where: { status: { notIn: RESOLVED_STATUSES } } }),
      this.prisma.ticket.count({ where: { status: { in: RESOLVED_STATUSES } } }),
      // AI-resolved = the resolving reply was an AI message (outbound agent msg
      // with no human author — `senderId: null` is written only by the auto-resolver).
      this.prisma.ticket.count({
        where: {
          status: { in: RESOLVED_STATUSES },
          messages: {
            some: {
              direction: "outbound",
              senderType: "agent",
              OR: [{ senderId: null }, ...(aiAgentId ? [{ senderId: aiAgentId }] : [])],
            },
          },
        },
      }),
      this.prisma.ticket.findMany({
        where: { status: { in: RESOLVED_STATUSES }, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
      this.getTicketsPerDay(),
    ]);

    const aiResolutionRate =
      totalResolved > 0 ? Number(((resolvedByAi / totalResolved) * 100).toFixed(1)) : 0;

    const diffs = resolved
      .filter((t) => t.resolvedAt)
      .map((t) => t.resolvedAt!.getTime() - t.createdAt.getTime());
    const avgResolutionTimeMs =
      diffs.length > 0 ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null;

    return {
      totalTickets,
      openTickets,
      totalResolved,
      resolvedByAi,
      aiResolutionRate,
      avgResolutionTimeMs,
      ticketsPerDay,
    };
  }

  /**
   * Tickets created per UTC day for the last 30 days (oldest → newest). Buckets
   * with `DATE()` in Postgres (UTC, matching Neon's timezone), then zero-fills any
   * missing days in JS so the chart always shows a continuous 30-point series.
   * Table/column are quoted because Prisma maps `Ticket` → `tickets` and keeps the
   * camelCase `createdAt` column (see `@@map` in schema.prisma).
   */
  private async getTicketsPerDay(): Promise<TicketDayCount[]> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 29); // 30 buckets ending today

    const rows = await this.prisma.$queryRaw<{ day: Date; count: number }[]>`
      SELECT DATE("createdAt") AS day, COUNT(*)::int AS count
      FROM "tickets"
      WHERE "createdAt" >= ${start}
      GROUP BY day
    `;

    const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));
    const series: TicketDayCount[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      series.push({ date, count: byDay.get(date) ?? 0 });
    }
    return series;
  }
}
