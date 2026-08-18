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
     x-html="$store.app._templates.home">
</div>
```

### Loading Strategy

Templates are fetched once, cached in the Alpine store, and injected via `x-html`.

**Why `x-html` and not `fetch` + `innerHTML`:**
- `x-html` is reactive — when `$store.app._templates.home` changes, the DOM updates automatically
- It integrates cleanly with Alpine's reactivity system
- No manual DOM manipulation needed

**Why not `<template>` elements in index.html:**
- That defeats the purpose — the HTML would still be in one file
- Fetching from separate files is the only way to get true file-level separation

### Alpine Lifecycle with Dynamic HTML

**Critical issue:** Alpine directives inside `x-html` content are NOT automatically initialised. When Alpine injects new HTML via `x-html`, it does not scan the injected content for directives.

**Solution:** After each template injection, call `Alpine.initTree(el)` on the container element. This tells Alpine to scan the newly added DOM for directives and initialise them.

**Cleanup:** Before injecting a new template into a container, call `Alpine.destroyTree(el)` to clean up event listeners and watchers from the previous content. This prevents memory leaks when navigating between routes.

**Timing:** `initTree` must be called _after_ Alpine has rendered the `x-html` update. Use `$nextTick()` or a short `setTimeout()` to ensure the DOM has been updated before initialising.

### Modified `index.html` Route Sections

Each route section becomes a thin wrapper:

```html
<!-- HOME -->
<div x-show="$store.app.currentRoute === 'home'" x-transition.opacity
     x-data="{ ready: false }"
     x-effect="if ($store.app.currentRoute === 'home' && !ready && $store.app._templates.home) {
       $nextTick(() => { Alpine.initTree($el); ready = true; })
     }"
     x-html="$store.app._templates.home">
</div>
```

**However**, this has a problem: `x-effect` runs on every re-render, and `ready` would need to be reset when navigating away. A cleaner approach is to handle initialisation in a shared utility.

### Cleaner Approach: Centralised Template Loader

Instead of per-section `x-effect`, add a method to the Alpine store that handles fetching, caching, and initialising:

```js
// In Alpine.store('app')
_templateCache: {},
_templatesReady: {},

async _loadTemplate(name) {
  if (this._templateCache[name]) return this._templateCache[name];
  try {
    const res = await fetch(`templates/${name}.html`);
    if (!res.ok) throw new Error(`Template ${name}: HTTP ${res.status}`);
    const html = await res.text();
    this._templateCache[name] = html;
    return html;
  } catch (e) {
    console.error('[HC Garden] Template load error:', e);
    return '';
  }
},

_initTemplate(name, el) {
  if (this._templatesReady[name]) return;
  this._templatesReady[name] = true;
  Alpine.initTree(el);
},

_destroyTemplate(name, el) {
  if (!this._templatesReady[name]) return;
  Alpine.destroyTree(el);
  this._templatesReady[name] = false;
}
```

**Route sections in `index.html` use `x-effect` to trigger loading:**

```html
<div x-show="$store.app.currentRoute === 'home'" x-transition.opacity
     x-data
     x-effect="if ($store.app.currentRoute === 'home') {
       if (!$store.app._templateCache.home) {
         $store.app._loadTemplate('home').then(() => {
           $nextTick(() => $store.app._initTemplate('home', $el))
         })
       } else {
         $store.app._initTemplate('home', $el)
       }
     }">
