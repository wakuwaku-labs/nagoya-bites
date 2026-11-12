'use strict';
/**
 * X の投稿に付ける「画像カード」（自前の PNG）の決め方・作り方・X への上げ方。
 * 計画: SNS分析ツールの候補 nagoya_bites:competitor-format:media=image（競合は画像つきが伸びた）。
 *
 * 決まり（破らない）:
 *   - 他社の写真・ロゴは使わない。使うのは記事の題・要点（記事の原文）・地名と、このサイトのロゴ・色だけ。
 *   - og:image（ホットペッパー等の他社の写真のことがある）をダウンロードして上げ直さない。
 *   - 画像の上げに失敗しても投稿は止めない（呼び出し側が画像なしで続ける）。
 * 作るのは Mac 側（日本語の字形がある）。投稿する GitHub Actions は PNG を読んで上げるだけ。
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const X = require('./x_post');

const ROOT = X.ROOT;
const CARD_DIR = 'assets/x-cards';
const INFO_DIR = 'data/x_post_cards';
const W = 1200;
const H = 675;
const MAX_BYTES = 5 * 1024 * 1024; // X の tweet_image の上限（5MB）

const cardPngRel = (date) => `${CARD_DIR}/${date}.png`;
const cardInfoRel = (date) => `${INFO_DIR}/${date}.json`;

function epochDay(date) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
}

/**
 * その日に画像を付けるか決める（純粋関数）。
 * 順: 設定が切れている → none / 週の予定（plan.media）があって followPlan → それに従う / 日付の偶奇で交互。
 * 返り値: { variant: 'image'|'none', source: 'off'|'plan'|'alternate', reason }
 */
function decideImage({ date, policy, plan }) {
  const cfg = (policy && policy.imageCard) || {};
  if (cfg.enabled !== true) return { variant: 'none', source: 'off', reason: 'disabled' };
  if (cfg.since && String(date) < String(cfg.since)) return { variant: 'none', source: 'off', reason: 'before_since' };
  if (cfg.followPlan !== false && plan && (plan.media === 'image' || plan.media === 'none')) {
    return { variant: plan.media, source: 'plan', reason: `plan_media_${plan.media}` };
  }
  const imageDays = cfg.imageOnOddDays === false ? 0 : 1; // 既定: 奇数日（日付を数にした偶奇）に付ける
  const odd = epochDay(date) % 2 === 1 ? 1 : 0;
  return { variant: odd === imageDays ? 'image' : 'none', source: 'alternate', reason: odd ? 'odd_day' : 'even_day' };
}

// ── 文字の折り返し（SVG は自動で折り返さないので、幅の単位で数える）────────────
function unitWidth(ch) {
  const cp = ch.codePointAt(0);
  return cp <= 0x024f || (cp >= 0xff61 && cp <= 0xff9f) ? 0.62 : 1; // 半角・半角カナは約6割（太字の数字の実測に合わせる）
}

