import { Module } from "@nestjs/common";
import { auth } from "./auth.config";

/** Token used to inject the Better Auth instance app-wide. */
export const AUTH_INSTANCE = "AUTH_INSTANCE";

/**
 * Provides the Better Auth instance. Phase 1 will add:
 *  - a controller mounting `auth.handler` at /api/auth/*
 *  - a session/role guard (via @thallesp/nestjs-better-auth)
 */
@Module({
  providers: [{ provide: AUTH_INSTANCE, useValue: auth }],
  exports: [AUTH_INSTANCE],
})
export class AuthModule {}
