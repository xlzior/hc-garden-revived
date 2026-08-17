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

### CDN Dependencies (pinned versions)

| Library | CDN | Purpose |
|---|---|---|
| Alpine.js 3.14.9 | `cdn.jsdelivr.net/npm/[email protected]/dist/cdn.min.js` | Reactive UI |
| Tailwind CSS 3.4 | `cdn.tailwindcss.com` | Utility-first CSS |
| Leaflet 1.9.4 | `unpkg.com/leaflet@1.9.4/dist/leaflet.js` + CSS | Interactive map |
| Google Fonts | Lato (400, 400i, 700) | Typography |
| Material Icons | `fonts.googleapis.com/icon?family=Material+Icons` | Icons |

**Note**: Tailwind 3.x CDN is used over 4.x for stability — it's more battle-tested for CDN-only use.

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
│   └── utils.js                  — helpers (Haversine, formatSciName, URL rewrite)
├── assets/
│   ├── maps/
│   │   └── map_all.png           — campus map overlay (copied from hci-biodiversity)
│   ├── fonts/
│   │   └── Precious.ttf          — decorative font (copied from hci-biodiversity)
│   ├── flora.jpg                 — flora category button (copied from hci-biodiversity)
│   ├── fauna.jpg                 — fauna category button (copied from hci-biodiversity)
│   ├── homeimage.jpg             — home hero image (copied from hci-biodiversity)
│   └── *.jpg, *.png              — species & location photos (downloaded from Imgur)
└── data.json                     — Firebase data dump
```

### Why This Structure

- **One HTML file**: all sections are `<div>` blocks toggled by Alpine's `x-show`/`x-if`. No routing library needed — just Alpine state.
- **Component files separate**: each `Alpine.data()` component lives in its own JS file under `js/components/`. Keeps logic isolated and maintainable.
- **Stores for shared state**: `Alpine.store()` for data that multiple components need (the loaded data, current route, markers).
- **No build step**: all JS files are loaded via `<script>` tags. Alpine and Tailwind run from CDN.

### Script Load Order in `index.html`

Critical — Alpine CDN auto-starts on DOMContentLoaded. All component JS must load BEFORE Alpine:

```html
<!-- Head: Tailwind, Leaflet CSS, Google Fonts, custom CSS -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<link rel="stylesheet" href="css/styles.css">
<script src="https://cdn.tailwindcss.com"></script>

<!-- Body end: utilities, app, components, THEN Alpine (with defer) -->
<script src="js/utils.js"></script>
<script src="js/app.js"></script>
<script src="js/components/sidebar.js"></script>
<script src="js/components/filter-modal.js"></script>
<script src="js/components/ff-list.js"></script>
<script src="js/components/ff-entry.js"></script>
<script src="js/components/lightbox.js"></script>
<script src="js/components/clickable-image.js"></script>
<script src="js/components/overview.js"></script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="js/map.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/[email protected]/dist/cdn.min.js"></script>
```

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
  loading: true,
  currentRoute: 'home',
  markers: {},
  async init() {
    try {
      const res = await fetch('data.json')
      this.data = await res.json()
      rewriteUrls(this.data)
    } catch (e) {
      this.error = 'Failed to load data. Please refresh.'
    } finally {
      this.loading = false
    }
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
| HomeScreen | `<div id="home">` | — (has CTA button linking to `#map`) |
| Introduction | `<div id="introduction">` | — (static) |
| Map | `<div id="map">` | `overview` (for map state) |
| Overview (ClickableImage) | `<div id="overview">` | `clickableImage` |
| FFList | `<div id="flora-fauna">` | `ffList` |
| FFEntry | `<div id="species">` | `ffEntry` |
| History | `<div id="history">` | — (dynamic, reads from data) |
| CommitteeMessage | `<div id="committee-message">` | — (static) |
| Acknowledgements | `<div id="acknowledgements">` | — (static) |
| References | `<div id="references">` | — (static) |
| FilterModal | `<dialog id="filter-modal">` | `filterModal` |
| NavigationBar header | `<header>` (always visible) | `sidebar` (for hamburger) |

---

## Key Technical Decisions

### 1. Map: Leaflet.js (CDN)

