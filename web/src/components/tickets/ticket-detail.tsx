import type { TicketDetail as TicketDetailModel } from "@ticketly/shared";
import { TicketHeader } from "@/components/tickets/ticket-header";
import { TicketMessages } from "@/components/tickets/ticket-messages";
import { TicketProperties } from "@/components/tickets/ticket-properties";
import { ReplyForm } from "@/components/tickets/reply-form";

/**
 * The ticket detail body: two columns on large screens — the conversation thread
 * (header + messages + reply) on the left and a sticky properties sidebar on the
 * right. Stacks on narrow screens.
 */
export function TicketDetail({ ticket }: { ticket: TicketDetailModel }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <TicketHeader ticket={ticket} />
        <TicketMessages messages={ticket.messages} />
        <ReplyForm ticket={ticket} />
      </div>
      <aside className="self-start lg:col-span-1 lg:sticky lg:top-8">
        <TicketProperties ticket={ticket} />
      </aside>
    </div>
  );
}
