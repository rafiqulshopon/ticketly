import { Module } from "@nestjs/common";
import { TicketsModule } from "../../tickets/tickets.module";
import { InboundMailController } from "./inbound-mail.controller";
import { InboundMailService } from "./inbound-mail.service";

@Module({
  imports: [TicketsModule],
  controllers: [InboundMailController],
  providers: [InboundMailService],
})
export class EmailChannelModule {}
