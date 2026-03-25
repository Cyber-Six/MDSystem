const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add support for resolving @mdsystem/core package
const extraNodeModules = {
  '@mdsystem/core': path.resolve(__dirname, '../packages/core/src'),
};

config.resolver.extraNodeModules = extraNodeModules;

// Watch the core package for changes (extend Expo's defaults)
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '../packages/core'),
];

module.exports = withNativeWind(config, {
  input: './global.css',
});
