import { type ComponentProps, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Link } from "@/components/link";
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
export function prettifyEnum(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

// Lookup maps keyed by the enum value: a `Record` over the union forces every
// status/priority to be listed, so adding a new variant is a type error until
// it's mapped (stronger than a switch, which silently misses cases).
export const STATUS_BADGES: Record<TicketListItem["status"], { label: string; variant: BadgeVariant }> = {
  NEW: { label: "New", variant: "secondary" },
  PROCESSING: { label: "Processing", variant: "secondary" },
  OPEN: { label: "Open", variant: "default" },
  AWAITING_STUDENT: { label: "Awaiting", variant: "secondary" },
  RESOLVED: { label: "Resolved", variant: "outline" },
  CLOSED: { label: "Closed", variant: "secondary" },
};

function StatusBadge({ status }: { status: TicketListItem["status"] }) {
  const { label, variant } = STATUS_BADGES[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export const PRIORITY_BADGES: Record<TicketListItem["priority"], { label: string; variant: BadgeVariant }> = {
  HIGH: { label: "High", variant: "destructive" },
  NORMAL: { label: "Normal", variant: "default" },
  LOW: { label: "Low", variant: "secondary" },
};

function PriorityBadge({ priority }: { priority: TicketListItem["priority"] }) {
  const { label, variant } = PRIORITY_BADGES[priority];
  return <Badge variant={variant}>{label}</Badge>;
}

/**
 * Per-column layout overrides keyed by column id (object map, no switch): the ID
 * column gets left padding and the Created column is right-aligned, matching the
 * original table. Other columns use the shadcn defaults.
 */
const COLUMN_LAYOUT: Partial<Record<string, string>> = {
  id: "pl-4",
  createdAt: "pr-4 text-right",
};

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="size-3.5" />;
  if (sorted === "desc") return <ArrowDown className="size-3.5" />;
  return <ChevronsUpDown className="size-3.5 opacity-50" />;
}

/**
 * Clickable column header that toggles the server sort via
 * `column.getToggleSortingHandler()`. The active column is highlighted
 * (text-foreground); inactive sortable columns show a faint ChevronsUpDown hint.
 */
function SortHeader({
  column,
  children,
}: {
  column: Column<TicketListItem, unknown>;
  children: ReactNode;
}) {
  const sorted = column.getIsSorted();
  const active = sorted !== false;
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 text-left font-medium ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={column.getToggleSortingHandler()}
    >
      {children}
      <SortIcon sorted={sorted} />
    </button>
  );
}

// Column ids match the shared `sortBy` enum and the Prisma field names exactly,
// so the same string flows: TanStack column id → wire param → server ORDER BY.
// Priority/category/id are non-sortable (alphabetical enum sort is misleading).
const columns: ColumnDef<TicketListItem>[] = [
  {
    id: "id",
    enableSorting: false,
    header: "ID",
    cell: ({ row }) => <span className="text-muted-foreground">#{row.original.id}</span>,
  },
  {
    accessorKey: "subject",
    header: ({ column }) => <SortHeader column={column}>Subject</SortHeader>,
    cell: ({ row }) => (
      <Link to={`/tickets/${row.original.id}`} className="font-medium">
        {row.original.subject}
      </Link>
    ),
  },
  {
    accessorKey: "requesterName",
    header: ({ column }) => <SortHeader column={column}>Requester</SortHeader>,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-foreground">{row.original.requesterName}</span>
        <span className="text-xs text-muted-foreground">{row.original.requesterEmail}</span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortHeader column={column}>Status</SortHeader>,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "category",
    enableSorting: false,
    header: "Category",
    cell: ({ row }) =>
      row.original.category ? (
        <Badge variant="outline">{prettifyEnum(row.original.category)}</Badge>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
  {
    id: "priority",
    enableSorting: false,
    header: "Priority",
    cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
  },
  {
    accessorKey: "createdAt",
    // Dates read newest-first by default when first sorted.
    sortDescFirst: true,
    header: ({ column }) => <SortHeader column={column}>Created</SortHeader>,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{dateFmt.format(new Date(row.original.createdAt))}</span>
    ),
  },
];

export interface TicketsTableProps {
  data: TicketListResponse | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  /** Current search term, used only for the empty-state message. */
  search: string;
  /** Controlled sort state (single-column, server-authoritative). */
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  page: number;
  pageSize: number;
  onRefetch: () => void;
  onPageChange: (page: number) => void;
}

/**
 * Presentational ticket list built on TanStack Table with server-side
 * (`manual`) sorting. Sorting is controlled by the page: `sorting` +
 * `onSortingChange` flow up to the query key and the API request, and the server
 * performs the actual `ORDER BY` — TanStack only manages sort state + the
 * header indicators. Loading skeleton / error / empty states and pagination are
 * rendered as before.
 */
export function TicketsTable({
  data,
  isPending,
  isFetching,
  isError,
  error,
  search,
  sorting,
  onSortingChange,
  page,
  pageSize,
  onRefetch,
  onPageChange,
}: TicketsTableProps) {
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange,
    manualSorting: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
  });

  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = page * pageSize < total;

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className={COLUMN_LAYOUT[header.column.id] ?? ""}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isPending ? (
            <SkeletonRows />
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center">
                <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                  <span>{toErrorMessage(error)}</span>
                  <Button variant="outline" size="sm" onClick={onRefetch}>
                    Try again
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : data && data.items.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={COLUMN_LAYOUT[cell.column.id] ?? ""}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
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
