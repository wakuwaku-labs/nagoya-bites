#!/usr/bin/env node
'use strict';
/**
 * scripts/refresh_feature_rosters.js
 *
 * シーン特集(features/*.html)の掲載店リストを『月次で自動入れ替え』する。
 * 方式は data/feature_rosters.json 参照:
 *   【ハイブリッド】実力上位の固定コア(coreCount 店)は毎月残し、
 *                   残り枠(slots-coreCount)を『その月に閲覧者の興味が湧く店』へ
 *                   月シードでローテーション入れ替え。
 *   【バランス型スコア】crossCheck / Google評価 / 口コミ数 / トレンド /
 *                       話題フラグ・編集部推薦・editorReason・シーン適合 の加重。
 *   【ハードゲート】実在(stores.json) / 営業中 / 非閉店 / 名古屋 / 写真 /
 *                   ホットペッパーID / Google評価下限 / シーン条件。
 *   【多様性補正】同エリア・同価格帯の偏りを greedy 選択時にペナルティ。
 *
 * 全掲載店は data/stores.json に実在する店のみ(架空店ブロック厳守・CLAUDE.md)。
 * 各特集の店カードコンテナ(store-list / shop-grid)の中身と JSON-LD ItemList を
 * 冪等に再生成する。手書きの記事本文・FAQ・見出しには一切触れない。
 *
 * 使い方:
 *   node scripts/refresh_feature_rosters.js               # 当月(JST)で全対象特集を更新
 *   node scripts/refresh_feature_rosters.js --month=YYYY-MM # 任意月でテスト
 *   node scripts/refresh_feature_rosters.js --only=banquet  # 1特集だけ
 *   node scripts/refresh_feature_rosters.js --dry-run       # 書き換えず選定結果を表示
 *   node scripts/refresh_feature_rosters.js --check         # プール健診のみ(枠割れで exit 1)
 *
 * 自動実行: .github/workflows/build.yml が毎月1日に実行し features/*.html を自動コミット。
 */
const fs = require('fs');
const path = require('path');
const { loadStores } = require('./lib/load_stores');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'data', 'feature_rosters.json');
const CLOSED = path.join(ROOT, 'data', 'closed_stores.json');
const FEATURES_DIR = path.join(ROOT, 'features');

