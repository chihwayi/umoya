// Fix (2026-09-04) — this config was missing babel-preset-expo entirely, so
// Metro could never strip React Native's internal Flow type syntax
// (react-native/index.js has `import typeof * as X from './index.js.flow'`,
// a Flow-only construct meant to be erased, not resolved as a real module).
// Every attempt to actually run this app through Metro failed with "Unable
// to resolve module ./index.js.flow" as a result — this app has apparently
// never been run via `expo start`/Metro in this codebase's history.
module.exports = {
  presets: ["babel-preset-expo"],
  plugins: [
    // react-native-reanimated v4's babel plugin moved to react-native-worklets;
    // must be listed last per Reanimated's own setup docs.
    "react-native-worklets/plugin",
  ],
};
