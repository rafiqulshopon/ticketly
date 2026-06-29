import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

/**
 * Notifications feature. The service depends only on the global `PrismaService`
 * and `SystemAgentService`, so this module needs no imports — it just provides
 * the controller + service and exports the service so `TicketsModule` can inject
 * it to fan out notifications on ticket/message writes.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
