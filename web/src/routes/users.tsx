import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError, getUsers } from "@/lib/api";
import { Button, Input } from "@/components/ui";
import { CreateUserDialog } from "@/components/users/create-user-dialog";
import { UsersTable } from "@/components/users/users-table";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export function UsersPage() {
  // `query` is the raw input value; `search` is the debounced value used as a
  // query key. Typing updates the input immediately but only triggers a request
  // once the user pauses; any search change resets to the first page.
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // TanStack Query owns loading/error/abort state keyed on [search, page]. The
  // queryFn receives an AbortSignal so superseded requests (faster new search,
  // StrictMode remount) are cancelled automatically; keepPreviousData keeps the
  // old rows visible while a new page/search loads instead of flashing skeletons.
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["users", search, page],
    queryFn: ({ signal }) =>
      getUsers({ q: search || undefined, page, pageSize: PAGE_SIZE }, { signal }),
    placeholderData: keepPreviousData,
    // Don't retry HTTP errors (401/403/5xx won't fix themselves); do retry a
    // couple of times on transient network failures.
    retry: (failureCount, err) => !(err instanceof ApiError) && failureCount < 2,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage admin and agent accounts. Visible to administrators only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateOpen(true)}>Create user</Button>
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
      </div>

      <UsersTable
        data={data}
        isPending={isPending}
        isFetching={isFetching}
        isError={isError}
        error={error}
        search={search}
        page={page}
        pageSize={PAGE_SIZE}
        onRefetch={() => void refetch()}
        onPageChange={setPage}
      />

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
