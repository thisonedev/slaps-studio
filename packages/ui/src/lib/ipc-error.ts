// Electron prefixes every error crossing IPC with the channel name; the user
// only needs what the main process said.
export function ipcErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}
