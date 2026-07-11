import { useEffect, useRef } from "react";
import { router, usePathname } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import EventSource from "react-native-sse";
import Toast from "react-native-toast-message";
import {
  realtimeEventSchema,
  type RealtimeEvent,
  type TicketActivityItem,
  type TicketDetail,
} from "@ticketly/shared";
import { authClient, API_ORIGIN, useSession } from "@/lib/auth";

/** The named SSE event types the backend's /api/realtime stream emits. Used to
 *  type react-native-sse's EventSource generic (it defaults to `never`). */
type RealtimeSseEvent = "new_message" | "new_ticket" | "ticket_activity";

/** Truncate a message body for a toast preview (single line, capped length). */
function preview(body: string): string {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

/** Validate an SSE frame's data against the shared realtime contract. */
function parseEvent(data: unknown): RealtimeEvent | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = realtimeEventSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Open one Server-Sent-Events connection (`GET /api/realtime`) for the whole app
 * and react to live ticket events. Ported from web/src/hooks/use-realtime-events.ts
 * — the only changes are the transport (react-native-sse, since RN has no native
 * EventSource) and the cookie (passed as a header from SecureStore, since RN has
 * no cookie jar).
 *
 * Self-gates on the session: safe to mount from any layout; the stream opens on
 * sign-in and closes on sign-out. TanStack Query keys are identical to the web
 * (["ticket", id], ["tickets"], ["ticket-activity", id], ["notifications"], …)
 * so cache invalidation semantics carry over.
 *
 * `new_message`: if the user is on that ticket's detail screen the message is
 * appended straight into the cached conversation (no toast — the live message is
 * the signal); otherwise a toast with an onPress "View" jumps to it.
 * `new_ticket`: always toast with "View". Both refresh the ticket list +
 * notification caches. `ticket_activity`: prepend to the open ticket's Activity
 * cache only. react-native-sse reconnects automatically on drop (pollingInterval);
 * the bell + list invalidation cover any gap.
 */
export function useRealtimeEvents(): void {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { data: session } = useSession();

  // Mirror the latest pathname into a ref so the SSE handler (opened once per
  // session) reads the current route without reopening the stream on navigation.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!session) return;

    const headers: Record<string, string> = {};
    const cookie = authClient.getCookie();
    if (cookie) headers.Cookie = cookie;

    // Type the EventSource with our custom SSE event names so addEventListener
    // accepts them (react-native-sse's generic defaults to `never`). "ping"
    // keep-alive frames are simply unhandled.
    const es = new EventSource<RealtimeSseEvent>(`${API_ORIGIN}/api/realtime`, { headers });

    es.addEventListener("new_message", (e) => {
      const event = parseEvent((e as { data?: unknown }).data);
      if (event?.type !== "new_message") return;
      const { ticketId, ticketSubject, requesterName, message } = event;

      if (pathnameRef.current === `/tickets/${ticketId}`) {
        const cached = queryClient.getQueryData<TicketDetail>(["ticket", ticketId]);
        if (cached && !cached.messages.some((m) => m.id === message.id)) {
          queryClient.setQueryData<TicketDetail>(["ticket", ticketId], {
            ...cached,
            messages: [...cached.messages, message],
          });
        }
        // A customer reply may have reopened the ticket server-side; refetch so
        // the status badge + properties reconcile (same message id → no dupe).
        queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      } else {
        Toast.show({
          type: "info",
          text1: `New reply on “${ticketSubject}”`,
          text2: `${requesterName ?? message.fromEmail}: ${preview(message.bodyText)}`,
          onPress: () => router.navigate(`/tickets/${ticketId}`),
          visibilityTime: 5000,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // Explicit so the tab-badge count (["notifications","unread-count"])
      // refreshes on the live event — prefix matching already covers it, but
      // this mirrors the web's refresh() and the feed screen's own refresh().
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    });

    es.addEventListener("new_ticket", (e) => {
      const event = parseEvent((e as { data?: unknown }).data);
      if (event?.type !== "new_ticket") return;
      const { ticketId, ticketSubject, requesterName } = event;
      Toast.show({
        type: "success",
        text1: `New ticket from ${requesterName ?? "a requester"}`,
        text2: ticketSubject,
        onPress: () => router.navigate(`/tickets/${ticketId}`),
        visibilityTime: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // Explicit so the tab-badge count (["notifications","unread-count"])
      // refreshes on the live event — prefix matching already covers it, but
      // this mirrors the web's refresh() and the feed screen's own refresh().
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    });

    es.addEventListener("ticket_activity", (e) => {
      const event = parseEvent((e as { data?: unknown }).data);
      if (event?.type !== "ticket_activity") return;
      const { ticketId, activity } = event;
      if (pathnameRef.current !== `/tickets/${ticketId}`) return;
      const cached = queryClient.getQueryData<TicketActivityItem[]>(["ticket-activity", ticketId]);
      if (cached && !cached.some((a) => a.id === activity.id)) {
        queryClient.setQueryData<TicketActivityItem[]>(["ticket-activity", ticketId], [activity, ...cached]);
      }
    });

    // "ping" frames are the SSE keep-alive — intentionally unhandled.
    return () => es.close();
    // `router` is a stable expo-router singleton, not listed in deps.
  }, [queryClient, session]);
}
