import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Notification as NotificationDto, NotificationType } from "@ticketly/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SEND_PUSH_QUEUE, SEND_PUSH_SEND_OPTIONS } from "../queue/queue.constants";
import { QueueService } from "../queue/queue.service";
import { SystemAgentService } from "../system-agent/system-agent.service";

/** Cap on how many rows the list endpoint returns (newest first). */
const LIST_LIMIT = 50;

/**
 * In-app notification fan-out + per-user read state.
 *
 * Two trigger events produce notifications — `new_ticket` and `new_message` —
 * fanned out to every admin (they see everything) plus the ticket's human
 * assignee (agents only hear about tickets they own). The AI system agent is
 * always excluded; it's a bot, not a bell-watcher. Fan-out runs inline after the
 * triggering write commits (mirroring the classify/auto-resolve enqueue posture
 * in TicketsService) and is wrapped in try/catch by the caller so a notification
 * failure can never roll back a ticket/message write.
 *
 * Read model: at most ONE unread row per (user, ticket). A new event on a ticket
 * that already has an unread row refreshes it (bumps type/subject/time) instead of
 * stacking another, so the bell badge counts *tickets with activity*, not raw
 * message count. Once read, the row stays as history; the next event creates a
 * fresh unread row. Unassigning a user from a ticket clears their unread row for
 * it, so the badge stops surfacing a ticket they no longer own.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemAgent: SystemAgentService,
    private readonly queue: QueueService,
  ) {}

  /** Fan out a `new_ticket` notification to admins + the human assignee. */
  async notifyNewTicket(ticketId: number): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { subject: true, requesterName: true, assigneeId: true },
    });
    if (!ticket) return;
    const recipientIds = await this.resolveRecipients(ticket.assigneeId);
    await this.upsertUnread(recipientIds, {
      type: "new_ticket",
      ticketId,
      ticketSubject: ticket.subject,
      requesterName: ticket.requesterName,
    });
    // At creation the assignee is the AI agent (excluded by resolveRecipients),
    // so this pushes to admins only — the "new ticket is admin-only" rule.
    await this.enqueuePush(
      recipientIds,
      "new_ticket",
      ticketId,
      `New ticket from ${ticket.requesterName}`,
      ticket.subject,
    );
  }

  /** Fan out a `new_message` notification to admins + the human assignee. */
  async notifyNewMessage(ticketId: number): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { subject: true, requesterName: true, assigneeId: true },
    });
    if (!ticket) return;
    const recipientIds = await this.resolveRecipients(ticket.assigneeId);
    await this.upsertUnread(recipientIds, {
      type: "new_message",
      ticketId,
      ticketSubject: ticket.subject,
      requesterName: ticket.requesterName,
    });
    await this.enqueuePush(
      recipientIds,
      "new_message",
      ticketId,
      `New reply on "${ticket.subject}"`,
      `From ${ticket.requesterName}`,
    );
  }

  /**
   * Notify the agent a ticket was just assigned to them. Scoped to that one human
   * user: the AI agent never gets a row, and admins are skipped (they already see
   * all ticket activity via the new-ticket/new-message rows). A stale or
   * soft-deleted assignee id is ignored rather than pinging a dead account.
   */
  async notifyAssigned(ticketId: number, assigneeId: string): Promise<void> {
    if (!assigneeId) return;
    const aiAgentId = await this.systemAgent.getAiAgentId();
    if (aiAgentId && assigneeId === aiAgentId) return;
    const [assignee, ticket] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: assigneeId }, select: { deletedAt: true } }),
      this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { subject: true, requesterName: true },
      }),
    ]);
    if (!assignee || assignee.deletedAt || !ticket) return;
    await this.upsertUnread([assigneeId], {
      type: "ticket_assigned",
      ticketId,
      ticketSubject: ticket.subject,
      requesterName: ticket.requesterName,
    });
    // Assignment push goes to the new owner only (mirrors the bell — admins
    // already get the new-ticket/new-message pushes for this ticket).
    await this.enqueuePush(
      [assigneeId],
      "ticket_assigned",
      ticketId,
      "Assigned to you",
      ticket.subject,
    );
  }

  /** The caller's notifications, newest first (capped at {@link LIST_LIMIT}). */
  async listForUser(userId: string): Promise<NotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
    });
    return rows.map((r) => this.toWire(r));
  }

  /** Unread count for the bell badge. */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  /** Mark one notification read. Scoped to the caller: a foreign id 404s. */
  async markRead(userId: string, notificationId: string): Promise<void> {
    const existing = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Notification not found");
    }
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  /** Mark every unread notification for the caller as read ("mark all read"). */
  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  /**
   * Drop a user's UNREAD notifications for a ticket — called when they're
   * unassigned (or reassigned away) so the bell no longer surfaces a ticket they
   * no longer own. Already-read rows are left as history.
   */
  async clearUnreadForTicket(userId: string, ticketId: number): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { userId, ticketId, readAt: null },
    });
  }

  /**
   * The user ids who should hear about a ticket event — the same audience the
   * bell fans out to. Exposed so the realtime push targets exactly the people who
   * may see the ticket, keeping the access rule in one place. Delegates to
   * {@link resolveRecipients}.
   */
  recipientUserIds(assigneeId: string | null): Promise<string[]> {
    return this.resolveRecipients(assigneeId);
  }

  /**
   * Enqueue a mobile push to the same audience the bell just fanned out to. The
   * push is durable — it goes through the `send-push` pg-boss queue and is
   * delivered by `NotificationsPushConsumer` — so an Expo outage never breaks the
   * ticket write that triggered it. Wrapped in try/catch so a pg-boss/DB blip
   * can't abort the bell fan-out: the bell is the primary signal, push is a
   * best-effort complement. The recipient set is snapshotted into the job so a
   * later reassignment can't change who gets notified.
   */
  private async enqueuePush(
    recipientIds: string[],
    type: NotificationType,
    ticketId: number,
    title: string,
    body: string,
  ): Promise<void> {
    if (recipientIds.length === 0) return;
    try {
      await this.queue.send(
        SEND_PUSH_QUEUE,
        { recipientUserIds: recipientIds, title, body, data: { type, ticketId } },
        SEND_PUSH_SEND_OPTIONS,
      );
    } catch (err) {
      this.logger.warn(
        `Push enqueue failed (${type}, ticket ${ticketId}) — ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // ---------------------------------------------------------------------------

  /**
   * Recipients for a ticket event: every non-deleted admin (they see everything)
   * ∪ the ticket's current assignee, minus the AI system agent (a bot). The
   * assignee is null for tickets still owned by the AI pipeline, so in that case
   * only admins are notified — exactly the agent-scoping rule.
   */
  private async resolveRecipients(assigneeId: string | null): Promise<string[]> {
    const [admins, aiAgentId] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: "admin", deletedAt: null },
        select: { id: true },
      }),
      this.systemAgent.getAiAgentId(),
    ]);
    const ids = new Set<string>();
    for (const a of admins) ids.add(a.id);
    if (assigneeId) ids.add(assigneeId);
    if (aiAgentId) ids.delete(aiAgentId);
    return [...ids];
  }

  /**
   * Ensure exactly one unread row per recipient for this ticket, refreshing it
   * in place if one already exists. `updateMany` returns the matched count; a zero
   * means no unread row yet, so we create one. A concurrent double-event race
   * could at worst create a duplicate unread row, but inbound events are already
   * deduped upstream by `Message.messageId`, so this is not a practical concern.
   */
  private async upsertUnread(
    userIds: string[],
    data: { type: NotificationType; ticketId: number; ticketSubject: string; requesterName: string },
  ): Promise<void> {
    if (userIds.length === 0) return;
    const now = new Date();
    for (const userId of userIds) {
      const refreshed = await this.prisma.notification.updateMany({
        where: { userId, ticketId: data.ticketId, readAt: null },
        data: {
          type: data.type,
          ticketSubject: data.ticketSubject,
          requesterName: data.requesterName,
          // Bump to the latest activity time so the feed shows the most recent event.
          createdAt: now,
        },
      });
      if (refreshed.count === 0) {
        await this.prisma.notification.create({
          data: {
            userId,
            type: data.type,
            ticketId: data.ticketId,
            ticketSubject: data.ticketSubject,
            requesterName: data.requesterName,
          },
        });
      }
    }
  }

  /** Map a Prisma row to the wire shape (timestamps → ISO strings). */
  private toWire(n: {
    id: string;
    type: string;
    ticketId: number;
    ticketSubject: string;
    requesterName: string;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: n.id,
      type: n.type as NotificationType,
      ticketId: n.ticketId,
      ticketSubject: n.ticketSubject,
      requesterName: n.requesterName,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
