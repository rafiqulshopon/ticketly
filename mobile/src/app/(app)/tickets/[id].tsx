import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getTicket } from "@/lib/api";

/** Ticket detail — M0 stub: fetches the ticket (proves the detail endpoint +
 *  scoped access work) and shows the header. The full thread, reply form, AI
 *  polish/summarize, inline property edits, and Activity tab arrive in M1. */
export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = Number(id);

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicket(ticketId),
    enabled: Number.isFinite(ticketId),
  });

  return (
    <View className="flex-1 bg-background p-4">
      <Pressable onPress={() => router.back()}>
        <Text className="mb-2 text-primary">← Back</Text>
      </Pressable>
      {isLoading && <Text className="text-muted-foreground">Loading…</Text>}
      {error && <Text className="text-destructive">{(error as Error).message}</Text>}
      {ticket && (
        <View>
          <Text className="text-xl font-bold text-foreground">{ticket.subject}</Text>
          <Text className="mt-1 text-muted-foreground">
            {ticket.requesterName} · {ticket.status}
          </Text>
          <Text className="mt-4 text-muted-foreground">
            Conversation, reply, and AI tools arrive in milestone M1.
          </Text>
        </View>
      )}
    </View>
  );
}
