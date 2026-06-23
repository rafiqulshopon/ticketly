import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UserListItem } from "@ticketly/shared";
import { ApiError, deleteUser } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@/components/ui";

function toDeleteErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return "Admins cannot be deleted.";
    if (err.status === 404) return "User not found.";
    if (err.status === 403) return "You don't have permission to delete users.";
  }
  return err instanceof Error ? err.message : "Failed to delete user.";
}

/**
 * Confirmation modal for soft-deleting a user. The row is retained (history and
 * foreign-key references stay valid) but the user is locked out and hidden from
 * the directory. Mirrors the mutation/invalidate/close-on-success pattern in
 * `user-form-dialog.tsx`; plain footer buttons (not `AlertDialogAction`) keep
 * the dialog open when the delete fails so the error is visible.
 */
export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mutation = useMutation({ mutationFn: () => deleteUser(user!.id) });

  // Clear any stale error when the dialog closes, so the next open starts fresh.
  function handleOpenChange(next: boolean) {
    if (!next) setErrorMessage(null);
    onOpenChange(next);
  }

  async function onConfirm() {
    if (!user) return;
    setErrorMessage(null);
    try {
      await mutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(toDeleteErrorMessage(err));
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{user?.name}</strong>? They&apos;ll be signed
            out and won&apos;t be able to sign in again. Their record and history are retained.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Deleting…" : "Delete user"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

