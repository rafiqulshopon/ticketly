import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ApiError, getTicket } from "@/lib/api";
import { Button, Card, CardContent } from "@/components/ui";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { DetailSkeleton } from "@/components/tickets/ticket-detail-skeleton";

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return "Ticket not found.";
    if (err.status === 403) return "You don't have permission to view this ticket.";
    if (err.status === 401) return "Your session may have expired — please sign in again.";
  }
  return err instanceof Error ? err.message : "Failed to load ticket.";
}

export function TicketDetailsPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["ticket", id],
    queryFn: ({ signal }) => getTicket(id, { signal }),
    retry: (failureCount, err) => !(err instanceof ApiError) && failureCount < 2,
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/tickets">← Back to tickets</Link>
      </Button>

      {isPending ? (
        <DetailSkeleton />
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
        <TicketDetail ticket={data} />
      ) : null}
    </div>
  );
}
