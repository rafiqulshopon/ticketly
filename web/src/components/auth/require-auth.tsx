import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "@/lib/auth";

/**
 * Layout route that gates authenticated pages behind a Better Auth session.
 * `useSession()` is reactive (better-auth/react): `isPending` covers the initial
 * /api/auth/get-session fetch so we don't flash a redirect before we know.
 */
export function RequireAuth() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
