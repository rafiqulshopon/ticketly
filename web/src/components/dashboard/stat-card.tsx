import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui";

interface StatCardProps {
  /** Label shown above the value, e.g. "Open tickets". */
  label: string;
  /** Pre-formatted value to display, e.g. "42" or "3h 15m". */
  value: string;
  /** Optional supporting line under the value, e.g. "of 10 resolved". */
  description?: string;
  /** Optional icon shown in a chip at the top-right of the card. */
  icon?: ReactNode;
  /** "ai" tints the icon chip emerald to mark AI-derived metrics. */
  tone?: "default" | "ai";
  /** When true, renders skeletons for the label/value (initial load). */
  isLoading?: boolean;
  /** When set, the whole card becomes a router link (e.g. a dashboard deep-link
   *  into a filtered ticket list). Adds a hover affordance + focus ring. */
  to?: string;
}

/** A single metric tile for the dashboard. Composes shadcn Card primitives.
 *  Pass `to` to make it a navigable link. */
export function StatCard({ label, value, description, icon, tone = "default", isLoading, to }: StatCardProps) {
  const card = (
    <Card
      className={cn(
        "h-full",
        to &&
          "cursor-pointer transition-colors hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{isLoading ? <Skeleton className="h-4 w-24" /> : label}</CardDescription>
          {icon && (
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-md",
                tone === "ai" ? "bg-ai/10 text-ai" : "bg-secondary text-muted-foreground",
              )}
            >
              {icon}
            </span>
          )}
        </div>
        <CardTitle className="font-mono text-3xl tracking-tight tabular">
          {isLoading ? <Skeleton className="h-8 w-16" /> : value}
        </CardTitle>
      </CardHeader>
      {description && !isLoading && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      )}
    </Card>
  );

  return to ? (
    <Link to={to} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
      {card}
    </Link>
  ) : (
    card
  );
}
