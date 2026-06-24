import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";

/**
 * Server-side AI capabilities (GLM via the Vercel AI SDK). Exports `AiService` so
 * feature modules (e.g. TicketsModule) can call it without owning the provider
 * config. This is the home for the planned classify / summarize / RAG steps.
 */
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
