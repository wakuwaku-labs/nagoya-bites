'use strict';
/**
 * note 自動投稿の下書きづくりと検査の唯一の情報源（docs/decisions/0054）。
 * 日次ジャーナルの HTML から、note に貼れる Markdown を決定的に作る（Claude を使わない・費用ゼロ）。
 * 検査は検証できる事実だけで行う（CLAUDE.md 制約10）:
 *   使わない言い方・本文の数字が記事にあるか・元記事への UTM つきリンク・文字数
 */
const fs = require('fs');
const path = require('path');
const { htmlToText, normalizeDigits, wordingViolations } = require('./x_post');

const ROOT = path.resolve(__dirname, '..', '..');

function loadPolicy(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data/note_post_policy.json'), 'utf8'));
}

const decode = (s) => String(s || '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

/** インラインの HTML を note の Markdown に（強調・リンク・改行だけ）。 */
function inline(html) {
  return decode(String(html)
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, t) => (/^https?:/.test(h) ? `[${t.replace(/<[^>]+>/g, '')}](${h})` : t.replace(/<[^>]+>/g, '')))
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ').trim();
}

function between(html, startRe, endRe) {
  const m = startRe.exec(html);
  if (!m) return '';
  const rest = html.slice(m.index + m[0].length);
  const e = endRe ? endRe.exec(rest) : null;
  return e ? rest.slice(0, e.index) : rest;
}

/** 記事の HTML から、題名・導入文・見出しごとの節・ポイントを取り出す。 */
function parseArticle(html) {
  const titleHtml = (/<h1 class="art-title">([\s\S]*?)<\/h1>/.exec(html) || [])[1] || '';
  const lead = inline((/<p class="art-lead">([\s\S]*?)<\/p>/.exec(html) || [])[1] || '');
  const bodyHtml = between(html, /<div class="art-body">/, /<div class="insider-box">/)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<div class="tips-box"[\s\S]*?<\/div>/g, '')
    .replace(/<p class="nb-site-intro">[\s\S]*?<\/p>/g, '');
  const sections = [];
  const re = /<h2>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2>|$)/g;
  let m;
  while ((m = re.exec(bodyHtml))) {
    const paras = [...m[2].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((x) => inline(x[1])).filter(Boolean);
    sections.push({ heading: inline(m[1]), paras });
  }
  const box = between(html, /<div class="insider-box">/, /<div class="store-list">|<\/article>/);
  const points = [...box.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => inline(x[1])).filter(Boolean);
  return { title: inline(titleHtml), lead, sections, points };
}

/** 本文のうち「文言: URL」だけの行。post_note.js がこの URL をリンクカードにする（元記事の行）。クレジットの行はこの形にしない */
const CARD_LINE = /^(.*?):\s*(https?:\/\/\S+)$/;
/** 見出し画像の写真のクレジットの行の頭 */
const PHOTO_CREDIT = '見出し画像: ';

/** 本文から写真のクレジットの行を外す（写真を見出し画像に入れられなかった日に、無い写真のクレジットを載せない） */
const dropPhotoCredit = (body) => String(body).split('\n').filter((l) => !l.startsWith(PHOTO_CREDIT)).join('\n').replace(/\n{3,}/g, '\n\n');

/**
 * note の見出し画像に使える、記事に載せた店の実物写真（ヒーロー → 本文の順で最初の1枚）。無ければ null。
 * 使えるのは policy.eyecatchPhoto の出どころ・配信元で、クレジット（発行元とリリースの URL）があるものだけ（docs/decisions/0056）。
 * 写真の帰属（その記事の店か）は記事を作るときの判定（scripts/lib/hero_photo_gate.js）を通ったものなので、ここでは選び直さない。
 */
function articlePhoto(html, policy) {
  const rule = policy.eyecatchPhoto || {};
  const sources = rule.sources || [];
  const hosts = rule.hosts || [];
  const figs = [...String(html).matchAll(/<figure class="art-(hero|body)-img"([^>]*)>([\s\S]*?)<\/figure>/g)]
    .sort((a, b) => (a[1] === b[1] ? 0 : a[1] === 'hero' ? -1 : 1));
  for (const [, kind, attrs, inner] of figs) {
    const source = (/data-(?:hero|photo)-source="([^"]*)"/.exec(attrs) || [])[1];
    const src = decode((/<img [^>]*src="(https:\/\/[^"]+)"/.exec(inner) || [])[1] || '');
    const cap = (/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(inner) || [])[1] || '';
    const creditUrl = decode((/<a [^>]*href="(https:\/\/[^"]+)"/.exec(cap) || [])[1] || '');
    let host = '';
    try { host = new URL(src).hostname; } catch { /* src が無い */ }
    if (!sources.includes(source) || !hosts.some((h) => host === h || host.endsWith('.' + h)) || !creditUrl) continue;
    const credit = inline(cap.replace(/<a [^>]*>([\s\S]*?)<\/a>/gi, '$1')).replace(/^写真[:：]\s*/, '');
    return { kind, source, src, credit, creditUrl, store: decode((/data-(?:hero|photo)-store="([^"]*)"/.exec(attrs) || [])[1] || '') };
  }
  return null;
}

