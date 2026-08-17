# Plan: Convert HCI Biodiversity React Native App to Static HTML

## Current State

- **Repository**: `hc-garden-revived` (no remote configured yet)
- **Assets**: `data.json` (189KB Firebase data), `assets/` (downloaded images)
- **Original app**: `hci-biodiversity/` React Native/Expo app

## Target

- Static HTML/CSS/JS site deployable on GitHub Pages
- Same functionality as the React Native app

---

## Architecture

**Single-page app (SPA)** using Alpine.js for reactivity, Tailwind CSS for styling, Leaflet for maps.

All via CDN — zero build tools, zero `npm install`. Push to GitHub Pages and it works.

### CDN Dependencies

| Library | CDN | Purpose |
|---|---|---|
| Alpine.js 3.x | `cdn.jsdelivr.net/npm/[email protected]/dist/cdn.min.js` | Reactive UI |
| Tailwind CSS 4.x | `cdn.jsdelivr.net/npm/@tailwindcss/browser@4` | Utility-first CSS |
| Leaflet 1.9 | `unpkg.com/leaflet@1.9/dist/leaflet.js` + CSS | Interactive map |
| Google Fonts | Lato (400, 400i, 700) | Typography |
| Material Icons | `fonts.googleapis.com/icon?family=Material+Icons` | Icons (matching NativeBase) |

### File Structure

```
hc-garden-revived/
├── index.html                    — single entry point, all sections
├── .nojekyll                     — tells GitHub Pages to skip Jekyll
├── css/
│   └── styles.css                — custom styles (animations, overrides)
├── js/
│   ├── app.js                    — Alpine init, data loading, routing, stores
│   ├── map.js                    — Leaflet map setup, markers, polygons
│   ├── components/
│   │   ├── sidebar.js            — Alpine.data('sidebar')
│   │   ├── filter-modal.js       — Alpine.data('filterModal')
│   │   ├── ff-list.js            — Alpine.data('ffList') — flora/fauna list
│   │   ├── ff-entry.js           — Alpine.data('ffEntry') — species detail
│   │   ├── lightbox.js           — Alpine.data('lightbox') — image gallery
│   │   ├── clickable-image.js    — Alpine.data('clickableImage') — hotspots
│   │   └── overview.js           — Alpine.data('overview') — trail point view
│   └── utils.js                  — helpers (Haversine, formatSciName, imgur URL)
├── assets/                       — downloaded images (from Imgur)
│   ├── maps/
│   │   └── map_all.png           — campus map overlay
│   ├── fonts/
│   │   └── Precious.ttf          — decorative font
│   └── *.jpg, *.png              — species & location photos
└── data.json                     — Firebase data dump
```

### Why This Structure

- **One HTML file**: all sections are `<div>` blocks toggled by Alpine's `x-show`. No routing library needed — just Alpine state.
- **Component files separate**: each `Alpine.data()` component lives in its own JS file under `js/components/`. Keeps logic isolated and maintainable.
- **Stores for shared state**: `Alpine.store()` for data that multiple components need (the loaded data, current route, markers).
- **No build step**: all JS files are loaded via `<script>` tags. Alpine and Tailwind run from CDN.

---

## Alpine.js Conventions Used

### 1. `Alpine.data()` for Reusable Components

Each component is registered as a named data function:

```js
// js/components/sidebar.js
document.addEventListener('alpine:init', () => {
  Alpine.data('sidebar', () => ({
    open: false,
    toggle() { this.open = !this.open },
    navigate(hash) {
      window.location.hash = hash
      this.open = false
    }
  }))
})
```

```html
<div x-data="sidebar">
  <button @click="toggle">Menu</button>
  <nav x-show="open" x-transition>
    <a @click.prevent="navigate('#home')" href="#home">Home</a>
  </nav>
</div>
```

### 2. `Alpine.store()` for Global State

Shared data (the loaded Firebase JSON, current route, map markers) lives in stores:

```js
// js/app.js
Alpine.store('app', {
  data: null,
  currentRoute: 'home',
  markers: {},
  async init() {
    const res = await fetch('data.json')
    this.data = await res.json()
  }
})
```

Accessible anywhere via `$store.app.data`, `$store.app.currentRoute`, etc.

### 3. `x-data` Scoped Tightly

Each interactive section gets its own `x-data`. No giant `<body x-data="...">` — Alpine scans children for directives, so tighter scoping = faster init.

### 4. `init()` for Component Setup

Components use Alpine's `init()` lifecycle hook for initialization (fetching data, setting up geolocation, etc.).

### 5. Private Members with `_` Prefix

Internal-only properties/methods prefixed with `_` to signal "don't use from HTML":

```js
Alpine.data('ffList', () => ({
  items: [],       // public — used in template
  _haversine(...) { ... }  // private — only used in JS
}))
```

---

## Screen Mapping (React Native → HTML)

