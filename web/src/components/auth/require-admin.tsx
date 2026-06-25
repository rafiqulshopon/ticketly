import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "@/lib/auth";

/**
 * Layout route that gates pages behind an **admin** session. Nest it inside
 * RequireAuth (which already redirects unauthenticated users to /login).
 * Authenticated non-admins are bounced to /tickets rather than shown a 403.
 */
export function RequireAdmin() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (session?.user?.role !== "admin") {
    return <Navigate to="/tickets" replace />;
  }

  return <Outlet />;
}
