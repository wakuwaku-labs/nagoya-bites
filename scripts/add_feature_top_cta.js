#!/usr/bin/env node
/**
 * add_feature_top_cta.js
 *
 * 特集記事の**冒頭**に「店舗詳細＋予約」を一体化した CTA ブロックを冪等付与する（SEO-042）。
 *
 * ============================================================================
 * 背景
 * ============================================================================
 * SEO-036（特集冒頭に「店舗詳細を見る」3件以上）と SEO-013（人気特集本文冒頭に予約導線）は
 * **設置面も対象店も同じ**だったため統合した（→ SEO-042）。別々に実装すると同じ位置に
 * 2種類のボタン群が二重に生えるか、後から実装した側が先の設置を上書きしてしまう。
 *
 * 既存の scripts/add_feature_reservation_cta.js は「各店舗ブロックの直下」に予約リンクを足す。
 * 本スクリプトはそれとは設置面が異なり、**記事を開いた直後に見える位置**に上位3店への
 * 導線をまとめて置く。GA4 で 1訪問あたり 1.26 ページ・店舗詳細オープンが極小という
 * 状態に対し、「読む前に行動できる入口」を作るのが狙い。
 *
 * ============================================================================
 * 実在保証（CLAUDE.md 架空店ブロック）
 * ============================================================================
 * 掲載店は記事の ItemList JSON-LD（全特集で形式が統一されている）から取る。さらに
 *   - stores/JXXXXXXXX.html がリポジトリに実在すること
 *   - data/closed_stores.json に載っていないこと
 * を満たした店だけを CTA に出す。3店に満たない特集はスキップする（水増ししない）。
 *
 * ============================================================================
 * 冪等性と月次ロスターとの共存
 * ============================================================================
 * ブロックは TOP_CTA マーカーで囲み、再実行時は中身を作り直す。
 * 挿入位置は `<section class="art-body">` の直前＝ refresh_feature_rosters.js が
 * 差し替える `.store-list` コンテナの**外側**なので、月次の掲載店入替で消えない。
 * 掲載店が入れ替わったら本スクリプトを再実行すれば CTA も追従する
 * （build.yml のロスター更新ステップの後段で実行する想定）。
 *
 * 使い方:
 *   node scripts/add_feature_top_cta.js            # 閲覧上位の特集に付与
 *   node scripts/add_feature_top_cta.js --all      # ItemList を持つ全特集に付与
 *   node scripts/add_feature_top_cta.js --check    # 差分を出さず現状を報告（CI 用）
 *   node scripts/add_feature_top_cta.js --slug nagoya-hitsumabushi
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const STORES_DIR = path.join(ROOT, 'stores');
const CLOSED_PATH = path.join(ROOT, 'data', 'closed_stores.json');
const SITE_METRICS = path.join(ROOT, 'data', 'site_metrics.json');
const GSC_METRICS = path.join(ROOT, 'data', 'gsc_metrics.json');

const START = '<!-- SEO-042:TOP-CTA:START -->';
const END = '<!-- SEO-042:TOP-CTA:END -->';
const CTA_STORE_COUNT = 3;

const closedRaw = fs.existsSync(CLOSED_PATH) ? fs.readFileSync(CLOSED_PATH, 'utf8') : '';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isLinkable(jcode) {
  if (!fs.existsSync(path.join(STORES_DIR, jcode + '.html'))) return false;
  if (closedRaw.includes(jcode)) return false;
  return true;
}

/**
 * 閲覧上位の特集 slug を実データから決める（決め打ちにしない）。
 * GA4 の topPages と GSC の topPages を合わせて features/*.html を拾う。
 */
function topFeatureSlugs() {
  const slugs = [];
  const push = (p) => {
    const m = String(p || '').match(/features\/([a-z0-9-]+)\.html/i);
    if (m && m[1] !== 'index' && !slugs.includes(m[1])) slugs.push(m[1]);
  };
  try {
    const ga = JSON.parse(fs.readFileSync(SITE_METRICS, 'utf8'));
    (ga.topPages || []).forEach(p => push(p.path));
  } catch (_) {}
  try {
    const gsc = JSON.parse(fs.readFileSync(GSC_METRICS, 'utf8'));
    (gsc.topPages || []).forEach(p => push(p.page));
    (gsc.pages || []).forEach(p => push(p.page));
  } catch (_) {}
  return slugs;
}

