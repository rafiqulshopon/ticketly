import type { ReactNode } from "react";
import { Text, View } from "react-native";

/**
 * Inline empty state for a FlatList's `ListEmptyComponent`. Matches the existing
 * per-screen "mt-8 text-center text-muted-foreground" text; `children` allow a
 * call-to-action below the message. Design tokens only.
 */
export function EmptyState({ message, children }: { message?: string; children?: ReactNode }) {
  return (
    <View className="mt-8 items-center">
      {message ? <Text className="text-center text-muted-foreground">{message}</Text> : null}
      {children}
    </View>
  );
}
