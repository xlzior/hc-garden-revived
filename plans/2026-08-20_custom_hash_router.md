# Plan: Custom Hash Router

## Problem

The browser back/forward button doesn't update the UI. After navigating via tabs or map interactions, pressing back changes the URL but the screen stays stuck.

There are also two parallel code paths that set route state, making the system fragile and hard to reason about.

## Root Cause

`navigate()` (app.js:100) uses `history.pushState()` to update the URL, but the only listener is `hashchange` (app.js:82). **`pushState` does not fire `hashchange`** — it fires `popstate` on back/forward. There is no `popstate` listener, so back/forward does nothing.

Additionally, two code paths set route state independently:

1. **`navigate()`** (called by tabs, map, catalog, species) — sets `_routeParams` directly from the caller, then calls `pushState`
2. **`_handleHash()`** (called on `hashchange` and init) — re-resolves `_routeParams` from `data.json` using the URL hash

These paths can disagree. `_handleHash()` is never called after `navigate()`, so programmatic navigation creates a state that `_handleHash()` would overwrite on next `hashchange`.

## Design Principle

**The URL is the single source of truth.** One function derives all state from the URL. Navigation only changes the URL.

## Changes

### 1. `js/app.js` — Add `popstate` listener + simplify `navigate()`

**Add `popstate` listener** (line 82):
```js
// Before:
window.addEventListener('hashchange', () => this._handleHash());

// After:
window.addEventListener('popstate', () => this._handleHash());
```

Use `popstate` instead of `hashchange` because:
- `popstate` fires on back/forward (the primary use case)
- `popstate` does NOT fire when `pushState` is called (we handle that separately in `navigate()`)
- `hashchange` does NOT fire after `pushState` either — it only fires when `location.hash` is set directly

**Simplify `navigate()`** to only change the URL and trigger state derivation:
```js
// Before (lines 100-115):
navigate(screen, params) {
  this._routeParams = params || {};
  if (screen === 'species' && params && params.details) {
    this.headerTitle = params.details.name;
  } else if (screen === 'overview' && params && params.title) {
    this.headerTitle = params.title;
  } else {
    this.headerTitle = HEADER_TITLES[screen] || screen;
  }
  this.currentRoute = screen;
  this.showFilter = (screen === 'map' || screen === 'catalog');
  this._setMapVisible(screen === 'map' || screen === 'overview');
  if (params && params.hash) {
    window.history.pushState(null, '', params.hash);
  }
},

// After:
navigate(screen, hash) {
  window.history.pushState(null, '', hash);
  this._handleHash();
},
```

`navigate()` no longer sets any state directly. It pushes a URL, then calls `_handleHash()` to derive everything. `_handleHash()` is now the **single state derivation function** for all navigation — programmatic, back/forward, and initial load.

**Remove `getHeaderTitle` dependency** — inline the header title logic in `_handleHash()`. **Resolve functions MUST run first** so `_routeParams` is populated before deriving the title:
```js
_handleHash() {
  const hash = window.location.hash || '#map';
  const parsed = parseRoute(hash);
  this.currentRoute = parsed.screen;
  this.showFilter = (parsed.screen === 'map' || parsed.screen === 'catalog');
  this._setMapVisible(parsed.screen === 'map' || parsed.screen === 'overview');
  // Resolve params FIRST — these populate _routeParams and set headerTitle
  if (parsed.screen === 'overview') {
    this._resolveOverviewParams(parsed);
  }
  if (parsed.screen === 'species') {
    this._resolveSpeciesParams(parsed);
  }
  // Then derive header title from resolved params (or fallback to static titles)
  if (parsed.screen === 'overview' && this._routeParams.title) {
    this.headerTitle = this._routeParams.title;
  } else if (parsed.screen === 'species' && this._routeParams.details?.name) {
    this.headerTitle = this._routeParams.details.name;
  } else {
    this.headerTitle = HEADER_TITLES[parsed.screen] || parsed.screen;
  }
},
```

**Remove `getHeaderTitle()` function** from `js/utils.js` (lines 115-135). The logic is now inlined in `_handleHash()`. The function was only called from `_handleHash()` and its object-form branch was dead code.

**Remove `this.headerTitle = ...`** from `_resolveOverviewParams` (line 159) and `_resolveSpeciesParams` (line 167). `_handleHash()` now derives `headerTitle` after calling these functions, so the resolve functions only need to populate `_routeParams`.

### 2. Update callers of `navigate()` — pass hash instead of params object

Every caller currently does `navigate(screen, { details, hash, title, ... })`. Change them to `navigate(screen, hash)` since state is now derived from the URL.

**`index.html`** (tab bar, 4 calls):
```html
<!-- Before: -->
@click.prevent="$store.app.navigate('map', { hash: '#map' })"
@click.prevent="$store.app.navigate('catalog', { hash: '#catalog' })"
@click.prevent="$store.app.navigate('history', { hash: '#history' })"
@click.prevent="$store.app.navigate('info', { hash: '#info' })"

<!-- After: -->
@click.prevent="$store.app.navigate('map', '#map')"
@click.prevent="$store.app.navigate('catalog', '#catalog')"
@click.prevent="$store.app.navigate('history', '#history')"
@click.prevent="$store.app.navigate('info', '#info')"
```

