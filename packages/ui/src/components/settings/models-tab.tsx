'use client';

import { formatGb } from '@studio/constants';
import { Square } from 'lucide-react';
import { Card } from '../ui/card.js';
import { DownloadMeter, ModelListRow } from './settings-models.js';
import type { SettingsModels } from './use-settings-models.js';

/** The Settings page's Models tab. */
export function ModelsTab({ m }: { m: SettingsModels }) {
  const { remove, downloadError } = m;
  return (
    <Card as="section" muted
      role="tabpanel"
      id="settings-panel-models"
      aria-labelledby="settings-tab-models"
    >
      {remove.error ? (
        <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {remove.error}
        </p>
      ) : null}
      {downloadError ? (
        <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {downloadError}
        </p>
      ) : null}

      <StorageSummary m={m} />
      <ImageModelsSection m={m} />
    </Card>
  );
}

/** The disk as one bar: the studio's models, other QVAC models, everything else, and what is free. */
function StorageSummary({ m }: { m: SettingsModels }) {
  const { catalogue, models, device } = m;
  if (catalogue === null || !device) return null;

  // The models folder is shared, so it can hold files another QVAC app downloaded.
  const allBytes = (models ?? []).reduce((sum, model) => sum + model.sizeBytes, 0);
  const studioBytes = catalogue.filter((e) => e.installed).reduce((sum, e) => sum + e.sizeBytes, 0);
  const otherModelBytes = Math.max(0, allBytes - studioBytes);
  const osBytes = Math.max(0, device.storageBytes - device.storageFreeBytes - allBytes);
  const share = (bytes: number) => `${Math.min(100, (bytes / device.storageBytes) * 100)}%`;

  return (
    <section className="mb-5 rounded-lg border border-canvas-border bg-canvas p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-caption font-semibold uppercase tracking-wide text-canvas-muted-foreground">Storage</p>
        <p className="text-sm text-canvas-muted-foreground">
          <b className="font-bold text-canvas-foreground">{formatGb(device.storageBytes - device.storageFreeBytes)}</b> of{' '}
          {formatGb(device.storageBytes)} used
        </p>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-canvas-border">
        <div className="h-full bg-primary" title={`Studio models: ${formatGb(studioBytes)}`} style={{ width: share(studioBytes) }} />
        <div className="h-full bg-info" title={`Other QVAC models: ${formatGb(otherModelBytes)}`} style={{ width: share(otherModelBytes) }} />
        <div className="h-full bg-canvas-dimmer" title={`Everything else: ${formatGb(osBytes)}`} style={{ width: share(osBytes) }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-canvas-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-primary" />
          <b className="font-bold text-canvas-foreground">{formatGb(studioBytes)}</b> Studio models
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-info" />
          <b className="font-bold text-canvas-foreground">{formatGb(otherModelBytes)}</b> Other QVAC models
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-canvas-border" />
          <b className="font-bold text-canvas-foreground">{formatGb(device.storageFreeBytes)}</b> Free
        </span>
      </div>
    </section>
  );
}

/** The files AI elements paint with. */
function ImageModelsSection({ m }: { m: SettingsModels }) {
  const {
    catalogue,
    remove,
    downloadingScope,
    downloadingId,
    downloadQueue,
    modelProgress,
    downloadModels,
    stopDownloads,
    requestRemove,
    onRemoveOne,
    cancelRemove,
  } = m;
  if (catalogue === null) return <p className="text-sm text-canvas-muted-foreground">Loading…</p>;

  const missing = catalogue.filter((e) => !e.installed).map((e) => e.id);
  const current = catalogue.find((e) => e.id === downloadingId);

  return (
    <section className="rounded-lg border border-canvas-border bg-canvas p-4 sm:p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-canvas-foreground">Image models</h2>
        {downloadingScope ? (
          <button
            type="button"
            onClick={() => void stopDownloads()}
            className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/20"
          >
            <Square className="size-3 fill-current" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            disabled={missing.length === 0}
            onClick={() => void downloadModels('all', missing)}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
          >
            {missing.length === 0 ? 'Ready' : 'Download all'}
          </button>
        )}
      </div>
      <p className="mb-4 text-sm text-canvas-muted-foreground">
        A model on this machine paints AI elements. A model also downloads the first time you
        use it.
      </p>

      {current && downloadQueue && downloadQueue.total > 1 ? (
        <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate font-mono text-xs text-canvas-foreground">{current.name}</p>
            <p className="shrink-0 font-mono text-micro uppercase tracking-widest text-canvas-muted-foreground">
              {downloadQueue.done + (downloadQueue.done < downloadQueue.total ? 1 : 0)} of {downloadQueue.total}
            </p>
          </div>
          <DownloadMeter progress={modelProgress[current.id]} />
        </div>
      ) : null}

      <div>
        {catalogue.map((entry) => (
          <ModelListRow
            key={entry.id}
            entry={entry}
            state={remove}
            downloading={downloadingId === entry.id}
            progress={modelProgress[entry.id]}
            downloadDisabled={downloadingScope !== null}
            onDownload={() => void downloadModels(entry.id, [entry.id])}
            onRequestRemove={requestRemove}
            onConfirmRemove={onRemoveOne}
            onCancel={cancelRemove}
          />
        ))}
      </div>
    </section>
  );
}
