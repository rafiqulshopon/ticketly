import { Module } from "@nestjs/common";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { AiModule } from "../ai/ai.module";
import { OutboundMailModule } from "../channels/email/outbound-mail.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { AutoResolveTicketConsumer } from "./tickets.auto-resolve-consumer";
import { ClassifyTicketConsumer } from "./tickets.classify-consumer";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  imports: [AiModule, OutboundMailModule, NotificationsModule, RealtimeModule, ActivityLogsModule],
  controllers: [TicketsController],
  providers: [TicketsService, ClassifyTicketConsumer, AutoResolveTicketConsumer],
  exports: [TicketsService],
})
export class TicketsModule {}
