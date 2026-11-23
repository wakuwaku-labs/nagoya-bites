'use strict';
/**
 * 「なぜこのエリア・この切り口なのか」の節（特集・エリアページ共通。journal の項目20と同じ考え方）。
 * 本人 2026-11-23「なぜ今池というエリアにこだわって選んだか？がないので説得力がない、読みたいと思えない」
 *  「Xやウェブサイトにも、今後作成される内容にも反映されるように」
 *
 * 書き方の決まり（創作しない）:
 *  ① その街がどんな街か … 愛知県の観光サイト Aichi Now・名古屋市・観光協会など出所のある事実。出典はリンクで節の中に置く。
 *  ② なぜこの切り口（シーン・ジャンル）にその街が合うか … このページに載せた店の事実（席数・駅からの近さなど）で裏づける。
 *  「人気」「定番」だけの言い切りや、出所の無い他の街との比較は書かない。
 * 本文は data/why_sections.json に置き、renderWhy で HTML にする（生成器・適用スクリプト・検査が同じ関数を使う）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_PATH = path.join(ROOT, 'data', 'why_sections.json');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function loadWhyData() {
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); } catch (e) { return { areas: {}, features: {} }; }
}

/** entry: { heading, paragraphs:[string(プレーンテキスト。<a>は書かない)], sources:[{label,url}], internal?:true } */
/** ctx: 本文中の {n}（掲載軒数）・{g1}（最多ジャンル）・{g1n}（その軒数）などを実データで差し込む（古い数字が残らないように） */
const fill = (s, ctx) => String(s).replace(/\{(\w+)\}/g, (m, k) => (ctx && ctx[k] != null ? ctx[k] : m));

function renderWhy(entry, kind, ctx) {
  if (!entry) return '';
  const h = kind === 'hub'
    ? `<h2 class="nb-section-head"><span>${esc(fill(entry.heading, ctx))}</span></h2>`
    : `<h2 class="section-label">${esc(entry.heading)}</h2>`;
  const paras = entry.paragraphs.map((p) => `<p>${esc(fill(p, ctx))}</p>`).join('');
  const src = (entry.sources || []).length
    ? `<p class="nb-why-src hub-picks-note">出典: ${entry.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a>`).join('、')}</p>`
    : (entry.internal ? '<p class="nb-why-src hub-picks-note">この整理は、当サイトの掲載データの集計にもとづきます。</p>' : '');
  return `<section class="nb-why" id="why-this-pick"${entry.internal ? ' data-source="internal"' : ''}>${h}${paras}${src}</section>`;
}

const stripTags = (s) => s.replace(/<[^>]+>/g, '');

/** ページに「なぜ…」の節があるか。{ has, ok, sentences, hasSource, msg } */
function checkWhy(html) {
  const m = /<section class="nb-why"[^>]*>([\s\S]*?)<\/section>/.exec(html);
  let block = m ? m[0] : null;
  if (!block) {
    // 手書きの節（<h2>なぜ…</h2> から次の <h2> まで）も認める
    const h = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/g;
    let x;
    while ((x = h.exec(html))) {
      if (/^なぜ/.test(stripTags(x[1]).trim())) { block = x[0]; break; }
    }
  }
  if (!block) return { has: false, ok: false, sentences: 0, hasSource: false, msg: '「なぜこのエリア・この切り口なのか」の節（<h2>なぜ…なのか</h2>）がない' };
  const internal = /data-source="internal"/.test(block);
  const text = [...block.matchAll(/<p(?![^>]*nb-why-src)[^>]*>([\s\S]*?)<\/p>/g)].map((x) => stripTags(x[1])).join('');
  const sentences = text.split('。').filter((x) => x.trim().length > 5).length;
  const hasSource = internal || /<a [^>]*href="https?:\/\//.test(block);
  if (sentences < 2) return { has: true, ok: false, sentences, hasSource, msg: `「なぜ…」の節が短い（${sentences}文。2文以上で、街の特徴＋この切り口に合う理由を書く）` };
  if (!hasSource) return { has: true, ok: false, sentences, hasSource, msg: '「なぜ…」の節に出典のリンク（https://…）がない。街の特徴は出所のある事実で書く' };
  return { has: true, ok: true, sentences, hasSource, msg: `「なぜ…」の節あり（${sentences}文）` };
}

/** 検査の対象か。エリアのハブ（stores/area/各エリア/index.html と stores/area/index.html）と、選出型の特集（題に◯選・◯店・◯軒・ガイド）。 */
function appliesTo(relPath, html) {
  if (/^stores\/area\/([^/]+\/)?index\.html$/.test(relPath)) return 'hub';
  if (/^features\/[^/]+\.html$/.test(relPath) && relPath !== 'features/index.html') {
    if (/noindex/.test(html)) return null;
    const t = stripTags((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html) || [])[1] || '');
    if (/(\d+|[一二三四五六七八九十]+)\s*(選|店|軒)|ガイド/.test(t)) return 'feature';
  }
  return null;
}

/** html に節を入れる（既にあれば置き換え＝冪等）。hub は art-lead の直後、feature は art-body の直後。 */
function insertWhy(html, block, kind) {
  const old = /<section class="nb-why"[\s\S]*?<\/section>/;
  if (old.test(html)) return html.replace(old, () => block);
  if (kind === 'hub') {
    const m = /(<div class="art-lead">[\s\S]*?<\/div>)\n/.exec(html);
    if (!m) return null;
    return html.slice(0, m.index + m[1].length) + '\n  ' + block + html.slice(m.index + m[1].length);
  }
  const k = '<div class="art-body">';
  const i = html.indexOf(k);
  if (i >= 0) return html.slice(0, i + k.length) + '\n    ' + block + html.slice(i + k.length);
  // art-body の無い型の特集は、最初の章見出しの前に置く
  const j = html.indexOf('<h2 class="section-label">');
  if (j < 0) return null;
  return html.slice(0, j) + block + '\n\n' + html.slice(j);
}

module.exports = { renderWhy, checkWhy, appliesTo, insertWhy, loadWhyData, DATA_PATH };
