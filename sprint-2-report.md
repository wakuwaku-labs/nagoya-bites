# Sprint 2 Report — Card & Modal Redesign

## Changes Implemented

### CSS Changes
1. `.card-tags` / `.ctag` / `.ctag.scene` — tag pill row on cards with scene-type coloring
2. `.card-rating` — prominent gold star rating with SVG star icon
3. `.card-cta` — full-width gold booking CTA button replacing old `cbook` link
4. `.card:active` — press/scale effect for touch feedback
5. `.mcl` updated: width/height enlarged from 32px to 44px for touch accessibility
6. `#scroll-top` — fixed scroll-to-top button with visibility transition
7. Mobile overrides for new card elements

### HTML Changes
1. `#scroll-top` button added (fixed position, bottom-right)
2. Modal `#ov` now has `role="dialog"`, `aria-modal="true"`, `aria-label="店舗詳細"`
3. Modal close button `#mcl` now has `aria-label="閉じる"`

### JS Changes
1. `renderGrid`: cards now show tag pills (up to 3, シーン/空間 categories only)
2. `renderGrid`: Google rating shown as SVG star + number next to restaurant name
3. `renderGrid`: booking CTA is now gold `.card-cta` block instead of small link
4. `renderGrid`: cards have `role="button"`, `tabindex="0"`, `aria-label`
5. Escape key closes modal (global keydown listener)
6. Modal focus trap: Tab/Shift+Tab cycles within modal
7. Swipe-to-close: vertical swipe down ≥80px when at top of modal scroll closes it
8. Lazy Instagram embed: IntersectionObserver delays iframe injection until visible
9. `openM`: uses lazy embed system (stores `_pendingSrc` instead of injecting immediately)
10. Scroll-to-top button: appears after 400px scroll, smooth scroll on click
11. Footer year: dynamically set to `new Date().getFullYear()`
12. Card Enter key: keyboard users can open modal with Enter on focused card

## Verified
- All 25 checks pass
- LOCAL_STORES, applyFilters, openM, closeM all intact
- File size: 901,963 chars

## How to Test
- Open index.html, see tag pills and star rating on cards
- Click "ホットペッパーで予約" — gold CTA button
- Open a modal, press Escape to close
- Open a modal on mobile, swipe down to close
- Open a modal with Instagram post, scroll down to see embed load lazily
- Scroll down 400px+ to see scroll-to-top button appear
