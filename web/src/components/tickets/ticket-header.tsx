import type { TicketDetail } from "@ticketly/shared";

/** Subject line + requester info at the top of a ticket. */
export function TicketHeader({ ticket }: { ticket: TicketDetail }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">Ticket #{ticket.id}</div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{ticket.subject}</h1>
      <div className="text-sm text-muted-foreground">
        <span className="text-foreground">{ticket.requesterName}</span>
        <span> · {ticket.requesterEmail}</span>
      </div>
    </div>
  );
}
