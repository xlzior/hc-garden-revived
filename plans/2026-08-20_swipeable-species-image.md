# Swipeable Species Image & Lightbox

## Goal

Make the species detail image directly swipeable to browse multiple images, and make the lightbox swipeable too. Remove the separate "Image gallery" button.

## Changes

### 1. `templates/species.html` — Inline image swipe

- Wrap the `<img>` in an `overflow-hidden` container
- Add `@touchstart`, `@touchmove`, `@touchend` handlers for horizontal swipe detection
- Track `imageIndex` (default 0) to control which image is displayed
- Show dot indicators below the image when `imageRef` is an array with length > 1
- Replace the static `<img :src="imageRef[0]">` with `<img :src="images[imageIndex]">`
- Remove the "Image gallery" button block (lines 10–15)

### 2. `templates/species.html` — Swipeable lightbox

- Add `@touchstart`, `@touchmove`, `@touchend` handlers on the lightbox overlay div
- Same swipe detection: threshold ~50px horizontal, minimal vertical movement
- Swipe left → `nextImage()`, swipe right → `prevImage()`
- Keep existing arrow buttons as fallback for non-touch / accessibility

### 3. `js/components/ff-entry.js` — State updates

- Add `imageIndex: 0` property for inline image position
- Add `images` getter that normalizes `imageRef` to an array (reuses logic from `openLightbox`)
- Reset `imageIndex` to 0 when navigating to a new species (in a watcher or via `$watch`)
- Add touch helper methods or inline the logic in the template via `x-init`

### 4. `css/styles.css` — Minimal styling

- `.species-image` overflow container styles (already has some rules)
- Optional: CSS transition on the lightbox `<img>` for slide animation

## Files to modify

| File | What |
|---|---|
| `templates/species.html` | Swipeable image + lightbox, remove gallery button |
| `js/components/ff-entry.js` | `imageIndex` state, `images` getter, touch helpers |
| `css/styles.css` | Overflow container, optional slide transition |

## Verification

- Open a species with multiple images → swipe left/right cycles through images, dot indicators update
- Click image → lightbox opens at current index
- Swipe in lightbox → cycles through images
- Arrow buttons still work in lightbox
- Species with single image → no dots, no swipe behavior, click still opens lightbox
- Landscape mode still works correctly
