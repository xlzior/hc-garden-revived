# Plan: Replace Hamburger Sidebar with Bottom Tab Navigation

## Motivation

The current 8-item hamburger sidebar is overkill for an app with only 4 meaningful sections. Users have to tap twice (hamburger → item) to navigate, and half the items (Home, Introduction, Message from Committee) are static filler that add no navigational value. A bottom tab bar provides:

1. **One-tap navigation** between the 4 core sections
2. **Persistent orientation** — users always see where they are
3. **Simplified content** — removing 3 low-value pages and merging 2 informational pages reduces maintenance burden

## Current Structure

```
Navigation: Hamburger sidebar (8 items)
  Home → home
  Introduction → introduction
  Map → map
  Flora and Fauna → flora-fauna
  Historical Photos → history
  Message from Committee → committee-message
  Acknowledgements → acknowledgements
  References → references

Default route: home (requires CTA tap to reach map)
Child routes: overview (under map), species (under flora-fauna)
```

## Target Structure

```
Navigation: Bottom tab bar (4 tabs)
  Map       → #map        (icon: map)
  Catalog   → #catalog    (icon: collections_bookmark)
  History   → #history    (icon: photo_library)
  Info      → #info       (icon: info)

Default route: map (app opens directly on the map)
Child routes: overview (under map), species (under catalog)

Removed pages: home, introduction, committee-message
Merged pages:  acknowledgements + references → info
Renamed route: flora-fauna → catalog (URL hash changes)
Unrecognized hashes: fall back to map
```

## Design

### Tab Bar Layout

A fixed bottom bar with 4 equally-spaced tabs, each showing a Material Icon above a small label. The active tab gets a distinct color (e.g. blue-500) while inactive tabs are gray-400. The bar sits at `z-index: 30` (same as header) and has a white background with a top border.

```
┌─────────────────────────────────────┐
│            HEADER BAR               │  ← fixed top, h-14
├─────────────────────────────────────┤
│                                     │
│           CONTENT AREA              │  ← scrollable
│                                     │
├─────────────────────────────────────┤
│  🗺 Map  │  📋 Catalog │ 📷 History │ ℹ Info │  ← fixed bottom
└─────────────────────────────────────┘
```

The content area needs bottom padding (`pb-16`) to avoid being obscured by the tab bar.

### Info Page Structure

A single static file `templates/info.html` containing both acknowledgements and references content sequentially, separated by an `<hr>` divider and section headings. Fetched once like any other template.

### Header Bar Changes

- The hamburger button is removed entirely
- The title still displays in the center (shows the active tab name, or dynamic titles for child routes like species names)
- The filter icon remains for Map and Catalog tabs

### URL Scheme

| URL Hash | Route ID | Tab | Content |
|----------|----------|-----|---------|
| `#map` | `map` | Map | Leaflet map |
| `#catalog` | `catalog` | Catalog | Flora & fauna list |
| `#history` | `history` | History | Historical photos |
| `#info` | `info` | Info | Acknowledgements + references |
| `#map/overview/trail/route` | `overview` | Map (active) | Trail overview |
| `#species/flora-001` | `species` | Catalog (active) | Species detail |

Note: The old routes `#home`, `#introduction`, `#committee-message`, `#acknowledgements`, `#references`, `#flora-fauna` are all removed. Unrecognized hashes fall back to `#map`.

## Changes Required

### 1. DELETE files

| File | Reason |
|------|--------|
| `templates/home.html` | Home page removed |
| `templates/introduction.html` | Introduction page removed |
| `templates/committee-message.html` | Committee message page removed |
| `js/components/sidebar.js` | Sidebar component replaced by tab bar |
| `js/components/lightbox.js` | Dead code (lightbox is inlined in ff-entry.js) |
| `js/components/overview.js` | Dead code (overview uses clickableImage) |

### 2. CREATE files

| File | Content |
|------|---------|
| `templates/info.html` | Combined acknowledgements + references content (concatenated from existing templates with a `<hr>` divider between them) |

### 3. MODIFY files

#### `index.html`

**Header bar** (lines 40-53): Remove hamburger button and its `@click="$dispatch('toggle-sidebar')"` handler. Keep title and filter button. Remove empty spacer `<div class="w-10">` fallback — use a fixed-width spacer or adjust layout.

