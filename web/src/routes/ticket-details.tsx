import { type ComponentProps, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { TicketDetail, TicketMessage } from "@ticketly/shared";
import { ApiError, getTicket } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui";
import { AssigneeSelect } from "@/components/tickets/assignee-select";
import {
  PRIORITY_BADGES,
  STATUS_BADGES,
  prettifyEnum,
} from "@/components/tickets/tickets-table";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return "Ticket not found.";
    if (err.status === 403) return "You don't have permission to view this ticket.";
    if (err.status === 401) return "Your session may have expired — please sign in again.";
  }
  return err instanceof Error ? err.message : "Failed to load ticket.";
}

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

// Direction → label + badge variant, keyed by the enum (object map, not a switch,
// so adding a direction is a type error until it's mapped here).
const MESSAGE_DIRECTION: Record<TicketMessage["direction"], { label: string; variant: BadgeVariant }> = {
  inbound: { label: "Inbound", variant: "secondary" },
  outbound: { label: "Outbound", variant: "default" },
};

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
        <>
          <TicketDetailCard ticket={data} />
          <ConversationCard messages={data.messages} />
        </>
      ) : null}
    </div>
  );
}

function TicketDetailCard({ ticket }: { ticket: TicketDetail }) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGES[ticket.status].variant}>
            {STATUS_BADGES[ticket.status].label}
          </Badge>
          <Badge variant={PRIORITY_BADGES[ticket.priority].variant}>
            {PRIORITY_BADGES[ticket.priority].label}
          </Badge>
        </div>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          {ticket.subject}
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <Row label="Ticket ID" value={`#${ticket.id}`} />
        <Row
          label="Requester"
          value={
            <span>
              {ticket.requesterName}
              <span className="text-muted-foreground"> · {ticket.requesterEmail}</span>
            </span>
          }
        />
        <Row label="Assignee" value={<AssigneeSelect ticketId={ticket.id} assigneeId={ticket.assigneeId} />} />
        <Row
          label="Category"
          value={
            ticket.category ? (
              <Badge variant="outline">{prettifyEnum(ticket.category)}</Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
        />
        <Row label="Created" value={dateFmt.format(new Date(ticket.createdAt))} />
        <Row label="Updated" value={dateFmt.format(new Date(ticket.updatedAt))} />
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function ConversationCard({ messages }: { messages: TicketMessage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Conversation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((message) => <MessageItem key={message.id} message={message} />)
        )}
      </CardContent>
    </Card>
  );
}

function MessageItem({ message }: { message: TicketMessage }) {
  const meta = MESSAGE_DIRECTION[message.direction];
  const isInbound = message.direction === "inbound";
  // Inbound: the author is the external sender (fromEmail). Outbound: the staff
  // agent (senderName), replying to the requester (toEmail).
  const author = isInbound ? message.fromEmail : message.senderName ?? "Support team";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          <span className="text-sm font-medium text-foreground">{author}</span>
          {!isInbound && <span className="text-sm text-muted-foreground">→ {message.toEmail}</span>}
        </div>
        <span className="text-xs text-muted-foreground">{dateFmt.format(new Date(message.createdAt))}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{message.bodyText}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-7 w-2/3" />
      </CardHeader>
      <CardContent className="divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
