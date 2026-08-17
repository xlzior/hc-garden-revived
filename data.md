# Data Structure Documentation

This document explains how the data in `data.json` is structured and used throughout the HC Garden application.

## Overview

The data is organized into three main sections:
- `flora&fauna` - Species information (plants and birds)
- `map` - Trail routes and waypoints
- `historical` - Historical photos of the campus

## Data Sections

### 1. Flora & Fauna (`flora&fauna`)

Contains information about all species found on campus. Each entry is keyed by a unique ID.

#### Structure

```json
{
  "flora&fauna": {
    "flora-001": {
      "description": "Located along the Science Research Centre, the Pomelo tree...",
      "imageRef": ["https://i.imgur.com/s7iHyqx.jpg"],
      "locations": "trail-02/route-02,trail-03/route-11",
      "name": "Pomelo",
      "sciName": "Citrus maxima",
      "smallImage": "https://i.imgur.com/LuoCnXf.png"
    },
    "fauna-001": {
      "area": [
        {"latitude": 1.326318, "longitude": 103.804393},
        {"latitude": 1.325814, "longitude": 103.807676},
        {"latitude": 1.32428, "longitude": 103.806603},
        {"latitude": 1.325224, "longitude": 103.803728}
      ],
      "description": "Having plumed its bright sage-green suit and fixed its rufous collar tie...",
      "imageRef": [
        "https://i.imgur.com/fBW1mmI.jpg",
        "https://i.imgur.com/E11oxnE.jpg",
        "https://i.imgur.com/bgOjlI1.jpg",
        "https://i.imgur.com/TW3xc5V.jpg",
        "https://i.imgur.com/IYTd8Mb.jpg",
        "https://i.imgur.com/4Ci5DKn.jpg"
      ],
      "latitude": 1.32603,
      "locations": "trail-01/route-02",
      "longitude": 103.80685,
      "name": "Blue-tailed Bee-eater",
      "sciName": "Merops superciliosus",
      "smallImage": "https://i.imgur.com/rTxejj6.png"
    }
  }
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Common name of the species |
| `sciName` | string | Yes | Scientific/botanical name (formatted with proper italics in-app) |
| `description` | string | Yes | Detailed write-up about the species |
| `imageRef` | array of strings | Yes | Array of Imgur image URLs (first image used as thumbnail) |
| `locations` | string | No | Comma-separated trail/route references, or empty string if unlocated |
| `smallImage` | string | Yes | Pre-computed thumbnail URL used for bird icons on annotated images (ClickableImage only) |
| `latitude` | number | Fauna only (optional) | GPS latitude for map marker position |
| `longitude` | number | Fauna only (optional) | GPS longitude for map marker position |
| `area` | array | Fauna only (optional) | Array of coordinate objects defining bird habitat polygon |

#### Entry ID Conventions

- Flora entries: `flora-XXX` (e.g., `flora-001`, `flora-084`)
- Fauna entries: `fauna-XXX` (e.g., `fauna-001`, `fauna-010`)

#### Location String Format

The `locations` field uses the format: `trailId/routeId`

Example: `"trail-02/route-02,trail-03/route-11"` means this species can be found at:
- Trail 2 (Kong Chian, High School), Waypoint 02
- Trail 3 (Kah Kee, High School), Waypoint 11

---

### 2. Map Data (`map`)

Contains trail routes and their waypoints. Each trail has markers with GPS coordinates and annotated images.

#### Structure

```json
{
  "map": {
    "trail-01": {
      "color": "red",
      "name": "Jing Xian Trail (College)",
      "route": {
        "route-01": {
          "imageRef": "https://i.imgur.com/FLTPZ16.jpg",
          "latitude": 1.325603,
          "longitude": 103.805239,
          "points": [
            {
              "left": 0.7,
              "params": {"name": "flora-084"},
              "pulse": 5,
              "size": 50,
              "top": 0.7
            }
          ],
          "smallImage": "https://i.imgur.com/QhbikB7.png",
          "title": "Block E"
        }
      }
    }
  }
}
```

#### Trail Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name of the trail |
| `color` | string | Color name or hex code for map markers and legend |
| `route` | object | Collection of waypoints (keyed by `route-XX` IDs) |

#### Waypoint (Route) Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Display name of the waypoint |
| `latitude` | number | GPS latitude coordinate |
| `longitude` | number | GPS longitude coordinate |
| `imageRef` | string | Imgur URL of the annotated trail image |
| `smallImage` | string | No | Pre-computed thumbnail URL (unused by app - callouts use `convertImgurURL` instead) |
| `points` | array | Array of hotspot objects for clickable annotations |

#### Annotation Points (Clickable Hotspots)

Each point in the `points` array represents an interactive hotspot on the annotated image:

| Field | Type | Description |
|-------|------|-------------|
| `params.name` | string | Reference ID (e.g., `"flora-084"`, `"fauna-001"`), or `"MISSING INFO"` for incomplete entries |
| `top` | number | Vertical position as percentage (0.0 to 1.0) from top of image |
| `left` | number | Horizontal position as percentage (0.0 to 1.0) from left of image |
| `size` | number | Diameter of the hotspot circle in pixels |
| `pulse` | number | Pulse animation radius in pixels |

#### Trail IDs

- `trail-01`: Jing Xian Trail (College)
- `trail-02`: Kong Chian Trail (High School)
- `trail-03`: Kah Kee Trail (High School)

---

### 3. Historical Photos (`historical`)

Contains historical photos of the campus flora.

#### Structure

```json
{
  "historical": {
    "history-1": {
      "description": "In the background, multiple palms were planted right in front of the clock tower...",
      "height": 928,
      "imageRef": "https://i.imgur.com/v5hVyB2.jpg",
      "name": "Clock Tower Palms",
      "width": 1263
    }
  }
}
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name of the historical photo |
| `imageRef` | string | Imgur URL of the historical photo |
| `description` | string | Caption/description text (can be empty string) |
| `width` | number | Original image width in pixels (used for aspect ratio calculation) |
| `height` | number | Original image height in pixels (used for aspect ratio calculation) |