// ───────── ユーティリティ ─────────
const norm = (s) => String(s || '').normalize('NFKC').replace(/\s|　/g, '').replace(/&amp;/g, '&').toLowerCase();
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function monthJST(override) {
  if (override) return override; // YYYY-MM
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 7);
}
// 月文字列(YYYY-MM)を安定した整数シードに（年をまたいでも毎月ずれる）
function monthSeed(ym) {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
}
// 価格帯文字列 "2001～3000円" → 下限の数値(2001)
function priceFloor(p) {
  const m = String(p || '').match(/(\d[\d,]*)/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
}
function toNum(v) { const n = Number(v); return isNaN(n) ? null : n; }

// ───────── 閉店セット ─────────
function loadClosedSet() {
  const set = { names: new Set(), hpids: new Set() };
  try {
    const raw = JSON.parse(fs.readFileSync(CLOSED, 'utf8'));
    for (const s of (raw.stores || [])) {
      if (s['店名']) set.names.add(norm(s['店名']));
      if (s['ホットペッパーID']) set.hpids.add(s['ホットペッパーID']);
    }
  } catch (e) { /* 無ければ空 */ }
  return set;
}

// ───────── 名古屋判定（アクセス/エリア/住所に名古屋固有語） ─────────
const NAGOYA_RE = /名古屋|愛知|栄|伏見|金山|大須|今池|藤が丘|覚王山|本山|八事|鶴舞|新栄|東桜|矢場町|上前津|千種|今池|池下|大曽根|神宮前|熱田|港区|中村区|中区|東区|西区|北区|南区|昭和区|瑞穂区|天白区|緑区|名東区|守山区|中川区/;
function isNagoya(s) {
  const hay = `${s['アクセス'] || ''} ${s['エリア'] || ''} ${s['住所'] || ''} ${s['市区町村'] || ''} ${s['都道府県'] || ''}`;
  return NAGOYA_RE.test(hay);
}

// ───────── シーンマッチ ─────────
function sceneHaystackKeyword(s) {
  return `${s['店名'] || ''} ${s['ジャンル'] || ''} ${s['タグ'] || ''} ${s['おすすめポイント'] || ''} ${s['editorReason'] || ''} ${s['insiderNote'] || ''}`;
}
function sceneHaystackArea(s) {
  return `${s['エリア'] || ''} ${s['アクセス'] || ''} ${s['住所'] || ''} ${s['市区町村'] || ''}`;
}
// scene 条件を満たすか（ハードゲート部分）と、シーン適合の強さ(0..1)を返す
function sceneMatch(s, scene) {
  const genreRe = scene.genre ? new RegExp(scene.genre) : null;
  const areaRe = scene.area ? new RegExp(scene.area) : null;
  const kwRe = scene.keyword ? new RegExp(scene.keyword, 'g') : null;

  if (genreRe && !genreRe.test(s['ジャンル'] || '')) return null;
  if (scene.gateArea && areaRe && !areaRe.test(sceneHaystackArea(s))) return null;
  if (scene.minPrice) { const pf = priceFloor(s['価格帯']); if (pf !== null && pf < scene.minPrice) return null; }

  const kwHay = sceneHaystackKeyword(s);
  const kwHits = kwRe ? (kwHay.match(kwRe) || []).length : 0;
  if (scene.gateKeyword && kwRe && kwHits === 0) return null;

  // シーン適合の強さ: キーワードヒット数を 0..1 に圧縮
  const fit = kwRe ? Math.min(1, kwHits / 3) : 0.4;
  return { fit };
}

// ───────── バランス型スコア ─────────
function balanceScore(s, fit, W) {
  const cc = toNum(s['crossCheckScore']);
  const g = toNum(s['Google評価']);
  const rv = toNum(s['口コミ数']);
  const tr = toNum(s['トレンドスコア']);

  const ccN = cc !== null ? Math.max(0, Math.min(1, (cc - 24) / (85 - 24))) : 0.4;
  const gN = g !== null ? Math.max(0, Math.min(1, g / 5)) : 0.6;
  const rvN = rv !== null ? Math.min(1, Math.log10(1 + rv) / Math.log10(1 + 2000)) : 0.3;
  const trN = tr !== null ? Math.max(0, Math.min(1, (tr - 15) / (100 - 15))) : 0.4;

  let score = ccN * W.crossCheck + gN * W.google + rvN * W.reviews + trN * W.trend + fit * W.sceneFitBonus;
  if (s['話題フラグ']) score += W.topicBonus;
  if (s['編集部推薦']) score += W.editorPickBonus;
  if (s['editorReason']) score += W.editorReasonBonus;
  return score;
}

// ───────── 候補プール生成 ─────────
function buildPool(stores, cfg, closed) {
  const G = cfg.gates, W = cfg.scoreWeights;
  return function (featCfg) {
    const pool = [];
    for (const s of stores) {
      const hp = s['ホットペッパーID'];
      if (G.requireHotpepper && !hp) continue;
      if (closed.hpids.has(hp) || closed.names.has(norm(s['店名']))) continue;
      if (G.requireOperational) {
        const st = s['営業ステータス'];
        if (st && st !== 'OPERATIONAL') continue;
      }
      if (G.requirePhoto && !s['写真URL']) continue;
      if (G.requireNagoya && !isNagoya(s)) continue;

      const sm = sceneMatch(s, featCfg.scene);
      if (!sm) continue;

      // Google評価下限（編集部推薦 / editorReason 付きは免除可）
      const g = toNum(s['Google評価']);
      const exempt = G.editorExemptGoogle && (s['編集部推薦'] || s['editorReason']);
      if (G.minGoogle && !exempt && (g === null || g < G.minGoogle)) continue;

      pool.push({ store: s, fit: sm.fit, score: balanceScore(s, sm.fit, W) });
    }
    pool.sort((a, b) => b.score - a.score);
    return pool;
  };
}

// ───────── ハイブリッド選定（固定コア＋月次ローテーション＋多様性補正） ─────────
// 多様性補正: 既選択に同エリア・同価格帯・同ジャンル大分類が増えるほど減点し、
// スコア上位でも1ジャンル/1エリアに偏らないようにする（記事としての見応えを担保）。
function selectRoster(pool, featCfg, seed, diversity) {
  const slots = featCfg.slots;
  const coreCount = Math.min(featCfg.coreCount, slots);
  const fixed = new Set((featCfg.fixed || []).map(String));
  const keyArea = p => p.store['エリア'] || '?';
  const keyPrice = p => String(priceFloor(p.store['価格帯']) || '?');
  const keyGenre = p => genreKey(p.store);

  const cnt = { area: {}, price: {}, genre: {} };
  const bump = (p) => { cnt.area[keyArea(p)] = (cnt.area[keyArea(p)] || 0) + 1; cnt.price[keyPrice(p)] = (cnt.price[keyPrice(p)] || 0) + 1; cnt.genre[keyGenre(p)] = (cnt.genre[keyGenre(p)] || 0) + 1; };
  const adjOf = (p) => p.score
    - (cnt.area[keyArea(p)] || 0) * diversity.areaPenalty
    - (cnt.price[keyPrice(p)] || 0) * diversity.pricePenalty
    - (cnt.genre[keyGenre(p)] || 0) * (diversity.genrePenalty || 0);

  // greedy 選択: 候補配列から多様性補正後スコア最大を1件取り出す
  const greedyPick = (candidates) => {
    let bestIdx = 0, best = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const a = adjOf(candidates[i]);
      if (a > best) { best = a; bestIdx = i; }
    }
    const chosen = candidates.splice(bestIdx, 1)[0];
    bump(chosen);
    return chosen;
  };

  const used = new Set();
  const byId = new Map(pool.map(p => [String(p.store['ホットペッパーID']), p]));

  // 1) 固定コア: fixed 指定(実在)を最優先 → 残りをスコア×多様性の greedy で coreCount まで。
  //    月シードに依存しないので「実力上位＋バランス」が毎月コアとして残る。
  const core = [];
  for (const id of fixed) {
    const p = byId.get(id);
    if (p && !used.has(id)) { core.push(p); used.add(id); bump(p); }
  }
  const corePool = pool.filter(p => !used.has(String(p.store['ホットペッパーID'])));
  while (core.length < coreCount && corePool.length) {
    const chosen = greedyPick(corePool);
    core.push(chosen); used.add(String(chosen.store['ホットペッパーID']));
  }

  // 2) ローテーション枠: コア以外の「実力上位候補」を月シードで回転し、
  //    回転順を尊重しつつ多様性の上限内で充填する。
  //    ※ 純 greedy(スコア最大)だと回転が打ち消され毎月同じ顔になるため、
  //      回転順を尊重して「多様性 OK の先着」を採る方式にしている。
  const rest = pool.filter(p => !used.has(String(p.store['ホットペッパーID'])));
  const rotateSlots = Math.max(0, slots - core.length);
  // 下位の低品質店がローテで紛れ込まないよう、実力上位に候補を絞ってから回転させる。
  const candN = Math.min(rest.length, Math.max(rotateSlots * 4, 24));
  const cand = rest.slice(0, candN); // rest はスコア降順
  const off = cand.length ? ((seed % cand.length) + cand.length) % cand.length : 0;
  const rotated = cand.slice(off).concat(cand.slice(0, off));
  const picked = [];
  const maxGenre = Math.max(2, Math.ceil(slots / 3)); // コア込みの同ジャンル上限
  const maxArea = Math.max(2, Math.ceil(slots / 2));   // コア込みの同エリア上限
  for (let pass = 0; pass < 3 && picked.length < rotateSlots; pass++) {
    const gLim = maxGenre + pass * 2, aLim = maxArea + pass * 2; // 埋まらなければ段階的に緩める
    for (const c of rotated) {
      if (picked.length >= rotateSlots) break;
      const id = String(c.store['ホットペッパーID']);
      if (used.has(id)) continue;
      if ((cnt.genre[keyGenre(c)] || 0) >= gLim) continue;
      if ((cnt.area[keyArea(c)] || 0) >= aLim) continue;
      picked.push(c); used.add(id); bump(c);
    }
  }
  // それでも枠が余れば回転順で無条件補充（枠割れ回避の最終手段）
  for (const c of rotated) {
    if (picked.length >= rotateSlots) break;
    const id = String(c.store['ホットペッパーID']);
    if (used.has(id)) continue;
    picked.push(c); used.add(id); bump(c);
  }

  // 3) コアを上位、ローテ枠を続けて最終順（各ブロック内はスコア順）
  core.sort((a, b) => b.score - a.score);
  picked.sort((a, b) => b.score - a.score);
  const coreIds = new Set(core.map(p => String(p.store['ホットペッパーID'])));
  return { list: [...core, ...picked], coreIds };
}

