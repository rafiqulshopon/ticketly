import { Redirect, Slot } from "expo-router";
import { useSession } from "@/lib/auth";

/** Auth group — if already signed in, bounce to the app. The session is cached
 *  in SecureStore by the expoClient plugin, so there's no loading spinner on
 *  reload (the cached session resolves synchronously). */
export default function AuthLayout() {
  const { data: session, isPending } = useSession();
  if (isPending) return null;
  if (session) return <Redirect href="/(app)/tickets" />;
  return <Slot />;
}
