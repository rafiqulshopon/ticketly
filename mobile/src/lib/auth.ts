// Better Auth client for React Native (Expo). Same `better-auth/react` client as
// the web (so `useSession()` is a reactive hook that re-renders on sign-in/out),
// plus the @better-auth/expo `expoClient` plugin: it persists the session cookie
// in expo-secure-store (Keychain / EncryptedSharedPreferences) and exposes
// `getCookie()` so we can attach it as a `Cookie` header to axios + SSE requests
// — RN has no browser cookie jar. The server side enables this via the `expo()`
// plugin in api/src/auth/auth.config.ts; the web is unaffected.
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

/**
 * Full backend origin (no /api suffix). Unlike the web there's no dev proxy on a
 * device, so this must be reachable: http://localhost:3000 on the simulator, the
 * dev machine's LAN IP for a physical device, or the Railway URL in production.
 */
export const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: API_ORIGIN,
  plugins: [
    adminClient(),
    expoClient({
      scheme: "ticketly",
      storagePrefix: "ticketly",
      storage: SecureStore,
    }),
  ],
});

export const { signIn, signOut, useSession } = authClient;

/** A role is `admin` if it's the string "admin" or an array containing "admin"
 *  (Better Auth's admin plugin may return roles as an array). Mirrors the
 *  backend's toCaller() in api/src/tickets/tickets.controller.ts. */
export function isAdmin(role: unknown): boolean {
  return Array.isArray(role) ? role.includes("admin") : role === "admin";
}
