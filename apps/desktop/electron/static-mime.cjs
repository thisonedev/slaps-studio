'use strict';

const MIME_BY_EXT = Object.freeze({
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  woff2: 'font/woff2',
});

// Next's static export fetches each route's data as index.txt and treats it as route data only
// when it is served as text/plain. Anything else turns every in-app link into a full page reload.
function staticMimeFor(p) {
  const name = String(p || '').toLowerCase();
  if (name.endsWith('.txt')) return 'text/plain; charset=utf-8';
  const m = name.match(/[^./]+\.([a-z0-9]+)$/);
  return (m && MIME_BY_EXT[m[1]]) || 'application/octet-stream';
}

module.exports = { staticMimeFor };
