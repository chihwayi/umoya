const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable React Native new architecture Hermes bytecode caching
config.transformer.hermesCommand = 'hermes';

// Speed: use file system cache (persists between runs)
config.cacheStores = [
  {
    get: () => undefined,
    set: () => {},
    clear: () => {},
  },
];

// Inline requires for faster startup (lazy module loading)
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// SVG transformer — lets react-native-svg work cleanly
config.transformer.babelTransformerPath = require.resolve('metro-react-native-babel-transformer');

// Asset extensions
config.resolver.assetExts = [...config.resolver.assetExts, 'lottie'];
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;
