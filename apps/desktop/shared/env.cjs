// Every environment variable the desktop main process reads. Getters, so a test
// that sets one before the call still sees it. Values the app writes for the SDK
// (QVAC_CONFIG_PATH) are not config and are not read here.
'use strict';

const read = (name) => {
  const value = process.env[name];
  return value && value.trim() ? value : null;
};

module.exports = Object.freeze({
  // Linux session and config dirs, unset on headless or minimal setups.
  xdgCurrentDesktop: () => read('XDG_CURRENT_DESKTOP'),
  xdgConfigHome: () => read('XDG_CONFIG_HOME'),
  // Set by the AppImage runtime to the image's own path.
  appImage: () => read('APPIMAGE'),
  // With --dev only: load the page from this server instead of the static build.
  devUrl: () => read('PEAR_DEV_URL'),
  openDevTools: () => read('PEAR_DEV_SERVER_URL') !== null || process.env.NODE_ENV === 'development',
  // Tests: never download a model.
  noDirectFetch: () => process.env.STUDIO_NO_DIRECT_FETCH === '1',
});
