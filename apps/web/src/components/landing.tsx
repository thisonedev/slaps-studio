'use client';

import { INSTALL_COMMANDS, PRODUCT_NAME, REPO_URL, X_URL } from '@studio/constants';
import { CopyButton } from '@studio/ui';
import { Github, Layers, type LucideIcon, Palette, Sparkles } from 'lucide-react';
import { type ReactNode, useState } from 'react';

const INSTALL_TABS = [
  { label: 'macOS / Linux', command: INSTALL_COMMANDS.unix },
  { label: 'Windows', command: INSTALL_COMMANDS.windows },
];

const HERO_FACTS = ['50+ templates', 'UI kits', 'Threads'];

const STATS = [
  { label: 'Templates', value: '50+', sub: 'Tailored for Web3 and AI' },
  { label: 'On-device', value: '100%', sub: 'Nothing runs in the cloud' },
  { label: 'Export formats', value: '4', sub: 'PNG, JPG, PDF and SVG' },
  { label: 'API keys', value: '0', sub: 'Nothing to sign up for' },
];

interface FeatureItem {
  icon: LucideIcon;
  title: string;
  body: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: Layers,
    title: 'Start from a template',
    body: 'Announcements, milestones, partnerships, releases and threads. Pick one and change the words.',
  },
  {
    icon: Palette,
    title: 'Your own style',
    body: 'Switch a post to a built-in UI kit, or build a kit from your own colors and fonts.',
  },
  {
    icon: Sparkles,
    title: 'AI elements, painted locally',
    body: 'Describe an object and an image model on your machine paints it, with the background cut away.',
  },
];

const STUDIO_KITS = [
  { name: 'Default', color: '#6ea8fe' },
  { name: 'Glass', color: '#7db8ff' },
  { name: 'Tether', color: '#009393' },
  { name: 'QVAC', color: '#16e3c1' },
];

const DESIGN_FACTS = [
  '50+ templates across the most used and requested post types, tailored for Web3 and AI industries.',
  'Generous database of built-in UI kits, and the constructor to create your own.',
  'Single posts or multi-page threads, sized for X, Instagram, LinkedIn and stories.',
];

export function Landing() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 sm:px-8 sm:py-16">
      <div className="space-y-14 sm:space-y-20">
        <div className="grid min-h-[calc(100vh-200px)] items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <Hero />
          <div className="aspect-[3/2] min-w-0 overflow-hidden rounded-lg border border-canvas-border bg-canvas-raised shadow-2xl">
            <DesignPreview />
          </div>
        </div>
        <StatsStrip />
        <StudioStill />
        <FeatureCards />
        <InstallCta />
        <Copyright />
      </div>
    </main>
  );
}

function Hero() {
  return (
    <div className="flex min-w-0 flex-col justify-center space-y-6 sm:space-y-8">
      <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-canvas-border px-3.5 py-1.5 font-mono text-caption uppercase tracking-[0.15em] text-primary">
        <span aria-hidden>✦</span>
        The local design studio
      </p>
      <h1 className="max-w-4xl text-[clamp(32px,4.6vw,52px)] font-bold leading-[1.1] tracking-tight">
        Posts and threads in your <span className="whitespace-nowrap">own style</span>
      </h1>
      <p className="max-w-2xl font-mono text-lead leading-[1.7] text-canvas-muted-foreground">
        Pick a template, switch it to your brand, and export. A design studio that runs on your
        machine, with no account and no cloud.
      </p>
      <div className="flex flex-wrap gap-2">
        {HERO_FACTS.map((fact) => (
          <span
            key={fact}
            className="rounded-md border border-canvas-border bg-canvas-muted px-3 py-1.5 text-sm font-semibold text-canvas-foreground"
          >
            {fact}
          </span>
        ))}
      </div>
      <section id="install" className="max-w-lg scroll-mt-24 space-y-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
          Install via Terminal
        </p>
        <InstallDemo />
      </section>
    </div>
  );
}