function utmUrl(entry, policy) {
  const u = new URL(`${String(policy.siteBase).replace(/\/+$/, '')}/journal/${entry.slug}.html`);
  u.searchParams.set('utm_source', policy.utm.source);
  u.searchParams.set('utm_medium', policy.utm.medium);
  u.searchParams.set('utm_campaign', entry.slug);
  return u.toString();
}

/** 記事の店（store_ids）を data/stores.json から引く。無い・読めないときは空（タグが減るだけで止めない）。 */
function storesOf(entry, root = ROOT) {
  const ids = new Set(entry.store_ids || []);
  if (!ids.size) return [];
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'data/stores.json'), 'utf8')).filter((s) => ids.has(s['店舗ID']));
  } catch { return []; }
}

/**
 * タグ（ハッシュ無しで返す。note の入力欄に1つずつ入れる）。note 公式ヘルプの目安「5つぐらい」「種類・テーマ・シリーズ・関連語で付ける」に合わせ、
 * 基本タグ → 地名1つ（題名、無ければ店のエリア）→ テーマ（題名の語・店のジャンル）→ 埋め草（グルメ）の順に max 個まで（docs/decisions/0055）。
 * 記事に無い語は付けない（関係の無いタグを足すと、ハッシュタグのページで読者を裏切る）。
 */
function tagsFor(entry, policy, stores = []) {
  const t = policy.tags;
  const title = String(entry.title || '');
  // 題名の前に出る語ほど記事の主題に近いので、出てくる位置の順に選ぶ（同じ位置なら長い語＝「栄生」を「栄」より先に）
  const byPosition = (list, keyOf) => list.map((x) => ({ x, at: title.indexOf(keyOf(x)), len: keyOf(x).length }))
    .filter((m) => m.at >= 0).sort((a, b) => a.at - b.at || b.len - a.len).map((m) => m.x);
  const words = t.areaWords || [];
  const area = byPosition(words, (w) => w)[0]
    || [...words].sort((a, b) => b.length - a.length).find((w) => stores.some((s) => String(s['エリア'] || '').includes(w)));
  const topics = byPosition(Object.entries(t.titleTopics || {}), ([word]) => word).map(([, tag]) => tag);
  for (const s of stores) if ((t.genreTopics || {})[s['ジャンル']]) topics.push(t.genreTopics[s['ジャンル']]);
  const head = [...new Set([...t.base, ...(area ? [area] : [])])];
  const picked = [...head, ...[...new Set(topics)].filter((x) => !head.includes(x)).slice(0, t.maxTopics ?? 2)];
  for (const f of t.fill || []) if (picked.length < t.max && !picked.includes(f)) picked.push(f);
  return picked.slice(0, t.max);
}

function buildNoteDraft(entry, html, policy, stores = storesOf(entry)) {
  const a = parseArticle(html);
  const take = policy.body.mode === 'full' ? a.sections.length : policy.body.sections;
  const shown = a.sections.slice(0, take);
  const url = utmUrl(entry, policy);
  const out = [];
  if (a.lead) out.push(a.lead, '');
  for (const s of shown) {
    out.push(`## ${s.heading}`, '', ...s.paras.flatMap((p) => [p, '']));
  }
  if (a.points.length) out.push('## 知っておきたいポイント', '', ...a.points.map((p) => `- ${p}`), '');
  if (shown.length < a.sections.length) {
    out.push(`この先は元記事で読めます。`, '');
  }
  // 見出し画像に記事の写真を使うときは、記事と同じクレジット（発行元・リリースの URL）を本文にも書く（URL は行の最後。リンクカードにしない）
  const photo = policy.eyecatch === false ? null : articlePhoto(html, policy);
  if (photo) out.push(`${PHOTO_CREDIT}${photo.credit} ${photo.creditUrl}`, '');
  out.push(policy.footer, '', `元記事: ${url}`);
  return { title: a.title, body: out.join('\n').replace(/\n{3,}/g, '\n\n'), tags: tagsFor(entry, policy, stores), url, photo };
}

/** 落ちた理由の配列（空なら通過）。 */
function validateNoteDraft(draft, { policy, articleText, root = ROOT }) {
  const f = [];
  const all = `${draft.title}\n${draft.body}`;
  if (!draft.title) f.push('title_empty');
  if (draft.title.length > policy.titleMax) f.push('title_too_long');
  if (draft.body.length > policy.bodyMaxChars) f.push('body_too_long');
  if (!draft.body.includes('utm_source=' + policy.utm.source)) f.push('utm_missing');
  const bad = wordingViolations(all, root);
  if (bad.length) f.push('wording:' + bad.join(','));
  const body = normalizeDigits(all.replace(/https?:\/\/\S+/g, ' '));
  const art = normalizeDigits(articleText);
  const missing = [...new Set(body.match(/\d+(?:\.\d+)?/g) || [])]
    .filter((n) => !new RegExp(`(^|[^\\d.])${n.replace('.', '\\.')}($|[^\\d])`).test(art));
  if (missing.length) f.push('numbers_not_in_article:' + missing.join(','));
  return f;
}

module.exports = { loadPolicy, parseArticle, articlePhoto, buildNoteDraft, validateNoteDraft, utmUrl, tagsFor, storesOf, htmlToText, CARD_LINE, dropPhotoCredit };
