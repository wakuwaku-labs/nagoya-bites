'use strict';
// 本番の確認（保留していた 9 本を公開するときの、変更ごとの確認）。使い方: node prod_held.js <名前> [--base=https://nagoya-bites.com]
const puppeteer = require('puppeteer');
const { execFileSync } = require('child_process');
const BASE = ((process.argv.find((a) => a.startsWith('--base=')) || '--base=https://nagoya-bites.com').slice(7)).replace(/\/$/, '');
const which = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const curl = (url) => execFileSync('curl', ['-s', '-m', '25', '-L', url], { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 });
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };
async function withPage(w, fn) {
  const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 844, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
    await page.setRequestInterception(true);
    page.on('request', (r) => { if (/googletagmanager|google-analytics|formspree|doubleclick/.test(r.url())) return r.abort(); r.continue(); });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await fn(page, errs);
  } finally { await browser.close(); }
}
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
const PAGES = {
  store: '/stores/J001267124.html',
  storeLong: '/stores/J000015458.html',
  hub: '/stores/area/sakae/izakaya.html',
  feature: '/features/banquet.html',
  journal: '/journal/2026-10-11-hoshigaoka-afros-bbq-enkai.html',
};
const checks = {
  async i26c() {
    const css = curl(BASE + '/assets/css/nb.css?v=' + Date.now());
    ok(css.includes('--dim:rgba(28,28,26,.64)'), 'nb.css に新しい --dim（.64）');
    ok(css.includes('--gold2:#866510'), 'nb.css に新しい --gold2（#866510）');
    ok(!css.includes('--dim:rgba(28,28,26,.55)') && !css.includes('--gold2:#96720f'), '旧い値（.55 / #96720f）が残っていない');
    for (const [k, p] of Object.entries(PAGES)) {
      await withPage(390, async (page, errs) => {
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(700);
        const v = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return { dim: cs.getPropertyValue('--dim'), gold2: cs.getPropertyValue('--gold2') }; });
        ok(norm(v.dim) === 'rgba(28,28,26,.64)' && norm(v.gold2) === '#866510', `${k}: 画面で --dim / --gold2 が新しい値`, v);
        ok(errs.length === 0, `${k}: ページのエラーが出ていない`, errs.slice(0, 2));
      });
    }
  },
  async i37() {
    const css = curl(BASE + '/assets/css/nb.css?v=' + Date.now());
    ok(/\.breadcrumb\{[^}]*white-space:nowrap/.test(css.replace(/\s+/g, '')) || css.replace(/\s+/g, '').includes('white-space:nowrap;overflow-x:auto'), 'nb.css の .breadcrumb が nowrap + overflow-x:auto');
    for (const [k, p] of Object.entries(PAGES)) {
      for (const w of [390, 1280]) {
        await withPage(w, async (page, errs) => {
          await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await sleep(900);
          const v = await page.evaluate(() => {
            const b = document.querySelector('.breadcrumb') || document.querySelector('nav[aria-label*="パンくず"]');
            if (!b) return null;
            const cs = getComputedStyle(b), r = b.getBoundingClientRect();
            return { cls: b.className, wrap: cs.flexWrap, ws: cs.whiteSpace, ox: cs.overflowX, h: Math.round(r.height), sw: b.scrollWidth, cw: b.clientWidth, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
          });
          ok(!!v && v.wrap === 'nowrap' && v.ox === 'auto' && v.h <= 72 && !v.hscroll, `${k} ${w}px: パンくずが 1 行（高さ ${v && v.h}px）・横はみ出しなし`, v);
        });
      }
    }
  },
  async i14b() {
    const S = ['/stores/J001267124.html', '/stores/J000015458.html', '/stores/J000015303.html', '/stores/J000016978.html'];
    for (const p of S) {
      await withPage(390, async (page, errs) => {
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(900);
        const v = await page.evaluate(() => {
          const bars = document.querySelectorAll('.nb-action-bar');
          const b = bars[0];
          if (!b) return { n: 0 };
          const cs = getComputedStyle(b), r = b.getBoundingClientRect();
          const btns = [...b.querySelectorAll('.nb-bar-btn')].map((e) => ({ t: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 14), h: Math.round(e.getBoundingClientRect().height), primary: e.classList.contains('nb-bar-primary') }));
          return { n: bars.length, display: cs.display, pos: cs.position, bottomGap: Math.round(innerHeight - r.bottom), h: Math.round(r.height), btns, region: b.getAttribute('role'), label: b.getAttribute('aria-label'), loc: b.outerHTML.includes('store_page_bar'), hscroll: document.documentElement.scrollWidth > innerWidth + 1, outsideMain: !b.closest('main') };
        });
        ok(v.n === 1 && v.display === 'flex' && v.pos === 'sticky' && Math.abs(v.bottomGap) <= 1, `${p} 390px: 帯が 1 つ・画面の下に貼り付く（高さ ${v.h}px）`, { n: v.n, display: v.display, pos: v.pos, gap: v.bottomGap });
        ok(v.btns && v.btns.length >= 2 && v.btns.filter((x) => x.primary).length === 1 && v.btns.every((x) => x.h >= 44), `${p}: ボタン ${v.btns && v.btns.length} 個・塗りは 1 つ・すべて 44px 以上`, v.btns);
        ok(v.region === 'region' && /の予約・電話・地図$/.test(v.label || '') && v.loc && v.outsideMain && !v.hscroll, `${p}: region の名前・計測の location・main の外・横はみ出しなし`, { label: v.label });
        ok(errs.length === 0, `${p}: ページのエラーが出ていない`, errs.slice(0, 2));
      });
    }
    await withPage(1280, async (page) => {
      await page.goto(BASE + S[0], { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(600);
      const d = await page.evaluate(() => { const b = document.querySelector('.nb-action-bar'); return b ? getComputedStyle(b).display : 'none(no element)'; });
      ok(d === 'none', 'PC 1280px: 帯は出ない（スマホだけ）', d);
    });
  },
  async i14d() {
    const S = ['/stores/J001267124.html', '/stores/J000015303.html', '/stores/J000016978.html', '/stores/J000015824.html'];
    for (const p of S) {
      await withPage(390, async (page, errs) => {
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(900);
        const v = await page.evaluate(() => {
          const d = document.querySelectorAll('details.trust-details');
          const x = d[0];
          if (!x) return { n: 0, hasBreakdown: !!document.querySelector('.trust-breakdown') };
          const s = x.querySelector('summary'), sr = s.getBoundingClientRect();
          return { n: d.length, open: x.open, label: s.textContent.trim(), sh: Math.round(sr.height), headline: !!document.querySelector('.trust-breakdown .trust-headline'), metaLine: !!document.querySelector('.trust-breakdown .trust-meta-line'), rowsInside: x.querySelectorAll('.trust-axis-row').length, rowsOutside: document.querySelectorAll('.trust-breakdown .trust-axis-row').length - x.querySelectorAll('.trust-axis-row').length, h2: (document.querySelector('.trust-breakdown h2') || {}).textContent, bh: Math.round(document.querySelector('.trust-breakdown').getBoundingClientRect().height) };
        });
        ok(v.n === 1 && v.open === false && /^内訳を見る（\d+つの検証項目）$/.test(v.label || '') && v.sh >= 44, `${p}: 内訳は 1 つの <details>・既定は閉じる・押す所 ${v.sh}px`, { label: v.label, open: v.open });
        ok(v.headline && v.rowsInside >= 9 && v.rowsOutside === 0 && v.h2 === '口コミ信頼度', `${p}: 見えるのは助言の 1 行（項目の行 ${v.rowsInside} 本は畳んだ中）・見出し「口コミ信頼度」`, { bh: v.bh, h2: v.h2, metaLine: v.metaLine });
        await page.evaluate(() => document.querySelector('details.trust-details summary').click());
        await sleep(250);
        const o = await page.evaluate(() => { const x = document.querySelector('details.trust-details'); const rows = [...x.querySelectorAll('.trust-axis-row')]; return { open: x.open, visible: rows.filter((r) => r.getBoundingClientRect().height > 0).length, total: rows.length }; });
        ok(o.open && o.visible === o.total, `${p}: 押すと開き、項目の行 ${o.visible}/${o.total} が見える`, o);
        ok(errs.length === 0, `${p}: ページのエラーが出ていない`, errs.slice(0, 2));
      });
    }
  },
  async i14a() {
    const S = ['/stores/J001267124.html', '/stores/J000015303.html', '/stores/J000016978.html', '/stores/J000015824.html', '/stores/J000015458.html'];
    for (const p of S) {
      await withPage(390, async (page, errs) => {
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(900);
        const v = await page.evaluate(() => {
          const g = document.querySelector('.store-glance');
          if (!g) return { has: false };
          const r = g.getBoundingClientRect();
          const facts = g.querySelector('.store-facts');
          const chips = g.querySelector('.store-chips');
          const chipEls = chips ? [...chips.querySelectorAll('li')] : [];
          const fs = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
          return {
            has: true, top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY), vh: innerHeight,
            score: !!g.querySelector('.score'), badge: !!g.querySelector('.ccs-badge'), note: (g.querySelector('.score-note') || {}).textContent,
            facts: facts ? facts.textContent.trim() : null, factsFs: fs(facts),
            chips: chipEls.map((c) => c.textContent.trim()), chipFs: chipEls.length ? fs(chipEls[0]) : null, chipsLabel: chips ? chips.getAttribute('aria-label') : null,
            clickable: g.querySelectorAll('a,button,[role=button],[tabindex]').length,
            bad: /undefined|null|NaN|不明/.test(g.textContent), hscroll: document.documentElement.scrollWidth > innerWidth + 1,
            h1Top: Math.round((document.querySelector('h1') || { getBoundingClientRect: () => ({ top: -1 }) }).getBoundingClientRect().top + scrollY),
          };
        });
        ok(v.has && (v.score || !v.note) && v.top < v.vh && v.bottom <= v.vh * 1.2, `${p}: 最初の画面に店名の下の要約（.store-glance）がある（上端 ${v.top}px・下端 ${v.bottom}px・画面 ${v.vh}px・星 ${v.score ? 'あり' : 'なし〔評価が無い店〕'}）`, { score: v.score, badge: v.badge, note: v.note });
        ok(!v.bad && v.clickable === 0 && !v.hscroll, `${p}: 要約の中に押せるものが無く・「不明」「undefined」が出ず・横はみ出しなし`, { clickable: v.clickable });
        ok((v.factsFs === null || v.factsFs >= 14) && (v.chipFs === null || v.chipFs >= 13) && v.chips.length <= 4 && (v.chips.length === 0 || v.chipsLabel === 'この店の条件'), `${p}: 事実の行 ${v.factsFs}px・条件のラベル ${v.chips.length} 個（最大 4）・${v.chipFs === null ? '-' : v.chipFs + 'px'}・一覧に名前`, { facts: v.facts, chips: v.chips, note: v.note });
        ok(errs.length === 0, `${p}: ページのエラーが出ていない`, errs.slice(0, 2));
      });
    }
  },
  async i14e() {
    const S = ['/stores/J001267124.html', '/stores/J000015303.html', '/stores/J000016978.html', '/stores/J000015824.html', '/stores/J000015458.html'];
    for (const p of S) {
      let crumb = null, hubHref = null, ldName = null, more = null, areaCell = null;
      await withPage(390, async (page, errs) => {
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(700);
        const v = await page.evaluate(() => {
          const links = [...document.querySelectorAll('.breadcrumb a')];
          const hub = links.find((a) => /stores\/area\//.test(a.getAttribute('href') || ''));
          let ld = null;
          for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
            try { const j = JSON.parse(s.textContent); for (const o of (Array.isArray(j) ? j : [j])) if (o['@type'] === 'BreadcrumbList') ld = (o.itemListElement[1] || {}).name; } catch (e) {}
          }
          const moreA = [...document.querySelectorAll('a')].find((a) => /をもっと見る/.test(a.textContent));
          const cell = [...document.querySelectorAll('.info-cell')].find((c) => (c.querySelector('label') || {}).textContent === 'エリア');
          return { crumb: hub ? hub.textContent.trim() : null, href: hub ? hub.href : null, ld, more: moreA ? moreA.textContent.trim() : null, moreHref: moreA ? moreA.href : null, area: cell ? cell.querySelector('span').textContent.trim() : null };
        });
        crumb = v.crumb; hubHref = v.href; ldName = v.ld; more = v.more; areaCell = v.area;
        ok(errs.length === 0, `${p}: ページのエラーが出ていない`, errs.slice(0, 2));
        ok(!!crumb && ldName === crumb, `${p}: パンくず「${crumb}」と構造化データの名前が同じ`, { ldName });
        ok(!!more && !!crumb && (more || '').replace(/^←\s*/, '') === crumb + 'をもっと見る', `${p}: 「もっと見る」の文字がパンくずと同じ名前`, { more });
        if (hubHref) {
          await page.goto(hubHref, { waitUntil: 'domcontentloaded', timeout: 45000 });
          const h1 = await page.evaluate(() => (document.querySelector('h1') || {}).textContent.replace(/\s+/g, ''));
          ok(norm(h1) === norm(crumb), `${p}: パンくずの名前が行き先のハブの見出し（${h1}）と同じ`, { crumb });
          ok(!areaCell || h1.startsWith(areaCell.replace(/^愛知県\s*(名古屋市\s*)?/, '').replace(/\s+/g, '') + 'の') || /区$/.test(areaCell.replace(/^愛知県\s*(名古屋市\s*)?/, '')), `${p}: 基本情報の「エリア」（${areaCell}）が、ハブの名前の頭と同じか行政区の元の表記`);
        }
      });
    }
  },
  async i14c() {
    const S = ['/stores/J001267124.html', '/stores/J000015303.html', '/stores/J000016978.html', '/stores/J000015824.html', '/stores/J000015458.html'];
    const ORDER = ['営業時間', '定休日', '席数', '宴会の収容人数', '禁煙・喫煙', 'カード', '駐車場', 'アクセス・特徴'];
    for (const p of S) {
      await withPage(390, async (page, errs) => {
        await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(700);
        const v = await page.evaluate(() => {
          const cells = [...document.querySelectorAll('.info-cell')].map((c) => ({ l: (c.querySelector('label') || {}).textContent, v: ((c.querySelector('span') || {}).textContent || '').trim(), lfs: parseFloat(getComputedStyle(c.querySelector('label')).fontSize), vfs: parseFloat(getComputedStyle(c.querySelector('span')).fontSize) }));
          return { cells, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        const labels = v.cells.map((c) => c.l);
        const idx = (l) => labels.indexOf(l);
        const idxs = ORDER.map(idx).filter((i) => i >= 0);
        const sorted = idxs.every((x, i) => i === 0 || x > idxs[i - 1]);
        ok(sorted && (idx('定休日') < 0 || idx('定休日') === idx('営業時間') + 1) && labels[labels.length - 1] === 'アクセス・特徴', `${p}: 行の順番（営業時間の直後に定休日・アクセス・特徴が最後）`, labels);
        ok(v.cells.every((c) => c.v && !/undefined|null|NaN/.test(c.v) && c.lfs >= 13 && c.vfs >= 14) && !v.hscroll, `${p}: 空の行・「undefined」が無く、ラベル 13px 以上・値 14px 以上・横はみ出しなし`, v.cells.filter((c) => /定休日|席数|宴会|禁煙|カード|駐車場/.test(c.l)).map((c) => c.l + '=' + c.v.slice(0, 24)));
        ok(errs.length === 0, `${p}: ページのエラーが出ていない`, errs.slice(0, 2));
      });
    }
  },
};
(async () => {
  if (!checks[which]) { console.log('使い方: node prod_held.js <' + Object.keys(checks).join('|') + '>'); process.exit(2); }
  await checks[which]();
  console.log(`\n合計 ${fails === 0 ? '全部通過' : fails + ' 件失敗'}（${which}・${BASE}）`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
