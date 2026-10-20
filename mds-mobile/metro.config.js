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
  input: path.resolve(__dirname, 'global.css'),
  configPath: path.resolve(__dirname, 'tailwind.config.js'),
  // The type reference and tsconfig include are already checked in. Loading Metro
  // from the repository root must not generate files in a different project.
  disableTypeScriptGeneration: true,
});
