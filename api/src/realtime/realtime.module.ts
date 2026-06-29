import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";

/**
 * Realtime push (Server-Sent Events). The service reuses
 * `NotificationsService.recipientUserIds` for its audience, so it imports
 * `NotificationsModule`; `NotificationsModule` imports nothing here, so there's
 * no cycle. `TicketsModule` imports this module to emit events on ticket/message
 * writes; the controller exposes the `/api/realtime` stream.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
