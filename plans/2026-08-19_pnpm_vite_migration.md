# Plan: Migrate from Vendored Dependencies to pnpm + Vite Build

## Motivation

All JS/CSS dependencies (Alpine.js, Tailwind CSS, Leaflet) are currently vendored as full copies in `js/` and `css/`. This was done because CDN linking didn't work (likely GitHub Pages CSP or CORS issues). The result:

- **398KB** Tailwind CDN runtime that processes utility classes in the browser
- **44KB** Alpine.js vendored copy
- **144KB** Leaflet JS + **14KB** Leaflet CSS vendored copies
- No dependency management, no version pinning via lockfile, no easy updates

The goal is to use **pnpm** for dependency management and **Vite** for building, so dependencies are installed from npm and bundled at build time into optimized output.

---

## Target Architecture

```
Source (what you edit)              Build output (deployed to GitHub Pages)
─────────────────────               ─────────────────────────────────────
index.html                         dist/
src/main.js          ──Vite──►      index.html (processed, script tags injected)
src/app.js                         assets/main-[hash].js (bundled JS)
src/utils.js                       assets/style-[hash].css (built Tailwind CSS)
src/map.js                         assets/leaflet-[hash].js
src/style.css                      assets/leaflet-[hash].css
src/components/*.js                data.json
public/data.json                   assets/  (images, fonts, maps — copied as-is)
public/assets/**                   manifest.json
```

- **`src/`** — source JS and CSS (ES modules, Tailwind source)
- **`public/`** — static assets copied as-is to `dist/`
- **`dist/`** — built output, deployed to GitHub Pages via GitHub Actions

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `alpinejs` | `^3.14` | Alpine.js (ES module import instead of vendored CDN build) |
| `leaflet` | `^1.9` | Leaflet maps (ES module import) |
| `tailwindcss` | `^3.4` | Tailwind CSS (build-time CSS generation) |
| `postcss` | `^8` | CSS processing pipeline |
| `autoprefixer` | `^10` | Vendor prefix insertion |
| `vite` | `^6` | Build tool and dev server |

All as devDependencies except `alpinejs` and `leaflet` which are runtime dependencies (but since this is a static site, everything is devDependencies really).

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `package.json` | Project metadata, scripts, dependencies |
| `pnpm-lock.yaml` | Auto-generated lockfile |
| `vite.config.js` | Vite build configuration |
| `tailwind.config.js` | Tailwind content paths and theme |
| `postcss.config.js` | PostCSS plugins (Tailwind + Autoprefixer) |
| `src/main.js` | Entry point — imports all modules, starts Alpine |
| `src/style.css` | Main CSS — Tailwind directives + custom styles |
| `src/app.js` | Alpine store (converted from `js/app.js`) |
| `src/utils.js` | Helper functions (converted from `js/utils.js`) |
| `src/map.js` | Leaflet map (converted from `js/map.js`) |
| `src/components/*.js` | 7 Alpine components (converted from `js/components/`) |
| `public/data.json` | Moved from root |
| `public/manifest.json` | Moved from root |
| `public/.nojekyll` | Moved from root |
| `public/assets/**` | Moved from `assets/` |
| `public/js/service-worker.js` | Simplified service worker (no hardcoded URL list) |
| `.github/workflows/deploy.yml` | GitHub Actions: build + deploy to Pages |

### Modified Files

| File | Changes |
|------|---------|
| `index.html` | Remove vendored `<script>`/`<link>` tags, add `<script type="module" src="/src/main.js">` |
| `.gitignore` | Add `node_modules/`, `dist/` |

### Removed Files

| File | Reason |
|------|--------|
| `js/alpine.min.js` | Replaced by `alpinejs` npm package |
| `js/tailwind.js` | Replaced by build-time Tailwind CSS |
| `js/leaflet.js` | Replaced by `leaflet` npm package |
| `css/leaflet.css` | Replaced by `leaflet` npm package |
| `js/app.js` | Moved to `src/app.js` (ES module) |
| `js/utils.js` | Moved to `src/utils.js` (ES module) |
| `js/map.js` | Moved to `src/map.js` (ES module) |
| `js/components/*.js` | Moved to `src/components/` (ES modules) |
| `css/styles.css` | Merged into `src/style.css` |
| `data.json` | Moved to `public/data.json` |
| `manifest.json` | Moved to `public/manifest.json` |
| `.nojekyll` | Moved to `public/.nojekyll` |
| `assets/**` | Moved to `public/assets/` |

---

