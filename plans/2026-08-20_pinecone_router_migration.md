# Plan: Migrate to Pinecone Router

## Motivation

The current routing is entirely manual: `parseRoute()` pattern-matches hashes, `_handleHash()` sets store state, `navigate()` calls `pushState` + updates store, and `x-show` toggles visibility. This creates several problems:

1. **Back button is broken** — no `popstate` listener, so the URL changes but the UI doesn't update
2. **Dual param pathways** — `navigate()` passes params directly, `_handleHash()` resolves them from data, and `ff-entry.js` has a third regex fallback. Three code paths for the same data.
3. **`pushState` bypasses `hashchange`** — manual sync between URL and store state is fragile
4. **No route validation** — malformed hashes silently fall back to map
5. **No declarative route definitions** — routes are implicit in `parseRoute()` logic and `x-show` conditions scattered across `index.html`

Pinecone Router (v7, actively maintained) solves all of these with declarative `x-route` templates, automatic popstate/hashchange handling, `$params` magic for route parameters, and handler middleware.

## Current Structure

```
Entry:     index.html — 6 route <div> blocks with x-show toggles
Routing:   js/utils.js:parseRoute() — hash → screen object
State:     js/app.js:Alpine.store('app') — currentRoute, _routeParams, headerTitle
Templates: Fetched in parallel by app.js, injected via innerHTML + Alpine.initTree()
Navigation: Components call $store.app.navigate(screen, params)
            navigate() does: set _routeParams → set currentRoute → pushState
            _handleHash() does: parseRoute → set currentRoute → resolve params
```

## Target Structure

```
Entry:     index.html — Pinecone <template x-route="..."> declarations
Routing:   Pinecone Router handles matching, popstate, hashchange
State:     Alpine store retains app data + route-resolved params
Templates: External HTML files loaded by Pinecone on route match
Navigation: $router.navigate(path) or programmatic via store
```

## Route Mapping

| Hash | Pinecone Route | Notes |
|------|---------------|-------|
| `#map` | `x-route="/"` | Default route |
| `#map/overview/:trailId/:routeId` | `x-route="/map/overview/:trailId/:routeId"` | Named params |
| `#catalog` | `x-route="/catalog"` | |
| `#species/:id` | `x-route="/species/:id"` | Named param |
| `#history` | `x-route="/history"` | |
| `#info` | `x-route="/info"` | |
| unknown | `x-route="notfound"` | Redirects to map |

## Design Decisions

### Template loading strategy

**Decision: Let Pinecone load templates externally via `x-template`.**

Current approach: `app.js` pre-fetches all 6 templates in parallel, injects via `innerHTML`, calls `Alpine.initTree()`.

Pinecone approach: Each `<template x-route="/path" template="/templates/name.html">` loads its template on route match.

Tradeoffs:
- **Pro:** Simpler `app.js` — no template fetching logic, no `Alpine.initTree()` calls
- **Pro:** Templates are loaded on-demand, not all upfront
- **Con:** First navigation to each route has a fetch delay (mitigated by service worker caching)
- **Con:** Templates must be self-contained (Alpine auto-initiates on injection)

### Map container strategy

**Decision: Keep the map container outside route templates.**

The current map.html template is just 4 lines — a container div and the legend. Pinecone re-injects templates on every route match, which would destroy the Leaflet DOM and force tile re-fetching on every visit to the map tab. Instead:

- Keep `#route-map` as a persistent `<div>` in `index.html` (outside `x-route`)
- Toggle its visibility with `x-show` based on `$router.context.path`
- The map.html template contains only the legend overlay (`x-data="mapLegend"`)
- Leaflet stays in the DOM permanently, avoiding tile re-fetching and duplicate listener issues

### Handler pattern

**Decision: Single parent `x-data` component with handler methods.**

Pinecone's `x-handler` looks for a method on the nearest enclosing `x-data` scope — NOT an `Alpine.data()` registration. Define all handlers as methods on one parent component wrapping `<main>`:

```html
<main x-data="routeHandlers">
  <template x-route="/" x-handler="handleMap" ...></template>
  ...
</main>
```

### Header title and filter visibility

**Decision: Keep `$store.app.showFilter` and `$store.app.headerTitle`.**

Handlers set these store properties on each route match. The header reads from the store. This avoids hardcoding path checks in the header template.

### Param access pattern

Two types of route data need different handling:

1. **Raw URL params** (`trailId`, `routeId`, species `id`) — available via `context.params` in handlers, and via `$params` magic inside templates
2. **Resolved detail objects** (species details, overview title/url/points) — looked up from `data.json` by the handler, stored in `$store.app.currentDetail` / `$store.app.overviewParams`