---

## Image URL Handling

All images are hosted on Imgur. The app uses a URL transformation function to request different image sizes:

```javascript
let convertImgurURL = (url, size) => 
  url.slice(0, url.length-4) + size + url.slice(url.length-4, url.length)
```

### Size Suffixes

| Suffix | Description | Typical Use |
|--------|-------------|-------------|
| `m` | Medium (320px) | List thumbnails, map callouts |
| `b` | Large (640px) | Bird markers on map |
| `h` | Huge (1024px) | Detail views, historical photos |

**Example:**
- Original: `https://i.imgur.com/fBW1mmI.jpg`
- Medium: `https://i.imgur.com/fBW1mmIm.jpg`
- Huge: `https://i.imgur.com/fBW1mmIh.jpg`

---

## Data Usage by Screen

### HomeScreen
- No data dependency

### Map Screen
- Uses `map` data for trail routes and markers
- Uses `flora&fauna` data for bird markers and polygons
- Filters by trail and type (flora/fauna)

### Flora and Fauna List
- Uses `flora&fauna` data for species listing
- Uses `map` data to calculate GPS distances to species locations
- Supports search, filtering, and sorting

### Species Detail (FFEntry)
- Uses `flora&fauna` data for species information
- Uses `map` data to display location buttons that link back to map

### Overview (Annotated Image)
- Uses `map` data for the annotated image and hotspot points
- Uses `flora&fauna` data to resolve hotspot references
- Fauna icons use `smallImage` field directly; flora hotspots use animated pulsing circles

### Historical Photos
- Uses `historical` data for photo gallery

---

## Data Quality Notes

- `flora-117` is referenced as a hotspot in map data (`trail-03/route-15`) but does not exist in the `flora&fauna` section. Tapping this hotspot would cause a runtime error.
- Three map annotation points use `"MISSING INFO"` as `params.name` (incomplete entries). The app handles these gracefully by returning `null`.
