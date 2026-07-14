import { BadRequestException, Body, Controller, Delete, HttpCode, Post } from "@nestjs/common";
import { Roles, Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  registerPushTokenSchema,
  unregisterPushTokenSchema,
  type RegisterPushTokenInput,
  type UnregisterPushTokenInput,
} from "@ticketly/shared";
import { auth } from "../auth/auth.config";
import { PushNotificationsService } from "./push-notifications.service";

/**
 * Mobile push-token registration. A device registers its Expo push token on
 * sign-in (so the server can push to it while the app is closed/backgrounded)
 * and unregisters on sign-out. The class-level `@Roles(["admin", "agent"])` is
 * the access decision; the token is always bound to `session.user.id`, so a
 * request can only register/unregister for itself — never for another user.
 *
 * Mounted under `/api/notifications/devices`, alongside the bell feed it
 * complements (the bell covers the open-app case; push covers the closed case).
 */
@ApiTags("notifications")
@Controller("notifications/devices")
@Roles(["admin", "agent"])
export class DevicesController {
  constructor(private readonly pushNotifications: PushNotificationsService) {}

  @ApiOperation({ summary: "Register/refresh the current device's Expo push token" })
  @Post()
  @HttpCode(204)
  async register(@Body() body: unknown, @Session() session: UserSession<typeof auth>) {
    let input: RegisterPushTokenInput;
    try {
      input = registerPushTokenSchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid push token payload");
    }
    await this.pushNotifications.registerToken(session.user.id, input.token, input.platform);
  }

  @ApiOperation({ summary: "Unregister the current device's Expo push token (on logout)" })
  @Delete()
  @HttpCode(204)
  async unregister(@Body() body: unknown, @Session() session: UserSession<typeof auth>) {
    let input: UnregisterPushTokenInput;
    try {
      input = unregisterPushTokenSchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid push token payload");
    }
    await this.pushNotifications.unregisterToken(input.token);
  }
}
