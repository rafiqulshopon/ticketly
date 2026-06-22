import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Plain <label> (no @radix-ui/react-label dependency) — htmlFor associates it.
const Label = forwardRef<HTMLLabelElement, ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Label };
