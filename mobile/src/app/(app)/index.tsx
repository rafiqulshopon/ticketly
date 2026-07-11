import { Redirect } from "expo-router";
import { useSession, isAdmin } from "@/lib/auth";

/** Landing redirect — admins land on the dashboard, agents on the ticket queue.
 *  Mirrors the web's RoleRedirect. Hidden from the tab bar (see (app)/_layout). */
export default function Index() {
  const { data: session } = useSession();
  const admin = session ? isAdmin(session.user.role) : false;
  return <Redirect href={admin ? "/(app)/dashboard" : "/(app)/tickets"} />;
}
