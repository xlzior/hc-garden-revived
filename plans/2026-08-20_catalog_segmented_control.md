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
- **Add** a segmented control above the search bar. Three buttons styled as a pill-shaped group with Tailwind. The active segment gets a highlighted background (e.g. `bg-blue-500 text-white`), inactive segments get `bg-gray-200 text-gray-700`. Clicking a segment calls a new method (e.g. `setActiveType('all')`, `setActiveType('flora')`, `setActiveType('fauna')`).
- **Remove** the `<template x-if="showList()">` wrapper — the list is always shown now (just the `<div class="overflow-auto">` stays, conditionally rendering sections based on active type).
- **Simplify** the section headers: show "Fauna" header when `activeType === 'all'` (or both), show "Flora" header similarly. When a single type is active, no header needed.

### `js/components/ff-list.js`

- **Add** new data property: `activeType: 'all'` (string: `'all'`, `'flora'`, or `'fauna'`).
- **Add** method `setActiveType(type)` that sets `this.activeType = type` and updates `this.type` accordingly (`{ flora: true, fauna: true }` for `'all'`, etc.).
- **Remove** `showCircleButtons` getter (line 73–75).
- **Remove** `showFloraOnly` / `showFaunaOnly` getters (lines 77–83) — no longer needed since there's no back arrow.
- **Remove** `showList()` method (lines 85–87) — the list is always shown.
- **Remove** `selectFlora()`, `selectFauna()`, `resetToCircleButtons()` methods (lines 89–105) — replaced by `setActiveType()`.
- **Update** `clearSearch()` to only clear `searchTerm` (not reset `type`, since the segmented control controls the type now).
- **Update** the `filter-changed` listener to also sync `activeType` when the filter modal changes the type.
- **Update** `isFiltered()` to check `activeType` instead of `this.type.flora`/`this.type.fauna` directly (or keep `type` in sync — simpler to just keep `type` in sync from `setActiveType`).

### Cleanup

- **`css/styles.css`**: Remove the `@font-face` for Precious (lines 1–5) since it was only used in the circle button labels. (Verify no other usage first — grep confirms only `catalog.html` lines 15/20 use it.)
- **`js/service-worker.js`**: Remove `"assets/fonts/Precious.ttf"` from the precache list (line 85).
- **`assets/fonts/Precious.ttf`**: Optionally delete the font file (not in gitignore, so it's in the repo). Low priority.

## Risks

- **Filter modal interaction**: The filter modal dispatches `filter-changed` with a `type` object. The catalog must continue to handle this and sync `activeType` accordingly. Low risk — straightforward sync.
- **Precious font removal**: Confirmed only used in the two circle button labels. Safe to remove the `@font-face` and service worker entry. The font file itself can stay (no harm) or be deleted.

## Implementation Steps

1. Update `templates/catalog.html`: remove circle buttons, add segmented control, simplify list rendering.
2. Update `js/components/ff-list.js`: add `activeType` + `setActiveType()`, remove obsolete getters/methods, simplify `clearSearch()`.
3. Remove Precious font from `css/styles.css` and `js/service-worker.js`.
4. Test locally: verify segmented control switches categories, search still works, filter modal still works, list renders correctly for all/flare/fauna, and the back button on mobile still functions.

## Verification

- Open `http://localhost:8080/#catalog`
- Segmented control shows "All", "Flora", "Fauna" with All selected by default
- List shows all species immediately
- Clicking "Flora" shows only flora, "Fauna" shows only fauna, "All" shows both with section headers
- Typing in search bar filters the list
- Clear button resets search only (keeps active segment)
- Filter modal (if accessible) still works and syncs with the segmented control