- Custom image overlay via `L.imageOverlay('assets/maps/map_all.png', bounds)`
- **Bounds**: `[[1.328214, 103.800920], [1.324215, 103.807922]]` (from `Map.js:243`)
- **Map container**: must have explicit height (`calc(100vh - header-height)`) — Leaflet requires this
- **Zoom constraints**: `minZoom: 15`, `maxZoom: 20` (from `Map.js:227-229`)
- Trail markers → `L.marker()` with `L.divIcon()` for colored circles
- Fauna markers → `L.marker()` with circular image icons
- Bird habitat polygons → `L.polygon()` with translucent blue fill (`#0000FF20`)
- **Polygon toggle**: clicking a fauna marker shows its polygon, clicking again hides it (only one at a time)
- **Polygon tap**: tapping a polygon navigates to FFEntry for that species
- **User location**: `L.control.locate()` plugin or manual geolocation marker
- Legend → HTML panel below map, clicking a trail calls `map.fitBounds(trailBounds, {padding: [50,50]})`
- Map state managed by Alpine store, markers array stored for cross-section navigation

### 2. Navigation: Hash-based with Alpine Store

- `Alpine.store('app').currentRoute` tracks current section
- `parseRoute(hash)` utility parses nested routes:
  - `#home` → `{ screen: 'home' }`
  - `#map` → `{ screen: 'map' }`
  - `#map/overview/fauna-003` → `{ screen: 'overview', parent: 'map', id: 'fauna-003' }`
  - `#species/flora-001` → `{ screen: 'species', id: 'flora-001' }`
- Sections toggled via `x-show="$store.app.currentRoute.screen === 'home'"`
- **Nested routes** for stack navigation:
  - `#map` → `#map/overview/<location-id>` → `#species/<species-id>`
  - `#flora-fauna` → `#species/<species-id>`
- Back navigation: changing hash triggers route update
- **`x-if` for heavy sections** (FFEntry, Overview) to reduce DOM size when not visible

### 3. Data Loading: Fetch from Local JSON

- `fetch('data.json')` on page load, stored in `Alpine.store('app').data`
- **URL rewriting**: a `rewriteUrls(data)` utility replaces Imgur URLs with local `assets/` paths
  - Strips URL to filename: `https://i.imgur.com/fBW1mmI.jpg` → `assets/fBW1mmI.jpg`
  - **Imgur size suffix system (`m`, `b`, `h`) is dropped** — local images are full-size, CSS handles responsive sizing
  - Handles both string and array `imageRef` values
  - Also rewrites `smallImage` fields in `data["flora&fauna"][id].smallImage` and `data.map[trailId].route[routeId].smallImage`
- **Loading state**: `$store.app.loading` shows a spinner while data loads
- **Error handling**: if fetch fails, show user-friendly error message

### 4. Geolocation: Browser Geolocation API

- `navigator.geolocation.watchPosition()` in the `ffList` component's `init()`
- Haversine formula in `utils.js`
- **UX**: show the sort-by-distance option always, but if user selects it without location, show an alert (matching original behavior)

### 5. Images: Local Assets

- All images downloaded to `assets/` (Imgur filenames, no size suffixes)
- **Responsive sizing via Tailwind**: `w-full h-auto object-cover` (no need for size variants)
- Lazy loading via `loading="lazy"` on `<img>` tags
- Graceful degradation: `<img onerror>` shows gray box fallback (no placeholder image needed)
- `<img>` includes `width`/`height` attributes where data is available (historical photos) for layout stability

### 6. Fonts

- Lato → Google Fonts CDN (400, 400i, 700)
- Precious → served locally from `assets/fonts/Precious.ttf` via `@font-face`
- No Roboto (was only used by NativeBase components)

### 7. Image Gallery: Alpine Lightbox Component

- `Alpine.data('lightbox')` manages open/closed state, current image index, image array
- Fullscreen overlay with arrow navigation
- Triggered by `@click` on species images or gallery button

### 8. Filter Modal: HTML `<dialog>` + Alpine

- `<dialog>` for built-in modal behavior (focus trapping, ESC-to-close)
- `Alpine.data('filterModal')` manages type/trail/sort state
- **Context-aware**: accepts `enableFilter` parameter to control which sections show:
  - Map: `['type', 'trail']`
  - FFList: `['type', 'trail', 'sortBy']`
- Trail names generated dynamically from `data.map` keys (not hardcoded)

---

## Feature Details

### Header / Navigation Bar

Always-visible header bar at top of every screen:
- **Left**: hamburger menu icon (Material Icons `menu`) — toggles sidebar
- **Center**: display name based on current route:
  - Top-level routes: fixed labels — `"Home"`, `"Introduction"`, `"Map"`, `"Flora and Fauna"`, `"Historical Photos"`, `"Message from Committee"`, `"Acknowledgements"`, `"References"`
  - Nested screens: dynamic titles — `#map/overview/<id>` shows the location name (e.g., "High School Canteen"), `#species/<id>` shows the species name (e.g., "Blue-tailed Bee-eater")
