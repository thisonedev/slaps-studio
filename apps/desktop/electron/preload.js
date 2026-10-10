const { contextBridge, ipcRenderer } = require('electron');

// The main process answers a cancelled call with a value, not a throw, so Electron does not
// print a stack for it (see quiet-cancel.cjs). The page still expects a rejection, so every
// call goes through here and becomes one again.
/** @param {string} channel @param {...unknown} args @returns {Promise<any>} */
const invoke = (channel, ...args) =>
  ipcRenderer.invoke(channel, ...args).then((res) => {
    if (res && typeof res === 'object' && typeof res.studioCancelled === 'string') {
      throw Object.assign(new Error(res.studioCancelled), { name: 'InferenceCancelledError' });
    }
    return res;
  });

/** @param {string} channel @param {(payload: any) => void} callback */
const subscribe = (channel, callback) => {
  const handler = (/** @type {unknown} */ _e, /** @type {any} */ payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

// `@type` would silence mismatches instead of failing `pnpm typecheck`.
/** @type {import('@studio/validation').StudioAPI} */
const studio = {
  pkg: () => ipcRenderer.sendSync('pkg'),
  state: {
    get: (key) => invoke('studio:state:get', key),
    set: (key, value) => invoke('studio:state:set', { key, value }),
    remove: (key) => invoke('studio:state:remove', key),
    list: () => invoke('studio:state:list'),
  },
  catalog: {
    save: (kind, id, title, payload, preview) =>
      invoke('studio:catalog:save', { kind, id, title, payload, preview }),
    rename: (kind, id, title) => invoke('studio:catalog:rename', { kind, id, title }),
    get: (kind, id) => invoke('studio:catalog:get', { kind, id }),
    remove: (kind, id) => invoke('studio:catalog:remove', { kind, id }),
    list: (kind) => invoke('studio:catalog:list', kind ?? null),
    diskStatus: () => invoke('studio:catalog:disk-status'),
  },
  sounds: {
    read: (name) => invoke('studio:sound:read', name),
  },
  window: {
    minimize: () => invoke('studio:window:minimize'),
    maximize: () => invoke('studio:window:maximize'),
    close: () => invoke('studio:window:close'),
  },
  models: {
    list: () => invoke('studio:models:list'),
    remove: (id) => invoke('studio:models:remove', id),
    catalogue: () => invoke('studio:models:catalogue'),
    onDownloadProgress: (callback) => subscribe('studio:models:download-progress', callback),
    downloadQueue: (scope, names) => invoke('studio:models:downloadQueue', { scope, names }),
    cancelDownloadQueue: () => invoke('studio:models:cancelDownloadQueue'),
    downloadQueueState: () => invoke('studio:models:downloadQueueState'),
    onDownloadQueueProgress: (callback) => subscribe('studio:models:download-queue', callback),
  },
  device: {
    info: () => invoke('studio:device:info'),
  },
  clipboard: {
    copy: (text, scrubAfterMs) => invoke('studio:clipboard:copy', { text, scrubAfterMs }),
  },
  cancelModelLoad: () => invoke('studio:model:cancel-load'),
  onModelStatus: (callback) => subscribe('studio:model:status', callback),
  currentModelStatus: () => invoke('studio:model:status:current'),
  generateImage: (prompt, model, opts) => invoke('studio:generate-image', { prompt, model, ...opts }),
  cancelGenerateImage: () => invoke('studio:generate-image:cancel'),
  identity: {
    status: () => invoke('studio:identity:status'),
    create: () => invoke('studio:identity:create'),
    confirmBackup: () => invoke('studio:identity:confirm-backup'),
    recover: (mnemonic) => invoke('studio:identity:recover', mnemonic),
    reset: () => invoke('studio:identity:reset'),
    setUsername: (payload) => invoke('studio:identity:set-username', payload),
    getUsername: () => invoke('studio:identity:get-username'),
  },
};

contextBridge.exposeInMainWorld('studio', studio);