// ───────── カード生成 ─────────
function descOf(s, maxLen) {
  let d = (s['editorReason'] || s['insiderNote'] || s['おすすめポイント'] || '').trim();
  d = d.replace(/\s+/g, ' ');
  if (d.length > maxLen) d = d.slice(0, maxLen - 1) + '…';
  return esc(d);
}
function tagsOf(s, n) {
  return (s['タグ'] || '').split(/[,、]/).map(t => t.trim()).filter(Boolean).slice(0, n);
}
function genreShort(s) {
  return esc((s['ジャンル'] || '').split(/[・/／,、]/)[0].trim());
}
// 多様性補正用のジャンル大分類キー（表記ゆれを1カテゴリに畳む）
function genreKey(s) {
  const g = String(s['ジャンル'] || '');
  const map = [
    [/焼肉|ホルモン|ジンギスカン/, '焼肉'], [/寿司|鮨|すし/, '寿司'],
    [/うなぎ|鰻|ひつまぶし/, 'うなぎ'], [/ラーメン|つけ麺|まぜそば/, 'ラーメン'],
    [/イタリア|パスタ|ピッツァ|ピザ/, 'イタリアン'], [/フレンチ|フランス|ビストロ/, 'フレンチ'],
    [/中華|中国|四川|広東|台湾/, '中華'], [/韓国|サムギョプサル/, '韓国'],
    [/すき焼|しゃぶ/, 'すき焼き'], [/鉄板|ステーキ/, '鉄板・ステーキ'],
    [/割烹|懐石|会席|日本料理|和食/, '和食'], [/海鮮|魚|刺身|海産/, '海鮮'],
    [/バー|bar|ワイン|カクテル/i, 'バー'], [/カフェ|喫茶|珈琲|コーヒー/, 'カフェ'],
    [/居酒屋|ダイニング|バル|酒場/, '居酒屋'],
  ];
  for (const [re, key] of map) if (re.test(g)) return key;
  return genreShort(s) || 'その他';
}
function scoreBadge(s) {
  const g = toNum(s['Google評価']);
  return g !== null ? `★ ${g}` : '';
}

