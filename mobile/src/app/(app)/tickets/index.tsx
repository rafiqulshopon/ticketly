import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { getTickets } from "@/lib/api";
import { relativeTime } from "@/lib/format";

/** Tickets queue — M0 smoke test: proves the auth cookie flows, @ticketly/shared
 *  types resolve, and TanStack Query works end-to-end. The full list UI
 *  (debounced search, server-side sort/filter/paginate, role-aware statuses)
 *  arrives in M1. */
export default function TicketsScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => getTickets({ pageSize: 25 }),
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-destructive">{(error as Error).message}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data?.items ?? []}
      keyExtractor={(t) => String(t.id)}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      ListEmptyComponent={<Text className="text-muted-foreground">No tickets.</Text>}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.navigate(`/tickets/${item.id}`)}
          className="rounded-lg border border-border bg-card p-4"
        >
          <Text className="font-semibold text-foreground" numberOfLines={1}>
            {item.subject}
          </Text>
          <Text className="text-muted-foreground" numberOfLines={1}>
            {item.requesterName} · {relativeTime(item.createdAt)}
          </Text>
        </Pressable>
      )}
    />
  );
}
