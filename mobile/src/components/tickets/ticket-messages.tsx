import { useEffect, useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { type TicketMessage, type UserRole } from "@ticketly/shared";
import { Avatar, AvatarFallback, Badge, type BadgeVariant } from "@/components/ui";
import { cx } from "@/lib/cx";
import { initials } from "@/lib/format";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type SenderBadge = { label: string; variant: BadgeVariant };

/** Emerald badge reserved for the system AI agent's replies (vs a human). */
const AI_BADGE: SenderBadge = { label: "AI Agent", variant: "success" };
/** Muted badge for the ticket requester on the customer side of the thread. */
const CUSTOMER_BADGE: SenderBadge = { label: "Customer", variant: "secondary" };

// Human-agent badge by the sender's ACTUAL role. Object map, not a switch:
// adding a role is a type error until it's mapped here. Falls back to "Agent"
// if a role isn't resolved (a non-AI agent message always carries a role).
const AGENT_BADGE: Record<UserRole, SenderBadge> = {
  admin: { label: "Admin", variant: "default" },
  agent: { label: "Agent", variant: "default" },
};

/** Pick the header badge for a message — AI / customer / human-agent-by-role. */
function senderBadge(message: TicketMessage): SenderBadge {
  if (message.isAi) return AI_BADGE;
  if (message.senderType === "customer") return CUSTOMER_BADGE;
  return AGENT_BADGE[message.senderRole ?? "agent"];
}

/**
 * Identity used to collapse consecutive messages into one visual group. AI and
 * human agents are both `senderType: "agent"` but must NOT collapse together,
 * and two different humans must not collapse. The wire message has no senderId,
 * so the best identity per kind is: AI → fixed key; customer → fromEmail; human
 * agent → senderName (agents share the ticket-<id>@ from-address).
 */
function groupKey(m: TicketMessage): string {
  if (m.isAi) return "ai";
  if (m.senderType === "customer") return `customer:${m.fromEmail}`;
  return `agent:${m.senderName ?? "support"}`;
}

/**
 * Conversation thread for a ticket — the inbound/outbound message bubbles. Owns
 * its own bounded ScrollView so it can smooth-scroll to the newest message on
 * initial mount, on ticket change, and whenever a message is added (an
 * optimistic reply or an inbound message over realtime). Plain text bodies (the
 * web renders inline markdown; no RN markdown lib in M1 scope).
 */
export function TicketMessages({ messages }: { messages: TicketMessage[] }) {
  const scrollRef = useRef<ScrollView>(null);
  const lastFirstId = useRef<string | undefined>(undefined);
  const lastLength = useRef(0);
  const firstId = messages[0]?.id;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // scrollToEnd isn't a method on the RN ref type, but ScrollView exposes it
    // at runtime; cast to the minimal shape we need.
    if (firstId !== lastFirstId.current || messages.length > lastLength.current) {
      (el as ScrollView & { scrollToEnd?: (opts?: { animated?: boolean }) => void }).scrollToEnd?.({
        animated: true,
      });
    }
    lastFirstId.current = firstId;
    lastLength.current = messages.length;
  }, [firstId, messages.length]);

  if (messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-sm text-muted-foreground">No messages yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} className="flex-1" contentContainerStyle={{ padding: 8 }}>
      {messages.map((message, i) => (
        <MessageItem
          key={message.id}
          message={message}
          firstInGroup={i === 0 || groupKey(message) !== groupKey(messages[i - 1])}
        />
      ))}
    </ScrollView>
  );
}

type BubbleColor = { bubble: string; avatar: string };

function MessageItem({ message, firstInGroup }: { message: TicketMessage; firstInGroup: boolean }) {
  const meta = senderBadge(message);
  const isAi = message.isAi;
  const isAgent = message.senderType === "agent";
  const author = isAi ? null : isAgent ? message.senderName ?? "Support team" : message.fromEmail;

  const colors: BubbleColor = isAi
    ? { bubble: "bg-ai text-ai-foreground", avatar: "bg-ai-soft text-ai" }
    : isAgent
      ? { bubble: "bg-primary text-primary-foreground", avatar: "bg-secondary text-foreground" }
      : { bubble: "bg-muted text-foreground", avatar: "bg-muted text-muted-foreground" };

  return (
    <View className={cx("flex flex-row gap-2.5", isAgent ? "flex-row-reverse" : "flex-row", firstInGroup ? "mt-4" : "mt-1")}>
      {firstInGroup ? (
        <Avatar className="mt-5 size-7 shrink-0">
          <AvatarFallback className={colors.avatar}>{isAi ? <Sparkles size={14} /> : <AvatarText value={author ?? message.fromEmail} />}</AvatarFallback>
        </Avatar>
      ) : (
        <View className="size-7 shrink-0" />
      )}
      <View className={cx("flex max-w-[80%] flex-col gap-1", isAgent ? "items-end" : "items-start")}>
        {firstInGroup && (
          <View className="flex flex-row items-center gap-2">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            {author !== null && <Text className="text-xs font-medium text-foreground">{author}</Text>}
          </View>
        )}
        <View className={cx("rounded-2xl px-3.5 py-2", colors.bubble)}>
          <Text className="text-sm leading-relaxed">{message.bodyText}</Text>
        </View>
        <Text className="text-xs text-muted-foreground">{dateFmt.format(new Date(message.createdAt))}</Text>
      </View>
    </View>
  );
}

/** The initials label inside an avatar (separate so it doesn't render when AI). */
function AvatarText({ value }: { value: string }) {
  return <Text className="text-[10px] font-medium">{initials(value)}</Text>;
}
