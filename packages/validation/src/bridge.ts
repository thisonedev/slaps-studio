export interface StudioStateAPI {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
  list: () => Promise<Array<{ key: string; value: string }>>;
}


/** Keep in sync with CATALOG_KINDS in apps/desktop/electron/catalog-store.cjs. */
export type StudioCatalogKind = 'ic-designs' | 'brand-kits';

export interface StudioCatalogEntry {
  kind: StudioCatalogKind;
  id: string;
  title: string;
  updatedAt: number;
  /** Serialized payload size; absent on entries saved before it existed. */
  bytes?: number;
  preview?: unknown;
  v: number;
}

/** 'full' means saves are refused; 'low' is the renderer's cue to warn first. */
export interface StudioCatalogDiskStatus {
  level: 'ok' | 'low' | 'full' | 'unknown';
  freeBytes: number | null;
  totalBytes: number | null;
}

/** One manifest listing plus one payload per (kind, id), covering brand
 *  kits and saved designs; see catalog-store.cjs. */
export interface StudioCatalogAPI {
  save: (
    kind: StudioCatalogKind,
    id: string,
    title: string,
    payload: unknown,
    preview?: unknown,
  ) => Promise<void>;
  rename: (kind: StudioCatalogKind, id: string, title: string) => Promise<void>;
  get: (kind: StudioCatalogKind, id: string) => Promise<unknown | null>;
  remove: (kind: StudioCatalogKind, id: string) => Promise<void>;
  /** No kind lists every saved thing across every surface; one kind narrows to it. */
  list: (kind?: StudioCatalogKind) => Promise<StudioCatalogEntry[]>;
  diskStatus: () => Promise<StudioCatalogDiskStatus>;
}

export interface StudioWindowAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
}

/** A bundled sound's bytes, or null when the name is unknown. */
export interface StudioSoundsAPI {
  read: (name: string) => Promise<Uint8Array | null>;
}

// `id` is a stable relative path within the SDK models cache directory; pass it back to `models.remove`.
export interface StudioModelEntry {
  id: string;
  name: string;
  sizeBytes: number;
  kind: 'single' | 'sharded' | 'set';
  // Hash prefix the SDK prepends to single-file cache entries; empty for sharded/set groups.
  sourceHash: string;
  fileCount: number;
  /** Plain-language description from apps/desktop/electron/model-descriptions.json; empty when unregistered. */
  description: string;
  /** False when the on-disk size is short of the SDK registry's expected size; true when there's nothing to check against. */
  complete: boolean;
}

export interface StudioModelsRemoveResult {
  removed: number;
  freedBytes: number;
}

/** One file an image model needs, on disk or not. */
export interface StudioModelCatalogueEntry {
  /** The file's display name. Two entries can share one, so it is not a key. */
  name: string;
  /** The registry constant: the key to download by. */
  id: string;
  /** The file's name in the models cache: pass it to `models.remove`. */
  cacheFile: string;
  installed: boolean;
  sizeBytes: number;
  description: string;
  /** The image models that load this file. */
  usedBy: string[];
}

export interface StudioModelsAPI {
  /** Every model file on disk, whichever app downloaded it. */
  list: () => Promise<StudioModelEntry[]>;
  remove: (id: string) => Promise<StudioModelsRemoveResult>;
  /** The files the studio's image models need. */
  catalogue: () => Promise<StudioModelCatalogueEntry[]>;
  /** Fires while a download is in flight; unsubscribe with the returned function. */
  onDownloadProgress: (
    callback: (progress: { name: string; label: string; loaded: number; total: number }) => void,
  ) => () => void;
  /**
   * Starts a sequential batch download of catalogue ids, tracked host-side so it
   * keeps running across a Settings page unmount. Only one batch runs at a time;
   * a second call while one is active no-ops.
   */
  downloadQueue: (scope: string, ids: string[]) => Promise<{ started: boolean }>;
  /** Stops the current batch (if any) and cancels its in-flight download. */
  cancelDownloadQueue: () => Promise<{ cancelled: boolean }>;
  /** Current batch state, for a page that just (re)mounted to catch up on. */
  downloadQueueState: () => Promise<StudioModelDownloadQueueState>;
  /** Fires on every batch state change: start, each model advance, cancel, and finish. */
  onDownloadQueueProgress: (callback: (snapshot: StudioModelDownloadQueueState) => void) => () => void;
}

