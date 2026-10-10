// Lists, sizes, downloads and removes the QVAC models the studio uses. Models live
// under `<HOME>/.qvac/models/`, a folder every QVAC app on the machine shares.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { cacheFileName, readRegistry } = require('../shared/model-sideload.cjs');
const { ACTIVE_WRITE_MS, ensureModels } = require('../shared/model-fetch.cjs');
const { CANCEL_NAMES } = require('./quiet-cancel.cjs');
const { IMAGE_MODELS } = require('./diffusion.cjs');

const SINGLE_HASH_RE = /^([0-9a-f]{16})_(.+)$/;

let descriptionMap = null;
function loadDescriptionMap() {
  if (descriptionMap !== null) return descriptionMap;
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'model-descriptions.json'), 'utf-8');
    descriptionMap = JSON.parse(raw);
    if (!descriptionMap || typeof descriptionMap !== 'object') descriptionMap = {};
  } catch {
    descriptionMap = {};
  }
  return descriptionMap;
}

function modelsRoot() {
  return path.join(os.homedir(), '.qvac', 'models');
}

async function safeStat(p) {
  try {
    return await fsp.stat(p);
  } catch {
    return null;
  }
}

async function dirSize(dir) {
  let total = 0;
  let count = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = await fsp.readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile()) {
        const s = await safeStat(abs);
        if (s) {
          total += s.size;
          count += 1;
        }
      }
    }
  }
  return { total, count };
}

function displayNameFromSingle(filename) {
  const m = SINGLE_HASH_RE.exec(filename);
  return m ? m[2] : filename;
}

async function listModels() {
  const root = modelsRoot();
  const rootStat = await safeStat(root);
  if (!rootStat || !rootStat.isDirectory()) return [];

  const descriptions = loadDescriptionMap();
  const out = [];
  let entries;
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    const abs = path.join(root, entry.name);
    if (entry.isFile()) {
      const s = await safeStat(abs);
      if (!s) continue;
      const hashMatch = SINGLE_HASH_RE.exec(entry.name);
      const displayName = displayNameFromSingle(entry.name);
      const sizes = knownGoodSizes(displayName);
      out.push({
        id: entry.name,
        name: displayName,
        sizeBytes: s.size,
        mtimeMs: s.mtimeMs,
        kind: 'single',
        sourceHash: hashMatch ? hashMatch[1] : '',
        fileCount: 1,
        description: descriptions[displayName] ?? '',
        // No registry entry to check size against: assume complete.
        complete: sizes ? sizes.has(s.size) : true,
      });
    } else if (entry.isDirectory() && (entry.name === 'sharded' || entry.name === 'sets')) {
      const groups = await fsp.readdir(abs, { withFileTypes: true });
      for (const group of groups) {
        if (!group.isDirectory()) continue;
        const groupAbs = path.join(abs, group.name);
        const { total, count } = await dirSize(groupAbs);
        // Empty companion dirs still have to show up: otherwise the catalogue
        // row is 0 B with no id, and Settings can't delete the leftover.
        out.push({
          id: path.join(entry.name, group.name),
          name: group.name,
          sizeBytes: total,
          kind: entry.name === 'sharded' ? 'sharded' : 'set',
          sourceHash: '',
          fileCount: count,
          description: descriptions[group.name] ?? '',
          // No reliable per-shard ground truth here (see pruneIncompleteDownloads).
          complete: count > 0,
        });
      }
    }
  }

  out.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return out;
}

async function removeModel(id) {
  const root = modelsRoot();
  const abs = path.join(root, id);
  // Refuse to escape the models root. `id` comes from the renderer.
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(path.resolve(root) + path.sep) && resolved !== path.resolve(root)) {
    throw new Error('refusing to delete outside the models directory');
  }
  const stat = await safeStat(resolved);
  if (!stat) return { removed: 0, freedBytes: 0 };

  let freedBytes = 0;
  let removed = 0;
  if (stat.isDirectory()) {
    const { total, count } = await dirSize(resolved);
    freedBytes = total;
    removed = count;
    await fsp.rm(resolved, { recursive: true, force: true });
  } else {
    freedBytes = stat.size;
    removed = 1;
    await fsp.unlink(resolved);
  }
  return { removed, freedBytes };
}

