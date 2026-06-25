import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TicketDayCount } from "@ticketly/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

const tickStyle = { fontSize: 11, fill: "var(--muted-foreground)" };

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function TooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TicketDayCount }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-medium text-popover-foreground">{formatDay(point.date)}</p>
      <p className="text-muted-foreground">
        {point.count} {point.count === 1 ? "ticket" : "tickets"}
      </p>
    </div>
  );
}

/** Bar chart of tickets created per day over the last 30 days (UTC days). */
export function TicketsPerDayChart({ data }: { data: TicketDayCount[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Tickets per day</CardTitle>
        <p className="text-xs text-muted-foreground">Last 30 days</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={tickStyle}
              interval="preserveStartEnd"
              minTickGap={16}
              stroke="var(--border)"
            />
            <YAxis allowDecimals={false} tick={tickStyle} width={32} stroke="var(--border)" />
            <Tooltip
              content={<TooltipContent />}
              cursor={{ fill: "var(--muted)" }}
            />
            <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
