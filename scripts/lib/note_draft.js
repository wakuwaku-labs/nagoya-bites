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
const { brandViolations } = require('./brand_policy');

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
  // 本文は art-body の頭から店カードの前まで。「先に結論」「知っておきたいポイント」の箱と判断材料の部品（S3-2）は本文に混ぜない
  const bodyHtml = between(html, /<div class="art-body">/, /<div class="store-list">|<\/article>/)
    .replace(/<div class="insider-box[^"]*">[\s\S]*?<\/ul>\s*<\/div>/g, '')
    .replace(/<details class="nb-jbox[\s\S]*?<\/details>/g, '')
    .replace(/<div class="nb-jbox nb-fit[\s\S]*?<\/div>\s*<\/div>/g, '')
    .replace(/<div class="nb-guide-stats[^"]*">[\s\S]*?<\/p>\s*<\/div>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<div class="tips-box"[\s\S]*?<\/div>/g, '')
    .replace(/<p class="nb-site-intro">[\s\S]*?<\/p>/g, '');
  const sections = [];
  const re = /<h2>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2>|$)/g;
  let m;
  while ((m = re.exec(bodyHtml))) {
    const paras = [...m[2].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((x) => inline(x[1])).filter(Boolean);
    // 店の節は本文に「店舗ページ」へのリンク（../stores/<店舗ID>.html）を持つ。note の店の写真カードを選ぶのに使う
    const storeId = (/stores\/(J\d+)\.html/.exec(m[2]) || [])[1] || null;
    sections.push({ heading: inline(m[1]), paras, storeId });
  }
  const boxes = [...html.matchAll(/<div class="insider-box[^"]*">[\s\S]*?<\/ul>/g)];
  const box = boxes.length ? boxes[0][0] : '';
  const points = [...box.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => inline(x[1])).filter(Boolean);
  const pointsTitle = (/<p class="insider-title">([\s\S]*?)<\/p>/.exec(box) || [])[1] || '知っておきたいポイント';
  // 状態の帯（確認日・未訪問・AI が作成）。note の冒頭にそのまま載せる（決定5）
  const band = inline((/<p class="nb-status-band"[^>]*>([\s\S]*?)<\/p>/.exec(html) || [])[1] || '');
  return { title: inline(titleHtml), lead, sections, points, pointsTitle, band };
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
    const credit = inline(cap.replace(/<span class="art-img-kind">[\s\S]*?<\/span>/gi, '').replace(/<a [^>]*>([\s\S]*?)<\/a>/gi, '$1')).replace(/^写真[:：]\s*/, '');
    return { kind, source, src, credit, creditUrl, store: decode((/data-(?:hero|photo)-store="([^"]*)"/.exec(attrs) || [])[1] || '') };
  }
  return null;
}

/**
 * 店の実物写真が無い日の見出し画像: 記事の街（題名の地名 → 店のエリア）の実写真。Wikimedia Commons の自由ライセンス
 * （CC0・パブリックドメイン・CC BY・CC BY-SA）の写真だけを data/note_area_photos.json に載せている（2026-11-23）。
 * 同じ街が続いても毎日同じ写真にならないよう、候補を日付で回す。該当の街が無ければ名古屋の街並み（default）。
 * クレジット（撮影者・ライセンス・元のページ）は本文の最後に書く。ライセンス上、題を重ねたことも書く。
 */
function areaPhoto(entry, policy, stores = [], root = ROOT) {
  let list;
  try { list = JSON.parse(fs.readFileSync(path.join(root, 'data/note_area_photos.json'), 'utf8')).areas || {}; } catch { return null; }
  const t = policy.tags || {};
  const title = String(entry.title || '');
  const words = (t.areaWords || []).filter((w) => (list[w] || []).length);
  const byTitle = words.map((w) => ({ w, at: title.indexOf(w) })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at || b.w.length - a.w.length)[0];
  const byStore = [...words].sort((a, b) => b.length - a.length).find((w) => stores.some((s) => String(s['エリア'] || '').includes(w)));
  const usable = (k) => (list[k] || []).filter((c) => c && /^https:\/\/upload\.wikimedia\.org\//.test(c.thumb1600 || c.url || '') && c.author && c.license && c.page);
  let key = (byTitle && byTitle.w) || byStore || 'default';
  if (!usable(key).length) key = 'default';
  const cands = usable(key);
  if (!cands.length) return null;
  const day = Math.floor(Date.parse(`${entry.date || '2026-01-01'}T00:00:00Z`) / 86400000) || 0;
  const c = cands[day % cands.length];
  return { kind: 'area', source: 'commons', area: key, src: c.thumb1600 || c.url, credit: `${key}の街の写真 — ${String(c.author).replace(/[:：]/g, ' ').replace(/https?\S*/g, '').trim()} / ${c.license}（Wikimedia Commons・題の文字を重ねています）`, creditUrl: c.page, store: '' };
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

/** 本文の途中に置く店の写真カードの行（post_note.js がこの URL を note のカードにし、残りの文字を写真の出どころとしてカードの下に書く） */
const PHOTO_LINE = /^\[写真\]\s+(https:\/\/\S+)\s*(.*)$/;

const igHandle = (u) => (/instagram\.com\/([A-Za-z0-9._]+)\/(?:p|reel)\//.exec(String(u || '')) || [])[1] || null;

/**
 * 店の公式 Instagram の投稿 URL（note に貼ると、店が自分で載せた写真つきのカードになる。写真の複製ではなくリンク）。
 * 使うのは「店の公式アカウント（instagram_resolved.json の instagram）」と「投稿 URL のアカウント」が一致するものだけ。
 * 別の支店・別の店のアカウントと確かめた組（rejectedInstagram）や、公式が空の店には付けない＝取り違えた写真を出さない。
 */
function storePhotoCard(storeId, root = ROOT, cache = {}) {
  if (!storeId) return null;
  try {
    cache.posts = cache.posts || JSON.parse(fs.readFileSync(path.join(root, 'data/instagram_posts.json'), 'utf8'));
    cache.resolved = cache.resolved || JSON.parse(fs.readFileSync(path.join(root, 'data/instagram_resolved.json'), 'utf8'));
  } catch { return null; }
  const post = cache.posts[storeId];
  const r = cache.resolved[storeId] || {};
  if (r.failed) return null;
  const official = igHandle(String(r.instagram || '').replace(/\/?$/, '/p/x/'));
  if (!official) return null;
  const url = post && post.postUrl;
  const handle = igHandle(url);
  // 投稿をまだ選べていない店には付けない（アカウントのページは note で「Instagram」のロゴだけのカードになる・2026-11-23 実測）
  return url && handle && handle.toLowerCase() === official.toLowerCase() ? { url, handle, kind: 'post' } : null;
}

function buildNoteDraft(entry, html, policy, stores = storesOf(entry)) {
  const a = parseArticle(html);
  const byStore = policy.body.mode === 'stores';
  const take = policy.body.mode === 'full' || byStore ? a.sections.length : policy.body.sections;
  const shown = a.sections.slice(0, take);
  const url = utmUrl(entry, policy);
  const out = [];
  if (a.band) out.push(a.band, '');
  if (a.lead) out.push(a.lead, '');
  const cache = {};
  let cards = 0;
  const photosOn = byStore && policy.body.storePhotos !== false;
  const cardLine = (c) => { cards++; return [`[写真] ${c.url} 写真: 店の公式Instagram（@${c.handle}）`, '']; };
  // 1軒を深く読む記事（節に店の欄が無い）は、導入の後に記事の店のカードを置く（2軒まで）
  if (photosOn && !shown.some((s) => s.storeId)) {
    for (const id of (entry.store_ids || []).slice(0, 2)) { const c = storePhotoCard(id, policy._root || ROOT, cache); if (c) out.push(...cardLine(c)); }
  }
  for (const s of shown) {
    let paras = s.paras;
    // 店の欄が無い節は、最初の2段落まで（全文を2か所に載せない・0054）
    if (byStore && !s.storeId) paras = s.paras.slice(0, 2);
    // 店ごとの形（note 向け）: 店の節は「どんな店か（最初の段落）」と「行く前のひとこと」だけ。営業時間・予算などの細かい数字は元記事へ
    if (byStore && s.storeId) paras = [s.paras[0], s.paras.find((p, i) => i > 0 && /^\*\*行く前/.test(p))].filter(Boolean);
    out.push(`## ${s.heading}`, '');
    const card = photosOn ? storePhotoCard(s.storeId, policy._root || ROOT, cache) : null;
    // 写真は見出しの直後に置く（読む前に店の様子が分かる）
    if (card) out.push(...cardLine(card));
    out.push(...paras.flatMap((p) => [p.replace(/（店舗ページ）$/, ''), '']));
  }
  if (a.points.length) out.push(`## ${a.pointsTitle || '知っておきたいポイント'}`, '', ...a.points.map((p) => `- ${p}`), '');
  if (byStore && shown.some((s) => s.storeId)) out.push('営業時間・予算・地図・予約の窓口は、元記事の店ごとの欄にまとめています。', '');
  else if (shown.length < a.sections.length) {
    out.push(`この先は元記事で読めます。`, '');
  }
  if (policy.closing) out.push(policy.closing, '');
  // 見出し画像に記事の写真を使うときは、記事と同じクレジット（発行元・リリースの URL）を本文にも書く（URL は行の最後。リンクカードにしない）
  const photo = policy.eyecatch === false ? null : (articlePhoto(html, policy) || (policy.eyecatchAreaPhoto !== false ? areaPhoto(entry, policy, stores, policy._root || ROOT) : null));
  if (photo) out.push(`${PHOTO_CREDIT}${photo.credit} ${photo.creditUrl}`, '');
  out.push(policy.footer, '', `元記事: ${url}`);
  return { title: a.title, body: out.join('\n').replace(/\n{3,}/g, '\n\n'), tags: tagsFor(entry, policy, stores), url, photo, cards };
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
  // 名古屋バイツの基本方針の避ける言い回し（記事の面: Google 評価の表示は対象外・順位の語は記事の検査が警告で見る。docs/decisions/0068）
  const brand = brandViolations(all, { surface: 'article', root });
  if (brand.length) f.push('brand:' + brand.join('/'));
  // 写真カードの行（URL とアカウント名）と、決まり文句（policy.closing・footer）は記事の数字の照合から外す
  const fixed = [policy.closing, policy.footer].filter(Boolean);
  const checked = all.split('\n').filter((l) => !PHOTO_LINE.test(l.trim()) && !l.startsWith(PHOTO_CREDIT) && !fixed.includes(l.trim())).join('\n');
  const body = normalizeDigits(checked.replace(/https?:\/\/\S+/g, ' '));
  const art = normalizeDigits(articleText);
  const missing = [...new Set(body.match(/\d+(?:\.\d+)?/g) || [])]
    .filter((n) => !new RegExp(`(^|[^\\d.])${n.replace('.', '\\.')}($|[^\\d])`).test(art));
  if (missing.length) f.push('numbers_not_in_article:' + missing.join(','));
  return f;
}

module.exports = { loadPolicy, parseArticle, articlePhoto, buildNoteDraft, validateNoteDraft, utmUrl, tagsFor, storesOf, storePhotoCard, areaPhoto, htmlToText, CARD_LINE, PHOTO_LINE, dropPhotoCredit };
