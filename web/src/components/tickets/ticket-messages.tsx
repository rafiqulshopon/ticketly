import { type ComponentProps } from "react";
import { Sparkles } from "lucide-react";
import { type TicketMessage } from "@ticketly/shared";
import { renderInlineMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

// senderType → label + badge variant (object map, not a switch — adding a value
// is a type error until it's mapped here). The explicit `senderType` is the
// source of truth for the Agent/Customer distinction in the thread.
const MESSAGE_SENDER_TYPE: Record<
  TicketMessage["senderType"],
  { label: string; variant: BadgeVariant }
> = {
  customer: { label: "Customer", variant: "secondary" },
  agent: { label: "Agent", variant: "default" },
};

/** Distinct emerald badge for the system AI agent's replies (vs a human "Agent"). */
const AI_SENDER = { label: "AI Agent", variant: "success" as BadgeVariant };

/** Up-to-two-letter initials, tolerating an email address as the only handle. */
function initials(value?: string | null): string {
  if (!value) return "?";
  const local = value.includes("@") ? value.split("@")[0] : value;
  const parts = local.trim().split(/[.\s_-]+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return letters || value[0]?.toUpperCase() || "?";
}

/** Conversation thread for a ticket — the list of inbound/outbound messages. */
export function TicketMessages({ messages }: { messages: TicketMessage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Conversation</CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <div className="scroll-slim flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MessageItem({ message }: { message: TicketMessage }) {
  const isAi = message.isAi;
  const meta = isAi ? AI_SENDER : MESSAGE_SENDER_TYPE[message.senderType];
  const isAgent = message.senderType === "agent";
  // The "AI Agent" badge already identifies the author; for a human agent show
  // the sender name, for a customer the external fromEmail.
  const author = isAi ? null : isAgent ? message.senderName ?? "Support team" : message.fromEmail;

  // Emerald is reserved for the AI; human agents get ink, customers get muted.
  const bubble = isAi
    ? "bg-ai text-ai-foreground rounded-br-md"
    : isAgent
      ? "bg-primary text-primary-foreground rounded-br-md"
      : "bg-muted text-foreground rounded-bl-md";

  const avatarFallback = isAi
    ? "bg-ai/10 text-ai"
    : isAgent
      ? "bg-primary/10 text-foreground"
      : "bg-muted text-muted-foreground";

  return (
    <div className={cn("flex gap-2.5", isAgent ? "flex-row-reverse" : "flex-row")}>
      <Avatar className="mt-5 size-7 shrink-0">
        <AvatarFallback className={cn("text-[10px]", avatarFallback)}>
          {isAi ? <Sparkles className="size-3.5" /> : initials(author ?? message.fromEmail)}
        </AvatarFallback>
      </Avatar>
      <div className={cn("flex w-full max-w-[80%] flex-col gap-1", isAgent ? "items-end" : "items-start")}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {author !== null && <span className="font-medium text-foreground">{author}</span>}
          {isAgent && message.toEmail && <span>→ {message.toEmail}</span>}
        </div>
        <p
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
            bubble,
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
