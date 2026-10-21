# synapt-landing

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/images/logo/png/SynaptV2_White_PNG_512sq.png">
    <img src="./assets/images/logo/png/SynaptV2_Black_PNG_512sq.png" alt="Synapt" width="120">
  </picture>
</p>

<p align="center">
  <a href="https://synapt.aatish.io"><img alt="Website" src="https://img.shields.io/website?url=https%3A%2F%2Fsynapt.aatish.io&label=synapt.aatish.io&up_color=3b82f6"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/aatishbagal/synapt-landing?label=license"></a>
</p>

The website for Synapt and SynaptClip at [synapt.aatish.io](https://synapt.aatish.io). Plain HTML, CSS and JavaScript, with no framework, no build step and no dependencies, plus one small Cloudflare Pages Function that caches release data. Versions, downloads and release notes come live from the app repositories, so the site never needs an edit for a release.

## Features

- Download picker that detects your platform and links the right installer from the latest GitHub release
- Version numbers, installer names and file sizes read from the latest GitHub release at page load, through an edge-cached function shared by every visitor
- What's new section built from each app's `whatsnew.json` on its default branch
- Recreations of the Synapt overlay and the SynaptClip panel, ported from the apps' own UI code
- Platform cards for macOS, Windows and Linux
- No CDN dependencies apart from Google Fonts

## Run it

Any static file server works. From this directory:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

Opening `index.html` directly through `file://` mostly works, but the release lookup uses `fetch`, which browsers block on `file://`. Use the server.

A plain static server does not run the release function, so the page falls back to calling the GitHub API directly, which is fine for local work. To run the function too, use Wrangler:

```bash
npx wrangler pages dev .
```

## Deploy it

Cloudflare Pages deploys `main` automatically. There is no build command; the publish directory is this directory, and Pages picks up `functions/` on its own.

Optionally, add a `GITHUB_TOKEN` secret to the Pages project (Settings > Variables and Secrets). A fine-grained token with no permissions beyond public read access is enough. It raises the limit the release function runs under from 60 to 5,000 requests an hour. Without it the function still works, and its cache keeps it far below the lower limit.

Any other static host works too (GitHub Pages, Netlify, S3, nginx): upload the directory as it is. The function will not run there, and the page falls back to the GitHub API directly.

Work happens on `dev` (or a feature branch merged into `dev`), and merging `dev` into `main` deploys it.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole page |
| `synapt.css` | All styling, including the app UI recreations |
| `synapt.js` | Nav state, release lookup, install picker, What's new, link resolution |
| `functions/api/release/[repo].js` | Cloudflare Pages Function at `/api/release/<repo>`: the latest release, cached at the edge for 10 minutes, with a week-old copy kept for when GitHub is unavailable |
| `assets/images/logo/` | Synapt logos, copied from the app repositories |
| `assets/synapt-logo.svg` | Synapt mark used on the page |
| `assets/atsh-symbol.svg` | The ATSH mark, the aatish.io signature trigger |
| `assets/atsh-card-bg.png` | Signature card background (keep the alpha channel) |
| `assets/og-image.png` | 1200x630 link preview used by the Open Graph and Twitter tags |
| `assets/favicon-32.png`, `assets/favicon-48.png`, `assets/icon-192.png`, `apple-touch-icon.png` | PNG icons alongside the SVG favicon |
| `robots.txt`, `sitemap.xml` | Crawler rules and the sitemap |
| `llms.txt` | Plain-text summary of both apps for AI assistants and answer engines |

## What you have to maintain

**Nothing, per release.** Versions, installer filenames, download URLs, file sizes and release notes are read from GitHub at page load. Publish a release and the site updates itself.

The one hand-written block is `SITE` at the top of `synapt.js` (the release function repeats only the owner, as `OWNER`):

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

Every GitHub URL on the page is derived from it. In the HTML they are written as tokens, not URLs:

```html
<a data-link="synapt">            <!-- repo root -->
<a data-link="synapt:releases">   <!-- /releases -->
<a data-link="synapt:latest">     <!-- /releases/latest -->
<a data-link="synapt:license">    <!-- /blob/<defaultBranch>/LICENSE -->
<a data-link="owner">             <!-- the user profile -->
```

Edit `SITE` only if a repo is renamed or moved, or a third app is added.

Things that do need a manual edit, and only when they actually change:

- **Feature copy**: the two `feat-grid` sections, when a major feature lands or changes.
- **Search and AI summaries**: `llms.txt`, the JSON-LD block and the Open Graph and Twitter descriptions in `index.html`, alongside the feature copy. None of them carry a version.
- **Version display**: versions appear in the install box only, and come from the API. Don't reintroduce them next to app names, in the footer, or in section copy.
- **Platform cards**: the `#platforms` cards, when an OS, architecture or package format changes. Linux and Windows are x86_64 only today; only macOS is universal.
- **App UI recreations**: the `.app-synapt` and `.app-clip` blocks are hand-ported from `synapt/src/pages/Overlay.tsx` and `synapt-clip/src/components/Panel.tsx`, using each app's own palette. Re-sync them when those components are redesigned.
- **aatish.io signature**: the fixed bottom-right ATSH mark and the card it opens are the signature shared by the aatish.io projects. On this site the trigger is the mark alone and its hover changes opacity only, with no scale or motion. Only the pointer parallax is scripted; everything else is CSS transitions. Re-sync only if the shared signature is redesigned. `atsh-card-bg.png` must stay a PNG: its gradient sits on transparency and the card's `#0A0A0A` shows through, so flattening it to JPEG turns the clear areas grey.

## Degradation

The page asks `/api/release/<repo>` first. That function serves one cached copy of the latest release to every visitor, refreshing it every 10 minutes, so visitors no longer spend their own GitHub API allowance. If GitHub is unavailable when the copy expires, the function serves the last good copy, up to a week old.

If the function is missing or fails, the page calls the GitHub API directly, which allows 60 unauthenticated requests an hour per IP. If that fails too, version badges render empty and hide themselves, and the download button falls back to the releases page. Responses are cached in `localStorage` for an hour to keep repeat visits off both.

## Hover convention

Interactive elements change colour, background, border and glow on hover, never position or size. There are no `translateY` lifts or `scale` hovers on buttons or links. Keep it that way when adding anything new.

## Related

- [Synapt](https://github.com/aatishbagal/synapt): Spotlight-style launcher and LAN file utility
- [SynaptClip](https://github.com/aatishbagal/synapt-clip): clipboard manager with optional cross-device clipboard sharing
- [synapt-core](https://github.com/aatishbagal/synapt-core): shared library used across the Synapt apps

## License

Copyright 2026 Aatish Bagal

The site code is licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for the full text.

The Synapt and SynaptClip names and logos, and the aatish.io signature assets (`assets/atsh-symbol.svg` and `assets/atsh-card-bg.png`), are not covered by that license. All rights reserved.
