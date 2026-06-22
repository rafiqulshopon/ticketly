import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { auth } from "./auth/auth.config";

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
    PrismaModule,
    UsersModule,
    BetterAuthModule.forRoot({
      auth,
      // We apply CORS globally in main.ts; tell the library not to add its own
      // trustedOrigins CORS layer to avoid duplicate headers. (trustedOrigins is
      // still set in auth.config.ts for Better Auth's origin/CSRF check.)
      disableTrustedOriginsCors: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
