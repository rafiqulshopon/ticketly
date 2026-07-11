import { useEffect } from "react";
import { Text, View } from "react-native";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import {
  createUserSchema,
  editUserSchema,
  type CreateUserInput,
  type UserListItem,
} from "@ticketly/shared";
import { ApiError, createUser, updateUser } from "@/lib/api";
import { Button, Field, Modal, TextField } from "@/components/ui";

// The form's field shape is identical for both modes (name/email/password); only
// the password's requiredness differs. Typing the form as CreateUserInput keeps
// the submit handler cast-free — an empty "" password is a valid string the edit
// schema accepts and the backend treats as "leave unchanged".
type FormValues = CreateUserInput;

type UserFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & ({ mode: "create" } | { mode: "edit"; user: UserListItem | null });

/** Map a failed mutation to a user-facing message. The HTTP status codes are the
 *  same for create and edit except 404 (only edit can target a missing user). */
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

/** Controlled modal for provisioning (`create`) or editing (`edit`) a user. Both
 *  modes share one form; edit mode pre-fills name/email and makes the password
 *  optional. Closes only on success — on failure it stays open with the error
 *  (e.g. duplicate email → 409). Mobile port of the web's UserFormDialog. */
export function UserForm({ open, onOpenChange, ...rest }: UserFormProps) {
  const isEdit = rest.mode === "edit";
  const user = rest.mode === "edit" ? rest.user : null;
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(isEdit ? editUserSchema : createUserSchema) as Resolver<FormValues>,
    defaultValues: { name: "", email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => (isEdit && user ? updateUser(user.id, values) : createUser(values)),
  });

  // Repopulate on open: edit pre-fills name/email (password never), create stays
  // blank; either mode resets to blank on close.
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
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
      Toast.show({ type: "success", text1: isEdit ? "User updated" : "User created" });
    } catch (err) {
      setError("root", { message: toErrorMessage(err, isEdit) });
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit user" : "Create user"}
      description={
        isEdit
          ? "Update the user's name or email. Leave the password blank to keep the current one."
          : "Provision a new account. New users join with the agent role."
      }
      avoidKeyboard
    >
      <View className="gap-4">
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
            <Field label="Name" error={error?.message}>
              <TextField
                testID="user-form-name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoComplete="name"
                autoCapitalize="words"
                editable={!isSubmitting}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
            <Field label="Email" error={error?.message}>
              <TextField
                testID="user-form-email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                editable={!isSubmitting}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
            <Field label="Password" error={error?.message}>
              <TextField
                testID="user-form-password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoComplete="new-password"
                placeholder={isEdit ? "Leave blank to keep current password" : undefined}
                editable={!isSubmitting}
              />
            </Field>
          )}
        />

        {errors.root ? <Text className="text-sm text-destructive">{errors.root.message}</Text> : null}

        <View className="mt-2 flex flex-row gap-2">
          <Button variant="outline" className="flex-1" onPress={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button className="flex-1" onPress={() => void handleSubmit(onSubmit)()} loading={isSubmitting}>
            {isEdit ? "Save changes" : "Create user"}
          </Button>
        </View>
      </View>
    </Modal>
  );
}
