# Imgur Image Size Suffixes

## Goal
Implement the `convertImgurURL` function (documented in `data.md` but never built) to request appropriately-sized images from Imgur instead of always loading full-resolution originals (~1.2MB avg, up to 5MB).

## Approach
Add `convertImgurURL(url, size)` to `utils.js` and apply it at every image consumption point with context-appropriate size suffixes.

**Key principle:** Apply suffixes at the *consumer*, not when storing data. Raw URLs in `_routeParams` stay unsuffixed so consumers can choose their own size without double-suffix bugs.

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
  if (!url.includes('imgur.com')) return url;
  const dotIndex = url.lastIndexOf('.');
  if (dotIndex === -1) return url;
  const ext = url.slice(dotIndex);
  return url.slice(0, dotIndex) + size + ext;
}
```
Guards: returns original for non-Imgur URLs, no-extension URLs, null/undefined.

### 2. `js/components/ff-list.js:124-128` — Catalog thumbnails → `m`
Update `getImageSrc()` to return `convertImgurURL(src, 'm')`.

### 3. `js/components/ff-entry.js:47-51` — Species detail images → `h`
Update `images` getter to map raw `imageRef` through `convertImgurURL(url, 'h')`.

### 4. `js/components/ff-entry.js` — Add `blurImages` getter → `m`
Add a new getter that maps **raw `imageRef`** (not `images`) through `convertImgurURL(url, 'm')`.

### 5. `templates/species.html:9` — Blur placeholder → `m`
Change `:src="images[imageIndex]"` on the blur img to `:src="blurImages[imageIndex]"`.

### 6. `templates/species.html:53` — Lightbox → full res
No change — lightbox uses `lightboxImages` which is set from raw `imageRef` in `openLightbox()`.

### 7. `js/components/clickable-image.js:19-21` — Overview images → apply at consumer
**Do NOT modify `_resolveOverviewParams`** — keep `_routeParams.url` as the raw URL.

Instead, update `clickableImage`:
- `imageUrl` getter: return `convertImgurURL(this.params.url, 'h')`
- Add `blurImageUrl` getter: return `convertImgurURL(this.params.url, 'm')`

This avoids the double-suffix bug where step 6 would produce `XXXh.jpg` and step 7 would then produce `XXXhm.jpg`.

### 8. `templates/overview.html:5` — Blur placeholder → use `blurImageUrl`
Change `:src="imageUrl"` on the blur img to `:src="blurImageUrl"`.

### 9. `templates/history.html:9` — Historical photos → `h`
Change `:src="entry.imageRef"` to `:src="convertImgurURL(entry.imageRef, 'h')"` (global function, accessible in Alpine templates).

### 10. `js/map.js:72` — Trail popup thumbnail → `m`
Wrap `thumbUrl` with `convertImgurURL(thumbUrl, 'm')`.

### 11. `js/map.js:116` — Bird markers → `b`
Wrap `birdImg` with `convertImgurURL(birdImg, 'b')`.

### Not changed
- **`smallImage`** icons — already small pre-computed thumbnails
- **Lightbox** — full resolution for zoom quality
- **`rewriteUrls()`** — remains dead code (separate concern)

## Service worker
No cache version bump needed — the SW uses cache-first for Imgur URLs, and new suffixed URLs are simply new cache entries. Old full-res entries will be evicted naturally or on next `hc-garden-v*` version bump.

## Caveats
- **Overview hotspot alignment**: Hotspot coordinates in `data.json` may have been authored against full-res dimensions. With `h` (1024px), positions could shift slightly on very tall/narrow images. Verify visually after implementation.

## Expected impact
- Catalog list: ~80% smaller per thumbnail (1200KB → ~80KB)
- Map bird markers: ~60% smaller (~1200KB → ~100KB)
- Map popup thumbnails: ~80% smaller
- Species detail: ~30% smaller (~1200KB → ~250KB)
- Blur placeholders: ~90% smaller (just needs to be blurry)
- Historical photos: ~30% smaller
- Lightbox: unchanged (full res)
