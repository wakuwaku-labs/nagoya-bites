# Sprint 3 Report — Polish, Accessibility & Deploy

## Changes Implemented

### CSS Changes
1. `:focus-visible` global rule: gold outline (2px solid var(--gold)) for keyboard nav
2. Explicit focus-visible on button, a, .card, .ft, .pt, .tg
3. `.empty-state` layout: centered icon + heading + subtext + reset button
4. `.empty-state-reset`: gold background button matching site style
5. `#cnt { transition: opacity .25s }` + `.cnt.fading { opacity: 0 }` for count animation

### HTML Changes
1. Hero search input: added `aria-label="レストランを検索"`
2. Hero search button: added `aria-label="検索"`

### JS Changes
1. `renderGrid` empty state: friendly Japanese UI with 🍽 icon, reset button
2. `renderGrid` count animation: fade-out/in on count update (120ms transition)
3. `build.js` run: 1096 stores embedded, sitemap.xml lastmod updated to 2026-04-10

## Verified
- All 17/17 Sprint 3 checks pass
- build.js ran cleanly: 1096件取得, index.html + sitemap.xml updated
- All Sprint 1 and Sprint 2 features remain intact
- File size: 903,356 chars
- Committed as e40412b and pushed to origin/main

## Deploy
- GitHub Pages: https://nagoya-bites.com/
- Changes live within ~1-2 minutes of push
