import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
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
} from "lucide-react-native";
import type { TicketActivityItem, TicketActivityType } from "@ticketly/shared";
import { Avatar, AvatarFallback, Badge, Card, CardContent, CardHeader, CardTitle, type BadgeVariant } from "@/components/ui";
import { getTicketActivity } from "@/lib/api";
import { useIconColor } from "@/lib/colors";
import { initials, relativeTime } from "@/lib/format";
import { PRIORITY_BADGES, STATUS_BADGES, prettifyEnum } from "@/components/tickets/ticket-badges";

/** Per-type icon + label — a lookup map, not a switch, so adding a new activity
 *  type is a type error until it's mapped. */
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
 * The Activity tab — a live timeline of the ticket's lifecycle. Lazily fetched:
 * mounted only while the Activity tab is active (the detail screen mounts it
 * conditionally), so the query runs once the user opens it. Live updates arrive
 * over the realtime SSE channel and are prepended into the
 * `["ticket-activity", id]` cache by use-realtime-events.
 */
export function TicketActivity({ ticketId }: { ticketId: number }) {
  const muted = useIconColor("muted");
  const query = useQuery({
    queryKey: ["ticket-activity", ticketId],
    queryFn: ({ signal }) => getTicketActivity(ticketId, { signal }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <View className="gap-3 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} className="h-10 rounded-md bg-muted" />
            ))}
          </View>
        ) : query.isError ? (
          <Text className="py-8 text-center text-sm text-muted-foreground">Couldn&apos;t load activity.</Text>
        ) : query.data.length === 0 ? (
          <Text className="py-8 text-center text-sm text-muted-foreground">No activity yet.</Text>
        ) : (
          <View>
            {query.data.map((item, i) => (
              <ActivityRow key={item.id} item={item} isFirst={i === 0} isLast={i === query.data.length - 1} muted={muted} />
            ))}
          </View>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({
  item,
  isFirst,
  isLast,
  muted,
}: {
  item: TicketActivityItem;
  isFirst: boolean;
  isLast: boolean;
  muted: string;
}) {
  const { Icon, label } = ACTIVITY_META[item.type];
  const actor = actorLabel(item);
  const hasActor = Boolean(item.actorName);

  return (
    <View className={cxRow(isFirst, isLast)}>
      {hasActor ? (
        <Avatar className="mt-0.5 size-8">
          <AvatarFallback className="bg-secondary">
            <Text className="text-xs font-medium text-primary">{initials(item.actorName)}</Text>
          </AvatarFallback>
        </Avatar>
      ) : (
        <View className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon size={16} color={muted} />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <View className="flex flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-sm font-medium text-foreground">{label}</Text>
          <Text className="shrink-0 text-xs text-muted-foreground">{relativeTime(item.createdAt)}</Text>
        </View>
        {actor ? <Text className="mt-0.5 text-xs text-muted-foreground">by {actor}</Text> : null}
        {item.changeField && item.changeFrom != null && item.changeTo != null ? (
          <ChangeRow field={item.changeField} from={item.changeFrom} to={item.changeTo} />
        ) : null}
      </View>
    </View>
  );
}

/** The from → to line for a `*_changed` event, reusing the status/priority
 *  label + colour maps so wording matches the rest of the app. */
function ChangeRow({ field, from, to }: { field: string; from: string; to: string }) {
  const muted = useIconColor("muted");
  const fromBadge = changeBadge(field, from);
  const toBadge = changeBadge(field, to);
  return (
    <View className="mt-1.5 flex flex-row flex-wrap items-center gap-1.5">
      <Badge variant={fromBadge.variant}>{fromBadge.label}</Badge>
      <ArrowRight size={12} color={muted} />
      <Badge variant={toBadge.variant}>{toBadge.label}</Badge>
    </View>
  );
}

/** A human label + badge variant for one side of a change. */
function changeBadge(field: string, value: string): { label: string; variant: BadgeVariant } {
  if (field === "status") {
    return (STATUS_BADGES as Record<string, { label: string; variant: BadgeVariant }>)[value] ?? {
      label: prettifyEnum(value),
      variant: "outline",
    };
  }
  if (field === "priority") {
    return (PRIORITY_BADGES as Record<string, { label: string; variant: BadgeVariant }>)[value] ?? {
      label: prettifyEnum(value),
      variant: "outline",
    };
  }
  if (field === "category") return { label: prettifyEnum(value), variant: "outline" };
  if (value === "(unassigned)") return { label: "Unassigned", variant: "secondary" };
  return { label: value, variant: "indigo" };
}

/** Kind-derived actor label when there's no human actor. ticket_created shows
 *  no "by …". */
const ACTOR_FALLBACK: Record<Exclude<TicketActivityType, "ticket_created">, string> = {
  customer_replied: "Customer",
  agent_replied: "Agent",
  ai_replied: "AI Agent",
  status_changed: "System",
  priority_changed: "System",
  category_changed: "System",
  assignee_changed: "System",
};

function actorLabel(item: TicketActivityItem): string | null {
  if (item.actorName) return item.actorName;
  if (item.type === "ticket_created") return null;
  return ACTOR_FALLBACK[item.type];
}

function cxRow(isFirst: boolean, isLast: boolean): string {
  // Vertical spacing: group rows with top padding, drop it on the first/last.
  return ["flex flex-row gap-3 py-3", isFirst ? "pt-0" : "", isLast ? "pb-0" : ""].filter(Boolean).join(" ");
}
