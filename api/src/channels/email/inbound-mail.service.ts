import { ForbiddenException, Injectable } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { createTicketSchema } from "@ticketly/shared";
import { z } from "zod";
import { TicketsService } from "../../tickets/tickets.service";

/**
 * Provider-agnostic inbound-email webhook. A trusted system POSTs the same
 * normalized shape as the manual create endpoint (plus an optional `messageId`
 * for idempotency); we verify the shared-secret token and create a ticket via
 * TicketsService. A future email provider (SendGrid, Mailgun, …) is wired by
 * adapting its payload into this JSON contract — no provider code lives here.
 *
 * The route is @AllowAnonymous (the caller has no session); the X-Webhook-Token
 * header, constant-time-compared to INBOUND_EMAIL_WEBHOOK_TOKEN, IS the access
 * decision. If that env var is unset the webhook fails closed (403 for everyone).
 */
export const inboundEmailSchema = createTicketSchema.extend({
  messageId: z.string().min(1).optional(),
});
export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;

@Injectable()
export class InboundMailService {
  constructor(private readonly tickets: TicketsService) {}

  async handle(
    token: string | undefined,
    input: InboundEmailInput,
  ): Promise<{ id: number; created: boolean }> {
    this.verifyToken(token);
    const { messageId, ...ticketInput } = input;
    const { ticket, created } = await this.tickets.create(ticketInput, { messageId });
    return { id: ticket.id, created };
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
