'use client';

import { DesignStudioPage } from '@studio/ui';
import { useLayoutEffect, useState } from 'react';
import { Landing } from '@/components/landing';

/** The studio in the desktop app, the landing page in a browser. */
export default function HomePage() {
  const [desktop, setDesktop] = useState(false);
  // Before the first paint. Until then global.css hides the landing page in the desktop app.
  useLayoutEffect(() => {
    if ((window as { studio?: unknown }).studio) setDesktop(true);
  }, []);
  if (desktop) return <DesignStudioPage />;
  return (
    <div className="web-only">
      <Landing />
    </div>
  );
}
