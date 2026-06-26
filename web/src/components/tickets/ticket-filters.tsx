import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAssignees } from "@/lib/api";
import { TICKET_VIEW_LABELS } from "@/components/tickets/ticket-badges";
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

export type TicketFiltersValue = {
  status?: string;
  category?: string;
  priority?: string;
  assigneeId?: string;
};

/** Sentinel for "no filter" — Radix Select can't use an empty-string value. */
const ALL = "__all__";

type Option = { value: string; label: string };

// Option labels mirror the table's badge labels so a filter and its badge read the same.
// New/Processing are the AI auto-resolution pipeline states — admin-only in the
// list, so they're filtered out of the dropdown for agents (see TicketFilters).
const STATUS_OPTIONS: Option[] = [
  { value: "NEW", label: "New" },
  { value: "PROCESSING", label: "Processing" },
  { value: "OPEN", label: "Open" },
  { value: "AWAITING_STUDENT", label: "Awaiting" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

/** Statuses agents may not see/filter by — the AI pipeline owns them. */
const AGENT_HIDDEN_STATUS = new Set(["NEW", "PROCESSING"]);

const CATEGORY_OPTIONS: Option[] = [
  { value: "GENERAL_QUESTION", label: "General question" },
  { value: "TECHNICAL_QUESTION", label: "Technical question" },
  { value: "REFUND_REQUEST", label: "Refund request" },
  { value: "SPAM", label: "Spam" },
];

const PRIORITY_OPTIONS: Option[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
];

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: Option[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger className="w-40" aria-label={`Filter by ${label.toLowerCase()}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface TicketFiltersProps {
  /** Raw search box value (the page debounces it before it hits the API). */
  searchValue: string;
  onSearchChange: (value: string) => void;
  value: TicketFiltersValue;
  onChange: (value: TicketFiltersValue) => void;
  /** Active dashboard "bucket" deep-link (?view=…), or undefined. When set, the
   *  Status dropdown is replaced by a removable chip (a view is itself a status
   *  predicate, so the two would conflict). */
  view?: string;
  onClearView?: () => void;
  /** When false (agents), the NEW/PROCESSING pipeline states are hidden from the
   *  Status dropdown — matching the server-side list filter. */
  isAdmin?: boolean;
}

/**
 * Tickets toolbar: a single row with the search box + Status / Category /
 * Priority / Assignee dropdowns + a Clear button (shown when a dropdown filter
 * is active).
 * All controls are flat flex siblings so they sit on one line and wrap together.
 * State is owned by the page; this only renders controls and reports changes.
 */
export function TicketFilters({ searchValue, onSearchChange, value, onChange, view, onClearView, isAdmin }: TicketFiltersProps) {
  // A view is a status predicate, so it counts as an active filter (for showing
  // the Clear button) and disables the Status dropdown until cleared.
  const hasActive = Object.values(value).some(Boolean) || Boolean(view);
  const setField = (field: keyof TicketFiltersValue, next: string | undefined) =>
    onChange({ ...value, [field]: next });

  // Agents can't see or filter by the AI pipeline states; admins get the full set.
  const statusOptions = isAdmin ? STATUS_OPTIONS : STATUS_OPTIONS.filter((o) => !AGENT_HIDDEN_STATUS.has(o.value));

  // Staff options are dynamic; loaded once and shared with the ticket-detail
  // assignee picker via the `["assignees"]` cache key. Empty until the first
  // response arrives — the dropdown then only shows "All assignees".
  const assigneesQuery = useQuery({
    queryKey: ["assignees"],
    queryFn: ({ signal }) => getAssignees({ signal }),
  });
  const assigneeOptions: Option[] =
    assigneesQuery.data?.map((a) => ({ value: a.id, label: a.name })) ?? [];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search subject or requester…"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search tickets"
          className="pl-9"
        />
      </div>
      {view ? (
        <Badge variant="secondary" className="gap-1 rounded-md py-1.5">
          {TICKET_VIEW_LABELS[view] ?? view}
          {onClearView && (
            <button
              type="button"
              onClick={onClearView}
              aria-label="Clear view filter"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </Badge>
      ) : (
        <FilterSelect
          label="Status"
          value={value.status}
          options={statusOptions}
          onChange={(v) => setField("status", v)}
        />
      )}
      <FilterSelect
        label="Category"
        value={value.category}
        options={CATEGORY_OPTIONS}
        onChange={(v) => setField("category", v)}
      />
      <FilterSelect
        label="Priority"
        value={value.priority}
        options={PRIORITY_OPTIONS}
        onChange={(v) => setField("priority", v)}
      />
      <FilterSelect
        label="Assignee"
        value={value.assigneeId}
        options={assigneeOptions}
        onChange={(v) => setField("assigneeId", v)}
      />
      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange({});
            onClearView?.();
          }}
        >
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
