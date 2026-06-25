import { Controller, Get } from "@nestjs/common";
import { Roles } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";

/**
 * Admin-only dashboard metrics. The class-level `@Roles(["admin"])` is the access
 * decision: the global AuthGuard rejects any non-admin session with 403 before
 * the handler runs.
 */
@ApiTags("dashboard")
@Controller("dashboard")
@Roles(["admin"])
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @ApiOperation({ summary: "Dashboard metrics (admin only)" })
  @Get("stats")
  stats() {
    return this.dashboard.getStats();
  }
}
