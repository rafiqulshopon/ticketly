import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
  type OnModuleInit,
} from "@nestjs/common";
import EmailReplyParser from "email-reply-parser";
import { Resend } from "resend";
import type { GetReceivingEmailResponseSuccess } from "resend";
import { inboundEmailSchema, type InboundEmailInput } from "./inbound-mail.service";

/**
 * Resend inbound adapter. Resend delivers inbound as a JSON `email.received`
 * webhook that carries **metadata only** (to fit serverless body-size limits) —
 * `from`, `to`, `subject`, `message_id`, and the all-important `email_id`. The
 * full content (body text/html, the complete RFC822 `headers`, attachments) is
 * fetched on demand via `resend.emails.receiving.get(email_id)`.
 *
 * This service does two things, in order, and nothing more:
 *  1. {@link verifyReceivedEmail} — cryptographically verify the Svix signature
 *     over the raw body and return the event's `email_id`. Auth-only; throws on
 *     anything that isn't a valid, signed `email.received` event.
 *  2. {@link toInput} — fetch the email and map it into the provider-agnostic
 *     `InboundEmailInput` contract that `InboundMailService` /
 *     `TicketsService.ingestInbound` already speak. Pure mapping + validation.
 *
 * No DB access and no ingest logic lives here — the controller calls
 * `InboundMailService.ingest` after `toInput` succeeds. Threading comes from the
 * fetched email's `headers` (`message-id` / `in-reply-to` / `references`); if a
 * header is absent the email simply opens a new ticket (the safe fallback).
 */
@Injectable()
export class ResendInboundService implements OnModuleInit {
  private readonly logger = new Logger(ResendInboundService.name);
  private client?: Resend;

  async onModuleInit(): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        "RESEND_API_KEY is not set — Resend inbound email disabled (fetch + verify unavailable).",
      );
      return;
    }
    this.client = new Resend(apiKey);
  }

  /**
   * Verify the Svix signature and return the `email_id` of the received email.
   * Throws {@link UnauthorizedException} for any signature/auth problem and
   * {@link InternalServerErrorException} for a deploy-time misconfig (missing
   * secret) so the controller surfaces the right status (and so a missing
   * webhook secret isn't mistaken for a bad signature).
   */
  verifyReceivedEmail(
    rawBody: string,
    headers: { id?: string; timestamp?: string; signature?: string },
  ): string {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      throw new InternalServerErrorException("RESEND_WEBHOOK_SECRET is not configured");
    }
    if (!this.client) {
      throw new InternalServerErrorException("Resend client is not configured (RESEND_API_KEY unset)");
    }
    if (!headers.id || !headers.timestamp || !headers.signature) {
      throw new UnauthorizedException("missing Svix signature headers");
    }
    let event;
    try {
      // verify() is synchronous, local crypto (no API call) — throws on a bad
      // signature and returns the parsed payload otherwise.
      event = this.client.webhooks.verify({
        payload: rawBody,
        headers: { id: headers.id, timestamp: headers.timestamp, signature: headers.signature },
        webhookSecret: secret,
      });
    } catch {
      throw new UnauthorizedException("invalid webhook signature");
    }
    if (event.type !== "email.received") {
      throw new UnauthorizedException(`unexpected webhook event type: ${event.type}`);
    }
    return event.data.email_id;
  }

  /**
   * Fetch the full received email and map it into a validated `InboundEmailInput`.
   * Throws on a fetch failure or a payload that can't yield a valid ticket; the
   * controller turns that into a 200 + log so Resend stops retrying a message we
   * could never process.
   */
  async toInput(emailId: string): Promise<InboundEmailInput> {
    if (!this.client) {
      throw new Error("Resend client is not configured (RESEND_API_KEY unset)");
    }
    const { data: email, error } = await this.client.emails.receiving.get(emailId);
    if (error || !email) {
      throw new Error(`failed to fetch received email ${emailId}: ${JSON.stringify(error)}`);
    }
    return mapReceivedEmail(email);
  }
}

/** Lowercase every header key so lookups are case-insensitive (MIME keys are). */
function lowerCaseHeaders(headers: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [key, value] of Object.entries(headers)) out[key.toLowerCase()] = value;
  return out;
}

