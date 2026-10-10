// The one dev switch. apps/cli installs a raw source checkout, so the app always
// runs unpackaged and app.isPackaged cannot tell a developer from a user.
const DEV_MODE = process.argv.includes('--dev');
// Unpackaged, Electron would otherwise show its dev-only warnings to users.
if (!DEV_MODE) process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// `slaps-studio start` pipes our stderr, and Ctrl+C closes that pipe before the app
// quits. On macOS the next log write then fails asynchronously with EPIPE.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (err) => {
    if (err?.code !== 'EPIPE') throw err;
  });
}

const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, net, protocol, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const env = require('../shared/env.cjs');
const { isMac, isLinux } = require('which-runtime');
const { command, flag } = require('paparam');
const { promises: fs } = require('node:fs');
const { checkRequiredLinuxLibs } = require('./linux-lib-hint.cjs');

// A missing library (e.g. no Vulkan loader) can crash several unrelated native
// addons the moment their require chain gets touched, each with a different,
// unhelpful error, so this checks once before any of them load.
const missingLibHint = checkRequiredLinuxLibs();
if (missingLibHint) {
  // dialog.showErrorBox is explicitly documented as safe pre-ready, for
  // exactly this: reporting a fatal error before the rest of startup runs.
  dialog.showErrorBox('Slaps Studio: missing system library', missingLibHint);
  app.exit(1);
  return; // Stop this module's own requires from ever reaching the fragile ones below.
}

// Before anything below can touch @qvac/sdk: it spawns its `bare` worker with no
// windowsHide, popping a console window per model load. See windows-spawn-hide-shim.cjs.
require('./windows-spawn-hide-shim.cjs');

// Has to run before whenReady; registration after that is silently ignored.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'studio',
    privileges: {
      // standard gives the renderer a stable origin; secure enables crypto APIs.
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

// Chromium only auto-picks a keyring backend via XDG_CURRENT_DESKTOP, unset
// on headless/minimal Linux even with a real keyring running, which silently
// drops identity sealing to a file key.
if (isLinux && !env.xdgCurrentDesktop()) {
  app.commandLine.appendSwitch('password-store', 'gnome-libsecret');
}

const {
  listModels,
  removeModel,
  pruneIncompleteDownloads,
  catalogue,
  onDownloadProgress,
  downloadModels,
  cancelDownloadQueue,
  downloadQueueState,
  onDownloadQueueProgress,
} = require('./models.cjs');
const { getDeviceInfo } = require('./device.cjs');
const modelStatus = require('./model-status.cjs');
const { quietCancel } = require('./quiet-cancel.cjs');
const diffusion = require('./diffusion.cjs');
const { createPearEnd } = require('./pear-end/index.cjs');
const IPC_CHANNELS = require('../shared/ipc-channels.cjs');
const {
  isAllowedUrl,
  localDevUrl,
  isTrustedSender,
  isPermissionAllowed,
  resolveStaticPath,
} = require('./window-trust.cjs');

// The origins the window was opened on. Empty until then, so nothing can call IPC earlier.
let appOrigins = [];

// A channel not in IPC_CHANNELS throws at startup.
function handle(channel, fn) {
  const schemaName = Object.hasOwn(IPC_CHANNELS, channel) ? IPC_CHANNELS[channel] : undefined;
  if (schemaName === undefined) {
    throw new Error(`unregistered IPC channel: ${channel}`);
  }
  ipcMain.handle(channel, async (evt, payload) => {
    if (!isTrustedSender(evt.senderFrame, appOrigins)) {
      throw new Error(`${channel}: refused, the caller is not an app page`);
    }
    const args =
      schemaName === null ? undefined : await parseIpc(schemaName, payload, channel);
    // A cancelled call is one log line and a value preload.js rethrows, for every channel.
    return quietCancel(channel, fn)(args, evt);
  });
}

// Shared Zod schemas from @studio/validation (ESM). Cached after first load.
let _ipcValidation = null;
async function loadIpcValidation() {
  if (!_ipcValidation) {
    _ipcValidation = await import('@studio/validation');
  }
  return _ipcValidation;
}

async function parseIpc(schemaName, value, label) {
  const v = await loadIpcValidation();
  const schema = v[schemaName];
  if (!schema) throw new Error(`unknown IPC schema: ${schemaName}`);
  return v.parseIpc(schema, value, label);
}

const pkg = require('../package.json');
const { gitCommit } = require('./git-commit.cjs');
const { name, productName } = pkg;
const appName = productName ?? name;

// Unset, this defaults to Electron's own name/icon: shows as "Electron" in
// the dock/menu bar/Activity Monitor for an unpackaged app. Set as early as
// possible (before app.whenReady()) to shrink the window where the OS shows
// Electron's own defaults during launch.
const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');
app.setName(appName);
if (isMac) app.dock?.setIcon(ICON_PATH);

const cmd = command(
  appName,
  flag('--storage <dir>', 'keep the app data in this folder'),
);
// Chromium switches like --no-sandbox share argv with ours, and paparam throws on
// the first one it doesn't know, which silently dropped --storage after it.
function ownFlags(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const [name] = argv[i].split('=');
    if (name !== '--storage') continue;
    out.push(argv[i]);
    if (!argv[i].includes('=') && i + 1 < argv.length) out.push(argv[++i]);
  }
  return out;
}

