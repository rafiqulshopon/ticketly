// NativeWind v4 requires the nativewind/babel preset and jsxImportSource so that
// `className` is recognized on React Native primitives. babel-preset-expo still
// drives the rest of the transform (incl. the React Compiler experiment in
// app.json). SDK 57's default template ships without a babel config; adding one
// re-enables the babel pipeline Metro falls back to when this file is present.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