/** 記事の ItemList JSON-LD から掲載店（順位つき）を取り出す */
function storesFromItemList(html) {
  const out = [];
  const re = /"@type":"ListItem","position":(\d+),"name":"((?:[^"\\]|\\.)*)","url":"[^"]*\/stores\/(J\d+)\.html"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ position: parseInt(m[1], 10), name: JSON.parse('"' + m[2] + '"'), jcode: m[3] });
  }
  return out.sort((a, b) => a.position - b.position);
}

/**
 * 同一ブランドの別店舗が CTA に並ぶのを避ける。
 *
 * ItemList の上位はしばしば同じ看板の支店で埋まる（実例: ひつまぶし特集の1〜3位が
 * 「備長」3店舗、手羽先特集の1〜3位が「むつみ」3店舗）。記事を開いて最初に見える
 * 「EDITORS' PICK 3軒」がチェーン1社の支店一覧では、業界人の目利きという Moat に反する。
 * 正規化した店名の先頭 BRAND_KEY_LEN 文字を看板とみなし、重複を飛ばして次点を繰り上げる。
 * 重複除外の結果 3 軒に届かない場合のみ、除外した店を順位順に戻す（欠番にしない）。
 */
const BRAND_KEY_LEN = 6;

function brandKey(name) {
  return String(name || '').normalize('NFKC').replace(/[\s　]/g, '').slice(0, BRAND_KEY_LEN);
}

function pickDiverse(stores, want) {
  const picked = [];
  const seen = new Set();
  const skipped = [];
  for (const s of stores) {
    const k = brandKey(s.name);
    if (seen.has(k)) { skipped.push(s); continue; }
    seen.add(k);
    picked.push(s);
    if (picked.length >= want) return picked;
  }
  // 多様性を優先した結果 3軒に満たないときは、飛ばした店を順位順に戻す
  for (const s of skipped) {
    if (picked.length >= want) break;
    picked.push(s);
  }
  return picked.sort((a, b) => a.position - b.position);
}

/**
 * CTA の挿入位置を決める。特集のテンプレートは2系統ある
 * （`<section class="art-body">` を持つ型と `<main>` 直下に lead-box を置く型）ので、
 * 「本文の最初の <h2> の直前」という共通の位置に寄せる＝導入文の後・本編の前。
 */
function insertionIndex(html) {
  const bodyStart = html.indexOf('<section class="art-body">');
  const mainStart = html.indexOf('<main');
  const from = bodyStart >= 0 ? bodyStart : (mainStart >= 0 ? mainStart : -1);
  if (from < 0) return -1;
  const h2 = html.indexOf('<h2', from);
  return h2;
}

