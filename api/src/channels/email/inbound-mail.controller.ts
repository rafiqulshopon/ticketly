import { BadRequestException, Body, Controller, Headers, HttpCode, Post } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { inboundEmailSchema, type InboundEmailInput } from "./inbound-mail.service";
import { InboundMailService } from "./inbound-mail.service";

/**
 * Public inbound-email webhook. `@AllowAnonymous` opts out of the global
 * AuthGuard (the caller is a server, not a logged-in user); authenticity is
 * enforced by the X-Webhook-Token shared secret inside InboundMailService.
 * `@HttpCode(200)` because this is an idempotent webhook receiver, not a create.
 */
@ApiTags("inbound")
@Controller("channels/email/inbound")
export class InboundMailController {
  constructor(private readonly inbound: InboundMailService) {}

  @AllowAnonymous()
  @ApiOperation({ summary: "Inbound email webhook — creates a ticket (token-verified)" })
  @HttpCode(200)
  @Post()
  receive(@Body() body: unknown, @Headers("x-webhook-token") token?: string) {
    let input: InboundEmailInput;
    try {
      input = inboundEmailSchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid inbound payload");
    }
    return this.inbound.handle(token, input);
  }
}
