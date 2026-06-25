import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import type { Job } from "pg-boss";
import type { TicketStatus } from "../generated/prisma/client";
import { AiService } from "../ai/ai.service";
import { PrismaService } from "../prisma/prisma.service";
import { SystemAgentService } from "../system-agent/system-agent.service";
import {
  AUTO_RESOLVE_TICKET_QUEUE,
  type AutoResolveTicketJobData,
} from "../queue/queue.constants";
import { QueueService } from "../queue/queue.service";
import { SUPPORT_INBOUND_ADDRESS } from "./tickets.service";

/**
 * Consumes the {@link AUTO_RESOLVE_TICKET_QUEUE} and drives the AI auto-resolution
 * lifecycle for each newly created ticket:
 *
 *   NEW → PROCESSING → RESOLVED   (the KB fully answered it; a reply is posted)
 *                  ↘ OPEN         (it couldn't be — left for a human)
 *
 * Mirrors {@link ClassifyTicketConsumer}: registers the worker in
 * `onApplicationBootstrap` and works one job at a time (`batchSize: 1`) so a slow
 * LLM call can't entangle retries. Only `autoResolve === true && confidence ===
 * "high"` resolves — the escalation policy + confidence gate inside
 * `AiService.decideAutoResolve` are the safety control.
 *
 * Fault handling: a DB error (loading the ticket, setting PROCESSING, the final
 * transition) is re-thrown so pg-boss retries it. The AI call itself is wrapped
 * so a model/provider/structured-output failure degrades the ticket to OPEN
 * instead of retrying forever — that way a persistently failing model never
 * strands a ticket in PROCESSING (invisible on the default list). Status
 * transitions are conditional on the ticket still being PROCESSING, so a human
 * who grabs the ticket mid-flight is never clobbered.
 */
@Injectable()
export class AutoResolveTicketConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutoResolveTicketConsumer.name);

  constructor(
    private readonly queue: QueueService,
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly systemAgent: SystemAgentService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.createQueue(AUTO_RESOLVE_TICKET_QUEUE);
    await this.queue.work<AutoResolveTicketJobData>(
      AUTO_RESOLVE_TICKET_QUEUE,
      { batchSize: 1 },
      (jobs) => this.process(jobs),
    );
    this.logger.log(`Worker registered for queue "${AUTO_RESOLVE_TICKET_QUEUE}".`);
  }

  private async process(jobs: Job<AutoResolveTicketJobData>[]): Promise<void> {
    for (const job of jobs) {
      await this.autoResolve(job.id, job.data);
    }
  }

  private async autoResolve(jobId: string, data: AutoResolveTicketJobData): Promise<void> {
    const { ticketId } = data;

    // Re-read the ticket + its first inbound message (the body to feed the model).
    // Throws on DB error → pg-boss retries.
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        messages: { where: { direction: "inbound" }, orderBy: { createdAt: "asc" }, take: 1 },
      },
    });
    if (!ticket) {
      this.logger.warn(`Auto-resolve: ticket ${ticketId} (job ${jobId}) not found — skipping.`);
      return;
    }

    // Don't touch a ticket a human has already closed.
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      this.logger.log(`Auto-resolve: ticket ${ticketId} already ${ticket.status}, skipping.`);
      return;
    }

    // Mark the ticket as being processed so the UI/queue can show it's in flight.
    await this.prisma.ticket.update({ where: { id: ticketId }, data: { status: "PROCESSING" } });

    // The AI call degrades to OPEN on failure (no retry) — see class doc.
    let decision;
    try {
      decision = await this.ai.decideAutoResolve({
        subject: ticket.subject,
        body: ticket.messages[0]?.bodyText ?? "",
        requesterName: ticket.requesterName,
      });
    } catch (err) {
      this.logger.warn(
        `Auto-resolve: model call failed for ticket ${ticketId} (job ${jobId}), reverting to OPEN — ${err instanceof Error ? err.message : err}`,
      );
      await this.transition(ticketId, "OPEN");
      return;
    }

    if (decision.autoResolve && decision.confidence === "high") {
      // Attribute the reply to the system AI agent so the thread shows who answered.
      const aiAgentId = await this.systemAgent.getAiAgentId();
      // Post the KB-grounded reply and resolve in one transaction. The transition
      // is conditional on PROCESSING so a mid-flight human edit isn't clobbered
      // (and no orphan reply is left behind if it is).
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.ticket.updateMany({
          where: { id: ticketId, status: "PROCESSING" },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        });
        if (updated.count === 0) {
          this.logger.log(`Auto-resolve: ticket ${ticketId} left PROCESSING before resolve — skipping.`);
          return;
        }
        await tx.message.create({
          data: {
            ticketId,
            direction: "outbound",
            senderType: "agent",
            // Authored by the system AI agent (null only if it isn't seeded yet).
            senderId: aiAgentId,
            fromEmail: SUPPORT_INBOUND_ADDRESS,
            toEmail: ticket.requesterEmail,
            subject: `Re: ${ticket.subject}`,
            bodyText: decision.reply,
            bodyHtml: null,
            inReplyTo: ticket.messageId ?? null,
          },
        });
      });
      this.logger.log(`Auto-resolve: ticket ${ticketId} resolved via knowledge base.`);
    } else {
      await this.transition(ticketId, "OPEN");
      this.logger.log(
        `Auto-resolve: ticket ${ticketId} left OPEN (${decision.confidence}: ${decision.reasoning}).`,
      );
    }
  }

  /** Move a PROCESSING ticket to `status` and release it to the shared inbox by
   *  unassigning the AI agent. No-op if the ticket was changed out from under us
   *  (e.g. a human grabbed it mid-flight and changed its status). Only ever called
   *  with OPEN. */
  private async transition(ticketId: number, status: Exclude<TicketStatus, "PROCESSING">): Promise<void> {
    const updated = await this.prisma.ticket.updateMany({
      where: { id: ticketId, status: "PROCESSING" },
      data: { status, assigneeId: null },
    });
    if (updated.count === 0) {
      this.logger.log(`Auto-resolve: ticket ${ticketId} left PROCESSING — not forcing ${status}.`);
    }
  }
}