function renderStoreCard(entry, num) {
  const s = entry.store;
  const id = esc(s['ホットペッパーID']);
  const name = esc(s['店名']);
  const photo = esc(s['写真URL']);
  const area = esc(s['エリア'] || '');
  const genre = genreShort(s);
  const price = esc(s['価格帯'] || '');
  const sb = scoreBadge(s);
  const nn = String(num).padStart(2, '0');
  const isNew = entry.isNew ? '<span class="store-new">今月の新顔</span>' : '';
  const meta = [area && `<span>${area}</span>`, genre && `<span>${genre}</span>`, sb && `<span class="score">${sb}</span>`, price && `<span>${price}</span>`].filter(Boolean).join('');
  const tags = tagsOf(s, 3).map(t => `<span class="store-tag">${esc(t)}</span>`).join('');
  return `      <div class="store-card">
        <div class="store-num">${nn}</div>
        <div class="store-photo"><img src="${photo}" alt="${name}" loading="lazy" width="160" height="120" decoding="async"></div>
        <div class="store-info">
          <div class="store-name"><a href="https://nagoya-bites.com/stores/${id}.html">${name}</a>${isNew}</div>
          <div class="store-meta">${meta}</div>
          <p class="store-desc">${descOf(s, 110)}</p>
          <div class="store-tags">${tags}</div>
          <div class="store-actions">
            <a class="store-link store-link-internal" href="https://nagoya-bites.com/stores/${id}.html">詳細ページを見る →</a>
            <a class="store-link" href="https://www.hotpepper.jp/str${id}/" target="_blank" rel="noopener">予約はこちら →</a>
          </div>
        </div>
      </div>`;
}

