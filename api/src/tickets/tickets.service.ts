import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type {
  AssigneeOption,
  CreateReplyInput,
  CreateTicketInput,
  ListTicketsQuery,
  PolishReplyInput,
  PolishReplyResult,
  SummarizeTicketResult,
  Ticket,
  TicketActivityItem,
  TicketActivityType,
  TicketDetail,
  TicketListItem,
  TicketListResponse,
  UpdateTicketInput,
} from "@ticketly/shared";
import type { Message as MessageRow, Ticket as TicketRow, TicketStatus } from "../generated/prisma/client";
import { ActivityLogsService, type ActivityChange } from "../activity-logs/activity-logs.service";
import { AiService } from "../ai/ai.service";
import { OutboundMailService } from "../channels/email/outbound-mail.service";
import { sanitizeEmailHtml } from "../common/sanitize-html";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { SystemAgentService } from "../system-agent/system-agent.service";
import {
  AUTO_RESOLVE_TICKET_QUEUE,
  AUTO_RESOLVE_TICKET_SEND_OPTIONS,
  type AutoResolveTicketJobData,
  CLASSIFY_TICKET_QUEUE,
  CLASSIFY_TICKET_SEND_OPTIONS,
  type ClassifyTicketJobData,
} from "../queue/queue.constants";
import { QueueService } from "../queue/queue.service";
import { REOPENABLE_STATUSES, RESOLVED_STATUSES, SYSTEM_AGENT_EMAIL } from "./tickets.constants";

/**
 * Placeholder destination for the first inbound message on a ticket. There is no
 * real support address yet; when a real email provider is wired this becomes the
 * configured inbound address the requester mailed. It only fills the required
 * `Message.toEmail` column (and the `fromEmail` of outbound replies, including
 * AI auto-resolve replies).
 */
export const SUPPORT_INBOUND_ADDRESS = "support@ticketly.local";

/**
 * One parsed inbound email handed to the email→ticket webhook. Extends the
 * manual create shape with RFC822 threading fields: `messageId` (idempotent
 * dedupe), and `inReplyTo` / `references` (to detect replies and append them to
 * an existing ticket instead of creating a duplicate). Defined here (not in
 * shared) so inbound-mail.service can pass its validated payload straight through.
 */
export type IngestInboundInput = CreateTicketInput & {
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string[] | null;
  routingTicketId?: number | null;
};

/** Outcome of ingesting one inbound email — exactly one of created/appended means
 *  a row was written; both false means it was a duplicate redelivery. */
export type IngestResult = { ticketId: number; created: boolean; appended: boolean };

/** Caller identity for access-scoped ticket operations. Admins see and act on
 *  every ticket; agents are limited to tickets assigned to them. Built in the
 *  controller from the better-auth session, so the scoping is enforced
 *  server-side regardless of any client-supplied id. */
export type TicketCaller = { userId: string; isAdmin: boolean };

/** Statuses the AI auto-resolution pipeline owns (NEW = just arrived,
 *  PROCESSING = AI is attempting to resolve). Hidden from the default ticket
 *  list so the inbox shows only tickets that need a human; an explicit status
 *  filter selection is always honored over this default exclusion. */
const HIDDEN_FROM_DEFAULT_LIST: TicketStatus[] = ["NEW", "PROCESSING"];

/**
 * Ticket creation — the single write path used by both:
 *  - the manual `POST /tickets` endpoint (staff logging a request, no messageId)
 *  - the inbound-email webhook (`POST /channels/email/inbound`, with a messageId)
 *
 * When `opts.messageId` is provided the create is idempotent: a ticket already
 * saved under that RFC822 Message-ID is returned untouched (`created: false`),
 * and a retry race that trips the `messageId` unique constraint is reconciled by
 * re-reading the winner. The Ticket and its first inbound Message are written in
 * one transaction so neither row can exist without the other.
 */
