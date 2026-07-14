import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useSession } from "@/lib/auth";
import { registerPushToken, unregisterPushToken } from "@/lib/api";

// Foreground behavior: a push arriving while the app is open must NOT show a
// banner — the realtime SSE hook (`useRealtimeEvents`) already toasts live
// events, so a banner would double-notify. Badge + sound still update. Set once
// at module scope: `setNotificationHandler` registers a singleton, not per-render.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Read the `ticketId` a push carries in its `data` payload, if any. */
function ticketIdFromNotification(
  notification: Notifications.Notification,
): number | undefined {
  const raw = notification.request.content.data?.ticketId;
  return typeof raw === "number" ? raw : undefined;
}

/**
 * Register the device for Expo push notifications and react to taps. The
 * push counterpart to `useRealtimeEvents`: SSE covers the open-app case (live
 * toasts + cache invalidation); this covers the closed/backgrounded case (the
 * OS banner that appears when the app is off). Self-gates on the session —
 * registers on sign-in, unregisters on sign-out — so a logged-out device stops
 * receiving pushes.
 *
 * - Foreground pushes are suppressed (SSE handles them); badge + sound update.
 * - Tapping a push (or cold-starting from one) deep-links to `/tickets/{id}`.
 * - A foreground receive still invalidates the ticket/notification caches, as a
 *   backstop in case the SSE stream has reconnected late.
 *
 * Token registration is skipped on simulators/emulators (`Device.isDevice`):
 * Expo can't issue a real push token without physical hardware.
 */
export function usePushNotifications(): void {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const tokenRef = useRef<string | null>(null);

  // Register/unregister the push token with the server, following the session.
  useEffect(() => {
    if (!session) {
      // Signed out (or not yet authed) — drop the token we registered, if any.
      const token = tokenRef.current;
      if (token) {
        tokenRef.current = null;
        unregisterPushToken(token).catch(() => {
          /* best-effort: a failed unregister just leaves a stale server row */
        });
      }
      return;
    }

    let cancelled = false;

    async function register(): Promise<void> {
      // Push tokens only work on physical hardware — skip simulators/emulators.
      if (!Device.isDevice) return;

      const { status: existing } = await Notifications.getPermissionsAsync();
      let status = existing;
      if (status !== "granted") {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
      }
      if (status !== "granted") return;

      // Android ≥8 requires a channel before notifications will show.
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
        });
      }

      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      if (cancelled) return;
      tokenRef.current = token;
      await registerPushToken(token, Platform.OS as "ios" | "android");
    }

    register().catch(() => {
      /* best-effort: registration retries on next mount/session change */
    });

    return () => {
      cancelled = true;
    };
    // `session` identity changes on sign-in/out — the only trigger we need.
  }, [session]);

  // Tap + foreground-receive listeners (mount once) and cold-start handling.
  useEffect(() => {
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const ticketId = ticketIdFromNotification(response.notification);
      if (ticketId !== undefined) router.navigate(`/tickets/${ticketId}`);
    });

    const receiveSub = Notifications.addNotificationReceivedListener((notification) => {
      const ticketId = ticketIdFromNotification(notification);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      if (ticketId !== undefined) queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    });

    // Cold start: the app was launched by tapping a push. `getLastNotificationResponse`
    // is sync (the async variant was deprecated); clear it so a remount (e.g. Fast
    // Refresh) doesn't re-navigate. On a warm start the tap listener above fires
    // instead, so this only handles the true cold-start case.
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      const ticketId = ticketIdFromNotification(last.notification);
      if (ticketId !== undefined) router.navigate(`/tickets/${ticketId}`);
      Notifications.clearLastNotificationResponse();
    }

    return () => {
      tapSub.remove();
      receiveSub.remove();
    };
  }, [queryClient]);
}
