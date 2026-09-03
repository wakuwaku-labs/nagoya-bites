#!/usr/bin/env node
/**
 * measure_typography.js
 *
 * DSN-001: 可読性の実測（puppeteer）。本番調査（2026-09-03）で行ったのと同じ
 * 集計をローカルプレビューに対して再現し、before/after の証跡を作る。
 * CI ゲートにはしない（証跡専用。合否は audit_design_system.js が決定的に判定する）。
 *
 * 使い方:
 *   node scripts/measure_typography.js --url http://localhost:8082/ \
 *     --viewports 375x812,768x1024,1280x900 [--search <語>] [--out docs/qa/design-<date>.json]
 *
 * 出力: { url, viewports: [{ width, height, pctLe12, pctLe10_5, firstViewportChars,
 *          secondViewportChars, tapTargetsUnder44, card: {avgHeight, avgChars, avgElements, avgBadges} }] }
 */

'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { url: 'http://localhost:8082/', viewports: '375x812,768x1024,1280x900' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') args.url = argv[++i];
    else if (argv[i] === '--viewports') args.viewports = argv[++i];
    else if (argv[i] === '--search') args.search = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

const MEASURE_FN = function (excludeSelector) {
  function measure(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hist = {};
    let total = 0;
    const perViewport = {};
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const t = n.textContent.replace(/\s+/g, '');
      if (!t) continue;
      const el = n.parentElement;
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // visually-hidden（clip:rect(0,0,0,0)）は非表示扱いにする
      if (cs.clipPath === 'inset(50%)' || (cs.clip && cs.clip.includes('rect(0px, 0px, 0px, 0px)'))) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (excludeSelector && el.closest(excludeSelector)) continue;
      const fs = Math.round(parseFloat(cs.fontSize) * 10) / 10;
      hist[fs] = (hist[fs] || 0) + t.length;
      total += t.length;
      const vp = Math.floor((r.top + window.scrollY) / window.innerHeight);
      perViewport[vp] = (perViewport[vp] || 0) + t.length;
    }
    const le12 = Object.entries(hist).filter(([k]) => +k <= 12).reduce((a, [, v]) => a + v, 0);
    const le105 = Object.entries(hist).filter(([k]) => +k <= 10.5).reduce((a, [, v]) => a + v, 0);
    return {
      total,
      pctLe12: total ? Math.round((le12 / total) * 100) : 0,
      pctLe10_5: total ? Math.round((le105 / total) * 100) : 0,
      firstViewportChars: perViewport[0] || 0,
      secondViewportChars: perViewport[1] || 0,
    };
  }

  function tapTargetsUnder44() {
    const els = document.querySelectorAll('a, button, [role=button], input, select, summary');
    let count = 0;
    els.forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.height > 0 && r.height < 44) count++;
    });
    return count;
  }

  function measureCards() {
    const cards = [...document.querySelectorAll('#grid .card, .store-card')].slice(0, 12);
    if (!cards.length) return null;
    const per = cards.map((c) => {
      const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
      let chars = 0, els = 0;
      while (walker.nextNode()) {
        const n = walker.currentNode;
        const t = n.textContent.replace(/\s+/g, '');
        if (!t) continue;
        const el = n.parentElement;
        const cs = getComputedStyle(el);
        if (cs.display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        chars += t.length;
        els++;
      }
      return {
        h: Math.round(c.getBoundingClientRect().height),
        chars,
        els,
        badges: c.querySelectorAll('.badge,.card-flag,.trend-badge,.pref-badge,.editor-note,.editor-pick,.pro-pick,.insider-badge').length,
      };
    });
    return {
      avgHeight: Math.round(per.reduce((a, p) => a + p.h, 0) / per.length),
      avgChars: Math.round(per.reduce((a, p) => a + p.chars, 0) / per.length),
      avgElements: Math.round(per.reduce((a, p) => a + p.els, 0) / per.length),
      avgBadges: Math.round((per.reduce((a, p) => a + p.badges, 0) / per.length) * 10) / 10,
    };
  }

  const magazine = measure(document.body);
  const tapUnder44 = tapTargetsUnder44();
  const card = measureCards();
  return { magazine, tapUnder44, card };
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('puppeteer is not installed. This script is optional evidence tooling (not a CI gate).');
    process.exit(0);
  }

  const viewports = args.viewports.split(',').map((v) => {
    const [width, height] = v.split('x').map(Number);
    return { width, height };
  });

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const results = { url: args.url, measuredAt: new Date().toISOString(), viewports: [] };

  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    try {
      await page.goto(args.url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 800));

      if (args.search) {
        await page.evaluate((q) => {
          if (typeof suggestSearch === 'function') suggestSearch(q);
        }, args.search);
        await new Promise((r) => setTimeout(r, 1500));
      }

      const data = await page.evaluate(MEASURE_FN, '#store-index');
      results.viewports.push({ width: vp.width, height: vp.height, ...data });
    } catch (e) {
      results.viewports.push({ width: vp.width, height: vp.height, error: e.message });
    }
    await page.close();
  }

  await browser.close();

  const output = JSON.stringify(results, null, 2);
  console.log(output);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, output);
    console.error(`Saved to ${args.out}`);
  }
}

main();
