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
 * 使い方:
 *   node scripts/build_featured.js              # 通常実行
 *   node scripts/build_featured.js --date=YYYY-MM-DD  # 任意日付でテスト
 *
 * 自動実行:
 *   .github/workflows/daily-journal.yml から毎朝 7:00 JST に呼ばれる。
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
  const { start, end } = item.season;
  if (!start || !end) return true;
  return today >= start && today <= end;
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
  return `    <a class="feature-card" href="${item.href}">${badge}
      <img class="feature-card-thumb" src="${item.thumb}" srcset="${item.thumb600} 600w, ${item.thumb} 900w" sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw" alt="${item.alt}" width="${w}" height="${h}" loading="${loading}" decoding="async"${fp}>
      <div class="feature-card-body">
        <div class="feature-card-title">${item.title}</div>
        <div class="feature-card-sub">${item.sub}</div>
        <span class="feature-card-cta">特集を読む</span>
      </div>
      <div class="feature-card-arrow">→</div>
    </a>`;
}

// ───────── 季節特集グリッド HTML 生成 (features/index.html 用) ─────────
function seasonalIcon(id) {
  if (id === 'gw-2026' || id.startsWith('gw-')) return '🎏';
  if (id === 'mothers-day') return '💐';
  if (id === 'fathers-day') return '👔';
  if (id === 'spring-terrace') return '🌸';
  if (id.includes('summer') || id.includes('beer-garden')) return '🍺';
  if (id.includes('halloween')) return '🎃';
  if (id.includes('christmas')) return '🎄';
  if (id.includes('year-end') || id.includes('bonenkai')) return '🎍';
  return '🗓';
}
function seasonalCategory(id) {
  if (id === 'gw-2026' || id.startsWith('gw-')) return 'Seasonal · GW特集';
  if (id === 'mothers-day') return 'Seasonal · 母の日';
  if (id === 'fathers-day') return 'Seasonal · 父の日';
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

// ───────── メイン ─────────
function main() {
  const dateArg = process.argv.find(a => a.startsWith('--date='));
  const today = todayJST(dateArg ? dateArg.split('=')[1] : null);

  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const maxSlots = cfg.maxSlots || 7;

  const active = cfg.items
    .filter(it => isActive(it, today))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, maxSlots);

  console.log(`[build_featured] 当日(JST): ${today}`);
  console.log(`[build_featured] 採用 ${active.length}件 / 設定 ${cfg.items.length}件`);
  active.forEach((it, i) => {
    const tag = it.season ? `[seasonal ${it.season.start}〜${it.season.end}]` : '[evergreen]';
    console.log(`  ${i + 1}. ${it.id} ${tag}`);
  });
  const skipped = cfg.items.filter(it => !isActive(it, today));
  if (skipped.length) {
    console.log(`[build_featured] 期間外で除外: ${skipped.map(s => s.id).join(', ')}`);
  }

  // 1) index.html の特集ストリップを更新
  let indexSrc = fs.readFileSync(INDEX_HTML, 'utf8');
  const stripInner = active.map((it, i) => renderStripCard(it, i)).join('\n');
  indexSrc = replaceBetween(
    indexSrc,
    '<!-- FEATURED_START -->',
    '<!-- FEATURED_END -->',
    stripInner
  );
  fs.writeFileSync(INDEX_HTML, indexSrc);
  console.log(`[build_featured] index.html 更新 ✓`);

  // 2) features/index.html の季節グリッドを更新（期間内の seasonal だけ）
  if (fs.existsSync(FEATURES_INDEX)) {
    let featSrc = fs.readFileSync(FEATURES_INDEX, 'utf8');
    if (/<!-- FEATURED_SEASONAL_START -->/.test(featSrc)) {
      const activeSeasonal = active.filter(it => it.season);
      const seasonalInner = activeSeasonal.length
        ? activeSeasonal.map(renderSeasonalCard).join('\n\n')
        : '  <!-- 現在表示中の季節特集はありません -->';
      featSrc = replaceBetween(
        featSrc,
        '<!-- FEATURED_SEASONAL_START -->',
        '<!-- FEATURED_SEASONAL_END -->',
        seasonalInner
      );
      fs.writeFileSync(FEATURES_INDEX, featSrc);
      console.log(`[build_featured] features/index.html 更新 ✓`);
    } else {
      console.log(`[build_featured] features/index.html はマーカー未設定のためスキップ`);
    }
  }
}

if (require.main === module) main();

module.exports = { isActive, todayJST };
