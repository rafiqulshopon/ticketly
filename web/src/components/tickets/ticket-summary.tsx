import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import type { TicketDetail } from "@ticketly/shared";
import { ApiError, summarizeTicket } from "@/lib/api";
import { renderInlineMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

/** Map a failed summarize mutation to a user-facing message. */
function toSummaryErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 502 || err.status === 504)
      return "The summarize service is unavailable. Try again.";
    if (err.status === 404) return "Ticket not found.";
  }
  return err instanceof Error ? err.message : "Couldn't summarize the ticket.";
}

/**
 * AI-generated digest of the ticket and its conversation, shown beneath the
 * conversation thread. Each click re-runs the model — nothing is cached or
 * persisted, so the summary is always regenerated from the current thread
 * (matching the backend, which never stores it). The result lives in local
 * state, not the TanStack Query cache: it's a transient aid, not part of the
 * ticket record, so it shouldn't survive a refetch or leak into the list. Errors
 * render inline.
 */
export function TicketSummary({ ticket }: { ticket: TicketDetail }) {
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
    <Card className="border-ai/20 bg-ai/4">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-md bg-ai/10 text-ai",
              mutation.isPending && "animate-ai-pulse",
            )}
          >
            <Sparkles className="size-4" />
          </span>
          AI summary
        </CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSummarize}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {summary ? "Regenerate" : "Summarize"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {summary && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {renderInlineMarkdown(summary, "font-semibold text-foreground")}
          </p>
        )}
        {!summary && !error && !mutation.isPending && (
          <p className="text-sm text-muted-foreground">
            Generate a concise summary of this ticket and its conversation.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
