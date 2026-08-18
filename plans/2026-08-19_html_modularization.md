# Plan: Modularise index.html — Extract Route Sections into Templates

## Motivation

`index.html` is 443 lines. ~300 of those are 10 route sections (`home`, `introduction`, `map`, `overview`, `flora-fauna`, `species`, `history`, `committee-message`, `acknowledgements`, `references`), each toggled by `x-show`. Editing any one section means scrolling through the entire file. Modularisation:

1. Makes each route independently readable and editable
2. Reduces merge conflicts if multiple people work on different pages
3. Prepares the codebase for future UI library integration (smaller files are easier to migrate piecemeal)

## Current Structure

```
index.html
├── <head>                          (lines 1-17)   — meta, CSS, Tailwind
├── <body>
│   ├── Loading screen              (lines 20-26)  — x-show="$store.app.loading"
│   ├── Error screen                (lines 29-34)  — x-show="$store.app.error"
│   ├── Main app div                (lines 37-422) — x-show="!loading && !error"
│   │   ├── Header bar              (lines 40-53)  — always visible
│   │   ├── Sidebar                 (lines 56-68)  — always in DOM, toggled by open
│   │   ├── <main> content area     (lines 71-370)
│   │   │   ├── HOME                (lines 74-85)   ← extract
│   │   │   ├── INTRODUCTION        (lines 88-103)  ← extract
│   │   │   ├── MAP                 (lines 106-111) ← extract
│   │   │   ├── OVERVIEW            (lines 114-134) ← extract
│   │   │   ├── FLORA AND FAUNA     (lines 137-205) ← extract
│   │   │   ├── SPECIES DETAIL      (lines 208-262) ← extract
│   │   │   ├── HISTORICAL PHOTOS   (lines 265-285) ← extract
│   │   │   ├── COMMITTEE MESSAGE   (lines 288-298) ← extract
│   │   │   ├── ACKNOWLEDGEMENTS    (lines 301-346) ← extract
│   │   │   └── REFERENCES          (lines 349-368) ← extract
│   │   └── Filter modal            (lines 373-420) — always in DOM
│   └── Scripts                     (lines 424-441)
```

**What stays in index.html** (global chrome, always present):
- `<head>` — meta, CSS, Tailwind
- Loading screen
- Error screen
- Header bar
- Sidebar
- Filter modal
- Script tags

**What gets extracted** (the 10 route sections inside `<main>`).

## Target Structure

```
hc-garden-revived/
├── index.html                       (~120 lines — shell only)
├── templates/
│   ├── home.html                    (~12 lines)
│   ├── introduction.html            (~16 lines)
│   ├── map.html                     (~6 lines)
│   ├── overview.html                (~21 lines)
│   ├── flora-fauna.html             (~69 lines)
│   ├── species.html                 (~55 lines)
│   ├── history.html                 (~21 lines)
│   ├── committee-message.html       (~11 lines)
│   ├── acknowledgements.html        (~46 lines)
│   └── references.html              (~20 lines)
├── js/
│   ├── app.js                       (modified — template loading logic)
│   ├── utils.js                     (unchanged)
│   ├── map.js                       (unchanged)
│   └── components/                  (unchanged)
├── css/
│   └── styles.css                   (unchanged)
└── ...
```

## Design

### How It Works

Each template is a plain HTML fragment — no `<html>`, `<head>`, or `<body>` tags. Just the inner content that goes inside the route section `<div>`. The route section `<div>` with its `x-show` stays in `index.html` as a thin wrapper; only its inner content is fetched.

