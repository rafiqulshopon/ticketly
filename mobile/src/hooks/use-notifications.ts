import { useQuery } from "@tanstack/react-query";
import { ApiError, getUnreadNotificationCount } from "@/lib/api";

/** Poll the unread count every 30s (the M2 requirement). Mounted once in
 *  (app)/_layout so the tab badge stays fresh on every tab. */
const POLL_INTERVAL_MS = 30_000;

/**
 * Live unread-notification count for the Notifications tab badge. Polled on the
 * interval above and invalidated on realtime SSE events by `use-realtime-events`
 * (so the badge bumps the moment a new ticket/message lands, not on the next
 * tick). Pauses while the app is backgrounded — TanStack Query's
 * `refetchIntervalInBackground` defaults to false.
 */
export function useUnreadNotificationCount(): number {
  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: ({ signal }) => getUnreadNotificationCount({ signal }),
    refetchInterval: POLL_INTERVAL_MS,
    retry: (failureCount, err) => !(err instanceof ApiError) && failureCount < 2,
  });
  return data?.count ?? 0;
}
