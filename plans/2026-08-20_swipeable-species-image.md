# Swipeable Species Image & Lightbox

## Goal

Make the species detail image directly swipeable to browse multiple images, and make the lightbox swipeable too. Remove the separate "Image gallery" button.

## Changes

### 1. `templates/species.html` — Inline image swipe

- Remove the "Image gallery" button block (lines 10–15)
- Replace the existing image wrapper (lines 7–9) with a swipe container:

```html
<div class="relative overflow-hidden"
     x-ref="inlineImageContainer"
     x-init="$nextTick(() => initInlineSwipe())">
  <img :src="images[imageIndex]" :alt="name"
       class="w-full transition-transform duration-200"
       loading="lazy"
       @error="$event.target.style.display='none'">
</div>
```

- Add dot indicators below the container (only when `images.length > 1`):

```html
<template x-if="images.length > 1">
  <div class="flex justify-center gap-1.5 py-2">
    <template x-for="(_, i) in images" :key="i">
      <span class="w-2 h-2 rounded-full transition-colors"
            :class="i === imageIndex ? 'bg-gray-700' : 'bg-gray-300'"></span>
    </template>
  </div>
</template>
```

- **Why programmatic `addEventListener` instead of declarative `@touchmove`**: Alpine registers `@touchmove` listeners as passive by default, which means `event.preventDefault()` is illegal inside them. We need `preventDefault()` to block vertical scrolling during a horizontal swipe. Therefore, touch listeners must be set up via `x-init` + `addEventListener(..., { passive: false })` on the `$refs` element.

- **`touch-action: pan-y`** on the swipe container tells the browser to handle vertical panning natively, reducing scroll-vs-swipe disambiguation complexity.

- **`user-select: none`** on the swipe container prevents text selection during horizontal swipes on mobile.

### 2. `templates/species.html` — Swipeable lightbox

- Add `x-ref="lightboxContainer"` on the lightbox overlay div
- Add `x-init="$nextTick(() => initLightboxSwipe())"` to set up touch listeners
- Add `touch-action: manipulation` on the lightbox `<img>` to prevent double-tap zoom
- Keep existing arrow buttons as fallback for non-touch / accessibility

- **Tap-vs-swipe conflict**: The overlay has `@click.self="closeLightbox()"`. Every tap fires both the touch handler and the click handler. Solution: track a `swiped` flag. On `touchend`, if a horizontal swipe occurred, set `this._swiped = true`. In `closeLightbox()`, check `this._swiped` — if true, skip closing and clear the flag on `$nextTick`. This way taps close the lightbox, but swipes navigate images without closing.

### 3. `js/components/ff-entry.js` — State updates

Add to the `ffEntry` component:

**New properties:**
```js
imageIndex: 0,
_swiped: false,
```

**New getter:**
```js
get images() {
  const ref = this.imageRef;
  if (!ref) return [];
  return Array.isArray(ref) ? ref : [ref];
},
```

**`init()` method** — reset `imageIndex` on navigation:
```js
init() {
  this.$watch('details', () => { this.imageIndex = 0; });
},
```

**`initInlineSwipe()` method** — set up touch listeners on the inline image container:
```js
initInlineSwipe() {
  const el = this.$refs.inlineImageContainer;
  if (!el) return;
  let startX = 0, startY = 0, locked = null, dx = 0;

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    locked = null;
    dx = 0;
  };

  const onTouchMove = (e) => {
    const t = e.touches[0];
    const deltaX = t.clientX - startX;
    const deltaY = t.clientY - startY;

    if (!locked && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      locked = Math.abs(deltaX) > Math.abs(deltaY) ? 'h' : 'v';
    }

    if (locked === 'v') return; // allow native scroll

    if (locked === 'h') {
      e.preventDefault();
      dx = deltaX;
    }
  };

  const onTouchEnd = () => {
    if (locked === 'h' && Math.abs(dx) > 50) {
      if (dx < 0 && this.imageIndex < this.images.length - 1) {
        this.imageIndex++;
      } else if (dx > 0 && this.imageIndex > 0) {
        this.imageIndex--;
      }
    }
    locked = null;
    dx = 0;
  };

  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: false });
  el.addEventListener('touchend', onTouchEnd, { passive: true });
},
```

**`initLightboxSwipe()` method** — same pattern for the lightbox:
```js
initLightboxSwipe() {
  const el = this.$refs.lightboxContainer;
  if (!el) return;
  let startX = 0, startY = 0, locked = null, dx = 0;

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    locked = null;
    dx = 0;
  };

  const onTouchMove = (e) => {
    const t = e.touches[0];
    const deltaX = t.clientX - startX;
    const deltaY = t.clientY - startY;

    if (!locked && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      locked = Math.abs(deltaX) > Math.abs(deltaY) ? 'h' : 'v';
    }

    if (locked === 'v') return;

    if (locked === 'h') {
      e.preventDefault();
      dx = deltaX;
    }
  };

  const onTouchEnd = () => {
    if (locked === 'h' && Math.abs(dx) > 50) {
      this._swiped = true;
      if (dx < 0) this.nextImage();
      else if (dx > 0) this.prevImage();
      setTimeout(() => { this._swiped = false; }, 50);
    }
    locked = null;
    dx = 0;
  };

  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: false });
  el.addEventListener('touchend', onTouchEnd, { passive: true });
},
```

**Update `closeLightbox()`:**
```js
closeLightbox() {
  if (this._swiped) return;
  this.lightboxOpen = false;
},
```

### 4. `css/styles.css` — Minimal styling

Add to the existing CSS:
```css
.species-image .relative {
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}
```

No CSS slide transition — can't CSS-transition an `<img>` `src` change without rendering two images and using `transform: translateX()`, which is out of scope for this change.

## Files to modify

| File | What |
|---|---|
| `templates/species.html` | Swipeable image + lightbox, remove gallery button, add dot indicators |
| `js/components/ff-entry.js` | `imageIndex`, `_swiped`, `images` getter, `init()`, `initInlineSwipe()`, `initLightboxSwipe()`, updated `closeLightbox()` |
| `css/styles.css` | `touch-action`, `user-select` on swipe container |

## Edge cases

- **Single image species**: `images.length === 1` → no dots, no swipe trigger, click still opens lightbox
- **Failed image load**: `@error` hides the img; swipe container remains but is empty — acceptable since there's nothing to swipe
- **Wrap-around**: disabled — swiping stops at boundaries (consistent with existing arrow button behavior)
- **Landscape mode**: `.species-image` already has `overflow: hidden` in landscape layout (`styles.css:128`). The swipe container's `overflow-hidden` + `touch-action: pan-y` works within this. Tall portrait images will be clipped by the existing `max-height` constraint — no layout jumps.
- **Double-tap zoom**: prevented via `touch-action: manipulation` on lightbox image

## Verification

- Open a species with multiple images → swipe left/right cycles through images, dot indicators update
- Click image → lightbox opens at the current `imageIndex`
- Swipe in lightbox → cycles through images, tap still closes lightbox
- Arrow buttons still work in lightbox
- Species with single image → no dots, no swipe behavior, click still opens lightbox
- Landscape mode still works correctly
- Vertical scroll works normally on the species detail page (not blocked by swipe handling)
- Text selection doesn't trigger during horizontal swipes on mobile
