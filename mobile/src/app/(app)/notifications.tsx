import { Text, View } from "react-native";

/** Notifications feed — stub. The live bell (poll unread-count + realtime
 *  invalidation) and mark-read arrive in M2. The realtime SSE hook is already
 *  mounted in (app)/_layout, so toasts fire today; this screen is the full feed. */
export default function NotificationsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text className="text-foreground">Notifications — coming in M2</Text>
    </View>
  );
}
