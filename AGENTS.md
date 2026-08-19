# AGENTS.md

> **Remember:** If you make a change that affects architecture, adds a new component/route, or introduces a pattern worth noting, update this file so future agents don't have to rediscover it.

## Project

HC Garden Revived — a static SPA for exploring Hwa Chong Institution's garden biodiversity. Pure HTML/CSS/JS, no build step, no transpilation. Deployed on GitHub Pages from `main` branch root.

## Local dev

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. No `npm install` or build step needed — all dependencies are vendored in `js/` and `css/`.

## Architecture

- **Entry point:** `index.html` — single page with route `<div>` blocks toggled by Alpine.js `x-show` directives.
- **Routing:** Hash-based. Parsed in `js/utils.js:parseRoute()`.
- **Data:** `data.json` (Firebase export). Fetched at startup, stored in `Alpine.store('app').data`.
- **Templates:** HTML fragments in `templates/` fetched at runtime via `x-html`. Alpine auto-initializes injected content.
- **Components:** JS files register via `Alpine.data()` in `alpine:init` listeners. Use `init()` for setup, read shared state from `$store.app.*`.
- **Styling:** Tailwind CSS runtime CDN processes utility classes in the browser. Custom CSS in `css/styles.css` for what Tailwind can't express.

### Script load order matters

All component JS files must load **before** `js/alpine.min.js` (which has `defer`). Alpine auto-starts on DOMContentLoaded. Breaking load order causes silent failures — no error, components just don't work.

### Data flow

1. `app.js` fetches `data.json` + all templates in parallel via `Promise.allSettled`
2. Data stored in Alpine store, templates cached in `_templates`
3. `_handleHash()` runs after both complete, setting initial route
4. Components reactively read from the store

### Cross-component communication

- **Custom events on `window`** for decoupled signaling (e.g. `map-visible`, `filter-changed`)
- **Window globals** for shared user state (`window._userLat` / `window._userLon`)
- **Store properties** for shared app state (`$store.app.markers`, `$store.app._routeParams`, `$store.app.filterSettings`)

## Data model

`data.json` has three top-level sections: `flora&fauna` (species dictionary), `historical` (photos), and `map` (trails and routes). Species entries share common fields (`name`, `sciName`, `description`, `imageRef`, `locations`, `smallImage`); fauna entries additionally have GPS coordinates and habitat polygons for map rendering. See `data.md` for full field documentation.

## Routes

Hash-based routing. Unknown hashes fall back to `map`. Child routes (e.g. species detail) highlight their parent tab in the bottom nav.

## Key gotchas

- **`assets/images/` is gitignored.** Species images are not in the repo. Run `archive/download_images.sh` to download from Imgur URLs in `data.json`. Locally, images load from Imgur directly.
- **Service worker hardcodes precache list.** Adding new files requires updating this list manually.
- **No CI/CD, no linting, no testing.** Push to `main` to deploy via GitHub Pages.
- **Planned migrations** exist in `plans/`. Check those before making major structural changes.
