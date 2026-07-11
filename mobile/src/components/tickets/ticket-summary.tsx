import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react-native";
import type { TicketDetail } from "@ticketly/shared";
import { ApiError, summarizeTicket } from "@/lib/api";
import { useIconColor } from "@/lib/colors";
import { Button, Card, CardContent } from "@/components/ui";

/** Map a failed summarize mutation to a user-facing message. */
function toSummaryErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 502 || err.status === 504) return "The summarize service is unavailable. Try again.";
    if (err.status === 404) return "Ticket not found.";
  }
  return err instanceof Error ? err.message : "Couldn't summarize the ticket.";
}

/**
 * AI-generated digest of the ticket and its conversation. Each tap re-runs the
 * model — nothing is cached or persisted, so the summary is always regenerated
 * from the current thread. The result lives in local state, not the query cache:
 * it's a transient aid, not part of the ticket record, so it shouldn't survive a
 * refetch or leak into the list. Errors render inline.
 */
export function TicketSummary({ ticket }: { ticket: TicketDetail }) {
  const ai = useIconColor("ai");
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => summarizeTicket(ticket.id),
  });

  async function onSummarize() {
    setError(null);
    try {
      const { summary: generated } = await mutation.mutateAsync();
      setSummary(generated);
    } catch (err) {
      setError(toSummaryErrorMessage(err));
    }
  }

  return (
    <Card className="border-ai bg-ai-soft">
      <CardContent className="flex flex-col gap-3 p-4">
        <View className="flex flex-row items-center justify-between">
          <View className="flex flex-row items-center gap-2">
            <View className="flex size-7 items-center justify-center rounded-md bg-card">
              <Sparkles size={16} color={ai} />
            </View>
            <Text className="text-base font-semibold text-foreground">AI summary</Text>
          </View>
          <Button variant="outline" size="sm" onPress={() => void onSummarize()} loading={mutation.isPending}>
            {summary ? "Regenerate" : "Summarize"}
          </Button>
        </View>
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        {summary ? <Text className="text-sm text-muted-foreground">{summary}</Text> : null}
        {!summary && !error && !mutation.isPending ? (
          <Text className="text-sm text-muted-foreground">Generate a concise summary of this ticket and its conversation.</Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
