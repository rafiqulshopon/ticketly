import { z } from "zod";

/**
 * In-app notifications surfaced through the navbar bell. Three trigger events:
 *
 *  - `new_ticket`       — a ticket was created (every admin; the human assignee if any).
 *  - `new_message`      — an inbound customer message arrived on a ticket (every admin;
 *                         the human assignee).
 *  - `ticket_assigned`  — a ticket was assigned/reassigned to a human agent (that agent
 *                         only — admins already see all ticket activity).
 *
 * Agents only ever receive notifications for tickets assigned to them; once
 * unassigned, no further notifications are produced for that ticket. The fan-out
 * (who gets a row) happens server-side, so each user's feed is just their own rows.
 */
export const notificationTypeSchema = z.enum(["new_ticket", "new_message", "ticket_assigned"]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

/**
 * One notification row as seen on the wire. Timestamps are ISO strings (Nest
 * serializes the stored `Date`s); the client parses them for display.
 */
export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  ticketId: z.number().int(),
  ticketSubject: z.string(),
  requesterName: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export type Notification = z.infer<typeof notificationSchema>;

/** Bell badge payload — the count of unread rows for the current user. */
export const unreadCountSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type UnreadCount = z.infer<typeof unreadCountSchema>;

// ---------------------------------------------------------------------------
// Mobile push-token registration (`POST/DELETE /api/notifications/devices`).
// ---------------------------------------------------------------------------

/** Device platform for a registered Expo push token. */
export const platformSchema = z.enum(["ios", "android"]);
export type Platform = z.infer<typeof platformSchema>;

/** Body of `POST /api/notifications/devices` — register/refresh a device's Expo push token. */
export const registerPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: platformSchema,
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

/** Body of `DELETE /api/notifications/devices` — drop a device's Expo push token (on logout). */
export const unregisterPushTokenSchema = z.object({
  token: z.string().min(1),
});
export type UnregisterPushTokenInput = z.infer<typeof unregisterPushTokenSchema>;
