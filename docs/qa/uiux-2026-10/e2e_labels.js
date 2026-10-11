// I-07（英語の表示を日本語に）の実ブラウザ確認。index.html をローカルで配信し、headless Chrome（puppeteer）で、トップの表示ラベルから英語が消え、絞り込みなどの動きが変わっていないことを確かめる。
// 使い方: node docs/qa/uiux-2026-10/e2e_labels.js [--root <フォルダ>] [--viewport mobile|desktop|both] [--label <名前>] [--json <出力先>] [--shots <フォルダ>] [--headless auto|shell|new] [--strict]
// - --root: 配信するフォルダ（既定: このリポジトリの直下）。改修前の index.html を置いたフォルダを渡すと、同じ確認が「前」でどうなるかを比べられる
// - --viewport: mobile = 390x844（タッチ）／desktop = 1280x900（既定は両方）
// - --shots: 画面の写真（PNG）を残すフォルダ。無ければ撮らない
// - --strict: 「別の課題で直す」と決めてある英語（下の KNOWN_REMAINING）も失敗として数える
// 英語の探し方: 画面の文字（テキストノード）と、読み上げ・ツールチップ・入力欄の文字（aria-label・title・placeholder）から、英字2文字以上の語を集める。
// 店名（全店のデータ）・ブランド名（Google・Instagram・LINE など）・編集部が書いた本文・写真のクレジットは数えない。
// 閉じているパネル（ご意見・フィルターなど）の文字も、DOM にあれば数える。外部への通信はすべて中断する（ローカルの配信だけで動く）。
// 終了コード: 失敗した確認があれば 1、なければ 0（puppeteer が無いときは 2）。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) {
  console.error('puppeteer が見つかりません（puppeteer のある node_modules から実行してください）');
  process.exit(2);
}

const argv = process.argv.slice(2);
const getOpt = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const ROOT = path.resolve(getOpt('--root', path.join(__dirname, '..', '..', '..')));
const WHICH = getOpt('--viewport', 'both');
const LABEL = getOpt('--label', 'after');
const JSON_OUT = getOpt('--json', '');
const SHOTS = getOpt('--shots', '');
const HEADLESS = getOpt('--headless', 'auto');
const STRICT = argv.includes('--strict');

const VIEWPORTS = {
  mobile: { name: 'mobile-390', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { name: 'desktop-1280', width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

// ブランド名・固有の表記・決まった表記は、英語の表示として数えない（小文字で比べる）
const ALLOWED_WORDS = [
  'google', 'instagram', 'line', 'x', 'twitter', 'hotpepper', 'hot', 'pepper', 'nagoya', 'bites', 'sns', 'pwa', 'tiktok', 'youtube', 'ios', 'android',
  'ig', // Instagram の略（口コミ信頼度の内訳の文言「IG解決」。データ側の文言で、この確認の範囲の外）
  'ss', // 口コミ信頼度の段階の記号（SS〜D）
  'top', // 「TOP 10」「TOP5」の見出し
  'pr', // 「PR記事ゼロ」「掲載料・PR費は受け取りません」（編集独立性の説明で使う略語）
  'powered', 'by', 'web', // ホットペッパーの Web サービスの利用条件で決まった表記（Powered by ホットペッパーグルメ Webサービス）
];
// 別の課題で直すと決めてある英語（見つけても失敗にしない。--strict で失敗にする）
const KNOWN_REMAINING = {
  daily: 'フッターの「Daily Journal」は共通クローム（scripts/lib/site_chrome.js）の表記で、直すと約6,000ページが変わるため I-07b に分けた',
  journal: 'フッターの「Daily Journal」（同上）',
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json',
};

async function launchBrowser() {
  const modes = HEADLESS === 'shell' ? ['shell'] : HEADLESS === 'new' ? [true] : ['shell', true];
  let lastErr;
  for (const m of modes) {
    try {
      const b = await puppeteer.launch({ headless: m, protocolTimeout: 30000 });
      console.log(`ブラウザ: ${await b.version()}（headless: ${m}）`);
      return b;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function startServer() {
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end('bad'); }
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    let ok = false;
    try { ok = f.startsWith(ROOT) && fs.statSync(f).isFile(); } catch (e) { ok = false; }
    if (!ok) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPage(browser, base, vp) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  await page.bringToFront();
  // 初回訪問のスプラッシュ（全面）と、ホーム画面追加の案内は、見終えた・閉じた人の状態にする（どちらも I-13 の範囲）
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('pwa-banner-dismissed', String(Date.now())); } catch (e) { /* 保存できない環境では案内が出るだけ */ }
    try { sessionStorage.setItem('nb_splash', '1'); } catch (e) { /* 同上 */ }
    const orig = window.addEventListener;
    window.addEventListener = function (type, fn, o) { if (type === 'beforeinstallprompt') return undefined; return orig.call(this, type, fn, o); };
  });
  const log = { pageErrors: [], blocked: 0 };
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith(base) && /\/(sw\.js|manifest\.(json|webmanifest))(\?|$)/.test(u)) return req.respond({ status: 404, contentType: 'text/plain', body: 'not found' });
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:') || u === 'about:blank') return req.continue();
    log.blocked++;
    return req.abort();
  });
  page.on('pageerror', e => log.pageErrors.push(String((e && e.message) || e).slice(0, 300)));
  page.__log = log;
  return page;
}

