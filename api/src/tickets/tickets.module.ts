import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ClassifyTicketConsumer } from "./tickets.classify-consumer";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  imports: [AiModule],
  controllers: [TicketsController],
  providers: [TicketsService, ClassifyTicketConsumer],
  exports: [TicketsService],
})
export class TicketsModule {}
