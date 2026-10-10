'use strict';

// Required by the Electron main process: @qvac/sdk spawns its bare worker
// with no windowsHide. Patches spawn and spawnSync instead.
if (process.platform === 'win32') {
  const cp = require('node:child_process');
  const addWindowsHide = (options) =>
    options && typeof options === 'object' && options.windowsHide === undefined
      ? { ...options, windowsHide: true }
      : options;
  const originalSpawn = cp.spawn;
  cp.spawn = function windowsHiddenSpawn(command, args, options) {
    return originalSpawn.call(this, command, args, addWindowsHide(options));
  };
  const originalSpawnSync = cp.spawnSync;
  cp.spawnSync = function windowsHiddenSpawnSync(command, args, options) {
    return originalSpawnSync.call(this, command, args, addWindowsHide(options));
  };
}
