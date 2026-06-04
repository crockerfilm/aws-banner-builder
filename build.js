'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Core = require('./core/banner');
const { checkBanner } = require('./lib/speccheck');

const ROOT = __dirname;
const brief = JSON.parse(fs.readFileSync(path.join(ROOT, 'inputs/brief.json'), 'utf8'));
const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/brand.json'), 'utf8'));
const sizes = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/sizes.json'), 'utf8'));

// Resolve an image asset to a base64 data URI, downscaling large files so banners stay light.
function dataURI(srcRel){
  if (!srcRel) return null;
  const abs = path.isAbsolute(srcRel) ? srcRel : path.join(ROOT, srcRel);
  if (!fs.existsSync(abs)) { console.warn('  ! asset not found: ' + srcRel); return null; }
  const ext = path.extname(abs).toLowerCase();
  const mime = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  let buf;
  try {
    const tmp = path.join(require('os').tmpdir(), 'awsbb_' + Date.now() + Math.random().toString(36).slice(2) + ext);
    execSync(`convert "${abs}" -resize 700x700\\> -strip "${tmp}"`, { stdio: 'ignore' });
    buf = fs.readFileSync(tmp); fs.unlinkSync(tmp);
  } catch (e) { buf = fs.readFileSync(abs); }
  return `data:${mime};base64,${buf.toString('base64')}`;
}
const _uriCache = {};
const cachedURI = (rel) => { if (rel == null) return null; if (!(rel in _uriCache)) _uriCache[rel] = dataURI(rel); return _uriCache[rel]; };
const assets = brief.assets || {};
const logoDataURI = cachedURI(assets.logo);

// zip is used to package each creative for DV360 upload; degrade gracefully if absent (e.g. minimal CI)
let HAS_ZIP = true;
try { execSync('command -v zip', { stdio: 'ignore' }); } catch { HAS_ZIP = false; console.warn('  ! zip not found — skipping .zip packaging (banners still generated)'); }

const OUT = path.join(ROOT, 'dist', brief.project);
const ZIPS = path.join(OUT, '_zips');
fs.rmSync(path.join(ROOT, 'dist', brief.project), { recursive: true, force: true });
fs.mkdirSync(ZIPS, { recursive: true });

const locales = brief.locales || ['en'];
const report = [];
const previewItems = [];
let built = 0, passed = 0, warned = 0;

