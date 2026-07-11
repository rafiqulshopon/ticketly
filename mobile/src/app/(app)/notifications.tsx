import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import type { Notification } from "@ticketly/shared";
import { ApiError, getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import { Button } from "@/components/ui";
import { NotificationItem } from "@/components/notifications/notification-item";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";

/** Notifications feed — the full-screen list (the web ships only a bell popover;
 *  on mobile this is a dedicated tab). Fetches the server-capped list on mount,
 *  mirrors the tickets screen's loading/error/empty states, and navigates to the
 *  ticket on row press (marking it read, non-fatally). The live unread badge
 *  lives on the tab icon (see (app)/_layout); this screen owns mark-read. */
export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const unread = useUnreadNotificationCount();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: ({ signal }) => getNotifications({ signal }),
    retry: (failureCount, err) => !(err instanceof ApiError) && failureCount < 2,
  });

  const markAll = useMutation({ mutationFn: () => markAllNotificationsRead() });
  const markOne = useMutation({ mutationFn: (id: string) => markNotificationRead(id) });

  // Invalidate both the list and the badge count after any mutation — mirrors
  // the web bell's refresh(). (["notifications"] prefix-matches the count key,
  // but explicit keeps the intent obvious and matches the realtime hook.)
  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
  }

  async function onMarkAll() {
    try {
      await markAll.mutateAsync();
      refresh();
      Toast.show({ type: "success", text1: "Marked all as read" });
    } catch {
      Toast.show({ type: "error", text1: "Could not mark all as read" });
    }
  }

  async function onOpenItem(n: Notification) {
    router.navigate(`/tickets/${n.ticketId}`);
    if (n.readAt) return;
    try {
      await markOne.mutateAsync(n.id);
      refresh();
    } catch {
      // Non-fatal: navigation still happens; the row just stays unread.
    }
  }

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
        <Text className="text-destructive">{(error as Error).message}</Text>
        <Pressable onPress={() => void refetch()} className="mt-4">
          <Text className="text-primary">Try again</Text>
        </Pressable>
      </View>
    );
  }

  const items = data ?? [];

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <View className="flex flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-semibold text-foreground">Notifications</Text>
            <Text className="mt-1 text-sm text-muted-foreground">{unread} unread</Text>
          </View>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => void onMarkAll()}
              loading={markAll.isPending}
            >
              Mark all read
            </Button>
          )}
        </View>
      }
      ListEmptyComponent={
        <Text className="mt-8 text-center text-muted-foreground">You&apos;re all caught up.</Text>
      }
      renderItem={({ item }) => <NotificationItem n={item} onPress={() => void onOpenItem(item)} />}
    />
  );
}
