module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Keep dev server responsive in Docker by skipping heavy TS type-check worker.
      webpackConfig.plugins = (webpackConfig.plugins || []).filter(
        (plugin) => plugin?.constructor?.name !== 'ForkTsCheckerWebpackPlugin',
      );

      // Enable top-level await support
      webpackConfig.experiments = {
        ...webpackConfig.experiments,
        topLevelAwait: true,
      };

      return webpackConfig;
    },
  },
};
