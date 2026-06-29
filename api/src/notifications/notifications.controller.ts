import { Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { Roles, Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { auth } from "../auth/auth.config";
import { NotificationsService } from "./notifications.service";

/**
 * Per-user notification feed for the navbar bell. The class-level
 * `@Roles(["admin", "agent"])` is the access decision for every handler: the
 * global AuthGuard rejects any non-staff session with 403 before it runs. Every
 * read/write is then scoped to `session.user.id` in the service — each user only
 * ever sees their own fanned-out rows (admins got their own copies at fan-out
 * time, so they still see all ticket activity).
 */
@ApiTags("notifications")
@Controller("notifications")
@Roles(["admin", "agent"])
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiOperation({ summary: "List the current user's notifications (newest first)" })
  @Get()
  list(@Session() session: UserSession<typeof auth>) {
    return this.notifications.listForUser(session.user.id);
  }

  @ApiOperation({ summary: "Unread notification count (for the bell badge)" })
  @Get("unread-count")
  unreadCount(@Session() session: UserSession<typeof auth>) {
    return this.notifications.getUnreadCount(session.user.id);
  }

  @ApiOperation({ summary: "Mark a single notification as read" })
  @Patch(":id/read")
  markRead(@Param("id") id: string, @Session() session: UserSession<typeof auth>) {
    return this.notifications.markRead(session.user.id, id);
  }

  @ApiOperation({ summary: "Mark all unread notifications as read" })
  @Post("read-all")
  markAllRead(@Session() session: UserSession<typeof auth>) {
    return this.notifications.markAllRead(session.user.id);
  }
}
