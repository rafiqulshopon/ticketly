import { Stack } from "expo-router";

/** Tickets tab navigator — nests the inbox (`index`) and the ticket detail
 *  (`[id]`) under the Tickets tab. Without this layout Expo Router hoists
 *  `[id]` up to the tab bar, surfacing a stray "Ticket #…" tab (and "Ticket
 *  #NaN" when no id is present). Headers are hidden: both screens render their
 *  own in-content headers (the inbox title; the detail's "‹ Tickets" back bar). */
export default function TicketsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
