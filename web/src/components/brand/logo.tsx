import { cn } from "@/lib/utils";

/**
 * Ticketly brand mark — an emerald badge with a white "AI signal" sparkle. The
 * sparkle is the same motif used in-product for AI actions (summary, polish), so
 * the logo and the product's signature element speak the same language. Uses
 * `var(--ai)` so it tracks the theme.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      <rect width="32" height="32" rx="8" fill="var(--ai)" />
      <path
        d="M16 6.4 17.7 14.3 25.6 16 17.7 17.7 16 25.6 14.3 17.7 6.4 16 14.3 14.3Z"
        fill="#fff"
      />
      <path
        d="M23.4 4.8 24.1 7.9 27.2 8.6 24.1 9.3 23.4 12.4 22.7 9.3 19.6 8.6 22.7 7.9Z"
        fill="#fff"
        fillOpacity="0.85"
      />
    </svg>
  );
}

/** Logo + wordmark lockup, used in the sidebar and on the sign-in screen. */
export function Brand({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {showWordmark && (
        <span className="text-base font-semibold tracking-tight text-foreground">
          Ticketly
        </span>
      )}
    </span>
  );
}
