import { Redirect, Tabs } from "expo-router";
import { useSession, isAdmin } from "@/lib/auth";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";

/** Authenticated shell — the analog of the web's RequireAuth + AppLayout.
 *  Guards: no session → login. The realtime SSE hook is mounted here (it
 *  self-gates on the session), so the stream opens at sign-in and closes at
 *  sign-out. Admin-only tabs (Dashboard, Users) are hidden from non-admins. */
export default function AppLayout() {
  const { data: session, isPending } = useSession();
  useRealtimeEvents();

  if (isPending) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  const admin = isAdmin(session.user.role);

  return (
    <Tabs screenOptions={{ headerShown: true }}>
      {/* RoleRedirect — hidden from the tab bar; the initial route. */}
      <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="tickets" options={{ title: "Tickets" }} />
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", href: admin ? undefined : null }} />
      <Tabs.Screen name="users" options={{ title: "Users", href: admin ? undefined : null }} />
      <Tabs.Screen name="notifications" options={{ title: "Alerts" }} />
    </Tabs>
  );
}
