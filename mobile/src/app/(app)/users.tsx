import { Text, View } from "react-native";
import { useSession, isAdmin } from "@/lib/auth";
import { Redirect } from "expo-router";

/** Users (admin-only) — stub. The directory + create/edit/delete arrive in M3. */
export default function UsersScreen() {
  const { data: session } = useSession();
  if (!session || !isAdmin(session.user.role)) return <Redirect href="/(app)/tickets" />;
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text className="text-foreground">Users — coming in M3</Text>
    </View>
  );
}