// Lazy so a missing @qvac/sdk/models can't take down list/remove on startup.
let _sdkRegistryModels = null;
function sdkRegistryModels() {
  if (_sdkRegistryModels === null) {
    try {
      const { models } = require('@qvac/sdk/models');
      _sdkRegistryModels = Array.isArray(models) ? models : [];
    } catch (err) {
      console.warn('[models] could not load @qvac/sdk registry', err && err.message);
      _sdkRegistryModels = [];
    }
  }
  return _sdkRegistryModels;
}

// Real HF download URL for a registry entry, for loadModel's fallbackSrc when
// the P2P registry is unreachable. Only 'hf'-sourced, single-file entries
// have one; the SDK rejects fallbackSrc for sharded/companion-set models, and
// 's3'-sourced entries have no public mirror to construct one from.
// Takes the resolved registry constant itself (e.g. sdk.QWEN3_8B_INST_Q4_K_M),
// not a modelId: several constants can share one modelId, and only the exact
// entry a caller is actually loading tells us which source it uses.
function hfFallbackSrc(entry) {
  if (!entry || entry.registrySource !== 'hf' || entry.shardMetadata || entry.companionSet) return undefined;
  return `https://huggingface.co/${entry.registryPath.replace('/blob/', '/resolve/')}`;
}

// Shared by every loadModel() caller: attaches a `fallbackSrc` to `args.modelSrc` when one
// resolves, so a P2P registry outage falls back to a direct HTTPS download.
function withFallbackSrc(args) {
  if (!args?.modelSrc || args.fallbackSrc) return args;
  const fallbackSrc = hfFallbackSrc(args.modelSrc);
  return fallbackSrc ? { ...args, fallbackSrc } : args;
}

// Memoized filename -> set of valid download sizes, from @qvac/sdk's registry
// (multiple entries when a file has more than one legitimate source).
let _knownSizesByName = null;
function knownGoodSizes(filename) {
  if (_knownSizesByName === null) {
    _knownSizesByName = new Map();
    for (const entry of sdkRegistryModels()) {
      if (!entry.modelId || !entry.expectedSize) continue;
      const sizes = _knownSizesByName.get(entry.modelId) ?? new Set();
      sizes.add(entry.expectedSize);
      _knownSizesByName.set(entry.modelId, sizes);
    }
  }
  return _knownSizesByName.get(filename) ?? null;
}

// A download in flight is short and growing, which reads exactly like the
// truncated leftover this sweep is for. Deleting one does not stop the writer:
// it finishes into an unlinked inode and the loader then finds no file.

async function pruneIncompleteDownloads({ now = Date.now() } = {}) {
  const items = await listModels();
  const removed = [];
  let freedBytes = 0;
  for (const item of items) {
    if (item.kind !== 'single') continue;
    const sizes = knownGoodSizes(item.name);
    if (!sizes || sizes.has(item.sizeBytes)) continue;
    if (typeof item.mtimeMs === 'number' && now - item.mtimeMs < ACTIVE_WRITE_MS) {
      console.warn(`[models] left ${item.name} alone; written to in the last minute`);
      continue;
    }
    try {
      const r = await removeModel(item.id);
      freedBytes += r.freedBytes;
      removed.push(item.name);
      console.warn(
        `[models] removed truncated download: ${item.name} (${item.sizeBytes} bytes on disk, expected one of ${[...sizes].join(', ')})`,
      );
    } catch (err) {
      console.warn('[models] pruneIncompleteDownloads: remove failed', item.id, err && err.message);
    }
  }
  return { removed, freedBytes };
}

