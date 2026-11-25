'use strict';
/**
 * X の投稿に付ける「料理のイメージ写真」（店の写真が無い日用・Ondine #2713・2026-11-26 本人が D2「X にも付ける」を選択）。
 *
 * 決まり（破らない）:
 *   - 写真は note の見出し画像と同じ出どころ・同じ選び方（scripts/lib/note_draft.js の foodPhoto）。
 *     Wikimedia Commons の CC0・パブリックドメイン・CC BY・CC BY-SA だけ（AI 生成・有料は使わない）。
 *   - 店の実物ではないので、画像の左上に「イメージ」の帯、下に「写真はイメージです」を必ず焼き込む（読者が店の料理と取り違えない）。
 *   - 作者・ライセンスは画像の下端と、投稿の本文の最後の1行（「写真（イメージ）: …」）に書く。本文に足すと 280 を超える日は付けない。
 *   - 店の実物写真（PR TIMES）がある日は使わない（そちらが先・scripts/lib/x_store_photo.js）。
 *   - 作るのは Mac 側（日本語の字形がある・run_journal_local.sh の画像カードの段）。投稿側は PNG を読んで上げるだけ。
 */
const fs = require('fs');
const path = require('path');
const X = require('./x_post');
const NB = require('./note_draft');
const C = require('./x_image_card');

const ROOT = X.ROOT;
const W = C.W;
const H = C.H;
const FONT = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans CJK JP','Noto Sans JP','Yu Gothic','Meiryo',sans-serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = (s) => String(s || '').replace(/[:：]/g, ' ').replace(/https?\S*/g, '').replace(/\s+/g, ' ').trim();

/** 本文に足す1行（長い形 → 短い形）。X の数え方で limit を超えるなら null（写真を付けない） */
function creditLines(food) {
  return [`写真（イメージ）: ${food.label} / ${food.author}（${food.license}・Wikimedia Commons）`, `写真（イメージ）: ${food.author} ${food.license}`];
}
function withCredit(text, food, weightedLength = X.weightedLength, limit = 280) {
  for (const line of creditLines(food)) {
    const t = `${String(text).replace(/\s+$/, '')}\n\n${line}`;
    if (weightedLength(t) <= limit) return t;
  }
  return null;
}

/** 記事に付ける料理写真を決める。無ければ null。返り値: { src, label, author, license, page, genre } */
function pickFood(entry, root = ROOT) {
  let policy;
  try { policy = { ...NB.loadPolicy(root), _root: root }; } catch (_) { return null; }
  const p = NB.foodPhoto(entry, policy, NB.storesOf(entry, root), root);
  if (!p) return null;
  const m = String(p.credit).match(/^(.+?)の写真（イメージ）— (.*?) \/ (.+?)（Wikimedia Commons/);
  if (!m) return null;
  return { src: p.src, genre: p.genre, label: m[1], author: m[2].trim() || 'Wikimedia Commons', license: m[3].trim(), page: p.creditUrl };
}

// 文字の幅の見積もり（全角は1字=size、半角は0.55×size）。出どころの行が右下のロゴにぶつからないよう、長い日は短い形にする
const textPx = (t, size) => [...String(t)].reduce((n, ch) => n + (/[\x20-\x7e]/.test(ch) ? 0.55 : 1) * size, 0);
const CREDIT_SIZE = 24; // 一覧（360px 幅）で縮んでも読める下限（確認表 I1）に近づけるため 24px 以上
const CREDIT_MAX_PX = W - 48 - 150;
function creditText(food) {
  const forms = [`${food.label}の写真 / ${food.author} / ${food.license}（Wikimedia Commons）`, `${food.author} / ${food.license}（Wikimedia Commons）`, `${food.author} / ${food.license}`];
  const hit = forms.find((t) => textPx(t, CREDIT_SIZE) <= CREDIT_MAX_PX);
  if (hit) return hit;
  let a = [...food.author];
  while (a.length > 4 && textPx(`${a.join('')}… / ${food.license}`, CREDIT_SIZE) > CREDIT_MAX_PX) a.pop();
  return `${a.join('')}… / ${food.license}`;
}

