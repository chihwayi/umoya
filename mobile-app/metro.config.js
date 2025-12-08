const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const rootPath = path.resolve(__dirname);
const rootNodeModules = path.resolve(rootPath, 'node_modules');
const parentNodeModules = path.resolve(rootPath, '..', 'node_modules');

const config = {
  watchFolders: [
    rootPath,
    path.resolve(rootPath, '..'),
  ],
  resolver: {
    // CRITICAL: Only resolve from mobile-app node_modules to prevent duplicate React
    nodeModulesPaths: [
      rootNodeModules,
    ],
    // Block React from parent node_modules to prevent duplicate instances
    blockList: [
      new RegExp(path.resolve(parentNodeModules, 'react', '.*').replace(/\\/g, '/')),
    ],
    // Force ALL React-related packages to resolve from mobile-app
    extraNodeModules: {
      'react': path.resolve(rootNodeModules, 'react'),
      'react-native': path.resolve(rootNodeModules, 'react-native'),
      'react-redux': path.resolve(rootNodeModules, 'react-redux'),
      '@reduxjs/toolkit': path.resolve(rootNodeModules, '@reduxjs/toolkit'),
    },
    resolverMainFields: ['react-native', 'browser', 'main'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);


