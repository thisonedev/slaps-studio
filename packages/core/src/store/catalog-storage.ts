import type {
  StudioCatalogAPI,
  StudioCatalogDiskStatus,
  StudioCatalogEntry,
  StudioCatalogKind,
} from '@studio/validation';

// Electron drops custom error fields across IPC, so the code is part of the
// message. Keep in sync with DISK_LOW_CODE in catalog-store.cjs.
const CATALOG_DISK_LOW = 'CATALOG_DISK_LOW';

export function isCatalogDiskLowError(err: unknown): boolean {
  return err instanceof Error && err.message.includes(CATALOG_DISK_LOW);
}

function getStudioCatalog(): StudioCatalogAPI | null {
  if (typeof window === 'undefined') return null;
  const studio = (window as unknown as { studio?: { catalog?: StudioCatalogAPI } }).studio;
  return studio?.catalog ?? null;
}

// Typed client for brand kits and saved designs. Unlike studioStorage, there's
// no localStorage cache: every call goes straight to the main-process catalog,
// a no-op outside Electron.
export const catalogStorage = {
  /** False outside the desktop app, where every call below is a no-op. */
  available(): boolean {
    return getStudioCatalog() !== null;
  },
  save(kind: StudioCatalogKind, id: string, title: string, payload: unknown, preview?: unknown): Promise<void> {
    const catalog = getStudioCatalog();
    if (!catalog) return Promise.resolve();
    return catalog.save(kind, id, title, payload, preview);
  },
  rename(kind: StudioCatalogKind, id: string, title: string): Promise<void> {
    const catalog = getStudioCatalog();
    if (!catalog) return Promise.resolve();
    return catalog.rename(kind, id, title);
  },
  get(kind: StudioCatalogKind, id: string): Promise<unknown | null> {
    const catalog = getStudioCatalog();
    if (!catalog) return Promise.resolve(null);
    return catalog.get(kind, id);
  },
  remove(kind: StudioCatalogKind, id: string): Promise<void> {
    const catalog = getStudioCatalog();
    if (!catalog) return Promise.resolve();
    return catalog.remove(kind, id);
  },
  list(kind?: StudioCatalogKind): Promise<StudioCatalogEntry[]> {
    const catalog = getStudioCatalog();
    if (!catalog) return Promise.resolve([]);
    return catalog.list(kind);
  },
  diskStatus(): Promise<StudioCatalogDiskStatus> {
    const catalog = getStudioCatalog();
    if (!catalog) return Promise.resolve({ level: 'unknown', freeBytes: null, totalBytes: null });
    return catalog.diskStatus();
  },
};
