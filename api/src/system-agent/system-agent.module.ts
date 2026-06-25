import { Global, Module } from "@nestjs/common";
import { SystemAgentService } from "./system-agent.service";

/** Global so TicketsService, the auto-resolve consumer, and DashboardService can
 *  inject SystemAgentService without each importing this module. */
@Global()
@Module({
  providers: [SystemAgentService],
  exports: [SystemAgentService],
})
export class SystemAgentModule {}