## ES Module Conversion

The biggest code change is converting from global-scope `<script>` tags to ES module `import`/`export`. Each file currently relies on globals (`Alpine`, `L`, `parseRoute`, `HEADER_TITLES`, etc.). These become explicit imports.

### `src/utils.js` — add exports

```js
// Existing functions stay the same, just add export keyword:
export function haversineDistance(lat1, lon1, lat2, lon2) { ... }
export function formatSciName(sciname) { ... }
export function rewriteUrls(data) { ... }
export function getFFEntryDetails(dbName, floraFaunaData) { ... }
export function parseRoute(hash) { ... }
export function getHeaderTitle(route, data) { ... }
export const HEADER_TITLES = { ... };
```

### `src/app.js` — import from utils, register store

```js
import Alpine from 'alpinejs';
import { parseRoute, HEADER_TITLES, getHeaderTitle, rewriteUrls } from './utils.js';

Alpine.store('app', {
  // ... same store definition, now has access to imported functions
});
```

No more `document.addEventListener('alpine:init', ...)` wrapper — the entry point controls load order.

### `src/components/*.js` — import Alpine + utils

Each component file changes from:

```js
// OLD: relies on global Alpine, parseRoute, HEADER_TITLES, etc.
document.addEventListener('alpine:init', () => {
  Alpine.data('sidebar', () => ({ ... }));
});
```

to:

```js
// NEW: explicit imports
import Alpine from 'alpinejs';
import { parseRoute, HEADER_TITLES } from '../utils.js';

Alpine.data('sidebar', () => ({ ... }));
```

### `src/map.js` — import Leaflet + utils

```js
import Alpine from 'alpinejs';
import L from 'leaflet';
import { HEADER_TITLES } from './utils.js';

Alpine.data('mapLegend', () => ({ ... }));
```

### `src/main.js` — entry point

```js
import Alpine from 'alpinejs';
import './style.css';

// Register stores and components (they register themselves on import)
import './app.js';
import './utils.js';
import './components/sidebar.js';
import './components/filter-modal.js';
import './components/ff-list.js';
import './components/ff-entry.js';
import './components/clickable-image.js';
import './components/lightbox.js';
import './components/overview.js';
import './map.js';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

// Start Alpine (replaces the deferred CDN script)
Alpine.start();
```

Key difference: **we call `Alpine.start()` explicitly** instead of relying on the CDN auto-start. This gives us control over when Alpine initializes — all stores and components are registered first.

---

## Tailwind CSS Build-Time Setup

### `tailwind.config.js`

```js
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### `src/style.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles (merged from css/styles.css) */
@font-face {
  font-family: 'Precious';
  src: url('/assets/fonts/Precious.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}

@keyframes pulse-ring { ... }
.leaflet-container { ... }
/* ... rest of custom styles ... */
```

Note: font URLs use absolute paths (`/assets/fonts/...`) because they reference files in `public/`.

### What changes for Tailwind

- **Before**: 398KB `tailwind.js` runs in the browser, processes classes at runtime
- **After**: `tailwindcss` CLI scans HTML/JS for used classes, generates ~10-30KB CSS at build time
- **No functional change** — same utility classes, same output
- **Build-time scanning** means any dynamically constructed class names (if any) need to be in the `safelist` in `tailwind.config.js`

---

## Vite Configuration

### `vite.config.js`

```js
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0, // don't inline any assets as base64
  },
  // No special config needed — Vite handles everything with defaults
};
```

Vite automatically:
- Processes `index.html` as entry point
- Bundles `<script type="module" src="/src/main.js">` and its imports
- Processes CSS imports (Tailwind, Leaflet CSS)
- Copies `public/` to `dist/`
- Adds hashed filenames for cache busting

---

## Service Worker

The current service worker hardcodes 32 file paths for pre-caching. With Vite's hashed output filenames, this approach breaks.

**Solution**: Simplify to a fetch-first caching strategy with no pre-cache list. Files get cached on first访问 and served from cache on subsequent visits. This still provides full offline support after the first load.

```js
const CACHE_NAME = 'hc-garden-v4';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Network-first for HTML
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
```

---

## GitHub Pages Deployment

### Before (manual)
Push to `main` → GitHub Pages serves root `/` directly.

### After (GitHub Actions)
Push to `main` → GitHub Actions runs `pnpm install && pnpm build` → deploys `dist/` to Pages.

### `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- `pnpm dev` — local dev server with hot reload
- `pnpm build` — build to `dist/`
- `pnpm preview` — preview the built output locally

