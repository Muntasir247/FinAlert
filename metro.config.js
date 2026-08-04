const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js v2 and its transitive dep @supabase/realtime-js use
// private class fields (#field) in their compiled output.  Hermes cannot
// parse these unless Babel transforms them first.  The default Metro config
// skips all of node_modules; this pattern adds @supabase/* as an exception
// so those packages are run through the Babel transformer.
config.transformer.transformIgnorePatterns = [
  'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@supabase/.*|nativewind))',
];

module.exports = withNativeWind(config, { input: "./global.css" });

