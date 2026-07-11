import { type ComponentType } from "react";
import { Pressable, Text, View } from "react-native";
import { Inbox, MessageSquare, UserPlus } from "lucide-react-native";
import type { Notification, NotificationType } from "@ticketly/shared";
import { cx } from "@/lib/cx";
import { relativeTime } from "@/lib/format";
import { useIconColor } from "@/lib/colors";

/** lucide icon component shape (size + color props). */
type IconType = ComponentType<{ size?: number; color?: string }>;

/** Per-type icon + label for the feed rows — a lookup map, not a switch. */
export const NOTIFICATION_META: Record<NotificationType, { Icon: IconType; label: string }> = {
  new_ticket: { Icon: Inbox, label: "New ticket" },
  new_message: { Icon: MessageSquare, label: "New message" },
  ticket_assigned: { Icon: UserPlus, label: "Assigned to you" },
};

/** A single notification row. Presentational — the parent owns navigation and
 *  mark-read, so this renders with no query/mutation hooks (and no provider
 *  needed in tests). Ports the web's NotificationItem layout; unread rows get a
 *  soft accent tint, a tinted icon chip, a bold label, and a destructive dot. */
export function NotificationItem({ n, onPress }: { n: Notification; onPress: () => void }) {
  const isUnread = !n.readAt;
  const { Icon, label } = NOTIFICATION_META[n.type];
  // lucide needs a literal hex for `color` (it can't read NativeWind tokens);
  // `muted` matches `--muted-foreground` exactly, `info` is on-palette for the
  // unread chip (whose text token is `text-info-fg`).
  const iconColor = useIconColor(isUnread ? "info" : "muted");

  return (
    <Pressable
      onPress={onPress}
      className={cx(
        "flex flex-row items-start gap-3 rounded-lg border border-border p-4",
        isUnread ? "bg-accent" : "bg-card",
      )}
    >
      <View className={cx("mt-0.5 rounded-full p-1.5", isUnread ? "bg-info-soft" : "bg-muted")}>
        <Icon size={14} color={iconColor} />
      </View>
      <View className="flex-1">
        <View className="flex flex-row items-center justify-between gap-2">
          <Text
            className={cx("text-sm", isUnread ? "font-semibold text-foreground" : "text-foreground")}
            numberOfLines={1}
          >
            {label}
          </Text>
          {isUnread && <View testID="unread-dot" className="size-2 shrink-0 rounded-full bg-destructive" />}
        </View>
        <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={1}>
          {n.ticketSubject}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {n.requesterName} · {relativeTime(n.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}
