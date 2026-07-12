import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic app config, layered over the static app.json (Expo reads app.json first
 * and passes it in as `config`). Adds:
 *   - the `@sentry/react-native/expo` config plugin (native crash capture + EAS
 *     Build source-map upload) — applied only when SENTRY_AUTH_TOKEN is in the
 *     build env. Without it the plugin's gradle upload task fails the build
 *     ("An organization ID or slug is required"); runtime Sentry.init in
 *     src/lib/sentry.ts still captures JS errors via EXPO_PUBLIC_SENTRY_DSN.
 *     Mirrors the web's gated `@sentry/vite-plugin`.
 *   - EAS Update wiring (expo-updates). The projectId is written by `eas init` /
 *     `eas update:configure` into app.json (`extra.eas.projectId`) and surfaced
 *     here via `config.extra`. `updates.url` is derived from it, so there is no
 *     literal placeholder to keep in sync (the old `REPLACE_WITH_PROJECT_ID` made
 *     `eas init` reject the config as an "Invalid UUID appId").
 *   - `runtimeVersion.policy: "fingerprint"` so an OTA bundle is only delivered
 *     to a binary whose native layer matches (incompatible bundles are skipped).
 *
 * Keep app.json as the static source of truth (name/slug/version/icon/experiments);
 * only the env-driven/dynamic bits live here.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = config.extra?.eas?.projectId as string | undefined;

  // The `@sentry/react-native/expo` plugin adds native crash capture AND a gradle
  // source-map upload task. That upload task runs unconditionally once the plugin
  // is applied and fails the build ("An organization ID or slug is required")
  // when SENTRY_AUTH_TOKEN/ORG/PROJECT aren't in the build env — so only apply it
  // when an auth token is present. Without it, runtime Sentry.init in
  // src/lib/sentry.ts still captures JS errors via EXPO_PUBLIC_SENTRY_DSN.
  const plugins = [...(config.plugins ?? [])];
  if (process.env.SENTRY_AUTH_TOKEN) {
    plugins.push([
      "@sentry/react-native/expo",
      { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT },
    ]);
  }

  return {
    ...config,
    plugins,
    updates: {
      enabled: true,
      url: projectId ? `https://u.expo.dev/${projectId}` : config.updates?.url,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: { policy: "fingerprint" },
    extra: {
      ...config.extra,
      eas: { projectId },
    },
  } as ExpoConfig;
};
