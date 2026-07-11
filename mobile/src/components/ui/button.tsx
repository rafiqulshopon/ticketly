import { type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { cx } from "@/lib/cx";

export type ButtonVariant = "default" | "outline" | "ghost";
export type ButtonSize = "default" | "sm";

const VARIANTS: Record<ButtonVariant, string> = {
  default: "bg-primary",
  outline: "border border-input bg-transparent",
  ghost: "bg-transparent",
};
const TEXT_VARIANTS: Record<ButtonVariant, string> = {
  default: "text-primary-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
};
const SIZES: Record<ButtonSize, string> = {
  default: "px-4 py-3",
  sm: "px-3 py-2",
};

export interface ButtonProps extends ComponentProps<typeof Pressable> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables interaction while an async action runs. */
  loading?: boolean;
  children: ReactNode;
}

/** Pressable action button — the RN analog of the web's shadcn Button. */
export function Button({
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      className={cx(
        "flex flex-row items-center justify-center gap-2 rounded-md",
        VARIANTS[variant],
        SIZES[size],
        isDisabled && "opacity-60",
        className,
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text className={cx("text-center font-semibold", TEXT_VARIANTS[variant])}>{children}</Text>
      )}
    </Pressable>
  );
}
