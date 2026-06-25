import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AutoResolveTicketConsumer } from "./tickets.auto-resolve-consumer";
import { ClassifyTicketConsumer } from "./tickets.classify-consumer";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";

@Module({
  imports: [AiModule],
  controllers: [TicketsController],
  providers: [TicketsService, ClassifyTicketConsumer, AutoResolveTicketConsumer],
  exports: [TicketsService],
})
export class TicketsModule {}
