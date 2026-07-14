import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { Expo } from "expo-server-sdk";
import type { Platform } from "@ticketly/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * The push-notification channel: owns Expo push tokens and the Expo push API.
 *
 * The in-app bell (`NotificationsService`) writes DB rows for the open-app
 * case; this service delivers the OS-visible banner for the closed/backgrounded
 * case (when the SSE realtime stream is suspended). It is called only by the
 * `send-push` pg-boss consumer (`NotificationsPushConsumer`), never inline in a
 * request, so an Expo outage or a slow push send can never delay or break a
 * ticket write — it just retries in the queue.
 *
 * Token model: one row per Expo push token (globally unique). A device is a
 * physical install, so on re-login — even as a different user — the row is
 * upserted in place and `userId` is reassigned, rather than leaking pushes to
 * the previous account. Tokens Expo reports as `DeviceNotRegistered` (uninstall,
 * expiry) are purged on send so dead devices stop consuming sends.
 */
@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  /** Access token only needed when Expo push-security is enabled on the project. */
  private readonly expo = new Expo(
    process.env.EXPO_ACCESS_TOKEN ? { accessToken: process.env.EXPO_ACCESS_TOKEN } : undefined,
  );

  constructor(private readonly prisma: PrismaService) {}

  /** Upsert a device's token for the given user (reassigns `userId` on re-login). */
  async registerToken(userId: string, token: string, platform: Platform): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  /** Remove a device's token (on logout). A missing row is a no-op. */
  async unregisterToken(token: string): Promise<void> {
    try {
      await this.prisma.pushToken.delete({ where: { token } });
    } catch (err) {
      // P2025 = "record not found" — already gone (e.g. a raced logout). Swallow
      // it; surface anything else as a warning so we never fail the request.
      if ((err as { code?: string })?.code !== "P2025") {
        this.logger.warn(`unregisterToken: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  /**
   * Send a push to every token owned by `userIds`. Fetches tokens, chunks them
   * (Expo caps a single send at 100), and dispatches per chunk. A failing chunk
   * is logged + Sentry-captured but never aborts the other chunks, and is NOT
   * re-thrown — re-throwing would make pg-boss retry the whole job and duplicate
   * pushes for the chunks that already succeeded. Tokens Expo reports as
   * `DeviceNotRegistered` are purged afterwards.
   *
   * Only a DB error fetching tokens propagates (before any send happens, so a
   * retry is safe and duplicate-free) — that's the case pg-boss retries.
   */
  async send(
    userIds: string[],
    payload: { title: string; body: string; data: { type: string; ticketId: number } },
  ): Promise<void> {
    if (userIds.length === 0) return;
    const rows = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    // `isExpoPushToken` is a cheap sanity guard against a stale malformed row.
    const tokens = rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
    if (tokens.length === 0) return;

    const messages = tokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: "default" as const,
      channelId: "default",
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    const badTokens: string[] = [];
    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (const ticket of tickets) {
          if (ticket.status !== "error") continue;
          const details = ticket.details;
          if (details?.error === "DeviceNotRegistered") {
            // `expoPushToken` is the offending token for this error.
            if (details.expoPushToken) badTokens.push(details.expoPushToken);
          } else {
            this.logger.warn(`Push ticket error: ${ticket.message}`);
          }
        }
      } catch (err) {
        Sentry.captureException(err);
        this.logger.error(`Push send chunk failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (badTokens.length > 0) {
      try {
        await this.prisma.pushToken.deleteMany({ where: { token: { in: badTokens } } });
        this.logger.log(`Purged ${badTokens.length} unregistered push token(s).`);
      } catch (err) {
        Sentry.captureException(err);
        this.logger.error(`Push token purge failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
}
