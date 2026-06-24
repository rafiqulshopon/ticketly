import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createReplySchema, type CreateReplyInput, type TicketDetail } from "@ticketly/shared";
import { ApiError, replyToTicket } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Textarea } from "@/components/ui";

// The form's only field is the reply body, so its values are exactly the shared
// reply input — keeping the submit handler cast-free.
type FormValues = CreateReplyInput;

/** Map a failed reply mutation to a user-facing message. */
function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return "Ticket not found.";
    if (err.status === 403) return "You don't have permission to reply.";
    if (err.status === 400) return "Reply couldn't be sent. Please check your input.";
  }
  return err instanceof Error ? err.message : "Couldn't send the reply.";
}

/**
 * Reply composer for a ticket. Submits a plain-text body that the backend stores
 * as an outbound (agent) message in the conversation thread. On success the
 * refreshed ticket is written straight into the `["ticket", id]` cache (so the
 * new message and any status bump render immediately) and the ticket list is
 * invalidated (status/updatedAt changed). On failure the form stays mounted with
 * an inline error — no toasts anywhere in the app.
 */
export function ReplyForm({ ticket }: { ticket: TicketDetail }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: FormValues) => replyToTicket(ticket.id, values),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createReplySchema) as Resolver<FormValues>,
    defaultValues: { bodyText: "" },
  });

  async function onSubmit(values: FormValues) {
    try {
      const updated = await mutation.mutateAsync(values);
      queryClient.setQueryData(["ticket", ticket.id], updated);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      reset({ bodyText: "" });
    } catch (err) {
      setError("root", { message: toErrorMessage(err) });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Reply</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Textarea
            id="reply-body"
            placeholder="Type your reply…"
            rows={5}
            aria-label="Reply body"
            aria-invalid={errors.bodyText ? true : undefined}
            disabled={isSubmitting}
            {...register("bodyText")}
          />
          {errors.bodyText && <p className="text-sm text-destructive">{errors.bodyText.message}</p>}
          {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
