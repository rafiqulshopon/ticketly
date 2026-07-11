import { Redirect } from "expo-router";
import { useSession, isAdmin } from "@/lib/auth";

/** Landing redirect — admins land on the dashboard, agents on the ticket queue.
 *  Mirrors the web's RoleRedirect. Hidden from the tab bar (see (app)/_layout).
 *
 *  No `isPending` guard is needed here, unlike in `_layout.tsx`: this screen only
 *  mounts once the layout has already resolved the session (it gates on
 *  `isPending` / `!session` before rendering any `(app)` child). The `session ?`
 *  below is a defensive fallback, not a loading state. */
export default function Index() {
  const { data: session } = useSession();
  const admin = session ? isAdmin(session.user.role) : false;
  return <Redirect href={admin ? "/(app)/dashboard" : "/(app)/tickets"} />;
}
