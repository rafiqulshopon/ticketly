import { useLayoutEffect, useOptimistic, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, router, useLocalSearchParams, useNavigation } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { TicketMessage } from "@ticketly/shared";
import { getTicket } from "@/lib/api";
import { toErrorMessage } from "@/lib/errors";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { Badge, ErrorState, KeyboardBottomSpacer, LoadingState, Segmented } from "@/components/ui";
import { PRIORITY_BADGES, STATUS_BADGES } from "@/components/tickets/ticket-badges";
import { TicketActivity } from "@/components/tickets/ticket-activity";
import { TicketMessages } from "@/components/tickets/ticket-messages";
import { TicketProperties } from "@/components/tickets/ticket-properties";
import { TicketSummary } from "@/components/tickets/ticket-summary";
import { ReplyForm } from "@/components/tickets/reply-form";

type Tab = "conversation" | "activity" | "properties";

/** Ticket detail — full conversation thread, optimistic reply + AI polish/
 *  summarize, inline property edits, and an Activity timeline. Replaces the M0
 *  stub. Lives under the Tickets tab's Stack (tickets/_layout.tsx); the Stack
 *  header is hidden in favour of an in-content back bar. A non-numeric id
 *  (stale deep link) Redirects to the inbox rather than render "Ticket #NaN". */
export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = Number(id);
  const [tab, setTab] = useState<Tab>("conversation");
  const navigation = useNavigation();

  // Hide the bottom tab bar while a ticket is open: Messenger-style UX, and it
  // removes the tab bar from the flex chain so the reply composer can sit flush
  // above the keyboard. `getParent()` is the (app) Tabs navigator; the cleanup
  // restores the tab bar on unmount (back/pop).
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    parent.setOptions({ tabBarStyle: { display: "none" } });
    return () => {
      parent.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  const { data: ticket, isPending, error, refetch } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: ({ signal }) => getTicket(ticketId, { signal }),
    enabled: Number.isFinite(ticketId),
  });

  // Reached without a numeric id (stale deep link / nav glitch) → bounce to the inbox.
  if (!Number.isFinite(ticketId)) {
    return <Redirect href="/tickets" />;
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      {isPending ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={toErrorMessage(error)} onRetry={() => void refetch()} />
      ) : ticket ? (
        <Detail ticket={ticket} ticketId={ticketId} tab={tab} onTab={setTab} />
      ) : null}
    </SafeAreaView>
  );
}

function Detail({
  ticket,
  ticketId,
  tab,
  onTab,
}: {
  ticket: import("@ticketly/shared").TicketDetail;
  ticketId: number;
  tab: Tab;
  onTab: (t: Tab) => void;
}) {
  // useOptimistic is lifted here so ReplyForm + TicketMessages share the same
  // list: a just-sent reply appears instantly, then is replaced by the real
  // message when the mutation settles (no flicker). TicketMessages smooth-
  // scrolls to it.
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    ticket.messages,
    (state, newMessage: TicketMessage) => [...state, newMessage],
  );
  const insets = useSafeAreaInsets();
  // Animated keyboard lift for the reply composer — drives KeyboardBottomSpacer.
  const { height: kbHeight, visible: kbVisible } = useKeyboardHeight();

  const status = STATUS_BADGES[ticket.status];
  const priority = PRIORITY_BADGES[ticket.priority];

  return (
    // The bottom tab bar is hidden on this screen, so it no longer supplies the
    // bottom safe-area inset; apply it here so every tab clears the home indicator.
    <View className="flex-1" style={{ paddingBottom: insets.bottom }}>
      {/* In-content header bar (the route header is hidden). */}
      <View className="px-4 pb-2 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="mb-2 self-start">
          <Text className="text-primary">‹ Tickets</Text>
        </Pressable>
        <Text className="font-mono text-xs text-muted-foreground">Ticket #{ticketId}</Text>
        <Text className="mt-1 text-xl font-semibold text-foreground">{ticket.subject}</Text>
        <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={1}>
          {ticket.requesterName} · {ticket.requesterEmail}
        </Text>
        <View className="mt-2 flex flex-row flex-wrap gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          <Badge variant={priority.variant}>{priority.label} priority</Badge>
        </View>
      </View>

      <View className="px-4 pb-2">
        <Segmented<Tab>
          value={tab}
          onChange={onTab}
          options={[
            { value: "conversation", label: "Conversation" },
            { value: "activity", label: "Activity" },
            { value: "properties", label: "Properties" },
          ]}
        />
      </View>

      {tab === "conversation" ? (
        <View className="flex-1">
          <View className="px-4">
            <TicketSummary ticket={ticket} />
          </View>
          <TicketMessages messages={optimisticMessages} keyboardVisible={kbVisible} />
          <View className="px-4 pb-4">
            <ReplyForm ticket={ticket} onOptimisticReply={addOptimisticMessage} />
          </View>
          {/* Animated spacer = keyboard height; the last child so the composer is
              pushed flush to the keyboard's top edge. */}
          <KeyboardBottomSpacer height={kbHeight} />
        </View>
      ) : null}

      {tab === "activity" ? (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          <TicketActivity ticketId={ticketId} />
        </ScrollView>
      ) : null}

      {tab === "properties" ? (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          <TicketProperties ticket={ticket} />
        </ScrollView>
      ) : null}
    </View>
  );
}
