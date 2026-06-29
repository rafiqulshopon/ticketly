import { useEffect, useRef, type ComponentProps } from "react";
import { Sparkles } from "lucide-react";
import { type TicketMessage, type UserRole } from "@ticketly/shared";
import { renderInlineMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type BadgeVariant = ComponentProps<typeof Badge>["variant"];
type SenderBadge = { label: string; variant: BadgeVariant };

/** Emerald badge reserved for the system AI agent's replies (vs a human). */
const AI_BADGE: SenderBadge = { label: "AI Agent", variant: "success" };
/** Muted badge for the ticket requester on the customer side of the thread. */
const CUSTOMER_BADGE: SenderBadge = { label: "Customer", variant: "secondary" };

// Human-agent badge by the sender's ACTUAL role (admin → "Admin", agent →
// "Agent"), resolved from `senderRole` (surfaced from the DB `sender` relation).
// Object map, not a switch: adding a role is a type error until it's mapped here.
// Falls back to "Agent" if a role isn't resolved (shouldn't happen — a non-AI
// agent message always carries a senderId/role).
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

/** Up-to-two-letter initials, tolerating an email address as the only handle. */
function initials(value?: string | null): string {
  if (!value) return "?";
  const local = value.includes("@") ? value.split("@")[0] : value;
  const parts = local.trim().split(/[.\s_-]+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return letters || value[0]?.toUpperCase() || "?";
}

/**
 * Identity used to collapse consecutive messages into one visual group (Messenger
 * style). AI and human agents are both `senderType: "agent"` but must NOT collapse
 * together (distinct bubble/avatar), and two different humans must not collapse.
 * The wire `TicketMessage` has no `senderId`, so the best identity per kind is:
 * AI → a fixed key; customer → `fromEmail` (all inbound in a ticket is one
 * requester); human agent → `senderName` — NOT `fromEmail`, because agents all
 * send from the shared `ticket-<id>@` address, so `fromEmail` can't tell them apart.
 */
function groupKey(m: TicketMessage): string {
  if (m.isAi) return "ai";
  if (m.senderType === "customer") return `customer:${m.fromEmail}`;
  return `agent:${m.senderName ?? "support"}`;
}

/** Conversation thread for a ticket — the list of inbound/outbound messages. */
export function TicketMessages({ messages }: { messages: TicketMessage[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastFirstId = useRef<string | undefined>(undefined);
  const lastLength = useRef(0);
  const firstId = messages[0]?.id;

  // Smooth-scroll to the newest message when ENTERING the thread — initial mount
  // OR navigating to a different ticket — and whenever a message is ADDED (a reply
  // via useOptimistic in TicketDetail, or an inbound message over realtime). We
  // deliberately don't scroll otherwise, so reading an existing thread doesn't snap
  // to the bottom. `firstId` doubles as a stable thread identity: this component
  // doesn't remount on a ticket change (no `key` on it), so length alone would miss
  // navigating between two tickets that happen to have the same message count.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (firstId !== lastFirstId.current || messages.length > lastLength.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    lastFirstId.current = firstId;
    lastLength.current = messages.length;
  }, [firstId, messages.length]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Conversation</CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <div ref={scrollRef} className="scroll-slim flex max-h-[60vh] flex-col overflow-y-auto pr-1">
            {messages.map((message, i) => (
              <MessageItem
                key={message.id}
                message={message}
                firstInGroup={i === 0 || groupKey(message) !== groupKey(messages[i - 1])}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MessageItem({ message, firstInGroup }: { message: TicketMessage; firstInGroup: boolean }) {
  const isAi = message.isAi;
  const meta = senderBadge(message);
  const isAgent = message.senderType === "agent";
  // The "AI Agent" badge already identifies the author; for a human agent show
  // the sender name, for a customer the external fromEmail.
  const author = isAi ? null : isAgent ? message.senderName ?? "Support team" : message.fromEmail;

  // Emerald is reserved for the AI; human agents get ink, customers get muted. The
  // "tail" corner points to the sender side and only belongs on a group's first
  // message (it sits beside the avatar); grouped bubbles use plain full rounding so a
  // run reads as connected.
  const bubbleColor = isAi
    ? "bg-ai text-ai-foreground"
    : isAgent
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-foreground";
  const tail = firstInGroup ? (isAgent ? "rounded-br-md" : "rounded-bl-md") : "";

  const avatarFallback = isAi
    ? "bg-ai/10 text-ai"
    : isAgent
      ? "bg-primary/10 text-foreground"
      : "bg-muted text-muted-foreground";

  return (
    <div
      className={cn(
        "flex gap-2.5",
        isAgent ? "flex-row-reverse" : "flex-row",
        // Group starts get breathing room above; grouped messages stack tightly. The
        // very first message has no top gap (matches the previous `gap-5` container).
        firstInGroup ? "mt-5 first:mt-0" : "mt-1",
      )}
    >
      {firstInGroup ? (
        <Avatar className="mt-5 size-7 shrink-0">
          <AvatarFallback className={cn("text-[10px]", avatarFallback)}>
            {isAi ? <Sparkles className="size-3.5" /> : initials(author ?? message.fromEmail)}
          </AvatarFallback>
        </Avatar>
      ) : (
        // Avatar-width spacer so a grouped bubble stays aligned with the run's first
        // bubble (same horizontal offset) without showing a second avatar/name.
        <div className="size-7 shrink-0" aria-hidden="true" />
      )}
      <div className={cn("flex w-full max-w-[80%] flex-col gap-1", isAgent ? "items-end" : "items-start")}>
        {firstInGroup && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            {author !== null && <span className="font-medium text-foreground">{author}</span>}
            {isAgent && message.toEmail && <span>→ {message.toEmail}</span>}
          </div>
        )}
        <p
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
            bubbleColor,
            tail,
          )}
        >
          {renderInlineMarkdown(message.bodyText)}
        </p>
        <span className="text-xs text-muted-foreground">
          {dateFmt.format(new Date(message.createdAt))}
        </span>
      </div>
    </div>
  );
}
