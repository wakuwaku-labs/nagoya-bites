#!/usr/bin/env node
'use strict';
/**
 * ジャーナルの本文写真（ヒーロー以外の記事内写真）— 収集・選定・配置の唯一の情報源
 *
 * 【なぜ存在するか】
 *   記事の写真がヒーロー1枚だけで、本文は最後まで文字が続いていた。読者の目が休まらず、
 *   店の様子も1枚でしか伝わらない。そこで本文の途中にも写真を挿す。
 *   ただし増やすのは「枚数」であって「基準」ではない。本文写真もヒーローと同じ規律を通す:
 *     - その記事が扱う店の写真であること（他店の写真を借りない・2026-08-17 の事故）
 *     - 出所を書けない写真は載せない
 *     - 候補が足りない日は増やさない（取り繕わない）
 *
 * 【判定は検証できる事実だけで行う（CLAUDE.md 制約10）】
 *   採否の判定はこのファイルでは一切増やしていない。
 *     - Places 写真の採否 … scripts/lib/photo_policy.js（クレジット名＝店名のオーナー投稿）
 *     - 記事との帰属      … scripts/lib/hero_photo_gate.js（judgePhoto）
 *   ここが持つのは「どの店から候補を集めるか」「どこに挿すか」だけ。
 *
 * この1本を通る経路:
 *   scripts/generate_daily_draft.js      … 日次生成（記事を作るときに挿す）
 *   scripts/add_journal_body_photos.js   … 既存記事への後追い（公開済みに挿す）
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const { pickPhotos, attributionName } = require('./photo_policy');
const { loadPolicy, judgePhoto, namesMatch } = require('./hero_photo_gate');
const { loadStores } = require('./load_stores');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function bodyPolicy() {
  const p = loadPolicy().bodyPhotos || {};
  return {
    enabled: p.enabled !== false,
    targetTotal: p.targetTotal || 3,
    maxTotal: p.maxTotal || p.targetTotal || 3,
    placesCandidatesPerStore: p.placesCandidatesPerStore || 6,
    maxPerStore: p.maxPerStore || 2,
    minSectionIndex: p.minSectionIndex == null ? 1 : p.minSectionIndex,
    minParagraphGap: p.minParagraphGap == null ? 2 : p.minParagraphGap,
    skuBudget: p.skuBudget || { details: 1000, photo: 300, textsearch: 300 },
  };
}

/* ────────────────────────────────────────────────────────────────
 * 店舗レコードの解決（写真URL・placeId の出どころ）
 * ──────────────────────────────────────────────────────────────── */
let _idx = null;
function storeIndex() {
  if (_idx) return _idx;
  const byId = new Map();
  const list = [];
  const push = (rec) => {
    if (!rec || !rec['店名']) return;
    list.push(rec);
    const id = rec['ホットペッパーID'];
    if (id && !byId.has(id)) byId.set(id, rec);
  };
  try { for (const s of loadStores()) push(s); } catch (_) { /* 読めない環境では候補ゼロ＝写真を増やさないだけ */ }
  for (const f of ['manual_stores.json', 'pending_stores.json']) {
    const p = path.join(ROOT, 'data', f);
    if (!fs.existsSync(p)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const s of (j.stores || j.pending || (Array.isArray(j) ? j : []))) push(s);
    } catch (_) { /* 壊れたJSONで生成ごと落とさない */ }
  }
  _idx = { byId, list };
  return _idx;
}

/** 記事の店（name / id）に対応するデータ側のレコードを引く（無ければ null） */
function findStoreRecord(store) {
  const { byId, list } = storeIndex();
  if (store.id && byId.has(store.id)) return byId.get(store.id);
  const name = String(store.name || '').trim();
  if (!name) return null;
  const exact = list.find(r => String(r['店名']).trim() === name);
  if (exact) return exact;
  const th = loadPolicy().attribution.matchThreshold;
  return list.find(r => namesMatch(r['店名'], name, th)) || null;
}

