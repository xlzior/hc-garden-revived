# Plan: Replace Catalog Circle Buttons with Segmented Control

## Motivation

The current catalog view starts with two large circle buttons (Flora/Fauna) that act as category selectors. This adds an unnecessary tap before users see any content. A segmented control at the top is more compact, standard, and lets users immediately browse the list while being able to switch categories.

## Current Structure

1. **Search bar** at the top (always visible)
2. **Circle buttons** shown when no search term and both categories active (`showCircleButtons` getter)
3. **Species list** shown when a search term exists or a single category is selected (`showList()`)

This creates a two-step flow: pick a category → see the list. The back arrow returns to the circle view.

## Target Structure

1. **Segmented control** at the top: three segments — "All", "Flora", "Fauna"
2. **Search bar** below the segmented control
3. **Species list** always visible below, filtered by the active segment

Single-step flow: everything is visible at once. The list always shows; the segmented control and search bar filter it.

## Changes Required

### `templates/catalog.html`

- **Remove** the entire circle buttons block (lines 10–24: the `<template x-if="showCircleButtons">` block).
- **Remove** the back arrow from the search bar (line 4: the `arrow_back` span).
- **Add** a segmented control above the search bar. Three buttons styled as a pill-shaped group with Tailwind. The active segment gets a highlighted background (e.g. `bg-blue-500 text-white`), inactive segments get `bg-gray-200 text-gray-700`. Clicking a segment calls `setActiveType('all')`, `setActiveType('flora')`, or `setActiveType('fauna')`.
- **Remove** the `<template x-if="showList()">` wrapper — the list is always shown now (just the `<div class="overflow-auto">` stays).
- **Simplify** section headers: when `activeType === 'all'`, show "Fauna" and "Flora" headers above their respective sections (no longer gated on `searchTerm !== ''`). When a single type is active, no header needed since there's only one section.

### `js/components/ff-list.js`

- **Replace** `type: { flora: true, fauna: true }` with `activeType: 'all'` as the single source of truth. Make `type` a getter/setter that derives from `activeType`:

```js
activeType: 'all',

get type() {
  if (this.activeType === 'flora') return { flora: true, fauna: false };
  if (this.activeType === 'fauna') return { flora: false, fauna: true };
  return { flora: true, fauna: true };
},

set type(val) {
  if (val.flora && val.fauna) this.activeType = 'all';
  else if (val.flora) this.activeType = 'flora';
  else if (val.fauna) this.activeType = 'fauna';
  // both false: leave activeType unchanged (empty list result, existing quirk)
},
```

This eliminates the dual-state sync problem entirely. The `set` side handles `filter-changed` naturally since it already assigns to `this.type`. The `get` side means `isFiltered()` and all other reads of `this.type` work without changes.

- **Add** method `setActiveType(type)` that sets `this.activeType = type`.
- **Remove** `showCircleButtons` getter (lines 73–75).
- **Remove** `showFloraOnly` / `showFaunaOnly` getters (lines 77–83) — no longer needed since there's no back arrow.
- **Remove** `showList()` method (lines 85–87) — the list is always shown.
- **Remove** `selectFlora()`, `selectFauna()`, `resetToCircleButtons()` methods (lines 89–100) — replaced by `setActiveType()`.
- **Update** `clearSearch()` to only clear `searchTerm` (the segmented control controls the type, so `clearSearch` should not touch it).
- **`isFiltered()`** requires no changes — it reads `this.type.flora` / `this.type.fauna`, which the getter provides correctly.

### Cleanup

- **`css/styles.css`**: Remove the `@font-face` for Precious (lines 1–6) since it was only used in the circle button labels. (Grep confirms only `catalog.html` lines 15/20 use it.)
- **`js/service-worker.js`**: Remove `"assets/fonts/Precious.ttf"` from the precache list (line 85).
- **`assets/fonts/Precious.ttf`**: Optionally delete the font file (not in gitignore, so it's in the repo). Low priority.

## Risks

- **Filter modal interaction**: The filter modal dispatches `filter-changed` with a `type` object. The `type` setter on the component handles this — assigning `this.type = e.detail.type` triggers the setter, which syncs `activeType`. If the modal unchecks both flora and fauna (`{ flora: false, fauna: false }`), the setter leaves `activeType` unchanged (existing quirk — produces an empty list, same as current behavior).
- **Precious font removal**: Confirmed only used in the two circle button labels. Safe to remove the `@font-face` and service worker entry. The font file itself can stay (no harm) or be deleted.

## Implementation Steps

1. Update `templates/catalog.html`: remove circle buttons, add segmented control, simplify list rendering.
2. Update `js/components/ff-list.js`: replace `type` with `activeType` + getter/setter, add `setActiveType()`, remove obsolete getters/methods, simplify `clearSearch()`.
3. Remove Precious font from `css/styles.css` and `js/service-worker.js`.
4. Test locally: verify segmented control switches categories, search still works, filter modal still works, list renders correctly for all/flora/fauna.

## Verification

- Open `http://localhost:8080/#catalog`
- Segmented control shows "All", "Flora", "Fauna" with All selected by default
- List shows all species immediately
- Clicking "Flora" shows only flora, "Fauna" shows only fauna, "All" shows both with section headers
- Typing in search bar filters the list
- Clear button resets search only (keeps active segment)
- Filter modal still works and syncs with the segmented control
