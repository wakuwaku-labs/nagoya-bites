#!/usr/bin/env node
/**
 * sync_visible_faq_from_jsonld.js
 *
 * features/*.html で「FAQPage JSON-LD はあるが可視 FAQ セクションが無い」
 * ファイルを検出し、JSON-LD の Q&A を可視 HTML として自動生成・挿入する。
 *
 * Google の FAQ リッチリザルト要件は『JSON-LD と可視コンテンツの語彙一致』。
 * JSON-LD のみでは rich result が出ない / spam 判定リスクもあるため、
 * 同じ Q&A を可視 HTML で表現するのが必須。
 *
 * 安全装置:
 *   - 既に <p class="faq-q"> がある場合はスキップ
 *   - FAQPage JSON-LD が無い場合はスキップ
 *   - 挿入位置は </footer> 直前 or </body> 直前のいずれか先に見つかった方
 *   - CSS が未定義なら最小限のインラインスタイルブロックを 1 度だけ挿入
 *
 * 使い方:
 *   node scripts/sync_visible_faq_from_jsonld.js --dry-run
 *   node scripts/sync_visible_faq_from_jsonld.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FEATURES_DIR = path.join(__dirname, '..', 'features');
const DRY = process.argv.includes('--dry-run');

// 最小限のインラインスタイル（既存ページに CSS 変数が無い場合のフォールバック）
const INLINE_STYLE = `<style>
.faq-section{max-width:880px;margin:3rem auto 2rem;padding:0 1.5rem;font-family:inherit;}
.faq-section h2{font-size:1.1rem;font-weight:500;letter-spacing:.04em;text-align:center;margin:0 0 1.5rem;}
.faq-list{max-width:760px;margin:.5rem auto 0;}
.faq-item{border-top:1px solid rgba(0,0,0,0.12);padding:1.15rem 0;}
.faq-item:last-child{border-bottom:1px solid rgba(0,0,0,0.12);}
.faq-q{font-weight:500;font-size:.98rem;line-height:1.6;margin:0 0 .55rem;}
.faq-q::before{content:"Q. ";color:#7a5c10;font-weight:700;}
.faq-a{font-weight:300;font-size:.9rem;line-height:1.85;margin:0;}
.faq-a::before{content:"A. ";color:#7a5c10;font-weight:500;}
</style>`;

function deriveTopicFromFile(filename, html) {
  // <h1> や <title> から「よくある質問」セクションタイトル接頭辞を作る
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || ['', ''])[1]
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '')
    .replace(/【.*?】/g, '')
    .replace(/(おすすめ\d+選|完全ガイド|名古屋(?:の|・)?|2026.*$)/g, '')
    .trim();
  if (h1) return h1;
  const title = (html.match(/<title[^>]*>([^<]+)<\/title>/) || ['', ''])[1]
    .replace(/｜.*$|\|.*$/, '')
    .replace(/【.*?】/g, '')
    .trim();
  return title || '本特集';
}

function buildVisibleFaq(topic, questions) {
  const items = questions.map(q => {
    const ans = (q.acceptedAnswer && q.acceptedAnswer.text) || '';
    return `    <div class="faq-item">
      <p class="faq-q">${q.name}</p>
      <p class="faq-a">${ans}</p>
    </div>`;
  }).join('\n');
  return `<section class="faq-section" id="faq">
  <h2>${topic} よくある質問</h2>
  <div class="faq-list">
${items}
  </div>
</section>`;
}

function processFile(filename) {
  const filePath = path.join(FEATURES_DIR, filename);
  let html = fs.readFileSync(filePath, 'utf8');

  if (html.includes('<p class="faq-q">')) {
    return { filename, skipped: 'visible_faq_exists' };
  }
  const blocks = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g) || [];
  let faqJson = null;
  for (const b of blocks) {
    try {
      const j = JSON.parse(b.replace(/<script[^>]*>\s*/, '').replace(/\s*<\/script>$/, ''));
      if (j['@type'] === 'FAQPage') { faqJson = j; break; }
    } catch {}
  }
  if (!faqJson || !Array.isArray(faqJson.mainEntity) || faqJson.mainEntity.length === 0) {
    return { filename, skipped: 'no_faq_jsonld' };
  }

  const topic = deriveTopicFromFile(filename, html);
  const visible = buildVisibleFaq(topic, faqJson.mainEntity);

  // CSS チェック: .faq-section クラスが style 内に既に定義されていなければ INLINE_STYLE を追加
  const needsCss = !html.includes('.faq-section');
  const cssBlock = needsCss ? '\n' + INLINE_STYLE + '\n' : '';

  // 挿入位置: </footer> の直前を最優先、なければ </body> の直前
  if (html.includes('</footer>')) {
    html = html.replace('</footer>', '</footer>\n' + cssBlock + visible + '\n');
  } else if (html.includes('</body>')) {
    html = html.replace('</body>', cssBlock + visible + '\n</body>');
  } else {
    return { filename, skipped: 'no_insertion_point' };
  }

  if (DRY) {
    console.log(`[DRY] ${filename}: 可視 FAQ ${faqJson.mainEntity.length} 問挿入予定 (topic="${topic}")`);
  } else {
    fs.writeFileSync(filePath, html);
    console.log(`✅ ${filename}: 可視 FAQ ${faqJson.mainEntity.length} 問挿入 (topic="${topic}")`);
  }
  return { filename, applied: faqJson.mainEntity.length };
}

function main() {
  const files = fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');
  let applied = 0, skipped = 0;
  for (const f of files) {
    const r = processFile(f);
    if (r.applied) applied++; else skipped++;
  }
  console.log(`\n${DRY ? '[DRY] ' : ''}適用: ${applied} / スキップ: ${skipped}`);
}

main();