// Registry constant -> the image models that load it. FLUX.2 needs three files,
// so one constant can serve more than one picker entry.
function studioConstants() {
  const out = new Map();
  for (const { label, registryKeys } of Object.values(IMAGE_MODELS)) {
    const name = label.replace(/\s*\([^)]*\)\s*$/, '');
    for (const key of registryKeys) out.set(key, [...(out.get(key) ?? []), name]);
  }
  return out;
}

// One row per file an image model needs. The cache file name, not the display
// name, says whether it is on disk: two registry entries can share a file name.
async function catalogue() {
  const registry = readRegistry();
  const descriptions = loadDescriptionMap();
  const out = [];
  for (const [constant, usedBy] of studioConstants()) {
    const entry = registry.get(constant);
    if (!entry) continue;
    const cacheFile = cacheFileName(entry.registryPath);
    const stat = await safeStat(path.join(modelsRoot(), cacheFile));
    out.push({
      name: entry.modelId,
      id: constant,
      cacheFile,
      installed: Boolean(stat && stat.size === entry.expectedSize),
      sizeBytes: entry.expectedSize ?? 0,
      description: descriptions[entry.modelId] ?? '',
      usedBy,
    });
  }
  return out;
}

const downloadEvents = new EventEmitter();

let currentDownload = null;
let currentFetchAbort = null;
let downloadCancelled = false;
// Last progress tick for whichever file downloadModel() is currently on;
// queueSnapshot() only surfaces it while the name still matches the queue's
// current item, so a finished item's numbers can't leak into the next one.
let lastProgress = null;

function isCancelError(err) {
  if (!err) return false;
  const msg = String(err.message || err);
  // WorkerShutdownError fires when the whole app is quitting mid-download;
  // retrying it is pointless (the process is on its way out) and just turns
  // one clean shutdown into a scary "unhandled" log.
  return CANCEL_NAMES.has(err.name) || /cancel/i.test(msg);
}

// The file name a catalogue id downloads, for progress the user reads.
function labelFor(constant) {
  return readRegistry().get(constant)?.modelId ?? constant;
}

// Caches a model without loading it. `name` is a catalogue row's id, a registry constant.
async function downloadModel(name, sdkOverride) {
  if (!studioConstants().has(name)) throw new Error(`unknown model "${name}"`);
  const constant = name;
  const label = labelFor(name);
  const sdk = sdkOverride ?? require('@qvac/sdk');
  const model = sdk[constant];
  if (!model) throw new Error(`@qvac/sdk does not export ${constant} in this build`);

  downloadCancelled = false;
  // The P2P registry path has no timeout of its own; an HF-sourced model can
  // stall indefinitely with no seeders online. Pre-fetch over HTTPS first so
  // downloadAsset below finds it already cached and no-ops.
  currentFetchAbort = new AbortController();
  await ensureModels([constant], {
    signal: currentFetchAbort.signal,
    onEvent: (e) => {
      if (e.phase !== 'progress') return;
      lastProgress = { name, loaded: e.downloaded, total: e.total };
      downloadEvents.emit('progress', { name, label, loaded: e.downloaded, total: e.total });
    },
  }).catch(() => {});
  currentFetchAbort = null;
  if (downloadCancelled) return { downloaded: false, cancelled: true };

  for (let attempt = 1; attempt <= 2; attempt++) {
    // Resetting this per-attempt would drop a Stop click that lands in the
    // gap between attempt 1's cleanup and attempt 2's setup.
    if (downloadCancelled) return { downloaded: false, cancelled: true };
    const op = sdk.downloadAsset({
      assetSrc: model,
      onProgress: (update) => {
        // A renderer that (re)loads mid-download (a full page navigation,
        // not an SPA transition, in this app) has no other way to recover
        // how far along the current file already is.
        lastProgress = { name, loaded: update.downloaded, total: update.total };
        downloadEvents.emit('progress', { name, label, loaded: update.downloaded, total: update.total });
      },
    });
    currentDownload = { requestId: op && op.requestId, sdk };
    try {
      await op;
      if (downloadCancelled) return { downloaded: false, cancelled: true };
      return { downloaded: true };
    } catch (err) {
      if (downloadCancelled || isCancelError(err)) return { downloaded: false, cancelled: true };
      // The P2P registry path can fail its first attempt on a cold corestore;
      // one retry absorbs that transient case.
      if (attempt === 2) throw err;
      console.warn('[models] downloadModel: retrying after failure', name, err && err.message);
    } finally {
      currentDownload = null;
    }
  }
}

