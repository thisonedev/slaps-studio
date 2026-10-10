// A loaded model nobody has used for this long is unloaded to free its memory.
'use strict';

const IDLE_UNLOAD_MS = 20 * 60 * 1000;

module.exports = { IDLE_UNLOAD_MS };
