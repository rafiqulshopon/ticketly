import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Resend } from "resend";
import { randomUUID } from "node:crypto";

/**
 * Dev fallback for the outbound "from" address. Production must set MAIL_FROM to
 * a Resend-verified sender (an authenticated domain, or the free
 * *.resend.app subdomain) — Resend rejects unverified "from" addresses. Kept
 * here (not imported from tickets.service) so this module has zero dependency on
 * the tickets layer and can be imported by TicketsModule without a cycle.
 */
const DEFAULT_MAIL_FROM = "support@ticketly.local";

export interface SendReplyInput {
  /** Recipient — the ticket requester. */
  to: string;
  /** Verified Resend sender address (envelope + header From). */
  from: string;
  /** Optional display name, e.g. "Ticketly Support". */
  fromName?: string;
  subject: string;
  text: string;
  /** Client-generated RFC822 Message-ID for this outbound mail. Sent as the
   *  Message-ID header AND persisted on the Message row so inbound replies thread. */
  messageId: string;
  /** Originating inbound Message-ID — threads this reply under it in the client. */
  inReplyTo?: string | null;
  /** Same/parent Message-ID chain — set alongside In-Reply-To for strict threading. */
  references?: string | null;
}

export interface SendReplyResult {
  /** The Message-ID that was (or would have been) sent — always returned so the
   *  caller can persist it for threading even when delivery fails. */
  messageId: string;
  /** True iff Resend accepted the message. False on outage or missing config. */
  delivered: boolean;
}

/**
 * Sends outbound support email through Resend. Two callers:
 *  - {@link /api/src/tickets/tickets.service.ts TicketsService.reply} — a staff agent's reply.
 *  - {@link /api/src/tickets/tickets.auto-resolve-consumer.ts AutoResolveTicketConsumer} — the AI's KB-grounded auto-reply.
 *
 * Threading: each send carries a client-generated RFC822 Message-ID (Resend
 * honors a sender-supplied Message-ID via the custom `headers` field) plus
 * In-Reply-To and References pointing at the ticket's originating inbound
 * Message-ID. The same value is persisted on the outbound Message row, so when
 * the customer replies, the Resend inbound webhook's `ingestInbound` lookup (a
 * `Message.messageId` match against the reply's In-Reply-To/References) threads
 * it back onto this ticket instead of opening a new one.
 *
 * Delivery is best-effort and **never throws**: a Resend outage logs and
 * returns `delivered: false` so the caller's already-persisted in-thread reply
 * survives — an agent's work is never lost to a transient mail-provider failure.
 */
@Injectable()
export class OutboundMailService implements OnModuleInit {
  private readonly logger = new Logger(OutboundMailService.name);
  private client?: Resend;

  async onModuleInit(): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        "RESEND_API_KEY is not set — outbound email disabled (replies persist in-thread only).",
      );
      return;
    }
    this.client = new Resend(apiKey);
  }

  /** True iff a Resend API key is configured. */
  isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY);
  }

  /** Verified sender address outbound mail is sent from. Defaults to the dev
   *  support address; prod must set MAIL_FROM to a verified sender/domain. */
  fromAddress(): string {
    return process.env.MAIL_FROM ?? DEFAULT_MAIL_FROM;
  }

  /** Display name on outbound mail (e.g. "Ticketly Support"). Optional. */
  fromName(): string | undefined {
    const name = process.env.MAIL_FROM_NAME;
    return name?.trim() ? name : undefined;
  }

  /** The sending domain derived from MAIL_FROM (e.g. "support@rafiqulshopon.dev"
   *  → "rafiqulshopon.dev"). Used for Message-IDs and per-ticket reply addresses. */
  private sendingDomain(): string {
    return (process.env.MAIL_FROM ?? DEFAULT_MAIL_FROM).split("@")[1] ?? "ticketly.local";
  }

  /** A fresh, globally-unique RFC822 Message-ID scoped to the sending domain so
   *  customer replies thread correctly. */
  generateMessageId(): string {
    return `<ticketly-${randomUUID()}@${this.sendingDomain()}>`;
  }

  /** Per-ticket reply address (`ticket-<id>@<domain>`). Used as the outbound From so a
   *  customer's reply routes back to THIS ticket via the inbound webhook — far more
   *  reliable than RFC822 In-Reply-To/References headers, which Resend's inbound fetch
   *  doesn't surface. The receiving domain is a catch-all, so any `ticket-<id>@` lands. */
  ticketReplyAddress(ticketId: number): string {
    return `ticket-${ticketId}@${this.sendingDomain()}`;
  }

  async sendReply(input: SendReplyInput): Promise<SendReplyResult> {
    if (!this.isConfigured() || !this.client) {
      this.logger.warn(
        `Outbound email skipped (RESEND_API_KEY unset): to=${input.to} subject="${input.subject}".`,
      );
      return { messageId: input.messageId, delivered: false };
    }

    const headers: Record<string, string> = { "Message-ID": input.messageId };
    if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
    if (input.references) headers["References"] = input.references;

    const from = input.fromName ? `${input.fromName} <${input.from}>` : input.from;

    try {
      // Resend does NOT throw on a failed send — it returns { data, error }. We
      // must check `error` explicitly (in addition to the network-level catch).
      const { error } = await this.client.emails.send({
        to: input.to,
        from,
        subject: input.subject,
        text: input.text,
        headers,
      });
      if (error) {
        this.logger.error(`Resend send failed (to=${input.to}): ${JSON.stringify(error)}`);
        return { messageId: input.messageId, delivered: false };
      }
      return { messageId: input.messageId, delivered: true };
    } catch (err) {
      // Never throw — the caller has already persisted the in-thread reply; a
      // mail-provider failure must not roll that back or fail the agent's request.
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resend send threw (to=${input.to}): ${detail}`);
      return { messageId: input.messageId, delivered: false };
    }
  }
}
