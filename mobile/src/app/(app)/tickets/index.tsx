import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ticketCategoryEnum, type TicketListItem } from "@ticketly/shared";
import { getAssignees, getTickets } from "@/lib/api";
import { isAdmin, useSession } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { useIconColor } from "@/lib/colors";
import { toErrorMessage } from "@/lib/errors";
import { Badge, EmptyState, ErrorState, LoadingState, Select, type SelectOption, TextField } from "@/components/ui";
import { PRIORITY_BADGES, STATUS_BADGES, TICKET_VIEW_LABELS, prettifyEnum } from "@/components/tickets/ticket-badges";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

// NEW/PROCESSING are AI-pipeline states. Admins can filter by them; agents never
// see those tickets, so the status filter omits them for non-admins.
const PIPELINE = new Set(["NEW", "PROCESSING"]);

const CATEGORY_OPTIONS: SelectOption[] = ticketCategoryEnum.options.map((value) => ({
  value,
  label: prettifyEnum(value),
}));
const PRIORITY_OPTIONS: SelectOption[] = Object.entries(PRIORITY_BADGES).map(([value, { label }]) => ({
  value,
  label,
}));

// One control encodes the server's (sortBy, sortDir) pair — simpler on mobile
// than two separate selects. Values mirror listTicketsQuery's sortBy enum.
const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first", sortBy: "createdAt", sortDir: "desc" },
  { value: "createdAt:asc", label: "Oldest first", sortBy: "createdAt", sortDir: "asc" },
  { value: "subject:asc", label: "Subject A → Z", sortBy: "subject", sortDir: "asc" },
  { value: "requesterName:asc", label: "Requester A → Z", sortBy: "requesterName", sortDir: "asc" },
  { value: "status:asc", label: "Status", sortBy: "status", sortDir: "asc" },
] as const;

