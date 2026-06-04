const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @protobufjs/inquire uses eval() which crashes Hermes in production builds
// on iOS 26. Firebase Firestore depends on protobufjs which requires it.
// We use resolveRequest (not extraNodeModules, which is only a fallback and
// does NOT override existing packages) to redirect to a no-op module.
const inquireNoop = path.resolve(__dirname, 'src/utils/protobufjs-inquire-noop.js');
const origResolveRequest = config.resolver?.resolveRequest;
config.resolver = {
  ...config.resolver,
  resolveRequest(context, moduleName, platform) {
    if (moduleName === '@protobufjs/inquire') {
      return { type: 'sourceFile', filePath: inquireNoop };
    }
    if (origResolveRequest) {
      return origResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
