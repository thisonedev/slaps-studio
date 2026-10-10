'use client';

import { useUserStore } from '@studio/core';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DownloadStatusBadge } from './download-status-badge.js';
import { UserMenu } from './user-menu.js';
import { WindowControls } from './window-controls.js';

export function SiteHeader() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const username = useUserStore((s) => s.username);
  const openSignInPrompt = useUserStore((s) => s.openSignInPrompt);
  const signedIn = !!username;

  return (
    <header className="site-header sticky top-0 z-sticky flex h-14 w-full items-center border-b border-canvas-border bg-canvas/90 px-4 backdrop-blur sm:px-6">
      <WindowControls />
      <Link
        href="/"
        className="ml-3 flex items-center gap-2 text-base font-bold tracking-tight sm:ml-4"
      >
        <span>
          <span className="text-primary">Slaps</span>
          <span className="text-canvas-foreground"> Studio</span>
        </span>
      </Link>

      {/* The only part of the bar that drags the desktop window. It never overlaps a control. */}
      <div className="window-drag h-full flex-1" aria-hidden />
      <nav className="flex items-center gap-1 sm:gap-3 text-sm">
        <DownloadStatusBadge />
        {/* The account is the bar's last item. The download badge leads the row, so when it
            shows up it grows into empty space and nothing under the pointer moves. */}
        {mounted ? (
          signedIn ? (
            <UserMenu />
          ) : (
            <button
              type="button"
              onClick={openSignInPrompt}
              className="desktop-only inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-muted px-3 py-1.5 text-sm font-medium text-canvas-foreground transition-colors hover:border-primary/40 hover:bg-canvas"
            >
              Sign in
            </button>
          )
        ) : (
          <span className="inline-block h-9 w-20 rounded-md" aria-hidden />
        )}
      </nav>
    </header>
  );
}