// Aborts the in-flight downloadAsset. Safe when nothing is running.
// Plain cancel is a pause: the SDK keeps the partial in its own cache to
// resume later. Pass clearCache for a real delete.
async function cancelDownload(clearCache) {
  downloadCancelled = true;
  currentFetchAbort?.abort();
  const cur = currentDownload;
  if (!cur || !cur.requestId || typeof cur.sdk?.cancel !== 'function') {
    return { cancelled: false };
  }
  try {
    await cur.sdk.cancel({ requestId: cur.requestId, ...(clearCache ? { clearCache: true } : {}) });
  } catch (err) {
    console.warn('[models] cancelDownload: sdk.cancel failed', err && err.message);
  }
  return { cancelled: true };
}

function isDownloading() {
  return currentDownload !== null || currentFetchAbort !== null || queueState !== null;
}

function onDownloadProgress(callback) {
  downloadEvents.on('progress', callback);
  return () => downloadEvents.off('progress', callback);
}

// One batch runs at a time, tracked here (not in the renderer) so it keeps
// going, and keeps its own state, across a Settings page unmount/remount.
let queueState = null;

function queueSnapshot() {
  if (!queueState) return { active: false, scope: null, name: null, label: null, done: 0, total: 0, error: null, progress: null };
  const { scope, name, done, total, error } = queueState;
  const progress = lastProgress && lastProgress.name === name ? { loaded: lastProgress.loaded, total: lastProgress.total } : null;
  return { active: true, scope, name, label: name ? labelFor(name) : null, done, total, error, progress };
}

// Sequential, not parallel: keeps one progress bar meaningful per model and
// avoids competing for the same bandwidth. downloadAsset no-ops on a model
// that's already cached, so callers can pass a scope's full list as-is.
async function downloadModels(scope, names) {
  if (queueState) return { started: false };
  queueState = { scope, name: null, done: 0, total: names.length, cancelled: false, error: null };
  downloadEvents.emit('queue', queueSnapshot());
  for (let i = 0; i < names.length; i++) {
    if (queueState.cancelled) break;
    const name = names[i];
    if (!name) continue;
    queueState.name = name;
    downloadEvents.emit('queue', queueSnapshot());
    let result;
    try {
      result = await downloadModel(name);
    } catch (err) {
      queueState.error = err instanceof Error ? err.message : String(err);
      break;
    }
    if (queueState.cancelled || result?.cancelled) break;
    queueState.done = i + 1;
  }
  queueState.name = null;
  const final = { ...queueSnapshot(), active: false };
  queueState = null;
  downloadEvents.emit('queue', final);
  return { started: true };
}

async function cancelDownloadQueue() {
  if (queueState) queueState.cancelled = true;
  return cancelDownload();
}

function downloadQueueState() {
  return queueSnapshot();
}

function onDownloadQueueProgress(callback) {
  downloadEvents.on('queue', callback);
  return () => downloadEvents.off('queue', callback);
}

module.exports = {
  listModels,
  removeModel,
  pruneIncompleteDownloads,
  ACTIVE_WRITE_MS,
  knownGoodSizes,
  modelsRoot,
  catalogue,
  downloadModel,
  cancelDownload,
  isDownloading,
  onDownloadProgress,
  downloadModels,
  cancelDownloadQueue,
  downloadQueueState,
  onDownloadQueueProgress,
  hfFallbackSrc,
  withFallbackSrc,
};
