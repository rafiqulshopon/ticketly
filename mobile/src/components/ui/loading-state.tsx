import { ActivityIndicator, Text, View } from "react-native";

/**
 * Full-screen loading state — the `isPending` early-return shared by every data
 * screen. Optional `label` for context (rarely needed; the spinner is usually
 * self-explanatory). Design tokens only.
 */
export function LoadingState({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator />
      {label ? <Text className="mt-3 text-sm text-muted-foreground">{label}</Text> : null}
    </View>
  );
}
