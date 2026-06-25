import { type ReactNode } from "react";
import { ticketCategoryEnum, type TicketDetail } from "@ticketly/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AssigneeSelect } from "@/components/tickets/assignee-select";
import { PropertySelect } from "@/components/tickets/property-select";
import { PRIORITY_BADGES, STATUS_BADGES, prettifyEnum } from "@/components/tickets/tickets-table";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

// Select options derived from the existing badge map / enum — no re-hardcoded
// labels, and they match the table's badges exactly.
const STATUS_OPTIONS = Object.entries(STATUS_BADGES).map(([value, { label }]) => ({ value, label }));
const CATEGORY_OPTIONS = ticketCategoryEnum.options.map((value) => ({ value, label: prettifyEnum(value) }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_BADGES).map(([value, { label }]) => ({ value, label }));

/** Sticky properties sidebar: inline-edit status/priority/assignee/category + read-only metadata. */
export function TicketProperties({ ticket }: { ticket: TicketDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Properties</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Cell label="Status">
          <PropertySelect ticketId={ticket.id} field="status" value={ticket.status} options={STATUS_OPTIONS} />
        </Cell>
        <Cell label="Priority">
          <PropertySelect ticketId={ticket.id} field="priority" value={ticket.priority} options={PRIORITY_OPTIONS} />
        </Cell>
        <Cell label="Assignee">
          <AssigneeSelect ticketId={ticket.id} assigneeId={ticket.assigneeId} />
        </Cell>
        <Cell label="Category">
          <PropertySelect
            ticketId={ticket.id}
            field="category"
            value={ticket.category}
            options={CATEGORY_OPTIONS}
            allowNull
            noneLabel="No category"
          />
        </Cell>

        <dl className="space-y-3 border-t pt-4 text-sm">
          <MetaRow label="Ticket ID" value={`#${ticket.id}`} />
          <MetaRow label="Created" value={dateFmt.format(new Date(ticket.createdAt))} />
          <MetaRow label="Updated" value={dateFmt.format(new Date(ticket.updatedAt))} />
        </dl>
      </CardContent>
    </Card>
  );
}

/** A labeled property cell: muted label stacked over a full-width control. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

/** A read-only label/value metadata row (definition list). */
function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}