/** maxUnits（全角1文字=1）で折り返す。禁則は簡易（行頭に来てはいけない記号を前の行に付ける）。maxLines を超えたら { lines, truncated:true } */
function wrapLines(text, maxUnits, maxLines) {
  const noHead = '、。，．）」』】〕！？!?,.:：・ー';
  const lines = [];
  let cur = '';
  let w = 0;
  for (const ch of String(text || '').replace(/\s+/g, ' ').trim()) {
    const u = unitWidth(ch);
    if (w + u > maxUnits && cur && !noHead.includes(ch)) {
      // 語の途中で切れないように、直近 12 文字以内の区切り（空白・閉じ括弧・読点の後／開き括弧の前）があればそこで折り返す
      const chars = [...cur];
      let brk = -1;
      const isWord = (c) => /[0-9A-Za-z,.\-]/.test(c || '');
      const isUnit = (c) => /[0-9]/.test(chars[chars.length - 1] || '') && '円貫品席人名分秒杯個枚本皿種店年月日時位％%'.includes(c);
      if ((isWord(ch) || isUnit(ch)) && isWord(chars[chars.length - 1])) {
        // 数字や英単語（12,400・1貫 など）の途中では割らない: その語の頭で折り返す
        let i = chars.length;
        while (i > 0 && isWord(chars[i - 1])) i--;
        if (i > 0 && chars.length - i <= 12 && !noHead.includes(chars[i])) brk = i;
      }
      for (let i = chars.length - 1; brk < 0 && i > 0 && chars.length - i <= 12; i--) {
        if (noHead.includes(chars[i])) continue; // 行頭に閉じ括弧・句読点を出さない
        if (isWord(chars[i]) && isWord(chars[i - 1])) continue;
        if (' 』」）、。・'.includes(chars[i - 1]) || '『「（'.includes(chars[i])) { brk = i; break; }
      }
      if (brk > 0 && ch !== ' ') {
        lines.push(chars.slice(0, brk).join('').trim());
        cur = chars.slice(brk).join('').trimStart();
        w = [...cur].reduce((a, c) => a + unitWidth(c), 0);
      } else {
        lines.push(cur);
        cur = '';
        w = 0;
      }
    }
    cur += ch;
    w += u;
  }
  if (cur) lines.push(cur);
  return { lines: lines.slice(0, maxLines), truncated: lines.length > maxLines };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FONT = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans CJK JP','Noto Sans JP','Yu Gothic','Meiryo',sans-serif";

// 縦の配置（px）。題の1行目のベースライン・本文が下りてよい下端（フッターの区切り線 H-110 の 25px 上）
const TITLE_TOP = 205;
const CONTENT_BOTTOM = H - 135;
const POINT_SIZE = 30;
const POINT_LEAD = 44;

/**
 * 題の大きさ・折り返しと、要点を載せるかを決める（純粋関数）。
 * 大きい字から試し、最後の行が 1〜2 文字だけ余る折り返しは避ける。
 * 要点は「題の下に置いてもフッターに重ならない」大きさがあればそれを選び、どの大きさでも重なるなら要点を外す。
 * 返り値: null（題が 4 行に収まらない）か { size, lead, lines, pointLines, pointTop, bottom }
 */
function layoutCard(title, point) {
  const p = point ? wrapLines(point, Math.floor(1010 / POINT_SIZE), 2) : null;
  const pointLines = p && !p.truncated && p.lines.length ? p.lines : [];
  const geo = (size, lines, pl) => {
    const lead = Math.round(size * 1.4);
    const lastBase = TITLE_TOP + (lines.length - 1) * lead;
    const pointTop = lastBase + Math.round(size * 0.3) + 66; // 題の下端から約 30px 空けて要点の1行目
    const bottom = pl.length ? pointTop + (pl.length - 1) * POINT_LEAD + 12 : lastBase + Math.round(size * 0.2);
    return { size, lead, lines, pointLines: pl, pointTop, bottom };
  };
  const fits = [];
  for (const sz of [60, 54, 48, 44]) {
    const w = wrapLines(title, Math.floor(1000 / sz), 4);
    if (w.truncated || !w.lines.length) continue;
    const lastLen = [...w.lines[w.lines.length - 1]].length;
    fits.push({ sz, lines: w.lines, nice: w.lines.length === 1 || lastLen >= 3 });
  }
  if (!fits.length) return null;
  const ok = (g) => g.bottom <= CONTENT_BOTTOM;
  if (pointLines.length) {
    for (const nice of [true, false]) {
      for (const f of fits.filter((x) => x.nice === nice)) {
        const g = geo(f.sz, f.lines, pointLines);
        if (ok(g)) return g;
      }
    }
  }
  const f = fits.find((x) => x.nice) || fits[fits.length - 1];
  const g = geo(f.sz, f.lines, []);
  return ok(g) ? g : null;
}

/**
 * カードの SVG（1200x675）。素材は記事の題・要点・地名とサイトのロゴだけ。
 * 題が長くて 4 行に収まらないときは null（カードを作らず画像なしで投稿する）。
 * 要点は 2 行に収まり、フッターに重ならない物だけ載せる（収まらなければ載せない）。
 */
function buildCardSvg({ entry, policy, point, iconDataUri }) {
  const title = X.rewriteTitle(entry.title, policy);
  const L = layoutCard(title, point);
  if (!L) return null;
  const area = (X.areaHashtag(entry.title, policy) || '').replace(/^#/, '');
  const titleSvg = L.lines.map((l, i) => `<text x="95" y="${TITLE_TOP + i * L.lead}" font-size="${L.size}" font-weight="800" fill="#1c1c1a">${esc(l)}</text>`).join('');
  const pl = L.pointLines;
  const pointSvg = pl.length
    ? `<rect x="95" y="${L.pointTop - 36}" width="6" height="${pl.length * POINT_LEAD + 6}" fill="#7a5c10"/>` + pl.map((l, i) => `<text x="122" y="${L.pointTop + i * POINT_LEAD}" font-size="${POINT_SIZE}" fill="#3a3a36">${esc(l)}</text>`).join('')
    : '';
  const areaSvg = area
    ? `<rect x="95" y="62" width="${Math.round(area.length * 30 + 44)}" height="48" rx="24" fill="#7a5c10"/><text x="117" y="96" font-size="26" font-weight="700" fill="#f7f5f1">${esc(area)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="#f7f5f1"/>
<rect width="14" height="${H}" fill="#7a5c10"/>
${areaSvg}
${titleSvg}
${pointSvg}
<line x1="95" y1="${H - 110}" x2="${W - 95}" y2="${H - 110}" stroke="#d3d1c7" stroke-width="2"/>
${iconDataUri ? `<image href="${iconDataUri}" x="95" y="${H - 92}" width="64" height="64"/>` : ''}
<text x="${iconDataUri ? 178 : 95}" y="${H - 50}" font-size="30" font-weight="700" fill="#7a5c10" letter-spacing="1.5">NAGOYA BITES</text>
<text x="${W - 95}" y="${H - 50}" font-size="24" fill="#5a5a55" text-anchor="end">名古屋ジャーナル</text>
</svg>
`;
}

function iconDataUri(root = ROOT) {
  const p = path.join(root, 'icons', 'icon-512.png');
  if (!fs.existsSync(p)) return null;
  return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
}

/** SVG（1200x675）を PNG にする。Chrome ヘッドレス → rsvg-convert の順（scripts/lib/og_figure_png.js の探索を使う）。 */
function renderPng(svgText, pngPath, { rasterizer } = {}) {
  const F = require('./og_figure_png');
  const rast = rasterizer || F.findRasterizer();
  if (!rast) throw new Error(F.rasterizerHint());
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-xcard-'));
  const svgPath = path.join(tmp, 'card.svg');
  const out = path.join(tmp, 'card.png');
  try {
    fs.writeFileSync(svgPath, svgText);
    if (rast.kind === 'chrome') {
      const r = spawnSync(rast.bin, ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
        '--force-device-scale-factor=1', '--default-background-color=00000000', `--window-size=${W},${H}`, '--virtual-time-budget=3000',
        `--screenshot=${out}`, `file://${svgPath}`], { encoding: 'utf8', timeout: 60000 });
      if (r.error) throw r.error;
    } else {
      const r = spawnSync(rast.bin, ['-w', String(W), '-h', String(H), '-o', out, svgPath], { encoding: 'utf8', timeout: 60000 });
      if (r.error) throw r.error;
    }
    if (!fs.existsSync(out)) throw new Error('PNG が出力されませんでした');
    const size = F.readPngSize(out);
    if (!size || size.width !== W || size.height !== H) throw new Error(`PNG の大きさが ${size ? `${size.width}x${size.height}` : '読めない'}（${W}x${H} が必要）`);
    fs.mkdirSync(path.dirname(pngPath), { recursive: true });
    fs.copyFileSync(out, pngPath);
    return { renderer: rast.kind, bytes: fs.statSync(pngPath).size, width: size.width, height: size.height };
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* 一時ファイルの掃除に失敗しても続ける */ }
  }
}

