# Plan: Migrate to Pinecone Router

## Motivation

The current routing is entirely manual: `parseRoute()` pattern-matches hashes, `_handleHash()` sets store state, `navigate()` calls `pushState` + updates store, and `x-show` toggles visibility. This creates several problems:

1. **Back button is broken** — no `popstate` listener, so the URL changes but the UI doesn't update
2. **Dual param pathways** — `navigate()` passes params directly, `_handleHash()` resolves them from data, and `ff-entry.js` has a third regex fallback. Three code paths for the same data.
3. **`pushState` bypasses `hashchange`** — manual sync between URL and store state is fragile
4. **No route validation** — malformed hashes silently fall back to map
5. **No declarative route definitions** — routes are implicit in `parseRoute()` logic and `x-show` conditions scattered across `index.html`

Pinecone Router (v7, 327 stars, actively maintained) solves all of these with declarative `x-route` templates, automatic popstate/hashchange handling, `$params` magic for route parameters, and handler middleware.

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
State:     Alpine store retains app data; route params via $params magic
Templates: External HTML files loaded by Pinecone on route match
Navigation: $router.navigate(path) or <a x-link href="...">
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
| unknown | `x-route="notfound"` | Falls back to map |

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

This is acceptable because the service worker already caches all templates, so after first visit they load from cache instantly.

### Header title handling

Pinecone Router fires handlers on each route match. Use `x-handler` to set `headerTitle` and `showFilter` reactively instead of computing them in `_handleHash()`.

### Param access

Components currently read `Alpine.store('app')._routeParams`. After migration:
- Route params (trailId, routeId, species id) come from `$params` magic
- Full detail objects (species details, overview data) still need data lookups from the store
- Keep a thin `routeParams` store property that components can read, populated by route handlers

### Back button

Pinecone Router handles popstate natively — no custom listener needed. This is the primary correctness fix.

## Changes Required

### 1. ADD file

| File | Content |
|------|---------|
| `js/pinecone-router.min.js` | Vendored Pinecone Router v7 (download from jsDelivr CDN) |

### 2. MODIFY files

#### `index.html`

**Add Pinecone script** before Alpine (line 161 area):
```html
<script src="js/pinecone-router.min.js"></script>
```
Note: Must load before `js/alpine.min.js` which has `defer`.

**Replace route sections** (lines 52-68) with Pinecone route declarations:
```html
<main class="pt-14 pb-16 min-h-screen">
  <template x-route="/" x-template="/templates/map.html" x-handler="mapHandler"></template>
  <template x-route="/map/overview/:trailId/:routeId" x-template="/templates/overview.html" x-handler="overviewHandler"></template>
  <template x-route="/catalog" x-template="/templates/catalog.html" x-handler="catalogHandler"></template>
  <template x-route="/species/:id" x-template="/templates/species.html" x-handler="speciesHandler"></template>
  <template x-route="/history" x-template="/templates/history.html"></template>
  <template x-route="/info" x-template="/templates/info.html"></template>
  <template x-route="notfound" x-template="/templates/map.html"></template>
</main>
```

**Replace tab bar** (lines 73-98) to use `x-link` and `$router`:
```html
<nav class="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-200 flex items-stretch z-30">
  <a x-link href="/"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$router.path === '/' || $router.path.startsWith('/map/overview') ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">map</span>
    <span class="text-[10px] leading-tight font-medium">Map</span>
  </a>
  <a x-link href="/catalog"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$router.path === '/catalog' || $router.path.startsWith('/species/') ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">collections_bookmark</span>
    <span class="text-[10px] leading-tight font-medium">Catalog</span>
  </a>
  <a x-link href="/history"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$router.path === '/history' ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">photo_library</span>
    <span class="text-[10px] leading-tight font-medium">History</span>
  </a>
  <a x-link href="/info"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$router.path === '/info' ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">info</span>
    <span class="text-[10px] leading-tight font-medium">Info</span>
  </a>
</nav>
```

**Update header filter button** to read route from `$router` instead of store:
```html
<template x-if="$router.path === '/' || $router.path === '/catalog'">
```

#### `js/app.js`

**Major simplification** — remove all routing logic:

- Remove `parseRoute` import/usage
- Remove `_handleHash()` method
- Remove `_resolveOverviewParams()` and `_resolveSpeciesParams()` methods
- Remove `navigate()` method
- Remove `hashchange` listener
- Remove template fetching and `Alpine.initTree()` calls
- Keep: data fetching, store initialization, `filterSettings`, `markers`, `openCallout()`

