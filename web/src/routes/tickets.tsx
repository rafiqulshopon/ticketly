import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError, getTickets } from "@/lib/api";
import { Input } from "@/components/ui";
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

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // TanStack Query owns loading/error/abort state keyed on [search, page]. The
  // queryFn receives an AbortSignal so superseded requests are cancelled
  // automatically; keepPreviousData keeps old rows visible while a new page or
  // search loads instead of flashing skeletons. The server returns newest first.
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["tickets", search, page],
    queryFn: ({ signal }) =>
      getTickets({ q: search || undefined, page, pageSize: PAGE_SIZE }, { signal }),
    placeholderData: keepPreviousData,
    retry: (failureCount, err) => !(err instanceof ApiError) && failureCount < 2,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">Support inbox, newest first.</p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            type="search"
            placeholder="Search subject or requester…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tickets"
          />
        </div>
      </div>

      <TicketsTable
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
    </div>
  );
}
