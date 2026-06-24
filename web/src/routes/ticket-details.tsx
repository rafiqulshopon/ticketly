import { type ComponentProps, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ticketCategoryEnum, type TicketDetail, type TicketMessage } from "@ticketly/shared";
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
import { PropertySelect } from "@/components/tickets/property-select";
import { ReplyForm } from "@/components/tickets/reply-form";
import { PRIORITY_BADGES, STATUS_BADGES, prettifyEnum } from "@/components/tickets/tickets-table";

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

// senderType → label + badge variant (object map, not a switch — adding a value
// is a type error until it's mapped here). The explicit `senderType` is the
// source of truth for the Agent/Customer distinction in the thread.
const MESSAGE_SENDER_TYPE: Record<TicketMessage["senderType"], { label: string; variant: BadgeVariant }> = {
  customer: { label: "Customer", variant: "secondary" },
  agent: { label: "Agent", variant: "default" },
};

// Select options derived from the existing badge map / enum — no re-hardcoded
// labels, and they match the table's badges exactly.
const STATUS_OPTIONS = Object.entries(STATUS_BADGES).map(([value, { label }]) => ({ value, label }));
const CATEGORY_OPTIONS = ticketCategoryEnum.options.map((value) => ({ value, label: prettifyEnum(value) }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_BADGES).map(([value, { label }]) => ({ value, label }));

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
        // Two-column on large screens: conversation thread (2/3) + sticky
        // properties sidebar (1/3). Stacks on narrow screens.
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <TicketHeader ticket={data} />
            <ConversationCard messages={data.messages} />
            <ReplyForm ticket={data} />
          </div>
          <aside className="self-start lg:col-span-1 lg:sticky lg:top-8">
            <PropertiesCard ticket={data} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function TicketHeader({ ticket }: { ticket: TicketDetail }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">Ticket #{ticket.id}</div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{ticket.subject}</h1>
      <div className="text-sm text-muted-foreground">
        <span className="text-foreground">{ticket.requesterName}</span>
        <span> · {ticket.requesterEmail}</span>
      </div>
    </div>
  );
}

function ConversationCard({ messages }: { messages: TicketMessage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Conversation</CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MessageItem({ message }: { message: TicketMessage }) {
  const meta = MESSAGE_SENDER_TYPE[message.senderType];
  const isAgent = message.senderType === "agent";
  // Customer: the external author (fromEmail). Agent: the staff agent (senderName),
  // replying to the requester (toEmail).
  const author = isAgent ? message.senderName ?? "Support team" : message.fromEmail;
  return (
    <div className={`flex flex-col gap-1 ${isAgent ? "items-end" : "items-start"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={meta.variant}>{meta.label}</Badge>
        <span className="font-medium text-foreground">{author}</span>
        {isAgent && <span>→ {message.toEmail}</span>}
      </div>
      <p
        className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
          isAgent ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {message.bodyText}
      </p>
      <span className="text-xs text-muted-foreground">{dateFmt.format(new Date(message.createdAt))}</span>
    </div>
  );
}

function PropertiesCard({ ticket }: { ticket: TicketDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Properties</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Cell label="Status">
          <PropertySelect
            ticketId={ticket.id}
            field="status"
            value={ticket.status}
            options={STATUS_OPTIONS}
          />
        </Cell>
        <Cell label="Priority">
          <PropertySelect
            ticketId={ticket.id}
            field="priority"
            value={ticket.priority}
            options={PRIORITY_OPTIONS}
          />
        </Cell>
        <Cell label="Assignee">
          <AssigneeSelect ticketId={ticket.id} assigneeId={ticket.assigneeId} />
        </Cell>
        <Cell label="Category">
          <PropertySelect
            ticketId={ticket.id}
            field="category"
            value={ticket.category}
            options={CATEGORY_OPTIONS}
            allowNull
            noneLabel="No category"
          />
        </Cell>

        <dl className="space-y-3 border-t pt-4 text-sm">
          <MetaRow label="Ticket ID" value={`#${ticket.id}`} />
          <MetaRow label="Created" value={dateFmt.format(new Date(ticket.createdAt))} />
          <MetaRow label="Updated" value={dateFmt.format(new Date(ticket.updatedAt))} />
        </dl>
      </CardContent>
    </Card>
  );
}

/** A labeled property cell: muted label stacked over a full-width control. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

/** A read-only label/value metadata row (definition list). */
function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
      <aside className="lg:col-span-1">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
