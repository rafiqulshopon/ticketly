import { useOptimistic } from "react";
import type { TicketDetail as TicketDetailModel, TicketMessage } from "@ticketly/shared";
import { TicketHeader } from "@/components/tickets/ticket-header";
import { TicketMessages } from "@/components/tickets/ticket-messages";
import { TicketSummary } from "@/components/tickets/ticket-summary";
import { TicketProperties } from "@/components/tickets/ticket-properties";
import { ReplyForm } from "@/components/tickets/reply-form";

/**
 * The ticket detail body: two columns on large screens — the conversation thread
 * (header + AI summary + messages + reply) on the left and a sticky properties
 * sidebar on the right. Stacks on narrow screens.
 *
 * Holds the React 19 `useOptimistic` message list so a just-sent reply appears
 * instantly: `ReplyForm` calls `addOptimisticMessage` inside its submit
 * transition, the temp message renders here until the network call settles, and
 * on success the refreshed `ticket.messages` (with the real message) replaces it
 * — no flicker. `TicketMessages` smooth-scrolls to the new message.
 */
export function TicketDetail({ ticket }: { ticket: TicketDetailModel }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    ticket.messages,
    (state, newMessage: TicketMessage) => [...state, newMessage],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <TicketHeader ticket={ticket} />
        <TicketSummary ticket={ticket} />
        <TicketMessages messages={optimisticMessages} />
        <ReplyForm ticket={ticket} onOptimisticReply={addOptimisticMessage} />
      </div>
      <aside className="self-start lg:col-span-1 lg:sticky lg:top-8">
        <TicketProperties ticket={ticket} />
      </aside>
    </div>
  );
}
