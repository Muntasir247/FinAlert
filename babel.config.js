module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // babel-preset-expo with jsxImportSource enables NativeWind className support
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Do NOT add react-native-reanimated/plugin here.
    // Reanimated v4 (SDK 54) uses react-native-worklets which registers
    // the worklet plugin automatically. Adding it again causes a duplicate error.
  };
};

