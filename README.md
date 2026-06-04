# AWS DV360 Banner Builder

Brief in → DV360-spec HTML5 animated banners out. One concept versions across every size, audience, and language automatically. Built for the AWS Content Studio spec work.

**What it proves:** a working in-house templating/automation pipeline — the "we'd build the capability" story as a running artifact, not a promise. Template/code automation only: **no AI-generated humans, voiceover, or music** (AWS-compliant).

## The Builder (visual app)

`builder.html` is a dedicated, no-server app — **double-click it** (or open `builder-standalone.html`, a single self-contained file). It's the day-to-day tool:

- Edit **brief** fields, **brand colors**, **copy** per audience + language — live.
- Toggle **formats** (the 6 DV360 sizes) and **languages** on/off.
- Swap **animation** preset (fade-up, fade, slide, scale, wipe) and tune **duration / stagger / loops** with sliders.
- Upload a **hero image** and **logo** (downscaled + inlined in-browser).
- Add / remove **audiences**.
- **Live preview** of every variant updates as you type; **Replay** re-runs the animations.
- **Export:** "Download all (.zip)" for the banner set, per-tile "download" for one, or **"Export brief.json"** to feed the CLI for production-grade per-creative DV360 packaging.

Two halves, one engine (`core/banner.js` is shared): **builder = design + iterate**, **CLI (`node build.js`) = batch build + DV360 zips + CI/Pages deploy**. They always produce identical banners.

## Deploy on GitHub

**Zero dependencies** — pure Node (built-ins only) plus system `zip` + ImageMagick, both preinstalled on GitHub-hosted runners. Nothing to `npm install`.

```bash
git clone <your-repo-url> && cd aws-banner-builder
node build.js            # or: npm run build
open dist/bedrock-fintech-spec/preview.html
```

**Live preview via GitHub Pages (auto):** the included workflow (`.github/workflows/deploy.yml`) builds on every push to `main` and publishes `dist/` to Pages — so the team gets a shareable URL to the contact sheet instead of a zip.

One-time setup: in the repo, **Settings → Pages → Build and deployment → Source: GitHub Actions**. Then push to `main`; the run prints the live URL (e.g. `https://<org>.github.io/<repo>/bedrock-fintech-spec/preview.html`). _(Private-repo Pages requires a GitHub Team/Enterprise plan; a public or org-internal repo works out of the box.)_

`dist/` is gitignored and rebuilt by CI, so the repo stays clean — commit your `inputs/` (brief + assets) and the tool; the banners regenerate on deploy.

## Quickstart

```bash
node build.js
```

Outputs land in `dist/<project>/`:
- `audience_locale_WxH/index.html` — each self-contained banner (inline CSS/JS/SVG)
- `_zips/*.zip` — each banner zipped with `index.html` at root, ready to upload to DV360
- `preview.html` — **contact sheet: open this in a browser to review all banners live** (has a "Replay all animations" button)
- `report.json` — per-banner spec-check results

## How it works

```
inputs/brief.json     ← the B2B brief (edit this)
config/sizes.json     ← the DV360 size matrix + layout archetype per size
config/brand.json     ← AWS brand tokens + rules
lib/render.js         ← turns (brief × audience × size × locale) into one banner
lib/speccheck.js      ← validates dimensions, weight, clickTag, self-containment
build.js              ← loops everything, writes, spec-checks, zips, builds preview
```

One brief currently generates: **2 audiences × 2 languages × 6 sizes = 24 banners.**

## Editing the brief

`inputs/brief.json` is the only file a strategist needs to touch. Add an audience → its whole banner set generates. Add a locale to `locales` and the matching `copy` block → every banner versions into that language. `short` copy is used on the tight formats (728×90, 320×50).

## Image inputs

Drop assets into `inputs/assets/` and point to them in the brief:
- `assets.hero` — shared image used in the visual slot across box / billboard / skyscraper / half-page (the strip formats 728×90 and 320×50 stay text-only by design).
- `assets.logo` — optional; replaces the text wordmark with your logo image.
- per-audience `image` — overrides the shared hero for that audience.
- `assets.imageFit` — `contain` for logos/graphics (transparent PNG), `cover` for photos.

Images are auto-downscaled (max 700px) and inlined as base64, so every banner stays a single self-contained file. Supports png / jpg / webp. When no image is supplied, the geometric fallback renders — so the tool demos today with zero assets, and upgrades the moment the designer delivers.

**Handoff flow:** you demo today (fallback or sample asset) → designer makes the master beautiful → hand the design + assets back to dev → drop images in `inputs/assets/`, update the brief, `node build.js`.

## Extending

- **More sizes:** add to `config/sizes.json` with an `archetype` (`box`, `billboard`, `leaderboard`, `skyscraper`, `halfpage`, `mobile`).
- **Real brand font:** swap `fontStack` in `config/brand.json` to a bundled `Amazon Ember` woff2 (drop it next to the banner and `@font-face` it).
- **Real logo:** replace the text `logoText` with the locked `aws` asset in `lib/render.js`.

## DV360 readiness

What the export already satisfies (checked against Google's DV360 creative docs): `ad.size` meta, SSL/self-contained (no `http:` calls), one `.zip` per creative with `index.html` at root, well under the 5MB limit, `<body>` with no margin/padding, single-play animation, and a `clickTag` declared as a top-level `var clickTag` in the `<head>` (the pattern DV360's uploader scans for).

Before a live campaign:
1. **Validate a zip** with Google's free HTML5 validator (h5validator.appspot.com) — it's the authoritative "will this upload + does the click tag register" check.
2. **Backup/default image** — not required to upload (you can set one in DV360 at trafficking), but recommended as the fallback for environments that can't render HTML5. Add `backup.jpg` to a creative's folder, or assign it in DV360.
3. **Creative still needs a human** — automation handles *propagation* (sizes, languages, variants); the master concept is yours. That craft-plus-system split is the differentiator, not a gap to hide.

## How to present it

Fake brief → asset architecture → **this pipeline** → final banners. Open `preview.html`, hit "Replay all animations," and narrate: "one brief, one master concept, 24 compliant banners across audiences, sizes, and languages — here's the production system at AWS scale." Then note: this is the seed; partnering scales the long tail while we internalize.
