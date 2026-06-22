import { useCallback, useEffect, useState } from "react";
import type { UserListResponse } from "@ticketly/shared";
import { ApiError, getUsers } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

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

export function UsersPage() {
  // `query` is the raw input value; `search` is the debounced value sent to the
  // API. Typing updates `query` immediately (responsive input) but only triggers
  // a request once the user pauses.
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<UserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box; any change resets to the first page. `loading` is
  // flipped here (inside the timer, not synchronously in the effect) so the
  // spinner shows while the next request is in flight.
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch whenever the active search / page changes. All setState here runs in
  // the async continuation (after `await`), never synchronously during render.
  useEffect(() => {
    const ctrl = new AbortController();
    let active = true;
    (async () => {
      try {
        const res = await getUsers(
          { q: search || undefined, page, pageSize: PAGE_SIZE },
          { signal: ctrl.signal },
        );
        if (!active) return;
        setData(res);
        setError(null);
      } catch (err) {
        if (!active) return; // superseded by a newer request
        setError(toErrorMessage(err));
        setData(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      ctrl.abort();
    };
  }, [search, page, reloadKey]);

  // Event-handler setState (not effect) — the rule-compliant place to mark a
  // fresh load before the fetch effect picks up the new page / reload token.
  const goToPage = useCallback((next: number) => {
    setLoading(true);
    setPage(next);
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  const hasPrev = page > 1;
  const hasNext = page * PAGE_SIZE < total;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage admin and agent accounts. Visible to administrators only.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            type="search"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search users"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={retry}>
                      Try again
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : data && data.items.length > 0 ? (
              data.items.map((u) => <UserRow key={u.id} user={u} />)
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {search ? `No users match “${search}”.` : "No users yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            {loading ? "Loading…" : total === 0 ? "No results" : `Showing ${start}–${end} of ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev || loading}
              onClick={() => goToPage(Math.max(1, page - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext || loading}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function UserRow({ user }: { user: UserListResponse["items"][number] }) {
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
      <TableCell className="pr-4 text-right text-muted-foreground">
        {dateFmt.format(new Date(user.createdAt))}
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
          <TableCell className="pr-4 text-right">
            <Skeleton className="ml-auto h-4 w-20" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
