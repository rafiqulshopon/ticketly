import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { ActivityLogsService } from "./activity-logs.service";

/**
 * Ticket activity timeline. The service depends on `RealtimeService` (to push new
 * rows live) and the global `PrismaService`, so this module imports only
 * `RealtimeModule`; `RealtimeModule` already imports `NotificationsModule`
 * (one-way), and `TicketsModule` imports this module — no cycle.
 *
 * There's no controller here: the read endpoint lives on `TicketsController`
 * (it's per-ticket and reuses the private `TicketsService.assertAccess` gate), so
 * only the service is exported.
 */
@Module({
  imports: [RealtimeModule],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService],
})
export class ActivityLogsModule {}
