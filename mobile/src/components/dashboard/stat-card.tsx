import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/ui";
import { cx } from "@/lib/cx";

type TicketView = "all" | "open" | "resolvedByAi";

interface StatCardProps {
  label: string;
  value: string;
  description?: string;
  /** Pre-rendered icon element (lucide needs a literal hex color, resolved by the caller). */
  icon?: ReactNode;
  /** "ai" tints the icon chip emerald to mark AI-derived metrics. */
  tone?: "default" | "ai";
  /** When set, the whole card navigates to the tickets list filtered by this view bucket. */
  view?: TicketView;
}

/** A single metric tile for the dashboard — the mobile port of the web's StatCard.
 *  Composes the Card primitive; pass `view` to make it a tappable deep-link into a
 *  filtered ticket list. `flex-1` so cards fill a 2-column row evenly. */
export function StatCard({ label, value, description, icon, tone = "default", view }: StatCardProps) {
  const content = (
    <Card className="flex-1">
      <View className="p-4">
        <View className="flex flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-sm text-muted-foreground" numberOfLines={2}>
            {label}
          </Text>
          {icon ? (
            <View className={cx("rounded-md p-2", tone === "ai" ? "bg-ai-soft" : "bg-secondary")}>{icon}</View>
          ) : null}
        </View>
        <Text className="mt-2 font-mono text-2xl text-foreground">{value}</Text>
        {description ? <Text className="mt-1 text-xs text-muted-foreground">{description}</Text> : null}
      </View>
    </Card>
  );

  if (!view) return content;

  return (
    <Pressable onPress={() => router.navigate(`/tickets?view=${view}`)} className="flex-1">
      {content}
    </Pressable>
  );
}