---

## Implementation Steps

### Step 1: Initialize pnpm project
- Create `package.json`
- Run `pnpm add alpinejs leaflet`
- Run `pnpm add -D vite tailwindcss postcss autoprefixer`

### Step 2: Create build configuration
- Create `vite.config.js`
- Create `tailwind.config.js`
- Create `postcss.config.js`

### Step 3: Create `src/` directory structure
- Create `src/main.js` (entry point)
- Create `src/style.css` (Tailwind + custom styles merged from `css/styles.css`)

### Step 4: Convert JS files to ES modules
- Convert `js/utils.js` → `src/utils.js` (add `export` keywords)
- Convert `js/app.js` → `src/app.js` (import Alpine + utils, remove `alpine:init` wrapper)
- Convert `js/map.js` → `src/map.js` (import Alpine + L + utils)
- Convert `js/components/*.js` → `src/components/*.js` (import Alpine + utils)
- Each file: remove `document.addEventListener('alpine:init', ...)` wrapper, add imports

### Step 5: Create `public/` directory
- Move `data.json` → `public/data.json`
- Move `manifest.json` → `public/manifest.json`
- Move `.nojekyll` → `public/.nojekyll`
- Move `assets/` → `public/assets/`
- Create simplified `public/js/service-worker.js`

### Step 6: Update `index.html`
- Remove vendored `<script>` tags: `js/alpine.min.js`, `js/tailwind.js`, `js/leaflet.js`
- Remove vendored `<link>` tags: `css/leaflet.css`, `assets/fonts/google/lato.css`, `assets/fonts/google/material-icons.css`
- Add `<script type="module" src="/src/main.js"></script>` (replaces all JS script tags)
- Add font stylesheet links (keep these as they're in public/)
- Update service worker registration path

### Step 7: Update `.gitignore`
- Add `node_modules/`
- Add `dist/`

### Step 8: Clean up vendored files
- Delete `js/alpine.min.js`, `js/tailwind.js`, `js/leaflet.js`
- Delete `css/leaflet.css`, `css/styles.css`
- Delete old `js/` directory (now in `src/`)
- Delete old `assets/` directory (now in `public/assets/`)

### Step 9: Create GitHub Actions workflow
- Create `.github/workflows/deploy.yml`

### Step 10: Test
- Run `pnpm dev` and verify all screens work
- Run `pnpm build` and verify `dist/` output
- Run `pnpm preview` and verify built site works
- Test service worker offline support
- Verify map, species detail, search, filters all work

---

## Risk Areas

1. **Tailwind safelist**: If any class names are dynamically constructed (e.g., `text-${color}`), they need to be added to `tailwind.config.js` safelist. Scanning the HTML, all Tailwind classes appear to be hardcoded strings, so this should be fine.

2. **Alpine `alpine:init` event removal**: Currently all components register via `document.addEventListener('alpine:init', ...)`. With ES modules, we import them before calling `Alpine.start()`, so the event wrapper is no longer needed. The registration happens at import time.

3. **Leaflet CSS path**: Leaflet CSS references image assets (marker icons) via relative URLs. When imported via Vite, these paths need to resolve correctly. Vite handles this automatically when you `import 'leaflet/dist/leaflet.css'`.

4. **Font paths in CSS**: The `@font-face` for Precious uses `url('/assets/fonts/Precious.ttf')`. In development, Vite serves from root so `/assets/...` works. In production build, the CSS is bundled but the URL stays absolute, and `public/assets/` is copied to `dist/assets/`, so it works.

5. **Service worker scope**: The service worker is at `public/js/service-worker.js` and will be served from `dist/js/service-worker.js`. Its scope is `dist/js/` by default. For a site deployed to a subdirectory on GitHub Pages, this should work, but may need a `Scope` header or relocation to root if caching issues arise.

6. **Relative paths in `index.html`**: All asset references must remain relative (no leading `/`) for subdirectory deployment on GitHub Pages. Vite preserves the paths as written in `index.html`, so keep them relative.

---

## Expected Outcome

- **No vendored dependency files** in the repository
- **Dependencies managed via pnpm** with a lockfile for reproducible installs
- **Build step** produces optimized output in `dist/`
- **Smaller bundle**: Tailwind CSS drops from 398KB runtime to ~10-30KB build-time CSS
- **Automatic deployment** via GitHub Actions on push to `main`
- **Dev server** with hot reload for local development (`pnpm dev`)
- **Same functionality** — no user-facing changes