function cap(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Tickets inbox — search, server-side sort/filter/paginate, role-aware
 *  statuses. Replaces the M0 smoke test with the full UI. */
export default function TicketsScreen() {
  const { data: session } = useSession();
  const admin = isAdmin(session?.user?.role);
  // The Tickets tab header is hidden (see (app)/_layout.tsx), so the inbox
  // owns its top safe-area inset itself — via a SafeAreaView wrapper. Wrapping
  // (rather than a contentContainerStyle paddingTop) keeps the pull-to-refresh
  // spinner below the status bar; padding the content instead renders the
  // spinner at y=0, hidden behind the notch.
  // Dashboard deep-link: ?view=all|open|resolvedByAi. While present, the server
  // bucket wins and the manual status filter is suppressed — the server ignores
  // `view` once `status` is set, so we withhold `status` to let the view apply.
  const { view } = useLocalSearchParams<{ view?: "all" | "open" | "resolvedByAi" }>();

  // `query` is the raw input; `search` is the debounced value used as the query
  // key. Typing updates the input immediately but only requests once the user
  // pauses; any search/sort/filter change resets to page 1.
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>(SORT_OPTIONS[0].value);
  const [status, setStatus] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // A new view bucket (deep-link) starts on page 1. Adjusted during render via
  // the "previous value" pattern rather than in an effect — a synchronous
  // setState-in-effect would trip react-hooks/set-state-in-effect.
  const [prevView, setPrevView] = useState(view);
  if (view !== prevView) {
    setPrevView(view);
    setPage(1);
  }

  const sort = SORT_OPTIONS.find((s) => s.value === sortKey) ?? SORT_OPTIONS[0];
  // RefreshControl can't take className — it needs raw hex, sourced from the
  // token resolver (same hook the dashboard icons use).
  const primary = useIconColor("primary");

  // keepPreviousData keeps the old rows visible while a new page/search/sort
  // loads instead of flashing a spinner. The AbortSignal cancels superseded
  // requests. The server does the ORDER BY + filtering.
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["tickets", search, page, sort.sortBy, sort.sortDir, status, category, priority, assigneeId, view ?? null],
    queryFn: ({ signal }) =>
      getTickets(
        {
          q: search || undefined,
          page,
          pageSize: PAGE_SIZE,
          sortBy: sort.sortBy,
          sortDir: sort.sortDir,
          status: view ? undefined : (status ?? undefined),
          category: category ?? undefined,
          priority: priority ?? undefined,
          assigneeId: assigneeId ?? undefined,
          view: view || undefined,
        },
        { signal },
      ),
    placeholderData: keepPreviousData,
  });

  const assignees = useQuery({
    queryKey: ["assignees"],
    queryFn: ({ signal }) => getAssignees({ signal }),
  });

  const statusOptions: SelectOption[] = Object.entries(STATUS_BADGES)
    .filter(([value]) => admin || !PIPELINE.has(value))
    .map(([value, { label }]) => ({ value, label }));
  const assigneeOptions: SelectOption[] = (assignees.data ?? []).map((a) => ({
    value: a.id,
    label: `${a.name} · ${cap(a.role)}`,
  }));

  function applyFilter(setter: (v: string | null) => void) {
    return (v: string | null) => {
      setter(v);
      setPage(1);
    };
  }
  function applySort(v: string | null) {
    setSortKey(v ?? SORT_OPTIONS[0].value);
    setPage(1);
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (isPending) return <LoadingState />;

  if (isError && !data) {
    return <ErrorState message={toErrorMessage(error)} onRetry={() => void refetch()} />;
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
    <FlatList
      className="bg-background"
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isPending}
          onRefresh={() => void refetch()}
          tintColor={primary}
          colors={[primary]}
        />
      }
      data={data?.items ?? []}
      keyExtractor={(t) => String(t.id)}
      contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
      ListHeaderComponent={
        <View>
          <Text className="text-2xl font-semibold text-foreground">Tickets</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            {total} {total === 1 ? "ticket" : "tickets"}
          </Text>

          {view ? (
            <View className="mt-3 flex flex-row items-center gap-2 self-start rounded-full bg-secondary px-3 py-1">
              <Text className="text-xs text-secondary-foreground">
                Showing: {TICKET_VIEW_LABELS[view] ?? view}
              </Text>
              <Pressable
                hitSlop={8}
                onPress={() => router.setParams({ view: undefined })}
                accessibilityLabel="Clear filter"
              >
                <Text className="text-xs text-secondary-foreground">✕</Text>
              </Pressable>
            </View>
          ) : null}

          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="Search subject or requester…"
            className="mt-3"
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10, paddingBottom: 2 }}>
            <View style={{ width: 160 }}>
              <Select
                value={status}
                options={statusOptions}
                onValueChange={applyFilter(setStatus)}
                allowNull
                noneLabel="All statuses"
                placeholder="All statuses"
              />
            </View>
            <View style={{ width: 150 }}>
              <Select
                value={priority}
                options={PRIORITY_OPTIONS}
                onValueChange={applyFilter(setPriority)}
                allowNull
                noneLabel="Any priority"
                placeholder="Any priority"
              />
            </View>
            <View style={{ width: 170 }}>
              <Select
                value={category}
                options={CATEGORY_OPTIONS}
                onValueChange={applyFilter(setCategory)}
                allowNull
                noneLabel="Any category"
                placeholder="Any category"
              />
            </View>
            <View style={{ width: 170 }}>
              <Select
                value={assigneeId}
                options={assigneeOptions}
                onValueChange={applyFilter(setAssigneeId)}
                allowNull
                noneLabel="Anyone"
                placeholder="Anyone"
              />
            </View>
            <View style={{ width: 170 }}>
              <Select
                value={sortKey}
                options={SORT_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                onValueChange={applySort}
                placeholder="Sort"
              />
            </View>
          </ScrollView>
        </View>
      }
      ListEmptyComponent={<EmptyState message="No tickets match these filters." />}
      ListFooterComponent={
        total === 0 ? null : (
          <View className="mt-2 flex flex-row items-center justify-between">
            <Pressable onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <Text className={page <= 1 ? "text-muted-foreground" : "text-primary"}>‹ Prev</Text>
            </Pressable>
            <Text className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </Text>
            <Pressable onPress={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <Text className={page >= totalPages ? "text-muted-foreground" : "text-primary"}>Next ›</Text>
            </Pressable>
          </View>
        )
      }
      renderItem={({ item }) => <TicketRow ticket={item} />}
    />
    </SafeAreaView>
  );
}

function TicketRow({ ticket }: { ticket: TicketListItem }) {
  const statusBadge = STATUS_BADGES[ticket.status];
  const priorityBadge = PRIORITY_BADGES[ticket.priority];
  return (
    <Pressable
      onPress={() => router.navigate(`/tickets/${ticket.id}`)}
      className="rounded-lg border border-border bg-card p-4"
    >
      <View className="flex flex-row items-center justify-between gap-2">
        <Text className="flex-1 font-semibold text-foreground" numberOfLines={1}>
          {ticket.subject}
        </Text>
        <Badge variant={priorityBadge.variant}>{priorityBadge.label}</Badge>
      </View>
      <View className="mt-1 flex flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-muted-foreground" numberOfLines={1}>
          {ticket.requesterName}
        </Text>
        <Text className="text-muted-foreground">{relativeTime(ticket.createdAt)}</Text>
      </View>
      <View className="mt-2 flex flex-row items-center gap-2">
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        {ticket.category ? <Badge variant="outline">{prettifyEnum(ticket.category)}</Badge> : null}
      </View>
    </Pressable>
  );
}
