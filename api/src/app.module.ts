import { existsSync } from "node:fs";
import path from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { ServeStaticModule } from "@nestjs/serve-static";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { SystemAgentModule } from "./system-agent/system-agent.module";
import { EmailChannelModule } from "./channels/email/email.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { TicketsModule } from "./tickets/tickets.module";
import { UsersModule } from "./users/users.module";
import { auth } from "./auth/auth.config";

/**
 * Production single-origin deploy: the Docker build copies the compiled SPA
 * (`web/dist`) to `<repo>/api/public`, and this serves it from the same origin
 * as the API — so Better Auth session cookies ride same-origin with no CORS /
 * SameSite headaches. Resolved relative to the compiled `dist/main` (not
 * process.cwd()) so it's stable regardless of where the process is launched.
 * In dev the dir doesn't exist (Vite serves the SPA), so the module isn't
 * registered and the dev server is untouched.
 */
const SPA_ROOT = path.resolve(__dirname, "..", "public");
const spaModule = existsSync(SPA_ROOT)
  ? [
      ServeStaticModule.forRoot({
        rootPath: SPA_ROOT,
        // Never let the static catch-all shadow API, Better Auth (/api/auth/*),
        // Swagger (/api/docs), or health routes — those stay owned by Nest.
        exclude: ["/api/(.*)", "/health"],
      }),
    ]
  : [];

/**
 * Better Auth is mounted by the library: it exposes /api/auth/* as middleware
 * (toNodeHandler, which bypasses the controller-layer guard so sign-up/sign-in
 * work without a session), re-adds body parsers for other routes (main.ts sets
 * bodyParser: false), and registers a global AuthGuard. Public routes opt out
 * with @AllowAnonymous(); routes without it throw 401 when there's no session.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Serves the built SPA in production; empty array in dev (no public/ dir).
    ...spaModule,
    PrismaModule,
    QueueModule,
    SystemAgentModule,
    UsersModule,
    TicketsModule,
    DashboardModule,
    NotificationsModule,
    RealtimeModule,
    EmailChannelModule,
    BetterAuthModule.forRoot({
      auth,
      // We apply CORS globally in main.ts; tell the library not to add its own
      // trustedOrigins CORS layer to avoid duplicate headers. (trustedOrigins is
      // still set in auth.config.ts for Better Auth's origin/CSRF check.)
      disableTrustedOriginsCors: true,
      // Attach the raw request buffer to req.rawBody so the Resend inbound
      // webhook can verify Svix signatures over the unparsed body. main.ts runs
      // with bodyParser:false (Better Auth re-adds JSON/urlencoded parsing), so
      // NestJS's own `rawBody: true` has no effect — this library option is the
      // supported way to get the raw body.
      bodyParser: { rawBody: true },
    }),
  ],
  controllers: [AppController],
  providers: [
    // Captures every unhandled route/controller exception to Sentry. Listed as
    // the sole global filter (no pre-existing catch-all to preserve).
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    AppService,
  ],
})
export class AppModule {}
