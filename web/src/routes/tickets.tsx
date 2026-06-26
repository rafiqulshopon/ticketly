import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type OnChangeFn, type SortingState } from "@tanstack/react-table";
import { useSearchParams } from "react-router-dom";
import { ApiError, getTickets } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { TICKET_VIEW_LABELS } from "@/components/tickets/ticket-badges";
import { TicketFilters, type TicketFiltersValue } from "@/components/tickets/ticket-filters";
import { TicketsTable } from "@/components/tickets/tickets-table";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export function TicketsPage() {
  // The AI pipeline states (NEW/PROCESSING) are admin-only in the list — both
  // the backend filter and the status dropdown options key off the viewer's role.
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

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

  // Dashboard "bucket" deep-link (?view=all|open|resolvedByAi). Lives in the URL
  // so it's shareable/bookmarkable and survives navigation; mirrors the dashboard
  // stat card predicates on the server. Selecting a view is itself a status
  // predicate, so the toolbar swaps the Status dropdown for a removable chip while
  // one is active.
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") ?? undefined;

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // A new bucket (via a dashboard card click) changes the result set, so restart
  // at page 1. Adjusting state during render — rather than in an effect — avoids
  // the cascading render an effect-based reset would trigger: React restarts the
  // in-flight render with the updated page and discards the intermediate output.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevView, setPrevView] = useState(view);
  if (view !== prevView) {
    setPrevView(view);
    setPage(1);
  }

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
    queryKey: ["tickets", search, page, sorting, filters, view],
    queryFn: ({ signal }) =>
      getTickets(
        {
          q: search || undefined,
          page,
          pageSize: PAGE_SIZE,
          sortBy: sort?.id,
          sortDir: sort?.desc ? "desc" : "asc",
          ...filters,
          view,
        },
        { signal },
      ),
    placeholderData: keepPreviousData,
    retry: (failureCount, err) => !(err instanceof ApiError) && failureCount < 2,
  });

  // Drop the bucket from the URL (replace, so it doesn't add a history entry) —
  // re-enables the Status dropdown and returns to the default inbox view.
  const handleClearView = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("view");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            {view ? `${TICKET_VIEW_LABELS[view] ?? "Tickets"} · newest first` : "Support requests, newest first."}
          </p>
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
        view={view}
        onClearView={handleClearView}
        isAdmin={isAdmin}
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
