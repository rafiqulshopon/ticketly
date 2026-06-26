import { Pencil, Trash2 } from "lucide-react";
import type { UserListItem, UserListResponse } from "@ticketly/shared";
import { ApiError } from "@/lib/api";
import {
  Avatar,
  AvatarFallback,
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

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
  onDeleteUser: (user: UserListItem) => void;
}

/**
 * Presentational user directory table: loading skeleton / error / empty / rows,
 * plus pagination and per-row edit/delete actions. All data fetching and
 * search/page state live in the page (`routes/users.tsx`); this component just
 * renders it.
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
  onDeleteUser,
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
            data.items.map((u) => (
              <UserRow key={u.id} user={u} onEditUser={onEditUser} onDeleteUser={onDeleteUser} />
            ))
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
  onDeleteUser,
}: {
  user: UserListItem;
  onEditUser: (user: UserListItem) => void;
  onDeleteUser: (user: UserListItem) => void;
}) {
  // Admins can't be deleted (enforced server-side too); disable the button so
  // the row's actions stay aligned and the intent is clear.
  const isAdmin = user.role === "admin";
  return (
    <TableRow className="transition-colors hover:bg-secondary/50">
      <TableCell className="pl-4">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-7">
            <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{user.name}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        {user.role === "admin" ? <Badge>Admin</Badge> : <Badge variant="secondary">Agent</Badge>}
      </TableCell>
      <TableCell>
        {user.banned ? (
          <Badge variant="danger">Banned</Badge>
        ) : (
          <Badge variant="success">Active</Badge>
        )}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {dateFmt.format(new Date(user.createdAt))}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${user.name}`}
            onClick={() => onEditUser(user)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${user.name}`}
            title={isAdmin ? "Admins cannot be deleted" : `Delete ${user.name}`}
            disabled={isAdmin}
            onClick={() => onDeleteUser(user)}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
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
            <div className="ml-auto flex w-fit gap-1">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
