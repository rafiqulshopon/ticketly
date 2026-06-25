import { Injectable, Logger } from "@nestjs/common";
import type { DashboardStats } from "@ticketly/shared";
import type { TicketStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SystemAgentService } from "../system-agent/system-agent.service";

/** Terminal statuses — a ticket counts as resolved once it reaches either. */
const RESOLVED_STATUSES: TicketStatus[] = ["RESOLVED", "CLOSED"];

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
    const [totalTickets, openTickets, totalResolved, resolvedByAi, resolved] = await Promise.all([
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
    };
  }
}