| React Native Screen | HTML Section | Alpine Component |
|---|---|---|
| DrawerNavigator | Sidebar (always in DOM) | `sidebar` |
| HomeScreen | `<div id="home">` | — (static) |
| Introduction | `<div id="introduction">` | — (static) |
| Map | `<div id="map">` | `overview` (for map state) |
| Overview (ClickableImage) | `<div id="overview">` | `clickableImage` |
| FFList | `<div id="flora-fauna">` | `ffList` |
| FFEntry | `<div id="species">` | `ffEntry` |
| History | `<div id="history">` | — (static + lazy images) |
| CommitteeMessage | `<div id="committee-message">` | — (static) |
| Acknowledgements | `<div id="acknowledgements">` | — (static) |
| References | `<div id="references">` | — (static) |
| FilterModal | `<dialog id="filter-modal">` | `filterModal` |

---

## Key Technical Decisions

### 1. Map: Leaflet.js (CDN)

- Custom image overlay via `L.imageOverlay('assets/maps/map_all.png', bounds)`
- Trail markers → `L.marker()` with `L.divIcon()` for colored circles
- Fauna markers → `L.marker()` with circular image icons
- Bird habitat polygons → `L.polygon()` with translucent blue fill
- **Polygon toggle**: clicking a fauna marker shows its polygon, hides others (only one at a time)
- Legend → HTML panel below map, clicking a trail calls `map.fitBounds(trailBounds)`
- Map state managed by Alpine store, markers array stored for cross-section navigation

### 2. Navigation: Hash-based with Alpine Store

- `Alpine.store('app').currentRoute` tracks current section
- `window.addEventListener('hashchange', ...)` updates the store
- Sections toggled via `x-show="$store.app.currentRoute === 'home'"`
- **Nested routes** for stack navigation:
  - `#map` → `#map/overview/<location-id>` → `#species/<species-id>`
  - `#flora-fauna` → `#species/<species-id>`
- Back navigation: changing hash triggers route update

### 3. Data Loading: Fetch from Local JSON

- `fetch('data.json')` on page load, stored in `Alpine.store('app').data`
- **URL rewriting**: a `rewriteUrls(data)` utility replaces Imgur URLs with local `assets/` paths
- All data available client-side for filtering/sorting

### 4. Geolocation: Browser Geolocation API

- `navigator.geolocation.watchPosition()` in the `ffList` component's `init()`
- Haversine formula in `utils.js`
- Fallback: hide distance sort option if location unavailable

### 5. Images: Local Assets

- All images downloaded to `assets/` (Imgur filenames)
- Responsive sizing via Tailwind classes (`w-full h-auto object-cover`)
- Lazy loading via `loading="lazy"` on `<img>` tags
- Graceful degradation: `onerror` shows gray placeholder

### 6. Fonts

- Lato → Google Fonts CDN
- Precious → served locally from `assets/fonts/Precious.ttf` via `@font-face`
- No Roboto (was only used by NativeBase components)

### 7. Image Gallery: Alpine Lightbox Component

- `Alpine.data('lightbox')` manages open/closed state, current image index, image array
- Fullscreen overlay with arrow navigation
- Triggered by `@click` on species images or gallery button

### 8. Filter Modal: HTML `<dialog>` + Alpine

- `<dialog>` for built-in modal behavior (focus trapping, ESC-to-close)
- `Alpine.data('filterModal')` manages type/trail/sort state
- Emits filter changes to parent via Alpine store or callback

---

## Feature Details

### Flora/Fauna Initial View (FFList)

Default view (both types selected, no search active) shows two large circular image buttons:
- **Flora button**: 200x200 circle with `assets/flora.jpg` background, "Flora" text in Precious font
- **Fauna button**: 200x200 circle with `assets/fauna.jpg` background, "Fauna" text in Precious font
- Clicking one sets `type = { flora: true, fauna: false }` or vice versa, showing the list

### Scientific Name Formatting (FFEntry)

Port `formatSciName` from `FFEntry.js:105-171` to `utils.js`:
- Capitalize first letter, lowercase rest, strip trailing "L."
- Return HTML string with `<i>` tags for italic, plain text for non-italic exceptions:
  - Words in apostrophes → non-italic
  - Words in parentheses → non-italic until closing `)`
  - `"var."` → always non-italic

### Cross-Section Navigation

- **Species detail → Map**: clicking a location on a species page sets `$store.app.currentRoute = 'map'` and calls `openCallout(locationId)` on the map component
- **Map → Overview → Species**: clicking a trail marker callout navigates to `#map/overview/<location-id>`, clicking a hotspot navigates to `#species/<species-id>`
- **Overview hotspot**: flora hotspots show CSS pulsing gold circles, fauna hotspots show circular bird photos

### Edge Cases

- **`MISSING INFO` hotspots**: skip rendering (check `if (name === 'MISSING INFO')`)
- **Empty `imageRef`**: show gray placeholder box
- **Empty locations**: hide location links section

---

## CSS Styling Plan

