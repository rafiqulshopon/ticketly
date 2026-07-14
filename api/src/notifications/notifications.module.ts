import { Module } from "@nestjs/common";
import { DevicesController } from "./devices.controller";
import { NotificationsController } from "./notifications.controller";
import { NotificationsPushConsumer } from "./notifications.push-consumer";
import { NotificationsService } from "./notifications.service";
import { PushNotificationsService } from "./push-notifications.service";

/**
 * Notifications feature: the in-app bell (`NotificationsService` +
 * `NotificationsController`) and the mobile push channel
 * (`PushNotificationsService` + `DevicesController` + the `send-push` pg-boss
 * consumer). Every provider depends only on globals (`PrismaService`,
 * `QueueService`), so this module needs no imports. `NotificationsService` is
 * exported so `TicketsModule` can fan out on ticket/message writes; the push
 * service is consumed internally by the bell fan-out (via the queue) and the
 * devices controller.
 */
@Module({
  controllers: [NotificationsController, DevicesController],
  providers: [NotificationsService, PushNotificationsService, NotificationsPushConsumer],
  exports: [NotificationsService],
})
export class NotificationsModule {}
