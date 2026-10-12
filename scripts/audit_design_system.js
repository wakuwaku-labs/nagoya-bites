#!/usr/bin/env node
/**
 * audit_design_system.js
 *
 * DSN-001: 全ページ（root / features / journal / stores）がデザインシステム
 * （assets/css/nb.css・正本フォントURL・トークン重複禁止・font-size床）に
 * 準拠しているかを検証する決定的ゲート。
 *
 * 正本は data/design_system.json。閾値・許可リストの変更はそちらで行い、
 * このスクリプトのロジックは変えない（CLAUDE.md 制約10）。
 *
 * 検査項目:
 *   (a) assets/css/nb.css への <link rel="stylesheet"> が正しい相対深さで存在する
 *   (b) fonts.googleapis.com の <link> が1本だけあり、正本URLと一致する
 *   (c) インライン<style>内に coreTokens を再定義する :root{...} がない
 *   (d) インライン<style>内の font-size（px/rem/em/clamp）が床(12px)未満でない
 *       （allowlist.selectors に載るセレクタは除外）
 *   (e) <header> 内に class="logo"、<footer> が存在する、viewport meta がある
 *   (f) font-weight が許可リスト（400/500/600/700）以外を使っていない
 *
 * 使い方:
 *   node scripts/audit_design_system.js --check    # 違反があれば exit 1（CI向け）
 *   node scripts/audit_design_system.js --report    # 違反一覧をJSONで出力するのみ（exit 0）
 *   node scripts/audit_design_system.js --sample 200  # stores/ をサンプリング（--check/--reportと併用）
 *   node scripts/audit_design_system.js --inline-style          # style 属性の font-size だけを数える（I-35 ②・上の (a)〜(f) は回さない）
 *   node scripts/audit_design_system.js --inline-style --check  # 1 件でもあれば exit 1
 *   node scripts/audit_design_system.js --inline-style --json   # 結果を JSON で出す（既定は短い文章。夜間QA の報告向け）
 *   --root <dir>  別のリポジトリ（テスト用の小さな fixture）を見る。data/design_system.json がそこに要る
 *
 * 出力: { ok, files_scanned, violations: [{file, rule, detail}] }
 *
 * --inline-style（I-35 ②）: 上の (d) は <style> の中しか見ない。style="font-size:.7rem" のような
 * インラインの指定（特集の約 60 か所など）は床を割っても見つからなかった。ここでは style 属性の
 * font-size を (d) と同じ床（data/design_system.json の floorPx）・同じ許可（allowlist.selectors を
 * 要素の class で照らす）で数える。(a)〜(f) の判定と出力は変えない。夜間QA が soft で回し、
 * 直して 0 件になってから hard に上げる。
 * em・% の指定（例: <small style="font-size:.55em"> ）は親の大きさで実際の大きさが決まり、静的には
 * 分からない（見出しの中の .55em は 20px を超える）。違反には数えず、件数だけ別の行で出す
 * （制約10: 検証できる事実だけで判定する。実際に描かれた大きさは scripts/measure_typography.js が見る）。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
// --root <dir>: 別のリポジトリ（テスト用の小さな fixture）を見る。指定が無ければ、このスクリプトのあるリポジトリ
const rootIdx = args.indexOf('--root');
const ROOT = rootIdx >= 0 ? path.resolve(args[rootIdx + 1]) : path.join(__dirname, '..');
const DS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/design_system.json'), 'utf8'));

const mode = args.includes('--check') ? 'check' : 'report';
const sampleIdx = args.indexOf('--sample');
const sampleN = sampleIdx >= 0 ? parseInt(args[sampleIdx + 1], 10) : null;

function listHtmlFiles(dir, opts) {
  opts = opts || {};
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html'))
    .filter(f => !opts.excludeTemplate || !f.startsWith('_'))
    .map(f => path.join(dir, f));
}

function listHtmlFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) out = out.concat(listHtmlFilesRecursive(p));
    else if (f.endsWith('.html')) out.push(p);
  }
  return out;
}

function collectTargets() {
  const rootFiles = ['index.html', 'about.html', 'faq.html', 'contact.html', 'privacy-policy.html']
    .map(f => path.join(ROOT, f))
    .filter(f => fs.existsSync(f));
  const featureFiles = listHtmlFiles(path.join(ROOT, 'features'));
  const journalFiles = listHtmlFiles(path.join(ROOT, 'journal'), { excludeTemplate: true });
  let storeFiles = listHtmlFiles(path.join(ROOT, 'stores'));
  // SEO-094: stores/area/ 配下（エリア×ジャンル×条件ページ）は生成器が全ページを一律に
  // 同じテンプレートで作るため、常に全数を見る（storeFiles と違いサンプリングしない）。
  let hubFiles = listHtmlFilesRecursive(path.join(ROOT, 'stores', 'area'));

  // DSN-001: 閾値割れで status:"stub" 化されたハブページ（data/area_genre_pages_manifest.json、
  // SEO-094）は「移動しました」の最小リダイレクトHTMLのみで、意図的にデザインシステムの
  // 対象外（header/footer等を持たない）。孤児ページと同じ理由で恒久的に除外する。
  const hubManifestPath = path.join(ROOT, 'data', 'area_genre_pages_manifest.json');
  if (fs.existsSync(hubManifestPath)) {
    try {
      const pages = JSON.parse(fs.readFileSync(hubManifestPath, 'utf8')).pages || [];
      const stubPaths = new Set(pages.filter(p => p.status === 'stub').map(p => p.path));
      hubFiles = hubFiles.filter(f => !stubPaths.has(path.relative(ROOT, f)));
    } catch (e) {
      // マニフェストが壊れている場合は除外せず全件を監査する（安全側）
    }
  }

  // DSN-001: gen-store-pages.js --check-orphans が data/stores.json に無い旧テンプレの
  // 「孤児」ページを検出し data/store_page_orphans.json に永続化している（ISSUE-102・削除は
  // オーナー承認待ちで停止中）。削除できないページを監査対象に含め続けると、このゲートは
  // 永久に blocking 化できない。孤児と分かっている分だけ恒久的に除外する（マニフェスト不在
  // 時は何も除外しない＝従来どおりの安全側の挙動）。
  const orphansPath = path.join(ROOT, 'data', 'store_page_orphans.json');
  if (fs.existsSync(orphansPath)) {
    try {
      const orphanJson = JSON.parse(fs.readFileSync(orphansPath, 'utf8'));
      // ISSUE-102: 誘導ページ（canonical + meta refresh だけの軽量ページ）も監査対象外
      const orphanSlugs = new Set([...(orphanJson.orphanSlugs || []), ...(orphanJson.redirectStubSlugs || [])]);
      storeFiles = storeFiles.filter(f => !orphanSlugs.has(path.basename(f, '.html')));
    } catch (e) {
      // マニフェストが壊れている場合は除外せず全件を監査する（安全側）
    }
  }

  if (sampleN && storeFiles.length > sampleN) {
    // 決定的サンプリング（ファイル名でソートしてから均等間隔抽出。実行のたびに同じ集合になる）
    storeFiles.sort();
    const step = storeFiles.length / sampleN;
    const sampled = [];
    for (let i = 0; i < sampleN; i++) sampled.push(storeFiles[Math.floor(i * step)]);
    storeFiles = sampled;
  }

  return { rootFiles, featureFiles, journalFiles, storeFiles, hubFiles };
}

function relDepth(filePath) {
  // ROOT からの相対パスの階層数（index.html=0, features/x.html=1, ...)
  const rel = path.relative(ROOT, filePath);
  return rel.split(path.sep).length - 1;
}

function cssLinkPrefix(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

function isAllowlisted(selector, file) {
  const rel = path.relative(ROOT, file);
  if (DS.allowlist.files.some(f => rel === f || rel.endsWith(f))) return true;
  return DS.allowlist.selectors.some(sel => selector.includes(sel.replace(/^\./, '')));
}

// selector-block ペアを雑にパースする（完全なCSSパーサではないが、
// このリポジトリのCSSは "selector{decls}" の単純な形式が大半なので十分）
function splitRules(css) {
  const rules = [];
  let depth = 0, buf = '', selBuf = '', inSelector = true;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) { inSelector = false; buf = ''; }
      depth++;
      if (depth > 1) buf += ch;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        // selBuf には直前の /* コメント */ が混入し得る（次のセレクタ名にくっつく）。
        // マッチング用に取り除いた cleanSelector を別途持たせる（rawは復元用に保持）。
        const cleanSelector = selBuf.replace(/\/\*[\s\S]*?\*\//g, '').trim();
        rules.push({ selector: cleanSelector, rawSelector: selBuf, body: buf });
        selBuf = '';
        inSelector = true;
      } else {
        buf += ch;
      }
      continue;
    }
    if (inSelector) selBuf += ch;
    else buf += ch;
  }
  return rules;
}

