import { useTransition } from "react";
import { Pressable, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wand2 } from "lucide-react-native";
import Toast from "react-native-toast-message";
import {
  createReplySchema,
  type CreateReplyInput,
  type PolishReplyInput,
  type TicketDetail,
  type TicketMessage,
} from "@ticketly/shared";
import { ApiError, polishReply, replyToTicket } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { Button, Card, CardContent, CardTitle, CollapseChevron, TextField, useCollapsible } from "@/components/ui";

// The form's only field is the reply body, so its values are exactly the shared
// reply input — keeping the submit handler cast-free.
type FormValues = CreateReplyInput;

/** RN has no crypto.randomUUID in Hermes — a temp id only needs to be unique so
 *  the optimistic message never collides with the real one that replaces it. */
function optimisticId(): string {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
 * as an outbound (agent) message in the thread.
 *
 * The reply is shown optimistically via React 19's `useOptimistic` (lifted to
 * the detail screen): `onOptimisticReply` is called inside the submit
 * `startTransition`, so the temp message renders instantly while the request is
 * in flight. On success the refreshed ticket (with the REAL message) is written
 * into the `["ticket", id]` cache and the list + activity caches are
 * invalidated, so the temp message is replaced by the real one with no flicker.
 * On failure the optimistic message is discarded automatically. The polish
 * button stays independent.
 */
export function ReplyForm({
  ticket,
  onOptimisticReply,
}: {
  ticket: TicketDetail;
  onOptimisticReply: (message: TicketMessage) => void;
}) {
  // react-hook-form's useForm/watch return non-memoizable functions, so React
  // Compiler skips this component. The directive makes that opt-out explicit.
  "use no memo";
  const queryClient = useQueryClient();
  // The signed-in agent's identity is stamped onto the optimistic reply so it
  // groups/labels identically to the real message the server returns.
  const { data: session } = useSession();
  const [isSending, startTransition] = useTransition();
  const mutation = useMutation({
    mutationFn: (values: FormValues) => replyToTicket(ticket.id, values),
  });
  const polish = useMutation({
    mutationFn: (values: PolishReplyInput) => polishReply(ticket.id, values),
  });
  // Collapsed by default so the conversation thread keeps the room; tap the
  // header to compose. useForm state lives here (the component stays mounted),
  // so draft text survives collapse/expand — only the input unmounts.
  const { open, toggle } = useCollapsible(false);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createReplySchema),
    defaultValues: { bodyText: "" },
  });

  // Live draft value drives the Polish/Send disabled state so they can't fire on
  // an empty textarea. Re-renders per keystroke, fine for one field.
  // eslint-disable-next-line react-hooks/incompatible-library
  const bodyText = watch("bodyText");

  // While the AI auto-resolver owns the ticket (NEW/PROCESSING), a human reply or
  // polish is out of band — disable both until the ticket lands in a human state.
  const isAiPipeline = ticket.status === "NEW" || ticket.status === "PROCESSING";
  const empty = !bodyText.trim();
  const busy = isAiPipeline || isSending || polish.isPending;

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      onOptimisticReply({
        id: optimisticId(),
        direction: "outbound",
        senderType: "agent",
        fromEmail: "",
        toEmail: ticket.requesterEmail,
        senderName: session?.user?.name ?? null,
        senderRole:
          session?.user?.role === "admin" || session?.user?.role === "agent" ? session.user.role : null,
        isAi: false,
        bodyText: values.bodyText,
        createdAt: new Date().toISOString(),
      });
      try {
        const updated = await mutation.mutateAsync(values);
        queryClient.setQueryData(["ticket", ticket.id], updated);
        queryClient.invalidateQueries({ queryKey: ["tickets"] });
        queryClient.invalidateQueries({ queryKey: ["ticket-activity", ticket.id] });
        reset({ bodyText: "" });
        Toast.show({ type: "success", text1: "Reply sent." });
      } catch (err) {
        setError("root", { message: toErrorMessage(err) });
      }
    });
  }

  async function onPolish() {
    const draft = getValues("bodyText").trim();
    if (!draft) return;
    try {
      const { bodyText: polished } = await polish.mutateAsync({ bodyText: draft });
      setValue("bodyText", polished, { shouldValidate: true });
      Toast.show({ type: "success", text1: "Reply polished." });
    } catch (err) {
      setError("root", { message: toPolishErrorMessage(err) });
    }
  }

  return (
    <Card>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        className="flex flex-row items-center justify-between p-4"
      >
        <CardTitle>Reply</CardTitle>
        <CollapseChevron open={open} />
      </Pressable>
      {open ? (
        <CardContent>
          <Controller
            control={control}
            name="bodyText"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                numberOfLines={4}
                placeholder="Type your reply…"
                editable={!isSending}
                className="min-h-[96px] py-2 text-left"
              />
            )}
          />
          {errors.root ? <Text className="mt-2 text-destructive">{errors.root.message}</Text> : null}
          {isAiPipeline && (
            <Text className="mt-2 text-sm text-muted-foreground">
              AI is handling this ticket — manual reply and polish are disabled until it moves out of New/Processing.
            </Text>
          )}
          <View className="mt-3 flex flex-row flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onPress={onPolish} loading={polish.isPending} disabled={busy || empty}>
              <Wand2 size={16} />
              Polish
            </Button>
            <Button onPress={() => void handleSubmit(onSubmit)()} loading={isSending} disabled={busy || empty}>
              {isSending ? "Sending…" : "Send reply"}
            </Button>
          </View>
        </CardContent>
      ) : null}
    </Card>
  );
}
