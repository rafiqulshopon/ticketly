import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

// Errors only — no performance tracing or session replay. With VITE_SENTRY_DSN
// unset (local dev), `enabled` is false and the SDK makes no outbound calls.
// @sentry/react captures uncaught exceptions + unhandled promise rejections
// globally by default; the <Sentry.ErrorBoundary> below adds React
// component-stack context for render-time crashes.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});

// Single QueryClient for the app. Created at module scope so it persists across
// renders; defaults are fine for now (per-query options override where needed).
const queryClient = new QueryClient();

// Rendered when an error escapes a component below the boundary. Deliberately
// dependency-free (no hooks, no router, no queries) so it can't itself throw.
// Uses design tokens only — never hardcoded colors.
function SentryFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. The team has been notified.
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Sentry.ErrorBoundary fallback={<SentryFallback />}>
          <App />
        </Sentry.ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
