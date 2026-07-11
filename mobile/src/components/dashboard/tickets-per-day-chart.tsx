import { useMemo } from "react";
import { Text, View } from "react-native";
import { Bar, CartesianChart } from "victory-native";
import { matchFont } from "@shopify/react-native-skia";
import type { TicketDayCount } from "@ticketly/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useIconColor } from "@/lib/colors";

/** "Jul 3" in UTC — verbatim port of the web's formatDay. The API returns
 *  calendar dates (YYYY-MM-DD), so parse them as UTC to avoid off-by-one shifts. */
function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Bar chart of tickets created per day over the last 30 days (UTC days). The
 *  mobile analog of the web's recharts BarChart, built on victory-native (Skia).
 *  Token colors come from useIconColor since Skia needs concrete hex values; the
 *  system font manager supplies axis labels (no bundled TTF). Static for v1 — a
 *  press tooltip (useChartPressState) can slot into the render-prop later. */
export function TicketsPerDayChart({ data }: { data: TicketDayCount[] }) {
  const bar = useIconColor("primary");
  const muted = useIconColor("muted");
  const font = matchFont({ fontSize: 11 });

  // Y domain pinned to [0, max] so counts render as integers from zero (the
  // web's allowDecimals={false}). Floor of 1 guards an all-zero/empty month.
  const maxCount = useMemo(() => Math.max(1, ...data.map((d) => d.count)), [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets per day</CardTitle>
        <Text className="mt-1 text-xs text-muted-foreground">Last 30 days</Text>
      </CardHeader>
      <CardContent>
        <View style={{ height: 220 }}>
          <CartesianChart
            data={data}
            xKey="date"
            yKeys={["count"]}
            domain={{ y: [0, maxCount] }}
            domainPadding={{ left: 8, right: 8, top: 16 }}
            xAxis={{
              font,
              lineColor: muted,
              labelColor: muted,
              tickCount: 6,
              formatXLabel: (d) => formatDay(d),
            }}
            yAxis={[
              {
                font,
                lineColor: muted,
                labelColor: muted,
                formatYLabel: (n) => String(Math.round(n)),
              },
            ]}
          >
            {({ points, chartBounds }) => (
              <Bar
                points={points.count}
                chartBounds={chartBounds}
                color={bar}
                roundedCorners={{ topLeft: 4, topRight: 4 }}
              />
            )}
          </CartesianChart>
        </View>
      </CardContent>
    </Card>
  );
}
