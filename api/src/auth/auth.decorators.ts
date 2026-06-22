import { SetMetadata } from "@nestjs/common";

export const IS_AUTHENTICATED_KEY = "isAuthenticated";

/**
 * Explicitness marker: "any logged-in user may access".
 *
 * Has NO runtime effect on its own — the global `AuthGuard` (registered by
 * `@thallesp/nestjs-better-auth`) already rejects every request that lacks a
 * session, except handlers marked `@AllowAnonymous()`. This decorator only sets
 * metadata so the `ticketly/require-auth-decision` ESLint rule can enforce that
 * every route handler declares its access level:
 *
 *   @AllowAnonymous()                  public — no session required
 *   @Authenticated()                   any authenticated user (this marker)
 *   @Roles(["admin"]) / @OrgRoles(..)  role / org-restricted
 *   @OptionalAuth()                    public, session populated if present
 *
 * Use it (or `@Roles(...)`) on every "requires login" endpoint so an admin-only
 * handler can never accidentally ship as merely "authenticated" and be reachable
 * by an agent. The decision may be placed on the method or the controller class.
 */
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_KEY, true);
