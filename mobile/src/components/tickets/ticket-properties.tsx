import { type ReactNode } from "react";
import { Text, View } from "react-native";
import { ticketCategoryEnum, type TicketDetail } from "@ticketly/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AssigneeSelect } from "./assignee-select";
import { PropertySelect } from "./property-select";
import { PRIORITY_BADGES, STATUS_BADGES, prettifyEnum } from "./ticket-badges";

// Select options derived from the badge map / enum — no re-hardcoded labels, and
// they match the list's badges exactly. NEW and PROCESSING are AI-pipeline
// states and aren't valid manual choices, so they're filtered out.
const PIPELINE_STATUSES = new Set(["NEW", "PROCESSING"]);
const STATUS_OPTIONS = Object.entries(STATUS_BADGES)
  .filter(([value]) => !PIPELINE_STATUSES.has(value))
  .map(([value, { label }]) => ({ value, label }));
const CATEGORY_OPTIONS = ticketCategoryEnum.options.map((value) => ({ value, label: prettifyEnum(value) }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_BADGES).map(([value, { label }]) => ({ value, label }));

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });

/** Inline-edit status/priority/assignee/category + read-only metadata. */
export function TicketProperties({ ticket }: { ticket: TicketDetail }) {
  // If the ticket is currently in a pipeline state, keep that status visible as
  // the selected value so the field isn't blank — it just can't be re-chosen.
  const statusOptions = PIPELINE_STATUSES.has(ticket.status)
    ? [{ value: ticket.status, label: STATUS_BADGES[ticket.status].label }, ...STATUS_OPTIONS]
    : STATUS_OPTIONS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Properties</CardTitle>
      </CardHeader>
      <CardContent>
        <View className="gap-4">
          <Cell label="Status">
            <PropertySelect ticketId={ticket.id} field="status" value={ticket.status} options={statusOptions} />
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

          <View className="gap-2 border-t border-border pt-4">
            <MetaRow label="Ticket ID" value={`#${ticket.id}`} />
            <MetaRow label="Created" value={dateFmt.format(new Date(ticket.createdAt))} />
            <MetaRow label="Updated" value={dateFmt.format(new Date(ticket.updatedAt))} />
          </View>
        </View>
      </CardContent>
    </Card>
  );
}

/** A labeled property cell: muted label stacked over a full-width control. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
      {children}
    </View>
  );
}

/** A read-only label/value metadata row. */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex flex-row items-center justify-between gap-3">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-right text-sm text-foreground">{value}</Text>
    </View>
  );
}