/**
 * 今日の記事のカードを決めて作る。付けない日は PNG を作らず、記録（data/x_post_cards/<date>.json）だけ書く。
 * 返り値: { variant, source, reason, png?, error? }。例外は投げない（記事の公開を止めない）。
 */
function makeCard({ date, entry, policy, plan, html, root = ROOT, rasterizer, force = false }) {
  const d = decideImage({ date, policy, plan });
  const info = { version: 1, date, slug: entry.slug, variant: d.variant, source: d.source, reason: d.reason, decided_at: new Date().toISOString() };
  const write = () => { fs.mkdirSync(path.join(root, INFO_DIR), { recursive: true }); X.writeJson(cardInfoRel(date), info, root); };
  const pngAbs = path.join(root, cardPngRel(date));
  if (d.variant !== 'image') { write(); return { ...d }; }
  if (fs.existsSync(pngAbs) && !force) { info.png = cardPngRel(date); write(); return { ...d, png: info.png, reused: true }; }
  try {
    const svg = buildCardSvg({ entry, policy, point: X.insiderPoints(html)[0], iconDataUri: iconDataUri(root) });
    if (!svg) { info.variant = 'none'; info.reason = 'title_too_long'; write(); return { variant: 'none', source: d.source, reason: 'title_too_long' }; }
    const r = renderPng(svg, pngAbs, { rasterizer });
    info.png = cardPngRel(date);
    write();
    return { ...d, png: info.png, ...r };
  } catch (e) {
    info.variant = 'none';
    info.reason = 'render_failed';
    info.error = String(e.message || e).slice(0, 200);
    write();
    return { variant: 'none', source: d.source, reason: 'render_failed', error: info.error };
  }
}

