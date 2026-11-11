'use strict';
/**
 * scripts/lib/journal_next_block.js
 *
 * 日次ジャーナルの記事末（</article> の直後）に置く「次の一歩」ブロックの唯一の正本。
 *   - この記事で紹介したお店: 記事の店カード（.store-card）が既に持つ店舗ページへのリンク（../stores/<ID>.html）を、
 *     店名ごとの大きなリンクとして記事末に集めて出す。ひも付けは新しく作らない（カードの既存リンクだけを使い、
 *     stores/ に実在するものに限る）。
 *   - あわせて読みたい特集: 記事題名の話題（scripts/lib/journal_topics.js の振り分け表）に当たる特集のうち、
 *     その記事の中でまだリンクしていないものだけ（最大2本）。既にあるリンクと二重にしない。
 * 使う側: scripts/refresh_journal_related.js（日次の生成の流れ・新しい記事）と
 *         scripts/add_journal_next_block.js（既存の記事への後追い）。どちらも applyToHtml の1本。
 * 計測: 店舗ページへのリンクは既存の journal_store_click（scripts/lib/journal_store_link_tracking.js）が拾う。
 *       ブロックからのクリックを見分けるため internal_link_click の block も送る（journal_hub と同じ形）。
 * 冪等: START/END のマーカーで囲み、再実行すると同じ内容に置き換える。載せるものが無い記事には入れない（入っていれば外す）。
 * 本文（.art-body）は変えない。
 */
const fs = require('fs');
const path = require('path');
const { TOPIC_FEATURES } = require('./journal_topics');
const { relabelForSlug } = require('./feature_counts');

const ROOT = path.join(__dirname, '..', '..');
const START = '<!-- NB-JOURNAL-NEXT:START -->';
const END = '<!-- NB-JOURNAL-NEXT:END -->';
const MAX_FEATURES = 2;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function jsEsc(s) { return String(s).replace(/[^A-Za-z0-9_\-./]/g, ''); }
function stripTags(s) { return String(s).replace(/<[^>]+>/g, ''); }
function decode(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/** 入っているブロックを外した HTML（リンクの重なりを数えるとき、ブロック自身を除く） */
function stripBlock(html) {
  const s = html.indexOf(START);
  const e = html.indexOf(END);
  if (s === -1 || e === -1 || e < s) return html;
  // 入れるときは「</article> + 空行 + ブロック」なので、外すときも前の空行ごと外す（入れ直しで空行が増えない）
  let start = s;
  if (html.slice(0, s).endsWith('\n\n')) start = s - 2;
  return html.slice(0, start) + html.slice(e + END.length);
}

function articleTitle(html) {
  const m = html.match(/<h1 class="art-title">([\s\S]*?)<\/h1>/);
  return m ? decode(stripTags(m[1])).replace(/\s+/g, ' ').trim() : '';
}

/** 記事の店カードから、店舗ページ（stores/<ID>.html が実在する）へのリンクを持つ店を集める */
function collectStores(html, { rootDir = ROOT } = {}) {
  const body = stripBlock(html).split('</article>')[0];
  const stores = [];
  const seen = new Set();
  const parts = body.split('<div class="store-card"').slice(1);
  for (const part of parts) {
    const name = (part.match(/<h3 class="store-name">([\s\S]*?)<\/h3>/) || [])[1];
    const href = (part.match(/href="\.\.\/stores\/([A-Za-z0-9_-]+)\.html"/) || [])[1];
    if (!name || !href || href === 'index' || seen.has(href)) continue;
    if (!fs.existsSync(path.join(rootDir, 'stores', href + '.html'))) continue;
    seen.add(href);
    const spans = [...((part.match(/<div class="store-meta">([\s\S]*?)<\/div>/) || [])[1] || '').matchAll(/<span>([\s\S]*?)<\/span>/g)].map(m => stripTags(m[1]).trim()).filter(Boolean);
    // エリアの欄は「大須（大須観音駅から徒歩5分・…）」のように長いことがあるので、括弧の前までにする
    const meta = spans.slice(0, 2).map(t => t.replace(/[（(].*$/, '').trim()).filter(Boolean).join('・');
    stores.push({ id: href, name: stripTags(name).trim(), meta });
  }
  return stores;
}

/** 題名の話題に当たる特集のうち、記事の中でまだリンクしていないもの */
function collectFeatures(html, { rootDir = ROOT } = {}) {
  const page = stripBlock(html);
  const title = articleTitle(page);
  const out = [];
  const seen = new Set();
  for (const [re, slug, label] of TOPIC_FEATURES) {
    if (!re.test(title) || seen.has(slug)) continue;
    if (!fs.existsSync(path.join(rootDir, 'features', slug + '.html'))) continue;
    seen.add(slug);
    if (page.includes(`features/${slug}.html`)) continue;
    out.push({ slug, label: relabelForSlug(label, slug) });
    if (out.length >= MAX_FEATURES) break;
  }
  return out;
}

function buildBlock(stores, features) {
  if (!stores.length && !features.length) return '';
  const L = [START, '<section class="nb-journal-next" aria-labelledby="nb-journal-next-title">'];
  if (stores.length) {
    L.push('  <h2 class="nb-journal-next-title" id="nb-journal-next-title">この記事で紹介したお店</h2>');
    L.push('  <ul class="nb-journal-next-list">');
    for (const s of stores) {
      const href = `../stores/${s.id}.html`;
      L.push(`    <li><a class="nb-journal-next-link" href="${href}" onclick="trackEvent('internal_link_click',{link_url:'${jsEsc(href)}',block:'journal_next_store'})"><span class="nb-journal-next-name">${esc(s.name)}</span>${s.meta ? `<span class="nb-journal-next-meta">${esc(s.meta)}</span>` : ''}<span class="nb-journal-next-go">店舗ページを見る →</span></a></li>`);
    }
    L.push('  </ul>');
  }
  if (features.length) {
    L.push(`  <p class="nb-journal-next-sub"${stores.length ? '' : ' id="nb-journal-next-title"'}>あわせて読みたい特集</p>`);
    L.push('  <ul class="nb-journal-next-list nb-journal-next-features">');
    for (const f of features) {
      const href = `../features/${f.slug}.html`;
      L.push(`    <li><a class="nb-journal-next-link" href="${href}" onclick="trackEvent('internal_link_click',{link_url:'${jsEsc(href)}',block:'journal_next_feature'})"><span class="nb-journal-next-name">${esc(f.label)}</span><span class="nb-journal-next-go">特集を読む →</span></a></li>`);
    }
    L.push('  </ul>');
  }
  L.push('</section>', END);
  return L.join('\n');
}

/** 記事の HTML にブロックを入れて返す（冪等）。入れる場所は </article> の直後。入れる物が無ければ、あるブロックを外す。</article> が無ければ null */
function applyToHtml(html, opts) {
  const base = stripBlock(html);
  const block = buildBlock(collectStores(base, opts), collectFeatures(base, opts));
  const at = base.indexOf('</article>');
  if (at === -1) return null;
  if (!block) return base;
  const end = at + '</article>'.length;
  return base.slice(0, end) + '\n\n' + block + base.slice(end);
}

module.exports = { START, END, collectStores, collectFeatures, buildBlock, applyToHtml, stripBlock };
