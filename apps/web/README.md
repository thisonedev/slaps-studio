# Slaps Studio (web)

The landing page in a browser and the studio inside the desktop app. Next.js 15, static export to `out/`.

## Development

```bash
pnpm dev          # Turbopack dev with HMR (recommended)
pnpm dev:webpack  # webpack dev, fallback if Turbopack misbehaves
```

The dev server runs on http://localhost:3000 by default.

## Build (static export)

```bash
pnpm build        # prebuild (packages, checks, lint) + next build
```

Output goes to `apps/web/out/`. The site is fully static; drop the directory on any static host.

## Routes

| Route | Shows |
| --- | --- |
| `/` | The studio in the desktop app, the landing page in a browser |
| `/settings` | Models, profile, device and about. Desktop only |