function renderShopCard(entry, num) {
  const s = entry.store;
  const id = esc(s['ホットペッパーID']);
  const name = esc(s['店名']);
  const photo = esc(s['写真URL']);
  const area = esc(s['エリア'] || '');
  const genre = genreShort(s);
  const sb = scoreBadge(s);
  const nn = String(num).padStart(2, '0');
  const isNew = entry.isNew ? '<span class="shop-new">今月の新顔</span>' : '';
  const tagList = tagsOf(s, 2);
  if (sb) tagList.push(sb);
  const tags = tagList.map(t => `        <span class="tag">${esc(t)}</span>`).join('\n');
  return `    <div class="shop-card">
      <img class="shop-card-photo" src="${photo}" alt="${name}" loading="lazy" decoding="async">
      <div class="shop-num">${nn}</div>
      <div class="shop-name">${name}${isNew}</div>
      <div class="shop-area">${area}${genre ? ' / ' + genre : ''}</div>
      <p class="shop-desc">${descOf(s, 150)}</p>
      <div class="shop-tags">
${tags}
      </div>
          <a href="../stores/${id}.html" class="shop-detail-link">詳細ページを見る</a>
    </div>`;
}

// ───────── コンテナ中身の置換（div バランスで範囲特定・冪等） ─────────
function replaceContainerInner(html, containerClass, newInner) {
  const openRe = new RegExp(`<div class="${containerClass}">`);
  const m = openRe.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  const tagRe = /<div\b[^>]*>|<\/div>/g;
  tagRe.lastIndex = start;
  let depth = 1, t;
  while ((t = tagRe.exec(html))) {
    if (t[0].startsWith('</div')) depth--; else depth++;
    if (depth === 0) {
      const end = t.index;
      return html.slice(0, start) + '\n' + newInner + '\n    ' + html.slice(end);
    }
  }
  return null;
}

// ───────── 「今月の新顔」バッジ CSS を各特集に1回だけ注入（冪等） ─────────
const BADGE_CSS = '.store-new,.shop-new{display:inline-block;margin-left:.5rem;font-size:.6rem;font-weight:700;letter-spacing:.03em;color:#fff;background:#b08d2c;padding:.1rem .45rem;border-radius:3px;vertical-align:middle;white-space:nowrap;}';
function injectBadgeCss(html) {
  if (html.includes('ROSTER_BADGE_CSS')) return html;
  const i = html.indexOf('</style>');
  if (i < 0) return html;
  return html.slice(0, i) + `\n/*ROSTER_BADGE_CSS*/${BADGE_CSS}\n` + html.slice(i);
}

// ───────── JSON-LD ItemList の再生成 ─────────
function replaceItemList(html, list) {
  const re = /(\{"@context":"https:\/\/schema\.org","@type":"ItemList"[^]*?"itemListElement":)\[[^]*?\](\})/;
  if (!re.test(html)) return html;
  const items = list.map((e, i) => {
    const s = e.store;
    return `{"@type":"ListItem","position":${i + 1},"name":${JSON.stringify(s['店名'])},"url":"https://nagoya-bites.com/stores/${s['ホットペッパーID']}.html"}`;
  }).join(',');
  return html.replace(re, (full, head, tail) => {
    const withCount = head.replace(/"numberOfItems":\d+/, `"numberOfItems":${list.length}`);
    return `${withCount}[${items}]${tail}`;
  });
}

