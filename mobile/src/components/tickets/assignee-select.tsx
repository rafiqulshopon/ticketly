import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssigneeOption } from "@ticketly/shared";
import { ApiError, getAssignees, updateTicket } from "@/lib/api";
import { Select, type SelectOption } from "@/components/ui";

function toAssignErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return "That user can't be assigned.";
    if (err.status === 404) return "Ticket not found.";
    if (err.status === 403) return "You don't have permission to assign tickets.";
  }
  return err instanceof Error ? err.message : "Couldn't update assignee.";
}

function prettifyRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Inline assignee picker. Lists all staff (admins + agents) loaded once and
 * cached under `["assignees"]`; on change it PATCHes the ticket with the same
 * optimistic overlay + revert-on-error pattern as PropertySelect.
 */
export function AssigneeSelect({ ticketId, assigneeId }: { ticketId: number; assigneeId: string | null }) {
  const queryClient = useQueryClient();
  const assigneesQuery = useQuery({
    queryKey: ["assignees"],
    queryFn: ({ signal }) => getAssignees({ signal }),
  });
  const mutation = useMutation({
    mutationFn: (next: string | null) => updateTicket(ticketId, { assigneeId: next }),
  });

  const [pendingId, setPendingId] = useState<string | null | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const committed = pendingId !== undefined ? pendingId : assigneeId;

  const options: SelectOption[] = (assigneesQuery.data ?? []).map((a: AssigneeOption) => ({
    value: a.id,
    label: `${a.name} · ${prettifyRole(a.role)}`,
  }));

  async function onValueChange(next: string | null) {
    if (next === committed) return;
    setErrorMessage(null);
    setPendingId(next);
    try {
      const updated = await mutation.mutateAsync(next);
      queryClient.setQueryData(["ticket", ticketId], updated);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-activity", ticketId] });
    } catch (err) {
      setErrorMessage(toAssignErrorMessage(err));
    } finally {
      setPendingId(undefined);
    }
  }

  return (
    <View>
      <Select
        value={committed}
        options={options}
        onValueChange={onValueChange}
        allowNull
        noneLabel="Unassigned"
        placeholder="Unassigned"
        disabled={assigneesQuery.isPending || mutation.isPending}
      />
      {errorMessage ? <Text className="mt-1 text-xs text-destructive">{errorMessage}</Text> : null}
    </View>
  );
}