### Tailwind Utilities (in HTML)

Most styling via Tailwind utility classes directly in `index.html`:
- Layout: `flex`, `grid`, `items-center`, `justify-between`, `gap-4`
- Spacing: `p-4`, `m-2`, `px-6`, `py-3`
- Typography: `text-lg`, `font-medium`, `italic`, `text-gray-600`
- Responsive: `sm:`, `md:`, `lg:` prefixes
- Colors: `bg-white`, `text-gray-700`, `border-gray-200`

### Custom CSS (in `css/styles.css`)

Only for things Tailwind can't do:
- `@font-face` for Precious font
- Pulsing circle animation (`@keyframes pulse-ring`)
- Leaflet overrides (z-index, popup styling)
- Image overlay hotspot positioning
- Scrollbar styling
- Print styles (optional)

### Color Mapping (from `Style.js`)

| Original | Tailwind |
|---|---|
| `#646D77` (titles) | `text-gray-600` or custom `--color-title` |
| `#798493` (subtitles) | `text-gray-500` |
| `#636C76` (body) | `text-gray-600` |
| `#ededed` (backgrounds) | `bg-gray-200` |
| `#DBDBDB` (image bg) | `bg-gray-300` |

---

## Implementation Steps

### Phase 0: Preparation
1. Run `download_images.sh` to ensure all images are downloaded
2. Create `rewrite-urls.js` utility to transform `data.json` Imgur URLs → local paths

### Phase 1: Foundation
3. Create `index.html` with:
   - `<meta name="viewport">` tag
   - CDN script/link tags (Alpine, Tailwind, Leaflet, Google Fonts, Material Icons)
   - All section containers (`<div id="home">`, `<div id="map">`, etc.)
   - Sidebar navigation markup
   - `.nojekyll` file
4. Create `css/styles.css` with:
   - `@font-face` for Precious
   - Pulsing circle keyframes
   - Leaflet overrides
   - Minimal custom styles (everything else is Tailwind)

### Phase 2: Core JS
5. Create `js/utils.js` with:
   - `haversineDistance(lat1, lon1, lat2, lon2)`
   - `formatSciName(name)` → returns HTML string
   - `rewriteUrls(data)` → replaces Imgur URLs with local paths
   - `getImageUrl(filename, size?)` → builds local asset path
6. Create `js/app.js` with:
   - `Alpine.store('app', { data, currentRoute, markers })` — global state
   - Hash-based routing listener
   - Data loading + URL rewriting on init
   - Geolocation setup

### Phase 3: Components
7. Create `js/components/sidebar.js` — drawer menu toggle + navigation
8. Create `js/components/filter-modal.js` — type/trail/sort filters in `<dialog>`
9. Create `js/components/ff-list.js` — flora/fauna list with search, filter, sort, circle buttons
10. Create `js/components/ff-entry.js` — species detail with image gallery, sci-name formatting, location links
11. Create `js/components/lightbox.js` — fullscreen image overlay
12. Create `js/components/clickable-image.js` — hotspot image with pulsing circles
13. Create `js/components/overview.js` — trail point detail view

### Phase 4: Map
14. Create `js/map.js` with:
    - Leaflet map initialization
    - Custom image overlay (`map_all.png`)
    - Trail markers with colored `L.divIcon`
    - Callouts with title + thumbnail
    - Fauna markers with circular images
    - Polygon toggle on marker press
    - Legend with `fitBounds()` zoom
    - Marker reference storage for cross-section navigation

### Phase 5: Integration
15. Wire all components together in `index.html`
16. Test all screens and interactions
17. Test cross-section navigation (species → map, map → overview → species)
18. Test responsive behavior on mobile/tablet/desktop

### Phase 6: Deploy
19. Set up GitHub remote
20. Push to `main`
21. Enable GitHub Pages (source: `main`, folder: `/`)
22. Verify site at `https://<username>.github.io/<repo-name>/`

---

## GitHub Pages Setup

1. Create repo on GitHub (or use existing)
2. `git remote add origin <url>`
3. Push to `main`
4. In repo Settings → Pages → Source: Deploy from branch `main`, folder `/ (root)`
5. Site will be live at `https://<username>.github.io/<repo-name>/`

---

## What's Preserved

- All species data, descriptions, images
- Interactive map with trails, markers, polygons, and polygon toggling
- Search, filter (type/trail), sort (alphabetical/distance)
- Flora/Fauna circle button initial view
- Image galleries with fullscreen view
- Pulsing hotspot animations on overview images
- Scientific name italicization formatting
- Historical photo gallery
- Cross-section navigation (species → map, map → overview → species)
- All static content pages (Introduction, Acknowledgements, etc.)

## What Changes

- No more Firebase dependency (data is local JSON)
- No more Expo/React Native runtime
- No app store deployment — web-only
- Drawer → sidebar menu
- Native modules → web APIs (Geolocation, CSS animations)
- Landscape image rotation dropped (mobile-specific, not needed for web)
