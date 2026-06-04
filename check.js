'use strict';
// Spec-check any creatives without rebuilding.
//   node check.js                  → checks everything under dist/
//   node check.js path/to.zip      → unzips + checks (e.g. the builder's "Download all" zip)
//   node check.js path/to/folder   → checks a folder of creatives (e.g. designer hand-off)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { checkBanner } = require('./lib/speccheck');

const arg = process.argv[2];
let scanDir, cleanup = null;

function findIndexes(root) {
  const out = [];
  (function walk(d) {
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'index.html') out.push(p);
    }
  })(root);
  return out;
}
function sizeFromHtml(html) {
  const m = html.match(/ad\.size"\s*content="width=(\d+),height=(\d+)"/);
  return m ? { w: +m[1], h: +m[2] } : null;
}

if (!arg) {
  scanDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(scanDir)) { console.error('No dist/ yet. Run `node build.js`, or pass a path: node check.js <folder|zip>'); process.exit(1); }
} else if (fs.existsSync(arg) && /\.zip$/i.test(arg)) {
  scanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'awsbb-check-'));
  cleanup = scanDir;
  try { execSync(`unzip -q "${arg}" -d "${scanDir}"`); }
  catch (e) { console.error('Could not unzip ' + arg); process.exit(1); }
} else if (fs.existsSync(arg)) {
  scanDir = arg;
} else { console.error('Path not found: ' + arg); process.exit(1); }

const indexes = findIndexes(scanDir);
const line = '─'.repeat(72);
const pad = (s, n) => String(s).padEnd(n);
console.log(line);
console.log('  SPEC CHECK · ' + scanDir);
console.log(line);
console.log('  ' + pad('CREATIVE', 46) + pad('SIZE', 9) + pad('WEIGHT', 10) + 'RESULT');

let pass = 0, fail = 0, warn = 0, skipped = 0;
const failures = [];
for (const idx of indexes) {
  const dir = path.dirname(idx);
  const html = fs.readFileSync(idx, 'utf8');
  const size = sizeFromHtml(html);
  const name = path.relative(scanDir, dir) || path.basename(dir);
  if (!size) { skipped++; continue; } // not a banner (e.g. the builder UI / a landing page)
  const nm = name.match(/(\d{2,4})x(\d{2,4})/);
  const named = nm ? { w: +nm[1], h: +nm[2] } : null;
  const dimMismatch = named && (named.w !== size.w || named.h !== size.h);
  const res = checkBanner(dir, size);
  const w = res.checks.some(c => c.warn);
  const ok = res.pass && !dimMismatch;
  const flag = ok ? (w ? '✓ (add backup img)' : '✓ pass') : '✗ FAIL';
  console.log('  ' + pad(name, 46) + pad(size.w + 'x' + size.h, 9) + pad(res.kb.toFixed(1) + 'KB', 10) + flag);
  if (ok) { pass++; if (w) warn++; }
  else {
    fail++;
    const cks = res.checks.filter(c => !c.pass);
    if (dimMismatch) cks.push({ name: 'ad.size matches filename', detail: 'meta says ' + size.w + 'x' + size.h + ', name says ' + named.w + 'x' + named.h });
    failures.push({ name, checks: cks });
  }
}
console.log(line);
console.log('  ' + pass + ' pass · ' + fail + ' fail · ' + warn + ' need a backup image' + (skipped ? ' · ' + skipped + ' non-banner file(s) skipped' : ''));
console.log(line);
if (failures.length) {
  console.log('\n  Failures:');
  for (const f of failures) {
    console.log('  • ' + f.name);
    for (const c of f.checks) console.log('      ✗ ' + c.name + (c.detail ? ' (' + c.detail + ')' : ''));
  }
}
if (cleanup) fs.rmSync(cleanup, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
