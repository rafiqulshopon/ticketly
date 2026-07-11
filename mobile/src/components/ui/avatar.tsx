import { type ComponentProps, type ReactNode } from "react";
import { View } from "react-native";
import { cx } from "@/lib/cx";

/** A sized circular container — the RN analog of the web's shadcn Avatar. The
 *  size comes from the caller's className (e.g. `size-7`). */
export function Avatar({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <View className={cx("items-center justify-center overflow-hidden rounded-full", className)}>{children}</View>
  );
}

/** The colored circle content (initials or an icon). The caller styles the tint. */
export function AvatarFallback({ className, children, ...props }: ComponentProps<typeof View> & { children: ReactNode }) {
  return (
    <View className={cx("h-full w-full items-center justify-center rounded-full", className)} {...props}>
      {children}
    </View>
  );
}
