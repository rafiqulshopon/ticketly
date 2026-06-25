import { Global, Module } from "@nestjs/common";
import { QueueService } from "./queue.service";

/**
 * Provides the global {@link QueueService} (a single pg-boss instance) so any
 * feature module can enqueue or work jobs without owning the connection config.
 * `@Global()` mirrors `PrismaModule`: import once in `AppModule`, inject anywhere.
 */
@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