/* ────────────────────────────────────────────────────────────────
 * Places の消費量を数える（請求は SKU 別の無料枠で決まる）
 *
 * 店舗写真の取得（scripts/fetch_manual_store_photos.js）は既に
 * data/photo_pipeline_health.json に SKU 別・月次の消費を積算して無料枠の内側に留まっている。
 * 本文写真も同じプロジェクトの同じ SKU を使うので、同じ台帳に積む。
 * 積まないと、店舗写真側の自制が実際の消費より少ない数字を見ることになり、
 * 「枠の内側にいるつもりで超える」状態を作ってしまう（CLAUDE.md 制約10 の趣旨）。
 * ──────────────────────────────────────────────────────────────── */
const HEALTH_PATH = path.join(ROOT, 'data', 'photo_pipeline_health.json');
const SKU_ZERO = { textsearch: 0, details: 0, photo: 0 };

/** 無料枠のリセット境界は太平洋時間（JST 16:00） */
function ptMonth() {
  return new Date(Date.now() - 8 * 3600 * 1000).toISOString().slice(0, 7);
}

let _skuUsed = { ...SKU_ZERO };   // この実行での消費
let _skuLedger = null;            // 台帳から読んだ今月の消費

function readLedger() {
  if (_skuLedger) return _skuLedger;
  let root = {};
  try { root = JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf8')); } catch (_) { root = {}; }
  const places = root.places || {};
  const journal = root.journal_photos || {};
  const month = ptMonth();
  _skuLedger = {
    month,
    shared: places.sku_month === month ? { ...SKU_ZERO, ...(places.sku_calls_month || {}) } : { ...SKU_ZERO },
    sharedBudget: places.sku_monthly_budget || { textsearch: 4000, details: 4000, photo: 800 },
    mine: journal.sku_month === month ? { ...SKU_ZERO, ...(journal.sku_calls_month || {}) } : { ...SKU_ZERO },
  };
  return _skuLedger;
}

/** その SKU をこれ以上叩いてよいか（本文写真の取り分と、共有の無料枠の両方を見る） */
function skuAllow(kind) {
  const led = readLedger();
  const mineCap = bodyPolicy().skuBudget[kind];
  if (mineCap != null && led.mine[kind] + _skuUsed[kind] >= mineCap) {
    _placesError = { status: 'SKU_BUDGET', message: `本文写真の今月の ${kind} 枠（${mineCap}件）を使い切りました` };
    return false;
  }
  const sharedCap = led.sharedBudget[kind];
  if (sharedCap != null && led.shared[kind] + _skuUsed[kind] >= sharedCap) {
    _placesError = { status: 'SKU_BUDGET', message: `Places の今月の共有枠（${kind} ${sharedCap}件）を使い切りました` };
    return false;
  }
  return true;
}

function noteSku(kind) { _skuUsed[kind]++; }

/**
 * この実行で使った分を台帳へ書き戻す（呼び出し側が終了時に1回呼ぶ）。
 * places.sku_calls_month に足すことで、店舗写真側の自制がこの消費を見るようになる。
 */
function flushSkuUsage() {
  const total = _skuUsed.textsearch + _skuUsed.details + _skuUsed.photo;
  if (!total) return null;
  let root = {};
  try { root = JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf8')); } catch (_) { root = {}; }
  const led = readLedger();
  const month = led.month;
  const places = root.places || {};
  const sharedNow = places.sku_month === month ? { ...SKU_ZERO, ...(places.sku_calls_month || {}) } : { ...SKU_ZERO };
  root.places = {
    ...places,
    sku_month: month,
    sku_calls_month: {
      textsearch: sharedNow.textsearch + _skuUsed.textsearch,
      details: sharedNow.details + _skuUsed.details,
      photo: sharedNow.photo + _skuUsed.photo,
    },
  };
  root.journal_photos = {
    sku_month: month,
    sku_calls_month: {
      textsearch: led.mine.textsearch + _skuUsed.textsearch,
      details: led.mine.details + _skuUsed.details,
      photo: led.mine.photo + _skuUsed.photo,
    },
    sku_monthly_budget: bodyPolicy().skuBudget,
    last_run: new Date().toISOString(),
  };
  fs.writeFileSync(HEALTH_PATH, JSON.stringify(root, null, 2) + '\n', 'utf8');
  const used = { ..._skuUsed };
  _skuUsed = { ...SKU_ZERO };
  _skuLedger = null;
  return used;
}

/* ────────────────────────────────────────────────────────────────
 * HTTP（依存を足さない・制約4）
 * ──────────────────────────────────────────────────────────────── */
/**
 * Places API が「使えなかった」ことを、候補ゼロと同じ顔にしない。
 *
 * 2026-09-20、日次クォータを使い切った状態で本文写真を集めたところ、
 * 全店が「候補なし」と表示された。写真が無い店と、写真を取りに行けなかった店が
 * 区別できないと、後から見て何が起きたのか分からない（CLAUDE.md 制約10・原則3）。
 */
let _placesError = null;
function placesError() { return _placesError; }
function resetPlacesError() { _placesError = null; }
function notePlacesStatus(json) {
  const st = json && json.status;
  if (!st || st === 'OK' || st === 'ZERO_RESULTS') return true;
  _placesError = { status: st, message: (json && json.error_message) || '' };
  return false;
}

function getJson(url) {
  return new Promise((resolve) => {
    let body = '';
    const req = https.get(url, { timeout: 8000 }, (res) => {
      res.on('data', d => { body += d; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/** Places photo API は CDN へ 302 で返す（APIキーをHTMLに埋め込まないため実URLを取る） */
function resolveCdnUrl(photoApiUrl) {
  return new Promise((resolve) => {
    const req = https.get(photoApiUrl, { timeout: 8000 }, (res) => {
      res.resume();
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) resolve(res.headers.location);
      else resolve(null);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * HotPepper 写真URL（_480.jpg）をフルサイズへ上げて疎通確認する。
 * 取れなければ元のURLへフォールバック、それも駄目なら null（＝この候補は使わない）。
 */
function probeHotpepperPhoto(photoUrl) {
  if (!photoUrl) return Promise.resolve(null);
  const full = String(photoUrl).replace(/_\d+\.jpg$/, '.jpg');
  const target = full !== photoUrl ? full : photoUrl;
  return new Promise((resolve) => {
    const req = https.get(target, { timeout: 6000 }, (res) => {
      res.resume();
      if (res.statusCode === 200) resolve(target);
      else if (target !== photoUrl) resolve(photoUrl);
      else resolve(null);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/* ────────────────────────────────────────────────────────────────
 * 候補集め — 記事が扱う店からだけ集める
 * ──────────────────────────────────────────────────────────────── */

/**
 * 1店ぶんの写真候補を集める。
 * @param {{name:string,id?:string,area?:string,photo_url?:string}} store 記事側の店
 * @param {{places?:boolean, limit?:number}} opts
 * @returns {Promise<Array<{url,source,storeName,creditName,creditUrl,tier}>>}
 */
async function collectStoreCandidates(store, opts = {}) {
  const pol = bodyPolicy();
  const out = [];
  const name = String(store.name || '').trim();
  if (!name) return out;
  const rec = findStoreRecord(store);
  const area = String(store.area || (rec && rec['エリア']) || '').split('/')[0].trim();

  // 1. HotPepper 公式写真（URL から所有店をデータで逆引きできる＝第三者が検算できる）
  const hpUrl = store.photo_url || (rec && rec['写真URL']) || '';
  if (hpUrl && /imgfp\.hotp\.jp/.test(hpUrl)) {
    const resolved = await probeHotpepperPhoto(hpUrl);
    if (resolved) {
      out.push({
        url: resolved, source: 'hotpepper', storeName: name, area,
        creditName: '店舗公式写真', creditUrl: 'https://www.hotpepper.jp', tier: 'owner',
      });
    }
  }

  // 2. Google Places（オーナー投稿を優先。判定は data/photo_policy.json が持つ）
  const key = process.env.GOOGLE_MAPS_API_KEY;
  // 一度クォータ切れ・認証エラーを踏んだら、その実行では叩き続けない（無駄打ちを増やさない）
  if (key && opts.places !== false && !_placesError) {
    let placeId = (rec && (rec['placeId'] || rec['GooglePlaceID'])) || '';
    if (!placeId) {
      if (!skuAllow('textsearch')) return out;
      noteSku('textsearch');
      const q = encodeURIComponent(`${name} ${store.area || rec?.['エリア'] || ''} 名古屋`);
      const find = await getJson(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${q}&inputtype=textquery&fields=place_id&key=${key}`
      );
      if (!notePlacesStatus(find)) return out;
      placeId = find?.candidates?.[0]?.place_id || '';
    }
    if (placeId) {
      if (!skuAllow('details')) return out;
      noteSku('details');
      const detail = await getJson(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos,name&language=ja&key=${key}`
      );
      if (!notePlacesStatus(detail)) return out;
      const photos = (detail?.result?.photos || []).slice(0, pol.placesCandidatesPerStore);
      const cands = photos.map(ph => ({ photo: ph, attribution: attributionName(ph) || 'Google Maps' }));
      const { picked } = pickPhotos(cands, { '店名': name }, opts.limit || pol.maxPerStore + 1);
      const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
      for (const p of picked) {
        if (!skuAllow('photo')) break;
        noteSku('photo');
        const cdn = await resolveCdnUrl(
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${p.photo.photo_reference}&key=${key}`
        );
        if (!cdn) continue;
        out.push({
          url: cdn, source: 'places', storeName: name, area,
          creditName: p.attribution || 'Google Maps', creditUrl: mapsUrl, tier: p.tier,
        });
      }
    }
  }

  return out;
}

/**
 * 記事ぜんたいの本文写真を選ぶ。
 * 店を先に一巡させる（複数店の記事で同じ店の写真だけが並ばないように）。
 *
 * @param {Array} stores      記事が扱う店 [{name,id,area,photo_url}]
 * @param {{excludeUrls?:string[], need?:number}} opts need = 追加したい枚数
 */
async function collectBodyPhotos(stores, opts = {}) {
  const pol = bodyPolicy();
  if (!pol.enabled) return [];
  const need = Math.max(0, opts.need == null ? pol.targetTotal - 1 : opts.need);
  if (!need) return [];

  const exclude = new Set((opts.excludeUrls || []).filter(Boolean));
  const perStore = [];
  for (const s of (stores || [])) {
    if (!s || !s.name) continue;
    const cands = (await collectStoreCandidates(s, opts))
      .filter(c => !exclude.has(c.url));
    // 同一URLの重複を店内で落とす
    const seen = new Set();
    perStore.push(cands.filter(c => (seen.has(c.url) ? false : (seen.add(c.url), true))));
  }

  // 店をラウンドロビン（1巡目: 各店1枚 → 2巡目: 各店2枚目…）
  const picked = [];
  const used = new Set(exclude);
  for (let round = 0; round < pol.maxPerStore && picked.length < need; round++) {
    for (const cands of perStore) {
      if (picked.length >= need) break;
      const c = cands.find(x => !used.has(x.url));
      if (!c) continue;
      used.add(c.url);
      picked.push(c);
    }
  }
  return picked;
}

/* ────────────────────────────────────────────────────────────────
 * クレジット表記 — ヒーローと同じ語彙（出所を書けない写真は載せない）
 * ──────────────────────────────────────────────────────────────── */
function classifyUrl(url) {
  const u = String(url || '');
  if (/imgfp\.hotp\.jp/.test(u)) return 'hotpepper';
  if (/prcdn\.freetls\.fastly\.net|prtimes\.jp\/i\//.test(u)) return 'press';
  if (/lh\d\.googleusercontent\.com|googleusercontent\.com/.test(u)) return 'places';
  if (/\/assets\/journal-figures\//.test(u)) return 'figure';
  if (/\/assets\/journal-photos\//.test(u)) return 'self-hosted';
  return 'unknown';
}

/** 出所が確定できないときは null を返す（呼び出し側はその写真を使わない） */
function creditHtml(photo) {
  const link = (url, text) => (url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`
    : esc(text));
  const source = photo.source || classifyUrl(photo.url);
  if (source === 'hotpepper') {
    return `${link(photo.creditUrl || 'https://www.hotpepper.jp', photo.creditName || '店舗公式写真')} / ${link('https://www.hotpepper.jp', 'HotPepper')}`;
  }
  if (source === 'places') {
    return `${link(photo.creditUrl, photo.creditName || '店舗写真')} / ${link('https://maps.google.com', 'Google Maps')}`;
  }
  if (source === 'press') {
    const url = photo.releaseUrl || photo.creditUrl || '';
    return `提供 ${esc(photo.creditName || '発行企業')}（${link(url, 'プレスリリース')}より）`;
  }
  if (source === 'figure' || source === 'self-hosted') return '編集部作成のイメージ図';
  return null;
}

/**
 * 本文写真1枚の figure HTML。
 * ヒーローと同じく、帰属の証跡（どの店の写真か・どこから来たか）を成果物自身に刻む。
 * ヒーローの figure とはクラスも属性名も分ける（監査で役割を取り違えないため）。
 */
function figureHtml(photo) {
  const credit = creditHtml(photo);
  if (!credit) return null;
  const store = photo.storeName || '';
  const alt = photo.alt
    || (store ? `${store}${photo.area ? `（${photo.area}）` : ''}の店舗写真` : '店舗写真');
  const source = photo.source || classifyUrl(photo.url);
  // 複数店を扱う記事では「どの店の写真か」をキャプションに出す。
  // ただしクレジット名がすでに店名（＝オーナー投稿の Places 写真）なら店名が二度並ぶので出さない。
  const th = loadPolicy().attribution.matchThreshold;
  const creditNamesStore = store && photo.creditName && namesMatch(store, photo.creditName, th);
  const label = (store && !creditNamesStore) ? `${esc(store)} — ` : '';
  return `<figure class="art-body-img" data-photo-source="${esc(source)}"${store ? ` data-photo-store="${esc(store)}"` : ''}>
  <img src="${esc(photo.url)}" alt="${esc(alt)}" loading="lazy" decoding="async">
  <figcaption class="art-img-credit">Photo: ${label}${credit}</figcaption>
</figure>`;
}

/* ────────────────────────────────────────────────────────────────
 * 配置 — 本文の見出し（h2）の手前に散らす
 * ──────────────────────────────────────────────────────────────── */

/**
 * 挿入位置（文字オフセット）を決める。
 * 第一候補は h2 の直前。h2 が足りない記事は段落（</p> の直後）の切れ目に落とす。
 * ヒーロー直下に続けて写真が出ないよう、最初の見出し／最初の数段落は避ける。
 */
function planAnchors(bodyHtml, count) {
  const pol = bodyPolicy();
  if (count <= 0) return [];
  const html = String(bodyHtml || '');

  // すでに入っている本文写真の位置。新しい写真をその隣に並べないため、
  // 判定用の「置いた場所」として先に入れておく（返す前に取り除く）。
  const existing = Array.from(html.matchAll(/<figure class="art-body-img"/g)).map(m => m.index);
  const anchors = existing.slice();
  // 写真と写真の間に本文が無い（＝2枚が続けて並ぶ）配置を避ける。
  // 文字数で見ると段落の長さに左右されるので、間に本文ブロックがあるかどうかで見る。
  const near = (pos) => anchors.some(a => !/<(p|h2|h3)[\s>]/.test(html.slice(Math.min(a, pos), Math.max(a, pos))));

  // 本文の直下（＝どのブロックの中でもない位置）だけを候補にする。
  // 段落の切れ目は CTA ブロックや Tips ボックスの内側にも存在するので、
  // これを見ないと写真が箱の中に入り込む（2026-09-20 実測で1本発生）。
  const depthAt = (pos) => {
    const before = html.slice(0, pos);
    const open = (before.match(/<(div|figure|blockquote|ul|ol)\b/g) || []).length;
    const close = (before.match(/<\/(div|figure|blockquote|ul|ol)>/g) || []).length;
    return open - close;
  };
  const topLevel = (pos) => depthAt(pos) === 0;

  // 記事全体へ均等に散らすための取り方（前に寄せない・最後に固めない）
  const spread = (arr, n) => {
    const step = arr.length / n;
    const out = [];
    for (let i = 0; i < n; i++) out.push(arr[Math.min(arr.length - 1, Math.floor((i + 0.5) * step))]);
    return out;
  };
  const take = (candidates, n) => {
    for (const pos of spread(candidates, Math.min(n, candidates.length))) {
      if (pos != null && !near(pos)) anchors.push(pos);
    }
  };

  // 第一候補: 見出し（h2）の直前。最初の見出しの手前はヒーロー直下なので使わない。
  const h2 = Array.from(html.matchAll(/<h2[\s>]/g)).map(m => m.index).filter(topLevel);
  take(h2.slice(pol.minSectionIndex), count);

  // 見出しが足りない記事（h2 を使わない回がある）は段落の切れ目で補う。
  // 先頭段落の直後（サイト紹介文の直下）と末尾段落の直後は避ける。
  const remaining = count - (anchors.length - existing.length);
  if (remaining > 0) {
    const paraEnds = Array.from(html.matchAll(/<\/p>/g)).map(m => m.index + '</p>'.length).filter(topLevel);
    take(paraEnds.slice(1, Math.max(1, paraEnds.length - 1)), remaining);
  }

  const seeded = new Set(existing);
  return Array.from(new Set(anchors)).filter(a => !seeded.has(a)).sort((a, b) => a - b).slice(0, count);
}

/** figure 群を本文HTMLへ挿す（挿せた枚数ぶんだけ返す） */
function insertIntoBody(bodyHtml, figures) {
  const figs = figures.filter(Boolean);
  if (!figs.length) return { html: bodyHtml, inserted: 0 };
  const anchors = planAnchors(bodyHtml, figs.length);
  if (!anchors.length) return { html: bodyHtml, inserted: 0 };

  let out = '';
  let prev = 0;
  let n = 0;
  anchors.forEach((pos, i) => {
    out += bodyHtml.slice(prev, pos) + figs[i] + '\n\n';
    prev = pos;
    n++;
  });
  out += bodyHtml.slice(prev);
  return { html: out, inserted: n };
}

/* ────────────────────────────────────────────────────────────────
 * 帰属チェック — ヒーローと同じ判定器（scripts/lib/hero_photo_gate.js）を通す
 * ──────────────────────────────────────────────────────────────── */
function judgeBodyPhoto(photo, article) {
  return judgePhoto({
    role: 'body',
    slug: article.slug,
    date: article.date,
    heroUrl: photo.url,
    heroSource: photo.source || classifyUrl(photo.url),
    heroStore: photo.storeName || '',
    caption: '',
    storeNames: article.storeNames || [],
    html: article.html || '',
  });
}

module.exports = {
  bodyPolicy,
  flushSkuUsage,
  placesError,
  resetPlacesError,
  findStoreRecord,
  probeHotpepperPhoto,
  collectStoreCandidates,
  collectBodyPhotos,
  creditHtml,
  classifyUrl,
  figureHtml,
  planAnchors,
  insertIntoBody,
  judgeBodyPhoto,
};
