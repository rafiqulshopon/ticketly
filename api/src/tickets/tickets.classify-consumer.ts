import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import type { Job } from "pg-boss";
import { ActivityLogsService } from "../activity-logs/activity-logs.service";
import { AiService } from "../ai/ai.service";
import { PrismaService } from "../prisma/prisma.service";
import { SystemAgentService } from "../system-agent/system-agent.service";
import {
  CLASSIFY_TICKET_QUEUE,
  type ClassifyTicketJobData,
} from "../queue/queue.constants";
import { QueueService } from "../queue/queue.service";

/**
 * Consumes the {@link CLASSIFY_TICKET_QUEUE} and writes each ticket's AI-derived
 * `category`. This is the durable, retried replacement for the old fire-and-forget
 * `TicketsService.classifyInBackground` — the same `AiService.classifyTicket` call,
 * now run by a pg-boss worker instead of an un-awaited in-process promise.
 *
 * Registers the worker in `onApplicationBootstrap` (after every `onModuleInit` has
 * resolved, so `QueueService.start()` has already prepared the schema) and works one
 * job at a time (`batchSize: 1`) so a slow LLM call can't entangle retries.
 *
 * Handler contract: a provider/network/DB error is **re-thrown** so pg-boss retries
 * it (bounded by `CLASSIFY_TICKET_SEND_OPTIONS.retryLimit`); an "unparseable reply"
 * that yields `null` is a *successful* attempt, so it completes the job and leaves
 * the ticket uncategorized rather than burning retries on a bad model output.
 */
@Injectable()
export class ClassifyTicketConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(ClassifyTicketConsumer.name);

  constructor(
    private readonly queue: QueueService,
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly systemAgent: SystemAgentService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.createQueue(CLASSIFY_TICKET_QUEUE);
    await this.queue.work<ClassifyTicketJobData>(CLASSIFY_TICKET_QUEUE, { batchSize: 1 }, (jobs) =>
      this.process(jobs),
    );
    this.logger.log(`Worker registered for queue "${CLASSIFY_TICKET_QUEUE}".`);
  }

  private async process(jobs: Job<ClassifyTicketJobData>[]): Promise<void> {
    for (const job of jobs) {
      await this.classify(job.id, job.data);
    }
  }

  private async classify(jobId: string, data: ClassifyTicketJobData): Promise<void> {
    const { ticketId, subject, body } = data;
    // Throws on provider/network error → pg-boss retries the job. A null result is
    // a valid "couldn't decide" outcome, handled below without throwing.
    const category = await this.ai.classifyTicket(subject, body);
    if (!category) {
      this.logger.warn(`Classify: ticket ${ticketId} (job ${jobId}) returned no usable category — leaving it uncategorized.`);
      return;
    }
    // Read the prior category so the activity log can show before→after (null =
    // uncategorized). Skipped when the category is unchanged.
    const before = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { category: true },
    });
    await this.prisma.ticket.update({ where: { id: ticketId }, data: { category } });
    this.logger.log(`Classify: ticket ${ticketId} → ${category}.`);
    if (before && before.category !== category) {
      // Attribute the classification to the system AI agent (null if unseeded).
      // Best-effort: the category write is already committed.
      try {
        const aiAgentId = await this.systemAgent.getAiAgentId();
        await this.activityLogs.record(ticketId, "category_changed", {
          actorUserId: aiAgentId,
          change: { field: "category", from: before.category, to: category },
        });
      } catch (err) {
        this.logger.warn(
          `Activity: category_changed log failed for ticket ${ticketId} — ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }
}
