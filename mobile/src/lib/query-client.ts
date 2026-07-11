import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

/**
 * Single QueryClient for the app. Same retry policy as the web: don't retry HTTP
 * errors (a 404/403 won't fix itself), but do retry transient network failures
 * twice. `refetchOnWindowFocus` is a no-op on RN but explicitly off for parity.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => !(error instanceof ApiError) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