/** Strip quoted history from an inbound email body, returning only the new text the
 *  customer typed. Returns "" if nothing usable remains (caller falls back to raw). */
function extractReply(text: string): string {
  try {
    return new EmailReplyParser().parseReply(text).trim();
  } catch {
    // parseReply is best-effort; on any failure the caller keeps the raw text.
    return "";
  }
}

/** Extract a ticket id from a recipient of the form `ticket-<id>@<domain>`. Returns
 *  undefined when no recipient matches (first-time email / dev webhook). */
function extractRoutingTicketId(recipients: string[] | null | undefined): number | undefined {
  if (!recipients) return undefined;
  for (const addr of recipients) {
    const match = addr.match(/ticket-(\d+)@/i);
    if (match) return Number(match[1]);
  }
  return undefined;
}

/**
 * Map one fetched Resend email into a validated `InboundEmailInput`. Uses the
 * standard inbound field precedence (header From for the display name, bare
 * address for the requester) and the same HTML-only fallback to stripped text.
 */
function mapReceivedEmail(email: GetReceivingEmailResponseSuccess): InboundEmailInput {
  const headers = lowerCaseHeaders(email.headers);
  const references = (headers["references"] ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const fromHeader = headers["from"] ?? email.from;
  const requesterEmail = pullEmailAddress(fromHeader) || email.from;
  const requesterName = extractName(fromHeader, requesterEmail);
  const subject = (email.subject ?? "").trim() || "(no subject)";
  const html = email.html && email.html.length > 0 ? email.html : undefined;
  const rawText = (email.text ?? "").trim() || (html ? stripTags(html) : "");
  // Strip quoted history (Gmail "On … wrote:", ">" blocks, signatures) so only the
  // customer's NEW text is stored. Fall back to the raw text if stripping empties it.
  const bodyText = rawText ? extractReply(rawText) || rawText : "(empty body)";
  // Primary threading signal: a `ticket-<id>@<domain>` recipient (the per-ticket reply
  // address Ticketly sends from). Undefined for first-time emails / the dev webhook.
  const routingTicketId = extractRoutingTicketId(email.to);

  const result = inboundEmailSchema.safeParse({
    requesterEmail,
    requesterName,
    subject,
    bodyText,
    bodyHtml: html,
    // category is never set by email — left for the AI classifier.
    category: undefined,
    messageId: headers["message-id"] || email.message_id || undefined,
    inReplyTo: headers["in-reply-to"] || undefined,
    references: references.length > 0 ? references : undefined,
    routingTicketId,
  });
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
      .join("; ");
    throw new Error(`resend inbound payload failed validation: ${detail}`);
  }
  return result.data;
}

/** Pull the first angle-bracketed or bare address out of a From-style header. */
function pullEmailAddress(value: string): string {
  if (!value) return "";
  const angle = value.match(/<([^>]+)>/);
  if (angle && angle[1].includes("@")) return angle[1].trim();
  const bare = value.match(/([^\s<>]+@[^\s<>]+)/);
  return bare ? bare[1].trim() : "";
}

/** Best-effort display name from a From header (the text before `<`), with a
 *  fallback to the local part of the address so the required name is never empty. */
function extractName(fromRaw: string, email: string): string {
  const raw = (fromRaw ?? "").trim();
  if (raw) {
    const head = raw.includes("<") ? raw.slice(0, raw.indexOf("<")) : "";
    // Trim BEFORE stripping quotes: a From like `"Md Shopon" <x@y>` leaves a
    // trailing space after the closing quote, which would otherwise shield the
    // quote from the `$` anchor and leave a stray `"`.
    const name = head.trim().replace(/^["']+|["']+$/g, "").trim();
    if (name) return name;
  }
  return (email.split("@")[0] ?? "").trim() || "Unknown";
}

/** Naive HTML→text for HTML-only emails (their `text` part is empty). This is
 *  NOT security-sensitive: any HTML stored on the ticket is re-sanitized with
 *  DOMPurify at the write chokepoint in TicketsService. */
function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
