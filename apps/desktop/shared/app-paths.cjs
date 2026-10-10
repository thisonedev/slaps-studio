// Where the app keeps its fallback encryption keys, and how a key file is locked
// down to its owner on Windows.
'use strict';

const os = require('os');
const path = require('path');

/**
 * Encryption keys, kept outside userData so a copy of the profile does not
 * carry the key that opens it.
 * @param {string} [home]
 * @returns {string}
 */
function secretsDir(home = os.homedir()) {
  return path.join(home, '.slaps-studio', 'keys');
}

const ACL_TRUSTED_ACCOUNTS = new Set(['NT AUTHORITY\\SYSTEM', 'BUILTIN\\ADMINISTRATORS', 'CREATOR OWNER']);

/**
 * Parses `icacls <path>` output into { account, groups } pairs. The path
 * prefix on the first line can contain spaces, so it's stripped by exact
 * match against `filePath` rather than split on whitespace.
 * @param {string} out
 * @param {string} filePath
 * @returns {{ account: string, groups: string[] }[]}
 */
function parseIcacls(out, filePath) {
  const entries = [];
  for (let line of out.split(/\r?\n/)) {
    if (!line.includes(':(')) continue;
    if (line.startsWith(filePath)) line = line.slice(filePath.length);
    line = line.trim();
    const idx = line.indexOf(':(');
    if (idx === -1) continue;
    const account = line.slice(0, idx).trim().toUpperCase();
    const groups = [...line.slice(idx + 1).matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
    entries.push({ account, groups });
  }
  return entries;
}

/**
 * Windows equivalent of `chmod 0600`: strips the ACL down to the current
 * user, the OS, and the admin group. `{ mode: 0o600 }` is silently
 * advisory on Windows, so a caller writing a real secret calls this after.
 * @param {string} filePath
 */
function restrictToOwnerWindows(filePath) {
  const { execFileSync } = require('child_process');
  const currentUser = os.userInfo().username;
  const run = (args) => execFileSync('icacls', args, { windowsHide: true, stdio: 'ignore' });
  try {
    // /grant:r only replaces the named account's own permission, so an
    // existing grant to an unrelated account survives unless removed first.
    run([filePath, '/inheritance:r']);
    const out = execFileSync('icacls', [filePath], { encoding: 'utf8', windowsHide: true });
    const currentUpper = currentUser.toUpperCase();
    const seen = new Set();
    for (const { account } of parseIcacls(out, filePath)) {
      if (seen.has(account) || account === currentUpper || account.endsWith(`\\${currentUpper}`)) continue;
      seen.add(account);
      if (ACL_TRUSTED_ACCOUNTS.has(account)) continue;
      try {
        run([filePath, '/remove:g', account]);
      } catch {
        // best-effort
      }
    }
    run([filePath, '/grant:r', `${currentUser}:F`, '/grant:r', 'SYSTEM:F', '/grant:r', 'Administrators:F']);
  } catch {
    // best-effort
  }
}

module.exports = { secretsDir, restrictToOwnerWindows };
