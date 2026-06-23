import { Pencil } from "lucide-react";
import type { UserListItem, UserListResponse } from "@ticketly/shared";
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
    if (err.status === 403) return "You don't have permission to view users.";
    if (err.status === 401) return "Your session may have expired — please sign in again.";
  }
  return err instanceof Error ? err.message : "Failed to load users.";
}

export interface UsersTableProps {
  data: UserListResponse | undefined;
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
  onEditUser: (user: UserListItem) => void;
}

/**
 * Presentational user directory table: loading skeleton / error / empty / rows,
 * plus pagination and a per-row edit action. All data fetching and search/page
 * state live in the page (`routes/users.tsx`); this component just renders it.
 */
export function UsersTable({
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
  onEditUser,
}: UsersTableProps) {
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
            <TableHead className="pl-4">Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Joined</TableHead>
            <TableHead className="pr-4 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending ? (
            <SkeletonRows />
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center">
                <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                  <span>{toErrorMessage(error)}</span>
                  <Button variant="outline" size="sm" onClick={onRefetch}>
                    Try again
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : data && data.items.length > 0 ? (
            data.items.map((u) => <UserRow key={u.id} user={u} onEditUser={onEditUser} />)
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                {search ? `No users match “${search}”.` : "No users yet."}
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

function UserRow({
  user,
  onEditUser,
}: {
  user: UserListItem;
  onEditUser: (user: UserListItem) => void;
}) {
  return (
    <TableRow>
      <TableCell className="pl-4 font-medium text-foreground">{user.name}</TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        {user.role === "admin" ? <Badge>Admin</Badge> : <Badge variant="outline">Agent</Badge>}
      </TableCell>
      <TableCell>
        {user.banned ? (
          <Badge variant="destructive">Banned</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Active</span>
        )}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {dateFmt.format(new Date(user.createdAt))}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${user.name}`}
          onClick={() => onEditUser(user)}
        >
          <Pencil className="size-4" />
        </Button>
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
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-14" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-4 w-20" />
          </TableCell>
          <TableCell className="pr-4 text-right">
            <Skeleton className="ml-auto h-8 w-8" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
