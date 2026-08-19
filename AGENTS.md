# AGENTS.md

## Project

HC Garden Revived — a static SPA for exploring Hwa Chong Institution's garden biodiversity. Pure HTML/CSS/JS, no build step, no transpilation. Deployed on GitHub Pages from `main` branch root.

## Local dev

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. No `npm install` or build step needed — all dependencies are vendored in `js/` and `css/`.

## Architecture

- **Entry point:** `index.html` — single page with route `<div>` blocks toggled by Alpine.js `x-show` directives.
- **Routing:** Hash-based (`#home`, `#species/flora-001`). Parsed in `js/utils.js:parseRoute()`.
- **Data:** `data.json` (Firebase export, ~4300 lines). Fetched at startup, stored in `Alpine.store('app').data`.
- **Templates:** HTML fragments in `templates/` fetched at runtime via `x-html`. Alpine auto-initializes injected content.
- **Components:** `js/components/*.js` register via `Alpine.data()` in `alpine:init` listeners.

### Script load order matters

All component JS files must load **before** `js/alpine.min.js` (which has `defer`). Alpine auto-starts on DOMContentLoaded. Breaking load order causes silent failures — no error, components just don't work.

### Data flow

1. `app.js` fetches `data.json` + all 10 templates in parallel via `Promise.allSettled`
2. Data stored in Alpine store, templates cached in `_templates`
3. `_handleHash()` runs after both complete, setting initial route
4. Components reactively read from the store

## Key gotchas

- **`assets/images/` is gitignored.** 566 species images are not in the repo. Run `archive/download_images.sh` (requires `rg`) to download from Imgur URLs in `data.json`. Locally, images load from Imgur directly.
- **Service worker hardcodes precache list** (`js/service-worker.js`, ~118 files). Adding new files requires updating this list manually.
- **`rewriteUrls()` in `utils.js` is dead code** — exists to convert Imgur URLs to local paths but is never called.
- **`js/components/lightbox.js` and `js/components/overview.js` are dead code** — not referenced by any template.
- **Cross-component communication** uses `window._userLat` / `window._userLon` globals (set by `ff-list.js`, read by `filter-modal.js`).
- **Known data bug:** `flora-117` is referenced in map data but missing from the species database. Three annotation points use `"MISSING INFO"` placeholders.
- **No CI/CD, no linting, no testing.** Push to `main` to deploy via GitHub Pages.
- **Planned migrations** exist in `plans/` (pnpm+Vite, tab nav rework). Check those before making major structural changes.
