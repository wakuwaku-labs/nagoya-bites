'use strict';
/**
 * scripts/build_featured.js
 *
 * data/featured.json を読み、JST 当日が season 期間内の特集と
 * evergreen 特集を priority 順にマージして、index.html 内の
 * 特集ストリップ (FEATURED_START/END マーカー間) を自動再生成する。
 *
 * 同時に features/index.html の季節特集ブロック
 * (FEATURED_SEASONAL_START/END マーカー間) も再生成して、
 * 期間外の季節特集が一覧から自動的に消えるようにする。
 *
 * 鮮度保証(常に最新感を保つ仕組み):
 *   1. monthlyScenes: 毎月「その月の飲食店探し需要シーン」(新年会/送別会/土用の丑/忘年会予約など)を
 *      複数本ストリップ先頭に立て、見出し(FEATURED_LABEL)も「M月の特集 — シーン一覧」に自動更新
 *      （年に依存せず空にならない。旧 monthlyFeature 形式にもフォールバック対応）
 *   2. season.recurring: MM-DD で毎年判定し、期限切れで自動消滅・翌年自動復活
 *   3. showcase: 固定(showcasePinned)＋プールを ISO週で回転し毎週少しずつ入れ替え
 *   4. validateConfig: カレンダーの穴・壊れた参照を検出（--check で exit 1）
 *
 * 使い方:
 *   node scripts/build_featured.js              # 通常実行
 *   node scripts/build_featured.js --date=YYYY-MM-DD  # 任意日付でテスト
 *   node scripts/build_featured.js --check      # 鮮度ガードのみ（書き換えなし・穴があれば exit 1）
 *
 * 自動実行:
 *   .github/workflows/build.yml が毎日 3:00 JST（＋push毎）に実行し index.html を自動コミット。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'data', 'featured.json');
const INDEX_HTML = path.join(ROOT, 'index.html');
const FEATURES_INDEX = path.join(ROOT, 'features', 'index.html');

// ───────── 当日(JST) を取得 ─────────
function todayJST(override) {
  if (override) return override;
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 10);
}

function isActive(item, today) {
  if (!item.season) return true; // evergreen
  const { start, end, recurring } = item.season;
  if (!start || !end) return true;
  if (recurring) {
    // 年に依存せず MM-DD で毎年判定（期限切れで自動消滅・翌年自動復活）
    const md = today.slice(5), s = start.slice(5), e = end.slice(5);
    return s <= e ? (md >= s && md <= e) : (md >= s || md <= e); // 年跨ぎ対応
  }
  return today >= start && today <= end;
}

// 月(1-12) と ISO週番号（ショーケースの週替わりローテーション用）
function monthOf(today) { return parseInt(today.slice(5, 7), 10); }
function isoWeek(today) {
  const d = new Date(today + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
}

// ───────── ストリップ HTML 生成 (index.html 用) ─────────
function renderStripCard(item, idx) {
  const eager = idx < 3;
  const loading = eager ? 'eager' : 'lazy';
  const fp = eager ? ' fetchpriority="high"' : '';
  const badge = item.season && item.season.badge
    ? `\n      <span class="feature-card-season">${item.season.badge}</span>`
    : '';
  const w = item.thumbW || 900;
  const h = item.thumbH || 600;
  const t600 = item.thumb600 || item.thumb; // HotPepper 等 600w 版が無い場合は同一URLにフォールバック
  return `    <a class="feature-card" href="${item.href}">${badge}
      <img class="feature-card-thumb" src="${item.thumb}" srcset="${t600} 600w, ${item.thumb} 900w" sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw" alt="${item.alt}" width="${w}" height="${h}" loading="${loading}" decoding="async"${fp}>
      <div class="feature-card-body">
        <div class="feature-card-title">${item.title}</div>
        <div class="feature-card-sub">${item.sub}</div>
        <span class="feature-card-cta">特集を読む</span>
      </div>
      <div class="feature-card-arrow">→</div>
    </a>`;
}

// ───────── ジャンル特集ショーケース HTML 生成 (index.html 用) ─────────
// 画像・タイトルは features/index.html の article-card から取得し二重管理を避ける。
function parseFeatureCards(featSrc) {
  const map = {};
  const re = /<a class="article-card[^"]*" href="([^"]+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(featSrc))) {
    const slug = m[1];
    const body = m[2];
    const img = (body.match(/<img class="card-img" src="([^"]+)"/) || [])[1];
    const title = (body.match(/<div class="card-title">([\s\S]*?)<\/div>/) || [])[1];
    if (img) map[slug] = { img, title: (title || '').trim() };
  }
  return map;
}
function renderShowcaseCard(entry, info) {
  const title = (entry.title || info.title || '').trim();
  const sub = entry.sub || '';
  const alt = entry.alt || title;
  // 画像は features/index.html 由来の絶対URL(HotPepper等)を想定。HotPepper 写真は写真ルール優先2で許可。
  return `    <a class="feature-card" href="features/${entry.slug}.html">
      <img class="feature-card-thumb" src="${info.img}" srcset="${info.img} 480w, ${info.img} 900w" sizes="(max-width: 640px) 50vw, (max-width: 900px) 33vw, 25vw" alt="${alt}" width="480" height="600" loading="lazy" decoding="async">
      <div class="feature-card-body">
        <div class="feature-card-title">${title}</div>
        <div class="feature-card-sub">${sub}</div>
        <span class="feature-card-cta">特集を読む</span>
      </div>
      <div class="feature-card-arrow">→</div>
    </a>`;
}

// ───────── 季節特集グリッド HTML 生成 (features/index.html 用) ─────────
// 注: card-icon は CSS で display:none（非表示）。絵文字は AI 生成感を出すため全廃
//     （ISSUE-069 全ページ絵文字撤去方針）。空文字を返しても見た目は不変。
function seasonalIcon(_id) {
  return '';
}
function seasonalCategory(id) {
  if (id === 'gw-2026' || id.startsWith('gw-')) return 'Seasonal · GW特集';
  if (id === 'mothers-day') return 'Seasonal · 母の日';
  if (id === 'fathers-day' || id.startsWith('fathers-day')) return 'Seasonal · 父の日';
  if (id === 'spring-terrace') return 'Seasonal · 春テラス';
  return 'Seasonal · 季節特集';
}
function renderSeasonalCard(item) {
  const icon = seasonalIcon(item.id);
  const category = seasonalCategory(item.id);
  const flag = item.season && item.season.badge
    ? item.season.badge
    : '季節限定';
  // 件数は元の article-card にあった文言を踏襲できないので汎用化
  const desc = item.seasonDesc || item.sub || '';
  const count = item.count || '';
  return `  <a class="article-card is-season" href="${item.id}.html">
    <div class="card-badge">
      <span class="season-flag">${flag}</span>
      <div class="card-icon">${icon}</div>
      <div class="card-category">${category}</div>
    </div>
    <div class="card-body">
      <div class="card-title">${item.title.replace(/^GW 2026・/, '').replace(/おすすめ/, 'おすすめ')}</div>
      <p class="card-desc">${desc}</p>
      <div class="card-meta">
        <span class="card-count">${count}</span>
        <span class="card-cta">読む →</span>
      </div>
    </div>
  </a>`;
}

// ───────── マーカー置換 ─────────
function replaceBetween(src, startMark, endMark, newInner) {
  const re = new RegExp(`${startMark}[\\s\\S]*?${endMark}`);
  if (!re.test(src)) {
    throw new Error(`マーカーが見つかりません: ${startMark}`);
  }
  return src.replace(re, `${startMark}\n${newInner}\n${endMark}`);
}
// 改行を挟まないインライン版（見出しテキストなど1行内のマーカー用）
function replaceBetweenInline(src, startMark, endMark, newInner) {
  const re = new RegExp(`${startMark}[\\s\\S]*?${endMark}`);
  if (!re.test(src)) {
    throw new Error(`マーカーが見つかりません: ${startMark}`);
  }
  return src.replace(re, `${startMark}${newInner}${endMark}`);
}

// ───────── 鮮度保証: 今月の旬リード & ショーケース回転 ─────────
// monthlyFeature の画像/サイズを items の thumb か features/index.html から解決する。
function resolveThumb(slug, itemsById, featMap) {
  const it = itemsById[slug];
  if (it && it.thumb) return { thumb: it.thumb, thumb600: it.thumb600 || null, w: it.thumbW || 480, h: it.thumbH || 600 };
  const info = featMap[slug];
  if (info && info.img) return { thumb: info.img.replace(/^\.\.\//, ''), thumb600: null, w: 480, h: 600 };
  return null;
}
// その月の需要シーン設定を取得する。
// 新形式 monthlyScenes[m] = { note, scenes: [{slug,title,sub,badge,thumb?}, ...] } を優先し、
// 無ければ旧形式 monthlyFeature[m]（単一エントリ）を scenes 1件として扱う。
function monthScenesOf(cfg, month) {
  const key = String(month);
  const ms = cfg.monthlyScenes && cfg.monthlyScenes[key];
  if (ms && Array.isArray(ms.scenes) && ms.scenes.length) return ms;
  const mf = cfg.monthlyFeature && cfg.monthlyFeature[key];
  if (mf) return { note: mf.sub || '', scenes: [mf] };
  return null;
}
// シーン1件をストリップ用の合成アイテムにする（毎月必ず最新感を担保）。
function buildSceneItem(scene, itemsById, featMap) {
  let t = null;
  if (scene.thumb) {
    // scene 単位の画像上書き（features/index.html にカードが無いページ用の逃げ道）
    t = { thumb: scene.thumb, thumb600: scene.thumb600 || null, w: scene.thumbW || 480, h: scene.thumbH || 600 };
  } else {
    t = resolveThumb(scene.slug, itemsById, featMap);
  }
  if (!t) return null;
  return {
    id: scene.slug,
    href: `features/${scene.slug}.html`,
    title: scene.title,
    sub: scene.sub || '',
    thumb: t.thumb, thumb600: t.thumb600, thumbW: t.w, thumbH: t.h,
    alt: scene.title,
    season: scene.badge ? { badge: scene.badge } : null,
    _monthScene: true,
  };
}
// ショーケース: 固定(showcasePinned)＋プール(showcase)を ISO週で回転して count 件選ぶ。
function selectShowcase(cfg, today) {
  const pinned = cfg.showcasePinned || [];
  const pool = cfg.showcase || [];
  const count = cfg.showcaseCount || 9;
  let rotated = pool;
  if (pool.length) {
    const off = ((isoWeek(today) % pool.length) + pool.length) % pool.length;
    rotated = pool.slice(off).concat(pool.slice(0, off));
  }
  const seen = new Set();
  const picks = [];
  for (const e of [...pinned, ...rotated]) {
    if (picks.length >= count) break;
    if (seen.has(e.slug)) continue;
    seen.add(e.slug);
    picks.push(e);
  }
  return picks;
}
// 鮮度ガード: カレンダーの穴・壊れた参照を検出（--check で exit 1）。
function validateConfig(cfg, featMap, featureSlugs) {
  const errs = [];
  const itemsById = Object.fromEntries((cfg.items || []).map(i => [i.id, i]));
  for (let m = 1; m <= 12; m++) {
    const ms = monthScenesOf(cfg, m);
    if (!ms) { errs.push(`monthlyScenes[${m}] が未定義（鮮度の穴）`); continue; }
    for (const sc of ms.scenes) {
      if (!featureSlugs.has(sc.slug)) errs.push(`monthlyScenes[${m}] のページが存在しない: ${sc.slug}.html`);
      else if (!sc.thumb && !resolveThumb(sc.slug, itemsById, featMap)) {
        errs.push(`monthlyScenes[${m}] の画像が解決できない: ${sc.slug}`);
      }
    }
  }
  for (const e of [...(cfg.showcasePinned || []), ...(cfg.showcase || [])]) {
    if (!featureSlugs.has(e.slug)) errs.push(`showcase のページが存在しない: ${e.slug}.html`);
    else if (!featMap[e.slug]) errs.push(`showcase の画像が取得できない（features/index.html にカード無し）: ${e.slug}`);
  }
  for (const it of (cfg.items || [])) {
    const slug = (it.href || '').replace(/^features\//, '').replace(/\.html$/, '');
    if (slug && !featureSlugs.has(slug)) errs.push(`items のページが存在しない: ${slug}.html`);
  }
  return errs;
}
function listFeatureSlugs() {
  const dir = path.join(ROOT, 'features');
  return new Set(fs.readdirSync(dir).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, '')));
}

// ───────── 季節バナー注入（記事本文がその月のシーンに「伴う」ようにする） ─────────
// banquet 等は1年で複数シーン（新年会/送別会/暑気払い/忘年会…）に使い回されるため、
// 記事の title/h1/SEO は恒久のまま、当月のシーン文脈(badge + sceneLeads)を記事本文の
// 先頭に注入して「今月はこの用途の特集」であることを明示する。当月でない使い回し記事から
// は自動削除して鮮度を保つ。毎日実行・冪等（再実行しても差分ゼロ）。
const SEASON_NOTE_START = '<!-- SEASONAL_NOTE_START -->';
const SEASON_NOTE_END   = '<!-- SEASONAL_NOTE_END -->';
const SEASON_NOTE_CSS_MARK = '/* SEASONAL_NOTE_CSS */';
const SEASON_NOTE_CSS = `${SEASON_NOTE_CSS_MARK}
.season-note{display:flex;align-items:flex-start;gap:.7rem;margin:0 0 1.6rem;padding:.9rem 1.05rem;border:1px solid rgba(176,141,44,.35);border-left:3px solid #b08d2c;border-radius:8px;background:rgba(176,141,44,.07);}
.season-note-flag{flex:none;font-size:.68rem;font-weight:700;letter-spacing:.04em;color:#fff;background:#b08d2c;padding:.26rem .62rem;border-radius:999px;white-space:nowrap;}
.season-note-text{margin:0;font-size:.9rem;line-height:1.75;color:#3a3a3a;}
@media (prefers-color-scheme:dark){.season-note-text{color:#e8e4d8;}}
`;
function buildSeasonNote(badge, lead) {
  return `${SEASON_NOTE_START}\n      <div class="season-note"><span class="season-note-flag">${badge}</span><p class="season-note-text">${lead}</p></div>\n      ${SEASON_NOTE_END}`;
}
function stripSeasonNote(html) {
  const re = new RegExp(`\\s*${SEASON_NOTE_START}[\\s\\S]*?${SEASON_NOTE_END}`, 'g');
  return html.replace(re, '');
}
function insertSeasonNote(html, noteHtml) {
  const re = /(<div class="(?:art-body|content)">)/;
  if (!re.test(html)) return null; // アンカー未検出（構造が違う）→ 挿入しない
  return html.replace(re, `$1\n      ${noteHtml}`);
}
function ensureSeasonCss(html) {
  if (html.includes(SEASON_NOTE_CSS_MARK)) return html;
  const i = html.indexOf('</style>');
  if (i < 0) return html;
  return html.slice(0, i) + SEASON_NOTE_CSS + html.slice(i);
}
// 当月シーンに合わせて全対象記事のバナーを更新（当月外の使い回し記事からは削除）。書換件数を返す。
function refreshSeasonNotes(cfg, month) {
  const currentLeads = (cfg.sceneLeads || {})[String(month)] || {};
  // monthlyScenes に一度でも登場する全 slug が「バナー管理対象」（＝削除も含む母集合）
  const allSlugs = new Set();
  const ms = cfg.monthlyScenes || {};
  for (const m of Object.keys(ms)) for (const sc of ms[m].scenes) allSlugs.add(sc.slug);
  // 当月シーンの badge を引く
  const curBadge = {};
  const cur = monthScenesOf(cfg, month);
  if (cur) for (const sc of cur.scenes) curBadge[sc.slug] = sc.badge || '';

  let changed = 0, injected = 0;
  for (const slug of allSlugs) {
    const file = path.join(ROOT, 'features', `${slug}.html`);
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    let html = stripSeasonNote(before); // まず既存バナーを除去（冪等・自己クリーニング）
    if (curBadge[slug] !== undefined && currentLeads[slug]) {
      const note = buildSeasonNote(curBadge[slug], currentLeads[slug]);
      const withNote = insertSeasonNote(html, note);
      if (withNote) { html = ensureSeasonCss(withNote); injected++; }
    }
    if (html !== before) { fs.writeFileSync(file, html); changed++; }
  }
  return { changed, injected };
}