/** Tabs sit flush against the code box below: shared border, no gap, matching radius. */
function InstallDemo() {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="flex gap-0.5">
        {INSTALL_TABS.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-t-lg border border-b-0 px-3.5 py-2 font-mono text-caption uppercase tracking-wide transition-colors ${
              i === active
                ? 'border-canvas-border bg-canvas-muted text-primary'
                : 'border-transparent text-canvas-dimmer hover:text-canvas-muted-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-b-lg rounded-tr-lg border border-canvas-border bg-canvas-muted px-4 py-3 font-mono text-label text-canvas-muted-foreground">
        <code className="min-w-0 flex-1 truncate">{INSTALL_TABS[active].command}</code>
        <CopyButton command={INSTALL_TABS[active].command} />
      </div>
    </div>
  );
}

function StatsStrip() {
  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen border-y border-canvas-border">
      <div className="mx-auto grid max-w-[1100px] grid-cols-2 divide-x divide-y divide-canvas-border sm:grid-cols-4 sm:divide-y-0">
        {STATS.map((stat) => (
          <div key={stat.label} className="px-5 py-6 sm:px-8">
            <p className="font-mono text-caption font-semibold uppercase tracking-widest text-primary">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-canvas-foreground">
              {stat.value}
            </p>
            <p className="mt-1 font-mono text-xs text-canvas-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Posts in the studio's Default kit: the app's canvas colors with the kit's blue.
const KIT_BLUE = '#6ea8fe';
const POST =
  'relative flex flex-col justify-between overflow-hidden rounded-md border border-white/5 bg-[radial-gradient(110%_120%_at_100%_0%,#1a2638,#12151a_65%)] p-2 text-canvas-foreground';

function PostTag({ children }: { children: ReactNode }) {
  return (
    <span className="self-start rounded-sm bg-[#6ea8fe] px-1.5 py-px font-mono text-[6.5px] font-bold uppercase tracking-widest text-[#0b1a30]">
      {children}
    </span>
  );
}

function Bars({ heights }: { heights: number[] }) {
  return (
    <div className="flex h-[44%] items-end gap-[3px]">
      {heights.map((h, i) => (
        <i
          // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
          key={i}
          className="flex-1 rounded-t-sm"
          style={{ height: `${h}%`, background: i === heights.length - 1 ? KIT_BLUE : '#242b33' }}
        />
      ))}
    </div>
  );
}

function Phone({ className = '' }: { className?: string }) {
  return (
    <span
      className={`absolute flex aspect-[9/18] flex-col gap-[3px] rounded-lg border-2 border-[#3a434e] bg-[#0d1014] p-1 ${className}`}
    >
      <i className="block h-3.5 rounded-sm" style={{ background: KIT_BLUE }} />
      <i className="block h-[5px] rounded-sm bg-[#242b33]" />
      <i className="block h-[5px] w-3/5 rounded-sm bg-[#242b33]" />
    </span>
  );
}

function Avatar({ className = '' }: { className?: string }) {
  return (
    <span
      className={`aspect-square shrink-0 rounded-full border-2 ${className}`}
      style={{
        borderColor: KIT_BLUE,
        background:
          'radial-gradient(circle at 50% 38%, #eef1f0 0 22%, transparent 23%), radial-gradient(ellipse at 50% 100%, #eef1f0 0 42%, transparent 43%), #242b33',
      }}
    />
  );
}

function CodeSnippet({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[5px] border border-[#242b33] bg-[#0d1014] px-1.5 py-1 font-mono text-[6.5px] leading-[1.55] text-canvas-muted-foreground">
      {children}
    </div>
  );
}

/** Four posts as the hero's picture. */
function DesignPreview() {
  return (
    <div className="grid h-full grid-cols-2 gap-2 p-3">
      <div className={POST}>
        <PostTag>Growth</PostTag>
        <Bars heights={[30, 45, 60, 100]} />
      </div>
      <div className={POST}>
        <CodeSnippet>
          <span style={{ color: KIT_BLUE }}>await</span>{' '}
          <span className="text-canvas-foreground">loadModel</span>({'{'} modelSrc {'}'})
        </CodeSnippet>
        <span className="text-micro font-extrabold leading-tight">New SDK release</span>
      </div>
      <div className={POST}>
        <span className="max-w-[52%] text-micro font-extrabold leading-tight">
          Now on <span style={{ color: KIT_BLUE }}>mobile</span>
        </span>
        <Phone className="right-[10%] top-[14%] w-[34%]" />
      </div>
      <div className={`${POST} !flex-row items-center gap-2`}>
        <Avatar className="w-[26%]" />
        <div>
          <PostTag>Live AMA</PostTag>
          <p className="mt-1 text-micro font-extrabold leading-tight">Ask the team anything</p>
        </div>
      </div>
    </div>
  );
}

function StudioChip({ on, children }: { on?: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded-md border px-1.5 py-1 font-mono text-micro ${on ? 'border-primary/50 text-primary' : 'border-canvas-border text-canvas-muted-foreground'}`}
    >
      {children}
    </span>
  );
}

function SectionDivider() {
  return (
    <div aria-hidden className="flex items-center gap-3">
      <span className="h-0.5 w-10 rounded-full bg-primary" />
      <span className="h-px flex-1 bg-canvas-border" />
    </div>
  );
}

/** A still of the studio: templates, the open post, and its UI kit, size and export. */
function StudioStill() {
  const tile = `${POST} aspect-[16/10] !p-1.5 text-[8px] font-extrabold`;
  return (
    <section id="studio" className="scroll-mt-24 space-y-6">
      <SectionDivider />
      <div className="space-y-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
          The studio
        </p>
        <h2 className="text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight text-canvas-foreground">
          Post about it
        </h2>
        <p className="max-w-2xl font-mono text-lead leading-[1.5] text-canvas-muted-foreground">
          Pick a template, switch it to your style, and export. Announcements, partnerships,
          threads, etc.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-canvas-border bg-canvas-muted">
        <div className="grid min-h-[360px] md:grid-cols-[56px_190px_1fr_200px]">
          <div className="hidden flex-col items-center gap-3 border-r border-canvas-border bg-canvas-raised py-3 md:flex">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              +
            </span>
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className="size-[18px] rounded border-[1.5px] border-canvas-dimmer" />
            ))}
          </div>
          <div className="hidden content-start gap-2 border-r border-canvas-border p-3 md:grid md:grid-cols-2">
            <div className={tile}>
              <Bars heights={[35, 55, 100]} />
              Growth
            </div>
            <div className={`${tile} outline outline-2 outline-offset-1 outline-primary`}>
              <span className="text-xs" style={{ color: KIT_BLUE }}>
                $1.2B
              </span>
              Milestone
            </div>
            <div className={tile}>
              <CodeSnippet>
                <span style={{ color: KIT_BLUE }}>await</span> run()
              </CodeSnippet>
              SDK release
            </div>
            <div className={tile}>
              Mobile
              <Phone className="right-[12%] top-[12%] w-[26%] !rounded-[5px] !border-[1.5px]" />
            </div>
            <div className={`${tile} !flex-row items-center gap-1.5`}>
              <Avatar className="w-[30%] !border-[1.5px]" />
              AMA
            </div>
            <div className={tile} style={{ background: KIT_BLUE, color: '#0b1a30' }}>
              Thread
              <span className="text-[7px] font-semibold">1 / 5</span>
            </div>
          </div>
          <div className="grid place-items-center bg-[#0f1216] p-5">
            <div className={`${POST} aspect-video w-full max-w-[380px] !p-5`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-body font-bold">
                  <span className="size-3.5 rounded-full" style={{ background: KIT_BLUE }} />
                  Your Brand
                </span>
                <PostTag>Milestone</PostTag>
              </div>
              <div>
                <p
                  className="text-[54px] font-extrabold leading-none tracking-tight"
                  style={{ color: KIT_BLUE }}
                >
                  $1.2B
                </p>
                <p className="mt-1 text-lead font-bold">total value settled on Your Brand</p>
              </div>
            </div>
          </div>
          <div className="hidden border-l border-canvas-border p-3.5 font-mono text-caption text-canvas-foreground md:block">
            <p className="mb-2 text-micro uppercase tracking-widest text-canvas-muted-foreground">
              UI kit
            </p>
            {STUDIO_KITS.map((k, i) => (
              <div
                key={k.name}
                className={`mb-1.5 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${i === 0 ? 'border-primary/50 bg-primary/10' : 'border-canvas-border'}`}
              >
                <span className="size-2.5 rounded-full" style={{ background: k.color }} />
                {k.name}
              </div>
            ))}
            <p className="mb-2 mt-4 text-micro uppercase tracking-widest text-canvas-muted-foreground">
              Size
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['X', 'IG', 'LinkedIn', 'Story'].map((s, i) => (
                <StudioChip key={s} on={i === 0}>
                  {s}
                </StudioChip>
              ))}
            </div>
            <p className="mb-2 mt-4 text-micro uppercase tracking-widest text-canvas-muted-foreground">
              Export
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['PNG', 'JPG', 'PDF', 'SVG'].map((s) => (
                <StudioChip key={s}>{s}</StudioChip>
              ))}
            </div>
          </div>
        </div>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {DESIGN_FACTS.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 font-mono text-sm leading-relaxed text-canvas-muted-foreground"
          >
            <span className="mt-0.5 text-primary">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeatureCards() {
  return (
    <section className="grid grid-cols-1 divide-y divide-canvas-border md:grid-cols-3 md:divide-x md:divide-y-0">
      {FEATURES.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex h-full flex-col bg-canvas-muted p-6 sm:p-7">
          <Icon className="size-3.5 text-primary" strokeWidth={2.5} aria-hidden />
          <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-canvas-foreground sm:text-xl">
            {title}
          </h3>
          <p className="mt-2.5 font-mono text-sm leading-relaxed text-canvas-muted-foreground">
            {body}
          </p>
        </div>
      ))}
    </section>
  );
}

function InstallCta() {
  return (
    <div className="rounded-2xl border border-canvas-border bg-canvas-muted p-6 sm:p-8">
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
            Try it
          </p>
          <h3 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-canvas-foreground">
            Ready to design your next post?
          </h3>
          <p className="mt-2 max-w-xl font-mono text-sm leading-relaxed text-canvas-muted-foreground sm:text-base">
            One install command. Runs offline. No accounts, no cloud.
          </p>
        </div>
        <div className="w-full min-w-0 md:w-[400px]">
          <InstallDemo />
        </div>
      </div>
    </div>
  );
}

function Copyright() {
  return (
    <footer className="flex flex-col items-center gap-2 pt-2 text-center font-mono text-xs text-canvas-muted-foreground sm:flex-row sm:justify-between sm:text-left">
      <p>© 2026 {PRODUCT_NAME}</p>
      <div className="flex items-center gap-3">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          title="GitHub"
          className="transition-colors hover:text-primary"
        >
          <Github className="size-4" />
        </a>
        <a
          href={X_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="X"
          title="X"
          className="transition-colors hover:text-primary"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
            <path d="M18.9 2H22l-7.2 8.2L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.7-8.8L1.8 2h6.8l4.7 6.2L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z" />
          </svg>
          <span className="sr-only">X</span>
        </a>
      </div>
    </footer>
  );
}
