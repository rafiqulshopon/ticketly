import { useQuery } from "@tanstack/react-query";
import { Clock, Inbox, Sparkles, Ticket, Wand2 } from "lucide-react";
import { ApiError, getDashboardStats } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, Skeleton } from "@/components/ui";
import { StatCard } from "@/components/dashboard/stat-card";
import { TicketsPerDayChart } from "@/components/dashboard/tickets-per-day-chart";
import { formatDuration } from "@/lib/format";

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "You don't have permission to view the dashboard.";
    if (err.status === 401) return "Your session may have expired — please sign in again.";
  }
  return err instanceof Error ? err.message : "Failed to load dashboard metrics.";
}

export function DashboardPage() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: ({ signal }) => getDashboardStats({ signal }),
    retry: (failureCount, err) => !(err instanceof ApiError) && failureCount < 2,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      {isPending ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }, (_, i) => (
              <StatCard key={i} label="" value="" isLoading />
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-70 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
            <span>{toErrorMessage(error)}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total tickets"
              value={data.totalTickets.toLocaleString()}
              icon={<Ticket className="size-4" />}
            />
            <StatCard
              label="Open tickets"
              value={data.openTickets.toLocaleString()}
              icon={<Inbox className="size-4" />}
            />
            <StatCard
              label="Resolved by AI"
              value={data.resolvedByAi.toLocaleString()}
              description={`of ${data.totalResolved.toLocaleString()} resolved`}
              icon={<Sparkles className="size-4" />}
              tone="ai"
            />
            <StatCard
              label="AI resolution rate"
              value={`${data.aiResolutionRate.toFixed(1)}%`}
              icon={<Wand2 className="size-4" />}
              tone="ai"
            />
            <StatCard
              label="Avg. resolution time"
              value={formatDuration(data.avgResolutionTimeMs)}
              icon={<Clock className="size-4" />}
            />
          </div>
          <TicketsPerDayChart data={data.ticketsPerDay} />
        </div>
      ) : null}
    </div>
  );
}