// ───────── メイン ─────────
function main() {
  const dateArg = process.argv.find(a => a.startsWith('--date='));
  const checkMode = process.argv.includes('--check');
  const today = todayJST(dateArg ? dateArg.split('=')[1] : null);

  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const maxSlots = cfg.maxSlots || 7;
  const itemsById = Object.fromEntries((cfg.items || []).map(i => [i.id, i]));
  const featMap = fs.existsSync(FEATURES_INDEX)
    ? parseFeatureCards(fs.readFileSync(FEATURES_INDEX, 'utf8'))
    : {};
  const featureSlugs = listFeatureSlugs();

  console.log(`[build_featured] 当日(JST): ${today} / 月: ${monthOf(today)} / ISO週: ${isoWeek(today)}`);

  // 鮮度ガード（穴・壊れ参照の検出）
  const errs = validateConfig(cfg, featMap, featureSlugs);
  if (errs.length) {
    console.error('[build_featured] 鮮度ガード検出:');
    errs.forEach(e => console.error(`  ✗ ${e}`));
    if (checkMode) { process.exit(1); }
    console.error('[build_featured] ↑ 警告として続行（--check で exit 1）');
  } else {
    console.log('[build_featured] 鮮度ガード: 12ヶ月カバー・参照OK ✓');
  }
  if (checkMode) { console.log('[build_featured] --check 完了（ファイルは書き換えません）'); return; }

  // 期間内の実在 seasonal/evergreen を priority 順に
  const active = cfg.items
    .filter(it => isActive(it, today))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // 「今月のシーン」群を先頭に必ず立てる（毎月必ず最新感・年に依存しない鮮度保証）
  const month = monthOf(today);
  const ms = monthScenesOf(cfg, month);
  const sceneItems = [];
  if (ms) {
    for (const sc of ms.scenes) {
      const it = buildSceneItem(sc, itemsById, featMap);
      if (!it) { console.error(`[build_featured] monthlyScenes[${month}] の画像解決に失敗: ${sc.slug}`); continue; }
      if (sceneItems.some(s => s.id === it.id)) continue;
      sceneItems.push(it);
    }
  }
  const sceneIds = new Set(sceneItems.map(s => s.id));
  let stripList = [...sceneItems, ...active.filter(it => !sceneIds.has(it.id))].slice(0, maxSlots);

  console.log(`[build_featured] ストリップ採用 ${stripList.length}件:`);
  stripList.forEach((it, i) => {
    const tag = it._monthScene ? `[${month}月のシーン]` : (it.season ? '[seasonal]' : '[evergreen]');
    console.log(`  ${i + 1}. ${it.id} ${tag}`);
  });

  // 1) index.html の特集ストリップ
  let indexSrc = fs.readFileSync(INDEX_HTML, 'utf8');
  const stripInner = stripList.map((it, i) => renderStripCard(it, i)).join('\n');
  indexSrc = replaceBetween(indexSrc, '<!-- FEATURED_START -->', '<!-- FEATURED_END -->', stripInner);

  // 1a) 特集ストリップの見出しを「M月の特集 — シーン一覧」に月替わり更新
  if (/<!-- FEATURED_LABEL_START -->/.test(indexSrc)) {
    const note = ms && ms.note ? `<span class="feature-strip-label-note">${ms.note}</span>` : '';
    indexSrc = replaceBetweenInline(indexSrc, '<!-- FEATURED_LABEL_START -->', '<!-- FEATURED_LABEL_END -->', `${month}月の特集${note}`);
    console.log(`[build_featured] 見出し更新 ✓ ${month}月の特集${ms && ms.note ? ' — ' + ms.note : ''}`);
  }

  // 1a2) FV内の「今月の特集」誘導リンク（SEO-040: feature-strip 本体はモバイルでFV外に落ちるため1行だけ前倒し。stripList[0]と同一データで二重管理を避ける）
  if (/<!-- HERO_FEATURE_START -->/.test(indexSrc) && stripList[0]) {
    const lead = stripList[0];
    const heroFeatureHtml = `  <a class="hero-feature-link" href="${lead.href}">今月の特集: <strong>${lead.title}</strong>を見る →</a>`;
    indexSrc = replaceBetween(indexSrc, '<!-- HERO_FEATURE_START -->', '<!-- HERO_FEATURE_END -->', heroFeatureHtml);
    console.log(`[build_featured] FVの特集導線 ✓ ${lead.id} 「${lead.title}」`);
  }

  // 1b) ジャンル特集ショーケース（週替わりローテーション）
  if ((cfg.showcase || cfg.showcasePinned) && /<!-- SHOWCASE_START -->/.test(indexSrc)) {
    const picks = selectShowcase(cfg, today);
    const cards = [];
    for (const entry of picks) {
      const info = featMap[entry.slug];
      if (!info) { console.error(`[build_featured] showcase: ${entry.slug} のカードが features/index.html に無くスキップ`); continue; }
      cards.push(renderShowcaseCard(entry, info));
    }
    indexSrc = replaceBetween(indexSrc, '<!-- SHOWCASE_START -->', '<!-- SHOWCASE_END -->', cards.join('\n'));
    console.log(`[build_featured] ショーケース ${cards.length}件 生成（週替わり）✓ ${picks.map(p => p.slug).join(', ')}`);
  }

  fs.writeFileSync(INDEX_HTML, indexSrc);
  console.log(`[build_featured] index.html 更新 ✓`);

  // 2) features/index.html の季節グリッド（実在 seasonal のみ・期間外は自動で消える）
  if (fs.existsSync(FEATURES_INDEX)) {
    let featSrc = fs.readFileSync(FEATURES_INDEX, 'utf8');
    if (/<!-- FEATURED_SEASONAL_START -->/.test(featSrc)) {
      const activeSeasonal = active.filter(it => it.season);
      const seasonalInner = activeSeasonal.length
        ? activeSeasonal.map(renderSeasonalCard).join('\n\n')
        : '  <!-- 現在表示中の季節特集はありません -->';
      featSrc = replaceBetween(featSrc, '<!-- FEATURED_SEASONAL_START -->', '<!-- FEATURED_SEASONAL_END -->', seasonalInner);
      fs.writeFileSync(FEATURES_INDEX, featSrc);
      console.log(`[build_featured] features/index.html 更新 ✓`);
    }
  }

  // 3) 季節バナー: 当月シーンの記事本文にその月の文脈を注入し、使い回し記事の「中身」を伴わせる
  const note = refreshSeasonNotes(cfg, month);
  console.log(`[build_featured] 季節バナー ✓ 書換${note.changed}件（当月シーン注入${note.injected}件・当月外は自動削除）`);
}

if (require.main === module) main();

module.exports = { isActive, todayJST, monthOf, isoWeek, selectShowcase, validateConfig, parseFeatureCards, listFeatureSlugs, monthScenesOf, refreshSeasonNotes };