Components read resolved data from the store. No more `_routeParams`.

### Hash mode configuration

**Decision: Configure Pinecone for hash routing to preserve current URL format.**

```js
document.addEventListener('alpine:init', () => {
  Alpine.plugin(PineconeRouter)
  // Configure hash mode BEFORE Alpine.start()
})
```

Or via Pinecone's settings API. This keeps URLs as `#map`, `#species/flora-001` etc. — no format change, no broken bookmarks.

## Changes Required

### 1. ADD file

| File | Content |
|------|---------|
| `js/pinecone-router.min.js` | Vendored Pinecone Router v7 (download from jsDelivr CDN) |

### 2. MODIFY files

#### `index.html`

**Add Pinecone script** before Alpine (around line 161):
```html
<script src="js/pinecone-router.min.js"></script>
```
Must load before `js/alpine.min.js` (which has `defer`).

**Keep map container outside routes** — replace the current map route div (line 53) to stay persistent but toggle visibility:
```html
<!-- MAP (always in DOM, toggled by x-show) -->
<div x-show="$router.context.path === '/' || $router.context.path.startsWith('/map/overview')" id="route-map"></div>
```

**Replace other route sections** (lines 56-68) with Pinecone route declarations inside a handler-wrapping `<main>`:
```html
<main x-data="routeHandlers" class="pt-14 pb-16 min-h-screen">
  <!-- Map is persistent above, not inside x-route -->

  <template x-route="/map/overview/:trailId/:routeId" x-template="/templates/overview.html" x-handler="handleOverview"></template>
  <template x-route="/catalog" x-template="/templates/catalog.html" x-handler="handleCatalog"></template>
  <template x-route="/species/:id" x-template="/templates/species.html" x-handler="handleSpecies"></template>
  <template x-route="/history" x-template="/templates/history.html"></template>
  <template x-route="/info" x-template="/templates/info.html"></template>
  <template x-route="notfound" x-handler="handleNotFound"></template>
</main>
```

**Replace tab bar** (lines 73-98) — no `x-link` needed (Pinecone intercepts `<a>` clicks by default):
```html
<nav class="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-200 flex items-stretch z-30">
  <a href="/"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$router.context.path === '/' || $router.context.path.startsWith('/map/overview') ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">map</span>
    <span class="text-[10px] leading-tight font-medium">Map</span>
  </a>
  <a href="/catalog"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$router.context.path === '/catalog' || $router.context.path.startsWith('/species/') ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">collections_bookmark</span>
    <span class="text-[10px] leading-tight font-medium">Catalog</span>
  </a>
  <a href="/history"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$router.context.path === '/history' ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">photo_library</span>
    <span class="text-[10px] leading-tight font-medium">History</span>
  </a>
  <a href="/info"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$router.context.path === '/info' ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">info</span>
    <span class="text-[10px] leading-tight font-medium">Info</span>
  </a>
</nav>
```

**Update header filter button** — keep reading from store (set by handlers):
```html
<template x-if="$store.app.showFilter">
```
No change needed — handlers set `showFilter` on route match.

#### `js/app.js`

**Major simplification** — remove all routing logic, keep data fetching and store:

```js
document.addEventListener('alpine:init', () => {
  Alpine.plugin(PineconeRouter)

  Alpine.store('app', {
    data: null,
    loading: true,
    error: null,
    showFilter: false,
    headerTitle: 'Map',
    filterSettings: { type: { flora: true, fauna: true }, trail: 'all', sortBy: 'alphabetical' },
    markers: {},
    currentDetail: null,
    overviewParams: null,

    async init() {
      // Only fetch data.json — no template fetching
      try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        this.data = JSON.parse(await res.text());
      } catch (e) {
        console.error('[HC Garden] Data load error:', e);
        this.error = 'Failed to load data. Please refresh.';
      }
      this.loading = false;
    },

    saveMarkers(markers) { this.markers = { ...this.markers, ...markers }; },

    openCallout(locationId) {
      if (this.markers[locationId]) this.markers[locationId].openPopup();
    }
  });

  // Route handlers — defined as methods on a parent x-data component
  Alpine.data('routeHandlers', () => ({
    handleMap() {
      Alpine.store('app').headerTitle = 'Map';
      Alpine.store('app').showFilter = true;
      Alpine.store('app').currentDetail = null;
      Alpine.store('app').overviewParams = null;
      setTimeout(() => window.dispatchEvent(new CustomEvent('map-visible')), 100);
    },

    handleOverview(context) {
      const { trailId, routeId } = context.params;
      const data = Alpine.store('app').data;
      if (data && data['map'] && data['map'][trailId] && data['map'][trailId].route && data['map'][trailId].route[routeId]) {
        const route = data['map'][trailId].route[routeId];
        Alpine.store('app').overviewParams = {
          title: route.title,
          url: route.imageRef,
          points: (route.points || []).map(p => ({
            ...p,
            ...(p.params || {}),
            name: p.params ? p.params.name : undefined
          }))
        };
        Alpine.store('app').headerTitle = route.title;
      }
      Alpine.store('app').showFilter = false;
      Alpine.store('app').currentDetail = null;
    },

    handleCatalog() {
      Alpine.store('app').headerTitle = 'Catalog';
      Alpine.store('app').showFilter = true;
      Alpine.store('app').currentDetail = null;
      Alpine.store('app').overviewParams = null;
    },

    handleSpecies(context) {
      const { id } = context.params;
      const data = Alpine.store('app').data;
      if (id && data && data['flora&fauna'] && data['flora&fauna'][id]) {
        const details = data['flora&fauna'][id];
        Alpine.store('app').headerTitle = details.name || '';
        Alpine.store('app').currentDetail = details;
      }
      Alpine.store('app').showFilter = false;
      Alpine.store('app').overviewParams = null;
    },

    handleNotFound() {
      Alpine.store('app').headerTitle = 'Map';
      Alpine.store('app').showFilter = true;
      // Pinecone will redirect or show nothing; this suppresses the default error handler
    }
  }));
});
```

**Key points:**
- `Alpine.plugin(PineconeRouter)` is called inside `alpine:init` before Alpine starts
- Handlers receive `context` as first argument with `context.params` containing named route params
- Handlers set store properties that components reactively read
- `currentDetail` replaces `_routeParams.details`
- `overviewParams` replaces `_routeParams` for overview
- `handleNotFound` suppresses Pinecone's default `console.error` for unknown routes

#### `js/utils.js`

**Remove:**
- `parseRoute()` function (lines 89-104)
- `HEADER_TITLES` constant (lines 106-113)
- `getHeaderTitle()` function (lines 115-135)

**Keep:** `haversineDistance()`, `formatSciName()`, `rewriteUrls()`, `getFFEntryDetails()`

#### `js/components/ff-list.js`

**Replace** `viewSpecies` method (line 152-154):
```js
// Before:
viewSpecies(details) {
  Alpine.store('app').navigate('species', { details, hash: '#species/' + details.id });
}

// After:
viewSpecies(details) {
  Alpine.store('app').currentDetail = details;
  Alpine.store('app').headerTitle = details.name || '';
  this.$router.navigate('/species/' + details.id);
}
```

No other changes needed — `ffList` doesn't read route state directly. It gets filter events from the window event listener.

#### `js/components/ff-entry.js`

**Replace** `details` getter (lines 8-22):
```js
// Before:
get details() {
  let d = Alpine.store('app')._routeParams.details;
  if (d && d.name) return d;
  // regex fallback...
}

// After:
get details() {
  // 1. Check store (set by handler or by navigating component)
  const stored = Alpine.store('app').currentDetail;
  if (stored && stored.name) return stored;
  // 2. Fallback: look up from $params (available inside x-route template scope)
  const id = this.$params && this.$params.id;
  if (id) {
    const data = Alpine.store('app').data;
    if (data && data['flora&fauna'] && data['flora&fauna'][id]) {
      return data['flora&fauna'][id];
    }
  }
  return {};
}
```

**Replace** `goToLocation` method (lines 81-86):
```js
goToLocation(locationId) {
  this.$router.navigate('/');
  // Map is always in DOM; openCallout after map initializes
  setTimeout(() => {
    Alpine.store('app').openCallout(locationId);
  }, 200);
}
```

The 200ms delay is still fragile but necessary — the map needs time for `invalidateSize()` to complete after becoming visible. A future improvement would be to use a `map-ready` custom event.

#### `js/components/clickable-image.js`

**Replace** `params` getter (lines 9-11):
```js
// Before:
get params() {
  return Alpine.store('app')._routeParams || {};
}

// After:
get params() {
  return Alpine.store('app').overviewParams || {};
}
```

**Replace** `viewSpecies` method (lines 49-53):
```js
viewSpecies(pointName) {
  let details = this.getDetails(pointName);
  if (!details) return;
  Alpine.store('app').currentDetail = details;
  Alpine.store('app').headerTitle = details.name || '';
  this.$router.navigate('/species/' + pointName);
}
```

#### `js/components/filter-modal.js`