// ───────── メイン ─────────
function main() {
  const args = process.argv.slice(2);
  const monthArg = (args.find(a => a.startsWith('--month=')) || '').split('=')[1] || null;
  const only = (args.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;
  const dryRun = args.includes('--dry-run');
  const checkMode = args.includes('--check');

  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const stores = loadStores();
  const closed = loadClosedSet();
  const ym = monthJST(monthArg);
  const seed = monthSeed(ym);
  const poolFor = buildPool(stores, cfg, closed);

  const targets = Object.entries(cfg.features).filter(([slug]) => !only || slug === only);
  console.log(`[roster] 対象月: ${ym} / seed=${seed} / 対象特集: ${targets.length}件\n`);

  let shortfalls = 0, updated = 0;
  const MIN_RATIO = 1.3; // プールは slots の 1.3 倍以上欲しい（ローテーションの余地）

  for (const [slug, fc] of targets) {
    const file = path.join(FEATURES_DIR, `${slug}.html`);
    if (!fs.existsSync(file)) { console.error(`  ✗ ${slug}: features/${slug}.html が無い`); shortfalls++; continue; }

    const pool = poolFor(fc);
    if (pool.length < fc.slots) {
      console.error(`  ✗ ${slug}: プール ${pool.length} < slots ${fc.slots}（シーン条件が厳しすぎ・枠割れ）`);
      shortfalls++;
    } else if (pool.length < fc.slots * MIN_RATIO) {
      console.warn(`  △ ${slug}: プール ${pool.length}（slots ${fc.slots}・ローテーション余地が少なめ）`);
    }
    if (pool.length === 0) continue;

    const { list, coreIds } = selectRoster(pool, fc, seed, cfg.diversity);
    const final = list.slice(0, fc.slots);
    final.forEach(e => { e.isNew = !coreIds.has(String(e.store['ホットペッパーID'])); });

    if (dryRun || checkMode) {
      if (dryRun) {
        console.log(`■ ${slug}  [${fc.format}] プール${pool.length} → ${final.length}店 (コア${coreIds.size}/ローテ${final.length - final.filter(e => coreIds.has(String(e.store['ホットペッパーID']))).length})`);
        final.forEach((e, i) => {
          const s = e.store;
          console.log(`   ${String(i + 1).padStart(2)}. ${e.isNew ? '🆕' : '  '} ${(s['店名'] || '').slice(0, 22).padEnd(22)} ${s['エリア'] || ''} / ${genreShort(s)} ★${s['Google評価'] || '-'} 口${s['口コミ数'] || '-'} cc${s['crossCheckScore'] || '-'} score=${e.score.toFixed(3)}`);
        });
        console.log('');
      }
      continue;
    }

    // HTML 書き換え
    let html = fs.readFileSync(file, 'utf8');
    const inner = final.map((e, i) => fc.format === 'shop-card' ? renderShopCard(e, i + 1) : renderStoreCard(e, i + 1)).join('\n\n');
    const replaced = replaceContainerInner(html, fc.container, inner);
    if (!replaced) { console.error(`  ✗ ${slug}: コンテナ .${fc.container} が特定できず未更新`); shortfalls++; continue; }
    html = replaceItemList(replaced, final);
    html = injectBadgeCss(html);
    fs.writeFileSync(file, html);
    console.log(`  ✓ ${slug}: ${final.length}店に更新（コア${final.filter(e => coreIds.has(String(e.store['ホットペッパーID']))).length}/新顔${final.filter(e => e.isNew).length}）`);
    updated++;
  }

  console.log(`\n[roster] 更新 ${updated}件 / 枠割れ・失敗 ${shortfalls}件`);
  if (checkMode && shortfalls > 0) { console.error('[roster] --check: 枠割れありのため exit 1'); process.exit(1); }
  if (checkMode) console.log('[roster] --check: 全対象でプール充足 ✓');
}

if (require.main === module) main();

module.exports = { sceneMatch, balanceScore, buildPool, selectRoster, replaceContainerInner, replaceItemList, monthSeed };
