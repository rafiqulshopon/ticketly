import { Redirect, Tabs } from "expo-router";
import { Bell, Inbox, LayoutDashboard, Users } from "lucide-react-native";
import { useSession, isAdmin } from "@/lib/auth";
import { useIconColor } from "@/lib/colors";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";

/** Authenticated shell — the analog of the web's RequireAuth + AppLayout.
 *  Guards: no session → login. The realtime SSE hook is mounted here (it
 *  self-gates on the session), so the stream opens at sign-in and closes at
 *  sign-out. Admin-only tabs (Dashboard, Users) are hidden from non-admins.
 *  The Notifications tab carries a live unread-count badge (polled every 30s by
 *  use-notifications + refreshed on realtime SSE events). */
export default function AppLayout() {
  // All hooks run unconditionally, before any early return (Rules of Hooks).
  const { data: session, isPending } = useSession();
  useRealtimeEvents();
  const unread = useUnreadNotificationCount();
  const activeTint = useIconColor("primary");
  const inactiveTint = useIconColor("muted");

  if (isPending) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  const admin = isAdmin(session.user.role);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
      }}
    >
      {/* RoleRedirect — hidden from the tab bar; the initial route. */}
      <Tabs.Screen name="index" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          href: admin ? undefined : null,
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Tickets",
          tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: "Users",
          href: admin ? undefined : null,
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
          // `undefined` hides the badge when there's nothing unread.
          tabBarBadge: unread || undefined,
        }}
      />
    </Tabs>
  );
}