try {
  cmd.parse(ownFlags(app.isPackaged ? process.argv.slice(1) : process.argv.slice(2)));
} catch (err) {
  console.warn('[slaps-studio-desktop] flag parse warning:', err.message);
}

const pearStore = cmd.flags.storage;
if (pearStore) app.setPath('userData', pearStore);

// Point @qvac/sdk at a config this app controls, before anything requires it. It covers
// the SDK's own HTTP downloads, for models model-sideload.cjs's shortcut doesn't fetch itself.
const qvacConfigPath = path.join(app.getPath('userData'), 'qvac.config.json');
const DOWNLOAD_SECURITY_CONFIG = { requireHttpChecksum: true, requireSecureTransport: true };
if (!fsSync().existsSync(qvacConfigPath)) {
  fsSync().mkdirSync(path.dirname(qvacConfigPath), { recursive: true });
  fsSync().writeFileSync(qvacConfigPath, JSON.stringify(DOWNLOAD_SECURITY_CONFIG, null, 2));
}
if (!process.env.QVAC_CONFIG_PATH) process.env.QVAC_CONFIG_PATH = qvacConfigPath;

// Read once at startup: a running app keeps the code it started with.
const appInfo = { ...pkg, commit: gitCommit(path.resolve(__dirname, '..', '..', '..')) };
ipcMain.on('pkg', (evt) => {
  evt.returnValue = appInfo;
});

function sendToAll(channel, data) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, data);
  }
}

function getSafeStorage() {
  try {
    const { safeStorage } = require('electron');
    if (safeStorage?.isEncryptionAvailable?.()) return safeStorage;
  } catch {
    // not Electron
  }
  return null;
}

// Pear-end: identity and state (Corestore under userData/corestore).
const pearEnd = createPearEnd(app.getPath('userData'), { getSafeStorage });

handle('studio:state:get', async (key) => {
  const store = await pearEnd.store();
  return store.get(key);
});

handle('studio:state:set', async ({ key, value }) => {
  const store = await pearEnd.store();
  return store.set(key, value);
});

handle('studio:state:remove', async (key) => {
  const store = await pearEnd.store();
  return store.remove(key);
});

handle('studio:state:list', async () => {
  const store = await pearEnd.store();
  return store.list();
});

// Brand kits and saved designs, each in its own namespace, separate from
// studio:state above; see catalog-store.cjs.
handle('studio:catalog:save', async ({ kind, id, title, payload, preview }) => {
  const catalog = await pearEnd.catalog();
  return catalog.save(kind, id, title, payload, preview ?? null);
});

handle('studio:catalog:rename', async ({ kind, id, title }) => {
  const catalog = await pearEnd.catalog();
  return catalog.rename(kind, id, title);
});

handle('studio:catalog:get', async ({ kind, id }) => {
  const catalog = await pearEnd.catalog();
  return catalog.get(kind, id);
});

handle('studio:catalog:remove', async ({ kind, id }) => {
  const catalog = await pearEnd.catalog();
  return catalog.remove(kind, id);
});

handle('studio:catalog:list', async (kind) => {
  const catalog = await pearEnd.catalog();
  return catalog.list(kind);
});

handle('studio:catalog:disk-status', async () => {
  const catalog = await pearEnd.catalog();
  return catalog.diskStatus();
});

