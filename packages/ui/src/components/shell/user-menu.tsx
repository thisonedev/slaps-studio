'use client';

import { LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useUserStore } from '@studio/core';
import { useEscape } from '../../hooks/use-escape.js';
import { useOutsidePress } from '../../hooks/use-outside-press.js';
import { isDesktopApp } from '../../lib/desktop.js';

/** Header account handle: avatar (initial) that opens a dropdown with the
 *  username, settings and sign out. */
export function UserMenu() {
  const username = useUserStore((s) => s.username);
  const reset = useUserStore((s) => s.reset);

  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Detect the desktop bridge after mount so SSR HTML matches the first client render.
  useEffect(() => {
    setIsDesktop(isDesktopApp());
  }, []);

  // On desktop, restore the crypto-signed username on mount so the avatar
  // initial isn't stuck on the empty default before the host responds.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const identityApi = window.studio?.identity;
    if (!identityApi?.getUsername || !identityApi.setUsername) return;
    let cancelled = false;
    void (async () => {
      try {
        const host = await identityApi.getUsername();
        if (cancelled) return;
        if (host?.username && !useUserStore.getState().username) {
          useUserStore.getState().setUsername(host.username);
        }
      } catch {
        // best-effort: leave the local store alone if the host is unreachable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click and Escape; restore focus to the trigger.
  useOutsidePress(
    containerRef,
    () => {
      setOpen(false);
      setConfirming(false);
    },
    { active: open },
  );
  useEscape(() => {
    setOpen(false);
    setConfirming(false);
    buttonRef.current?.focus();
  }, open);

  if (!username) return null;

  const initial = username.charAt(0).toUpperCase();

  const handleSignOut = () => {
    reset();
    setOpen(false);
    setConfirming(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setConfirming(false);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${username}`}
        title={`@${username}`}
        className="inline-flex items-center justify-center rounded-full border border-canvas-border bg-canvas-muted p-0.5 text-canvas-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary text-sm">
          {initial}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="fixed right-3 top-14 z-popover mt-0 w-64 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-canvas-border bg-canvas-muted shadow-2xl sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:max-w-none"
        >
          <div className="border-b border-canvas-border px-4 py-3">
            <p className="truncate font-mono text-sm font-semibold text-canvas-foreground">
              @{username}
            </p>
          </div>

          <div className="p-1">
            {isDesktop ? (
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-sm text-canvas-muted-foreground transition-colors hover:bg-canvas hover:text-canvas-foreground"
              >
                <Settings className="size-4" />
                Settings
              </Link>
            ) : null}
            {confirming ? (
              <div className="p-2">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded px-2 py-1 text-canvas-muted-foreground hover:bg-canvas hover:text-canvas-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="rounded bg-danger/15 px-2 py-1 font-semibold text-danger hover:bg-danger/25"
                  >
                    Sign out
                  </button>
                </div>
                <p className="mt-1.5 text-right text-micro text-canvas-muted-foreground/80">
                  Your saved designs stay on this device.
                </p>
              </div>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirming(true)}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-sm text-canvas-muted-foreground transition-colors hover:bg-canvas hover:text-canvas-foreground"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