async function waitFn(page, fn, arg, timeout) {
  try { await page.waitForFunction(fn, { timeout: timeout || 8000, polling: 50 }, arg); return true; } catch (e) { return false; }
}
const waitCatalog = page => waitFn(page, () => window.FULL_CATALOG_LOADED === true && window.ALL_STORES && window.ALL_STORES.length > 1000, null, 30000);

const results = [];
function check(vp, id, name, ok, detail) { results.push({ viewport: vp.name, id, name, ok: !!ok, detail: detail || '' }); }

async function openTop(browser, base, vp, hash) {
  const page = await newPage(browser, base, vp);
  await page.goto(base + '/' + (hash || ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitCatalog(page);
  await sleep(300);
  return page;
}

async function shot(page, vp, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  try { await page.screenshot({ path: path.join(SHOTS, `${LABEL}-${vp.name}-${name}.png`) }); } catch (e) { /* 写真が撮れなくても確認は続ける */ }
}

// 画面の英語の探し方（ブラウザの中で動く）。店名・ブランド名・編集部の本文・写真クレジットを除いた英字2文字以上の語を返す
function scanEnglish(allowed) {
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE', 'META', 'LINK']);
  const CONTENT = '.card-lead, .m-lead, .ljc-title, .ljc-desc, .photo-credit'; // 編集部が書いた本文・外部の人の名前
  const allow = new Set(allowed);
  const latin = v => /[A-Za-z]{2,}/.test(v || '');
  // 店名（英字を含むもの）は、文字列から取り除いてから語を数える。画面の文字は空白をひとつにまとめているので、店名も同じにそろえる（全角空白など）
  const norm = v => String(v).replace(/\s+/g, ' ').trim();
  const names = Array.from(new Set((window.ALL_STORES || []).map(s => s['店名']).filter(n => n && /[A-Za-z]/.test(n)).map(norm))).sort((a, b) => b.length - a.length);
  const extra = Array.from(new Set((window.ALL_STORES || []).flatMap(s => [s['エリア'], s['ジャンル'], s['最寄り駅']]).filter(n => n && /[A-Za-z]/.test(n)).map(norm))).sort((a, b) => b.length - a.length);
  const strip = text => {
    let t = text;
    // 店名を先に取り除く（「Cupping Room@caffe bontain」のように店名に @ が入るものがあるため、メールアドレスより先）
    for (const n of names) if (t.indexOf(n) >= 0) t = t.split(n).join(' ');
    for (const n of extra) if (t.indexOf(n) >= 0) t = t.split(n).join(' ');
    return t.replace(/[\w.+-]+@[\w.-]+/g, ' ').replace(/https?:\/\/\S+/g, ' ');
  };
  const out = [];
  const seen = new Set();
  const add = (kind, text, el) => {
    const words = (strip(text).match(/[A-Za-z][A-Za-z'’]*/g) || []).filter(w => w.length >= 2 && !allow.has(w.toLowerCase()));
    if (!words.length) return;
    const key = kind + '|' + text;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, text: text.slice(0, 100), words: Array.from(new Set(words)), tag: el.tagName.toLowerCase(), id: el.id || '', cls: typeof el.className === 'string' ? el.className.split(' ')[0] : '' });
  };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
    const p = n.parentElement;
    if (!t || !latin(t) || !p || SKIP_TAGS.has(p.tagName) || p.closest(CONTENT)) continue;
    add('text', t, p);
  }
  for (const el of document.querySelectorAll('[aria-label],[title],[placeholder]')) {
    if (el.closest(CONTENT) || el.tagName === 'LINK' || el.tagName === 'META') continue; // link・meta の title は検索エンジン向けで、画面には出ない
    for (const a of ['aria-label', 'title', 'placeholder']) { const v = el.getAttribute(a); if (v && latin(v)) add('attr:' + a, v, el); }
  }
  return out;
}

async function scenarioLabels(browser, base, vp) {
  const page = await openTop(browser, base, vp);
  const L = await page.evaluate(() => {
    const t = s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; };
    const tiles = Array.from(document.querySelectorAll('#genre-filter-bar .ft'));
    return {
      genreLabel: t('#genre-filter-bar .fl'),
      firstTile: tiles[0] ? tiles[0].textContent.trim() : null,
      firstTileKey: tiles[0] ? tiles[0].dataset.f : null,
      tileTexts: tiles.map(x => x.textContent.trim()),
      tileCount: tiles.length,
      capLabel: t('#cap-tabs .cap-label'),
      capInput: !!document.getElementById('cap-input'),
      capUnit: t('#cap-tabs .cap-unit'),
      fbTitle: t('.fb-panel-title'),
      rankScores: Array.from(document.querySelectorAll('.rank-score')).map(x => x.textContent.trim()),
      // 閲覧数の文字が何行に割れているか（Range の行ごとの矩形の数）。1行でなければ「12回閲／覧」のように途中で折れている
      rankScoreLines: Array.from(document.querySelectorAll('.rank-score')).map(x => { const r = document.createRange(); r.selectNodeContents(x); return r.getClientRects().length; }),
    };
  });
  check(vp, 'L1-genre-label', 'ジャンルの絞り込みの見出しが「ジャンル」', L.genreLabel === 'ジャンル', `"${L.genreLabel}"`);
  check(vp, 'L1-all-tile', '先頭の選択肢が「すべて」（内部の値 data-f は All のまま）', L.firstTile === 'すべて' && L.firstTileKey === 'All', `text="${L.firstTile}" data-f="${L.firstTileKey}"`);
  check(vp, 'L1-tiles', '選択肢にジャンル名が並び、「All」の文字は無い', L.tileCount >= 5 && !L.tileTexts.some(x => /^all$/i.test(x)), `${L.tileCount}個 ${JSON.stringify(L.tileTexts.slice(0, 6))}`);
  check(vp, 'L2-cap-label', '人数の絞り込みの見出しが「収容人数」で、入力欄と単位は残っている', L.capLabel === '収容人数' && L.capInput && /名以上/.test(L.capUnit || ''), `label="${L.capLabel}" input=${L.capInput} unit="${L.capUnit}"`);
  check(vp, 'L3-rank-score', 'ランキングの閲覧数が「N回閲覧」（views の文字は無い）', L.rankScores.length >= 1 && L.rankScores.every(x => /^\d+回閲覧$/.test(x)), JSON.stringify(L.rankScores.slice(0, 5)));
  check(vp, 'L3-rank-score-one-line', 'ランキングの閲覧数「N回閲覧」が途中で折り返さず1行で出る（長いジャンル名・エリア名のカードでも）', L.rankScoreLines.length >= 1 && L.rankScoreLines.every(n => n === 1), JSON.stringify(L.rankScoreLines));
  check(vp, 'L4-feedback-title', 'ご意見パネルの見出しが「サイトへのご意見」（FEEDBACK の文字は無い）', L.fbTitle === 'サイトへのご意見', `"${L.fbTitle}"`);

  // 「リール」: 動画つきの店のカードを組み立てて確かめる（カードはリール動画を持つ店だけに印を付ける）
  const R = await page.evaluate(() => {
    for (let i = 0; i < window.ALL_STORES.length; i++) {
      const s = window.ALL_STORES[i];
      let v = null;
      try { v = nbVerifiedReel(s); } catch (e) { v = null; }
      if (v && v.kind === 'reel') {
        const html = buildCardHtml(s);
        const m = html.match(/<span class="reel-tag">([^<]*)<\/span>/);
        return { store: s['店名'], tag: m ? m[1] : null };
      }
    }
    return { store: null, tag: null };
  });
  check(vp, 'L5-reel-tag', 'リール動画つきのカードの印が「リール」', R.store !== null && R.tag === 'リール', `store="${R.store}" tag="${R.tag}"`);

  // 通知ボタンの案内: 準備中のことを日本語で出す
  const toast = await page.evaluate(() => { showNotifyToast(); const t = document.getElementById('toast'); return t ? t.textContent : null; });
  check(vp, 'L6-notify-toast', '「この条件で通知」の案内が日本語（準備中です）', typeof toast === 'string' && toast.startsWith('準備中です') && !/Coming Soon/i.test(toast), `"${toast}"`);
  await shot(page, vp, 'top');

  // 絞り込みが今までどおり動く: ジャンルを選ぶ → すべて
  const G = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('#genre-filter-bar .ft'));
    const named = tiles[1];
    named.click();
    const afterNamed = { on: document.querySelector('.ft.on').dataset.f, filtered: FILTERED.length, active: document.body.classList.contains('search-active'), allMatch: FILTERED.every(s => normalizeGenre(s['ジャンル'] || '') === named.dataset.f), name: named.dataset.f, hash: location.hash };
    tiles[0].click();
    const afterAll = { on: document.querySelector('.ft.on').dataset.f, filtered: FILTERED.length, total: ALL_STORES.length, active: document.body.classList.contains('search-active'), hash: location.hash };
    return { afterNamed, afterAll };
  });
  check(vp, 'L7-genre-filter', 'ジャンルを選ぶとその店だけに絞られる', G.afterNamed.on === G.afterNamed.name && G.afterNamed.active && G.afterNamed.filtered > 0 && G.afterNamed.filtered < G.afterAll.total && G.afterNamed.allMatch, JSON.stringify(G.afterNamed));
  check(vp, 'L7-genre-all', '「すべて」を選ぶと全店に戻り、一覧は隠れて、URL に genre=All は付かない', G.afterAll.on === 'All' && G.afterAll.filtered === G.afterAll.total && !G.afterAll.active && !/genre=All/i.test(G.afterAll.hash), JSON.stringify(G.afterAll));
  const cap = await page.evaluate(() => { const i = document.getElementById('cap-input'); i.value = '30'; i.dispatchEvent(new Event('input', { bubbles: true })); return { filtered: FILTERED.length, total: ALL_STORES.length, active: document.body.classList.contains('search-active') }; });
  check(vp, 'L7-cap-filter', '人数を入れるとその人数以上の店に絞られる（入力欄が今までどおり動く）', cap.active && cap.filtered > 0 && cap.filtered < cap.total, JSON.stringify(cap));
  check(vp, 'L7-error', '表示ラベルの確認: ページのエラーが出ていない', page.__log.pageErrors.length === 0, page.__log.pageErrors.join(' / '));
  await page.close();

  // URL からの復元: ジャンル名（選択肢の data-f と同じ文字）のままで選択が復元される
  const genreName = G.afterNamed.name;
  const page2 = await openTop(browser, base, vp, '#genre=' + encodeURIComponent(genreName));
  const H = await page2.evaluate(() => { const on = document.querySelector('.ft.on'); return { key: on && on.dataset.f, text: on && on.textContent.trim(), active: document.body.classList.contains('search-active') }; });
  check(vp, 'L8-hash-restore', `URL の #genre=${genreName} で、その選択肢が選ばれた状態で開く`, H.key === genreName && H.text === genreName && H.active, JSON.stringify(H));
  await page2.close();
}