**Example: `templates/home.html`**
```html
<img src="assets/homeimage.jpg" alt="HC Garden" class="w-full object-cover" style="height: 75vw; max-height: 50vh;">
<div class="p-4 text-center">
  <h2 class="text-2xl font-light text-gray-600 mt-4 font-[Lato]">A Garden Campus</h2>
  <p class="text-sm text-gray-500 italic mt-2">In celebration of<br>Hwa Chong's 100th Anniversary</p>
  <p class="text-sm text-gray-600 mt-4 font-light">Welcome to Hwa Chong's very own nature walking trail app!</p>
  <p class="text-sm text-gray-600 mt-2 font-light">Explore the extensive flora and fauna of our garden campus with interactive maps and bite-sized writeups.</p>
  <div class="flex justify-center mt-6">
    <a href="#map" @click.prevent="$store.app.navigate('map')" class="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded text-base font-medium transition-colors" style="width: 70%;">Let's Go!</a>
  </div>
</div>
```

**Example: reduced `index.html` home section**
```html
<div x-show="$store.app.currentRoute === 'home'" x-transition.opacity
     x-html="$store.app._templates.home || ''">
</div>
```

### How Alpine Handles Dynamic HTML in `x-html`

Alpine's `x-html` directive **automatically calls `Alpine.initTree()`** on injected content. When the bound value changes, Alpine:
1. Sets `innerHTML` on the target element
2. Calls `initTree(el)` to scan for and initialise any Alpine directives in the new DOM

This means:
- **No manual `initTree()` calls needed** — `x-html` handles it
- **No `destroyTree()` calls needed** — when `x-html` replaces content, the old DOM is discarded with its listeners
- **No wrapper component needed** — `x-html` on a plain `<div>` is sufficient
- **Nested `x-data` works** — if a template contains `<div x-data="ffList">`, `initTree` will pick it up

This is verified in Alpine 3.14.9 source (the vendored `alpine.min.js`):
```js
d("html", (e, { expression: t }, { effect: r, evaluateLater: n }) => {
  let i = n(t);
  r(() => {
    i(o => {
      m(() => {
        e.innerHTML = o;
        e._x_ignoreSelf = true;
        S(e);              // S = initTree
        delete e._x_ignoreSelf;
      });
    });
  });
});
```

### Loading Strategy

Templates are fetched **eagerly on init**, in parallel with `data.json`. All templates are small (~5-10KB total), so fetching them upfront is negligible.

**Critical ordering:** Templates must be fetched and cached in `_templates` **before** `_handleHash()` runs. If `_handleHash()` fires before templates are loaded:
- The `map-visible` event dispatches (via `setTimeout(100)`)
- `mapLegend` component hasn't been initialised yet (no `#map-legend` element in DOM)
- The `map-visible` listener is never registered
- **The map never initialises on direct URL access** (e.g., user opens `#map` directly)

**Solution:** Fetch templates and `data.json` in parallel, wait for both, then call `_handleHash()`:

```js
async init() {
  const templateNames = [
    'home', 'introduction', 'map', 'overview', 'flora-fauna',
    'species', 'history', 'committee-message', 'acknowledgements', 'references'
  ];

  // Fetch data and templates in parallel
  const [dataRes, ...tplResults] = await Promise.allSettled([
    fetch('data.json'),
    ...templateNames.map(name =>
      fetch(`templates/${name}.html`).then(r => {
        if (!r.ok) throw new Error(`Template ${name}: HTTP ${r.status}`);
        return r.text();
      })
    )
  ]);

  // Process data
  if (dataRes.status === 'fulfilled' && dataRes.value.ok) {
    const text = await dataRes.value.text();
    this.data = JSON.parse(text);
  } else {
    this.error = 'Failed to load data. Please refresh.';
    this.loading = false;
    return;
  }

  // Cache templates (individual failures don't block the app)
  tplResults.forEach((result, i) => {
    this._templates[templateNames[i]] =
      result.status === 'fulfilled' ? result.value : '';
  });

  this.loading = false;
  this._handleHash();   // Now safe — templates are loaded
  window.addEventListener('hashchange', () => this._handleHash());
}
```

Using `Promise.allSettled` ensures a template 404 doesn't block data loading or the entire app.

### Template Content Injection

With templates loaded, each route section in `index.html` is a thin wrapper:

