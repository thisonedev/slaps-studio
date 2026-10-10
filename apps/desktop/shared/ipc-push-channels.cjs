// Channels main.js pushes to the page with sendToAll and preload.js
// subscribes to with ipcRenderer.on. tests/unit/ipc-contract.cjs checks both sides.
'use strict';

module.exports = Object.freeze([
  'studio:model:status',
  'studio:models:download-progress',
  'studio:models:download-queue',
]);
