const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web ships a wasm build (OPFS/SharedArrayBuffer)
config.resolver.assetExts.push('wasm');

// SharedArrayBuffer (needed by wa-sqlite on web) requires cross-origin isolation
config.server = config.server || {};
const prevEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = prevEnhance ? prevEnhance(middleware, server) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    enhanced(req, res, next);
  };
};

module.exports = withNativeWind(config, { input: './src/global.css' });
