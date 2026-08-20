# Imgur Image Size Suffixes

## Goal
Implement the `convertImgurURL` function (documented in `data.md` but never built) to request appropriately-sized images from Imgur instead of always loading full-resolution originals (~1.2MB avg, up to 5MB).

## Approach
Add `convertImgurURL(url, size)` to `utils.js` and apply it at every image consumption point with context-appropriate size suffixes.

### Size suffix reference (from `data.md`)
| Suffix | Max px | Use case |
|--------|--------|----------|
| `m`    | 320    | List thumbnails, map callouts, blur placeholders |
| `b`    | 640    | Bird markers on map |
| `h`    | 1024   | Detail views, overview images, historical photos |
| *(none)* | orig | Lightbox (user expects full-res zoom) |

### Imgur URL format
Insert suffix before extension: `https://i.imgur.com/fBW1mmI.jpg` → `https://i.imgur.com/fBW1mmIh.jpg`

## Changes

### 1. `js/utils.js` — Add `convertImgurURL`
```js
function convertImgurURL(url, size) {
  if (!url || typeof url !== 'string' || !size) return url;
  const ext = url.slice(url.lastIndexOf('.'));
  return url.slice(0, url.length - ext.length) + size + ext;
}
```

### 2. `js/components/ff-list.js:124-128` — Catalog thumbnails → `m`
Update `getImageSrc()` to return `convertImgurURL(src, 'm')`.

### 3. `js/components/ff-entry.js:47-51` — Species detail images → `h`
Update `images` getter to map through `convertImgurURL(url, 'h')`.

### 4. `templates/species.html:9` — Blur placeholder → `m`
Change `:src="images[imageIndex]"` on the blur img to use a separate `blurImages` getter returning `m`-sized URLs.

### 5. `templates/species.html:53` — Lightbox → full res
No change — lightbox already uses `lightboxImages` which is set from raw `imageRef`.

### 6. `js/app.js:144-152` — Overview annotated image → `h`
Wrap `route.imageRef` with `convertImgurURL(url, 'h')` in `_resolveOverviewParams`.

### 7. `templates/overview.html:5` — Overview blur placeholder → `m`
Add a `blurImageUrl` getter to `clickable-image.js` that returns `convertImgurURL(imageUrl, 'm')`, use it on the blur `<img>`.

### 8. `templates/history.html:9` — Historical photos → `h`
Change `:src="entry.imageRef"` to `:src="convertImgurURL(entry.imageRef, 'h')"` (global function, accessible in Alpine templates).

### 9. `js/map.js:72` — Trail popup thumbnail → `m`
Wrap `thumbUrl` with `convertImgurURL(thumbUrl, 'm')`.

### 10. `js/map.js:116` — Bird markers → `b`
Wrap `birdImg` with `convertImgurURL(birdImg, 'b')`.

### Not changed
- **`smallImage`** icons — already small pre-computed thumbnails
- **Lightbox** — full resolution for zoom quality
- **`rewriteUrls()`** — remains dead code (separate concern)

## Expected impact
- Catalog list: ~80% smaller per thumbnail (1200KB → ~80KB)
- Map bird markers: ~60% smaller (~1200KB → ~100KB)
- Map popup thumbnails: ~80% smaller
- Species detail: ~30% smaller (~1200KB → ~250KB)
- Blur placeholders: ~90% smaller (just needs to be blurry)
- Historical photos: ~30% smaller
- Lightbox: unchanged (full res)
