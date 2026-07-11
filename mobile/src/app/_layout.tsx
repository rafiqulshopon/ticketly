import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { queryClient } from "@/lib/query-client";

/**
 * Root layout — providers only. The (auth) and (app) route groups each have
 * their own _layout (the login screen / the authenticated tab shell). Toast must
 * be mounted once at the root so the realtime hook's Toast.show() has a host.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
      <Toast />
    </QueryClientProvider>
  );
}
