import { Search, X } from "lucide-react";
import {
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
};

/** Sentinel for "no filter" — Radix Select can't use an empty-string value. */
const ALL = "__all__";

type Option = { value: string; label: string };

// Option labels mirror the table's badge labels so a filter and its badge read the same.
const STATUS_OPTIONS: Option[] = [
  { value: "OPEN", label: "Open" },
  { value: "AWAITING_STUDENT", label: "Awaiting" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

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
}

/**
 * Tickets toolbar: a single row with the search box + Status / Category /
 * Priority dropdowns + a Clear button (shown when a dropdown filter is active).
 * All controls are flat flex siblings so they sit on one line and wrap together.
 * State is owned by the page; this only renders controls and reports changes.
 */
export function TicketFilters({ searchValue, onSearchChange, value, onChange }: TicketFiltersProps) {
  const hasActive = Object.values(value).some(Boolean);
  const setField = (field: keyof TicketFiltersValue, next: string | undefined) =>
    onChange({ ...value, [field]: next });

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <FilterSelect
        label="Status"
        value={value.status}
        options={STATUS_OPTIONS}
        onChange={(v) => setField("status", v)}
      />
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
      {hasActive && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
