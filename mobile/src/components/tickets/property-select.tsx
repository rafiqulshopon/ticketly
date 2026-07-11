import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateTicketInput } from "@ticketly/shared";
import { ApiError, updateTicket } from "@/lib/api";
import { Select, type SelectOption } from "@/components/ui";

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
  options: SelectOption[];
  /** When true, the Select shows a "none" option that clears the field to null. */
  allowNull?: boolean;
  noneLabel?: string;
  placeholder?: string;
}

/**
 * Inline-edit Select for a scalar ticket field (status / category / priority).
 * Mirrors the web PropertySelect's optimistic pattern: a local `pendingValue`
 * overlays the committed prop for immediate feedback, PATCHes on change, and
 * reverts (with an error message) if the mutation fails. On success the detail
 * cache is updated from the response and the list + activity caches invalidate.
 */
export function PropertySelect({
  ticketId,
  field,
  value,
  options,
  allowNull = false,
  noneLabel = "None",
  placeholder,
}: PropertySelectProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (next: string | null) => updateTicket(ticketId, { [field]: next } as UpdateTicketInput),
  });

  const [pendingValue, setPendingValue] = useState<string | null | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const committed = pendingValue !== undefined ? pendingValue : value;

  async function onValueChange(next: string | null) {
    if (next === committed) return;
    setErrorMessage(null);
    setPendingValue(next);
    try {
      const updated = await mutation.mutateAsync(next);
      queryClient.setQueryData(["ticket", ticketId], updated);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-activity", ticketId] });
    } catch (err) {
      setErrorMessage(toErrorMessage(err));
    } finally {
      setPendingValue(undefined);
    }
  }

  return (
    <View>
      <Select
        value={committed}
        options={options}
        onValueChange={onValueChange}
        allowNull={allowNull}
        noneLabel={noneLabel}
        placeholder={placeholder}
        disabled={mutation.isPending}
      />
      {errorMessage ? <Text className="mt-1 text-xs text-destructive">{errorMessage}</Text> : null}
    </View>
  );
}
