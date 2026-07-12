// Learn more https://docs.expo.dev/guides/monorepos/ — but the gist:
//   1. Let Metro see the `shared/` workspace (one dir up) so its TypeScript
//      source is watched and hot-reloads. RN has no Vite proxy; Metro must
//      watch shared directly.
//   2. Resolve `@ticketly/shared` to its TS *source* (extraNodeModules), not
//      the built shared/dist. The dist is CommonJS and trips the
//      "does not provide an export named" error the web avoids with a dev
//      alias. Pointing at source sidesteps it AND hot-reloads. shared is pure
//      Zod + types (no Node APIs), so bundling its source is safe in prod too.
//   3. Let Metro resolve hoisted deps from the repo-root node_modules as well
//      as this workspace's own.
//   4. withNativeWind compiles src/global.css into the RN stylesheet bridge.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(projectRoot, "../shared")];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(projectRoot, "../../node_modules"),
];
config.resolver.extraNodeModules = {
  "@ticketly/shared": path.resolve(projectRoot, "../shared/src"),
};

// NOTE on Sentry: the @sentry/react-native v7 metro wrapper (`withSentryConfig`)
// was tried here but crashes `expo export`/bundling with an opaque
// "Cannot read properties of undefined (reading 'match')" — an incompatibility
// with this Metro + SDK-57 combo (it fails even with all optional features off,
// so it's in the always-on serializer/resolver, not something we can configure
// away). The metro wrapper is NOT required for the M4 deliverable: Sentry.init
// in src/lib/sentry.ts captures crashes, and source maps are uploaded at EAS
// Build time by the `@sentry/react-native/expo` config plugin in app.config.ts.
// Revisit the metro wrapper (it adds in-band debug IDs for OTA symbolication)
// once @sentry/react-native and Expo SDK 57 realign.
module.exports = withNativeWind(config, { input: "./src/global.css" });
