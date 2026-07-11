import { Text, View } from "react-native";
import { useSession, isAdmin } from "@/lib/auth";
import { Redirect } from "expo-router";

/** Dashboard (admin-only) — stub. Stat cards + the tickets-per-day chart
 *  (victory-native) arrive in M3. */
export default function DashboardScreen() {
  const { data: session } = useSession();
  if (!session || !isAdmin(session.user.role)) return <Redirect href="/(app)/tickets" />;
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text className="text-foreground">Dashboard — coming in M3</Text>
    </View>
  );
}
