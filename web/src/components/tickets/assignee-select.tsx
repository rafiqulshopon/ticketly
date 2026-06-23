import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssigneeOption } from "@ticketly/shared";
import { ApiError, getAssignees, updateTicket } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

// Radix Select forbids empty-string item values, so represent "unassigned" with a
// sentinel and map it to null when submitting.
const UNASSIGNED = "__none__";

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
 * Inline assignee picker for a ticket. Lists all staff (admins + agents), loaded
 * once and cached under `["assignees"]`; on change it PATCHes the ticket. A
 * `pendingId` overlays the committed value for immediate feedback and reverts
 * automatically (with an error message) if the mutation fails. On success the
 * detail cache is updated from the response and the ticket list is invalidated.
 */
export function AssigneeSelect({
  ticketId,
  assigneeId,
}: {
  ticketId: number;
  assigneeId: string | null;
}) {
  const queryClient = useQueryClient();
  const assigneesQuery = useQuery({
    queryKey: ["assignees"],
    queryFn: ({ signal }) => getAssignees({ signal }),
  });
  const mutation = useMutation({
    mutationFn: (next: string | null) => updateTicket(ticketId, { assigneeId: next }),
  });

  // `pendingId` is the optimistic override during a mutation (undefined = use the
  // committed prop). Keeping it separate means the committed value (from the
  // ticket query) stays the source of truth and reverts on error without a flicker.
  const [pendingId, setPendingId] = useState<string | null | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const committed = pendingId !== undefined ? pendingId : assigneeId;
  const value = committed ?? UNASSIGNED;

  async function onValueChange(next: string) {
    const nextId = next === UNASSIGNED ? null : next;
    if (nextId === committed) return;
    setErrorMessage(null);
    setPendingId(nextId);
    try {
      const updated = await mutation.mutateAsync(nextId);
      // Update the detail cache synchronously from the response so there's no gap
      // between clearing the overlay and the refetched prop arriving.
      queryClient.setQueryData(["ticket", ticketId], updated);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (err) {
      setErrorMessage(toAssignErrorMessage(err));
    } finally {
      setPendingId(undefined);
    }
  }

  const disabled = assigneesQuery.isPending || mutation.isPending;

  return (
    <div className="flex flex-col items-end gap-1">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger size="sm">
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {assigneesQuery.data && assigneesQuery.data.length > 0 && (
            <>
              <SelectSeparator />
              {assigneesQuery.data.map((user: AssigneeOption) => (
                <SelectItem key={user.id} value={user.id}>
                  <span className="text-foreground">{user.name}</span>
                  <span className="text-muted-foreground"> · {prettifyRole(user.role)}</span>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
      {errorMessage && <span className="text-xs text-destructive">{errorMessage}</span>}
    </div>
  );
}
