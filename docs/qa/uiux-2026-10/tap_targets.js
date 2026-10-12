// トップの「押す所の大きさ」と「13px 未満の文字」を数える（UI・UX 改修計画 U-75・U-76。2026-10-12）。
// デザインシステムは「操作要素は 44px 以上・読む文字は 13px 以上」とする（`docs/design-system.md`）。
// 使い方: node tap_targets.js [リポジトリの直下=今のディレクトリ] [結果の JSON の出力先]
//   手元のファイルを静的サーバで配り（外部への通信は止める）、トップを 390px と 1280px の幅で、
//   初期・フィルターを開いた状態・店のモーダル・検索結果・リスト表示・3 ページ目・0 件・検索候補の 8 状態で見る。
//   押す所は `a` `button` `input` `summary` などに加え、`div` に委譲クリックを付けた部品（タグ・ジャンルのチップなど）も
//   「cursor:pointer の一番外側の要素」として数える。高さが 44px 未満（文字のある要素）か、幅が 24px 未満のものをセレクターごとに出す。
//   見た目は小さいまま `::after` / `::before` で当たり判定だけ 44px に広げた要素は、実際にその点を押せるかを
//   `elementFromPoint` で確かめて「広げている」と数える（見た目の大きさだけで落とさない）。
//   他の要素に覆われている要素（モーダルの下など）は数えない。閉じた `details` の中と、文章の中のリンクは数えない（WCAG 2.5.8 の例外）。
// 2026-10-12 の結果（I-26e）: 44px 未満のセレクター 31 → 1（掲載媒体の文中リンク）、13px 未満の読む文字 12 → 0。
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(process.argv[2] || process.cwd());
const OUT = process.argv[3];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('nf'); } else { res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const collect = () => {
  const keyOf = (e) => (e.id ? '#' + e.id : '') + '.' + (typeof e.className === 'string' ? e.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '') + ' <' + e.tagName.toLowerCase() + '>';
  const tapKey = (e) => { const base = keyOf(e); if (/^\.\s/.test(base) || base.startsWith('. ')) { const p = e.parentElement; const pp = p && p.parentElement; return base + ' ‹ ' + (p ? keyOf(p).replace(/ <.*/, '') + '<' + p.tagName.toLowerCase() + '>' : '') + (pp ? ' ‹ ' + keyOf(pp).replace(/ <.*/, '') : ''); } return base; };
  const visible = (e, cs, r) => r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0' && r.right + scrollX > -500 && r.left + scrollX < innerWidth + 3000 && r.bottom + scrollY > -500;
  const taps = {}, fonts = {};
  const inClosedDetails = (e) => { const d = e.closest('details'); return !!d && !d.open && !(e.tagName === 'SUMMARY' && e.parentElement === d); };
  const hitSize = (e) => {
    try { e.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); } catch (x) {}
    const r = e.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const inside = (x, y) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false; const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
    if (!inside(cx, cy)) return null;
    let l = 0, rr = 0, u = 0, d = 0;
    while (l < 40 && inside(cx - l - 1, cy)) l++;
    while (rr < 40 && inside(cx + rr + 1, cy)) rr++;
    while (u < 40 && inside(cx, cy - u - 1)) u++;
    while (d < 40 && inside(cx, cy + d + 1)) d++;
    return [Math.round((l + rr + 1) * 10) / 10, Math.round((u + d + 1) * 10) / 10];
  };
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [onclick], [tabindex]:not([tabindex="-1"])';
  // div/span に委譲クリックを付けた部品（例: .tg）は sel に掛からないので、cursor:pointer の一番外側の要素も数える
  const candidates = () => {
    const out = new Set(document.querySelectorAll(sel));
    for (const e of document.querySelectorAll('body *')) {
      if (out.has(e)) continue;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG|PATH|G|USE|CIRCLE|RECT|LINE|POLYLINE)$/i.test(e.tagName)) continue;
      if (getComputedStyle(e).cursor !== 'pointer') continue;
      const p = e.parentElement;
      if (p && getComputedStyle(p).cursor === 'pointer') continue;
      out.add(e);
    }
    return out;
  };
  for (const e of candidates()) {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (!visible(e, cs, r)) continue;
    if (inClosedDetails(e)) continue;
    // 文章の中に埋め込まれたリンク（inline）は WCAG 2.5.8 の例外として数えない。親に自分以外の文字が4字以上ある時だけ「文章の中」とみなす
    if (cs.display === 'inline') {
      let around = '';
      for (const n of (e.parentElement ? e.parentElement.childNodes : [])) if (n.nodeType === 3) around += n.textContent;
      if (around.replace(/\s+/g, '').length >= 4) continue;
    }
    if (e.tagName === 'INPUT' && /^(checkbox|radio)$/.test(e.type)) { /* ラベルごと数える */ }
    const k = tapKey(e);
    const t = taps[k] || (taps[k] = { n: 0, small: 0, minH: 1e9, minW: 1e9, sample: '', path: '', disp: '', extended: 0, hitChecked: 0 });
    t.n++;
    const h = Math.round(r.height * 10) / 10, w = Math.round(r.width * 10) / 10;
    const textual = ((e.innerText || e.value || e.placeholder || '') + '').trim().length > 0 && e.tagName !== 'INPUT';
    const tooSmall = h < 43.5 || w < 24 || (!textual && w < 43.5);
    if (tooSmall) { if (t.extOk === undefined) { const hs = hitSize(e); t.covered = hs === null; t.extOk = !!(hs && hs[0] >= 43.5 && hs[1] >= 43.5); } if (t.covered) { t.coveredN = (t.coveredN || 0) + 1; continue; } if (t.extOk) { t.extended = (t.extended || 0) + 1; continue; } t.small++; if (h < t.minH) t.minH = h; if (w < t.minW) t.minW = w; if (!t.sample) t.sample = ((e.innerText || e.getAttribute('aria-label') || e.value || e.placeholder || '') + '').trim().replace(/\s+/g, ' ').slice(0, 18); if (!t.path) { const ch = []; let x = e; for (let i = 0; i < 4 && x && x !== document.body; i++, x = x.parentElement) ch.push(x.tagName.toLowerCase() + (x.id ? '#' + x.id : '') + (typeof x.className === 'string' && x.className ? '.' + x.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '')); t.path = ch.join(' < '); t.disp = cs.display; } }
  }
  for (const e of document.querySelectorAll('body *')) {
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG|PATH)$/i.test(e.tagName)) continue;
    let own = '';
    for (const n of e.childNodes) if (n.nodeType === 3) own += n.textContent;
    own = own.trim();
    const isField = (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') && (e.value || e.placeholder);
    if (!own && !isField) continue;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (!visible(e, cs, r)) continue;
    if (inClosedDetails(e)) continue;
    const fs = parseFloat(cs.fontSize);
    if (fs >= 13) continue;
    const k = keyOf(e);
    const t = fonts[k] || (fonts[k] = { n: 0, fs: {}, sample: '' });
    t.n++; t.fs[fs] = (t.fs[fs] || 0) + 1; if (!t.sample) t.sample = (own || e.placeholder || '').slice(0, 18);
  }
  return { taps, fonts, sw: document.documentElement.scrollWidth };
};
server.listen(0, async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox', '--disable-gpu'] });
  const total = { taps: {}, fonts: {}, sw: {} };
  for (const vp of [{ name: 'm390', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { name: 'd1280', width: 1280, height: 900 }]) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('pwa-banner-dismissed', String(Date.now())); sessionStorage.setItem('nb_splash', '1'); } catch (e) {} });
    await page.setRequestInterception(true);
    page.on('request', (req) => { const u = req.url(); if (u.startsWith(base) || u.startsWith('data:')) return req.continue(); return req.abort(); });
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await sleep(3500);
    const states = {};
    states.initial = await page.evaluate(collect);
    await page.evaluate(() => { const b = document.getElementById('filter-toggle-btn'); if (b) b.click(); });
    await sleep(600);
    states.filter = await page.evaluate(collect);
    await page.evaluate(() => { const b = document.getElementById('filter-toggle-btn'); if (b) b.click(); });
    await sleep(300);
    await page.evaluate(() => { const c = document.querySelector('.card, .store-card'); if (c) c.click(); });
    await sleep(1200);
    states.modal = await page.evaluate(collect);
    await page.evaluate(() => { try { closeM(); } catch (e) {} });
    await sleep(500);
    const setQ = async (q) => { await page.evaluate((q) => { const el = document.getElementById('si2') || document.getElementById('si'); if (!el) return; el.value = q; el.dispatchEvent(new Event('input', { bubbles: true })); try { doSearch(); } catch (e) {} }, q); await sleep(900); };
    await setQ('焼肉');
    states.search = await page.evaluate(collect);
    await page.evaluate(() => { const b = document.getElementById('vt-list'); if (b) b.click(); });
    await sleep(600);
    states.listmode = await page.evaluate(collect);
    await page.evaluate(() => { const b = document.getElementById('vt-grid'); if (b) b.click(); });
    await sleep(300);
    await page.evaluate(() => { try { goToPage(3); } catch (e) {} });
    await sleep(900);
    states.page3 = await page.evaluate(collect);
    await page.evaluate(() => { try { goToPage(1); } catch (e) {} });
    await sleep(500);
    await setQ('zzzzqqqq');
    states.nores = await page.evaluate(collect);
    await setQ('');
    await page.evaluate(() => { const el = document.getElementById('si2') || document.getElementById('si'); if (el) { el.focus(); el.value = '名'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('focus', { bubbles: true })); } });
    await sleep(700);
    states.suggest = await page.evaluate(collect);
    for (const [st, o] of Object.entries(states)) {
      total.sw[vp.name + ':' + st] = o.sw;
      for (const [k, v] of Object.entries(o.taps)) {
        const t = total.taps[k] || (total.taps[k] = { small: {}, minH: 1e9, minW: 1e9, sample: '', n: {}, ext: {} });
        t.n[vp.name + ':' + st] = v.n; if (v.extended) t.ext[vp.name + ':' + st] = v.extended;
        if (v.small) { t.small[vp.name + ':' + st] = v.small; t.minH = Math.min(t.minH, v.minH); t.minW = Math.min(t.minW, v.minW); if (!t.sample) { t.sample = v.sample; t.path = v.path; t.disp = v.disp; } }
      }
      for (const [k, v] of Object.entries(o.fonts)) {
        const t = total.fonts[k] || (total.fonts[k] = { where: {}, fs: {}, sample: v.sample });
        t.where[vp.name + ':' + st] = v.n;
        for (const [f, n] of Object.entries(v.fs)) t.fs[f] = (t.fs[f] || 0) + n;
      }
    }
    await page.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(OUT, JSON.stringify(total, null, 1));
  const exts = Object.entries(total.taps).filter(([k, v]) => Object.keys(v.ext || {}).length);
  console.log('当たり判定を ::after などで 44px に広げている要素:', exts.map(([k, v]) => k + '(' + Object.values(v.ext).reduce((a, b) => a + b, 0) + ')').join(' / ') || 'なし');
  const smalls = Object.entries(total.taps).filter(([k, v]) => Object.keys(v.small).length);
  console.log('押す所が 44px 未満のセレクタ:', smalls.length);
  for (const [k, v] of smalls.sort((a, b) => a[1].minH - b[1].minH)) console.log('  ', k.padEnd(40), 'minH', String(v.minH).padStart(5), 'minW', String(v.minW).padStart(6), '|', v.sample, '|', v.disp, '|', v.path, '|', Object.keys(v.small).length + 'states');
  const fk = Object.entries(total.fonts);
  console.log('\n13px 未満の文字のセレクタ:', fk.length);
  for (const [k, v] of fk.sort((a, b) => a[0].localeCompare(b[0]))) console.log('  ', k.padEnd(46), JSON.stringify(v.fs), '|', v.sample, '|', Object.keys(v.where).join(','));
});
