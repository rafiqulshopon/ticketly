import { type ComponentProps } from "react";
import { type TicketMessage } from "@ticketly/shared";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

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
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
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
  const meta = MESSAGE_SENDER_TYPE[message.senderType];
  const isAgent = message.senderType === "agent";
  // Customer: the external author (fromEmail). Agent: the staff agent (senderName),
  // replying to the requester (toEmail).
  const author = isAgent ? (message.senderName ?? "Support team") : message.fromEmail;
  return (
    <div className={`flex flex-col gap-1 ${isAgent ? "items-end" : "items-start"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={meta.variant}>{meta.label}</Badge>
        <span className="font-medium text-foreground">{author}</span>
        {isAgent && <span>→ {message.toEmail}</span>}
      </div>
      <p
        className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
          isAgent ? "bg-chat-agent text-chat-agent-foreground" : "bg-muted text-foreground"
        }`}
      >
        {message.bodyText}
      </p>
      <span className="text-xs text-muted-foreground">
        {dateFmt.format(new Date(message.createdAt))}
      </span>
    </div>
  );
}
