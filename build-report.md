# Build Complete

## Product: NAGOYA BITES — UX Overhaul

## Sprint Summary
| Sprint | Attempts | Verdict |
|--------|----------|---------|
| 1 — Mobile layout & filter consolidation | 1 | PASS (100%) |
| 2 — Card & modal redesign | 1 | PASS (96%) |
| 3 — Accessibility, polish & deploy | 1 | PASS (100%) |

## How to Run
- Open `index.html` in any modern browser (no server needed — static file)
- To refresh store data: `cd ~/Desktop/nagoya-bites && node build.js`
- To deploy: `git add index.html sitemap.xml && git commit && git push`
- Live site: https://nagoya-bites.com/

## What Was Built

### Sprint 1 — Mobile-First Layout & Filter UX Consolidation
- **Responsive header**: height 64px → 56px, reduced padding throughout
- **Hero section**: min-height 88vh → 70vh/55vh on mobile, smaller padding
- **Sticky search bar**: new `#sticky-search` bar fixed just below header, bi-directionally synced with hero search
- **Collapsible filter panel**: pref-tabs, cap-tabs, genre filter-bar, tag-filter all wrapped in a single togglable panel with CSS `max-height` transition
- **Filter toggle button**: shows active filter count badge (gold circle)
- **Active filter chips**: dismissible chips show current active filters at a glance
- **"すべてリセット" button**: single click clears all filters, search, and capacity
- **Touch targets**: all filter buttons now min 36-38px height
- **Mobile grid**: single column at ≤640px, 2-column at 641-1024px
- **Safe-area insets**: `env(safe-area-inset-bottom)` on footer and PWA banner for iPhone notch

### Sprint 2 — Card & Modal Redesign
- **Card tag pills**: up to 3 tags shown (シーン/空間 categories) with scene tags in gold
- **Card star rating**: Google rating moved next to restaurant name as SVG star + number
- **Gold booking CTA**: full-width "ホットペッパーで予約" button replacing tiny link
- **Card press state**: `:active` scale transform for touch feedback
- **Modal close button**: enlarged from 32px to 44px
- **Escape key**: closes modal from anywhere on the page
- **Focus trap**: Tab/Shift+Tab cycles within modal when open
- **Swipe-to-close**: vertical swipe down ≥80px from top of modal closes it
- **Lazy Instagram embed**: IntersectionObserver delays iframe until user scrolls to it
- **Scroll-to-top button**: fixed button appears after 400px scroll
- **Footer year**: dynamically set via `new Date().getFullYear()`
- **Card keyboard support**: Enter key opens modal for focused cards
- **Modal ARIA**: `role="dialog"`, `aria-modal="true"`, `aria-label` on close button

### Sprint 3 — Accessibility, Polish & Deploy
- **Focus-visible ring**: 2px gold outline on all interactive elements for keyboard navigation
- **ARIA labels**: on hero search input and button
- **Empty state UI**: friendly Japanese UI (🍽 icon + heading + reset button) replacing generic "No results found"
- **Count animation**: result count fades out/in on filter change
- **build.js run**: 1096 stores from Google Sheets embedded, sitemap.xml updated
- **Git push**: deployed to GitHub Pages (commit e40412b)
