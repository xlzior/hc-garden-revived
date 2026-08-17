# HC Garden — A Nature Walking Trail Guide

A static web app for exploring the rich biodiversity of Hwa Chong Institution's garden campus.

Originally built as a React Native mobile app, now converted to a pure HTML/CSS/JS site deployable on GitHub Pages.

## Features

- **Interactive map** with Leaflet — trail routes, species markers, and polygon regions
- **Flora & Fauna catalog** — searchable, filterable, sortable species list
- **Species detail pages** — image gallery, scientific name formatting, location links
- **Clickable hotspot images** — pulsing markers on trail point photos
- **Filter modal** — filter by type (flora/fauna), trail, and sort order
- **Historical photos** — archived images of the campus

## Tech Stack

| Layer | Library | Version |
|-------|---------|---------|
| Reactivity | Alpine.js | 3.14.9 |
| Styling | Tailwind CSS | 3.4.17 |
| Maps | Leaflet | 1.9.4 |
| Fonts | Lato, Material Icons, Precious | local |

All dependencies are vendored locally — no CDN required at runtime.

## Project Structure

```
├── index.html              # Single-page app entry point
├── data.json               # Firebase data dump (species, trails, history)
├── css/
│   ├── styles.css          # Custom styles, animations, Leaflet overrides
│   └── leaflet.css         # Leaflet styles (vendored)
├── js/
│   ├── app.js              # Alpine store, routing, data loading
│   ├── utils.js            # Haversine distance, name formatting, URL rewriting
│   ├── map.js              # Leaflet map initialization and markers
│   ├── alpine.min.js       # Alpine.js (vendored)
│   ├── tailwind.js         # Tailwind CSS CDN build (vendored)
│   ├── leaflet.js          # Leaflet JS (vendored)
│   └── components/
│       ├── sidebar.js      # Slide-out navigation
│       ├── filter-modal.js # Type/trail/sort filters
│       ├── ff-list.js      # Flora & fauna list with search
│       ├── ff-entry.js     # Species detail with lightbox gallery
│       ├── clickable-image.js  # Hotspot image with pulsing circles
│       ├── lightbox.js     # Fullscreen image overlay
│       └── overview.js     # Trail point overview
├── assets/
│   ├── *.jpg, *.png        # Species and trail point images
│   ├── maps/map_all.png    # Map overlay image
│   ├── fonts/              # Lato, Material Icons, Precious font files
│   ├── homeimage.jpg       # Home screen hero image
│   ├── flora.jpg           # Flora circle button image
│   └── fauna.jpg           # Fauna circle button image
├── hci-biodiversity/       # Original React Native source (reference)
├── PLAN.md                 # Conversion plan documentation
├── download_images.sh      # Script to download missing Imgur images
└── .nojekyll               # Disables Jekyll processing on GitHub Pages
```

## Local Development

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

## Deployment (GitHub Pages)

1. Push to a GitHub repository
2. Go to Settings → Pages → Source: Deploy from branch `main` / `/ (root)`
3. The site will be live at `https://<username>.github.io/<repo>/`

## Data Source

Species data and trail maps were originally loaded from Firebase Realtime Database. The data has been exported to `data.json` for static hosting. Image URLs pointing to Imgur have been rewritten to local paths in `assets/`.
