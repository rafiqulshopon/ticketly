import {
  ArrowRight,
  ArrowRightLeft,
  Flag,
  Inbox,
  MessageSquare,
  Reply,
  Sparkles,
  Tag,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { TicketActivityItem, TicketActivityType } from "@ticketly/shared";
import { Avatar, AvatarFallback, Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { getTicketActivity } from "@/lib/api";
import { initials, relativeTime } from "@/lib/format";
import {
  type BadgeVariant,
  PRIORITY_BADGES,
  STATUS_BADGES,
  prettifyEnum,
} from "@/components/tickets/ticket-badges";

/** Per-type icon + label for the timeline rows — a lookup map, not a switch, so
 *  adding a new activity type is a type error until it's mapped. */
const ACTIVITY_META: Record<TicketActivityType, { Icon: LucideIcon; label: string }> = {
  ticket_created: { Icon: Inbox, label: "Ticket created" },
  customer_replied: { Icon: MessageSquare, label: "Customer replied" },
  agent_replied: { Icon: Reply, label: "Agent replied" },
  ai_replied: { Icon: Sparkles, label: "AI replied" },
  status_changed: { Icon: ArrowRightLeft, label: "Status changed" },
  priority_changed: { Icon: Flag, label: "Priority changed" },
  category_changed: { Icon: Tag, label: "Category changed" },
  assignee_changed: { Icon: UserPlus, label: "Assignee changed" },
};

/**
 * The Activity tab on the ticket detail page — a live timeline of the ticket's
 * lifecycle (creation, replies, status/priority/category/assignee changes).
 *
 * Lazily fetched: mounted only while the Activity tab is active (Radix
 * `TabsContent` mounts children on activation), so the query runs once the user
 * opens it. Live updates arrive over the realtime SSE channel and are prepended
 * into the `["ticket-activity", id]` cache by `use-realtime-events`; the
 * mutating controls also invalidate this key on success as a backstop.
 */
export function TicketActivity({ ticketId }: { ticketId: number }) {
  const query = useQuery({
    queryKey: ["ticket-activity", ticketId],
    queryFn: ({ signal }) => getTicketActivity(ticketId, { signal }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Couldn&apos;t load activity.</p>
        ) : query.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="scroll-slim max-h-[60vh] divide-y overflow-y-auto pr-1">
            {query.data.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ item }: { item: TicketActivityItem }) {
  const { Icon, label } = ACTIVITY_META[item.type];
  const actor = actorLabel(item);
  // A staff/AI actor shows their initials avatar; system/external events show the
  // type icon in a muted circle. Keeps a consistent shape down the timeline.
  const hasActor = Boolean(item.actorName);

  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      {hasActor ? (
        <Avatar className="mt-0.5 size-8">
          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
            {initials(item.actorName)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            {!hasActor && <Icon className="size-3.5 text-muted-foreground" />}
            {label}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground" title={item.createdAt}>
            {relativeTime(item.createdAt)}
          </span>
        </div>
        {actor && <p className="mt-0.5 text-xs text-muted-foreground">by {actor}</p>}
        {item.changeField && item.changeFrom != null && item.changeTo != null && (
          <ChangeRow field={item.changeField} from={item.changeFrom} to={item.changeTo} />
        )}
      </div>
    </li>
  );
}

/** The from → to line for a `*_changed` event, reusing the status/priority label
 *  + colour maps so wording matches the rest of the app. */
function ChangeRow({ field, from, to }: { field: string; from: string; to: string }) {
  const fromBadge = changeBadge(field, from);
  const toBadge = changeBadge(field, to);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <Badge variant={fromBadge.variant} className="text-xs font-normal">
        {fromBadge.label}
      </Badge>
      <ArrowRight className="size-3 text-muted-foreground" />
      <Badge variant={toBadge.variant} className="text-xs font-normal">
        {toBadge.label}
      </Badge>
    </div>
  );
}

/** A human label + badge variant for one side of a change. Assignee values are
 *  display names (or "(unassigned)"); the others are raw enum values labelled via
 *  the shared maps. */
function changeBadge(field: string, value: string): { label: string; variant: BadgeVariant } {
  if (field === "status") {
    return (
      (STATUS_BADGES as Record<string, { label: string; variant: BadgeVariant }>)[value] ?? {
        label: prettifyEnum(value),
        variant: "outline",
      }
    );
  }
  if (field === "priority") {
    return (
      (PRIORITY_BADGES as Record<string, { label: string; variant: BadgeVariant }>)[value] ?? {
        label: prettifyEnum(value),
        variant: "outline",
      }
    );
  }
  if (field === "category") {
    return { label: prettifyEnum(value), variant: "outline" };
  }
  // assignee: a display name, or the "(unassigned)" sentinel.
  if (value === "(unassigned)") return { label: "Unassigned", variant: "secondary" };
  return { label: value, variant: "indigo" };
}

/** Kind-derived actor label when there's no human actor (system / customer /
 *  AI-without-a-resolved-name). `ticket_created` is excluded — it shows no "by …". */
const ACTOR_FALLBACK: Record<Exclude<TicketActivityType, "ticket_created">, string> = {
  customer_replied: "Customer",
  agent_replied: "Agent",
  ai_replied: "AI Agent",
  status_changed: "System",
  priority_changed: "System",
  category_changed: "System",
  assignee_changed: "System",
};

/** The actor's display label, falling back to a kind-derived name when there's no
 *  human actor. Returns null for `ticket_created` (no "by …" line). */
function actorLabel(item: TicketActivityItem): string | null {
  if (item.actorName) return item.actorName;
  if (item.type === "ticket_created") return null;
  return ACTOR_FALLBACK[item.type];
}
