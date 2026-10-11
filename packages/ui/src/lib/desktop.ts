import type { StudioAPI } from '@studio/validation';

declare global {
  interface Window {
    /** The desktop app's bridge, put on the window by its preload script. Absent in a browser. */
    studio?: StudioAPI;
  }
}

/**
 * True in the desktop app, false in a browser and while rendering on the server.
 * An element with id="studio" also shows up as window.studio, so DOM nodes don't count.
 */
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  const bridge: unknown = window.studio;
  return !!bridge && !(bridge instanceof Element);
}
