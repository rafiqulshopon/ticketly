import { useOptimistic, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { TicketMessage } from "@ticketly/shared";
import { ApiError, getTicket } from "@/lib/api";
import { Badge, Segmented } from "@/components/ui";
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

  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: ({ signal }) => getTicket(ticketId, { signal }),
    enabled: Number.isFinite(ticketId),
    retry: (failureCount, err) => !(err instanceof ApiError) && failureCount < 2,
  });

  // Reached without a numeric id (stale deep link / nav glitch) → bounce to the inbox.
  if (!Number.isFinite(ticketId)) {
    return <Redirect href="/tickets" />;
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center p-6">
            <Text className="text-destructive">{toDetailErrorMessage(error)}</Text>
            <Pressable onPress={() => void refetch()} className="mt-4">
              <Text className="text-primary">Try again</Text>
            </Pressable>
          </View>
        ) : ticket ? (
          <Detail ticket={ticket} ticketId={ticketId} tab={tab} onTab={setTab} />
        ) : null}
      </KeyboardAvoidingView>
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

  const status = STATUS_BADGES[ticket.status];
  const priority = PRIORITY_BADGES[ticket.priority];

  return (
    <View className="flex-1">
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
          <TicketMessages messages={optimisticMessages} />
          <View className="px-4 pb-4">
            <ReplyForm ticket={ticket} onOptimisticReply={addOptimisticMessage} />
          </View>
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

function toDetailErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return "Ticket not found.";
    if (err.status === 403) return "You don't have permission to view this ticket.";
    if (err.status === 401) return "Your session may have expired — please sign in again.";
  }
  return err instanceof Error ? err.message : "Failed to load ticket.";
}
