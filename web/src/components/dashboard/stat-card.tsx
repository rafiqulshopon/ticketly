import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui";

interface StatCardProps {
  /** Label shown above the value, e.g. "Open tickets". */
  label: string;
  /** Pre-formatted value to display, e.g. "42" or "3h 15m". */
  value: string;
  /** Optional supporting line under the value, e.g. "of 10 resolved". */
  description?: string;
  /** When true, renders skeletons for the label/value (initial load). */
  isLoading?: boolean;
}

/** A single metric tile for the dashboard. Composes shadcn Card primitives. */
export function StatCard({ label, value, description, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{isLoading ? <Skeleton className="h-4 w-24" /> : label}</CardDescription>
        <CardTitle className="text-3xl">
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
}