@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly queue: QueueService,
    private readonly systemAgent: SystemAgentService,
    private readonly mail: OutboundMailService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async create(
    input: CreateTicketInput,
    opts: { messageId?: string | null } = {},
  ): Promise<{ ticket: Ticket; created: boolean }> {
    const messageId = opts.messageId ?? null;

    // Fast path: a webhook re-delivery/retry of an already-stored message.
    if (messageId) {
      const existing = await this.prisma.ticket.findUnique({ where: { messageId } });
      if (existing) return { ticket: existing, created: false };
    }

    // Assign to the AI system agent while the auto-resolver works the ticket. Null
    // (unassigned) if it isn't seeded yet — never block ticket creation on this.
    const aiAgentId = await this.systemAgent.getAiAgentId();

    try {
      const ticket = await this.prisma.$transaction(async (tx) => {
        const created = await tx.ticket.create({
          data: {
            subject: input.subject,
            requesterEmail: input.requesterEmail,
            requesterName: input.requesterName,
            // status/priority use the schema defaults (NEW / NORMAL). category has
            // no default — store null when omitted (assigned later by AI classify).
            category: input.category ?? null,
            assigneeId: aiAgentId,
            messageId,
          },
        });

        await tx.message.create({
          data: {
            ticketId: created.id,
            direction: "inbound",
            senderType: "customer",
            fromEmail: input.requesterEmail,
            toEmail: SUPPORT_INBOUND_ADDRESS,
            subject: input.subject,
            bodyText: input.bodyText,
            // bodyHtml is sanitized here — the only write path for it — so the
            // DB never stores untrusted email HTML verbatim.
            bodyHtml: sanitizeEmailHtml(input.bodyHtml),
            messageId,
            // inReplyTo stays null until reply threading is implemented.
          },
        });

        return created;
      });

      // Enqueue a durable classify job (pg-boss) when no explicit category was
      // provided — an explicit one is respected, never overwritten. Enqueueing is
      // a fast DB insert, so the LLM latency (seconds) still never blocks the
      // create response. A queue hiccup is caught and logged so it can never fail
      // ticket creation; worst case the ticket is left to be classified later.
      if (input.category == null) {
        try {
          await this.queue.send<ClassifyTicketJobData>(
            CLASSIFY_TICKET_QUEUE,
            { ticketId: ticket.id, subject: input.subject, body: input.bodyText },
            CLASSIFY_TICKET_SEND_OPTIONS,
          );
        } catch (err) {
          this.logger.warn(
            `Classify: enqueue failed for ticket ${ticket.id}, leaving it uncategorized — ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      // Enqueue a durable auto-resolve job for every new ticket. The consumer
      // drives NEW → PROCESSING → (RESOLVED | OPEN) using the knowledge base.
      // Same fast-DB-insert posture as classify: the LLM latency never blocks the
      // create response. If the enqueue itself fails (rare — it's the same DB the
      // ticket was just written to), fall the ticket back to OPEN so it's never
      // stranded invisible in NEW waiting for a job that was never queued.
      try {
        await this.queue.send<AutoResolveTicketJobData>(
          AUTO_RESOLVE_TICKET_QUEUE,
          { ticketId: ticket.id },
          AUTO_RESOLVE_TICKET_SEND_OPTIONS,
        );
      } catch (err) {
        this.logger.warn(
          `Auto-resolve: enqueue failed for ticket ${ticket.id}, moving it to OPEN — ${err instanceof Error ? err.message : err}`,
        );
        try {
          await this.prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: "OPEN", assigneeId: null },
          });
        } catch (reopenErr) {
          this.logger.error(
            `Auto-resolve: could not move ticket ${ticket.id} to OPEN after enqueue failure — ${reopenErr instanceof Error ? reopenErr.message : reopenErr}`,
          );
        }
      }

      // Fan out a new-ticket notification to every admin (+ the human assignee,
      // though new tickets start assigned to the AI). Same swallowed-error
      // posture as the enqueues above: a notification failure never blocks or
      // rolls back the ticket creation.
      try {
        await this.notifications.notifyNewTicket(ticket.id);
      } catch (err) {
        this.logger.warn(
          `Notifications: new-ticket fan-out failed for ticket ${ticket.id} — ${err instanceof Error ? err.message : err}`,
        );
      }

      // Push the new ticket live so admins get an instant toast (new tickets
      // start owned by the AI agent, which the audience excludes, so admins are
      // the only recipients). Best-effort, same posture as the fan-out above.
      try {
        await this.realtime.publishNewTicket(ticket.id);
      } catch (err) {
        this.logger.warn(
          `Realtime: new-ticket push failed for ticket ${ticket.id} — ${err instanceof Error ? err.message : err}`,
        );
      }

      // Record the creation on the activity timeline. No actor — a new ticket is
      // a system event (an inbound email arriving). Best-effort, same posture as
      // the fan-out above; the ticket is already persisted.
      try {
        await this.activityLogs.record(ticket.id, "ticket_created");
      } catch (err) {
        this.logger.warn(
          `Activity: ticket_created log failed for ticket ${ticket.id} — ${err instanceof Error ? err.message : err}`,
        );
      }

      return { ticket, created: true };
    } catch (err) {
      // P2002 (unique violation) on messageId under a concurrent retry race:
      // another worker won — return its ticket instead of erroring.
      if (messageId && isUniqueViolation(err)) {
        const existing = await this.prisma.ticket.findUnique({ where: { messageId } });
        if (existing) return { ticket: existing, created: false };
      }
      throw err;
    }
  }

  /**
   * Inbound-email ingestion — the entry point for the email→ticket webhook. For
   * one parsed inbound email it decides whether the message is:
   *
   *   - a DUPLICATE of an already-stored message (same RFC822 Message-ID) → no-op;
   *   - a REPLY in an existing thread (its In-Reply-To / References matches a
   *     Message-ID already on a ticket owned by the SAME requester) → append a new
   *     inbound Message to that ticket;
   *   - otherwise → a NEW ticket, delegated to create() (which enqueues the AI
   *     classify + auto-resolve jobs).
   *
   * Threading is gated on requesterEmail equality, so a forged In-Reply-To can't
   * inject a message into someone else's ticket — a mismatched requester falls
   * through to a new ticket. Append reopens the ticket when it isn't already
   * actionable: a reply on a Resolved/Closed/Awaiting_Student ticket flips it to
   * OPEN (the follow-up needs an agent) inside the same transaction as the
   * message write. It does NOT re-run AI classify/auto-resolve on reopen.
   * Idempotency is on Message.messageId (unique), which covers both the
   * originating message create() wrote and any appended reply, so a Resend retry
   * is always a no-op; the append path additionally reconciles the
   * unique-constraint race under concurrent retries by treating P2002 as
   * "already appended".
   */
  async ingestInbound(input: IngestInboundInput): Promise<IngestResult> {
    const messageId = input.messageId ?? null;

    // 1. Idempotency: this exact message was already ingested (original or reply).
    if (messageId) {
      const existing = await this.prisma.message.findUnique({
        where: { messageId },
        select: { ticketId: true },
      });
      if (existing) return { ticketId: existing.ticketId, created: false, appended: false };
    }

    // 2. Resolve the parent ticket, if any. The recipient address is the PRIMARY
    //    signal — a `ticket-<id>@` address that Ticketly sends from. It's always
    //    present and never altered by mail clients, unlike the RFC822 threading
    //    headers Resend's inbound fetch omits. Header-based lookup stays as a
    //    fallback for old tickets / the dev webhook. Either way the requester-email
    //    gate (step 3) still applies, so a cross-ticket reply can't inject.
    let parent: { id: number; requesterEmail: string; status: TicketStatus } | null = null;

    if (input.routingTicketId) {
      parent = await this.prisma.ticket.findUnique({
        where: { id: input.routingTicketId },
        select: { id: true, requesterEmail: true, status: true },
      });
    }

    if (!parent) {
      // Fallback: match In-Reply-To, then each Reference, against a stored Message-ID
      // on an existing message (a follow-up) or the ticket's originating Message-ID.
      const candidateIds = [
        input.inReplyTo,
        ...(input.references ?? []),
      ].filter((v): v is string => typeof v === "string" && v.length > 0);
      const uniqueCandidateIds = [...new Set(candidateIds)];
      if (uniqueCandidateIds.length > 0) {
        const replyTarget = await this.prisma.message.findFirst({
          where: { messageId: { in: uniqueCandidateIds } },
          orderBy: { createdAt: "desc" },
          select: { ticket: { select: { id: true, requesterEmail: true, status: true } } },
        });
        parent = replyTarget?.ticket ?? null;
        if (!parent) {
          parent = await this.prisma.ticket.findFirst({
            where: { messageId: { in: uniqueCandidateIds } },
            orderBy: { createdAt: "desc" },
            select: { id: true, requesterEmail: true, status: true },
          });
        }
      }
    }

    // 3. Append to the thread iff the reply is from the ticket's own requester.
    if (parent && parent.requesterEmail === input.requesterEmail) {
      // A reply on a non-actionable ticket reopens it to OPEN so the follow-up
      // surfaces in the inbox: Resolved/Closed = was done, Awaiting_Student = we
      // were waiting on the student (who just replied). Open/New/Processing stay.
      const reopenTo: TicketStatus | null = REOPENABLE_STATUSES.includes(parent.status)
        ? "OPEN"
        : null;
      let msg: MessageRow;
      let reopened = false;
      try {
        // Append the message + the reopen atomically: a half-applied reopen
        // (message saved, ticket still Closed) is exactly the gap this fixes.
        const created = await this.prisma.$transaction(async (tx) => {
          const message = await tx.message.create({
            data: {
              ticketId: parent.id,
              direction: "inbound",
              senderType: "customer",
              fromEmail: input.requesterEmail,
              toEmail: SUPPORT_INBOUND_ADDRESS,
              subject: input.subject,
              bodyText: input.bodyText,
              bodyHtml: sanitizeEmailHtml(input.bodyHtml),
              messageId,
              inReplyTo: input.inReplyTo ?? null,
            },
          });
          // Guard on the status we read so a concurrent human change isn't clobbered
          // (same posture as the auto-resolve consumer); the matched count tells us
          // whether the reopen applied, so the activity log reflects reality.
          if (reopenTo) {
            const updated = await tx.ticket.updateMany({
              where: { id: parent.id, status: parent.status },
              data: { status: reopenTo },
            });
            reopened = updated.count > 0;
          }
          return message;
        });
        msg = created;
      } catch (err) {
        // Concurrent retry race: another worker appended this message first.
        if (messageId && isUniqueViolation(err)) {
          return { ticketId: parent.id, created: false, appended: false };
        }
        throw err;
      }
      // A customer reply on an existing thread — notify admins + the assignee so
      // the bell surfaces that this ticket needs attention. Best-effort: a failure
      // is logged, never propagated (the message is already persisted).
      try {
        await this.notifications.notifyNewMessage(parent.id);
      } catch (err) {
        this.logger.warn(
          `Notifications: new-message fan-out failed for ticket ${parent.id} — ${err instanceof Error ? err.message : err}`,
        );
      }
      // Push the reply live to anyone viewing this ticket (and toast everyone
      // else who may see it). Best-effort, same swallowed-error posture as the
      // notification fan-out above — a push failure never rolls back the message.
      try {
        await this.realtime.publishTicketReply(parent.id, {
          id: msg.id,
          direction: "inbound",
          senderType: "customer",
          fromEmail: msg.fromEmail,
          toEmail: msg.toEmail,
          // Inbound customer reply by construction: no staff sender, never AI.
          senderName: null,
          senderRole: null,
          isAi: false,
          bodyText: msg.bodyText,
          createdAt: msg.createdAt.toISOString(),
        });
      } catch (err) {
        this.logger.warn(
          `Realtime: reply push failed for ticket ${parent.id} — ${err instanceof Error ? err.message : err}`,
        );
      }
      // Record the customer reply on the activity timeline. No actor — it's an
      // external inbound message. Best-effort; the message is already persisted.
      try {
        await this.activityLogs.record(parent.id, "customer_replied");
      } catch (err) {
        this.logger.warn(
          `Activity: customer_replied log failed for ticket ${parent.id} — ${err instanceof Error ? err.message : err}`,
        );
      }
      // Record the reopen (only if it applied). No actor — it's a system
      // consequence of the customer reply. Best-effort, same posture as above.
      if (reopened && reopenTo) {
        try {
          await this.activityLogs.record(parent.id, "status_changed", {
            change: { field: "status", from: parent.status, to: reopenTo },
          });
        } catch (err) {
          this.logger.warn(
            `Activity: status_changed (reopen) log failed for ticket ${parent.id} — ${err instanceof Error ? err.message : err}`,
          );
        }
      }
      return { ticketId: parent.id, created: false, appended: true };
    }

    // 4. New ticket — create() handles Ticket.messageId idempotency + AI enqueue.
    const { ticket } = await this.create(
      {
        subject: input.subject,
        requesterEmail: input.requesterEmail,
        requesterName: input.requesterName,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml,
        category: input.category,
      },
      { messageId },
    );
    return { ticketId: ticket.id, created: true, appended: false };
  }

  /**
   * Ticket list, server-sorted by the requested column (default `createdAt`
   * DESC = newest first). `q` is a case-insensitive substring match on subject
   * or requester email; status/category/priority are optional equality filters.
   * `view` selects a dashboard bucket predicate (see listTicketsQuerySchema).
   *
   * Scoping: agents see only tickets assigned to them — enforced server-side
   * from the caller's id, so it holds regardless of any client-supplied
   * `assigneeId` (an agent can't peek at a colleague's queue). Admins see the
   * whole shared inbox and may filter by any `assigneeId`. Both roles are still
   * subject to the AI pipeline boundary: the NEW/PROCESSING states are
   * admin-only here, driven by the caller's role.
   */
  async list(opts: ListTicketsQuery, caller: TicketCaller): Promise<TicketListResponse> {
    const { q, status, category, priority, assigneeId, view, sortBy, sortDir, page, pageSize } = opts;
    const { userId, isAdmin } = caller;

    // Build the Prisma `status` field condition. `undefined` means "no status
    // filter" (every status). Precedence: an explicit `status` wins; then a
    // `view` bucket; then the role default. The NEW/PROCESSING pipeline states
    // are hidden from agents in EVERY branch — including an explicit
    // status=NEW, which an agent can only reach by hand-crafting the URL
    // (the dropdown doesn't offer it), and which then yields an empty result.
    let statusFilter:
      | { equals: TicketStatus }
      | { in: TicketStatus[] }
      | { notIn: TicketStatus[] }
      | undefined;
    let requireAiMessage = false;

    if (status) {
      statusFilter = isAdmin || !HIDDEN_FROM_DEFAULT_LIST.includes(status) ? { equals: status } : { in: [] };
    } else if (view === "resolvedByAi") {
      // Resolved/closed tickets whose resolving reply was an AI message — the
      // exact predicate behind the dashboard "Resolved by AI" card.
      statusFilter = { in: RESOLVED_STATUSES };
      requireAiMessage = true;
    } else if (view === "open") {
      // "Open" = not yet resolved. Agents additionally exclude the pipeline states.
      const excluded = isAdmin ? RESOLVED_STATUSES : [...RESOLVED_STATUSES, ...HIDDEN_FROM_DEFAULT_LIST];
      statusFilter = { notIn: excluded };
    } else {
      // Default (and view=all): admins see every status; agents see only the
      // human-actionable inbox (pipeline states hidden).
      statusFilter = isAdmin ? undefined : { notIn: HIDDEN_FROM_DEFAULT_LIST };
    }

    const aiAgentId = requireAiMessage ? await this.systemAgent.getAiAgentId() : null;

    const where = {
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: "insensitive" as const } },
              { requesterEmail: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(requireAiMessage
        ? {
            messages: {
              some: {
                direction: "outbound" as const,
                senderType: "agent" as const,
                OR: [{ senderId: null }, ...(aiAgentId ? [{ senderId: aiAgentId }] : [])],
              },
            },
          }
        : {}),
      ...(category ? { category } : {}),
      ...(priority ? { priority } : {}),
      // Agents are scoped to their own assigned tickets; admins may filter by
      // any assignee (or none for the whole inbox). For agents, their own id
      // always wins over a client-supplied assigneeId so they can't reach a
      // colleague's queue by hand-crafting the query string.
      ...(isAdmin ? (assigneeId ? { assigneeId } : {}) : { assigneeId: userId }),
    };

    // Closed whitelist: only the four allowed columns reach Prisma's orderBy —
    // never an arbitrary key from the query string. Each branch is a valid Prisma
    // orderBy literal, so indexing by the enum-typed `sortBy` is fully type-safe.
    const orderBy = {
      createdAt: { createdAt: sortDir },
      subject: { subject: sortDir },
      requesterName: { requesterName: sortDir },
      status: { status: sortDir },
    }[sortBy];

    const [rows, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return { items: rows.map((t) => this.toListItem(t)), total, page, pageSize };
  }

  /**
   * Per-ticket ownership gate. Admins pass through; agents are restricted to
   * tickets assigned to them. Throws 404 (not 403) whether the ticket is
   * missing OR merely out of scope, so the existence of a ticket an agent can't
   * see is never leaked. Called once at the top of every public per-ticket
   * method; the in-method loads that follow use loadTicketDetail() unchecked.
   */
  private async assertAccess(id: number, caller: TicketCaller): Promise<void> {
    if (caller.isAdmin) return;
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { assigneeId: true },
    });
    if (!ticket || ticket.assigneeId !== caller.userId) {
      throw new NotFoundException("Ticket not found");
    }
  }

  /**
   * Single ticket by id, access-scoped to the caller. Resolves the assignee
   * relation into name/email for human-readable display and includes the
   * conversation `messages` (oldest first), each with its staff `sender` name
   * resolved. Agents get 404 for tickets not assigned to them (via
   * assertAccess); admins see any. Throws NotFoundException (404) otherwise.
   */
  async findOne(id: number, caller: TicketCaller): Promise<TicketDetail> {
    await this.assertAccess(id, caller);
    return this.loadTicketDetail(id);
  }

  /**
   * A ticket's activity timeline (newest first, server-capped). Access-scoped via
   * assertAccess — agents get 404 for tickets not assigned to them, exactly like
   * findOne. Delegates the read to ActivityLogsService.
   */
  async listActivity(id: number, caller: TicketCaller): Promise<TicketActivityItem[]> {
    await this.assertAccess(id, caller);
    return this.activityLogs.listForTicket(id);
  }

  /**
   * Unchecked detail loader — the body of the old findOne(). Public per-ticket
   * methods assert access up front (via assertAccess) then call this for the
   * detail/context, so an operation that reassigns a ticket mid-request (e.g.
   * update moving it off the caller) still resolves and returns normally rather
   * than tripping a second ownership check.
   */
  private async loadTicketDetail(id: number): Promise<TicketDetail> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: { select: { name: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { name: true, role: true } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    const aiAgentId = await this.systemAgent.getAiAgentId();
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      category: ticket.category,
      priority: ticket.priority,
      requesterEmail: ticket.requesterEmail,
      requesterName: ticket.requesterName,
      assigneeId: ticket.assigneeId,
      assigneeName: ticket.assignee ? ticket.assignee.name : null,
      assigneeEmail: ticket.assignee ? ticket.assignee.email : null,
      // `direction` is a plain String column; the create path only ever writes
      // "inbound" | "outbound", so the cast is sound.
      messages: ticket.messages.map((m) => ({
        id: m.id,
        direction: m.direction as "inbound" | "outbound",
        senderType: m.senderType,
        fromEmail: m.fromEmail,
        toEmail: m.toEmail,
        senderName: m.sender ? m.sender.name : null,
        // The sender's role (admin/agent) drives the badge label in the thread;
        // null for inbound customer messages and the system AI, which have no
        // staff sender. Parallels `senderName` from the same `sender` relation.
        senderRole: m.sender ? m.sender.role : null,
        // Authored by the system AI agent — either attributed now (senderId === the
        // AI user) or a legacy reply from before attribution (agent msg, no sender).
        isAi:
          (aiAgentId !== null && m.senderId === aiAgentId) ||
          (m.senderType === "agent" && m.senderId === null),
        bodyText: m.bodyText,
        createdAt: m.createdAt.toISOString(),
      })),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  /**
   * Reply to a ticket — appends an outbound `Message` authored by the signed-in
   * staff agent (`senderId`), addressed to the requester. The email envelope is
   * derived from the ticket (from = the support address, to = requester, subject
   * = "Re: <subject>", inReplyTo = the originating inbound Message-ID when the
   * ticket came from email). `bodyHtml` is intentionally null — there is no
   * rich-text composer and the detail view never trusts composed HTML.
   *
   * Replying to an OPEN ticket also flips it to AWAITING_STUDENT (the agent has
   * replied, now waiting on the requester); RESOLVED/CLOSED tickets are left
   * untouched — no silent reopen. Both writes happen in one transaction.
   *
   * After the in-thread reply is persisted, it is emailed to the requester via
   * Resend (OutboundMailService) — best-effort: a Resend failure is logged
   * but never rolls back the persisted reply or fails this request, so the
   * agent's work survives a transient mail outage. The send carries a
   * client-generated Message-ID (+ In-Reply-To/References to the originating
   * inbound Message-ID), persisted here so a customer reply threads back onto
   * this ticket via the inbound webhook. Access-scoped via assertAccess (agents
   * may only reply to tickets assigned to them); throws NotFoundException (404)
   * for an unknown or out-of-scope ticket.
   */
  async reply(
    ticketId: number,
    input: CreateReplyInput,
    senderId: string,
    caller: TicketCaller,
  ): Promise<TicketDetail> {
    await this.assertAccess(ticketId, caller);
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, subject: true, requesterEmail: true, messageId: true },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");

    const nextStatus = ticket.status === "OPEN" ? "AWAITING_STUDENT" : undefined;
    // Generated up-front so the same Message-ID is both emailed (Resend honors
    // a sender-supplied Message-ID) and persisted — a customer reply threads back
    // here via the inbound webhook's Message.messageId lookup.
    const messageId = this.mail.generateMessageId();
    // Reply FROM the per-ticket address so the customer's reply routes back here
    // (ticket-<id>@<domain>) instead of relying on In-Reply-To/References headers.
    const from = this.mail.ticketReplyAddress(ticketId);

    await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          ticketId: ticket.id,
          direction: "outbound",
          senderType: "agent",
          fromEmail: from,
          toEmail: ticket.requesterEmail,
          subject: `Re: ${ticket.subject}`,
          bodyText: input.bodyText,
          bodyHtml: null,
          senderId,
          messageId,
          inReplyTo: ticket.messageId ?? null,
        },
      });
      if (nextStatus) {
        await tx.ticket.update({ where: { id: ticket.id }, data: { status: nextStatus } });
      }
    });

    // Record the reply (and the OPEN→AWAITING_STUDENT flip, when it happened) on
    // the activity timeline. The signed-in agent is the actor. Best-effort: the
    // reply is already committed, so a logging failure is logged, never propagated.
    try {
      await this.activityLogs.record(ticketId, "agent_replied", { actorUserId: senderId });
      if (nextStatus) {
        await this.activityLogs.record(ticketId, "status_changed", {
          actorUserId: senderId,
          change: { field: "status", from: ticket.status, to: nextStatus },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Activity: agent_replied log failed for ticket ${ticketId} — ${err instanceof Error ? err.message : err}`,
      );
    }

    // Best-effort outbound email — never throws; the in-thread reply is already
    // persisted, so a Resend outage degrades to "reply saved, email not sent"
    // (logged) rather than failing the agent's request.
    await this.mail.sendReply({
      to: ticket.requesterEmail,
      from,
      fromName: this.mail.fromName(),
      subject: `Re: ${ticket.subject}`,
      text: input.bodyText,
      messageId,
      inReplyTo: ticket.messageId ?? undefined,
      references: ticket.messageId ?? undefined,
    });

    return this.loadTicketDetail(ticketId);
  }

  /**
   * AI-polish a drafted reply, using the ticket's conversation as context.
   * Read-only — persists nothing and sends no mail; it returns the improved body
   * for the agent to review and edit before sending. The returned body is signed
   * with the agent's name and the product name (Ticketly). Access is asserted up
   * front (assertAccess), then loadTicketDetail() supplies the conversation
   * context. A model/provider failure surfaces as a 502 Bad Gateway so the client
   * can tell an AI outage apart from an app error. Throws NotFoundException (404)
   * for an unknown or out-of-scope ticket.
   */
  async polish(
    id: number,
    input: PolishReplyInput,
    agentName: string,
    caller: TicketCaller,
  ): Promise<PolishReplyResult> {
    await this.assertAccess(id, caller);
    const ticket = await this.loadTicketDetail(id);
    let bodyText: string;
    try {
      bodyText = await this.ai.polishReply(input.bodyText, ticket, agentName);
    } catch {
      throw new BadGatewayException("Polish service is unavailable");
    }
    if (!bodyText) throw new BadGatewayException("Polish service returned no content");
    return { bodyText };
  }

  /**
   * AI-summarize a ticket and its conversation. Read-only — persists nothing; it
   * returns a plain-text digest for the agent. The summary is generated fresh on
   * every call (no caching), so the client "regenerates" simply by calling again.
   * Access is asserted up front (assertAccess), then loadTicketDetail() supplies
   * the conversation context. A model/provider failure surfaces as a 502 Bad
   * Gateway so the client can tell an AI outage apart from an app error. Throws
   * NotFoundException (404) for an unknown or out-of-scope ticket.
   */
  async summarize(id: number, caller: TicketCaller): Promise<SummarizeTicketResult> {
    await this.assertAccess(id, caller);
    const ticket = await this.loadTicketDetail(id);
    let summary: string;
    try {
      summary = await this.ai.summarizeTicket(ticket);
    } catch {
      throw new BadGatewayException("Summarize service is unavailable");
    }
    if (!summary) throw new BadGatewayException("Summarize service returned no content");
    return { summary };
  }

  /**
   * Update a ticket. Today only `assigneeId` is supported: set it to a staff
   * user id, or `null` to unassign. The assignee is validated (exists and not
   * soft-deleted) before writing; there's no separate role check since only
   * `admin`/`agent` users exist. Returns the fresh detail via loadTicketDetail().
   * Access-scoped via assertAccess (agents may only update tickets assigned to
   * them); throws NotFoundException (404) for an unknown or out-of-scope ticket,
   * BadRequestException (400) for an invalid assignee.
   */
  async update(id: number, input: UpdateTicketInput, caller: TicketCaller): Promise<TicketDetail> {
    await this.assertAccess(id, caller);
    // The pre-edit row is read here so we can (a) tell when ownership moves away
    // from a user and clear their unread notifications for this ticket, and (b)
    // capture before→after for the activity log on every changed field. Only the
    // four editable scalars are selected.
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { id: true, assigneeId: true, status: true, priority: true, category: true },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");

    if (input.assigneeId !== undefined && input.assigneeId !== null) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: input.assigneeId },
        select: { deletedAt: true },
      });
      if (!assignee || assignee.deletedAt) {
        throw new BadRequestException("Invalid assignee");
      }
    }

    // Partial update — only the fields the client sent. `undefined` = leave
    // unchanged; `null` = clear (unassign / uncategory). Mirrors the conditional
    // spread used to build `where` in list(); invalid enum values were already
    // rejected by the Zod parse in the controller.
    const data = {
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      // Stamp the resolution time when a ticket is first resolved/closed, powering
      // the dashboard's average-resolution-time metric (null until then).
      ...(input.status === "RESOLVED" || input.status === "CLOSED" ? { resolvedAt: new Date() } : {}),
    };

    await this.prisma.ticket.update({ where: { id }, data });

    // Record one activity event per field that actually changed (undefined input
    // = unchanged). For assignee we store display names so the feed renders
    // join-free; the other fields carry their raw enum value (the UI labels them).
    const changes: Array<{ type: TicketActivityType; change: ActivityChange }> = [];
    if (input.status !== undefined && input.status !== ticket.status) {
      changes.push({ type: "status_changed", change: { field: "status", from: ticket.status, to: input.status } });
    }
    if (input.priority !== undefined && input.priority !== ticket.priority) {
      changes.push({ type: "priority_changed", change: { field: "priority", from: ticket.priority, to: input.priority } });
    }
    // `category` is nullable (null = uncategorized): compare against the stored value directly.
    if (input.category !== undefined && input.category !== ticket.category) {
      changes.push({ type: "category_changed", change: { field: "category", from: ticket.category, to: input.category } });
    }
    if (input.assigneeId !== undefined && input.assigneeId !== ticket.assigneeId) {
      const [fromName, toName] = await Promise.all([
        this.assigneeDisplayName(ticket.assigneeId),
        this.assigneeDisplayName(input.assigneeId ?? null),
      ]);
      changes.push({ type: "assignee_changed", change: { field: "assignee", from: fromName, to: toName } });
    }
    for (const c of changes) {
      try {
        await this.activityLogs.record(id, c.type, { actorUserId: caller.userId, change: c.change });
      } catch (err) {
        this.logger.warn(
          `Activity: ${c.type} log failed for ticket ${id} — ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // Ownership-change side effects on the bell. `undefined` = assignee unchanged.
    const newAssigneeId = input.assigneeId === undefined ? ticket.assigneeId : input.assigneeId;
    const assigneeChanged = newAssigneeId !== ticket.assigneeId;

    // Moving AWAY from a previous owner (unassign or reassign): clear their unread
    // notifications for this ticket so it stops surfacing in their bell.
    if (ticket.assigneeId && assigneeChanged) {
      try {
        await this.notifications.clearUnreadForTicket(ticket.assigneeId, id);
      } catch (err) {
        this.logger.warn(
          `Notifications: could not clear unread for ticket ${id} on reassign — ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // Moving TO a new human owner: ping them that the ticket is now theirs. The AI
    // agent is excluded inside notifyAssigned, so a (re)assignment back to the AI
    // pipeline is a no-op.
    if (newAssigneeId && assigneeChanged) {
      try {
        await this.notifications.notifyAssigned(id, newAssigneeId);
      } catch (err) {
        this.logger.warn(
          `Notifications: assigned fan-out failed for ticket ${id} — ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    return this.loadTicketDetail(id);
  }

  /**
   * Staff available for assignment (non-deleted users, name-sorted). Minimal
   * projection — only id/name/role — so the staff-wide assignee endpoint doesn't
   * expose the admin directory's email/account fields.
   */
  async listAssignees(): Promise<AssigneeOption[]> {
    const users = await this.prisma.user.findMany({
      // Exclude the AI system agent — humans shouldn't manually assign to it.
      where: { deletedAt: null, email: { not: SYSTEM_AGENT_EMAIL } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      // Prisma `Role` is a string-literal union identical to the shared
      // `userRoleEnum` (`AssigneeOption.role`), so no cast is needed.
      role: u.role,
    }));
  }

  /**
   * A user's display name for the activity log's assignee change snapshots, or
   * "(unassigned)" for null. A missing/soft-deleted user resolves to a fallback
   * so the before→after row still reads sensibly.
   */
  private async assigneeDisplayName(userId: string | null): Promise<string> {
    if (!userId) return "(unassigned)";
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return u?.name ?? "(deleted user)";
  }

  /** Map a Prisma `Ticket` row to the wire shape (timestamps → ISO strings). */
  private toListItem(t: TicketRow): TicketListItem {
    return {
      id: t.id,
      subject: t.subject,
      status: t.status,
      category: t.category,
      priority: t.priority,
      requesterEmail: t.requesterEmail,
      requesterName: t.requesterName,
      assigneeId: t.assigneeId,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}

/** Duck-typed Prisma unique-constraint check (code P2002), avoiding a client import. */
function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2002";
}
