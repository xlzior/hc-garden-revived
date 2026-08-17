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

**Single-page app (SPA)** with hash-based routing:

```
index.html              — main entry point, loads all CSS/JS
css/styles.css          — all styling
js/app.js               — core SPA logic, routing, data loading
js/map.js               — Leaflet map implementation
js/components.js        — reusable UI components (navigation bar, filter modal, etc.)
assets/                 — local images (downloaded from Imgur)
```

**No build tools required** — pure vanilla HTML/CSS/JS, directly deployable to GitHub Pages.

---

## Screen Mapping (React Native → HTML)

| React Native Screen | HTML Equivalent |
|---|---|
| DrawerNavigator | Sidebar menu (slide-out from left) |
| HomeScreen | `#home` section — hero image, title, "Let's Go!" button |
| Introduction | `#introduction` section — static text |
| Map | `#map` section — Leaflet map with custom overlay, markers, polygons |
| Overview (ClickableImage) | `#overview` section — image with CSS-animated hotspots |
| FFList | `#flora-fauna` section — search bar + filterable list + circle buttons |
| FFEntry | `#species` section — detail view with image gallery, description, location links |
| History | `#history` section — scrollable photo gallery |
| CommitteeMessage | `#committee-message` section — static text |
| Acknowledgements | `#acknowledgements` section — static text |
| References | `#references` section — static text |
| FilterModal | Modal (`<dialog>`) with type/trail/sort checkboxes and radio buttons |

---

## Key Technical Decisions

### 1. Map Library: Leaflet.js (CDN)

- Lightweight (~40KB), no build step needed
- Supports custom image overlays, markers, polygons
- Free tile layer (OpenStreetMap) — no API key needed
- The existing `assets/maps/map_all.png` overlay will be used with `L.imageOverlay()`
- Trail markers → `L.marker()` with colored icons
- Fauna markers → `L.marker()` with custom circular icons
- Bird habitat polygons → `L.polygon()` with translucent blue fill
- **Polygon toggle**: pressing a fauna marker toggles its polygon visibility (only one shown at a time)
- Legend → HTML panel below the map with `fitBounds()` on click

### 2. Navigation: Hash-based routing with nested routes

- `window.addEventListener('hashchange', ...)` to switch visible sections
- Each screen = a `<div>` with `display: none` by default
- Sidebar menu toggles visibility
- **Nested routes** for stack navigation:
  - `#map` → `#map/overview/<location-id>` → `#species/<species-id>`
  - `#flora-fauna` → `#species/<species-id>`
- Back navigation via hash changes

### 3. Data Loading: Fetch from local JSON

- `fetch('data.json')` on page load
- **URL rewriting**: Imgur URLs in `data.json` will be rewritten to local `assets/` paths during a preprocessing step
- All data available client-side for filtering/sorting

### 4. Geolocation: Browser Geolocation API

- `navigator.geolocation.watchPosition()` for live distance tracking
- Haversine formula ported from JS (already pure math)
- Fallback: hide distance sort if location unavailable

### 5. Images: Local assets

- All images downloaded to `assets/` (Imgur filenames)
- Imgur URLs in `data.json` will be rewritten to local paths
- **Single size per image**: use original download size, rely on CSS `object-fit` + `width` constraints for responsive sizing
- Lazy loading via `loading="lazy"` on `<img>` tags
- Graceful degradation: `<img onerror>` shows placeholder for missing images

### 6. Fonts

- Lato → Google Fonts CDN (Lato Regular + Italic)
- Precious → served locally from `hci-biodiversity/assets/Precious.ttf`
- Roboto → not needed (was only used by NativeBase components)

### 7. Image Gallery: Custom lightbox

- Click image → fullscreen overlay with arrow navigation
- Simple CSS + JS implementation (no library needed)
- Handles single images and multi-image galleries

### 8. Filter Modal: Native `<dialog>` element

- Uses HTML `<dialog>` for built-in modal behavior, focus trapping, ESC-to-close
- Simpler than building a custom modal overlay

---

## Feature Details

### Flora/Fauna Initial View (FFList)

The default view (both types selected, no search active) shows two large circular image buttons:
- **Flora button**: 200x200 circle with `flora.jpg` background, "Flora" text in Precious font
- **Fauna button**: 200x200 circle with `fauna.jpg` background, "Fauna" text in Precious font
- Clicking one filters to that type and shows the list

### Scientific Name Formatting (FFEntry)

Port `formatSciName` from `FFEntry.js:105-171`:
- Capitalize first letter, lowercase rest, strip trailing "L."
- Italicize by default, with exceptions:
  - Words in apostrophes → non-italic
  - Words in parentheses → non-italic until closing `)`
  - `"var."` → always non-italic

### Cross-Section Navigation

- **Species detail → Map**: clicking a location on a species page switches to `#map` and opens the corresponding marker's callout
- **Map → Overview → Species**: clicking a trail marker callout opens `#map/overview/<location-id>`, clicking a hotspot opens `#species/<species-id>`
- **Overview hotspot**: flora hotspots show pulsing gold circles, fauna hotspots show circular bird photos

### Edge Cases

- **`MISSING INFO` hotspots**: skip rendering (original code returns null for these)
- **Empty `imageRef`**: show gray placeholder box
- **Empty locations**: hide location links section

---

## CSS Styling Plan

Port the React Native styles from `constants/Style.js`:

- Responsive scaling using `clamp()` or media queries (target: 375px base)
- Color scheme: `#646D77` (titles), `#798493` (subtitles), `#636C76` (body)
- Font sizes normalized proportionally
- Flexbox layouts matching the original screens
- Card styling with padding and margins
- `<meta name="viewport">` tag for mobile web
- Responsive breakpoints for tablet/desktop

---

## Implementation Steps

1. **Download missing images**: run `download_images.sh` to fetch any missing Imgur images
2. **Create `index.html`** with:
   - `<meta name="viewport">` tag
   - All section containers
   - CDN links (Leaflet, Leaflet CSS, Google Fonts)
   - `.nojekyll` file for GitHub Pages
3. **Create `css/styles.css`** porting all styles from `Style.js` + layout for each screen
4. **Create `js/app.js`** with:
   - Data loading from `data.json`
   - URL rewriting (Imgur → local paths)
   - Hash-based routing with nested route support
   - Sidebar navigation
   - Search, filter, sort logic
   - Haversine distance calculation
   - Geolocation integration
   - `formatSciName` port
   - Cross-section navigation (species → map marker)
5. **Create `js/map.js`** with:
   - Leaflet map initialization
   - Custom image overlay with correct bounds
   - Trail marker rendering with callouts
   - Fauna markers with polygon toggling
   - Legend with `fitBounds()` zoom
6. **Create `js/components.js`** with:
   - Navigation bar component
   - Filter modal (`<dialog>`) component
   - Image gallery/lightbox
   - ClickableImage hotspot component (pulsing circles + fauna photos)
7. **Test all screens and interactions**
8. **Set up GitHub remote and enable GitHub Pages** (source: main branch, root `/`)

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
