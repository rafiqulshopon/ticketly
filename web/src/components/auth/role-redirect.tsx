import { Navigate } from "react-router-dom";
import { useSession } from "@/lib/auth";

/**
 * Role-aware landing route for `/`: admins go to the dashboard, agents go to the
 * ticket inbox (the dashboard is admin-only). Nested inside RequireAuth, so the
 * session is present by the time this renders; `isPending` is guarded anyway to
 * avoid a flash before the session resolves.
 */
export function RoleRedirect() {
  const { data: session, isPending } = useSession();
  if (isPending) return null;
  return <Navigate to={session?.user?.role === "admin" ? "/dashboard" : "/tickets"} replace />;
}
