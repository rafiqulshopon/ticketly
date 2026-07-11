import { type ComponentProps, type ReactNode } from "react";
import { Text, View } from "react-native";
import { cx } from "@/lib/cx";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "indigo"
  | "danger";

// Lookup map keyed by variant — same shape & names as the web's shadcn Badge so
// the ticket-badges port is type-identical. Semantic variants use the soft
// tinted tokens (bg-*-soft + accessible text-*-fg); the web achieves the same
// tint with the `/10` opacity modifier, which is unreliable over CSS-var colors
// on NativeWind, so we use explicit tokens instead. Values are identical.
const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-border text-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  success: "bg-success-soft text-success-fg",
  warning: "bg-warning-soft text-warning-fg",
  info: "bg-info-soft text-info-fg",
  indigo: "bg-indigo-soft text-indigo-fg",
  danger: "bg-destructive-soft text-destructive",
};

export interface BadgeProps extends ComponentProps<typeof View> {
  variant?: BadgeVariant;
  children: ReactNode;
}

/** Small rounded label — the RN analog of the web's shadcn Badge. */
export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <View className={cx("flex flex-row items-center rounded-full px-2 py-0.5", VARIANT_CLASS[variant], className)} {...props}>
      <Text className="text-xs font-medium" numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}
