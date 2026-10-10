'use strict';

// Pins the navigation hardening's URL comparison and resolveStaticPath, which
// the studio:// protocol handler relies on. Node's URL serialises every
// non-special scheme to origin 'null', so a naive origin comparison would
// accept studio://evil/ alongside studio://app/.

const test = require('brittle');
const path = require('path');
const fs = require('fs');
const os = require('os');

const main = fs.readFileSync(
  path.resolve(__dirname, '../../electron/main.js'),
  'utf8',
);
const {
  isAllowedUrl: simulateWillNavigate,
  localDevUrl,
  isTrustedSender,
  isPermissionAllowed,
  resolveStaticPath,
} = require('../../electron/window-trust.cjs');

test('studio protocol - studio://app/ is allowed when studio://app is in the allowlist', (t) => {
  t.is(
    simulateWillNavigate('studio://app/', ['studio://app/']),
    true,
  );
});

test('studio protocol - studio://evil/ is refused when studio://app is in the allowlist', (t) => {
  t.is(
    simulateWillNavigate('studio://evil/', ['studio://app/']),
    false,
  );
});

test('studio protocol - origin comparison would accept studio://evil/ (the trap)', (t) => {
  const a = new URL('studio://app/').origin;
  const b = new URL('studio://evil/').origin;
  t.is(a, b, 'Node serialises both custom-scheme URLs to the same origin');
  t.is(a, 'null', 'both origins are the opaque string "null"');
});

test('studio protocol - studio://anything is refused when allowlist is empty', (t) => {
  t.is(simulateWillNavigate('studio://app/', []), false, 'no allowlist, no entry');
});

test('studio protocol - http(s) dev URLs compare on origin', (t) => {
  t.is(
    simulateWillNavigate('http://localhost:3000/page', ['http://localhost:3000']),
    true,
    'http origin equality still works',
  );
  t.is(
    simulateWillNavigate('http://localhost:9999/page', ['http://localhost:3000']),
    false,
    'different port is refused',
  );
  t.is(
    simulateWillNavigate('http://evil.example/', ['http://localhost:3000']),
    false,
    'different host is refused',
  );
});

test('studio protocol - main.js uses the shared check', (t) => {
  t.ok(/isAllowedUrl\(url, allowedOrigins\)/.test(main), 'will-navigate goes through isAllowedUrl');
  t.ok(/isTrustedSender\(evt\.senderFrame, appOrigins\)/.test(main), 'every IPC handler checks its caller');
});

test('studio protocol - resolveStaticPath rejects escapes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-proto-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');
  try {
    t.ok(resolveStaticPath('/', root) === root);
    t.ok(
      resolveStaticPath('/index.html', root) === path.join(root, 'index.html'),
    );
    t.is(resolveStaticPath('/../../../etc/passwd', root), null);
    t.is(resolveStaticPath('/%E0%A4%A', root), null, 'a malformed escape is a 404, not a throw');
    t.is(
      resolveStaticPath('/slaps-studio/index.html', root),
      path.join(root, 'index.html'),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('studio protocol - main.js no longer requires node:http', (t) => {
  t.absent(
    /require\('node:http'\)|require\('http'\)/.test(main),
  );
});

test('studio protocol - a dev URL must be plain http on localhost', (t) => {
  t.is(localDevUrl('http://localhost:3000'), 'http://localhost:3000/');
  t.is(localDevUrl('https://localhost:3000'), null, 'https is refused');
  t.is(localDevUrl('http://evil.example'), null, 'another host is refused');
  t.is(localDevUrl('http://localhost.evil.example'), null, 'a lookalike host is refused');
  t.is(localDevUrl('file:///etc/passwd'), null);
  t.is(localDevUrl('not a url'), null);
  t.is(localDevUrl(null), null);
});

test('studio protocol - IPC is for the top frame of an app page', (t) => {
  const origins = ['studio://app/'];
  t.is(isTrustedSender({ parent: null, url: 'studio://app/settings/' }, origins), true);
  t.is(isTrustedSender({ parent: {}, url: 'studio://app/settings/' }, origins), false, 'a subframe is refused');
  t.is(isTrustedSender({ parent: null, url: 'https://www.youtube-nocookie.com/' }, origins), false);
  t.is(isTrustedSender({ parent: null, url: 'data:text/html,hi' }, origins), false);
  t.is(isTrustedSender(null, origins), false, 'a frame that is already gone is refused');
  t.is(isTrustedSender({ parent: null, url: 'studio://app/' }, []), false, 'nothing is trusted before the window opens');
});

test('studio protocol - permissions are a short allowlist', (t) => {
  const origins = ['studio://app/'];
  t.is(isPermissionAllowed('clipboard-sanitized-write', 'studio://app/', origins), true);
  t.is(isPermissionAllowed('clipboard-read', 'studio://app', origins), true);
  t.is(isPermissionAllowed('clipboard-read', 'https://example.com', origins), false);
  for (const denied of ['fileSystem', 'fullscreen', 'media', 'geolocation', 'notifications', 'openExternal', 'hid', 'usb']) {
    t.is(isPermissionAllowed(denied, 'studio://app/', origins), false, `${denied} is refused`);
  }
});