for (const audience of brief.audiences) {
  for (const locale of locales) {
    if (!audience.copy[locale]) continue;
    for (const size of sizes) {
      const name = `${audience.id}_${locale}_${size.w}x${size.h}`;
      const dir = path.join(OUT, name);
      fs.mkdirSync(dir, { recursive: true });
      const heroDataURI = cachedURI(audience.image || assets.hero || null);
      const cp = audience.copy[locale];
      const html = Core.renderBanner({
        brand, size, locale,
        content: { headline: cp.headline, short: cp.short, subhead: cp.subhead, proof: cp.proof, cta: cp.cta },
        click: brief.clickThrough, logoText: brief.client.logoText,
        heroDataURI, logoDataURI, imageFit: assets.imageFit,
        anim: brief.animation || {},
        title: `${brief.product} – ${audience.label} – ${size.w}x${size.h} – ${locale}`
      });
      fs.writeFileSync(path.join(dir, 'index.html'), html);

      const res = checkBanner(dir, size);
      built++;
      if (res.pass) passed++;
      const w = res.checks.some(c => c.warn);
      if (w) warned++;

      // zip with index.html at archive root (DV360 requirement)
      if (HAS_ZIP) {
        const zipPath = path.join(ZIPS, name + '.zip');
        try { execSync(`zip -j -q "${zipPath}" "${path.join(dir, 'index.html')}"`); }
        catch (e) { /* non-fatal */ }
      }

      report.push({ name, audience: audience.label, locale, size: `${size.w}x${size.h}`, format: size.label, pass: res.pass, kb: +res.kb.toFixed(1), checks: res.checks });
      previewItems.push({ name, audience: audience.label, locale, size, rel: `${name}/index.html` });
    }
  }
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
writePreview(OUT, brief, previewItems, cachedURI(assets.hero));
writeDistIndex();

// console summary
const line = '─'.repeat(64);
console.log(line);
console.log(`  ${brief.product}  ·  ${brief.vertical}  ·  brief: ${brief.project}`);
console.log(line);
const pad = (s, n) => String(s).padEnd(n);
console.log(`  ${pad('CREATIVE', 30)}${pad('SIZE', 10)}${pad('KB', 8)}SPEC`);
for (const r of report) {
  const flag = r.pass ? (r.checks.some(c => c.warn) ? '✓ (backup TODO)' : '✓ pass') : '✗ FAIL';
  console.log(`  ${pad(r.audience + ' / ' + r.locale, 30)}${pad(r.size, 10)}${pad(r.kb, 8)}${flag}`);
}
console.log(line);
console.log(`  ${built} banners built · ${passed}/${built} pass · ${warned} need a backup image`);
console.log(`  ${brief.audiences.length} audiences × ${locales.length} languages × ${sizes.length} sizes`);
console.log(`  output: dist/${brief.project}/   ·   zips: dist/${brief.project}/_zips/`);
console.log(`  review: open dist/${brief.project}/preview.html`);
console.log(line);

function writeDistIndex() {
  const distRoot = path.join(ROOT, 'dist');
  // front door of the published site = the builder app (single self-contained file)
  try { fs.copyFileSync(path.join(ROOT, 'builder-standalone.html'), path.join(distRoot, 'index.html')); }
  catch (e) { console.warn('  ! could not copy builder to dist/index.html'); }
  try { fs.copyFileSync(path.join(ROOT, 'designer-standalone.html'), path.join(distRoot, 'designer.html')); } catch (e) {}
  const projects = fs.readdirSync(distRoot).filter(d => {
    try { return fs.statSync(path.join(distRoot, d)).isDirectory() && fs.existsSync(path.join(distRoot, d, 'preview.html')); }
    catch { return false; }
  });
  const links = projects.map(p => `<li><a href="${p}/preview.html">${p}</a></li>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>AWS DV360 Banner Builder — gallery</title>
<style>body{font-family:"Helvetica Neue",system-ui,Arial,sans-serif;background:#232F3E;color:#fff;padding:56px;max-width:680px;margin:auto}
h1{font-size:22px;letter-spacing:-0.3px}.r{display:inline-block;width:34px;height:4px;background:#FF9900;border-radius:2px;margin:10px 0 20px}
a{color:#FF9900;font-weight:700;text-decoration:none}a:hover{text-decoration:underline}li{margin:10px 0;font-size:15px}p{color:#C7CDD6;font-size:14px;line-height:1.5}</style></head>
<body><h1>AWS DV360 Banner Builder</h1><div class="r"></div>
<p><a href="index.html">▶ Open the Builder</a> &nbsp;·&nbsp; <a href="designer.html">▶ Open the Designer</a></p>
<p>Pre-generated banner sets:</p>
<ul>${links || '<li>(run <code>node build.js</code> to generate)</li>'}</ul></body></html>`;
  fs.writeFileSync(path.join(distRoot, 'gallery.html'), html);
}

function writePreview(outDir, brief, items, heroThumb) {
  const groups = {};
  for (const it of items) {
    const k = `${it.audience} · ${it.locale.toUpperCase()}`;
    (groups[k] = groups[k] || []).push(it);
  }
  const audienceList = brief.audiences.map(a => a.label).join(', ');
  const inputPanel = `<section class="inputs">
    <div class="incol">
      <div class="intag">INPUT · BRIEF</div>
      <table>
        <tr><td>Product</td><td>${brief.product}</td></tr>
        <tr><td>Vertical</td><td>${brief.vertical}</td></tr>
        <tr><td>Client</td><td>${brief.client.name}</td></tr>
        <tr><td>Audiences</td><td>${audienceList}</td></tr>
        <tr><td>Languages</td><td>${(brief.locales||['en']).map(l=>l.toUpperCase()).join(', ')}</td></tr>
      </table>
    </div>
    <div class="incol">
      <div class="intag">INPUT · IMAGE ASSET</div>
      ${heroThumb ? `<div class="thumb"><img src="${heroThumb}" alt="hero asset"></div>` : `<div class="thumb empty">geometric fallback (no image supplied)</div>`}
    </div>
    <div class="arrow">→</div>
    <div class="incol grow">
      <div class="intag">OUTPUT</div>
      <div class="bignum">${items.length}</div>
      <div class="biglabel">DV360 banners, spec-checked &amp; zipped</div>
    </div>
  </section>`;
  let body = '';
  for (const k of Object.keys(groups)) {
    body += `<h2>${k}</h2><div class="row">`;
    for (const it of groups[k]) {
      body += `<figure><div class="frame" style="width:${it.size.w}px;height:${it.size.h}px">
        <iframe src="${it.rel}" width="${it.size.w}" height="${it.size.h}" scrolling="no" frameborder="0"></iframe>
      </div><figcaption>${it.size.w}×${it.size.h} <span>${it.size.label}</span></figcaption></figure>`;
    }
    body += `</div>`;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${brief.product} — banner contact sheet</title>
<style>
  body{margin:0;padding:40px;background:#EDEFF2;font-family:"Helvetica Neue",system-ui,Arial,sans-serif;color:#232F3E}
  h1{font-size:22px;letter-spacing:-0.3px;margin-bottom:4px}
  .meta{color:#5A6675;font-size:13px;margin-bottom:22px}
  .inputs{display:flex;gap:22px;align-items:stretch;background:#fff;border:1px solid #DCE0E6;border-radius:10px;padding:20px 22px;margin-bottom:10px}
  .incol{display:flex;flex-direction:column;gap:8px}
  .incol.grow{justify-content:center;text-align:center;padding:0 8px}
  .intag{font-size:10px;font-weight:800;letter-spacing:1.2px;color:#8A95A3}
  .inputs table{border-collapse:collapse;font-size:12.5px}
  .inputs td{padding:2px 12px 2px 0;vertical-align:top}
  .inputs td:first-child{color:#8A95A3;font-weight:600}
  .thumb{width:96px;height:96px;background:#232F3E;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .thumb img{width:84%;height:84%;object-fit:contain}
  .thumb.empty{font-size:10px;color:#8A95A3;text-align:center;padding:8px}
  .arrow{display:flex;align-items:center;font-size:30px;color:#FF9900;font-weight:800}
  .bignum{font-size:42px;font-weight:800;color:#FF9900;line-height:1}
  .biglabel{font-size:12px;color:#5A6675;max-width:160px;margin:0 auto}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#5A6675;margin:34px 0 14px;border-bottom:1px solid #D5DAE0;padding-bottom:8px}
  .row{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start}
  figure{margin:0}
  .frame{box-shadow:0 4px 18px rgba(35,47,62,.18);background:#232F3E}
  iframe{display:block;border:0}
  figcaption{font-size:11px;color:#5A6675;margin-top:8px;font-weight:700}
  figcaption span{font-weight:400;color:#8A95A3}
  .replay{margin:14px 0 4px}
  button{font:inherit;font-size:12px;font-weight:700;background:#232F3E;color:#fff;border:0;border-radius:4px;padding:8px 14px;cursor:pointer}
</style></head>
<body>
  <h1>${brief.product} — ${brief.vertical}</h1>
  <div class="meta">One brief in → ${items.length} DV360 HTML5 banners out · client: ${brief.client.name}</div>
  ${inputPanel}
  <div class="replay"><button onclick="document.querySelectorAll('iframe').forEach(f=>f.src=f.src)">▶ Replay all animations</button></div>
  ${body}
</body></html>`;
  fs.writeFileSync(path.join(outDir, 'preview.html'), html);
}