Replace:
```html
<header class="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center px-4 z-30">
  <button @click="$dispatch('toggle-sidebar')" class="p-2 -ml-2 ...">
    <span class="material-icons">menu</span>
  </button>
  <h1 ...>title</h1>
  <template x-if="$store.app.showFilter">...</template>
  <template x-if="!$store.app.showFilter">
    <div class="w-10"></div>
  </template>
</header>
```

With:
```html
<header class="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-center px-4 z-30">
  <h1 class="text-base font-medium text-gray-700" x-text="$store.app.headerTitle"></h1>
  <template x-if="$store.app.showFilter">
    <button @click="$dispatch('open-filter-modal')" class="absolute right-4 p-2 text-gray-600 hover:text-gray-800">
      <span class="material-icons">settings</span>
    </button>
  </template>
</header>
```

**Sidebar** (lines 55-68): Delete entirely.

**Route sections** (lines 71-101): Remove `home`, `introduction`, `committee-message`, `acknowledgements`, `references`. Rename `flora-fauna` to `catalog`. Add `info` section.

Replace:
```html
<main class="pt-14 min-h-screen">
  <div x-show="$store.app.currentRoute === 'home'" ...></div>
  <div x-show="$store.app.currentRoute === 'introduction'" ...></div>
  <div x-show="$store.app.currentRoute === 'map'" ...></div>
  <div x-show="$store.app.currentRoute === 'overview'" ...></div>
  <div x-show="$store.app.currentRoute === 'flora-fauna'" ...></div>
  <div x-show="$store.app.currentRoute === 'species'" ...></div>
  <div x-show="$store.app.currentRoute === 'history'" ...></div>
  <div x-show="$store.app.currentRoute === 'committee-message'" ...></div>
  <div x-show="$store.app.currentRoute === 'acknowledgements'" ...></div>
  <div x-show="$store.app.currentRoute === 'references'" ...></div>
</main>
```

With:
```html
<main class="pt-14 pb-16 min-h-screen">
  <div x-show="$store.app.currentRoute === 'map'" x-transition.opacity x-html="$store.app._templates.map || ''"></div>
  <div x-show="$store.app.currentRoute === 'overview'" x-transition.opacity x-html="$store.app._templates.overview || ''"></div>
  <div x-show="$store.app.currentRoute === 'catalog'" x-transition.opacity x-html="$store.app._templates.catalog || ''"></div>
  <div x-show="$store.app.currentRoute === 'species'" x-transition.opacity x-html="$store.app._templates.species || ''"></div>
  <div x-show="$store.app.currentRoute === 'history'" x-transition.opacity x-html="$store.app._templates.history || ''"></div>
  <div x-show="$store.app.currentRoute === 'info'" x-transition.opacity x-html="$store.app._templates.info || ''"></div>
</main>
```

**Add tab bar** after `</main>` and before the filter modal:
```html
<!-- TAB BAR -->
<nav class="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-200 flex items-stretch z-30">
  <a href="#map" @click.prevent="$store.app.navigate('map', { hash: '#map' })"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$store.app.currentRoute === 'map' || $store.app.currentRoute === 'overview' ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">map</span>
    <span class="text-[10px] leading-tight font-medium">Map</span>
  </a>
  <a href="#catalog" @click.prevent="$store.app.navigate('catalog', { hash: '#catalog' })"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$store.app.currentRoute === 'catalog' || $store.app.currentRoute === 'species' ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">collections_bookmark</span>
    <span class="text-[10px] leading-tight font-medium">Catalog</span>
  </a>
  <a href="#history" @click.prevent="$store.app.navigate('history', { hash: '#history' })"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$store.app.currentRoute === 'history' ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">photo_library</span>
    <span class="text-[10px] leading-tight font-medium">History</span>
  </a>
  <a href="#info" @click.prevent="$store.app.navigate('info', { hash: '#info' })"
     class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
     :class="$store.app.currentRoute === 'info' ? 'text-blue-500' : 'text-gray-400'">
    <span class="material-icons text-[22px]">info</span>
    <span class="text-[10px] leading-tight font-medium">Info</span>
  </a>
</nav>
```

**Script tags** (lines 157-174): Remove `<script src="js/components/sidebar.js">`, `<script src="js/components/lightbox.js">`, `<script src="js/components/overview.js">`.

#### `js/app.js`

