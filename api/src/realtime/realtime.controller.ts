import { Controller, Sse } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import { Roles, Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Observable } from "rxjs";
import { auth } from "../auth/auth.config";
import { RealtimeService } from "./realtime.service";

/**
 * Single Server-Sent-Events endpoint: `GET /api/realtime`. Each logged-in user
 * gets one stream carrying the live ticket events they may see (`new_message`,
 * `new_ticket`). The browser's `EventSource` sends the Better Auth session cookie
 * automatically, so the global `AuthGuard` authenticates the handshake exactly
 * like any other `/api` GET — no `@AllowAnonymous`, and `@Roles` is the explicit
 * access decision. `@Session()` gives the broker the per-user key; Nest keeps the
 * connection open and auto-tears-down the returned Observable on disconnect.
 */
@ApiTags("realtime")
@Controller("realtime")
@Roles(["admin", "agent"])
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @ApiOperation({ summary: "Server-Sent Events stream of live ticket events (new_message, new_ticket)" })
  @Sse()
  stream(@Session() session: UserSession<typeof auth>): Observable<MessageEvent> {
    return this.realtime.openStream(session.user.id);
  }
}