- **Right**: settings/filter icon (when on Map or FFList screens) — opens filter modal

### HomeScreen

- Hero image (`assets/homeimage.jpg`) at full width
- Title: "A Garden Campus"
- Subtitle: "In celebration of Hwa Chong's 100th Anniversary"
- Welcome paragraphs
- **"Let's Go!" button** — navigates to `#map`

### Flora/Fauna List (FFList)

Default view (both types selected, no search active):
- Two large circular image buttons (200x200):
  - **Flora**: `assets/flora.jpg` background, "Flora" text in Precious font
  - **Fauna**: `assets/fauna.jpg` background, "Fauna" text in Precious font
- Clicking one sets type filter and shows the list

When list is visible:
- **Search bar**: `<input>` with search icon (Material Icons `search`) and cancel icon (`cancel`)
  - Cancel clears search and resets to circle button view
  - Search matches against `name`, `sciName`, and `locations` (case-insensitive)
- **Back arrow**: shown when viewing flora-only or fauna-only results, resets to circle buttons
- **Section dividers**: "Flora" / "Fauna" headers when searching with both types enabled
- **List items**: thumbnail image + name + description (3 lines, ellipsize)
- **No results**: "No search results" message

### Scientific Name Formatting (FFEntry)

Port `formatSciName` from `FFEntry.js:105-171` to `utils.js`:
- Capitalize first letter, lowercase rest, strip trailing "L."
- Return HTML string with `<i>` tags for italic, plain text for non-italic exceptions:
  - Words in apostrophes → non-italic
  - Words in parentheses → non-italic until closing `)`
  - `"var."` → always non-italic

### Description Paragraph Doubling

Port `formatParagraph` from `FFEntry.js:100-103`: double all line breaks (`\n` → `\n\n`) for visual spacing. In the web version, use CSS `white-space: pre-line` or `<br><br>` tags.

### Cross-Section Navigation

- **Species detail → Map**: clicking a location on a species page sets route to `#map` and calls `openCallout(locationId)` on the map component
- **Map → Overview → Species**: clicking a trail marker callout navigates to `#map/overview/<location-id>`, clicking a hotspot navigates to `#species/<species-id>`
- **Overview hotspot**: flora hotspots show CSS pulsing gold circles, fauna hotspots show circular bird photos

### Historical Photos

- Dynamic content loaded from `data.historical`
- Each entry: full-width image with aspect ratio from `width`/`height` fields
- Description text below image (justified)
- Images use `loading="lazy"` for performance

### Edge Cases

