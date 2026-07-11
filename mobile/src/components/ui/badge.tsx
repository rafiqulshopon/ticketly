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
// Split into `root` (background/border → applied to the View) and `text`
// (foreground color → applied to the Text). React Native <Text> does NOT
// inherit `color` from a parent <View> the way CSS does on the web, so a single
// combined class on the View left the label un-colored → it fell back to RN's
// default black, invisible on the dark `default` (primary) variant (e.g. the
// OPEN status badge, the Admin role badge). Putting the foreground on the Text
// fixes that and makes every variant correct.
const VARIANT_CLASS: Record<BadgeVariant, { root: string; text: string }> = {
  default: { root: "bg-primary", text: "text-primary-foreground" },
  secondary: { root: "bg-secondary", text: "text-secondary-foreground" },
  outline: { root: "border border-border", text: "text-foreground" },
  destructive: { root: "bg-destructive", text: "text-destructive-foreground" },
  success: { root: "bg-success-soft", text: "text-success-fg" },
  warning: { root: "bg-warning-soft", text: "text-warning-fg" },
  info: { root: "bg-info-soft", text: "text-info-fg" },
  indigo: { root: "bg-indigo-soft", text: "text-indigo-fg" },
  danger: { root: "bg-destructive-soft", text: "text-destructive" },
};

export interface BadgeProps extends ComponentProps<typeof View> {
  variant?: BadgeVariant;
  children: ReactNode;
}

/** Small rounded label — the RN analog of the web's shadcn Badge. */
export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  const { root, text } = VARIANT_CLASS[variant];
  return (
    <View className={cx("flex flex-row items-center rounded-full px-2 py-0.5", root, className)} {...props}>
      <Text className={cx("text-xs font-medium", text)} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}
