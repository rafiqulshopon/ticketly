import { Injectable, Logger } from "@nestjs/common";
import type { TicketActivityItem, TicketActivityType } from "@ticketly/shared";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";

/** Cap on how many rows the list endpoint returns (newest first). Mirrors the
 *  Notifications feed so the two timelines feel consistent. */
const LIST_LIMIT = 50;

/** A field change captured for a `*_changed` event. `from`/`to` are stored as
 *  display strings: enum values for status/priority/category ("OPEN"), or a
 *  user display name / "(unassigned)" for assignee. */
export interface ActivityChange {
  field: string;
  from: string | null;
  to: string | null;
}

/**
 * Writes + reads a ticket's lifecycle timeline. Mirrors the Notifications module:
 * one denormalized-snapshot row per event, written **inline at each mutation
 * site wrapped in try/catch by the caller** so a logging failure never rolls
 * back the real write, then read newest-first on the detail page.
 *
 * `record()` is the single write path — generic over the event `type` so the
 * eight call sites stay self-documenting without eight near-identical wrappers.
 * After persisting the row it pushes it live over the realtime channel so the
 * open Activity tab prepends it without a refetch (audience resolved inside
 * `RealtimeService`, sharing the "who may see this ticket" rule with the bell).
 */
@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Record one activity event and push it live. Resolves an `actorName` snapshot
   * (one lookup) so the feed renders join-free even after the actor is deleted.
   * Best-effort: the caller wraps this in try/catch (a logging/push failure is
   * logged, never propagated to roll back the triggering write).
   */
  async record(
    ticketId: number,
    type: TicketActivityType,
    opts: { actorUserId?: string | null; change?: ActivityChange } = {},
  ): Promise<void> {
    let actorName: string | null = null;
    if (opts.actorUserId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: opts.actorUserId },
        select: { name: true },
      });
      actorName = actor?.name ?? null;
    }
    const row = await this.prisma.ticketActivity.create({
      data: {
        ticketId,
        type,
        actorUserId: opts.actorUserId ?? null,
        actorName,
        changeField: opts.change?.field ?? null,
        changeFrom: opts.change?.from ?? null,
        changeTo: opts.change?.to ?? null,
      },
    });
    await this.realtime.publishTicketActivity(ticketId, this.toWire(row));
  }

  /** A ticket's activity, newest first (server-capped). */
  async listForTicket(ticketId: number): Promise<TicketActivityItem[]> {
    const rows = await this.prisma.ticketActivity.findMany({
      where: { ticketId },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
    });
    return rows.map((r) => this.toWire(r));
  }

  /** Map a Prisma row to the wire shape (timestamp → ISO string). */
  private toWire(r: {
    id: string;
    ticketId: number;
    type: TicketActivityType;
    actorUserId: string | null;
    actorName: string | null;
    changeField: string | null;
    changeFrom: string | null;
    changeTo: string | null;
    createdAt: Date;
  }): TicketActivityItem {
    return {
      id: r.id,
      ticketId: r.ticketId,
      type: r.type,
      actorUserId: r.actorUserId,
      actorName: r.actorName,
      changeField: r.changeField,
      changeFrom: r.changeFrom,
      changeTo: r.changeTo,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
