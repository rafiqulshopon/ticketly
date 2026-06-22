// better-auth/react (not /client) is required so useSession is a reactive
// React hook that re-renders on sign-in/sign-out.
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

/**
 * Better Auth browser client. In dev, /api is proxied to the backend
 * (vite.config.ts) so baseURL stays same-origin. Set VITE_API_URL in production
 * when frontend and API are on different origins.
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || undefined,
  plugins: [adminClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
