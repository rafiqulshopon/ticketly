import { type ComponentProps, type ReactNode } from "react";
import { Text, View } from "react-native";
import { cx } from "@/lib/cx";

/** Surface container — the RN analog of the web's shadcn Card. */
export function Card({ className, ...props }: ComponentProps<typeof View>) {
  return <View className={cx("rounded-lg border border-border bg-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<typeof View>) {
  return <View className={cx("p-4", className)} {...props} />;
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <Text className={cx("text-base font-semibold text-foreground", className)}>{children}</Text>;
}

export function CardContent({ className, ...props }: ComponentProps<typeof View>) {
  return <View className={cx("p-4 pt-0", className)} {...props} />;
}