// The music and effects live with the desktop app, not in the web build, so
// the website never publishes them. The schema limits a name to letters, digits and hyphens.
handle('studio:sound:read', async (name) => {
  try {
    // A track is asked for as music-<name> and kept as music/<name>.ogg. The rest are effects.
    const file = name.startsWith('music-') ? `music/${name.slice(6)}` : `effects/${name}`;
    return await fs.readFile(path.join(__dirname, '..', 'assets', 'sounds', `${file}.ogg`));
  } catch {
    return null;
  }
});

handle('studio:window:minimize', (_args, evt) => {
  BrowserWindow.fromWebContents(evt.sender)?.minimize();
});

handle('studio:window:maximize', (_args, evt) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

handle('studio:window:close', (_args, evt) => {
  BrowserWindow.fromWebContents(evt.sender)?.close();
});

// Timer lives in the main process so closing the panel doesn't cancel the scrub.
handle('studio:clipboard:copy', async ({ text, scrubAfterMs }) => {
  clipboard.writeText(text);
  if (scrubAfterMs > 0) {
    const timer = setTimeout(() => {
      // Only clear if the clipboard still holds what we put there.
      if (clipboard.readText() === text) clipboard.clear();
    }, scrubAfterMs);
    // A pending scrub is not a reason to keep the app alive.
    if (typeof timer.unref === 'function') timer.unref();
  }
  return true;
});

handle('studio:models:list', async () => listModels());
handle('studio:models:remove', async (id) => removeModel(id));
handle('studio:models:catalogue', async () => catalogue());
// Runs entirely here, not in the renderer, so leaving the Settings page
// mid-batch doesn't stop or lose track of it.
handle('studio:models:downloadQueue', async (payload) => downloadModels(payload.scope, payload.names));
handle('studio:models:cancelDownloadQueue', async () => cancelDownloadQueue());
handle('studio:models:downloadQueueState', async () => downloadQueueState());
handle('studio:model:status:current', async () => modelStatus.currentStatus());
handle('studio:model:cancel-load', async () => diffusion.cancelLoad());

handle('studio:generate-image', async ({ prompt, model, width, height, seed, steps }) =>
  diffusion.generateImage(prompt, model, { width, height, seed, steps }),);
handle('studio:generate-image:cancel', async () => diffusion.cancelImage());

handle('studio:device:info', async () => getDeviceInfo());

// Registered at module load so they are live for the lifetime of the app.
modelStatus.onStatus((status) => sendToAll('studio:model:status', status));
onDownloadProgress((progress) => sendToAll('studio:models:download-progress', progress));
onDownloadQueueProgress((snapshot) => sendToAll('studio:models:download-queue', snapshot));

// --- Identity onboarding (never returns private material) ---
handle('studio:identity:status', () => pearEnd.identity().publicView());

handle('studio:identity:create', async () => {
  const result = await pearEnd.identity().createNew();
  // Mnemonic returned once for backup UI; not logged.
  return result;
});

handle('studio:identity:confirm-backup', async () => pearEnd.identity().confirmBackup());

handle('studio:identity:recover', async (mnemonic) => pearEnd.identity().recoverFromMnemonic(mnemonic));

// Destructive: wipe sealed identity from this device (seed not deleted if user still has backup).
handle('studio:identity:reset', async () => {
  const idm = pearEnd.identity();
  idm.resetLocal();
  return idm.publicView();
});

// --- Attested blob store (username) ---
// Handlers await idm.ready() first: init() decrypts the blob store async.
handle('studio:identity:set-username', async (payload) => {
  const idm = pearEnd.identity();
  if (idm.status() !== 'ready') return null;
  await idm.ready();
  return idm.setUsername(payload.username);
});
handle('studio:identity:get-username', async () => {
  const idm = pearEnd.identity();
  if (idm.status() !== 'ready') return null;
  await idm.ready();
  return idm.getUsername();
});
function installNavigationHardening(win, allowedOrigins) {
  // Keep the main window on app-owned origins; open anything else externally.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url).catch((err) => {
          console.warn('[slaps-studio-desktop] openExternal failed:', err?.message ?? err);
        });
      }
    } catch {
      // ignore malformed URLs
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isAllowedUrl(url, allowedOrigins);
    if (!allowed) {
      event.preventDefault();
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(url).catch(() => {});
        }
      } catch {
        // ignore
      }
    }
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 600,
    backgroundColor: '#070707',
    title: 'Slaps Studio',
    icon: ICON_PATH, // window/taskbar icon on Linux and Windows; macOS uses the dock icon set at top-of-file
    // No native title bar on macOS; the web header doubles as one. Other
    // platforms keep the default frame so the OS window controls stay usable.
    frame: !isMac,
    // macOS otherwise spends the first click on a window that is not in front on bringing it
    // forward, so a tab pressed straight from another app or from DevTools does nothing.
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (DEV_MODE && env.openDevTools()) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
  win.webContents.on('console-message', ({ level, message, lineNumber, sourceId }) => {
    // Chromium's own resize-loop guard, not a page error: it reports through this
    // channel directly rather than as a catchable window 'error' event, so it has
    // to be filtered here rather than from renderer-side JS.
    if (message === 'ResizeObserver loop completed with undelivered notifications.') return;
    // pnpm closes stdout once the launcher exits; a later write throws EPIPE.
    try {
      console.log(`[renderer ${level}] ${sourceId}:${lineNumber} ${message}`);
    } catch (err) {
      if (err?.code !== 'EPIPE') throw err;
    }
  });

  const outIndex = path.resolve(__dirname, '..', '..', 'web', 'out', 'index.html');
  const staticDir = path.resolve(__dirname, '..', '..', 'web', 'out');
  const staticExists = fsSync().existsSync(outIndex);
  const studioOrigin = 'studio://app/';
  // Auto-detecting whatever answered on :3000 used to let a stale, forgotten
  // `next dev` silently outrank a fresh `pnpm build`. PEAR_DEV_URL with --dev is
  // the only way to opt into a dev server.
  const devUrl = DEV_MODE ? localDevUrl(env.devUrl()) : null;
  if (env.devUrl() && !devUrl) {
    console.warn('[slaps-studio-desktop] ignoring PEAR_DEV_URL: it needs --dev and an http://localhost address');
  }
  if (devUrl) {
    console.log('[slaps-studio-desktop] loading', devUrl);
    await openOn(win, devUrl);
  } else if (staticExists) {
    console.log('[slaps-studio-desktop] serving', staticDir, 'on', studioOrigin);
    await openOn(win, studioOrigin);
  } else {
    console.warn('[slaps-studio-desktop] no static build found, run `pnpm build` in the repo root');
    installNavigationHardening(win, []);
    await loadInto(win, `data:text/html;charset=utf-8,${encodeURIComponent(NO_BUILD_PAGE)}`);
  }
}

