import { Module } from "@nestjs/common";
import { TicketsModule } from "../../tickets/tickets.module";
import { InboundMailController } from "./inbound-mail.controller";
import { InboundMailService } from "./inbound-mail.service";
import { ResendInboundController } from "./resend-inbound.controller";
import { ResendInboundService } from "./resend-inbound.service";

@Module({
  // Resend posts a JSON webhook (no multipart), so no MulterModule is needed
  // here. The multipart config was only needed for the previous (now-removed)
  // multipart inbound provider; both current inbound routes are plain JSON. The
  // JSON inbound route reads its body via the global JSON parser re-added by
  // Better Auth; the Resend route reads the raw body (req.rawBody, attached via
  // BetterAuthModule's rawBody option) for Svix signature verification.
  imports: [TicketsModule],
  controllers: [InboundMailController, ResendInboundController],
  providers: [InboundMailService, ResendInboundService],
})
export class EmailChannelModule {}
