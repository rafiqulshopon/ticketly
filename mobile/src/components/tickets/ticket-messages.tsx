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
export function TicketMessages({
  messages,
  keyboardVisible,
}: {
  messages: TicketMessage[];
  /** When true→ the keyboard just opened; scroll the newest message into view above the lifted composer. */
  keyboardVisible?: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const lastFirstId = useRef<string | undefined>(undefined);
  const lastLength = useRef(0);
  const wasKeyboardVisible = useRef(false);
  const firstId = messages[0]?.id;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // scrollToEnd isn't a method on the RN ref type, but ScrollView exposes it
    // at runtime; cast to the minimal shape we need.
    const justOpenedKeyboard = !!keyboardVisible && !wasKeyboardVisible.current;
    if (
      firstId !== lastFirstId.current ||
      messages.length > lastLength.current ||
      justOpenedKeyboard
    ) {
      (el as ScrollView & { scrollToEnd?: (opts?: { animated?: boolean }) => void }).scrollToEnd?.({
        animated: true,
      });
    }
    lastFirstId.current = firstId;
    lastLength.current = messages.length;
    wasKeyboardVisible.current = !!keyboardVisible;
  }, [firstId, messages.length, keyboardVisible]);

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

type MessageKind = "ai" | "agent" | "customer";

// Bubble background and foreground are split because RN <Text> does NOT inherit
// `color` from a parent <View>: the foreground must live on the <Text> (the body
// and the avatar initials), or it falls back to black — invisible on the dark
// `bg-primary` agent bubble. Object map keyed by MessageKind, not a ternary.
type BubbleColor = { bubble: string; bubbleText: string; avatar: string; avatarText: string };

const BUBBLE_COLORS: Record<MessageKind, BubbleColor> = {
  ai: { bubble: "bg-ai", bubbleText: "text-ai-foreground", avatar: "bg-ai-soft", avatarText: "text-ai" },
  agent: { bubble: "bg-primary", bubbleText: "text-primary-foreground", avatar: "bg-secondary", avatarText: "text-foreground" },
  customer: { bubble: "bg-muted", bubbleText: "text-foreground", avatar: "bg-muted", avatarText: "text-muted-foreground" },
};

function MessageItem({ message, firstInGroup }: { message: TicketMessage; firstInGroup: boolean }) {
  const meta = senderBadge(message);
  const isAi = message.isAi;
  const isAgent = message.senderType === "agent";
  const author = isAi ? null : isAgent ? message.senderName ?? "Support team" : message.fromEmail;

  const kind: MessageKind = isAi ? "ai" : isAgent ? "agent" : "customer";
  const colors = BUBBLE_COLORS[kind];

  return (
    <View className={cx("flex flex-row gap-2.5", isAgent ? "flex-row-reverse" : "flex-row", firstInGroup ? "mt-4" : "mt-1")}>
      {firstInGroup ? (
        <Avatar className="mt-5 size-7 shrink-0">
          <AvatarFallback className={colors.avatar}>{isAi ? <Sparkles size={14} /> : <AvatarText value={author ?? message.fromEmail} className={colors.avatarText} />}</AvatarFallback>
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
          <Text className={cx("text-sm leading-relaxed", colors.bubbleText)}>{message.bodyText}</Text>
        </View>
        <Text className="text-xs text-muted-foreground">{dateFmt.format(new Date(message.createdAt))}</Text>
      </View>
    </View>
  );
}

/** The initials label inside an avatar (separate so it doesn't render when AI).
 *  Takes the avatar's foreground color directly — RN <Text> won't inherit it from
 *  the AvatarFallback <View>. */
function AvatarText({ value, className }: { value: string; className?: string }) {
  return <Text className={cx("text-[10px] font-medium", className)}>{initials(value)}</Text>;
}