```html
<!-- HOME -->
<div x-show="$store.app.currentRoute === 'home'" x-transition.opacity
     x-html="$store.app._templates.home || ''">
</div>

<!-- FLORA AND FAUNA -->
<div x-show="$store.app.currentRoute === 'flora-fauna'" x-transition.opacity
     x-html="$store.app._templates['flora-fauna'] || ''">
</div>
```

The `|| ''` ensures the container is empty on first render (before templates load). Once `_templates` is populated, Alpine reactivity triggers `x-html` to inject the content and `initTree` to activate directives.

### Sections with `x-data`

Three route sections have their own `x-data` attributes that must move INTO the template files:

| Section | Current `x-data` | In template |
|---|---|---|
| Overview | `x-data="clickableImage"` | `templates/overview.html` wraps content in `<div x-data="clickableImage">` |
| Flora & Fauna | `x-data="ffList"` | `templates/flora-fauna.html` wraps content in `<div x-data="ffList">` |
| Species | `x-data="ffEntry"` | `templates/species.html` wraps content in `<div x-data="ffEntry">` |

These components will be initialised by `initTree` when the template is injected. Since `x-show` keeps all sections in the DOM permanently, these components are initialised once and persist. Event listeners registered in `init()` (e.g., `ffList`'s `filter-changed` window listener and geolocation watcher) survive route changes because the DOM elements are never removed.

### Map Section

The map template (`templates/map.html`) contains:
```html
<div id="map-container" class="relative">
  <div id="map" class="w-full h-full"></div>
  <div id="map-legend" class="..." x-data="mapLegend"></div>
</div>
```

When `x-html` injects this, `initTree` initialises `mapLegend`. The existing `map-visible` event listener in `mapLegend.init()` triggers map setup. Since templates are loaded before `_handleHash()`, the `map-visible` dispatch will find a listener registered. No changes needed to `js/map.js`.

### Filter Modal

The filter modal (`<div x-data="filterModal">`) stays in `index.html`. It is global chrome, always in the DOM, toggled by `isOpen` state. No change.

## Changes Required

### 1. Create `templates/` directory

```
mkdir templates
```

### 2. Create 10 template files

Extract the inner content of each route section `<div>` (lines inside the `x-show` wrapper) into its own file:

| File | Source lines in index.html | Notes |
|---|---|---|
| `templates/home.html` | 75-84 | Hero image, text, CTA button |
| `templates/introduction.html` | 89-102 | Title, Chinese text, paragraphs |
| `templates/map.html` | 107-110 | Map container + legend div |
| `templates/overview.html` | 115-133 | Wraps in `<div x-data="clickableImage">`, hotspot content |
| `templates/flora-fauna.html` | 138-204 | Wraps in `<div x-data="ffList">`, search bar, circle buttons, list |
| `templates/species.html` | 209-261 | Wraps in `<div x-data="ffEntry">`, image, details, lightbox |
| `templates/history.html` | 266-284 | Historical photos from data |
| `templates/committee-message.html` | 289-297 | Title, quote, paragraphs |
| `templates/acknowledgements.html` | 302-345 | Quote, paragraphs, committee list |
| `templates/references.html` | 350-367 | Citation list |

Templates contain raw HTML with Alpine directives (`x-if`, `x-for`, `x-text`, `@click`, etc.). These directives are activated automatically by `x-html`'s built-in `initTree` call.

### 3. Modify `js/app.js`

Add `_templates: {}` to the store. Rewrite `init()` to fetch `data.json` and all templates in parallel using `Promise.allSettled`, then call `_handleHash()`.

See "Loading Strategy" section above for the complete implementation.

### 4. Modify `index.html`

**Remove** the inner content of all 10 route sections. **Replace** with thin `x-html` wrappers:

Before:
```html
<div x-show="$store.app.currentRoute === 'home'" x-transition.opacity>
  <img src="assets/homeimage.jpg" ...>
  <div class="p-4 text-center">
    ...
  </div>
</div>
```

After:
```html
<div x-show="$store.app.currentRoute === 'home'" x-transition.opacity
     x-html="$store.app._templates.home || ''">
</div>
```

**No new script tags needed** — no `route-section.js` file.

**Keep** in index.html (no changes):
- `<head>` block
- Loading screen
- Error screen
- Header bar
- Sidebar
- Filter modal
- All existing script tags (unchanged)

### 5. Update service worker

The service worker (`js/service-worker.js`) pre-caches static assets. Add the template files to the cache list so they work offline:

```js
const PRE_CACHE = [
  '/',
  'index.html',
  'css/styles.css',
  'css/leaflet.css',
  'js/app.js',
  'js/utils.js',
  'js/map.js',
  'js/alpine.min.js',
  'js/leaflet.js',
  'js/tailwind.js',
  // Templates
  'templates/home.html',
  'templates/introduction.html',
  'templates/map.html',
  'templates/overview.html',
  'templates/flora-fauna.html',
  'templates/species.html',
  'templates/history.html',
  'templates/committee-message.html',
  'templates/acknowledgements.html',
  'templates/references.html',
];
```

### 6. Clean up dead code

`js/components/overview.js` defines `Alpine.data('overview')` which is never used in the HTML — the overview section uses `x-data="clickableImage"` instead. Consider removing this file.

## Script Load Order

Unchanged — no new scripts needed:

```html
<script src="js/utils.js"></script>
<script src="js/app.js"></script>
<script src="js/components/sidebar.js"></script>
<script src="js/components/filter-modal.js"></script>
<script src="js/components/ff-list.js"></script>
<script src="js/components/ff-entry.js"></script>
<script src="js/components/lightbox.js"></script>
<script src="js/components/clickable-image.js"></script>
<script src="js/components/overview.js"></script>
<script src="js/leaflet.js"></script>
<script src="js/map.js"></script>
<script defer src="js/alpine.min.js"></script>
```

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Template fetch fails (404, network error) | Blank page section | `Promise.allSettled` ensures app still loads. Failed templates render as empty string. |
| `x-transition` breaks with `x-html` | No fade effect between routes | Test transition behavior. If broken, move `x-transition` to work around it. |
| Leaflet map `#map` element destroyed/recreated on route change | Map re-renders from scratch every time | Expected — map was already re-initialised on `map-visible` event. No regression. |
| `ffList` geolocation watcher duplicates on re-init | Multiple watchPosition callbacks | Won't happen — `x-html`/`initTree` only initialises once per DOM insertion, and `x-show` keeps DOM alive. |
| Nested `x-data` scopes cause variable shadowing | Component state conflicts | Template `x-data` is on inner elements. No overlap in property names with the outer div. |
| Template loading race with `_handleHash()` | Map doesn't initialise on direct URL access | Fixed by fetching templates before `_handleHash()` (see "Loading Strategy"). |

## Verification

After implementation, verify each route:

1. **Home** — hero image loads, "Let's Go!" button navigates to map
2. **Introduction** — paragraphs render, Chinese text displays
3. **Map** — Leaflet initialises, markers appear, legend works, trail click navigates to overview
4. **Overview** — image loads, hotspots appear (fauna circles, flora pulsing), click navigates to species
5. **Flora & Fauna** — circle buttons appear, click shows list, search works, filter modal opens
6. **Species** — image loads, scientific name italicised, locations link to map, lightbox works
7. **History** — historical photos load from data, descriptions render
8. **Committee Message** — paragraphs render
9. **Acknowledgements** — full committee list renders
10. **References** — citation list renders

Also verify:
- Sidebar navigation works for all routes
- Header title updates correctly
- Filter icon appears/disappears for map and flora-fauna routes
- Back/forward browser navigation works
- Direct URL access (e.g., `#species/flora-001`) works — especially test `#map` to confirm map initialises
- Loading screen shows during initial load
- Offline mode works (service worker caches templates)
- No console errors

## Resulting index.html (Estimated)

~120 lines: head, loading/error screens, header, sidebar, 10 thin route wrappers, filter modal, script tags. Down from 443.