**Replace** route check in `openModal` (line 22):
```js
// Before:
this.enableFilter = Alpine.store('app').currentRoute === 'map'
  ? ['type', 'trail']
  : ['type', 'trail', 'sortBy'];

// After:
this.enableFilter = Alpine.store('app').showFilter
  ? ['type', 'trail']
  : ['type', 'trail', 'sortBy'];
```

This reads `showFilter` from the store (which handlers set), avoiding any direct path checking in the component. Simpler and decoupled.

#### `js/map.js`

**No changes to `_initMap()`, `_renderTrails()`, `_renderBirds()`, `_renderLegend()`, or `_updateVisibility()`.** These operate on the Leaflet map object and don't reference routing.

**Only change:** The `trail-callout-press` listener (lines 92-108) calls `Alpine.store('app').navigate()`. Replace with:
```js
document.addEventListener('trail-callout-press', (e) => {
  const locKey = e.detail;
  const [trailId, routeId] = locKey.split('/');
  const data = Alpine.store('app').data;
  const route = data['map'][trailId]?.route[routeId];
  if (!route) return;
  Alpine.store('app').overviewParams = {
    title: route.title,
    url: route.imageRef,
    points: (route.points || []).map(p => ({
      ...p,
      ...(p.params || {}),
      name: p.params ? p.params.name : undefined
    }))
  };
  Alpine.store('app').headerTitle = route.title;
  // Navigate using window.location since map.js runs outside Alpine component scope
  window.location.hash = '/map/overview/' + trailId + '/' + routeId;
});
```

**And** the polygon click handler (line 163-165):
```js
polygon.on('click', () => {
  Alpine.store('app').currentDetail = details;
  Alpine.store('app').headerTitle = details.name || '';
  window.location.hash = '/species/' + id;
});
```

Note: `map.js` runs outside Alpine component scope, so `$router` magic is unavailable. Use `window.location.hash` for navigation. Pinecone will detect the hashchange and route accordingly.

#### `js/service-worker.js`

**Bump cache name** (line 1):
```js
const CACHE_NAME = 'hc-garden-v5';
```

**Add Pinecone Router** to precache list (line 69+):
```js
"js/pinecone-router.min.js",
```

### 3. MODIFY templates

#### `templates/history.html`

**Fix multi-root issue** — currently has 2 root elements (a `<div>` and a `<template>`). Pinecone expects a single root. Wrap everything:
```html
<div>
  <div class="p-5">
    <p class="text-base text-gray-600 font-light text-justify mb-4">...</p>
  </div>
  <template x-if="$store.app.data">
    <div>
      <template x-for="(entry, key) in $store.app.data.historical" :key="key">
        ...
      </template>
    </div>
  </template>
</div>
```

#### `templates/map.html`

**No changes needed** — contains only the map container and legend div. The map container in `index.html` stays persistent; Pinecone loads this template only for the legend overlay.

Actually, since the map container is now persistent in `index.html`, this template should only contain the legend. But the current template already has the map container. Two options:

**Option A (recommended):** Remove map.html from Pinecone routes entirely. Keep the map container + legend as a persistent element in `index.html`. The `mapLegend` component initializes via its own `x-data` on the persistent element.

**Option B:** Keep map.html as-is and let Pinecone inject it. The map DOM gets recreated on each visit. Simpler but worse UX.

Going with Option A — the map section in `index.html` becomes:
```html
<!-- MAP (always in DOM) -->
<div x-show="$router.context.path === '/' || $router.context.path.startsWith('/map/overview')"
     id="route-map">
  <div id="map-container" class="relative">
    <div id="map" class="w-full h-full"></div>
    <div id="map-legend" class="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-1" x-data="mapLegend"></div>
  </div>
</div>
```

And `templates/map.html` is no longer fetched by Pinecone. Remove it from the service worker precache list if desired (or keep it for backward compat).

## Duplicate Event Listener Prevention

`map.js` registers `map-visible` and `trail-callout-press` listeners in `mapLegend.init()`. Since the map container is persistent (not re-injected by Pinecone), `init()` only runs once. No duplicate listener issue.

If Option B were chosen (map re-injected), `init()` would run on each visit, accumulating listeners. Mitigation: use `{ once: true }` or guard with a flag.

## Summary of Property Name Changes

| Old | New | Set by |
|-----|-----|--------|
| `$store.app.currentRoute` | `$router.context.path` | Pinecone |
| `$store.app._routeParams` | `$store.app.currentDetail` (species) / `$store.app.overviewParams` (overview) | Route handlers |
| `$store.app._routeParams.details` | `$store.app.currentDetail` | Route handlers |
| `currentRoute === 'map'` | `$router.context.path === '/'` | Pinecone |
| `currentRoute === 'catalog'` | `$router.context.path === '/catalog'` | Pinecone |

