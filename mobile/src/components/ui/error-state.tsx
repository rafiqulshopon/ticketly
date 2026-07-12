import { Pressable, Text, View } from "react-native";

/**
 * Full-screen error state — the `isError && !data` early-return shared by every
 * data screen. The retry affordance is omitted entirely when no `onRetry` is
 * passed (for non-retryable errors). Pair with `toErrorMessage(error)` from
 * `@/lib/errors`. Design tokens only.
 */
export function ErrorState({
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text className="text-destructive">{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} className="mt-4">
          <Text className="text-primary">{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