**Add route handlers** as `Alpine.data()` registrations:
```js
Alpine.data('mapHandler', () => ({
  init() {
    Alpine.store('app').headerTitle = 'Map';
    Alpine.store('app').showFilter = true;
    setTimeout(() => window.dispatchEvent(new CustomEvent('map-visible')), 100);
  }
}));

Alpine.data('overviewHandler', () => ({
  init() {
    const params = this.$params; // Pinecone named params
    const data = Alpine.store('app').data;
    // Resolve overview data from trailId/routeId
    // Set headerTitle, showFilter, store routeParams
  }
}));

Alpine.data('catalogHandler', () => ({
  init() {
    Alpine.store('app').headerTitle = 'Catalog';
    Alpine.store('app').showFilter = true;
  }
}));

Alpine.data('speciesHandler', () => ({
  init() {
    const params = this.$params;
    const data = Alpine.store('app').data;
    // Resolve species from params.id
    // Set headerTitle, showFilter, store routeParams
  }
}));
```

**Simplified store** — `currentRoute` and `_routeParams` become less central:
```js
Alpine.store('app', {
  data: null,
  loading: true,
  error: null,
  showFilter: false,
  headerTitle: 'Map',
  filterSettings: { type: { flora: true, fauna: true }, trail: 'all', sortBy: 'alphabetical' },
  markers: {},

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

  saveMarkers(markers) { ... },
  openCallout(locationId) { ... }
});
```

#### `js/utils.js`

**Remove:**
- `parseRoute()` function
- `HEADER_TITLES` constant
- `getHeaderTitle()` function

**Keep:** `haversineDistance()`, `formatSciName()`, `rewriteUrls()`, `getFFEntryDetails()`

#### `js/components/ff-list.js`

**Replace** `Alpine.store('app').navigate('species', ...)` calls with Pinecone navigation:
```js
// Before:
Alpine.store('app').navigate('species', { details, hash: '#species/' + details.id });

// After:
// Store details so speciesHandler can find them, then navigate
Alpine.store('app').pendingSpeciesDetails = details;
this.$router.navigate('/species/' + details.id);
```

#### `js/components/ff-entry.js`

**Replace** param reading from store with `$params`:
```js
// Before:
get details() {
  let d = Alpine.store('app')._routeParams.details;
  if (d && d.name) return d;
  // regex fallback...
}

// After:
get details() {
  const params = this.$params;
  const id = params.id;
  if (!id) return {};
  const data = Alpine.store('app').data;
  if (data && data['flora&fauna'] && data['flora&fauna'][id]) {
    return data['flora&fauna'][id];
  }
  return {};
}
```

**Replace** `goToLocation` navigation:
```js
goToLocation(locationId) {
  this.$router.navigate('/');
  // openCallout still needs the map to be initialized
  // May need a small delay or event-based approach
}
```

#### `js/components/clickable-image.js`

**Replace** param reading and navigation:
```js
// Before:
get params() {
  return Alpine.store('app')._routeParams || {};
}

// After:
get params() {
  // Overview params need to come from the handler or store
  return Alpine.store('app').overviewParams || {};
}

viewSpecies(pointName) {
  let details = this.getDetails(pointName);
  if (!details) return;
  Alpine.store('app').pendingSpeciesDetails = details;
  this.$router.navigate('/species/' + pointName);
}
```

#### `js/components/filter-modal.js`

**Replace** route check:
```js
// Before:
this.enableFilter = Alpine.store('app').currentRoute === 'map' ? [...] : [...];

// After:
this.enableFilter = this.$router.path === '/' || this.$router.path.startsWith('/map/')
  ? ['type', 'trail']
  : ['type', 'trail', 'sortBy'];
```

#### `js/map.js`

**Replace** `navigate` calls with `$router.navigate()`:
```js
// Before:
Alpine.store('app').navigate('overview', { title, url, points, hash });
Alpine.store('app').navigate('species', { details, hash });

// After:
Alpine.store('app').pendingOverviewParams = { title, url, points };
this.$router.navigate('/map/overview/' + trailId + '/' + routeId);
// ...and for species:
Alpine.store('app').pendingSpeciesDetails = details;
this.$router.navigate('/species/' + id);
```

#### `js/service-worker.js`

Add Pinecone Router to the precache list:
```js
"js/pinecone-router.min.js",
```

## Route Handler Pattern

Since Pinecone Router re-renders templates on each route match, handlers need to:

1. Set header title and filter visibility
2. Look up detail data from the store (for overview/species)
3. Store resolved params for child components to read

