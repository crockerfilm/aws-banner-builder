'use strict';
const fs = require('fs');
const path = require('path');

// DV360/CM360 display essentials. Verify exact current limits at:
// https://support.google.com/displayvideo (initial load + polite load, ad.size, clickTag, backup image)
const MAX_INITIAL_KB = 150; // IAB initial-load target; heavier assets should polite-load

function checkBanner(dir, size) {
  const checks = [];
  const indexPath = path.join(dir, 'index.html');
  const ok = (name, pass, detail) => checks.push({ name, pass, detail });

  if (!fs.existsSync(indexPath)) {
    ok('index.html present', false, 'missing');
    return { pass: false, checks };
  }
  const html = fs.readFileSync(indexPath, 'utf8');

  // total weight of the creative folder
  let bytes = 0;
  for (const f of fs.readdirSync(dir)) bytes += fs.statSync(path.join(dir, f)).size;
  const kb = bytes / 1024;

  ok('index.html present', true, '');
  ok('ad.size meta matches', html.includes(`content="width=${size.w},height=${size.h}"`), `${size.w}x${size.h}`);
  ok('clickTag declared in head', /var\s+clickTag\s*=/.test(html), 'DV360 pattern');
  ok(`initial load < ${MAX_INITIAL_KB}KB`, kb < MAX_INITIAL_KB, `${kb.toFixed(1)}KB`);
  ok('no infinite animation loop', !/iteration-count\s*:\s*infinite/i.test(html), 'single-play, holds end frame');
  ok('self-contained (no ext requests)', !/https?:\/\/[^"']+\.(js|css|png|jpg|woff2?)/i.test(html), '');
  // Backup image is a manual step (cannot rasterize HTML offline) — warn, do not fail.
  const hasBackup = fs.existsSync(path.join(dir, 'backup.jpg')) || fs.existsSync(path.join(dir, 'backup.png'));
  checks.push({ name: 'backup image', pass: true, warn: !hasBackup, detail: hasBackup ? 'present' : 'ADD before upload (manual)' });

  const pass = checks.every(c => c.pass);
  return { pass, kb, checks };
}

module.exports = { checkBanner, MAX_INITIAL_KB };
