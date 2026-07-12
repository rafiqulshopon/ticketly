import { FlatList, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import type { Notification } from "@ticketly/shared";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import { useIconColor } from "@/lib/colors";
import { toErrorMessage } from "@/lib/errors";
import { Button, EmptyState, ErrorState, LoadingState } from "@/components/ui";
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

  const primary = useIconColor("primary");
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: ({ signal }) => getNotifications({ signal }),
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

  if (isPending) return <LoadingState />;

  if (isError && !data) {
    return <ErrorState message={toErrorMessage(error)} onRetry={() => void refetch()} />;
  }

  const items = data ?? [];

  return (
    <FlatList
      className="bg-background"
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isPending}
          onRefresh={refresh}
          tintColor={primary}
          colors={[primary]}
        />
      }
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
      ListEmptyComponent={<EmptyState message="You're all caught up." />}
      renderItem={({ item }) => <NotificationItem n={item} onPress={() => void onOpenItem(item)} />}
    />
  );
}
