# Sprint 1 Report — Mobile-First Layout & Filter UX Consolidation

## Changes Implemented

### CSS Changes
1. Header: reduced padding from `0 3rem` to `0 1.5rem`, height 64px -> 56px
2. Hero: reduced padding and min-height for mobile (`70vh`, `120px 2rem 60px`)
3. Added `.sticky-search` bar (sticky, positioned just below header at `top:56px`)
4. Added `.active-chips` row to display dismissible filter chips
5. Added `.filter-toggle-wrap`, `.filter-toggle-btn`, `.filter-badge`, `.clear-all-btn` styles
6. Added `.filter-panel` collapsible container with CSS `max-height` transition
7. Updated `.filter-bar`, `.pref-tabs`, `.tag-filter`, `.cap-tabs` padding from `3rem` to `1.5rem`
8. Increased `.ft` and `.pt` touch targets to `min-height:36px`
9. Updated footer padding; added `flex-wrap:wrap` 
10. Replaced single 640px media query block with comprehensive responsive breakpoints:
    - 640px: single-column grid, reduced hero, safe-area paddings
    - 641-1024px: 2-column grid
11. Added `@supports` safe-area inset rules for iPhone notch

### HTML Changes
1. Added sticky search bar (`#sticky-search` with `#si2` input) after hero section
2. Added active chips container (`#active-chips`)
3. Added filter toggle button (`#filter-toggle-btn`) with badge counter
4. Added "すべてリセット" button (`#clear-all-btn`)
5. Wrapped all filter sections (pref-tabs, cap-tabs, filter-bar, tag-filter) in collapsible `#filter-panel` div

### JS Changes
1. Added `FILTER_PANEL_OPEN` state variable
2. `#si2` (sticky search) syncs bi-directionally with `#si` (hero search)
3. Added `toggleFilterPanel()`: toggles panel open/close with aria-expanded
4. Added `clearAllFilters()`: clears all filters including pref, genre, tags, cap, search
5. Added `updateFilterUI()`: updates badge count, chip list, clear-all visibility
6. Added delegated click handler on `document` for chip dismissal (per-chip clearing)
7. `applyFilters()` now calls `updateFilterUI()` after every filter change

## Verified
- `var LOCAL_STORES = [...]` pattern intact for build.js
- All 17 out of 17 key patterns present in modified file
- File size: 894,835 chars (up from 884,541)

## How to Test
Open index.html in a browser. Check:
- Sticky search bar visible below hero
- Filter panel collapses/expands on button click
- Active chips appear when filters are selected
- "すべてリセット" appears when any filter is active
- Clicking a chip removes that filter
- Mobile at 375px: single-column grid, smaller hero, no overflow
