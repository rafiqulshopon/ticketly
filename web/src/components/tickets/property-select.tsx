import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateTicketInput } from "@ticketly/shared";
import { ApiError, updateTicket } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

// Radix Select forbids empty-string item values, so represent "no value"
// (category = null) with a sentinel and map it to null when submitting.
const NONE = "__none__";

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return "That value isn't allowed.";
    if (err.status === 404) return "Ticket not found.";
    if (err.status === 403) return "You don't have permission to edit this ticket.";
  }
  return err instanceof Error ? err.message : "Couldn't update the ticket.";
}

export interface PropertySelectProps {
  ticketId: number;
  field: "status" | "category" | "priority";
  value: string | null;
  options: { value: string; label: string }[];
  /** When true, render a "none" option that clears the field to null (category). */
  allowNull?: boolean;
  noneLabel?: string;
}

/**
 * Inline-edit `<Select>` for a scalar ticket field (status or category). Mirrors
 * AssigneeSelect's optimistic pattern: a local `pendingValue` overlays the
 * committed prop for immediate feedback, PATCHes on change, and reverts (with an
 * error message) if the mutation fails. On success the detail cache is updated
 * from the response and the ticket list is invalidated.
 */
export function PropertySelect({
  ticketId,
  field,
  value,
  options,
  allowNull = false,
  noneLabel = "None",
}: PropertySelectProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (next: string | null) =>
      updateTicket(ticketId, { [field]: next } as UpdateTicketInput),
  });

  // `pendingValue` is the optimistic override during a mutation (undefined = use
  // the committed prop). Keeping it separate means the committed value (from the
  // ticket query) stays the source of truth and reverts on error without a flicker.
  const [pendingValue, setPendingValue] = useState<string | null | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const committed = pendingValue !== undefined ? pendingValue : value;
  const selectValue = committed ?? NONE;

  async function onValueChange(next: string) {
    const nextValue = next === NONE ? null : next;
    if (nextValue === committed) return;
    setErrorMessage(null);
    setPendingValue(nextValue);
    try {
      const updated = await mutation.mutateAsync(nextValue);
      // Update the detail cache synchronously from the response so there's no gap
      // between clearing the overlay and the refetched prop arriving.
      queryClient.setQueryData(["ticket", ticketId], updated);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      // Refresh the activity timeline so the change shows even before an SSE push
      // lands (or if the Activity tab hasn't been opened yet).
      queryClient.invalidateQueries({ queryKey: ["ticket-activity", ticketId] });
    } catch (err) {
      setErrorMessage(toErrorMessage(err));
    } finally {
      setPendingValue(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Select value={selectValue} onValueChange={onValueChange} disabled={mutation.isPending}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowNull && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
          {allowNull && options.length > 0 && <SelectSeparator />}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errorMessage && <span className="text-xs text-destructive">{errorMessage}</span>}
    </div>
  );
}
