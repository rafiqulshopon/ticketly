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

module.exports = withNativeWind(config, { input: "./src/global.css" });
