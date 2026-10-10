# Slaps Studio

A local design studio for social posts and threads, tailored for web3 and AI builders. Pick a template, switch it to your style, and export. A pnpm-workspace monorepo with three apps and five shared packages.

## Install via terminal (Mac/Linux)

```bash
curl -fsSL https://slapsstudio.cc/install.sh | sh
```

Installs to ~/.slaps-studio and adds slaps-studio to your PATH.

## Install via terminal (Windows)

Run this in **PowerShell**, not Command Prompt (`irm`/`iex` don't exist in `cmd.exe`):

```powershell
irm https://slapsstudio.cc/install.ps1 | iex
```

If the command above fails on Windows 10, run this one instead. It turns on TLS 1.2 first, which older builds leave off:

```powershell
[Net.ServicePointManager]::SecurityProtocol='Tls12'; irm https://slapsstudio.cc/install.ps1 | iex
```

The script installs git and Node into your user profile if they're missing.

Installs to `%USERPROFILE%\.slaps-studio` and adds `slaps-studio` to your PATH.

```bash
slaps-studio start              # launch the desktop app
slaps-studio update             # pull and safely build the newest release
slaps-studio update --channel latest  # follow master instead (saved; --channel stable switches back)
slaps-studio uninstall          # remove the studio app, CLI shim, and profile backups, but keep the profile key(s)
slaps-studio uninstall --purge  # remove everything, including profile key(s)
```

## Getting started

### Prerequisites

- Node.js 20.18+
- pnpm 9.15.9 (matches the workspace `packageManager` field)

### Setup

```bash
pnpm install
```

### Run the web app

```bash
pnpm dev          # Next.js dev with HMR on :3000
pnpm build        # build packages + web static export to apps/web/out/
pnpm start        # alias: pnpm start:web; serve the static export on :3000
```

In a browser the web app is the landing page. The studio itself runs in the desktop app.

### Run the desktop app

```bash
pnpm build            # build packages + web static export
pnpm start:desktop    # open the Electron shell
```

The desktop loads `apps/web/out/`. To hot-reload web changes into the desktop, run `pnpm dev` in one terminal and `PEAR_DEV_URL=http://localhost:3000 pnpm dev:desktop` in another. See `apps/desktop/README.md` for details.

## Layout

```
slaps-studio/
  apps/
    web/        Next.js 15. Static export at apps/web/out/.
    desktop/    Electron 40. See apps/desktop/README.md.
    cli/        The installer and the slaps-studio command.
  packages/
    config/         Shared TypeScript + Biome base config
    constants/      Public values shared across the apps
    validation/     Zod schemas (IPC payloads, window.studio contract)
    core/           Zustand store + storage adapters
    ui/             React components (the studio, settings, sign-in)
  .github/workflows/  deploy.yml, test-desktop.yml and the release and security checks
```

Each app and package has its own `package.json` and `tsconfig.json` (extending `packages/config/tsconfig.base.json`).

## Lint and format

```bash
pnpm lint         # biome lint
pnpm check        # biome check (lint + format)
pnpm check:write  # biome check --write, auto-fixes safe issues
pnpm format       # biome format --write
```

`pnpm lint` currently runs only on the web app (`apps/web/biome.json`). Packages extend `packages/config/biome.json` and can be linted individually with `biome check .` from inside each package.

## Funding

This is a community-owned project.

Buy me a coffee (USDT/USDC/ETH): `0x409072a91aa81C9759E1170993e29F8Ec83E6405`

For sponsorships or grant inquiries, contact [here](https://thisonedev.github.io/#contact).
