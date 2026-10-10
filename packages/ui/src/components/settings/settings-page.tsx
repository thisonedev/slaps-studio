'use client';

import { useUserHydrated, useUserStore } from '@studio/core';
import { DonateButton } from '../shell/donate-button.js';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ProfileOnboarding } from '../account/profile-onboarding.js';
import { Card } from '../ui/card.js';
import { isDesktopApp } from '../../lib/desktop.js';
import { AboutTable, DeviceTable } from './settings-tables.js';
import { ModelsTab } from './models-tab.js';
import { useSettingsModels } from './use-settings-models.js';

const SETTINGS_TABS = [
  { id: 'models', label: 'Models' },
  { id: 'profile', label: 'Profile' },
  { id: 'device', label: 'My device' },
  { id: 'about', label: 'About' },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

export function SettingsPage() {
  const hydrated = useUserHydrated();
  const username = useUserStore((s) => s.username);
  const openSignInPrompt = useUserStore((s) => s.openSignInPrompt);
  const router = useRouter();

  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTabId>('models');

  // Settings is desktop-only; on web, bounce back to the home page rather than show a dead page.
  useEffect(() => {
    setIsDesktop(isDesktopApp());
  }, []);

  useEffect(() => {
    if (isDesktop === false) router.replace('/');
  }, [isDesktop, router]);

  const m = useSettingsModels({ hydrated, username, openSignInPrompt });
  const { loadError, device } = m;

  if (!hydrated || isDesktop === null) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm text-canvas-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!isDesktop) {
    // Redirect already scheduled. Keep the loading frame so a production build
    // doesn't paint Electron's #070707 window as a blank black screen.
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm text-canvas-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!username) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            Settings
          </p>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-canvas-foreground sm:text-4xl">
            Sign in to continue
          </h1>
          <p className="max-w-xl text-sm text-canvas-muted-foreground sm:text-base">
            Settings are tied to your profile on this device.
          </p>
        </header>
        <button
          type="button"
          onClick={openSignInPrompt}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-primary"
        >
          Sign in
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center gap-1 text-xs text-canvas-muted-foreground transition-colors hover:text-canvas-foreground"
      >
        <span aria-hidden>←</span>
        <span>Back</span>
      </button>
      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
          Settings
        </p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-canvas-foreground sm:text-4xl">
          Your workspace
        </h1>
        <p className="max-w-2xl text-sm text-canvas-muted-foreground sm:text-base">
          Manage the image models AI elements use, your profile, and see what hardware the
          models run on.
        </p>
      </header>

      {loadError ? (
        <div className="mb-6 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {loadError}
        </div>
      ) : null}

      <div role="tablist" aria-label="Settings sections" className="mb-6 flex flex-wrap gap-2">
        {SETTINGS_TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`settings-tab-${t.id}`}
              aria-selected={isActive}
              aria-controls={`settings-panel-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={`rounded-lg border px-3.5 py-2 font-mono text-caption uppercase tracking-[0.06em] transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-canvas-border text-canvas-muted-foreground hover:text-canvas-foreground'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'models' ? <ModelsTab m={m} /> : null}

      {activeTab === 'profile' ? (
        <section
          role="tabpanel"
          id="settings-panel-profile"
          aria-labelledby="settings-tab-profile"
          className="space-y-5 pb-8 sm:pb-12"
        >
          <ProfileOnboarding />
        </section>
      ) : null}

      {activeTab === 'device' ? (
        <Card as="section" muted
          role="tabpanel"
          id="settings-panel-device"
          aria-labelledby="settings-tab-device"
        >
          <h2 className="mb-1 text-lg font-semibold text-canvas-foreground sm:text-xl">
            My device
          </h2>
          <p className="mb-4 text-sm text-canvas-muted-foreground">
            Hardware QVAC sees on this machine. It decides how fast an AI element is painted.
          </p>
          {device === null ? (
            <p className="text-sm text-canvas-muted-foreground">
              {isDesktop ? 'Loading…' : 'Open the desktop app to see device details.'}
            </p>
          ) : (
            <DeviceTable info={device} />
          )}
        </Card>
      ) : null}

      {activeTab === 'about' ? (
        <Card as="section" muted
          role="tabpanel"
          id="settings-panel-about"
          aria-labelledby="settings-tab-about"
        >
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-canvas-foreground sm:text-xl">About</h2>
            <DonateButton />
          </div>
          <p className="mb-4 text-sm text-canvas-muted-foreground">
            App version and the QVAC SDK version this build was compiled and tested against.
          </p>
          <AboutTable />
        </Card>
      ) : null}
    </main>
  );
}