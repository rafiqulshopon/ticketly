import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Clock, Inbox, Sparkles, Ticket, Wand2 } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { getDashboardStats } from "@/lib/api";
import { isAdmin, useSession } from "@/lib/auth";
import { formatDuration } from "@/lib/format";
import { useIconColor } from "@/lib/colors";
import { toErrorMessage } from "@/lib/errors";
import { ErrorState, LoadingState } from "@/components/ui";
import { StatCard } from "@/components/dashboard/stat-card";
import { TicketsPerDayChart } from "@/components/dashboard/tickets-per-day-chart";

/** Dashboard (admin-only) — 5 stat cards (deep-linking into filtered ticket
 *  lists) plus a tickets-per-day bar chart. Mirrors the web DashboardPage; the
 *  metrics come from the single getDashboardStats endpoint. */
export default function DashboardScreen() {
  const { data: session } = useSession();
  const ai = useIconColor("ai");
  const muted = useIconColor("muted");
  const primary = useIconColor("primary");

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: ({ signal }) => getDashboardStats({ signal }),
  });

  if (!session || !isAdmin(session.user.role)) return <Redirect href="/(app)/tickets" />;

  if (isPending) return <LoadingState />;

  if (isError && !data) {
    return <ErrorState message={toErrorMessage(error)} onRetry={() => void refetch()} />;
  }

  if (!data) return null;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isPending}
          onRefresh={() => void refetch()}
          tintColor={primary}
          colors={[primary]}
        />
      }
    >
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
