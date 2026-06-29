import { Injectable, Logger, type MessageEvent, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { TicketActivityItem, TicketMessage } from "@ticketly/shared";
import { Observable, Subject } from "rxjs";
import { finalize } from "rxjs/operators";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

/** SSE keep-alive cadence — well under typical proxy / browser idle timeouts. */
const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * In-process Server-Sent-Events broker for live ticket events.
 *
 * Each logged-in user holds zero or more open connections (one per browser tab);
 * a connection is an RxJS `Subject` the `@Sse()` controller returns to Nest.
 * When a ticket event the user may see happens, `publish*` fans a `MessageEvent`
 * out to every one of their open subjects, and Nest serializes it onto the wire.
 *
 * Audience is delegated to `NotificationsService.recipientUserIds` (admins ∪ the
 * ticket's assignee, minus the AI agent) so the "who may see this ticket" rule
 * lives in exactly one place — a user never receives an event for a ticket they
 * can't access. Single-process by design (a set of in-memory subjects); fine for
 * one api replica, which is the current deployment.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  /** Per-user open connections. A user may hold several (multiple tabs). */
  private readonly streams = new Map<string, Set<Subject<MessageEvent>>>();
  private heartbeat?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    // Keep every open SSE connection alive through proxies / browser idle
    // timeouts. The client never listens for "ping" — the bytes on the wire
    // alone prevent the stream from being dropped after ~60s of quiet.
    this.heartbeat = setInterval(() => this.emitHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const subjects of this.streams.values()) {
      for (const subject of subjects) subject.complete();
    }
    this.streams.clear();
  }

  /**
   * Open a per-connection SSE stream for `userId`. The returned Observable is
   * handed to `@Sse()`; Nest auto-unsubscribes it on client disconnect, and
   * `finalize` removes it from this broker so the registry can't leak.
   */
  openStream(userId: string): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    this.subscribe(userId, subject);
    return subject.asObservable().pipe(finalize(() => this.unsubscribe(userId, subject)));
  }

  /** Push an inbound customer reply to everyone who may see the ticket. */
  async publishTicketReply(ticketId: number, message: TicketMessage): Promise<void> {
    const ticket = await this.ticketMeta(ticketId);
    if (!ticket) return;
    const recipientIds = await this.notifications.recipientUserIds(ticket.assigneeId);
    for (const userId of recipientIds) {
      this.emit(userId, "new_message", {
        ticketId,
        ticketSubject: ticket.subject,
        requesterName: ticket.requesterName,
        message,
      });
    }
  }

  /** Push a brand-new ticket. New tickets start owned by the AI agent, which
   *  `recipientUserIds` excludes, so in practice only admins hear this. */
  async publishNewTicket(ticketId: number): Promise<void> {
    const ticket = await this.ticketMeta(ticketId);
    if (!ticket) return;
    const recipientIds = await this.notifications.recipientUserIds(ticket.assigneeId);
    for (const userId of recipientIds) {
      this.emit(userId, "new_ticket", {
        ticketId,
        ticketSubject: ticket.subject,
        requesterName: ticket.requesterName,
      });
    }
  }

  /** Push a new activity-log entry to everyone who may see the ticket, so the
   *  open Activity tab prepends it live (replies + property changes alike). The
   *  audience is resolved exactly like `publishTicketReply` — admins ∪ the
   *  assignee, minus the AI agent — so the "who may see this ticket" rule stays
   *  in one place. The full item is sent so the client needs no refetch. */
  async publishTicketActivity(ticketId: number, activity: TicketActivityItem): Promise<void> {
    const ticket = await this.ticketMeta(ticketId);
    if (!ticket) return;
    const recipientIds = await this.notifications.recipientUserIds(ticket.assigneeId);
    for (const userId of recipientIds) {
      this.emit(userId, "ticket_activity", { ticketId, activity });
    }
  }

  // ---------------------------------------------------------------------------

  /** Display fields + assignee for a ticket, or null if it was deleted. */
  private async ticketMeta(
    ticketId: number,
  ): Promise<{ subject: string; requesterName: string; assigneeId: string | null } | null> {
    return this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { subject: true, requesterName: true, assigneeId: true },
    });
  }

  private subscribe(userId: string, subject: Subject<MessageEvent>): void {
    let subjects = this.streams.get(userId);
    if (!subjects) {
      subjects = new Set();
      this.streams.set(userId, subjects);
    }
    subjects.add(subject);
  }

  private unsubscribe(userId: string, subject: Subject<MessageEvent>): void {
    const subjects = this.streams.get(userId);
    if (!subjects) return;
    subjects.delete(subject);
    if (subjects.size === 0) this.streams.delete(userId);
  }

  /** Write an event to every open connection a user holds (no-op if none).
   *  `type` is injected into `data` too (not just carried as the SSE `event:`
   *  name) so the client's discriminated-union schema — keyed on `type` — can
   *  validate the payload; the event name alone never reaches `data`. */
  private emit(userId: string, type: string, data: object): void {
    const subjects = this.streams.get(userId);
    if (!subjects || subjects.size === 0) return;
    const event: MessageEvent = { type, data: { ...data, type } };
    for (const subject of subjects) subject.next(event);
  }

  private emitHeartbeat(): void {
    for (const subjects of this.streams.values()) {
      for (const subject of subjects) {
        if (!subject.closed) subject.next({ type: "ping", data: {} });
      }
    }
  }
}
