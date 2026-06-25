import { ForbiddenException, Injectable } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { createTicketSchema } from "@ticketly/shared";
import { z } from "zod";
import { TicketsService } from "../../tickets/tickets.service";

/**
 * Provider-agnostic inbound-email webhook. A trusted system POSTs the same
 * normalized shape as the manual create endpoint, plus RFC822 threading fields:
 * `messageId` (idempotency) and optional `inReplyTo` / `references` (so a reply
 * appends to its thread instead of creating a duplicate). We verify the
 * shared-secret token and ingest the email via TicketsService.ingestInbound,
 * which decides new-ticket vs. appended-reply. A provider (SendGrid, Mailgun, …)
 * is wired by adapting its payload into this JSON contract — no provider code
 * lives here.
 *
 * The route is @AllowAnonymous (the caller has no session); the X-Webhook-Token
 * header, constant-time-compared to INBOUND_EMAIL_WEBHOOK_TOKEN, IS the access
 * decision. If that env var is unset the webhook fails closed (403 for everyone).
 */
export const inboundEmailSchema = createTicketSchema.extend({
  messageId: z.string().min(1).max(512, "Message ID is too long").optional(),
  inReplyTo: z.string().min(1).max(512, "In-Reply-To is too long").optional(),
  references: z
    .array(z.string().min(1).max(512))
    .max(20, "Too many references")
    .optional(),
});
export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;

@Injectable()
export class InboundMailService {
  constructor(private readonly tickets: TicketsService) {}

  async handle(
    token: string | undefined,
    input: InboundEmailInput,
  ): Promise<{ id: number; created: boolean; appended: boolean }> {
    this.verifyToken(token);
    const { ticketId, created, appended } = await this.tickets.ingestInbound(input);
    return { id: ticketId, created, appended };
  }

  private verifyToken(token: string | undefined): void {
    const secret = process.env.INBOUND_EMAIL_WEBHOOK_TOKEN;
    if (!secret) {
      // Fail closed: with no secret configured the webhook cannot authenticate anyone.
      throw new ForbiddenException("Inbound email webhook is not configured");
    }
    const received = Buffer.from(token ?? "");
    const expected = Buffer.from(secret);
    // timingSafeEqual requires equal-length buffers; the length check is benign
    // (token length is not secret-sensitive) and avoids throwing on mismatch.
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new ForbiddenException("Invalid webhook token");
    }
  }
}
