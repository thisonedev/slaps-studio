// Shared fixtures. Every factory takes brittle's `t` and registers its own
// teardown, so a failing assertion cannot leak a temp dir.
'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

function tmpDir(t, label = 'tmp') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ta-${label}-`));
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }), { order: 4 });
  return dir;
}

module.exports = { tmpDir };