**Template list** (line 17-19): Remove `'home'`, `'introduction'`, `'committee-message'`, `'acknowledgements'`, `'references'`. Add `'info'`. Rename `'flora-fauna'` to `'catalog'`.

Replace:
```js
const templateNames = [
  'home', 'introduction', 'map', 'overview', 'flora-fauna',
  'species', 'history', 'committee-message', 'acknowledgements', 'references'
];
```

With:
```js
const templateNames = [
  'map', 'overview', 'catalog', 'species', 'history', 'info'
];
```

**Default route** (line 8): Change `currentRoute: 'home'` to `currentRoute: 'map'`.

**Default header** (line 11): Change `headerTitle: 'Home'` to `headerTitle: 'Map'`.

**`_handleHash`** (line 60): Change default hash from `'#home'` to `'#map'`.

**`_handleHash` showFilter** (line 64): Change `'flora-fauna'` to `'catalog'`.

**`navigate` method** (line 88): Change `'flora-fauna'` to `'catalog'`.

#### `js/utils.js`

**`parseRoute`** (lines 89-113): Remove all old route mappings. Update `flora-fauna` → `catalog`. Add `info` route.

Replace:
```js
function parseRoute(hash) {
  if (!hash || hash === '#' || hash === '#home') return { screen: 'home' };
  hash = hash.replace(/^#/, '');
  const parts = hash.split('/');
  if (parts[0] === 'map') {
    if (parts[1] === 'overview' && parts[2] && parts[3]) {
      return { screen: 'overview', parent: 'map', trailId: parts[2], routeId: parts[3] };
    }
    return { screen: 'map' };
  }
  if (parts[0] === 'flora-fauna') return { screen: 'flora-fauna' };
  if (parts[0] === 'species' && parts[1]) return { screen: 'species', id: parts[1] };
  const routeMap = {
    'home': 'home', 'introduction': 'introduction', 'history': 'history',
    'committee-message': 'committee-message', 'acknowledgements': 'acknowledgements',
    'references': 'references'
  };
  return { screen: routeMap[parts[0]] || parts[0] };
}
```

With:
```js
function parseRoute(hash) {
  if (!hash || hash === '#' || hash === '#map') return { screen: 'map' };
  hash = hash.replace(/^#/, '');
  const parts = hash.split('/');
  if (parts[0] === 'map') {
    if (parts[1] === 'overview' && parts[2] && parts[3]) {
      return { screen: 'overview', parent: 'map', trailId: parts[2], routeId: parts[3] };
    }
    return { screen: 'map' };
  }
  if (parts[0] === 'catalog') return { screen: 'catalog' };
  if (parts[0] === 'species' && parts[1]) return { screen: 'species', id: parts[1] };
  if (parts[0] === 'history') return { screen: 'history' };
  if (parts[0] === 'info') return { screen: 'info' };
  return { screen: 'map' };
}
```

**`HEADER_TITLES`** (lines 116-127): Remove old entries, add `catalog` and `info`.

Replace:
```js
const HEADER_TITLES = {
  'home': 'Home',
  'introduction': 'Introduction',
  'map': 'Map',
  'overview': '',
  'flora-fauna': 'Flora and Fauna',
  'species': '',
  'history': 'Historical Photos',
  'committee-message': 'Message from Committee',
  'acknowledgements': 'Acknowledgements',
  'references': 'References'
};
```

With:
```js
const HEADER_TITLES = {
  'map': 'Map',
  'overview': '',
  'catalog': 'Catalog',
  'species': '',
  'history': 'Historical Photos',
  'info': 'Info'
};
```

#### `css/styles.css`

**Remove** sidebar-related CSS (lines 37-63): `.sidebar-open`, `.sidebar-overlay`, `.sidebar-panel`, `.sidebar-panel.open`.

**Fix `#map-container` height** (line 90): The current `calc(100vh - 56px)` only accounts for the header. With the tab bar now at the bottom, subtract its height too. Use CSS custom properties to avoid duplication between normal and landscape modes:

```css
:root {
  --header-h: 56px;
  --tabbar-h: 56px;
}
```

Update `#map-container` (line 90):
```css
#map-container {
  height: calc(100vh - var(--header-h) - var(--tabbar-h));
}
```

