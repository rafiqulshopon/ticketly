import { forwardRef } from "react";
import { Link as RouterLink, type LinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Styled react-router `Link`. Applies the app's default inline-link treatment —
 * foreground color, underline on hover, underline offset — so content links
 * share one definition instead of repeating the same utility classes everywhere.
 *
 * Pass `className` to add or override (merged via `cn`, so later classes win);
 * e.g. `font-medium` for emphasis. Nav links and button-links (`<Button asChild>`)
 * intentionally use raw `react-router-dom` `Link` with their own styling, since
 * `hover:underline` would be wrong there.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, ...props }, ref) => (
    <RouterLink
      ref={ref}
      className={cn("text-foreground underline-offset-4 hover:underline", className)}
      {...props}
    />
  ),
);
Link.displayName = "Link";
