import {
  Controller,
  Headers,
  HttpCode,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { InboundEmailInput } from "./inbound-mail.service";
import { InboundMailService } from "./inbound-mail.service";
import { ResendInboundService } from "./resend-inbound.service";

/**
 * Resend inbound webhook. `@AllowAnonymous` opts out of the global AuthGuard
 * (the caller is Resend, not a logged-in user); authenticity is the **Svix
 * signature** over the raw body, verified by `ResendInboundService` against
 * `RESEND_WEBHOOK_SECRET`.
 *
 * Resend delivers only metadata in the webhook; the body + full headers are
 * fetched via the Resend API before ingest. `@HttpCode(200)` because this is an
 * idempotent receiver — any 2xx stops Resend's retry schedule. A BAD SIGNATURE
 * surfaces as 401 (fail closed on auth); an UNPARSEABLE email is still
 * acknowledged 200 + logged so Resend doesn't retry a message we could never
 * turn into a ticket.
 *
 * Register in Resend → Webhooks: POST `<api-origin>/api/channels/email/inbound/resend`,
 * event `email.received`. The raw body this handler needs is attached by the
 * `bodyParser.rawBody` option on BetterAuthModule (NestJS's own rawBody option
 * has no effect under `bodyParser:false`).
 */
@ApiTags("inbound")
@Controller("channels/email/inbound/resend")
export class ResendInboundController {
  private readonly logger = new Logger(ResendInboundController.name);

  constructor(
    private readonly adapter: ResendInboundService,
    private readonly inbound: InboundMailService,
  ) {}

  @AllowAnonymous()
  @ApiOperation({ summary: "Resend inbound webhook — fetches email into a ticket (Svix-verified)" })
  @HttpCode(200)
  @Post()
  async receive(
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
  ): Promise<{ id?: number; created: boolean; appended: boolean }> {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString("utf8");
    if (!rawBody) {
      this.logger.error("Resend inbound: raw body missing — is bodyParser.rawBody enabled on BetterAuthModule?");
      throw new InternalServerErrorException("raw request body unavailable");
    }

    // Auth first — any failure here throws and propagates as 401 (bad signature)
    // or 500 (missing RESEND_WEBHOOK_SECRET). Resend retries on non-2xx; that's
    // correct for an unverifiable payload, and the secret-misconfig 500 makes a
    // deploy-time gap visible rather than silently accepting unsigned mail.
    const emailId = this.adapter.verifyReceivedEmail(rawBody, {
      id: headers["svix-id"],
      timestamp: headers["svix-timestamp"],
      signature: headers["svix-signature"],
    });

    let input: InboundEmailInput;
    try {
      input = await this.adapter.toInput(emailId);
    } catch (err) {
      // Valid mail, but we can't build a ticket from it — acknowledge 200 so
      // Resend stops retrying a message that would never succeed.
      this.logger.warn(
        `Resend inbound: dropped unparseable email ${emailId} — ${err instanceof Error ? err.message : err}`,
      );
      return { created: false, appended: false };
    }

    return this.inbound.ingest(input);
  }
}