/** 投稿側が読む。返り値: { attach: boolean, variant, reason, file?, bytes? }。PNG の署名と大きさも確かめる。 */
function loadCard(date, policy, root = ROOT) {
  const cfg = (policy && policy.imageCard) || {};
  if (cfg.enabled !== true) return { attach: false, variant: 'none', reason: 'disabled' };
  let info;
  try { info = JSON.parse(fs.readFileSync(path.join(root, cardInfoRel(date)), 'utf8')); } catch (_) { return { attach: false, variant: 'none', reason: 'no_card_record' }; }
  if (info.variant !== 'image') return { attach: false, variant: 'none', reason: info.reason || 'none' };
  const file = path.join(root, cardPngRel(date));
  if (!fs.existsSync(file)) return { attach: false, variant: 'none', reason: 'png_missing' };
  const buf = fs.readFileSync(file);
  if (buf.length > MAX_BYTES) return { attach: false, variant: 'none', reason: 'png_too_big' };
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(16) !== W || buf.readUInt32BE(20) !== H) return { attach: false, variant: 'none', reason: 'png_invalid' };
  return { attach: true, variant: 'image', reason: info.reason || 'image', source: info.source, file, bytes: buf.length };
}

// ── X へ上げる ───────────────────────────────────────────────────────────
const UPLOAD_V2 = 'https://api.x.com/2/media/upload';
const UPLOAD_V1 = 'https://upload.twitter.com/1.1/media/upload.json';

async function readBody(res) {
  const raw = await res.text();
  try { return JSON.parse(raw); } catch (_) { return raw; }
}

/**
 * PNG を X に上げて media id を返す。v2（POST /2/media/upload）を先に試し、使えなければ v1.1 に切り替える。
 * どちらも OAuth 1.0a の利用者の鍵で署名する（multipart の本文は署名の対象外）。
 * 返り値: { ok:true, id, via } か { ok:false, reason }。例外は投げない。
 */
async function uploadImage(file, cred, fetchImpl = fetch) {
  let buf;
  try { buf = fs.readFileSync(file); } catch (e) { return { ok: false, reason: `read_failed:${e.message}` }; }
  const attempts = [];
  const form = (extra) => {
    const f = new FormData();
    f.append('media', new Blob([buf], { type: 'image/png' }), 'card.png');
    for (const [k, v] of Object.entries(extra)) f.append(k, v);
    return f;
  };
  for (const ep of [{ via: 'v2', url: UPLOAD_V2, extra: { media_category: 'tweet_image' } }, { via: 'v1.1', url: UPLOAD_V1, extra: { media_category: 'tweet_image' } }]) {
    try {
      const auth = X.oauthHeader({ method: 'POST', url: ep.url, ...cred });
      const res = await fetchImpl(ep.url, { method: 'POST', headers: { authorization: auth }, body: form(ep.extra) });
      const body = await readBody(res);
      const id = ep.via === 'v2' ? body && body.data && body.data.id : body && body.media_id_string;
      if ((res.status === 200 || res.status === 201 || res.status === 202) && id) return { ok: true, id: String(id), via: ep.via };
      const d = typeof body === 'string' ? body.slice(0, 120) : JSON.stringify(body).slice(0, 120);
      attempts.push(`${ep.via}:http_${res.status} ${d}`);
    } catch (e) {
      attempts.push(`${ep.via}:network ${e.message || e}`);
    }
  }
  return { ok: false, reason: attempts.join(' | ') };
}

module.exports = { decideImage, wrapLines, layoutCard, buildCardSvg, CONTENT_BOTTOM, renderPng, makeCard, loadCard, uploadImage, cardPngRel, cardInfoRel, W, H, UPLOAD_V2, UPLOAD_V1 };
