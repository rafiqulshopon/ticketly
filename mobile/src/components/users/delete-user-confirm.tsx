import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import type { UserListItem } from "@ticketly/shared";
import { ApiError, deleteUser } from "@/lib/api";
import { Button, Modal } from "@/components/ui";

function toDeleteErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return "Admins cannot be deleted.";
    if (err.status === 404) return "User not found.";
    if (err.status === 403) return "You don't have permission to delete users.";
  }
  return err instanceof Error ? err.message : "Failed to delete user.";
}

/** Confirmation modal for soft-deleting a user. The row is retained (history and
 *  FK references stay valid) but the user is locked out and hidden from the
 *  directory. Mirrors the invalidate/close-on-success pattern in user-form;
 *  plain footer buttons keep the dialog open when the delete fails so the error
 *  is visible. Mobile port of the web's DeleteUserDialog. */
export function DeleteUserConfirm({
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

  // Clear any stale error on close so the next open starts fresh.
  function handleOpenChange(next: boolean) {
    if (!next) setErrorMessage(null);
    onOpenChange(next);
  }

  async function onConfirm() {
    if (!user) return;
    setErrorMessage(null);
    try {
      await mutation.mutateAsync();
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
      Toast.show({ type: "success", text1: "User deleted" });
    } catch (err) {
      setErrorMessage(toDeleteErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="Delete user"
      description={
        user
          ? `Are you sure you want to delete ${user.name}? They'll be signed out and won't be able to sign in again. Their record and history are retained.`
          : undefined
      }
    >
      {errorMessage ? <Text className="mb-3 text-sm text-destructive">{errorMessage}</Text> : null}
      <View className="flex flex-row justify-end gap-2">
        <Button variant="outline" onPress={() => handleOpenChange(false)} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="destructive" onPress={() => void onConfirm()} loading={mutation.isPending}>
          Delete user
        </Button>
      </View>
    </Modal>
  );
}
