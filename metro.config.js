const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @protobufjs/inquire uses eval() which crashes Hermes in production builds.
// Firebase Firestore depends on it. We replace it with a no-op that always
// returns null (the same result it returns when require() fails anyway).
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@protobufjs/inquire': path.resolve(__dirname, 'src/utils/protobufjs-inquire-noop.js'),
};

module.exports = config;
