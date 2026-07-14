import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import type { Job } from "pg-boss";
import { SEND_PUSH_QUEUE, type SendPushJobData } from "../queue/queue.constants";
import { QueueService } from "../queue/queue.service";
import { PushNotificationsService } from "./push-notifications.service";

/**
 * Consumes the {@link SEND_PUSH_QUEUE} and delivers each push via Expo. Mirrors
 * `ClassifyTicketConsumer`: registers the worker in `onApplicationBootstrap`
 * (after `QueueService.start()` has prepared the `pgboss` schema) and works one
 * job at a time (`batchSize: 1`) so a slow Expo send can't entangle retries.
 *
 * Handler contract: a DB error fetching tokens (thrown by `send` before any
 * push goes out) propagates so pg-boss retries it — safe, because no push was
 * sent yet, so a retry can't duplicate. Expo per-chunk send errors are caught
 * inside `send` (logged + Sentry-captured) and the job completes, deliberately
 * NOT retried to avoid duplicating pushes on the chunks that already succeeded.
 */
@Injectable()
export class NotificationsPushConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsPushConsumer.name);

  constructor(
    private readonly queue: QueueService,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.createQueue(SEND_PUSH_QUEUE);
    await this.queue.work<SendPushJobData>(SEND_PUSH_QUEUE, { batchSize: 1 }, (jobs) =>
      this.process(jobs),
    );
    this.logger.log(`Worker registered for queue "${SEND_PUSH_QUEUE}".`);
  }

  private async process(jobs: Job<SendPushJobData>[]): Promise<void> {
    for (const job of jobs) {
      await this.deliver(job.data);
    }
  }

  private async deliver(data: SendPushJobData): Promise<void> {
    await this.pushNotifications.send(data.recipientUserIds, {
      title: data.title,
      body: data.body,
      data: data.data,
    });
  }
}