Update PWA landscape mode `#map-container` (line 152):
```css
@media (display-mode: standalone) and (orientation: landscape) {
  :root {
    --header-h: 40px;
  }
  /* #map-container inherits the correct calc via the custom property */
}
```

**Add** tab bar CSS (optional — can use inline Tailwind, but a base style helps):
```css
.tab-bar a {
  -webkit-tap-highlight-color: transparent;
}
```

#### `js/service-worker.js`

Update the `URLS` pre-cache array (lines 108-117) to match the new file structure:

- Remove: `templates/home.html`, `templates/introduction.html`, `templates/committee-message.html`, `templates/flora-fauna.html`, `templates/acknowledgements.html`, `templates/references.html`, `js/components/sidebar.js`, `js/components/lightbox.js`, `js/components/overview.js`
- Add: `templates/catalog.html`, `templates/info.html`

#### `js/components/ff-list.js`

No changes needed — this file does not reference `'flora-fauna'` as a route string. It only navigates to `'species'` and `'map'`.

#### `js/components/ff-entry.js`

No changes needed — this file does not reference `'flora-fauna'` as a route string. It only navigates to `'species'` and `'map'`.

### 4. Templates to rename

| Old Path | New Path | Notes |
|----------|----------|-------|
| `templates/flora-fauna.html` | `templates/catalog.html` | Content unchanged, only the filename changes (referenced by template name in `app.js`) |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Broken deep links / bookmarks using old hashes (`#home`, `#flora-fauna`, etc.) | Users with saved URLs land on map | `parseRoute` falls back to `'map'` for unrecognized routes — acceptable for this app |
| `#map-container` CSS height doesn't account for tab bar | Map overflows behind tab bar | Fix `calc(100vh - 56px)` to `calc(100vh - var(--header-h) - var(--tabbar-h))` using CSS custom properties |
| PWA landscape mode also has wrong map height | Same overflow issue in standalone mode | Update landscape media query with same custom property approach |
| Service worker pre-caches deleted templates | 404s during pre-cache, stale cache | Update `URLS` array in `service-worker.js` |
| `overview` and `species` child routes still need to highlight the correct parent tab | Wrong tab highlighted | Tab bar `:class` bindings check for both parent and child route names |
| Map needs to reinitialize when revisiting | Map disappears | Existing `map-visible` event dispatch already handles this |
| Info page is long (acknowledgements + references combined) | Poor UX | Add a visual divider (`<hr>`) and section headings between the two sections |

## Implementation Steps

1. Create `templates/info.html` combining acknowledgements + references content
2. Rename `templates/flora-fauna.html` → `templates/catalog.html`
3. Delete `templates/home.html`, `templates/introduction.html`, `templates/committee-message.html`
4. Delete `js/components/sidebar.js`, `js/components/lightbox.js`, `js/components/overview.js`
5. Update `js/utils.js` — `parseRoute()` and `HEADER_TITLES`
6. Update `js/app.js` — template list, default route, `_handleHash`, `navigate`
7. Update `index.html` — header, remove sidebar, route sections, add tab bar, update script tags
8. Update `css/styles.css` — remove sidebar CSS, fix map-container height, add tab bar CSS
9. Update `js/service-worker.js` — update pre-cache URLS array
10. Test all 4 tabs navigate correctly and highlight properly
11. Test child routes (overview, species) keep parent tab highlighted
12. Test deep linking with hash URLs
13. Test filter modal still opens from Map and Catalog tabs
14. Test back/forward browser buttons work correctly
15. Test map renders correctly without overflowing behind tab bar

## Verification

1. Open app — should land directly on Map tab with tab bar visible
2. Tap each tab — correct content shows, correct tab is highlighted, header title updates
3. From Map, tap a trail marker → overview shows, Map tab still highlighted
4. From Catalog, tap a species → species detail shows, Catalog tab still highlighted
5. From species detail, tap a location → navigates to Map, Map tab highlighted
6. On Map and Catalog tabs, filter icon appears in header; on History and Info, it does not
7. Open in browser with `#species/flora-001` → species detail loads, Catalog highlighted
8. Open in browser with `#home` (old URL) → falls back to Map
9. Back/forward browser buttons work correctly
10. Tab bar remains fixed at bottom while scrolling content
11. Map does not overflow behind the tab bar
12. PWA landscape mode: map, header, and tab bar all fit correctly
13. Service worker pre-caches all new templates without 404s
