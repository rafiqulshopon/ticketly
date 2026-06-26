import { Module } from "@nestjs/common";
import { OutboundMailService } from "./outbound-mail.service";

/**
 * Standalone outbound-mail module so {@link OutboundMailService} can be imported
 * by TicketsModule without creating a cycle: EmailChannelModule already imports
 * TicketsModule (the inbound webhook delegates to TicketsService), so the outbound
 * service must NOT live behind EmailChannelModule. This module depends on nothing
 * in the tickets layer — it's a leaf provider wrapping the `resend` SDK.
 */
@Module({
  providers: [OutboundMailService],
  exports: [OutboundMailService],
})
export class OutboundMailModule {}
