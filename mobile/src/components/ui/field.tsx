import { type ComponentProps, type ReactNode } from "react";
import { Text, TextInput, View } from "react-native";
import { cx } from "@/lib/cx";

/** Label + control + inline error, stacked. Mirrors the inline field layout the
 *  login screen uses, extracted for reuse across the reply form and filters. */
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      {children}
      {error ? <Text className="text-destructive">{error}</Text> : null}
    </View>
  );
}

/** A TextInput pre-styled with the card/input border treatment so screens don't
 *  repeat the className. Spreads props, so `multiline`, `numberOfLines`, etc.
 *  pass through. */
export function TextField({ className, ...props }: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      className={cx("rounded-md border border-input bg-card px-3 py-3 text-foreground", className)}
      placeholderTextColor="#5b6776"
      {...props}
    />
  );
}
