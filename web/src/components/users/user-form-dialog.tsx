import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createUserSchema,
  editUserSchema,
  type CreateUserInput,
  type UserListItem,
} from "@ticketly/shared";
import { ApiError, createUser, updateUser } from "@/lib/api";
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

// The form's field shape is identical for both modes (name/email/password); only
// the password's requiredness differs — create requires it, edit makes it
// optional. Typing the form as `CreateUserInput` (password: string) keeps the
// submit handler cast-free: an empty `""` password is a valid string the edit
// schema accepts and the backend treats as "leave unchanged".
type FormValues = CreateUserInput;

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & (
  | { mode: "create" }
  | { mode: "edit"; user: UserListItem | null }
);

/**
 * Map a failed mutation to a user-facing message. The HTTP status codes are the
 * same for create and edit except 404 (only edit can target a missing user); the
 * verb is swapped per mode so the copy reads naturally.
 */
function toErrorMessage(err: unknown, isEdit: boolean): string {
  const verb = isEdit ? "update" : "create";
  if (err instanceof ApiError) {
    if (err.status === 409) return "A user with that email already exists.";
    if (err.status === 404) return "User not found.";
    if (err.status === 403) return `You don't have permission to ${verb} users.`;
    if (err.status === 400) return `Unable to ${verb} user. Please check your input.`;
  }
  return err instanceof Error ? err.message : `Failed to ${verb} user.`;
}

/**
 * Controlled modal for provisioning (`create`) or editing (`edit`) a user. Both
 * modes share one form (name/email/password); in edit mode name/email are
 * pre-filled from the selected user and the password is optional — leave it
 * blank to keep the current password. The dialog closes only on success; on
 * failure it stays open with an error (e.g. duplicate email → 409).
 */
export function UserFormDialog({ open, onOpenChange, ...rest }: UserFormDialogProps) {
  const isEdit = rest.mode === "edit";
  // `user` is only present on the edit variant; narrow it out of the union here
  // so the rest of the component deals with a plain `UserListItem | null`.
  const user = rest.mode === "edit" ? rest.user : null;

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit && user ? updateUser(user.id, values) : createUser(values),
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    // Pick the stricter schema in create mode (password required) and the
    // lenient one in edit mode (password optional). Widened to the form's
    // single type — the two schemas share the same field shape, only the
    // password's requiredness differs.
    resolver: zodResolver(isEdit ? editUserSchema : createUserSchema) as Resolver<FormValues>,
    defaultValues: { name: "", email: "", password: "" },
  });

  // Repopulate the form on open. Edit mode pre-fills name/email from the
  // selected user (password is never pre-filled); create mode stays blank via
  // the defaults. Either mode resets to blank when the dialog closes.
  useEffect(() => {
    if (!open) {
      reset({ name: "", email: "", password: "" });
    } else if (user) {
      reset({ name: user.name, email: user.email, password: "" });
    }
  }, [open, user, reset]);

  async function onSubmit(values: FormValues) {
    try {
      await mutation.mutateAsync(values);
      // Refetch the list so the new/updated row reflects immediately.
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    } catch (err) {
      setError("root", { message: toErrorMessage(err, isEdit) });
    }
  }

  const submitLabel = isEdit
    ? isSubmitting
      ? "Saving…"
      : "Save changes"
    : isSubmitting
      ? "Creating…"
      : "Create user";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "Create user"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the user's name or email. Leave the password blank to keep the current one."
              : "Provision a new account. New users join with the agent role."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="user-form-name">Name</Label>
            <Input
              id="user-form-name"
              autoComplete="name"
              aria-invalid={errors.name ? true : undefined}
              disabled={isSubmitting}
              {...register("name")}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-form-email">Email</Label>
            <Input
              id="user-form-email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              disabled={isSubmitting}
              {...register("email")}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-form-password">Password</Label>
            <Input
              id="user-form-password"
              type="password"
              autoComplete="new-password"
              placeholder={isEdit ? "Leave blank to keep current password" : undefined}
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
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
