import type { TicketListItem } from "@ticketly/shared";
import { type BadgeVariant } from "@/components/ui";

export type { BadgeVariant };

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
export const STATUS_BADGES: Record<TicketListItem["status"], { label: string; variant: BadgeVariant }> = {
  NEW: { label: "New", variant: "info" },
  PROCESSING: { label: "Processing", variant: "indigo" },
  OPEN: { label: "Open", variant: "default" },
  AWAITING_STUDENT: { label: "Awaiting", variant: "warning" },
  RESOLVED: { label: "Resolved", variant: "success" },
  CLOSED: { label: "Closed", variant: "secondary" },
};

export const PRIORITY_BADGES: Record<TicketListItem["priority"], { label: string; variant: BadgeVariant }> = {
  HIGH: { label: "High", variant: "danger" },
  NORMAL: { label: "Normal", variant: "outline" },
  LOW: { label: "Low", variant: "secondary" },
};

// Labels for the dashboard "bucket" deep-link (?view=all|open|resolvedByAi).
// A plain string-keyed map (not a closed enum Record) because `view` is a free
// query param validated server-side; the consumer falls back to the raw value.
export const TICKET_VIEW_LABELS: Record<string, string> = {
  all: "All tickets",
  open: "Open tickets",
  resolvedByAi: "Resolved by AI",
};
