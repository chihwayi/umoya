const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Enable top-level await support
      webpackConfig.experiments = {
        ...webpackConfig.experiments,
        topLevelAwait: true,
      };

      // Workaround for webpack 5 issues with react-scripts 5
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "crypto": false,
        "stream": false,
        "assert": false,
        "http": false,
        "https": false,
        "os": false,
        "url": false
      };

      return webpackConfig;
    },
  },
};
