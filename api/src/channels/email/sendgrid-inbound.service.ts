import { Injectable } from "@nestjs/common";
import Parse from "@sendgrid/inbound-mail-parser";
import { inboundEmailSchema, type InboundEmailInput } from "./inbound-mail.service";

/**
 * SendGrid Inbound Parse adapter. SendGrid POSTs multipart/form-data whose text
 * fields (from/to/subject/text/html/headers/envelope) are fed to
 * @sendgrid/inbound-mail-parser; its `keyValues()` output is then mapped — along
 * with the RFC822 Message-ID / In-Reply-To / References pulled from the raw
 * `headers` field — into the provider-agnostic `InboundEmailInput` contract that
 * `InboundMailService` (and `TicketsService.ingestInbound`) already speak. No DB
 * access and no token check live here: this is pure mapping, the token gate and
 * persistence stay in `InboundMailService` / `TicketsService`.
 *
 * `parse()` throws when the email cannot yield a valid ticket (no usable
 * requester email or body); the controller turns that into a 200 + log so
 * SendGrid stops retrying a message we could never process.
 */
@Injectable()
export class SendGridInboundService {
  /**
   * Parse one SendGrid multipart payload into a validated `InboundEmailInput`.
   * `body` is multer's text-field bag; `files` are any uploaded parts (the raw
   * `email` file when SendGrid's `send_raw` is on, plus attachments) — we don't
   * rely on them, threading comes from the `headers` text field, but they must
   * be passed to the parser constructor.
   */
  parse(body: Record<string, unknown>, files?: Express.Multer.File[]): InboundEmailInput {
    const parser = new Parse(
      { keys: ["from", "to", "subject", "text", "html", "headers", "envelope"] },
      { body: body ?? {}, files: files ?? [] },
    );
    const v = parser.keyValues() as Record<string, string>;

    const headers = parseHeaders(String(v.headers ?? ""));
    const references = (headers["references"] ?? "")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const fromRaw = String(v.from ?? "");
    const requesterEmail = extractEmail(String(v.envelope ?? ""), fromRaw);
    const requesterName = extractName(fromRaw, requesterEmail);
    const subject = (v.subject ?? "").trim() || "(no subject)";
    const html = typeof v.html === "string" && v.html.length > 0 ? v.html : undefined;
    const bodyText =
      (v.text ?? "").trim() || (html ? stripTags(html) : "") || "(empty body)";

    const result = inboundEmailSchema.safeParse({
      requesterEmail,
      requesterName,
      subject,
      bodyText,
      bodyHtml: html,
      // category is never set by email — left for the AI classifier.
      category: undefined,
      messageId: headers["message-id"] || undefined,
      inReplyTo: headers["in-reply-to"] || undefined,
      references: references.length > 0 ? references : undefined,
    });
    if (!result.success) {
      const detail = result.error.issues
        .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
        .join("; ");
      throw new Error(`inbound payload failed validation: ${detail}`);
    }
    return result.data;
  }
}

/**
 * Parse a raw RFC822 header block (SendGrid's `headers` field) into a
 * lower-cased map. Handles folded continuation lines (a line beginning with
 * space/tab appends to the previous header). Good enough for the single-line
 * headers we care about (Message-ID, In-Reply-To, References, Subject).
 */
function parseHeaders(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  let lastKey: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && lastKey) {
      map[lastKey] += " " + line.trim();
      continue;
    }
    const m = line.match(/^([A-Za-z0-9-]+):[ \t]?(.*)$/);
    if (m) {
      lastKey = m[1].toLowerCase();
      map[lastKey] = m[2].trim();
    } else {
      lastKey = null;
    }
  }
  return map;
}

/**
 * Resolve the requester's bare email address. Prefers the SMTP envelope `from`
 * (the actual delivery address, harder to spoof than the header), falling back
 * to the angle-bracket or bare address in the header `from`. Returns "" when no
 * address can be found (the schema then rejects it → 200 + log).
 */
function extractEmail(envelopeRaw: string, fromRaw: string): string {
  const envelope = safeJson(envelopeRaw);
  const envelopeFrom = Array.isArray(envelope?.from)
    ? envelope.from[0]
    : envelope?.from;
  if (typeof envelopeFrom === "string" && envelopeFrom.includes("@")) {
    return envelopeFrom.trim();
  }
  return pullEmailAddress(fromRaw);
}

function pullEmailAddress(value: string): string {
  if (!value) return "";
  const angle = value.match(/<([^>]+)>/);
  if (angle && angle[1].includes("@")) return angle[1].trim();
  const bare = value.match(/([^\s<>]+@[^\s<>]+)/);
  return bare ? bare[1].trim() : "";
}

/** Best-effort display name from the header `from` (the text before `<`), with a
 *  fallback to the local part of the address so the required name is never empty. */
function extractName(fromRaw: string, email: string): string {
  const raw = (fromRaw ?? "").trim();
  if (raw) {
    const head = raw.includes("<") ? raw.slice(0, raw.indexOf("<")) : "";
    const name = head.replace(/^["']|["']$/g, "").trim();
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

function safeJson(raw: string): { from?: unknown } | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { from?: unknown };
  } catch {
    return null;
  }
}
