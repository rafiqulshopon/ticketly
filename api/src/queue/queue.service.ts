import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PgBoss, type SendOptions, type WorkHandler, type WorkOptions } from "pg-boss";

/**
 * Thin Nest wrapper around a single {@link PgBoss} instance — the project's job
 * queue. pg-boss lives in the same Postgres the app already uses (`DATABASE_URL`),
 * so this adds no new infrastructure (no Redis). It manages its OWN schema
 * (`pgboss`) and housekeeping tables on `start()`; those are intentionally NOT in
 * `schema.prisma` (they're queue plumbing, not domain models).
 *
 * Mirrors the lifecycle shape of `PrismaService`: start on `onModuleInit`, stop on
 * `onModuleDestroy`. The stop only actually runs because `main.ts` calls
 * `app.enableShutdownHooks()` — without that Nest never fires `onModuleDestroy`.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly boss: PgBoss;

  constructor() {
    this.boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      // Explicit for clarity; keeps pg-boss's housekeeping tables isolated in
      // their own schema, separate from the app tables Prisma manages.
      schema: "pgboss",
    });
    // pg-boss emits internal errors here (connection loss, failed maintenance,
    // etc.). Handler-thrown job errors are NOT routed here — those are caught,
    // retried, and (once exhausted) marked failed in the queue itself.
    this.boss.on("error", (error: Error) => {
      this.logger.error(`pg-boss: ${error.message}`, error.stack);
    });
  }

  async onModuleInit(): Promise<void> {
    // start() runs the schema migration (idempotent) and begins the maintenance
    // monitors. Safe to call on every boot — existing tables are left untouched.
    await this.boss.start();
  }

  async onModuleDestroy(): Promise<void> {
    // Graceful drain: stops polling, lets in-flight jobs settle, then closes the
    // pool. Without enableShutdownHooks this is never reached.
    await this.boss.stop();
  }

  /** Create a queue if it doesn't exist (idempotent). */
  createQueue(name: string): Promise<void> {
    return this.boss.createQueue(name);
  }

  /** Enqueue a job. Resolves to the job id (or null for throttled/unique sends). */
  send<TData extends object>(name: string, data: TData, options?: SendOptions): Promise<string | null> {
    return this.boss.send(name, data, options);
  }

  /**
   * Register a worker that polls `name`. Returns the worker id. The handler
   * receives a batch (a `Job[]`); with `batchSize: 1` it's always a single job,
   * which keeps per-job retry semantics clean for slow LLM-backed jobs.
   */
  work<TData extends object>(
    name: string,
    options: WorkOptions,
    handler: WorkHandler<TData>,
  ): Promise<string> {
    return this.boss.work<TData>(name, options, handler);
  }
}
