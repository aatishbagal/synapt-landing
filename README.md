# synapt-landing

The static site for synapt.aatish.io. Plain HTML, CSS and JS — **no framework, no build step, no dependencies.** Nothing to install, nothing to compile.

## Run it

Any static file server works. From this directory:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

Opening `index.html` directly via `file://` mostly works, but the release lookup uses `fetch`, which browsers block on `file://` — use the server.

## Deploy it

Upload the directory as-is to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3, nginx). There is no build command; the publish directory is this directory.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole page |
| `synapt.css` | All styling, including the app-UI recreations |
| `synapt.js` | Nav state, release lookup, install picker, link resolution |
| `assets/` | Logos and icons, copied from the app repos |
| `assets/atsh-symbol.svg` | The ATSH mark — the signature trigger itself |
| `assets/atsh-card-bg.png` | Signature card background (keep the alpha channel) |

## What you have to maintain

**Nothing, per release.** Versions, installer filenames, download URLs and file sizes are read from the GitHub releases API at page load. Tag a release and the site updates itself.

The one hand-written block is `SITE` at the top of `synapt.js`:

```js
var SITE = {
  owner: "aatishbagal",
  apps: {
    synapt:     { repo: "synapt",      name: "Synapt" },
    synaptclip: { repo: "synapt-clip", name: "SynaptClip" }
  },
  defaultBranch: "main"
};
```

Every GitHub URL on the page is derived from this. In the HTML they are written as tokens, not URLs:

```html
<a data-link="synapt">            <!-- repo root -->
<a data-link="synapt:releases">   <!-- /releases -->
<a data-link="synapt:latest">     <!-- /releases/latest -->
<a data-link="synapt:license">    <!-- /blob/<defaultBranch>/LICENSE -->
<a data-link="owner">             <!-- the user profile -->
```

Edit `SITE` only if a repo is renamed or moved, or a third app is added.

Things that *do* need a manual edit, and only when they actually change:

- **Feature copy** — the two `feat-grid` sections, when a major feature lands or changes.
- **Version display** — versions appear in the install box only, and come from the API.
  Don't reintroduce them next to app names, in the footer, or in section copy.
- **Platform cards** — the `#platforms` cards, when an OS, architecture or package
  format changes. Linux and Windows are x86_64 only today; only macOS is universal.
- **aatish.io signature** — the fixed bottom-right ATSH mark and the card it opens are
  ported from `marblearch-showcase/components/BottomOverlay.tsx` (+ its `.module.scss`).
  Two deliberate departures from that source: the trigger is the mark alone (no
  `AATISH.IO` wordmark, so no Monument Extended), and its hover is opacity only —
  no scale or motion, since it reads as an easter egg. GSAP is replaced by CSS
  transitions; only the pointer parallax is scripted, keeping the original tilt math
  and the
  10.0 / 2.5 parallax constants. Re-sync only if the shared signature is redesigned.
  `atsh-card-bg.png` **must stay a PNG** — its gradient sits on transparency and the
  card's `#0A0A0A` shows through it. Flattening it to JPEG turns the clear areas grey.
- **App UI recreations** — the `.app-synapt` and `.app-clip` blocks are hand-ported from
  `synapt/src/pages/Overlay.tsx` and `synapt-clip/src/components/Panel.tsx`, using each
  app's own palette from its `:root`. Re-sync them if those components get redesigned.

## Degradation

If the GitHub API is unreachable or rate-limited (60 requests/hour per IP, unauthenticated), version badges render empty and hide themselves, and the download button falls back to the releases page. No stale version is ever shown. Responses are cached in `localStorage` for an hour to keep repeat visits off the API.

The page loads nothing from a CDN except Google Fonts. No React, no bundler, no npm.

## Hover convention

Interactive elements change **colour, background, border and glow** on hover — never
position or size. There are no `translateY` lifts or `scale` hovers on buttons or
links. Keep it that way when adding anything new.