// Shown instead of guessing at a local port: whatever answered there would get the IPC bridge.
const NO_BUILD_PAGE = `<!doctype html><meta charset="utf-8"><title>Slaps Studio</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#070707;color:#d4d4d4;font:15px system-ui">
<div style="text-align:center"><p>Slaps Studio has no build to show.</p>
<p>Run <code>pnpm build</code> in the repo root, then start the app again.</p></div>`;

async function openOn(win, origin) {
  appOrigins = [origin];
  installNavigationHardening(win, appOrigins);
  await loadInto(win, origin);
}

// A link clicked before the first page finishes loading starts a new navigation, and Electron
// rejects the first load with ERR_ABORTED. The newer page is loading fine, so that isn't a failure.
async function loadInto(win, url) {
  try {
    await win.loadURL(url);
  } catch (err) {
    if (err?.code !== 'ERR_ABORTED') throw err;
  }
}

function fsSync() {
  return require('node:fs');
}

// Policy lives in security-headers.cjs, shared with the web export's <meta> tag.
const { SECURITY_HEADERS } = require('./security-headers.cjs');
const { staticMimeFor } = require('./static-mime.cjs');

function registerStudioProtocol(staticDir) {
  protocol.handle('studio', async (request) => {
    const url = new URL(request.url);
    const resolved = resolveStaticPath(url.pathname, staticDir);
    if (!resolved) {
      return new Response('not found', { status: 404, headers: SECURITY_HEADERS });
    }
    let finalPath = resolved;
    try {
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) finalPath = path.join(resolved, 'index.html');
    } catch {
      if (!path.extname(resolved)) finalPath = path.join(`${resolved}/`, 'index.html');
      else {
        return new Response('not found', { status: 404, headers: SECURITY_HEADERS });
      }
    }
    // net.fetch streams so model files and bundles aren't buffered in full.
    const res = await net.fetch(pathToFileURL(finalPath).toString());
    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': staticMimeFor(finalPath),
        'Cache-Control': 'no-store',
        ...SECURITY_HEADERS,
      },
    });
  });
}

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  let shuttingDown = false;
  app.on('before-quit', (evt) => {
    if (shuttingDown) return;
    shuttingDown = true;
    evt.preventDefault();
    // The image model's bare worker is spawned by @qvac/sdk's loadModel and is
    // otherwise never torn down, leaking one orphaned process per session.
    diffusion
      .unload()
      .catch((err) => console.warn('[slaps-studio-desktop] model unload error:', err?.message ?? err))
      .finally(() => {
        pearEnd
          .shutdown()
          .catch((err) => console.warn('[slaps-studio-desktop] shutdown error:', err?.message ?? err))
          .finally(() => app.quit());
      });
  });
  // Ctrl+C sends SIGINT straight to this process. Node's default is to exit
  // immediately with no cleanup, which is how the processes above get
  // orphaned. Routing both through app.quit() gives them the same
  // before-quit teardown as a normal Quit.
  process.on('SIGINT', () => app.quit());
  process.on('SIGTERM', () => app.quit());
  app.whenReady().then(async () => {
    // Electron's 'windowMenu' role marker is what makes macOS auto-inject
    // Sonoma+ tiling items that log a bogus representedObject warning;
    // plain roles here avoid that marker so macOS never adds them.
    if (isMac) {
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          { role: 'appMenu' },
          { role: 'editMenu' },
          { role: 'viewMenu' },
          {
            label: 'Window',
            submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }, { role: 'close' }],
          },
          { role: 'help', submenu: [] },
        ]),
      );
    }
    const staticDir = path.resolve(__dirname, '..', '..', 'web', 'out');
    if (fsSync().existsSync(path.join(staticDir, 'index.html'))) {
      registerStudioProtocol(staticDir);
    }

    // Camera, microphone, location, notifications and the rest are refused: no page in the app uses them.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
      callback(isPermissionAllowed(permission, details.requestingUrl, appOrigins));
    });
    session.defaultSession.setPermissionCheckHandler((_wc, permission, requestingOrigin) =>
      isPermissionAllowed(permission, requestingOrigin, appOrigins),
    );

    // A force-quit mid-download leaves a truncated file at its final name (no .part + rename staging),
    // which then reads as fully installed forever. Sweep once per launch so the next load starts a
    // fresh download instead of reusing the truncated file.
    setImmediate(() => {
      pruneIncompleteDownloads()
        .then(({ removed }) => {
          if (removed.length > 0) {
            console.log('[slaps-studio-desktop] pruned truncated model downloads:', removed);
          }
        })
        .catch((err) => console.warn('[slaps-studio-desktop] pruneIncompleteDownloads failed:', err?.message ?? err));
    });

    // An app killed with SIGKILL never runs its own cleanup, so the QVAC worker
    // it spawned can outlive it; sweep once per launch for any left behind.
    setImmediate(() => {
      try {
        const { reapOrphanedQvacWorkers } = require('../shared/qvac-orphan-reaper.cjs');
        const killed = reapOrphanedQvacWorkers();
        if (killed.length > 0) {
          console.log('[slaps-studio-desktop] reaped orphaned QVAC workers:', killed);
        }
      } catch (err) {
        console.warn('[slaps-studio-desktop] reapOrphanedQvacWorkers failed:', err?.message ?? err);
      }
    });

    // Show the window first; opening the identity and the store can take a moment.
    createWindow().catch((err) => {
      console.error(err);
      app.quit();
    });
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(console.error);
    });

    // Background: identity and store. Safe to fail; each handler opens what it needs.
    setImmediate(() => {
      (async () => {
        try {
          const idm = pearEnd.identity();
          // A sealed record the keyring can no longer open otherwise reads as
          // "signed out", with the real reason only in the console.
          await idm.ready().catch(() => {});
          const initErr = idm.initError();
          if (initErr?.code === 'ERR_KEYRING_UNAVAILABLE') {
            dialog.showErrorBox(
              'Slaps Studio: OS keyring unavailable',
              `${initErr.message}\n\nUntil then this device reads as signed out.`,
            );
          }
          await pearEnd.store();
        } catch (err) {
          console.warn('[slaps-studio-desktop] background identity init:', err?.message ?? err);
        }
      })();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
