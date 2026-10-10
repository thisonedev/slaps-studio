# Slaps Studio Desktop

Electron shell that loads the Slaps Studio web app.

## Getting started

### Prerequisites

- Node.js 20.18+
- pnpm 9.15.9 (matches the workspace `packageManager` field)
- A built web export at `apps/web/out/`, or a running Next dev server on `:3000` (see Development below)

### Run the built app

```bash
pnpm start:desktop
```

or from `apps/desktop`:

```bash
pnpm start
```

The app serves `apps/web/out/` on the `studio://` scheme. With `--dev` (what `pnpm dev` passes), `PEAR_DEV_URL` wins if it is an `http://localhost` address; otherwise the app serves the static build. With no build it shows a page asking for `pnpm build`.

### Development

Run both commands from the repository root.

```bash
# terminal 1
pnpm dev                          # Next dev server with HMR on :3000

# terminal 2
PEAR_DEV_URL=http://localhost:3000 pnpm dev:desktop
```

In dev mode `PEAR_DEV_URL` wins over the static build, so changes to the web app hot-reload into the desktop window. `pnpm start:desktop` ignores it.

## Layout

| File | Purpose |
| --- | --- |
| `electron/main.js` | BrowserWindow, IPC handlers and the `studio://` static handler |
| `electron/preload.js` | exposes `window.studio` via contextBridge |
| `electron/identity/manager.cjs` | root + device identity (`keet-identity-key`): create and recover, sealed at rest |
| `electron/pear-end/` | facade that owns the identity and the Corestore-backed stores |
| `electron/state-store.cjs` | KV store behind `studio:state:*` |
| `electron/catalog-store.cjs` | saved designs and brand kits behind `studio:catalog:*` |
| `electron/models.cjs`, `electron/diffusion.cjs` | the image models AI elements use: download, remove, generate |
| `shared/` | IPC channel maps, environment variables, model download helpers |
| `assets/sounds/` | music and effects for video export |
| `tests/` | `unit/` and `helpers/` (shared fixtures) |

## Tests

```bash
pnpm test:unit
```

The runner is [brittle](https://github.com/holepunchto/brittle). The unit tests touch no network and spawn nothing, so CI runs them on every PR.

## Identity

The identity is a `keet-identity-key` root derived from a recovery phrase, plus a key for this device. The derivation is the same as in P2P Academy, so one recovery phrase gives the same identity in both apps.
