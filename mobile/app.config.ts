import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic app config, layered over the static app.json (Expo reads app.json first
 * and passes it in as `config`). Adds:
 *   - the `@sentry/react-native/expo` config plugin — source-map upload at EAS
 *     Build auto-reads SENTRY_AUTH_TOKEN/ORG/PROJECT from the build env; with the
 *     token unset it's a no-op (warnings only). Mirrors the web's gated
 *     `@sentry/vite-plugin`.
 *   - EAS Update wiring (expo-updates). The `REPLACE_WITH_PROJECT_ID` placeholders
 *     (updates.url + extra.eas.projectId) are written by `eas update:configure`.
 *   - `runtimeVersion.policy: "fingerprint"` so an OTA bundle is only delivered
 *     to a binary whose native layer matches (incompatible bundles are skipped).
 *
 * Keep app.json as the static source of truth (name/slug/version/icon/experiments);
 * only the env-driven/dynamic bits live here.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      "@sentry/react-native/expo",
      { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT },
    ],
  ],
  updates: {
    enabled: true,
    url: "https://u.expo.dev/REPLACE_WITH_PROJECT_ID",
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: { policy: "fingerprint" },
  extra: {
    ...config.extra,
    eas: { projectId: "REPLACE_WITH_PROJECT_ID" },
  },
} as ExpoConfig);
