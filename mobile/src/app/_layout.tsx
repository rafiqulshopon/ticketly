import "@/lib/sentry"; // FIRST — side-effectful Sentry.init, before any component can throw
import "@/global.css";
import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { queryClient } from "@/lib/query-client";
import { SentryErrorFallback } from "@/components/sentry-error-fallback";

/**
 * Root layout — providers only. The (auth) and (app) route groups each have
 * their own _layout (the login screen / the authenticated tab shell). Toast must
 * be mounted once at the root so the realtime hook's Toast.show() has a host.
 *
 * The Sentry ErrorBoundary wraps the navigation tree (inside QueryClientProvider,
 * outside Toast) so a render crash shows the terminal fallback but leaves the
 * toast host mounted. Mirrors web/src/main.tsx's boundary placement.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Sentry.ErrorBoundary fallback={<SentryErrorFallback />}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
      </Sentry.ErrorBoundary>
      <Toast />
    </QueryClientProvider>
  );
}
