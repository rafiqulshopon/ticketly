import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Clock, Inbox, Sparkles, Ticket, Wand2 } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { ApiError, getDashboardStats } from "@/lib/api";
import { isAdmin, useSession } from "@/lib/auth";
import { formatDuration } from "@/lib/format";
import { useIconColor } from "@/lib/colors";
import { StatCard } from "@/components/dashboard/stat-card";
import { TicketsPerDayChart } from "@/components/dashboard/tickets-per-day-chart";

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "You don't have permission to view the dashboard.";
    if (err.status === 401) return "Your session may have expired — please sign in again.";
  }
  return err instanceof Error ? err.message : "Failed to load dashboard metrics.";
}

/** Dashboard (admin-only) — 5 stat cards (deep-linking into filtered ticket
 *  lists) plus a tickets-per-day bar chart. Mirrors the web DashboardPage; the
 *  metrics come from the single getDashboardStats endpoint. */
export default function DashboardScreen() {
  const { data: session } = useSession();
  const ai = useIconColor("ai");
  const muted = useIconColor("muted");

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: ({ signal }) => getDashboardStats({ signal }),
    retry: (failureCount, err) => !(err instanceof ApiError) && failureCount < 2,
  });

  if (!session || !isAdmin(session.user.role)) return <Redirect href="/(app)/tickets" />;

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-destructive">{toErrorMessage(error)}</Text>
        <Pressable onPress={() => void refetch()} className="mt-4">
          <Text className="text-primary">Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Text className="text-2xl font-semibold text-foreground">Dashboard</Text>
      </View>

      <View className="flex flex-row gap-3">
        <StatCard
          label="Total tickets"
          value={data.totalTickets.toLocaleString()}
          icon={<Ticket size={16} color={muted} />}
          view="all"
        />
        <StatCard
          label="Open tickets"
          value={data.openTickets.toLocaleString()}
          icon={<Inbox size={16} color={muted} />}
          view="open"
        />
      </View>

      <View className="flex flex-row gap-3">
        <StatCard
          label="Resolved by AI"
          value={data.resolvedByAi.toLocaleString()}
          description={`of ${data.totalResolved.toLocaleString()} resolved`}
          icon={<Sparkles size={16} color={ai} />}
          tone="ai"
          view="resolvedByAi"
        />
        <StatCard
          label="AI resolution rate"
          value={`${data.aiResolutionRate.toFixed(1)}%`}
          icon={<Wand2 size={16} color={ai} />}
          tone="ai"
        />
      </View>

      <View className="flex flex-row gap-3">
        <StatCard
          label="Avg. resolution time"
          value={formatDuration(data.avgResolutionTimeMs)}
          icon={<Clock size={16} color={muted} />}
        />
      </View>

      <TicketsPerDayChart data={data.ticketsPerDay} />
    </ScrollView>
  );
}
