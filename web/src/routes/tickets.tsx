import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type OnChangeFn, type SortingState } from "@tanstack/react-table";
import { ApiError, getTickets } from "@/lib/api";
import { TicketFilters, type TicketFiltersValue } from "@/components/tickets/ticket-filters";
import { TicketsTable } from "@/components/tickets/tickets-table";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export function TicketsPage() {
  // `query` is the raw input value; `search` is the debounced value used as a
  // query key. Typing updates the input immediately but only triggers a request
  // once the user pauses; any search change resets to the first page.
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // Server-side sort, newest first by default. The table owns the click UX; this
  // state drives the query key + the API request so the server does the ORDER BY.
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  // Server-side filters (status/category/priority); empty object = no filtering.
  const [filters, setFilters] = useState<TicketFiltersValue>({});

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Changing the sort restarts the listing at page 1 (mirrors the search reset).
  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater);
    setPage(1);
  };

  const sort = sorting[0];

  // TanStack Query owns loading/error/abort state keyed on [search, page, sorting].
  // The queryFn receives an AbortSignal so superseded requests are cancelled
  // automatically; keepPreviousData keeps old rows visible while a new page,
  // search, or sort loads instead of flashing skeletons. The server sorts.
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["tickets", search, page, sorting, filters],
    queryFn: ({ signal }) =>
      getTickets(
        {
          q: search || undefined,
          page,
          pageSize: PAGE_SIZE,
          sortBy: sort?.id,
          sortDir: sort?.desc ? "desc" : "asc",
          ...filters,
        },
        { signal },
      ),
    placeholderData: keepPreviousData,
    retry: (failureCount, err) => !(err instanceof ApiError) && failureCount < 2,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">Support requests, newest first.</p>
        </div>
        {data ? (
          <span className="hidden text-sm text-muted-foreground sm:block">
            {data.total} {data.total === 1 ? "ticket" : "tickets"}
          </span>
        ) : null}
      </div>

      <TicketFilters
        searchValue={query}
        onSearchChange={setQuery}
        value={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />

      <TicketsTable
        data={data}
        isPending={isPending}
        isFetching={isFetching}
        isError={isError}
        error={error}
        search={search}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        page={page}
        pageSize={PAGE_SIZE}
        onRefetch={() => void refetch()}
        onPageChange={setPage}
      />
    </div>
  );
}