// 画面の英語を、いくつかの状態で集める。KNOWN_REMAINING 以外が見つかれば失敗
async function scenarioScan(browser, base, vp) {
  const page = await openTop(browser, base, vp);
  const found = {};
  const collect = async state => {
    const arr = await page.evaluate(scanEnglish, ALLOWED_WORDS);
    for (const f of arr) { const k = f.kind + '|' + f.text; (found[k] = found[k] || Object.assign({ states: [] }, f)).states.push(state); }
  };
  await collect('初期');
  await page.evaluate(() => { const si = document.getElementById('si'); si.value = '焼肉'; applyFilters(); });
  await sleep(500);
  await collect('検索結果');
  await page.evaluate(() => { if (typeof openFilterPanel === 'function') openFilterPanel(); });
  await sleep(400);
  await collect('フィルターパネル');
  await page.evaluate(() => { if (typeof closeFilterPanel === 'function') closeFilterPanel(); if (typeof toggleNav === 'function') toggleNav(); });
  await sleep(400);
  await collect('ナビ');
  await page.evaluate(() => { if (typeof closeNav === 'function') closeNav(); openM(0, 'grid'); });
  await sleep(1200);
  await collect('店のモーダル');
  await page.evaluate(() => { closeM(); const si = document.getElementById('si'); si.value = '存在しないお店のなまえあいうえお'; applyFilters(); });
  await sleep(500);
  await collect('該当なし');
  await page.evaluate(() => { showNotifyToast(); });
  await collect('通知の案内');
  await shot(page, vp, 'scan-last');
  const all = Object.values(found);
  const known = all.filter(f => f.words.every(w => KNOWN_REMAINING[w.toLowerCase()]));
  const unknown = all.filter(f => !f.words.every(w => KNOWN_REMAINING[w.toLowerCase()]));
  check(vp, 'S1-no-english', `画面の英語が無い（${all.length === 0 ? '0件' : '見つかった: ' + unknown.length + '件'}）`, unknown.length === 0, unknown.slice(0, 60).map(f => `${f.kind} "${f.text}" [${f.words.join(',')}] <${f.tag}${f.id ? '#' + f.id : ''}${f.cls ? '.' + f.cls : ''}> ${Array.from(new Set(f.states)).join('/')}`).join(' ; '));
  if (known.length) {
    const notes = Array.from(new Set(known.flatMap(f => f.words.map(w => KNOWN_REMAINING[w.toLowerCase()]))));
    check(vp, 'S1-known-remaining', `別の課題で直す英語（${known.length}件）は残っている: ${notes.join(' / ')}`, !STRICT, known.map(f => `"${f.text}"`).join(' ; '));
  }
  check(vp, 'S1-error', '英語の探索: ページのエラーが出ていない', page.__log.pageErrors.length === 0, page.__log.pageErrors.join(' / '));
  await page.close();
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  console.log(`配信: ${ROOT} → ${base}（ラベル: ${LABEL}${STRICT ? '・--strict' : ''}）`);
  const browser = await launchBrowser();
  const vps = WHICH === 'mobile' ? [VIEWPORTS.mobile] : WHICH === 'desktop' ? [VIEWPORTS.desktop] : [VIEWPORTS.mobile, VIEWPORTS.desktop];
  try {
    for (const vp of vps) {
      console.log(`\n── ${vp.name} ──`);
      for (const fn of [scenarioLabels, scenarioScan]) {
        const before = results.length;
        try { await fn(browser, base, vp); } catch (e) { check(vp, 'EXC-' + fn.name, fn.name + ' で例外', false, String((e && e.stack) || e).slice(0, 400)); }
        for (const r of results.slice(before)) console.log(`${r.ok ? '✅' : '❌'} ${r.id} ${r.name}${r.ok ? '' : '\n     ' + r.detail}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n合計 ${results.length} 件中 ${pass} 件通過・${fail} 件失敗（${LABEL}）`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ label: LABEL, root: ROOT, results }, null, 1));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(2); });
