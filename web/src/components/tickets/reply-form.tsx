import { useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wand2 } from "lucide-react";
import {
  createReplySchema,
  type CreateReplyInput,
  type PolishReplyInput,
  type TicketDetail,
  type TicketMessage,
} from "@ticketly/shared";
import { ApiError, polishReply, replyToTicket } from "@/lib/api";
import { useSession } from "@/lib/auth";
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
 * as an outbound (agent) message in the conversation thread.
 *
 * The reply is shown optimistically via React 19's `useOptimistic` (lifted to
 * {@link TicketDetail}): `onOptimisticReply` is called inside the submit
 * `startTransition`, so the temp message renders instantly while the network
 * request is in flight. On success the refreshed ticket (with the REAL message)
 * is written into the `["ticket", id]` cache and the ticket list is invalidated;
 * React batches that with the transition ending, so the temp message is replaced
 * by the real one with no flicker. On failure the optimistic message is discarded
 * automatically and an inline error shows. The polish button stays independent.
 */
export function ReplyForm({
  ticket,
  onOptimisticReply,
}: {
  ticket: TicketDetail;
  onOptimisticReply: (message: TicketMessage) => void;
}) {
  // react-hook-form's useForm/watch return non-memoizable functions, so React
  // Compiler skips this component. The directive makes that opt-out explicit
  // (same behaviour, no warning) — ReplyForm owns its own form state and isn't
  // handed to a memoized child, so skipping memoization is safe.
  "use no memo";
  const queryClient = useQueryClient();
  // The signed-in agent's name is stamped onto the optimistic reply so it carries
  // the same identity as the real message the server returns. Without it the temp
  // message's group key differs (null name vs the real one) and it briefly renders
  // as a group-start with avatar/name, then collapses once the real message lands —
  // a visible "vanish" glitch.
  const { data: session } = useSession();
  // The transition spans the whole send (optimistic add → await → cache update),
  // so `isSending` is true for exactly that window and gates the buttons/textarea.
  const [isSending, startTransition] = useTransition();
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
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createReplySchema) as Resolver<FormValues>,
    defaultValues: { bodyText: "" },
  });

  // Live draft value — drives the Polish/Send disabled state so they can't fire
  // on an empty textarea. `watch` re-renders per keystroke, fine for one field.
  // Not a safety guard: createReplySchema already rejects an empty body, and
  // onPolish early-returns — this is only the greyed-out-button nicety.
  //
  // `watch` is on React Compiler's incompatible-API list (eslint flags it), but
  // this component is `"use no memo"`, so the compiler already skips it — the
  // exact behaviour the warning anticipates — and it never passes form values to
  // a memoized child. Safe to silence here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const bodyText = watch("bodyText");

  // While the AI auto-resolver owns the ticket (NEW/PROCESSING), a human reply or
  // polish is out of band — disable both until the ticket lands in a human state.
  const isAiPipeline = ticket.status === "NEW" || ticket.status === "PROCESSING";

  async function onSubmit(values: FormValues) {
    startTransition(async () => {
      // Show the reply instantly. `direction: "outbound"` + `senderType: "agent"`
      // render it like a normal staff reply on the right side of the thread. The
      // temp id is unique so it never collides with the real message that replaces it.
      onOptimisticReply({
        id: `optimistic-${crypto.randomUUID()}`,
        direction: "outbound",
        senderType: "agent",
        fromEmail: "",
        toEmail: ticket.requesterEmail,
        // Real name + role so the optimistic reply groups/labels identically to
        // the server response (no name/avatar/badge flicker when it lands). The
        // session's `role` is typed as a loose string, so narrow it to the union.
        senderName: session?.user?.name ?? null,
        senderRole:
          session?.user?.role === "admin" || session?.user?.role === "agent"
            ? session.user.role
            : null,
        isAi: false,
        bodyText: values.bodyText,
        createdAt: new Date().toISOString(),
      });
      try {
        const updated = await mutation.mutateAsync(values);
        queryClient.setQueryData(["ticket", ticket.id], updated);
        queryClient.invalidateQueries({ queryKey: ["tickets"] });
        // Refresh the activity timeline (the reply + any status flip). The SSE
        // push covers the open-tab case; this covers it before one lands.
        queryClient.invalidateQueries({ queryKey: ["ticket-activity", ticket.id] });
        reset({ bodyText: "" });
        toast.success("Reply sent.");
      } catch (err) {
        setError("root", { message: toErrorMessage(err) });
      }
    });
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
            disabled={isSending}
            {...register("bodyText")}
          />
          {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
          {isAiPipeline && (
            <p className="text-sm text-muted-foreground">
              AI is handling this ticket — manual reply and polish are disabled until it moves out of New/Processing.
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPolish}
              disabled={isAiPipeline || isSending || polish.isPending || !bodyText.trim()}
            >
              <Wand2 className="size-4" />
              {polish.isPending ? "Polishing…" : "Polish"}
            </Button>
            <Button
              type="submit"
              disabled={isAiPipeline || isSending || polish.isPending || !bodyText.trim()}
            >
              {isSending ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
