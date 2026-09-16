module.exports = {
  webpack: {
    configure: (webpackConfig, { env }) => {
      // Strip console.* calls from production bundles — CRA's default
      // Terser config does NOT do this, so error objects/response payloads
      // logged during development (some of which can include patient data)
      // otherwise ship straight into every user's browser console.
      if (env === 'production') {
        for (const plugin of webpackConfig.optimization?.minimizer || []) {
          if (plugin?.constructor?.name !== 'TerserPlugin') continue;
          // terser-webpack-plugin v5 nests terserOptions under
          // options.minimizer.options; older/alt shapes may expose
          // options.terserOptions directly — set drop_console wherever the
          // compress block actually lives.
          const compress =
            plugin.options?.minimizer?.options?.compress ??
            plugin.options?.terserOptions?.compress;
          if (compress) compress.drop_console = true;
        }
      }

      return webpackConfig;
    },
  },
};
