import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { editUserSchema, type EditUserInput, type UserListItem } from "@ticketly/shared";
import { ApiError, updateUser } from "@/lib/api";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/ui";

function toEditErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "A user with that email already exists.";
    if (err.status === 404) return "User not found.";
    if (err.status === 403) return "You don't have permission to edit users.";
    if (err.status === 400) return "Unable to update user. Please check your input.";
  }
  return err instanceof Error ? err.message : "Failed to update user.";
}

/**
 * Controlled modal for editing an existing user. Pre-fills name/email from the
 * selected user; the password field is optional — leave it blank to keep the
 * current password, or enter a new one to reset it. Mirrors the raw
 * react-hook-form pattern in `create-user-dialog.tsx`. Closes only on success.
 */
export function EditUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: EditUserInput }) => updateUser(id, values),
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditUserInput>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  // Repopulate from the selected user whenever the dialog opens (or the user
  // changes). Password is never pre-filled.
  useEffect(() => {
    if (open && user) {
      reset({ name: user.name, email: user.email, password: "" });
    }
  }, [open, user, reset]);

  async function onSubmit(values: EditUserInput) {
    if (!user) return;
    try {
      await mutation.mutateAsync({ id: user.id, values });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    } catch (err) {
      setError("root", { message: toEditErrorMessage(err) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update the user's name or email. Leave the password blank to keep the current one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="edit-user-name">Name</Label>
            <Input
              id="edit-user-name"
              autoComplete="name"
              aria-invalid={errors.name ? true : undefined}
              disabled={isSubmitting}
              {...register("name")}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-user-email">Email</Label>
            <Input
              id="edit-user-email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              disabled={isSubmitting}
              {...register("email")}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-user-password">Password</Label>
            <Input
              id="edit-user-password"
              type="password"
              autoComplete="new-password"
              placeholder="Leave blank to keep current password"
              aria-invalid={errors.password ? true : undefined}
              disabled={isSubmitting}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