`$store.app.headerTitle` and `$store.app.showFilter` remain unchanged — set by handlers, read by header.

## Template Compatibility Notes

All templates have been verified for Pinecone compatibility:

| Template | x-data wrapper | Single root | Notes |
|----------|---------------|-------------|-------|
| `map.html` | `mapLegend` on child div | Yes | Map container stays persistent, not injected by Pinecone |
| `overview.html` | `clickableImage` | Yes | Reads from `$store.app.overviewParams` |
| `catalog.html` | `ffList` | Yes | No route-specific reads |
| `species.html` | `ffEntry` | Yes | Reads from `$store.app.currentDetail` + `$params` fallback |
| `history.html` | None (uses `$store`) | **No — must wrap** | Multi-root: div + template tag |
| `info.html` | None | Yes | Static content, no Alpine component |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `map.js` runs outside Alpine scope — `$router` unavailable | Can't navigate programmatically | Use `window.location.hash` for navigation from map.js |
| `$params` only available inside `x-route` template scope | Components can't read params outside templates | Use store as intermediary; `$params` as fallback in ff-entry |
| Template loading flash (first visit, no cache) | Brief blank content on first navigation | Service worker caches templates; add `pinecone:start`/`pinecone:end` loading indicator |
| `history.html` has multi-root elements | Pinecone injection fails | Wrap in single root div |
| `ff-list.js` re-builds arrays on each re-init | Performance regression on catalog revisit | Acceptable — list rebuild is fast; data is cached in store |
| `ff-entry.js` `goToLocation` race condition | Callout may not open if map isn't ready | 200ms delay (existing pattern); improve with `map-ready` event later |
| `filter-modal.js` needs to know current route | Shows wrong filter options | Read `showFilter` from store (set by handlers) |
| Hash mode not configured correctly | URLs change format, breaking bookmarks | Configure `hash: true` in Pinecone settings before Alpine starts |

## Implementation Steps

1. Download and vendor `pinecone-router.min.js` into `js/`
2. Update `templates/history.html` — wrap in single root div
3. Update `index.html` — add Pinecone script, make map persistent, add route declarations with `x-data="routeHandlers"`, update tab bar
4. Rewrite `js/app.js` — register Pinecone plugin, simplify store, add route handlers
5. Clean up `js/utils.js` — remove `parseRoute`, `HEADER_TITLES`, `getHeaderTitle`
6. Update `js/components/ff-list.js` — use `$router.navigate()` for species navigation
7. Update `js/components/ff-entry.js` — read from `$store.app.currentDetail` + `$params` fallback
8. Update `js/components/clickable-image.js` — read from `$store.app.overviewParams`, use `$router.navigate()`
9. Update `js/components/filter-modal.js` — read `showFilter` from store
10. Update `js/map.js` — use `window.location.hash` for navigation from event listeners
11. Update `js/service-worker.js` — bump cache name, add `js/pinecone-router.min.js`
12. Test all 6 routes navigate correctly
13. Test back/forward browser buttons
14. Test deep linking with hash URLs
15. Test child routes (overview, species) resolve params correctly
16. Test tab bar highlights correctly for parent/child routes
17. Test filter modal opens with correct options per route
18. Test map initializes once and stays in DOM across route changes
19. Test map callouts and polygons work after navigation
20. Test service worker caches Pinecone Router and serves from cache

## Verification

1. Open app — lands on Map tab, tab bar visible, correct highlight, map renders
2. Tap each tab — correct content, correct highlight, correct header title
3. From Map, tap trail marker → overview shows with correct title and image
4. From overview, tap hotspot → species detail shows with correct name and data
5. From Catalog, tap species → species detail shows
6. From species, tap "Go to location" → navigates to Map, callout opens
7. **Back button returns to previous screen correctly** (primary fix)
8. Forward button works after back
9. Deep link `#/species/flora-001` loads species detail
10. Deep link `#/map/overview/trail-01/route-01` loads overview
11. Unknown hash falls back to Map
12. Filter icon appears on Map and Catalog, hidden on History and Info
13. Filter modal shows trail filter on Map, sort filter on Catalog
14. Map does not flash/refetch tiles when revisiting
15. Map legend works correctly on Map tab
16. PWA: all routes work in standalone mode
17. Service worker caches Pinecone Router and serves from cache on reload
18. No duplicate event listeners after multiple map visits