**`js/map.js`** — trail-callout-press (line 100):
```js
// Before:
Alpine.store('app').navigate('overview', {
  title: route.title,
  url: route.imageRef,
  points: [...],
  hash: '#map/overview/' + trailId + '/' + routeId
});

// After:
Alpine.store('app').navigate('overview', '#map/overview/' + trailId + '/' + routeId);
```

**`js/map.js`** — polygon click (line 166):
```js
// Before:
Alpine.store('app').navigate('species', { details, hash: '#species/' + id });

// After:
Alpine.store('app').navigate('species', '#species/' + id);
```

**`js/components/ff-list.js`** — viewSpecies (line 139):
```js
// Before:
Alpine.store('app').navigate('species', { details, hash: '#species/' + details.id });

// After:
Alpine.store('app').navigate('species', '#species/' + details.id);
```

**`js/components/clickable-image.js`** — viewSpecies (line 52):
```js
// Before:
Alpine.store('app').navigate('species', { details, hash: '#species/' + pointName });

// After:
Alpine.store('app').navigate('species', '#species/' + pointName);
```

**`js/components/ff-entry.js`** — goToLocation (line 95):
```js
// Before:
Alpine.store('app').navigate('map', { hash: '#map' });

// After:
Alpine.store('app').navigate('map', '#map');
```

### 3. Remove dead code

**`js/utils.js`** — remove `getHeaderTitle()` (lines 115-135). The logic is now inlined in `_handleHash()`. The object-form branch (lines 125-132) was never called.

**`js/app.js`** — remove `store.openCallout()` and `store.saveMarkers()`. The `store.markers` object is never populated (no call to `saveMarkers()` exists). The actual callout opening happens via `mapLegend.openCallout()` in map.js, called from `ff-entry.js:97` which calls `Alpine.store('app').openCallout()` — but since `store.markers` is empty, this silently fails. This is a pre-existing bug unrelated to routing, but should be noted.

Actually — the `store.openCallout` bug needs a separate fix. Don't remove it yet, just note it. The `ff-entry.js:97` call `Alpine.store('app').openCallout(locationId)` should instead dispatch a custom event that `mapLegend` listens for, or `map.js` should register its `openCallout` on the store. This is out of scope for this plan but should be tracked.

### 4. Summary of property changes

| Property | Before | After |
|---|---|---|
| `currentRoute` | Set by both `navigate()` and `_handleHash()` | Set only by `_handleHash()` |
| `_routeParams` | Set by `navigate()` (from caller) and `_resolve*Params()` | Set only by `_resolve*Params()` |
| `headerTitle` | Set by `navigate()`, `_handleHash()`, and `_resolve*Params()` | Set only by `_handleHash()` |
| `showFilter` | Set by both `navigate()` and `_handleHash()` | Set only by `_handleHash()` |
| `_mapHidden` | Set by `_setMapVisible()`, called from both paths | Set by `_setMapVisible()`, called only from `_handleHash()` |

Every property is now written in exactly one place: `_handleHash()` (or functions it calls).

## Files to Change

| File | Change |
|---|---|
| `js/app.js` | Add `popstate` listener, simplify `navigate()`, inline header title logic |
| `js/utils.js` | Remove `getHeaderTitle()` |
| `index.html` | Update 4 tab bar `navigate()` calls to pass hash string |
| `js/map.js` | Update 2 `navigate()` calls to pass hash string |
| `js/components/ff-list.js` | Update 1 `navigate()` call to pass hash string |
| `js/components/clickable-image.js` | Update 1 `navigate()` call to pass hash string |
| `js/components/ff-entry.js` | Update 1 `navigate()` call to pass hash string |

**No changes to:** `js/components/filter-modal.js` (reads `currentRoute`, doesn't navigate), templates, CSS, map.js internals, service worker.

## Navigation Flow After Changes

```
User clicks tab / map popup / catalog item / species link
  → navigate(screen, hash) called
    → pushState(null, '', hash) updates URL
    → _handleHash() derives all state from URL:
        parseRoute(hash) → parsed object
        set currentRoute, headerTitle, showFilter
        _setMapVisible(...)
        _resolveOverviewParams / _resolveSpeciesParams (if needed)

User clicks browser back/forward
  → popstate event fires
  → _handleHash() derives all state from restored URL
    → same flow as above
```

Single code path. Single state derivation. URL is truth.

## Verification

1. Open app — lands on Map tab, correct header, map renders
2. Tap each tab — correct content, correct header title, correct tab highlight
3. Tap trail marker → overview shows with correct title and image
4. Tap overview hotspot → species detail shows
5. Tap catalog species → species detail shows
6. Tap "Go to location" → navigates to map, callout opens
7. **Press back button → returns to previous screen** (primary fix)
8. Press forward → returns to where back took us
9. Deep link `#/species/flora-001` → loads species detail
10. Deep link `#/map/overview/trail-01/route-01` → loads overview
11. Unknown hash → falls back to map
12. Refresh on any deep link → same screen loads correctly
13. Rapid back/forward clicking → no race conditions, UI stays in sync
14. Filter icon appears on Map and Catalog, hidden on History and Info
