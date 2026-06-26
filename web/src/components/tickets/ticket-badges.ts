import { type ComponentProps } from "react";
import type { TicketListItem } from "@ticketly/shared";
import { Badge } from "@/components/ui";

// Shared label/colour maps for ticket status + priority, the dashboard "view"
// bucket labels, and the enum label helper. Kept in a plain (non-component)
// module so Fast Refresh stays valid in the components that consume them — the
// table, the ticket header, the properties sidebar, the filter toolbar, and the
// tickets page header all import from here.

export type BadgeVariant = ComponentProps<typeof Badge>["variant"];

/** GENERAL_QUESTION → "General question". */
export function prettifyEnum(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

// Lookup maps keyed by the enum value: a `Record` over the union forces every
// status/priority to be listed, so adding a new variant is a type error until
// it's mapped (stronger than a switch, which silently misses cases). Colours
// encode the lifecycle: blue=new, indigo=processing(AI), ink=open (active),
// amber=waiting on customer, emerald=resolved, grey=closed.
export const STATUS_BADGES: Record<
  TicketListItem["status"],
  { label: string; variant: BadgeVariant }
> = {
  NEW: { label: "New", variant: "info" },
  PROCESSING: { label: "Processing", variant: "indigo" },
  OPEN: { label: "Open", variant: "default" },
  AWAITING_STUDENT: { label: "Awaiting", variant: "warning" },
  RESOLVED: { label: "Resolved", variant: "success" },
  CLOSED: { label: "Closed", variant: "secondary" },
};

export const PRIORITY_BADGES: Record<
  TicketListItem["priority"],
  { label: string; variant: BadgeVariant }
> = {
  HIGH: { label: "High", variant: "danger" },
  NORMAL: { label: "Normal", variant: "outline" },
  LOW: { label: "Low", variant: "secondary" },
};

// Labels for the dashboard "bucket" deep-link (?view=all|open|resolvedByAi).
// Shared by the tickets page header subtitle and the filter toolbar's active-view
// chip. A plain string-keyed map (not a closed enum Record) because `view` is a
// free query param validated server-side; the consumer falls back to the raw
// value for anything unmapped.
export const TICKET_VIEW_LABELS: Record<string, string> = {
  all: "All tickets",
  open: "Open tickets",
  resolvedByAi: "Resolved by AI",
};
