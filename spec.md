# NAGOYA BITES UX Improvement Spec

## Product
Static single-file (index.html) restaurant discovery app for Nagoya, Japan.
No build framework — vanilla JS/CSS. Data embedded as LOCAL_STORES array.

## Constraints
- Single index.html file; no new files needed for the static site
- `var LOCAL_STORES = [...];` pattern must remain intact for build.js replacement
- All text in Japanese
- No new npm dependencies for the site (CDN links OK)
- Do not break: filtering, search, modal, Instagram embed, Google rating display

## Current UX Pain Points Identified

### Mobile
- Hero section has `min-height:88vh` with `padding:150px 3rem 90px` — wastes screen on mobile
- Header `padding:0 3rem` is too wide for small screens
- Filter bar and tag filter have horizontal padding `3rem` — elements get cramped
- Genre filter-bar chips are tiny (`.56rem` font) — hard to tap
- Modal close button is only 32x32px — too small for touch
- `minfo` grid is `repeat(4,1fr)` — four columns in modal body won't fit on narrow screens
- No bottom safe-area handling (iPhone notch)
- Card grid `minmax(330px,1fr)` renders single column on ~375px phones but cards are too tall

### Filter/Search UX
- Filters are split across 4 separate horizontal bars (pref-tabs, cap-tabs, filter-bar, tag-filter) — cognitively overwhelming and wastes vertical space
- Search box is buried in the hero section far above the filters — users must scroll back up to search
- No visible "active filter count" or easy way to see what is currently filtered
- No "全リセット" (clear all) button — resetting requires clicking multiple areas
- Genre tabs can overflow to many rows on mobile with no visual indication

### Card Design
- Cards show no tags — users can't see 個室/宴会 affordances at a glance
- Booking link text "ホットペッパーで予約" is buried below the fold
- Google rating shown inline but too small
- Card image always same height (210px) regardless of content quality
- Media link row at bottom is cluttered — 6 small links stacked

### Modal
- `.minfo` 4-column grid breaks on mobile
- `max-height:88vh` without proper safe-area padding clips on iPhone
- Close button (✕) is easy to miss — no keyboard Escape support
- Instagram embed loads immediately on open even if user doesn't scroll to it
- No back-swipe / swipe-to-close on mobile

### Accessibility / Polish
- No focus trap in modal
- No `aria-label` on interactive elements
- No visible focus ring (browsers default suppressed)
- Card hover effect only — no active/press state for touch
- Footer says "© 2025" (hardcoded)

---

## Sprint Plan (3 sprints)

### Sprint 1 — Mobile-First Layout & Filter UX Consolidation
**Goal:** Fix the most impactful layout issues for mobile and consolidate the filter UI.

Deliverables:
1. **Responsive header**: reduce padding on mobile, hide nav links behind a hamburger or collapse gracefully
2. **Hero section mobile fix**: reduce hero height/padding on mobile so search is immediately visible
3. **Sticky filter panel consolidation**: collapse pref-tabs + cap-tabs + filter-bar + tag-filter into a single sticky "Filter Panel" with a toggle/accordion on mobile — shows a compact summary bar ("3件のフィルター適用中") when collapsed
4. **Search bar sticky**: move search input into the sticky filter area (keep it also in hero for desktop aesthetics — duplicate input that stays in sync)
5. **"全リセット" (clear all filters) button**: single click clears all active filters
6. **Active filter chips**: show active filters as dismissible chips below the search bar so users always know what's active
7. **Touch target sizes**: ensure all filter buttons min 44px height on mobile
8. **Mobile bottom safe-area**: add `padding-bottom: env(safe-area-inset-bottom)` where needed

### Sprint 2 — Card & Modal Redesign
**Goal:** Make cards more informative at a glance and the modal cleaner and more usable.

Deliverables:
1. **Card tags row**: show the first 2-3 tags (シーン/席タイプ) as small pill badges on the card
2. **Card rating prominence**: move Google rating next to restaurant name, larger and gold-colored
3. **Card hover/active state**: add `:active` press effect (scale down slightly) for touch feedback
4. **Booking CTA button**: make the "ホットペッパーで予約" button more prominent — gold background, full-width within card
5. **Modal responsive grid**: change `.minfo` from `repeat(4,1fr)` to `repeat(2,1fr)` on mobile
6. **Modal close UX**: enlarge close button to 44x44px; add Escape key support; add click-outside-to-close (already exists — verify it works)
7. **Modal safe-area**: ensure modal doesn't get clipped by iPhone notch
8. **Modal focus trap**: trap keyboard focus inside modal when open
9. **Swipe to close modal**: detect vertical swipe-down gesture on modal to close it
10. **Lazy Instagram embed**: only inject the Instagram iframe when the user scrolls to it (IntersectionObserver)

### Sprint 3 — Polish, Accessibility & Deploy
**Goal:** Accessibility improvements, visual polish, and deploy via build.js.

Deliverables:
1. **Keyboard focus ring**: add visible focus ring for keyboard navigation (`:focus-visible` ring in gold)
2. **ARIA labels**: add `aria-label` to close button, filter toggles, search input
3. **`role="dialog"` and `aria-modal`** on the modal overlay
4. **Empty state improvement**: better "no results" UI with icon and "フィルターをリセット" shortcut button
5. **Result count animation**: animate the count when it changes (subtle fade)
6. **Footer year**: update to current year dynamically via JS
7. **Scroll to top button**: appear when user scrolls past the hero, smooth scroll to top
8. **`node build.js` run**: run build.js to embed latest store data then verify output

---

## Success Criteria

| Sprint | Pass Condition |
|--------|---------------|
| 1 | Filter panel consolidation works; mobile layout is clean at 375px; all active filters visible; clear-all works |
| 2 | Cards show tags; modal responsive on mobile; Escape closes modal; swipe-to-close works |
| 3 | Focus rings visible; ARIA on key elements; empty state improved; build.js runs cleanly; git diff shows no regressions |
