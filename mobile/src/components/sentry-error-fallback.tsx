import { Text, View } from "react-native";

/**
 * Terminal fallback for the root Sentry ErrorBoundary. Deliberately dependency-
 * free — no hooks, no router, no queries, no expo-updates native calls — so it
 * can't itself throw. This is the last line of defense, so design tokens only
 * (never hardcoded colors). Mirrors the web's SentryFallback in main.tsx.
 */
export function SentryErrorFallback() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text className="text-lg font-semibold text-foreground">Something went wrong</Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">
        An unexpected error occurred. The team has been notified.
      </Text>
    </View>
  );
}
