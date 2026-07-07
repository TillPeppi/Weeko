const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// PowerSync (native) — disable inline requires for @powersync/react-native to
// avoid "Super expression must either be null or a function" (docs/POWERSYNC_SETUP.md).
config.transformer = config.transformer || {};
const prevGetTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  const base = prevGetTransformOptions ? await prevGetTransformOptions(...args) : {};
  return {
    ...base,
    transform: {
      ...(base.transform || {}),
      inlineRequires: {
        blockList: {
          ...((base.transform && base.transform.inlineRequires && base.transform.inlineRequires.blockList) || {}),
          [require.resolve('@powersync/react-native')]: true,
        },
      },
    },
  };
};

// wa-sqlite (PowerSync web + expo-sqlite) ships a wasm build (OPFS/SharedArrayBuffer)
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