- **`MISSING INFO` hotspots**: skip rendering (check `if (name === 'MISSING INFO')`)
- **Non-existent species references**: `getFFEntryDetails()` may return `undefined` (e.g., `flora-117` is referenced in hotspots but doesn't exist in data) — skip rendering for these
- **Empty `imageRef`**: show gray placeholder box
- **Empty locations**: hide location links section
- **Fauna with null latitude** (e.g., `fauna-020`): skip map marker rendering
- **Flora without locations** (6 entries): hide location links

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
- Leaflet overrides (z-index, popup styling, map container height)
- Image overlay hotspot positioning
- Scrollbar styling

### Color Mapping (from `Style.js`)

| Original | Tailwind |
|---|---|
| `#646D77` (titles) | `text-gray-600` |
| `#798493` (subtitles) | `text-gray-500` |
| `#636C76` (body) | `text-gray-600` |
| `#ededed` (backgrounds) | `bg-gray-200` |
| `#DBDBDB` (image bg) | `bg-gray-300` |

---

## Implementation Steps

### Phase 0: Preparation
1. Run `download_images.sh` to ensure all Imgur images are downloaded
2. Copy non-Imgur assets from `hci-biodiversity/assets/` to root `assets/`:
   - `flora.jpg`, `fauna.jpg`, `homeimage.jpg`
   - `maps/map_all.png`
   - `fonts/Precious.ttf` (create `assets/fonts/` directory)

### Phase 1: Foundation
3. Create `.nojekyll` file
4. Create `css/styles.css` with:
   - `@font-face` for Precious
   - Pulsing circle keyframes
   - Leaflet overrides
5. Create `index.html` with:
   - `<meta name="viewport">`, `<title>`, `<meta description>`, favicon
   - CDN links (Tailwind 3.x, Leaflet 1.9.4, Google Fonts, Material Icons)
   - All section containers (`<div id="home">`, `<div id="map">`, etc.)
   - Header bar with hamburger menu
   - Sidebar navigation markup
   - Script tags in correct load order (components before Alpine)

### Phase 2: Core JS
6. Create `js/utils.js` with:
   - `haversineDistance(lat1, lon1, lat2, lon2)`
   - `formatSciName(name)` → returns HTML string with `<i>` tags
   - `formatParagraph(text)` → doubles line breaks
   - `rewriteUrls(data)` → replaces Imgur URLs with local `assets/` paths
   - `parseRoute(hash)` → parses hash into `{ screen, parent, id }`
   - `getFFEntryDetails(dbName, data)` → looks up species by database key (e.g., `"flora-001"`) from `data["flora&fauna"]`, returns details or `undefined`
7. Create `js/app.js` with:
   - `Alpine.store('app', { data, loading, error, currentRoute, markers })` — global state
   - Hash-based routing listener using `parseRoute()`
   - Data loading + URL rewriting on init
   - Loading/error states

### Phase 3: Components
8. Create `js/components/sidebar.js` — drawer menu toggle + navigation
9. Create `js/components/filter-modal.js` — type/trail/sort filters in `<dialog>`, context-aware
10. Create `js/components/ff-list.js` — flora/fauna list with:
    - Search bar with search icon and cancel icon
    - Back arrow for filtered view
    - Circle buttons (flora/fauna) as default view
    - Section dividers in search results
    - Filter and sort logic
    - Geolocation for distance sorting
11. Create `js/components/ff-entry.js` — species detail with:
    - Image gallery (multiple images)
    - Scientific name formatting
    - Description with paragraph doubling
    - Location links that navigate to map
12. Create `js/components/lightbox.js` — fullscreen image overlay
13. Create `js/components/clickable-image.js` — hotspot image with pulsing circles (flora) and bird photos (fauna)
14. Create `js/components/overview.js` — trail point detail view

### Phase 4: Map
15. Create `js/map.js` with:
    - Leaflet map initialization (center: `[1.326212, 103.805252]`, zoom: 16, minZoom: 15, maxZoom: 20)
    - Custom image overlay (`map_all.png`)
    - Trail markers with colored `L.divIcon`
    - Callouts with title + thumbnail image
    - Fauna markers with circular images (toggle polygon on click)
    - Polygon tap → FFEntry navigation
    - User location marker
    - Legend with `fitBounds()` zoom
    - Marker reference storage for cross-section navigation

### Phase 5: Integration
16. Wire all components together in `index.html`
17. Test all screens and interactions
18. Test cross-section navigation (species → map, map → overview → species)
19. Test responsive behavior on mobile/tablet/desktop
20. Test with missing images (graceful degradation)
21. Test loading state and error handling

### Phase 6: Deploy
22. Set up GitHub remote
23. Push to `main`
24. Enable GitHub Pages (source: `main`, folder: `/`)
25. Verify site at `https://<username>.github.io/<repo-name>/`

---

## GitHub Pages Setup

1. Create repo on GitHub (or use existing)
2. `git remote add origin <url>`
3. Push to `main`
4. In repo Settings → Pages → Source: Deploy from branch `main`, folder `/ (root)`
5. Site will be live at `https://<username>.github.io/<repo-name>/`

**Important**: all asset paths in `index.html` must be **relative** (no leading `/`) to work in a subdirectory deployment.

---

## What's Preserved

- All species data, descriptions, images
- Interactive map with trails, markers, polygons, and polygon toggling
- Search, filter (type/trail), sort (alphabetical/distance)
- Flora/Fauna circle button initial view
- Search bar with cancel and back buttons
- Section dividers in search results
- Image galleries with fullscreen view
- Pulsing hotspot animations on overview images
- Scientific name italicization formatting
- Historical photo gallery (dynamic, from data)
- Cross-section navigation (species → map, map → overview → species)
- All static content pages (Introduction, Acknowledgements, etc.)
- Header bar with hamburger menu and section title
- "Let's Go!" button on home screen

## What Changes

- No more Firebase dependency (data is local JSON)
- No more Expo/React Native runtime
- No app store deployment — web-only
- Drawer → sidebar menu
- Native modules → web APIs (Geolocation, CSS animations)
- Imgur size suffix system dropped (CSS handles responsive sizing)
- Landscape image rotation dropped (mobile-specific, not needed for web)
