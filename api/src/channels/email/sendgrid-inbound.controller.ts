import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { InboundMailService } from "./inbound-mail.service";
import { SendGridInboundService } from "./sendgrid-inbound.service";

/**
 * SendGrid Inbound Parse webhook. `@AllowAnonymous` opts out of the global
 * AuthGuard (the caller is SendGrid, not a logged-in user); authenticity is the
 * shared secret in the URL path — SendGrid can't set custom request headers, so
 * the token lives in `:token` and is verified by `InboundMailService` against
 * `INBOUND_EMAIL_WEBHOOK_TOKEN` (the same secret the JSON webhook uses).
 *
 * `@HttpCode(200)` because this is an idempotent receiver: any 2xx stops
 * SendGrid's retry schedule. A parseable payload with a valid token returns the
 * ingest result; an UNPARSEABLE payload (missing requester/body) is still
 * acknowledged 200 + logged so SendGrid doesn't retry a message we could never
 * turn into a ticket — but a BAD TOKEN surfaces as 403 (fail closed on auth).
 */
@ApiTags("inbound")
@Controller("channels/email/inbound/sendgrid")
export class SendGridInboundController {
  private readonly logger = new Logger(SendGridInboundController.name);

  constructor(
    private readonly adapter: SendGridInboundService,
    private readonly inbound: InboundMailService,
  ) {}

  @AllowAnonymous()
  @ApiOperation({ summary: "SendGrid Inbound Parse webhook — parses email into a ticket (path-token-verified)" })
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
  @Post(":token")
  async receive(
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: Express.Multer.File[],
    @Param("token") token: string,
  ): Promise<{ id?: number; created: boolean; appended: boolean }> {
    let input;
    try {
      input = this.adapter.parse(body, files);
    } catch (err) {
      // Couldn't build a valid ticket from this email — acknowledge so SendGrid
      // stops retrying it (it would never succeed), and log for visibility.
      this.logger.warn(
        `SendGrid inbound: dropped unparseable payload — ${err instanceof Error ? err.message : err}`,
      );
      return { created: false, appended: false };
    }
    // ForbiddenException (bad token) propagates as 403; a good token returns the
    // idempotent ingest result { id, created, appended }.
    return this.inbound.handle(token, input);
  }
}
