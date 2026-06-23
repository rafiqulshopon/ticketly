import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUserSchema, type CreateUserInput } from "@ticketly/shared";
import { ApiError, createUser } from "@/lib/api";
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

function toCreateErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "A user with that email already exists.";
    if (err.status === 403) return "You don't have permission to create users.";
    if (err.status === 400) return "Unable to create user. Please check your input.";
  }
  return err instanceof Error ? err.message : "Failed to create user.";
}

/**
 * Controlled modal for provisioning a new user (name/email/password). New users
 * default to the `agent` role server-side. The dialog closes only on success; on
 * failure it stays open with an error (e.g. duplicate email → 409). Mirrors the
 * raw react-hook-form pattern used in `routes/login.tsx`.
 */
export function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: createUser });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  // Clear the form whenever the dialog closes (Cancel / overlay / Esc / success).
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  async function onSubmit(values: CreateUserInput) {
    try {
      await mutation.mutateAsync(values);
      // Refetch the list so the new user appears at the top.
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    } catch (err) {
      setError("root", { message: toCreateErrorMessage(err) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Provision a new account. New users join with the agent role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="create-user-name">Name</Label>
            <Input
              id="create-user-name"
              autoComplete="name"
              aria-invalid={errors.name ? true : undefined}
              disabled={isSubmitting}
              {...register("name")}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-user-email">Email</Label>
            <Input
              id="create-user-email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              disabled={isSubmitting}
              {...register("email")}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-user-password">Password</Label>
            <Input
              id="create-user-password"
              type="password"
              autoComplete="new-password"
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
              {isSubmitting ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