function buildCta(stores) {
  const items = stores.map(s => `
    <li class="topcta-item">
      <span class="topcta-name">${esc(s.name)}</span>
      <span class="topcta-actions">
        <a class="store-link" href="../stores/${s.jcode}.html">店舗詳細</a>
        <a class="store-link" href="https://www.hotpepper.jp/str${s.jcode}/" target="_blank" rel="noopener">今すぐ予約</a>
      </span>
    </li>`).join('');

  // 既存の意匠（ゴールド #7a5c16 / .store-link のボタン形状）に揃える。新しい配色は導入しない。
  //
  // 重要: 特集のテンプレートは2系統あり、**`--gold` 変数を持たない**ページがある
  // （実例: nagoya-solo-dining）。そこでは `var(--gold)` が空に解決するため、
  // ボタンが透明・文字色が黒のまま出てしまう。しかもページ側の
  // `.store-link[href*="hotpepper"]{color:var(--gold) !important}` が `!important` 付きで、
  // スコープを強めただけでは勝てない。
  // → `.topcta` 自身に変数を定義することで、**ページ側のルールも CTA の中では正しく解決する**。
  //    値はサイト共通の #7a5c10 / #96720f（index.html・他特集と同一）。
  return `${START}
<style>
.topcta{--gold:#7a5c10;--gold2:#96720f;max-width:880px;margin:0 auto 2rem;padding:1.1rem 1.5rem 1.3rem;border:1px solid rgba(122,92,16,.22);border-radius:6px;background:rgba(122,92,16,.035);}
.topcta-head{font-size:.74rem;letter-spacing:.12em;color:var(--gold,#7a5c10);margin-bottom:.15rem;}
.topcta-sub{font-size:.8rem;color:var(--muted,#6b6b6b);margin-bottom:.85rem;line-height:1.6;}
.topcta-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.6rem;}
.topcta-item{display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap;}
.topcta-name{font-size:.92rem;font-weight:500;min-width:0;}
.topcta-actions{display:flex;gap:.5rem;flex-shrink:0;}
.topcta .store-link{display:inline-flex;align-items:center;gap:.35rem;background:var(--gold,#7a5c10);color:#fff;border:1px solid var(--gold,#7a5c10);padding:.55rem 1.1rem;border-radius:4px;font-size:.78rem;font-weight:500;letter-spacing:.04em;text-decoration:none;box-shadow:0 1px 3px rgba(122,92,16,.2);transition:background .15s,transform .1s;}
.topcta .store-link:hover{background:var(--gold2,#96720f);transform:translateY(-1px);}
.topcta .store-link[href*="hotpepper"]{background:#fff;color:var(--gold,#7a5c10);border:1px solid var(--gold,#7a5c10);box-shadow:none;}
.topcta .store-link[href*="hotpepper"]:hover{background:rgba(122,92,16,.08);}
@media(max-width:640px){.topcta{padding:1rem 1.1rem 1.15rem;border-radius:0;margin-left:-1.5rem;margin-right:-1.5rem;}.topcta-item{flex-direction:column;align-items:flex-start;gap:.45rem;}.topcta-actions{width:100%;}}
</style>
<aside class="topcta" aria-label="この特集の注目店">
  <div class="topcta-head">EDITORS' PICK</div>
  <div class="topcta-sub">本文を読む前に動きたい方へ。編集部が上位に挙げた${stores.length}軒の詳細と予約はこちらから。</div>
  <ul class="topcta-list">${items}
  </ul>
</aside>
${END}`;
}

function applyTo(slug, opts) {
  const file = path.join(FEATURES_DIR, slug + '.html');
  if (!fs.existsSync(file)) return { slug, status: 'missing_file' };
  let html = fs.readFileSync(file, 'utf8');

  const all = storesFromItemList(html);
  if (all.length === 0) return { slug, status: 'no_itemlist' };

  const real = all.filter(s => isLinkable(s.jcode));
  if (real.length < CTA_STORE_COUNT) {
    // 実在確認できる店が3件に満たない場合は付けない（水増しも架空店も出さない）
    return { slug, status: 'insufficient_real_stores', found: real.length, listed: all.length };
  }
  const usable = pickDiverse(real, CTA_STORE_COUNT);

  const block = buildCta(usable);
  const hasBlock = html.includes(START) && html.includes(END);
  let next;
  if (hasBlock) {
    const re = new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    next = html.replace(re, block);
  } else {
    const at = insertionIndex(html);
    if (at < 0) return { slug, status: 'no_anchor' };
    next = html.slice(0, at) + block + '\n\n' + html.slice(at);
  }

  const changed = next !== html;
  if (changed && !opts.check) fs.writeFileSync(file, next);
  return {
    slug,
    status: hasBlock ? (changed ? 'updated' : 'unchanged') : (opts.check ? 'would_add' : 'added'),
    stores: usable.map(s => `${s.jcode}:${s.name}`)
  };
}

function main() {
  const args = process.argv.slice(2);
  const opts = { check: args.includes('--check'), all: args.includes('--all') };
  const slugArg = args.indexOf('--slug') >= 0 ? args[args.indexOf('--slug') + 1] : null;

  let slugs;
  if (slugArg) slugs = [slugArg];
  else if (opts.all) {
    slugs = fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, ''));
  } else {
    slugs = topFeatureSlugs();
    if (slugs.length === 0) {
      console.log(JSON.stringify({ ok: false, error: 'topPages から特集を特定できない（GA4/GSC 未取得）。--all か --slug を使う' }, null, 2));
      process.exit(1);
    }
  }

  const results = slugs.map(s => applyTo(s, opts));
  const counts = {};
  results.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  console.log(JSON.stringify({
    ok: true, mode: opts.check ? 'check' : 'apply', targets: slugs.length, counts,
    results: results.filter(r => r.status !== 'no_itemlist' && r.status !== 'missing_file')
  }, null, 2));
}

if (require.main === module) main();

module.exports = { storesFromItemList, buildCta };