</div>
```

**The `x-html` binding pulls from the cache:**

```html
<div ... x-html="$store.app._templateCache.home || ''"></div>
```

### Alternative Simpler Approach: Load All Templates on Init

Since the templates are small (total ~277 lines across 10 files, ~5-10KB), load all of them eagerly on app init rather than lazily per-route:

```js
async init() {
  // ... existing data.json fetch ...

  // Load all templates in parallel
  const templateNames = [
    'home', 'introduction', 'map', 'overview', 'flora-fauna',
    'species', 'history', 'committee-message', 'acknowledgements', 'references'
  ];
  const results = await Promise.all(
    templateNames.map(name => fetch(`templates/${name}.html`).then(r => r.text()))
  );
  templateNames.forEach((name, i) => {
    this._templates[name] = results[i];
  });
}
```

**This is the recommended approach** because:
- Templates are small — parallel fetching adds negligible overhead
- No lazy-loading complexity or race conditions
- No `x-effect` boilerplate per section
- Simpler to reason about
- Templates are available immediately when routing starts

**Trade-off:** All templates are loaded up front even if the user never visits some pages. At ~5-10KB total, this is acceptable.

### Modified Route Sections (Simplified)

With eager loading, route sections become minimal:

```html
<!-- HOME -->
<div x-show="$store.app.currentRoute === 'home'" x-transition.opacity
     x-html="$store.app._templates.home || ''">
</div>

<!-- INTRODUCTION -->
<div x-show="$store.app.currentRoute === 'introduction'" x-transition.opacity
     x-html="$store.app._templates.introduction || ''">
</div>
```

**But we still need `Alpine.initTree()`** for directives inside the templates. The `|| ''` default means on first render the container is empty, then Alpine fills it. We need to call `initTree` after the content is injected.

**Solution:** Use a global `x-effect` on `<main>` that watches the current route and initialises the active template:

```html
<main class="pt-14 min-h-screen"
      x-data
      x-effect="$store.app.currentRoute; $nextTick(() => {
        const active = $el.querySelector('[x-show*=\"currentRoute\"]:not([style*=\"display: none\"])');
        if (active && active.innerHTML.trim() && !active._alpineInit) {
          Alpine.initTree(active);
          active._alpineInit = true;
        }
      })">
```

**Actually, the simplest reliable approach:** Wrap each route section in an `x-data` component that handles its own initialisation:

```html
<div x-data="routeSection('home')"
     x-show="$store.app.currentRoute === 'home'"
     x-transition.opacity
     x-html="$store.app._templates.home || ''">
</div>
```

```js
// js/components/route-section.js
document.addEventListener('alpine:init', () => {
  Alpine.data('routeSection', (name) => ({
    _initialised: false,

    init() {
      this.$watch('$store.app.currentRoute', (route) => {
        if (route === name && !this._initialised) {
          this._initialised = true;
          this.$nextTick(() => Alpine.initTree(this.$el));
        }
      });
      // Check on first load too
      if (this.$store.app.currentRoute === name && this.$store.app._templates[name]) {
        this._initialised = true;
        this.$nextTick(() => Alpine.initTree(this.$el));
      }
    }
  }));
});
```

This is clean, self-contained, and handles both initial load and subsequent navigations.

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
| `templates/overview.html` | 115-133 | ClickableImage with hotspots |
| `templates/flora-fauna.html` | 138-204 | Search bar, circle buttons, list |
| `templates/species.html` | 209-261 | Image, details, locations, lightbox |
| `templates/history.html` | 266-284 | Historical photos from data |
| `templates/committee-message.html` | 289-297 | Title, quote, paragraphs |
| `templates/acknowledgements.html` | 302-345 | Quote, paragraphs, committee list |
| `templates/references.html` | 350-367 | Citation list |

**Important:** Templates contain raw HTML with Alpine directives (`x-if`, `x-for`, `x-text`, `@click`, etc.). These directives will be activated by `Alpine.initTree()` after injection.

### 3. Create `js/components/route-section.js`

New component that handles template initialisation per route section (~15 lines).

### 4. Modify `js/app.js`

Add to the store:
- `_templates: {}` — template cache object
- Template fetching in `init()` — fetch all 10 templates in parallel after loading `data.json`

```js
// Add to Alpine.store('app')
_templates: {},

