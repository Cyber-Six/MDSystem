const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add support for resolving @mdsystem/core package
const extraNodeModules = {
  '@mdsystem/core': path.resolve(__dirname, '../packages/core/src'),
};

config.resolver.extraNodeModules = extraNodeModules;

// Allow packages in the core workspace package to resolve their dependencies
// from mds-mobile's node_modules (since packages/core has no node_modules).
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Watch the core package for changes (extend Expo's defaults)
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '../packages/core'),
];

module.exports = withNativeWind(config, {
  input: './global.css',
});