```js
// Pattern for data-dependent routes:
Alpine.data('speciesHandler', () => ({
  init() {
    const id = this.$params.id;
    const data = Alpine.store('app').data;
    if (id && data && data['flora&fauna'] && data['flora&fauna'][id]) {
      const details = data['flora&fauna'][id];
      Alpine.store('app').headerTitle = details.name || '';
      Alpine.store('app').showFilter = false;
      Alpine.store('app').currentDetail = details;
    }
  }
}));
```

Components then read from `Alpine.store('app').currentDetail` instead of `_routeParams.details`.

## Key Considerations

### Template self-containment

Pinecone injects external templates via `innerHTML` and Alpine auto-initializes them. Each template must be a complete Alpine component scope (wrapped in a div with `x-data`). Verify all 6 templates have proper `x-data` wrappers.

### Map re-initialization

The map template is re-injected on each visit to `/`. Pinecone destroys the old template content and injects fresh HTML. This means the Leaflet map DOM is destroyed and recreated — `map.js` will need to re-initialize on each map visit. This is actually cleaner than the current approach (no stale state), but may feel slower. Consider keeping the map container outside the route template and only toggling its visibility.

### `$params` scope

Pinecone's `$params` magic is available inside `x-route` template scopes. Components defined via `Alpine.data()` that are used inside templates can access `this.$params`. Components used across multiple routes (like `ffEntry`) need to handle missing params gracefully.

### Hash format change

URLs change from `#map/overview/trail-01/route-01` to `#/map/overview/trail-01/route-01` (leading `/`). This breaks existing bookmarks. Add redirect logic or configure Pinecone to use hash mode without the leading slash.

**Mitigation:** Pinecone supports hash mode configuration. Set `mode: 'hash'` and configure the base to match current URL structure.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pinecone re-injects templates on every route match | Map reinitializes each visit, losing tile cache | Consider keeping map container outside route templates |
| `$params` not available in `Alpine.data()` components | Components can't read route params | Use store as intermediary for param passing |
| Template loading flash (first visit, no cache) | Brief blank content on first navigation | Service worker caches templates; add loading indicator |
| Hash format change breaks bookmarks | Users with old URLs land on wrong route | Add hash redirect or configure Pinecone to match current format |
| Pinecone CDN script adds load time | Slightly slower initial page load | Vendor the minified JS locally (~259KB unpacked) |
| `filter-modal.js` reads route to decide filter options | Modal shows wrong filters | Read from `$router.path` instead of store |

## Implementation Steps

1. Download and vendor `pinecone-router.min.js` into `js/`
2. Update `index.html` — add script tag, replace route sections with `x-route`, update tab bar
3. Simplify `js/app.js` — remove routing logic, add route handlers, keep data fetching
4. Clean up `js/utils.js` — remove `parseRoute`, `HEADER_TITLES`, `getHeaderTitle`
5. Update `js/components/ff-list.js` — use `$router.navigate()` for species navigation
6. Update `js/components/ff-entry.js` — read params from `$params`/store instead of `_routeParams`
7. Update `js/components/clickable-image.js` — use `$router.navigate()` and store for params
8. Update `js/components/filter-modal.js` — read route from `$router.path`
9. Update `js/map.js` — use `$router.navigate()` for overview/species navigation
10. Update `js/service-worker.js` — add `js/pinecone-router.min.js` to precache
11. Test all 6 routes navigate correctly
12. Test back/forward browser buttons
13. Test deep linking with hash URLs
14. Test child routes (overview, species) resolve params correctly
15. Test tab bar highlights correctly for parent/child routes
16. Test filter modal opens with correct options per route
17. Test map initializes and reinitializes correctly
18. Test service worker caches Pinecone Router file

## Verification

1. Open app — lands on Map tab, tab bar visible, correct highlight
2. Tap each tab — correct content, correct highlight, correct header title
3. From Map, tap trail marker → overview shows with correct title and image
4. From overview, tap hotspot → species detail shows with correct name and data
5. From Catalog, tap species → species detail shows
6. From species, tap "Go to location" → navigates to Map, callout opens
7. Back button returns to previous screen correctly
8. Forward button works after back
9. Deep link `#/species/flora-001` loads species detail
10. Deep link `#/map/overview/trail-01/route-01` loads overview
11. Unknown hash falls back to Map
12. Filter icon appears on Map and Catalog, hidden on History and Info
13. Filter modal shows trail filter on Map, sort filter on Catalog
14. PWA: all routes work in standalone mode
15. Service worker caches Pinecone Router without errors