/** 料理写真のカード（1200x675）。写真は全面・左上に「イメージ」の帯・下に注意書きと作者 */
function buildFoodSvg({ photoDataUri, food, iconDataUri }) {
  const credit = creditText(food);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.78"/></linearGradient><clipPath id="logo"><circle cx="${W - 80}" cy="${H - 80}" r="32"/></clipPath></defs>
<rect width="${W}" height="${H}" fill="#1c1c1a"/>
<image href="${photoDataUri}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
<rect x="0" y="${H - 190}" width="${W}" height="190" fill="url(#g)"/>
<rect x="40" y="40" width="190" height="64" rx="32" fill="#7a5c10"/>
<text x="135" y="85" font-size="38" font-weight="800" fill="#f7f5f1" text-anchor="middle">イメージ</text>
<text x="48" y="${H - 92}" font-size="30" font-weight="700" fill="#ffffff">写真はイメージです（実際のお店の料理ではありません）</text>
<text x="48" y="${H - 46}" font-size="${CREDIT_SIZE}" fill="#f0eee8">${esc(credit)}</text>
${iconDataUri ? `<image href="${iconDataUri}" x="${W - 112}" y="${H - 112}" width="64" height="64" clip-path="url(#logo)"/>` : ''}
</svg>
`;
}

async function download(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { 'user-agent': 'NAGOYA-BITES-editorial/1.0 (+https://nagoya-bites.com)' } });
  if (!res || res.status !== 200) throw new Error(`photo_http_${res ? res.status : 'none'}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) throw new Error('photo_too_big');
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47;
  if (!jpeg && !png) throw new Error('photo_not_image');
  return `data:${jpeg ? 'image/jpeg' : 'image/png'};base64,${buf.toString('base64')}`;
}

/**
 * 店の写真が無い日の料理イメージカードを作り、記録（data/x_post_cards/<date>.json）を書く。例外は投げない。
 * 返り値: { result: 'food_card_made'|'skipped', reason, ... }
 */
async function makeFoodCard({ date, entry, policy, html, root = ROOT, rasterizer, fetchImpl = fetch, force = false }) {
  const cfg = (policy && policy.foodImage) || {};
  if (cfg.enabled !== true) return { result: 'skipped', reason: 'food_disabled' };
  const SP = require('./x_store_photo');
  if (SP.pickPhoto(html, policy)) return { result: 'skipped', reason: 'store_photo_available' };
  const food = pickFood(entry, root);
  if (!food) return { result: 'skipped', reason: 'no_food_photo' };
  const info = { version: 1, date, slug: entry.slug, variant: 'none', source: 'food', reason: 'food_pending', decided_at: new Date().toISOString() };
  const write = () => { fs.mkdirSync(path.join(root, C.INFO_DIR_REL), { recursive: true }); X.writeJson(C.cardInfoRel(date), info, root); };
  const pngAbs = path.join(root, C.cardPngRel(date));
  try {
    if (fs.existsSync(pngAbs) && !force) {
      const prev = (() => { try { return JSON.parse(fs.readFileSync(path.join(root, C.cardInfoRel(date)), 'utf8')); } catch (_) { return null; } })();
      if (prev && prev.source === 'food' && prev.variant === 'image') return { result: 'food_card_made', reused: true, reason: 'food_image', png: C.cardPngRel(date) };
    }
    const photoDataUri = await download(food.src, fetchImpl);
    const svg = buildFoodSvg({ photoDataUri, food, iconDataUri: C.iconDataUri(root) });
    const r = C.renderPng(svg, pngAbs, { rasterizer });
    Object.assign(info, { variant: 'image', reason: 'food_image', png: C.cardPngRel(date), food: { genre: food.genre, label: food.label, author: food.author, license: food.license, page: food.page, src: food.src } });
    write();
    return { result: 'food_card_made', reason: 'food_image', png: info.png, food, ...r };
  } catch (e) {
    info.reason = 'food_render_failed';
    info.error = String(e.message || e).slice(0, 200);
    try { write(); } catch (_) { /* 記録に失敗しても公開は止めない */ }
    return { result: 'skipped', reason: 'food_render_failed', error: info.error };
  }
}

module.exports = { creditText, pickFood, buildFoodSvg, makeFoodCard, withCredit, creditLines };
