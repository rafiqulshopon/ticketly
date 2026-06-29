import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Inbox, MessageSquare, UserPlus, type LucideIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { Notification, NotificationType } from "@ticketly/shared";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  toast,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";

/**
 * The navbar bell: a live unread badge + a popover feed. The unread count is
 * polled on an interval (and on window focus) so the badge stays fresh without a
 * websocket; the full list is fetched lazily only while the popover is open.
 * Opening an item marks it read and navigates to the ticket.
 */
export function NotificationBell({ align = "end" }: { align?: "start" | "center" | "end" }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const countQuery = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: ({ signal }) => getUnreadNotificationCount({ signal }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const listQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: ({ signal }) => getNotifications({ signal }),
    enabled: open,
  });

  const unread = countQuery.data?.count ?? 0;

  const markAll = useMutation({ mutationFn: () => markAllNotificationsRead() });
  const markOne = useMutation({ mutationFn: (id: string) => markNotificationRead(id) });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
  }

  async function onMarkAll() {
    try {
      await markAll.mutateAsync();
      refresh();
      toast.success("Marked all as read.");
    } catch {
      toast.error("Could not mark all as read.");
    }
  }

  async function onOpenItem(n: Notification) {
    setOpen(false);
    navigate(`/tickets/${n.ticketId}`);
    if (n.readAt) return;
    try {
      await markOne.mutateAsync(n.id);
      refresh();
    } catch {
      // Non-fatal: the navigation still happens; the row just stays unread.
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 text-muted-foreground hover:text-foreground"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={onMarkAll}
              disabled={markAll.isPending}
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <NotificationListBody query={listQuery} onSelect={onOpenItem} />
      </PopoverContent>
    </Popover>
  );
}

function NotificationListBody({
  query,
  onSelect,
}: {
  query: UseQueryResult<Notification[]>;
  onSelect: (n: Notification) => void;
}) {
  if (query.isPending) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return <CenteredNote text="Could not load notifications." />;
  }
  const items = query.data ?? [];
  if (items.length === 0) {
    return <CenteredNote text="You're all caught up." />;
  }
  return (
    <ul role="list" className="max-h-80 divide-y overflow-y-auto">
      {items.map((n) => (
        <NotificationItem key={n.id} n={n} onSelect={() => onSelect(n)} />
      ))}
    </ul>
  );
}

/** Per-type icon + label for the feed rows (lookup map, not a switch). */
const NOTIFICATION_META: Record<NotificationType, { Icon: LucideIcon; label: string }> = {
  new_ticket: { Icon: Inbox, label: "New ticket" },
  new_message: { Icon: MessageSquare, label: "New message" },
  ticket_assigned: { Icon: UserPlus, label: "Assigned to you" },
};

function NotificationItem({ n, onSelect }: { n: Notification; onSelect: () => void }) {
  const isUnread = !n.readAt;
  const { Icon, label } = NOTIFICATION_META[n.type];
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent",
          isUnread && "bg-accent/40",
        )}
      >
        <span
          className={cn(
            "mt-0.5 rounded-full p-1.5",
            isUnread ? "bg-info/10 text-info-fg" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                isUnread ? "font-medium text-foreground" : "text-foreground",
              )}
            >
              {label}
            </span>
            {isUnread && (
              <span className="size-2 shrink-0 rounded-full bg-destructive" aria-hidden />
            )}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {n.ticketSubject}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {n.requesterName} · {relativeTime(n.createdAt)}
          </span>
        </span>
      </button>
    </li>
  );
}

function CenteredNote({ text }: { text: string }) {
  return <p className="px-3 py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

/** Compact "x ago" for the feed — fine-grained for recent, absolute for old. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  const min = Math.round(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
