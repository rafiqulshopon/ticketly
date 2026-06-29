import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { realtimeEventSchema, type RealtimeEvent, type TicketDetail } from "@ticketly/shared";
import { toast } from "@/components/ui";

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
 * and react to live ticket events. Mounted once in `AppLayout` (the always-on
 * authenticated shell), so the stream opens at sign-in and closes at sign-out.
 *
 * `new_message`: if the user is on that ticket's detail page the message is
 * appended straight into the cached conversation (it appears and the thread
 * auto-scrolls — no toast, the live message is the signal); otherwise a toast
 * with a "View" action lets them jump to it.
 *
 * `new_ticket`: always toast with "View" (a brand-new ticket has no open viewer
 * to append to).
 *
 * Both also refresh the ticket list and notification bell so side caches stay in
 * sync instead of waiting on their next poll. `EventSource` reconnects natively
 * on drop; events that arrive while disconnected aren't replayed, but the bell +
 * list invalidation cover the gap and the thread refetches on the next visit.
 */
export function useRealtimeEvents(): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // The SSE stream opens once for the session (see the effect below). To let its
  // handler read the *current* route without reopening the stream on every
  // navigation, the latest pathname is mirrored into a ref. The mirror is written
  // from an effect — not during render — per the react-hooks/refs rule.
  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const es = new EventSource("/api/realtime");

    es.addEventListener("new_message", (e) => {
      const event = parseEvent(e.data);
      if (event?.type !== "new_message") return;
      const { ticketId, ticketSubject, requesterName, message } = event;

      if (pathnameRef.current === `/tickets/${ticketId}`) {
        // Live-append to the open thread (dedupe by message id for safety).
        const cached = queryClient.getQueryData<TicketDetail>(["ticket", ticketId]);
        if (cached && !cached.messages.some((m) => m.id === message.id)) {
          queryClient.setQueryData<TicketDetail>(["ticket", ticketId], {
            ...cached,
            messages: [...cached.messages, message],
          });
        }
      } else {
        toast(`New reply on "${ticketSubject}"`, {
          description: `${requesterName ?? message.fromEmail}: ${preview(message.bodyText)}`,
          action: { label: "View", onClick: () => navigate(`/tickets/${ticketId}`) },
        });
      }
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });

    es.addEventListener("new_ticket", (e) => {
      const event = parseEvent(e.data);
      if (event?.type !== "new_ticket") return;
      const { ticketId, ticketSubject, requesterName } = event;
      toast(`New ticket from ${requesterName ?? "a requester"}`, {
        description: ticketSubject,
        action: { label: "View", onClick: () => navigate(`/tickets/${ticketId}`) },
      });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });

    // "ping" frames are the SSE keep-alive — intentionally unhandled.
    return () => es.close();
  }, [queryClient, navigate]);
}
