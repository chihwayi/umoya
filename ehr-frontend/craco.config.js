const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Enable hot reloading
      if (env === 'development') {
        webpackConfig.devServer = {
          ...webpackConfig.devServer,
          host: '0.0.0.0',
          port: 3000,
          hot: true,
          liveReload: true,
          watchFiles: {
            paths: ['src/**/*', 'public/**/*'],
            options: {
              usePolling: true,
              interval: 1000,
            },
          },
          client: {
            webSocketURL: process.env.WDS_SOCKET_URL,
          },
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
          },
        };

        // Filter out TypeScript extension warnings
        const ForkTsCheckerWebpackPlugin = webpackConfig.plugins.find(
          plugin => plugin.constructor.name === 'ForkTsCheckerWebpackPlugin'
        );
        
        if (ForkTsCheckerWebpackPlugin) {
          ForkTsCheckerWebpackPlugin.options.typescript = {
            ...ForkTsCheckerWebpackPlugin.options.typescript,
            diagnosticOptions: {
              semantic: true,
              syntactic: true,
            },
            mode: 'write-references',
          };
        }
      }
      return webpackConfig;
    },
  },
  devServer: {
    host: '0.0.0.0',
    port: 3000,
    hot: true,
    liveReload: true,
    watchFiles: {
      paths: ['src/**/*', 'public/**/*'],
      options: {
        usePolling: true,
        interval: 1000,
      },
    },
    client: {
      webSocketURL: process.env.WDS_SOCKET_URL || 'ws://localhost:3014/ws',
    },
  },
  typescript: {
    enableTypeChecking: false, // Disable TypeScript checking to reduce noise
  },
  eslint: {
    enable: false, // Disable ESLint to reduce noise
  },
};
