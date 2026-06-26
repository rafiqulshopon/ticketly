import type { TicketDetail } from "@ticketly/shared";
import { Avatar, AvatarFallback, Badge } from "@/components/ui";
import { PRIORITY_BADGES, STATUS_BADGES } from "@/components/tickets/ticket-badges";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Subject line + requester info + status/priority at the top of a ticket. */
export function TicketHeader({ ticket }: { ticket: TicketDetail }) {
  const status = STATUS_BADGES[ticket.status];
  const priority = PRIORITY_BADGES[ticket.priority];
  return (
    <div className="space-y-3">
      <div className="font-mono text-xs font-medium text-muted-foreground">Ticket #{ticket.id}</div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{ticket.subject}</h1>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px]">{initials(ticket.requesterName)}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{ticket.requesterName}</span>
          <span className="text-muted-foreground">{ticket.requesterEmail}</span>
        </div>
        <span className="hidden text-muted-foreground sm:inline">·</span>
        <Badge variant={status.variant}>{status.label}</Badge>
        <Badge variant={priority.variant}>{priority.label} priority</Badge>
      </div>
    </div>
  );
}
