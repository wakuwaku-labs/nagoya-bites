#!/usr/bin/env node
/**
 * SEO-060 — 特集記事に見出し階層を与える一度きりの構造移行 + 恒久的な検証器
 *
 * 背景（検証できる事実だけで特定した差分・制約10）:
 *   シーンKW 15本のうち検索1ページ目に届いているのは nagoya-solo-dining.html の1本だけで、
 *   その1本だけが h2×5 / h3×10 の見出し階層を持つ。残り14本は h3 がゼロで、掲載店も
 *   セクション見出しも <div> / <p> のまま並んでおり、記事の主題構造が機械可読になっていない。
 *   本文量・掲載店数・被リンク数では順位差を説明できない（banquet は本文4,490字・掲載15店・
 *   被リンク26で solo-dining に匹敵しながら21.4位、date は被リンク31で全特集最多だが13.8位）。
 *
 * 変更（見た目は一切変えない・意味づけだけを与える）:
 *   1. <div class="store-name">…</div>   → <h3 class="store-name">…</h3>
 *   2. <p class="section-label">…</p>    → <h2 class="section-label">…</h2>
 *   3. 上記2つの既定スタイル差（h2/h3 のUA既定 margin / font-weight）を打ち消すCSSを補う
 *
 * 生成器側（scripts/refresh_feature_rosters.js）は同時に修正済みのため、
 * 毎月の roster 再生成で元に戻ることはない。
 *
 * 使い方:
 *   node scripts/migrate_feature_headings.js            # 移行を実行
 *   node scripts/migrate_feature_headings.js --check    # 退行検出（CI向け・未移行があれば exit 1）
 *   node scripts/migrate_feature_headings.js --dry-run  # 変更内容だけ表示
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'features');

const CHECK = process.argv.includes('--check');
const DRY = process.argv.includes('--dry-run');

/**
 * 店名の markup は特集テンプレートに2系統ある（実測）。どちらも1行で完結している。
 *   A: <div class="store-name"><a …>店名</a></div>          … roster生成テンプレート（268件/29本）
 *   B: <span class="store-name">店名</span>（flexな .store-head の中） … 手羽先/ひつまぶし系（21件/3本）
 */
const STORE_NAME_RE = /<div class="store-name">(.*?)<\/div>/g;
const STORE_NAME_SPAN_RE = /<span class="store-name">(.*?)<\/span>/g;
const SECTION_LABEL_RE = /<p class="section-label">(.*?)<\/p>/g;

/**
 * h3 / h2 はUA既定で margin と font-weight が付く。元の <div> / <p> と同じ見た目を保つため、
 * 既存の .store-name / .section-label ルールに打ち消しを足す。
 * ルールは特集ごとにインラインで持たれており実測で数種類の変種があるため、
 * 「宣言が無いものにだけ足す」形で冪等にする。
 */
function patchCss(html) {
  let out = html;

  // .store-name — margin-top を殺す（既存の margin-bottom / 無指定の双方に対応）
  out = out.replace(/\.store-name\{([^}]*)\}/g, (m, decls) => {
    if (/(^|;)\s*margin\s*:/.test(decls)) return m;            // 既に shorthand なら触らない
    const mb = decls.match(/margin-bottom\s*:\s*([^;]+)/);
    const cleaned = decls.replace(/margin-bottom\s*:[^;]+;?/, '').replace(/;;+/g, ';');
    const margin = `margin:0 0 ${mb ? mb[1].trim() : '0'};`;
    return `.store-name{${cleaned.replace(/;?$/, ';')}${margin}}`.replace(/\{;/, '{');
  });

  // .section-label — <p> は normal、<h2> は bold になるため font-weight を明示する
  out = out.replace(/\.section-label\{([^}]*)\}/g, (m, decls) => {
    if (/font-weight\s*:/.test(decls)) return m;
    return `.section-label{${decls.replace(/;?$/, ';')}font-weight:400;}`;
  });

  return out;
}

function migrate(html) {
  let storeNames = 0;
  let sectionLabels = 0;
  let out = html.replace(STORE_NAME_RE, (m, inner) => {
    storeNames++;
    return `<h3 class="store-name">${inner}</h3>`;
  });
  out = out.replace(STORE_NAME_SPAN_RE, (m, inner) => {
    storeNames++;
    return `<h3 class="store-name">${inner}</h3>`;
  });
  out = out.replace(SECTION_LABEL_RE, (m, inner) => {
    sectionLabels++;
    return `<h2 class="section-label">${inner}</h2>`;
  });
  if (storeNames || sectionLabels) out = patchCss(out);
  return { out, storeNames, sectionLabels };
}

function main() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html')).sort();
  let totalStore = 0;
  let totalLabel = 0;
  const touched = [];

  for (const f of files) {
    const p = path.join(DIR, f);
    const html = fs.readFileSync(p, 'utf8');
    const { out, storeNames, sectionLabels } = migrate(html);
    if (!storeNames && !sectionLabels) continue;
    totalStore += storeNames;
    totalLabel += sectionLabels;
    touched.push({ file: f, storeNames, sectionLabels });
    if (!CHECK && !DRY) fs.writeFileSync(p, out);
  }

  if (CHECK) {
    if (touched.length) {
      console.error('❌ 見出し階層が未適用の特集があります（生成器の退行の可能性）:');
      touched.forEach(t => console.error(`   ${t.file}  store-name(div)=${t.storeNames}  section-label(p)=${t.sectionLabels}`));
      console.error('   修正: node scripts/migrate_feature_headings.js');
      process.exit(1);
    }
    console.log('✅ features/ の全特集で店名=h3・セクション見出し=h2 が維持されています');
    return;
  }

  const verb = DRY ? '変更予定' : '変更';
  touched.forEach(t => console.log(`  ${t.file.padEnd(38)} 店名→h3 ${String(t.storeNames).padStart(3)}  見出し→h2 ${String(t.sectionLabels).padStart(3)}`));
  console.log(`\n${verb}: ${touched.length}ファイル / 店名→h3 ${totalStore}件 / セクション見出し→h2 ${totalLabel}件`);
  if (DRY) console.log('（--dry-run のため書き込みは行っていません）');
}

main();
