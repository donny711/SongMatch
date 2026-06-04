// iOS 26 crash prevention entry point.
//
// Problem: on iOS 26, ANY fatal JS error triggers RCTFatal which throws an
// ObjC exception across the TurboModule C++ boundary, calling std::terminate.
// React Native's ExceptionsManager calls setGlobalHandler() to install its own
// handler that forwards to RCTFatal. Simply setting our own handler doesn't work
// because ExceptionsManager overwrites it.
//
// Solution: monkey-patch setGlobalHandler so that ANY handler installed by React
// Native (or anyone) gets wrapped. Fatal errors are logged but never forwarded
// to the original handler, preventing the RCTFatal crash path.
if (global.ErrorUtils) {
  const _origSet = global.ErrorUtils.setGlobalHandler.bind(global.ErrorUtils);
  global.ErrorUtils.setGlobalHandler = (handler) => {
    _origSet((error, isFatal) => {
      if (isFatal) {
        console.error('[SongMatch] FATAL JS ERROR (swallowed):', error?.message);
        console.error('[SongMatch] STACK:', error?.stack?.slice(0, 2000));
        return;
      }
      handler(error, isFatal);
    });
  };
}

require('expo-router/entry');
