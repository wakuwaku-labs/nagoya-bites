'use strict';
/**
 * scripts/backfill_journal_store_cta.js
 *
 * 既存ジャーナル記事の store-card に行動導線（予約・地図）を冪等に追加する（SEO-054）。
 * - 既に store-cta があるカードはスキップ（二重挿入なし）
 * - data-store-id がある場合 → ホットペッパーIDとして予約URLを生成
 * - 地図URLは 店名+エリア のGoogleMaps検索（常に出力）
 * - CSS は既存の <style> ブロックに .store-cta 定義が無い場合のみ注入
 *
 * 使い方:
 *   node scripts/backfill_journal_store_cta.js [--dry-run]
 *   node scripts/backfill_journal_store_cta.js --dry-run   # 変更なし確認のみ
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = path.join(__dirname, '..');
const JOURNAL_DIR = path.join(ROOT, 'journal');

const CSS_INJECT = `.store-cta{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.7rem;}
.store-cta-btn{display:inline-flex;align-items:center;font-size:.72rem;font-weight:500;padding:.45rem .9rem;border-radius:3px;text-decoration:none;cursor:pointer;min-height:38px;transition:background .2s;}
.store-cta-reserve{background:#e6002d;color:#fff;}
.store-cta-reserve:hover{background:#c9001e;}
.store-cta-map{background:#4285F4;color:#fff;}
.store-cta-map:hover{background:#2b6cd4;}`;

function buildCta(hpId, storeName, storeArea) {
  const safe = (storeName || '').replace(/'/g, '').replace(/</g, '').replace(/>/g, '');
  const mapQuery = encodeURIComponent((storeName || '') + (storeArea ? ' ' + storeArea : ''));
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const reserve = /^J\d+$/.test(hpId || '')
    ? `<a class="store-cta-btn store-cta-reserve" href="https://www.hotpepper.jp/str${hpId}/" target="_blank" rel="noopener noreferrer" onclick="trackEvent&&trackEvent('cta_reserve',{store_name:'${safe}',via:'journal_card'})" aria-label="${storeName}をホットペッパーで予約する">この店を予約する</a>`
    : '';
  const map = `<a class="store-cta-btn store-cta-map" href="${mapUrl}" target="_blank" rel="noopener noreferrer" onclick="trackEvent&&trackEvent('cta_gmap_click',{store_name:'${safe}',via:'journal_card'})" aria-label="${storeName}の場所をGoogleマップで確認">地図で確認</a>`;
  return `<div class="store-cta">${reserve}${map}</div>`;
}

function processFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const original = html;

  // CSS injection: .store-cta が未定義で .store-link がある場合のみ挿入
  if (!html.includes('.store-cta{') && html.includes('.store-link:hover{background:rgba(122,92,16,.08);}')) {
    html = html.replace(
      '.store-link:hover{background:rgba(122,92,16,.08);}',
      '.store-link:hover{background:rgba(122,92,16,.08);}\n' + CSS_INJECT
    );
  }

  // store-card に対して CTA を追加（冪等: store-cta が既にあればスキップ）
  // 各 store-card は <div class="store-card"...>...<div class="store-info">...</div></div> 構造
  html = html.replace(
    /(<div class="store-card"([^>]*)>)([\s\S]*?)(<\/div>\s*\n?\s*<\/div>)/g,
    (match, openTag, attrs, inner, closeTag) => {
      // 既にCTAがある
      if (inner.includes('store-cta')) return match;
      // store-info がない構造はスキップ
      if (!inner.includes('store-info')) return match;

      // data-store-id から HP ID を取得
      const idMatch = attrs.match(/data-store-id="([^"]+)"/);
      const hpId = idMatch ? idMatch[1] : '';

      // 店名を取得
      const nameMatch = inner.match(/<h3 class="store-name">([^<]+)<\/h3>/);
      const storeName = nameMatch ? nameMatch[1] : '';
      if (!storeName) return match;

      // エリアを取得（メタ情報から駅・区・市を含むspan）
      const metaMatch = inner.match(/<div class="store-meta">([\s\S]*?)<\/div>/);
      let storeArea = '';
      if (metaMatch) {
        const spans = metaMatch[1].match(/<span>([^<]+)<\/span>/g) || [];
        for (const sp of spans) {
          const text = sp.replace(/<[^>]+>/g, '');
          if (/区|市|駅|名古屋/.test(text)) { storeArea = text; break; }
        }
      }

      const cta = buildCta(hpId, storeName, storeArea);
      // store-info の </div> 直前に挿入
      const storeInfoClose = inner.lastIndexOf('</div>');
      if (storeInfoClose === -1) return match;
      const newInner = inner.substring(0, storeInfoClose) + '          ' + cta + '\n        </div>';
      return `${openTag}${newInner}${closeTag}`;
    }
  );

  const changed = html !== original;
  if (changed && !DRY_RUN) {
    fs.writeFileSync(filePath, html, 'utf8');
  }
  return changed ? 'updated' : 'skip';
}

// journal/ 配下の 2026-*.html を全件処理
const files = fs.readdirSync(JOURNAL_DIR)
  .filter(f => /^\d{4}-\d{2}-\d{2}-/.test(f) && f.endsWith('.html'))
  .map(f => path.join(JOURNAL_DIR, f))
  .sort();

let updated = 0, skipped = 0;
for (const f of files) {
  const result = processFile(f);
  if (result === 'updated') {
    updated++;
    console.log(`  [UPDATED] ${path.basename(f)}`);
  } else {
    skipped++;
  }
}
console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}完了: ${updated}件更新 / ${skipped}件スキップ`);