export interface StudioModelDownloadQueueState {
  active: boolean;
  scope: string | null;
  /** The catalogue id currently downloading, or null between items / when inactive. */
  name: string | null;
  /** That file's display name. */
  label: string | null;
  done: number;
  total: number;
  error: string | null;
  /** The current item's own byte progress, so a freshly (re)loaded page can
   *  paint the right percentage immediately instead of waiting for the next tick. */
  progress: { loaded: number; total: number } | null;
}

export interface StudioDeviceInfo {
  os: 'macos' | 'linux' | 'windows' | 'other';
  osLabel: string;
  arch: string;
  hostname: string;
  // Apple Silicon SoC name on macOS (e.g. "Apple M3 Max"); CPU model on Linux/Windows.
  model: string;
  cpuCores: number;
  cpuPhysicalCores: number;
  memoryBytes: number;
  storageBytes: number;
  storageFreeBytes: number;
  storagePath: string;
  // Best-effort GPU description. null when not detectable.
  gpu: string | null;
}

export interface StudioDeviceAPI {
  info: () => Promise<StudioDeviceInfo>;
}

export interface StudioIdentityStatus {
  status: 'none' | 'pending-backup' | 'ready' | string;
  ready: boolean;
  source: 'p2p-academy' | 'keet-linked' | null;
  identityPublicKey: string | null;
  devicePublicKey: string | null;
  createdAt: number | null;
  backupConfirmed: boolean;
  holdsRoot: boolean;
  devices: Array<{
    publicKey: string;
    role: string;
    revoked: boolean;
    attestedAt: number | null;
    label?: string | null;
  }>;
}

export interface StudioIdentityAPI {
  status: () => Promise<StudioIdentityStatus>;
  create: () => Promise<{
    mnemonic: string;
    identityPublicKey: string;
    devicePublicKey: string;
    source: string;
  }>;
  confirmBackup: () => Promise<StudioIdentityStatus>;
  recover: (mnemonic: string) => Promise<StudioIdentityStatus>;
  /** Wipe identity from this device only. Requires create or recover to sign in again. */
  reset: () => Promise<StudioIdentityStatus>;
  // Attested blob store; see electron/identity/manager.cjs for the primitive.
  setUsername: (payload: { username: string }) => Promise<{
    username: string;
    revision: number;
    updatedAt: number;
  } | null>;
  getUsername: () => Promise<{
    username: string;
    revision: number;
    updatedAt: number;
    published: boolean;
  } | null>;
}

export interface StudioClipboardAPI {
  /** Copies text and clears it after `scrubAfterMs` (0 = never); main owns the timer so the scrub survives the window closing. */
  copy: (text: string, scrubAfterMs?: number) => Promise<boolean>;
}


export interface StudioModelStatus {
  name: string;
  /** Which capability the model serves. The studio only loads 'image'. */
  kind: string;
  phase: 'downloading' | 'loading' | 'ready';
  downloaded?: number;
  total?: number;
  /** On a `ready`: the load was stopped, not finished. */
  cancelled?: boolean;
}

/** The desktop app's package.json, plus the commit it was built from. */
export interface StudioPkg {
  name: string;
  productName?: string;
  version: string;
  commit: string | null;
  dependencies?: Record<string, string>;
}

/** What preload.js puts on `window.studio`. */
export interface StudioAPI {
  pkg: () => StudioPkg;
  state: StudioStateAPI;
  catalog: StudioCatalogAPI;
  sounds: StudioSoundsAPI;
  window: StudioWindowAPI;
  models: StudioModelsAPI;
  device: StudioDeviceAPI;
  clipboard: StudioClipboardAPI;
  /** Stops a model that is still loading or downloading. A no-op otherwise. */
  cancelModelLoad: () => Promise<void>;
  onModelStatus: (callback: (status: StudioModelStatus) => void) => () => void;
  currentModelStatus: () => Promise<StudioModelStatus | null>;
  /** Paints an image and returns it as a PNG data URL. */
  generateImage: (
    prompt: string,
    model?: string,
    opts?: { width?: number; height?: number; seed?: number; steps?: number },
  ) => Promise<string>;
  cancelGenerateImage: () => Promise<void>;
  identity: StudioIdentityAPI;
}