// In init(), after data.json fetch:
const templateNames = [
  'home', 'introduction', 'map', 'overview', 'flora-fauna',
  'species', 'history', 'committee-message', 'acknowledgements', 'references'
];
const results = await Promise.all(
  templateNames.map(name =>
    fetch(`templates/${name}.html`).then(r => {
      if (!r.ok) throw new Error(`Template ${name}: HTTP ${r.status}`);
      return r.text();
    }).catch(e => { console.error('[HC Garden]', e); return ''; })
  )
);
templateNames.forEach((name, i) => { this._templates[name] = results[i]; });
```

### 5. Modify `index.html`

**Remove** the inner content of all 10 route sections. **Replace** with thin `x-html` wrappers using the `routeSection` component:

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
<div x-data="routeSection('home')"
     x-show="$store.app.currentRoute === 'home'"
     x-transition.opacity
     x-html="$store.app._templates.home || ''">
</div>
```

**Add** the new script tag:
```html
<script src="js/components/route-section.js"></script>
```

**Keep** in index.html (no changes):
- `<head>` block
- Loading screen
- Error screen
- Header bar
- Sidebar
- Filter modal
- All existing script tags (plus the new one)

### 6. Handle `x-data` on extracted sections

Some route sections have their own `x-data` attributes:
- `overview`: `x-data="clickableImage"` (line 114)
- `flora-fauna`: `x-data="ffList"` (line 137)
- `species`: `x-data="ffEntry"` (line 208)

These `x-data` attributes must move INTO the template files, since they're part of the extracted content. The `routeSection` component wraps them from the outside:

```html
<!-- index.html -->
<div x-data="routeSection('overview')"
     x-show="$store.app.currentRoute === 'overview'"
     x-transition.opacity
     x-html="$store.app._templates.overview || ''">
</div>
```

```html
<!-- templates/overview.html -->
<div x-data="clickableImage">
  <div class="overflow-auto">
    ...hotspot content...
  </div>
</div>
```

**This creates nested `x-data` scopes** — `routeSection` on the outer div, `clickableImage` on the inner div. This is fine in Alpine; inner scopes inherit from outer scopes. The `clickableImage` component will be initialised by `Alpine.initTree()` when the route section activates.

### 7. Handle Map Initialisation

The map section (`templates/map.html`) contains `<div id="map">` and `<div id="map-legend" x-data="mapLegend">`. The Leaflet map is initialised lazily via the `map-visible` event. This mechanism is unchanged — `Alpine.initTree()` will initialise the `mapLegend` component, and the existing `map-visible` event listener will trigger map setup.

No changes needed to `js/map.js`.

### 8. Handle Filter Modal

The filter modal (`<div x-data="filterModal">`) stays in `index.html`. It is global chrome, always in the DOM, toggled by `isOpen` state. No change.

## Script Load Order

Add the new component before Alpine:

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
<script src="js/components/route-section.js"></script>   <!-- NEW -->
<script src="js/leaflet.js"></script>
<script src="js/map.js"></script>
<script defer src="js/alpine.min.js"></script>
```

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `Alpine.initTree()` not available in vendored Alpine 3.14.9 | Templates won't initialise | Check Alpine version — `initTree` was added in 3.x. If unavailable, fall back to manual DOM insertion without `x-html` |
| `x-html` sanitises HTML (strips `<script>`, event handlers) | Alpine directives broken | Alpine's `x-html` does NOT sanitise — it sets `innerHTML` directly. Directives work fine. Verified in Alpine source. |
| `x-transition` breaks with `x-html` | No fade effect between routes | Test transition behavior. If broken, apply transitions to the outer `routeSection` div instead |
| Leaflet map `#map` element destroyed/recreated on route change | Map re-renders from scratch every time | Expected behavior — map was already re-initialised on `map-visible` event. No regression. |
| Nested `x-data` scopes cause variable shadowing | Component state conflicts | Template `x-data` (e.g., `clickableImage`) is on inner elements, `routeSection` is on outer. No overlap in property names. Safe. |
| Template fetch fails (404, network error) | Blank page section | Catch errors, log, render empty string. User sees blank section but rest of app works. |

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
- Direct URL access (e.g., `#species/flora-001`) works
- Loading screen shows during initial load
- No console errors

## Resulting index.html (Estimated)

~120 lines: head, loading/error screens, header, sidebar, 10 thin route wrappers, filter modal, script tags. Down from 443.
