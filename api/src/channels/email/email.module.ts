import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { TicketsModule } from "../../tickets/tickets.module";
import { InboundMailController } from "./inbound-mail.controller";
import { InboundMailService } from "./inbound-mail.service";
import { SendGridInboundController } from "./sendgrid-inbound.controller";
import { SendGridInboundService } from "./sendgrid-inbound.service";

@Module({
  // memoryStorage keeps SendGrid's multipart parts in memory (no temp files on
  // disk) — we never persist attachments, only the parsed text fields, so the
  // buffers are discarded after the request. AnyFilesInterceptor() on the
  // SendGrid route reads these options automatically. The JSON inbound route is
  // unaffected (no multer interceptor on it).
  imports: [
    TicketsModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024, // per file: raw MIME (send_raw) or attachment
        fieldSize: 5 * 1024 * 1024, // per text field: large HTML bodies
        fields: 50,
        files: 20,
      },
    }),
  ],
  controllers: [InboundMailController, SendGridInboundController],
  providers: [InboundMailService, SendGridInboundService],
})
export class EmailChannelModule {}
