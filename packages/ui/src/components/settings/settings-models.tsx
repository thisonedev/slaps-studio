'use client';

import type { StudioModelCatalogueEntry } from '@studio/validation';
import { Loader2, Download, Trash2 } from 'lucide-react';
import { formatBytes } from '@studio/constants';
import { ProgressBar, percentOf } from '../ui/progress-bar.js';

export interface RemoveState {
  // Model id showing the inline confirm, or null when closed.
  pending: string | null;
  // Once confirmed, the row shows a busy state until the IPC resolves.
  busy: boolean;
  // Per-row error message; cleared on next action.
  error: string | null;
}

export function DownloadMeter({ progress }: { progress?: { loaded: number; total: number } }) {
  const known = progress && progress.total > 0;
  return (
    <div className="mt-2">
      <ProgressBar
        percent={percentOf(progress)}
        className="w-full bg-canvas-border"
      />
      <p className="mt-1 font-mono text-micro uppercase tracking-widest text-canvas-muted-foreground">
        {known ? `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)}` : 'Preparing model…'}
      </p>
    </div>
  );
}

export function ModelListRow({
  entry,
  state,
  downloading,
  progress,
  downloadDisabled,
  onDownload,
  onRequestRemove,
  onConfirmRemove,
  onCancel,
}: {
  entry: StudioModelCatalogueEntry;
  state: RemoveState;
  downloading?: boolean;
  progress?: { loaded: number; total: number };
  downloadDisabled?: boolean;
  onDownload?: () => void;
  onRequestRemove: (id: string) => void;
  onConfirmRemove: (id: string) => void;
  onCancel: () => void;
}) {
  const installed = entry.installed;
  // The cache file is what models.remove deletes.
  const id = entry.cacheFile;
  return (
    <div className="border-b border-canvas-border/60 py-2.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          className={`size-2 shrink-0 rounded-full ${
            installed ? 'bg-primary' : downloading ? 'bg-primary/50' : 'border border-canvas-muted-foreground bg-transparent'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-canvas-foreground">{entry.name}</p>
          <p className="mt-0.5 truncate text-caption text-canvas-muted-foreground">
            {downloading ? 'Downloading…' : entry.usedBy.join(' and ')}
          </p>
        </div>
        <span className="shrink-0 font-mono text-xs text-canvas-muted-foreground">{formatBytes(entry.sizeBytes)}</span>
        {downloading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
        ) : installed ? (
          <RemoveIconButton
            id={id}
            label={entry.name}
            state={state}
            onRequestRemove={() => onRequestRemove(id)}
            onConfirmRemove={() => onConfirmRemove(id)}
            onCancel={onCancel}
          />
        ) : !installed && onDownload ? (
          <button
            type="button"
            disabled={downloadDisabled}
            onClick={onDownload}
            title={`Download ${entry.name}`}
            aria-label={`Download ${entry.name}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            <Download className="size-3.5" />
          </button>
        ) : null}
      </div>
      {downloading ? <DownloadMeter progress={progress} /> : null}
    </div>
  );
}

// Remove control for a model row: clicking the trash icon only arms the inline
// Cancel/Remove confirm (`onRequestRemove`); the actual delete fires from the
// "Remove" button (`onConfirmRemove`). Keyed off `state.pending` so only one
// row confirms at a time.
export function RemoveIconButton({
  id,
  label,
  state,
  onRequestRemove,
  onConfirmRemove,
  onCancel,
}: {
  id: string;
  label: string;
  state: RemoveState;
  onRequestRemove: () => void;
  onConfirmRemove: () => void;
  onCancel: () => void;
}) {
  const confirming = state.pending === id;
  const busy = confirming && state.busy;
  if (confirming) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded px-2 py-1 text-xs text-canvas-muted-foreground hover:text-canvas-foreground disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirmRemove}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded bg-danger/15 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/25 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : null}
          Remove
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onRequestRemove}
      disabled={state.busy}
      aria-label={`Remove ${label}`}
      className="shrink-0 rounded p-1.5 text-canvas-muted-foreground transition-colors hover:bg-canvas hover:text-danger disabled:opacity-40"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
