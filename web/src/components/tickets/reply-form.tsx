import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wand2 } from "lucide-react";
import { createReplySchema, type CreateReplyInput, type PolishReplyInput, type TicketDetail } from "@ticketly/shared";
import { ApiError, polishReply, replyToTicket } from "@/lib/api";
import { Button, Card, CardContent, CardHeader, CardTitle, Textarea, toast } from "@/components/ui";

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

/** Map a failed polish mutation to a user-facing message. */
function toPolishErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 502 || err.status === 504) return "The polish service is unavailable. Try again.";
    if (err.status === 404) return "Ticket not found.";
    if (err.status === 400) return "Reply couldn't be polished. Please check your input.";
  }
  return err instanceof Error ? err.message : "Couldn't polish the reply.";
}

/**
 * Reply composer for a ticket. Submits a plain-text body that the backend stores
 * as an outbound (agent) message in the conversation thread. On success the
 * refreshed ticket is written straight into the `["ticket", id]` cache (so the
 * new message and any status bump render immediately), the ticket list is
 * invalidated (status/updatedAt changed), and a toast confirms the send. On
 * failure the form stays mounted with an inline error.
 */
export function ReplyForm({ ticket }: { ticket: TicketDetail }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (values: FormValues) => replyToTicket(ticket.id, values),
  });
  const polish = useMutation({
    mutationFn: (values: PolishReplyInput) => polishReply(ticket.id, values),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createReplySchema) as Resolver<FormValues>,
    defaultValues: { bodyText: "" },
  });

  // Live draft value — drives the Polish button's disabled state so it can't fire
  // on an empty textarea. `watch` re-renders per keystroke, fine for one field.
  const bodyText = watch("bodyText");

  async function onSubmit(values: FormValues) {
    try {
      const updated = await mutation.mutateAsync(values);
      queryClient.setQueryData(["ticket", ticket.id], updated);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      reset({ bodyText: "" });
      toast.success("Reply sent.");
    } catch (err) {
      setError("root", { message: toErrorMessage(err) });
    }
  }

  /**
   * Polish the current draft with the AI service and write the improved text back
   * into the field for review before sending. Non-streaming: the textarea updates
   * in one shot. Re-validates so the Send button stays in sync with the new text.
   * The button is disabled while sending/polishing or when the draft is empty.
   */
  async function onPolish() {
    const draft = getValues("bodyText").trim();
    if (!draft) return;
    try {
      const { bodyText: polished } = await polish.mutateAsync({ bodyText: draft });
      setValue("bodyText", polished, { shouldValidate: true });
      toast.success("Reply polished.");
    } catch (err) {
      setError("root", { message: toPolishErrorMessage(err) });
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
            disabled={isSubmitting}
            {...register("bodyText")}
          />
          {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPolish}
              disabled={isSubmitting || polish.isPending || !bodyText.trim()}
            >
              <Wand2 className="size-4" />
              {polish.isPending ? "Polishing…" : "Polish"}
            </Button>
            <Button type="submit" disabled={isSubmitting || polish.isPending || !bodyText.trim()}>
              {isSubmitting ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
