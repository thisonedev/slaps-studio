import './global.css';
import { PRODUCT_NAME } from '@studio/constants';
import { SiteHeader, UsernamePrompt } from '@studio/ui';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

// Self-hosted by Next.js at build time (no runtime fetch to Google's CDN),
// so this stays compatible with the page's font-src 'self' CSP.
const sans = Inter({ subsets: ['latin'], variable: '--font-geist-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata = {
  title: PRODUCT_NAME,
  description: 'Social posts and threads from templates, in your own style. Runs on your machine.',
  icons: {
    icon: [{ url: '/favicon.ico?v=3', type: 'image/x-icon', sizes: '32x32' }],
  },
  other: {
    google: 'notranslate',
  },
};

/** Tag <html data-platform="desktop"> before paint when the desktop bridge is
 *  present, so CSS can pick the right header layout (controls + logo offset). */
const tagPlatformScript = `try{if(window.studio&&!(window.studio instanceof Element)){document.documentElement.setAttribute('data-platform','desktop')}}catch(e){}`;

// No remote origin, so a CDN compromise, a TLS intercept, or a pinned-range
// mistake cannot run code in the same origin that holds window.studio.
// Keep in sync with apps/desktop/electron/security-headers.cjs.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Root layout: site header, page content, and the self-determining sign-in modal. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* The dev server evaluates code to hot reload, which this policy refuses. */}
        {process.env.NODE_ENV === 'production' ? (
          <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy} />
        ) : null}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static string, no user input */}
        <script dangerouslySetInnerHTML={{ __html: tagPlatformScript }} />
      </head>
      <body
        className="flex min-h-screen flex-col bg-canvas text-canvas-foreground antialiased"
        suppressHydrationWarning
      >
        <SiteHeader />
        <div className="flex w-full flex-1 flex-col">{children}</div>
        <UsernamePrompt />
      </body>
    </html>
  );
}
