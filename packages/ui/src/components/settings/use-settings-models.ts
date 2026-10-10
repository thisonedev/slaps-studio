import type {
  StudioModelEntry,
  StudioModelCatalogueEntry,
  StudioDeviceInfo,
  StudioModelDownloadQueueState,
} from '@studio/validation';
import { useState, useEffect, useCallback } from 'react';
import '../../lib/desktop.js';
import type { RemoveState } from './settings-models.js';

/** What the Models tab shows and does: the model list, downloads in flight and the removal
 *  confirm. The page holds it, not the tab, so a download keeps reporting while another
 *  tab is open. */
export function useSettingsModels({
  hydrated,
  username,
  openSignInPrompt,
}: {
  hydrated: boolean;
  username: string | null;
  openSignInPrompt: () => void;
}) {
  const [models, setModels] = useState<StudioModelEntry[] | null>(null);
  const [catalogue, setCatalogue] = useState<StudioModelCatalogueEntry[] | null>(null);
  // Whether a batch is running. Only one runs at a time.
  const [downloadingScope, setDownloadingScope] = useState<string | null>(null);
  // The catalogue id of the file in flight.
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadQueue, setDownloadQueue] = useState<{ done: number; total: number } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState<Record<string, { loaded: number; total: number }>>({});
  const [device, setDevice] = useState<StudioDeviceInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remove, setRemove] = useState<RemoveState>({ pending: null, busy: false, error: null });

  const refreshModels = useCallback(async () => {
    if (!window.studio?.models) {
      setModels([]);
      return;
    }
    const [list, cat] = await Promise.all([
      window.studio.models.list(),
      window.studio.models.catalogue().catch(() => null),
    ]);
    setModels(list);
    if (cat) setCatalogue(cat);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!username) {
      openSignInPrompt();
      return;
    }
    // The P2P registry path can re-fetch a block it already reported,
    // walking `loaded` backward mid-download; clamp to keep the bar from
    // visibly restarting on every re-fetch instead of just filling in.
    const offDownloadProgress = window.studio?.models?.onDownloadProgress?.((event) => {
      if (!event?.name) return;
      setModelProgress((prev) => {
        const prevEntry = prev[event.name];
        const loaded =
          prevEntry && prevEntry.total === event.total ? Math.max(prevEntry.loaded, event.loaded) : event.loaded;
        return { ...prev, [event.name]: { loaded, total: event.total } };
      });
    });
    // The batch runs host-side (models.cjs's downloadModels) and keeps its
    // own state across this page unmounting; this mirrors it into the UI.
    // lastQueueName tells a live new-item transition (reset its bar to 0)
    // apart from an initial catch-up read of a batch already in progress.
    let lastQueueName: string | null = null;
    const applyQueueSnapshot = (snapshot: StudioModelDownloadQueueState | null) => {
      if (!snapshot?.active) {
        lastQueueName = null;
        setDownloadingScope(null);
        setDownloadingId(null);
        setDownloadQueue(null);
        if (snapshot?.error) setDownloadError(snapshot.error);
        return;
      }
      // A new item started, or a reload is catching up mid-download: seed
      // its bar from the host's own progress, not a prior item's reading.
      if (snapshot.name && snapshot.name !== lastQueueName) {
        setModelProgress((prev) => ({
          ...prev,
          [snapshot.name as string]: snapshot.progress ?? { loaded: 0, total: 0 },
        }));
      }
      lastQueueName = snapshot.name;
      setDownloadingScope(snapshot.scope);
      setDownloadingId(snapshot.name);
      setDownloadQueue({ done: snapshot.done, total: snapshot.total });
    };
    const offQueueProgress = window.studio?.models?.onDownloadQueueProgress?.((snapshot) => {
      applyQueueSnapshot(snapshot);
      // A model finished or the whole batch wrapped up: pick up the new file.
      void refreshModels();
    });
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const [list, dev, cat, queueState] = await Promise.all([
          window.studio?.models?.list().catch(() => null) ?? Promise.resolve(null),
          window.studio?.device?.info().catch(() => null) ?? Promise.resolve(null),
          window.studio?.models?.catalogue().catch(() => []) ?? Promise.resolve([]),
          window.studio?.models?.downloadQueueState?.().catch(() => null) ?? Promise.resolve(null),
        ]);
        if (cancelled) return;
        setModels(list ?? []);
        setCatalogue(cat ?? []);
        setDevice(dev);
        // Catches up a remount on a batch that started before this page loaded.
        if (queueState?.active) applyQueueSnapshot(queueState);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load settings');
      }
    })();
    return () => {
      cancelled = true;
      offDownloadProgress?.();
      offQueueProgress?.();
    };
  }, [hydrated, username, openSignInPrompt, refreshModels]);

  const onRemoveOne = useCallback(
    async (id: string) => {
      if (!window.studio?.models) return;
      setRemove({ pending: id, busy: true, error: null });
      try {
        await window.studio.models.remove(id);
        await refreshModels();
        setRemove({ pending: null, busy: false, error: null });
      } catch (err) {
        setRemove({
          pending: null,
          busy: false,
          error: err instanceof Error ? err.message : 'Remove failed',
        });
      }
    },
    [refreshModels],
  );

  // Runs host-side (models.cjs's downloadModels), not as a loop in this
  // component, so it keeps going after the user leaves Settings; the
  // onDownloadQueueProgress subscription above mirrors its state back in.
  const downloadModels = useCallback(async (scope: string, ids: string[]) => {
    if (!window.studio?.models || ids.length === 0) return;
    setDownloadError(null);
    try {
      await window.studio.models.downloadQueue(scope, ids);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    }
  }, []);

  const stopDownloads = useCallback(async () => {
    await window.studio?.models?.cancelDownloadQueue?.();
  }, []);

  // Arms the inline confirm for a row without deleting anything yet; the
  // actual delete only fires from the "Remove" button in that confirm state.
  const requestRemove = useCallback((id: string) => {
    setRemove({ pending: id, busy: false, error: null });
  }, []);

  const cancelRemove = useCallback(() => {
    setRemove({ pending: null, busy: false, error: null });
  }, []);

  return {
    models,
    catalogue,
    downloadingScope,
    downloadingId,
    downloadQueue,
    downloadError,
    modelProgress,
    device,
    loadError,
    remove,
    onRemoveOne,
    downloadModels,
    stopDownloads,
    requestRemove,
    cancelRemove,
  };
}

export type SettingsModels = ReturnType<typeof useSettingsModels>;