function extractStyleBlocks(html) {
  const blocks = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks;
}

function pxFromFontSize(value) {
  value = value.trim().replace(/\s*!important\s*$/, '');
  const clampMatch = value.match(/^clamp\(\s*([^,]+),/);
  if (clampMatch) value = clampMatch[1].trim();
  const remMatch = value.match(/^([\d.]+)rem$/);
  if (remMatch) return parseFloat(remMatch[1]) * 16;
  const emMatch = value.match(/^([\d.]+)em$/);
  if (emMatch) return parseFloat(emMatch[1]) * 16;
  const pxMatch = value.match(/^([\d.]+)px$/);
  if (pxMatch) return parseFloat(pxMatch[1]);
  const pctMatch = value.match(/^([\d.]+)%$/);
  if (pctMatch) return (parseFloat(pctMatch[1]) / 100) * 16;
  return null; // var(...) など解釈できないものは対象外（トークン参照は許可）
}

function auditFile(file, violations) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  const depth = relDepth(file);
  const expectedHref = cssLinkPrefix(depth) + DS.cssPath;

  // (a) nb.css link
  const nbLinkRe = new RegExp(
    '<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']*' +
    DS.cssPath.replace(/\//g, '\\/') + ')["\']',
    'i'
  );
  const nbMatch = html.match(nbLinkRe);
  if (!nbMatch) {
    violations.push({ file: rel, rule: 'missing-nb-css-link', detail: `expected href containing ${DS.cssPath}` });
  }

  // (b) fonts.googleapis link — 正本URLと一致するか
  const fontLinks = [...html.matchAll(/<link[^>]+href=["\'](https:\/\/fonts\.googleapis\.com\/[^"\']+)["\']/gi)]
    .map(m => m[1].replace(/&amp;/g, '&'));
  if (fontLinks.length === 0) {
    violations.push({ file: rel, rule: 'missing-fonts-link', detail: 'no fonts.googleapis.com link found' });
  } else if (fontLinks.length > 1) {
    violations.push({ file: rel, rule: 'multiple-fonts-links', detail: `${fontLinks.length} links found` });
  } else if (fontLinks[0] !== DS.fontsUrl) {
    violations.push({ file: rel, rule: 'stale-fonts-url', detail: fontLinks[0] });
  }

  // (e) chrome markers
  if (!/<header[\s>][\s\S]*?class=["\'][^"\']*\blogo\b/i.test(html)) {
    violations.push({ file: rel, rule: 'missing-header-logo', detail: '' });
  }
  if (!/<footer[\s>]/i.test(html)) {
    violations.push({ file: rel, rule: 'missing-footer', detail: '' });
  }
  if (!/<meta[^>]+name=["\']viewport["\']/i.test(html)) {
    violations.push({ file: rel, rule: 'missing-viewport-meta', detail: '' });
  }

  // (c)(d)(f) インライン<style>の検査
  const blocks = extractStyleBlocks(html);
  blocks.forEach((css, blockIdx) => {
    const rules = splitRules(css);
    rules.forEach(({ selector, body }) => {
      // (c) :root 再定義（coreTokens のいずれかを含む場合のみ違反とする）
      if (/(^|,)\s*:root\s*$/.test(selector.trim())) {
        const redefined = DS.coreTokens.filter(tok => new RegExp('(^|[;{])\\s*' + tok.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '\\s*:').test(body));
        if (redefined.length > 0) {
          violations.push({ file: rel, rule: 'root-redefinition', detail: `block ${blockIdx}: ${redefined.join(',')}` });
        }
      }

      // (d) font-size 床チェック
      const fsMatches = [...body.matchAll(/font-size\s*:\s*([^;]+);/g)];
      fsMatches.forEach(([, raw]) => {
        const px = pxFromFontSize(raw);
        if (px !== null && px < DS.floorPx && !isAllowlisted(selector, file)) {
          violations.push({ file: rel, rule: 'font-size-below-floor', detail: `${selector.trim()} { font-size:${raw.trim()} } = ${px}px` });
        }
      });

      // (f) font-weight 許可リスト
      const fwMatches = [...body.matchAll(/font-weight\s*:\s*([^;]+);/g)];
      fwMatches.forEach(([, raw]) => {
        const w = parseInt(raw.trim(), 10);
        if (!isNaN(w) && !DS.allowedFontWeights.includes(w)) {
          violations.push({ file: rel, rule: 'disallowed-font-weight', detail: `${selector.trim()} { font-weight:${raw.trim()} }` });
        }
      });
    });
  });
}

// ── I-35 ②: style 属性の font-size ────────────────────────────────────────
// キーワードの大きさ（xx-small = 9px・x-small = 10px）も床を割る。pxFromFontSize は
// <style> 用に var(...) などと同じ「解釈できない」として null を返すので、ここだけ足す。
const FONT_SIZE_KEYWORD_PX = { 'xx-small': 9, 'x-small': 10 };

function inlineFontSizePx(raw) {
  const kw = raw.trim().replace(/\s*!important\s*$/, '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(FONT_SIZE_KEYWORD_PX, kw)) return FONT_SIZE_KEYWORD_PX[kw];
  return pxFromFontSize(raw);
}

/** em・% は親の大きさで決まる（静的には分からない）。*/
const RELATIVE_UNIT_RE = /^[\d.]+\s*(?:em|%)$/i;

/**
 * @param {string[]} [relative] 渡すと、床を割りそうな em・% の指定（数えない）をここへ入れる
 * @returns {{px:number, size:string, tag:string}[]} 床を割る style 属性の font-size（allowlist の class は除く）
 */
function inlineStyleHits(html, file, relative) {
  const body = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const hits = [];
  for (const m of body.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    if (!/font-size/i.test(m[2])) continue;
    const tagStart = body.lastIndexOf('<', m.index);
    const tagText = tagStart >= 0 ? body.slice(tagStart, m.index + m[0].length) : m[0];
    const cls = (tagText.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i) || []).slice(1).find(Boolean) || '';
    for (const fm of m[2].matchAll(/font-size\s*:\s*([^;]+)/gi)) {
      const px = inlineFontSizePx(fm[1]);
      if (px === null || px >= DS.floorPx) continue;
      if (cls && isAllowlisted(cls, file)) continue;
      const size = fm[1].trim();
      if (RELATIVE_UNIT_RE.test(size.replace(/\s*!important\s*$/i, ''))) {
        if (relative) relative.push({ px, size, tag: tagText.replace(/\s+/g, ' ').slice(0, 90) });
        continue;
      }
      hits.push({ px, size, tag: tagText.replace(/\s+/g, ' ').slice(0, 90) });
    }
  }
  return hits;
}

function inlineStyleMain() {
  const t = collectTargets();
  const groups = { root: t.rootFiles, features: t.featureFiles, journal: t.journalFiles, stores: t.storeFiles, hubs: t.hubFiles };
  const bySection = {};
  const violations = [];
  let pages = 0;
  let occurrences = 0;
  let scanned = 0;
  let relativePages = 0;
  let relativeOccurrences = 0;
  for (const [name, files] of Object.entries(groups)) {
    bySection[name] = { pages: 0, occurrences: 0 };
    for (const f of files) {
      scanned++;
      const relative = [];
      const hits = inlineStyleHits(fs.readFileSync(f, 'utf8'), f, relative);
      if (relative.length) { relativePages++; relativeOccurrences += relative.length; }
      if (!hits.length) continue;
      pages++;
      occurrences += hits.length;
      bySection[name].pages++;
      bySection[name].occurrences += hits.length;
      for (const h of hits) violations.push({ file: path.relative(ROOT, f), rule: 'inline-font-size-below-floor', detail: `font-size:${h.size} = ${h.px}px  ${h.tag}` });
    }
  }
  const MAX_LISTED = 50;
  const result = {
    ok: occurrences === 0,
    files_scanned: scanned,
    pages,
    occurrences,
    by_section: bySection,
    // em・% で床を割りそうな指定。親の大きさ次第なので違反には数えない（件数だけ残す）
    relative_unchecked: { pages: relativePages, occurrences: relativeOccurrences },
    violations: violations.slice(0, MAX_LISTED),
    violations_truncated: Math.max(0, violations.length - MAX_LISTED),
  };
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // 夜間QA の報告は出力の最後の 30 行だけを載せる。件数の行を最後にそろえて、見落とさないようにする
    console.log(`style 属性の文字の大きさの検査（I-35 ②）: 公開ページ ${result.files_scanned} 本（床 ${DS.floorPx}px）`);
    for (const v of result.violations.slice(0, 8)) console.log(`     例: ${v.file}  ${v.detail}`);
    console.log('     セクション別（ページ数）: ' + Object.entries(bySection).map(([k, v]) => `${k} ${v.pages}`).join(' / '));
    if (relativeOccurrences) console.log(`  ℹ️ em・% の小さな指定（親の大きさで決まるため数えない）: ${relativePages} ページ・${relativeOccurrences} か所`);
    console.log(`  ${result.ok ? '✅' : '❌'} 床を割る style 属性の font-size: ${pages} ページ・${occurrences} か所`);
  }
  if (mode === 'check' && !result.ok) process.exit(1);
  process.exit(0);
}

function main() {
  if (args.includes('--inline-style')) return inlineStyleMain();
  const { rootFiles, featureFiles, journalFiles, storeFiles, hubFiles } = collectTargets();
  const allFiles = [...rootFiles, ...featureFiles, ...journalFiles, ...storeFiles, ...hubFiles];
  const violations = [];

  allFiles.forEach(f => {
    try {
      auditFile(f, violations);
    } catch (e) {
      violations.push({ file: path.relative(ROOT, f), rule: 'audit-error', detail: e.message });
    }
  });

  const result = {
    ok: violations.length === 0,
    files_scanned: allFiles.length,
    breakdown: { root: rootFiles.length, features: featureFiles.length, journal: journalFiles.length, stores: storeFiles.length, hubs: hubFiles.length },
    violations,
  };

  console.log(JSON.stringify(result, null, 2));

  if (mode === 'check' && !result.ok) process.exit(1);
  process.exit(0);
}

main();
