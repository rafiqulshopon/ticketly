import { type ComponentProps } from "react";
import type { TicketListItem, TicketListResponse } from "@ticketly/shared";
import { ApiError } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "You don't have permission to view tickets.";
    if (err.status === 401) return "Your session may have expired — please sign in again.";
  }
  return err instanceof Error ? err.message : "Failed to load tickets.";
}

/** GENERAL_QUESTION → "General question". */
function prettifyEnum(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

// Lookup maps keyed by the enum value: a `Record` over the union forces every
// status/priority to be listed, so adding a new variant is a type error until
// it's mapped (stronger than a switch, which silently misses cases).
const STATUS_BADGES: Record<TicketListItem["status"], { label: string; variant: BadgeVariant }> = {
  OPEN: { label: "Open", variant: "default" },
  AWAITING_STUDENT: { label: "Awaiting", variant: "secondary" },
  RESOLVED: { label: "Resolved", variant: "outline" },
  CLOSED: { label: "Closed", variant: "secondary" },
};

function StatusBadge({ status }: { status: TicketListItem["status"] }) {
  const { label, variant } = STATUS_BADGES[status];
  return <Badge variant={variant}>{label}</Badge>;
}

const PRIORITY_BADGES: Record<TicketListItem["priority"], { label: string; variant: BadgeVariant }> = {
  HIGH: { label: "High", variant: "destructive" },
  NORMAL: { label: "Normal", variant: "default" },
  LOW: { label: "Low", variant: "secondary" },
};

function PriorityBadge({ priority }: { priority: TicketListItem["priority"] }) {
  const { label, variant } = PRIORITY_BADGES[priority];
  return <Badge variant={variant}>{label}</Badge>;
}

export interface TicketsTableProps {
  data: TicketListResponse | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  /** Current search term, used only for the empty-state message. */
  search: string;
  page: number;
  pageSize: number;
  onRefetch: () => void;
  onPageChange: (page: number) => void;
}

/**
 * Presentational ticket list: loading skeleton / error / empty / rows, plus
 * pagination. All data fetching and search/page state live in the page
 * (`routes/tickets.tsx`); this component just renders it. Newest first is
 * enforced by the API (`createdAt DESC`) — the table renders rows in order.
 */
export function TicketsTable({
  data,
  isPending,
  isFetching,
  isError,
  error,
  search,
  page,
  pageSize,
  onRefetch,
  onPageChange,
}: TicketsTableProps) {
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = page * pageSize < total;

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">ID</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Requester</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead className="pr-4 text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending ? (
            <SkeletonRows />
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center">
                <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                  <span>{toErrorMessage(error)}</span>
                  <Button variant="outline" size="sm" onClick={onRefetch}>
                    Try again
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : data && data.items.length > 0 ? (
            data.items.map((t) => <TicketRow key={t.id} ticket={t} />)
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                {search ? `No tickets match “${search}”.` : "No tickets yet."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
        <span>
          {isPending ? "Loading…" : total === 0 ? "No results" : `Showing ${start}–${end} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev || isFetching}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext || isFetching}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}

function TicketRow({ ticket }: { ticket: TicketListItem }) {
  return (
    <TableRow>
      <TableCell className="pl-4 text-muted-foreground">#{ticket.id}</TableCell>
      <TableCell className="font-medium text-foreground">{ticket.subject}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-foreground">{ticket.requesterName}</span>
          <span className="text-xs text-muted-foreground">{ticket.requesterEmail}</span>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={ticket.status} />
      </TableCell>
      <TableCell>
        {ticket.category ? (
          <Badge variant="outline">{prettifyEnum(ticket.category)}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <PriorityBadge priority={ticket.priority} />
      </TableCell>
      <TableCell className="pr-4 text-right text-muted-foreground">
        {dateFmt.format(new Date(ticket.createdAt))}
      </TableCell>
    </TableRow>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell className="pl-4">
            <Skeleton className="h-4 w-8" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-48" />
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-14 rounded-full" />
          </TableCell>
          <TableCell className="pr-4 text-right">
            <Skeleton className="ml-auto h-4 w-20" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
