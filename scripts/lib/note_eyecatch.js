'use strict';
/**
 * note の見出し画像（アイキャッチ）の素材を用意する（docs/decisions/0056）。
 * - 記事に載せた店の実物写真（規約で note に上げてよい出どころだけ。note_draft.js の articlePhoto が選ぶ）は、
 *   加工せずにそのまま取ってくる（downloadPhoto）。写真の画素とフレームはそのままにして、写真の下に別の帯
 *   （題と日付）を足した図を作る（makePhotoEyecatch・2026-11-13 ブランドの決定・docs/decisions/0064-note-eyecatch-title-band-below-photo.md）。
 *   写真に文字や影を重ねない・縮めない・切らない（PR TIMES の規約は改変可と明記していない＝Ondine #1914）。
 * - それが無い日は、記事の題と日付だけの図を作る（makeEyecatch・1280x670 PNG）。店と関係の無い写真は使わない
 *   （以前は共通の居酒屋の写真を毎日使い、別の店の記事にも同じ写真が出ていた・2026-10-24 オーナー指摘）。
 * 書体は端末にあるものだけを指す（CLAUDE.md 制約12 の方針に合わせる）。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./note_browser');
const { findWordBreaks } = require('./x_image_card');

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** PR TIMES の画像は、配信元が用意している縮小版（幅1920）を取る（原寸は数MBになる。縮小は配信元が行い、こちらでは加工しない） */
function photoUrl(src) {
  const u = new URL(src);
  if (u.hostname === 'prcdn.freetls.fastly.net' && !u.search) u.search = '?width=1920&quality=85&format=jpeg&fit=bounds';
  return u.toString();
}

/** 写真を一時ファイルに取ってきてパスを返す（リポジトリには置かない）。画像でなければ止める */
function downloadPhoto(src, date, outDir = os.tmpdir()) {
  const out = path.join(outDir, `nb-note-photo-${date}.jpg`);
  execFileSync('curl', ['-fsSL', '--max-time', '30', '-A', 'NAGOYA-BITES-editorial/1.0 (+https://nagoya-bites.com)', '-o', out, photoUrl(src)]);
  const head = fs.readFileSync(out).subarray(0, 4);
  const isJpeg = head[0] === 0xff && head[1] === 0xd8;
  const isPng = head[0] === 0x89 && head.toString('latin1', 1, 4) === 'PNG';
  if (!isJpeg && !isPng) { fs.rmSync(out, { force: true }); throw new Error('取ってきたものが画像ではありません'); }
  if (isPng) { const png = out.replace(/\.jpg$/, '.png'); fs.renameSync(out, png); return png; }
  return out;
}

/** 題と日付だけの図（店の実物写真が使えない日の見出し画像） */
function html(title, date) {
  const size = title.length > 44 ? 50 : title.length > 30 ? 58 : 66;
  return `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0}
  .c{width:1280px;height:670px;box-sizing:border-box;padding:64px 80px;background:#f6f2ea;color:#241c10;
     font-family:"Hiragino Mincho ProN","Hiragino Sans","Yu Mincho",serif;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
  .bar{position:absolute;left:0;top:0;bottom:0;width:22px;background:#7b5a12}
  .k{font-family:"Hiragino Sans","Yu Gothic",sans-serif;font-size:26px;letter-spacing:.18em;color:#7b5a12;font-weight:600}
  h1{margin:0;font-size:${size}px;line-height:1.38;font-weight:700;letter-spacing:.02em}
  .f{display:flex;justify-content:space-between;align-items:flex-end;font-family:"Hiragino Sans","Yu Gothic",sans-serif;font-size:26px;color:#5d4a2a}
  .nb{width:104px;height:104px;border-radius:50%;background:#7b5a12;color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Hiragino Mincho ProN",serif;font-size:50px;font-weight:700}
  </style><div class="c"><div class="bar"></div>
  <div class="k">NAGOYA BITES JOURNAL</div><h1>${esc(title)}</h1>
  <div class="f"><span>${esc(date)} ／ 名古屋の飲食店ジャーナル</span><div class="nb">NB</div></div></div>`;
}

/** 題を語（Intl.Segmenter・日本語）に分け、2字以上の語は途中で折れないようにする（「大盛り」「ランチ」を割らない） */
function titleHtml(title) {
  const segs = [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(title)];
  const out = []; let cur = '';
  const flush = () => { if (cur) out.push([...cur].length > 1 ? `<span style="white-space:nowrap">${esc(cur)}</span>` : esc(cur)); cur = ''; };
  segs.forEach((s, i) => {
    cur += s.segment;
    // 「ぶっ」「かけ」のように促音（っ・ッ）で終わる語は、次の語と離さない
    if (s.isWordLike && !/[っッ]$/.test(s.segment)) flush();
    else if (!s.isWordLike) flush();
    else if (i === segs.length - 1) flush();
  });
  flush();
  return out.join('');
}

const GROUND = '#f6f2ea';
const RATIO = 1280 / 670; // note の見出し画像の比率

const BAND_RATIO = 0.26; // 帯の高さ（全体の高さに対する割合）
const TOP_RATIO = 0.05; // 写真の上の余白（全体の高さに対する割合）
const MIN_PHOTO_WIDTH = 0.65; // 写真が全体の幅のこの割合を切る日（正方形・縦長など）は、帯を付けず写真だけにする

/**
 * 写真の日の図の寸法（純粋関数）。写真（pw x ph）は原寸のまま置く。
 * 全体は note の比率（1280:670）。帯は全体の高さの約26%、写真の上の余白は約5%、残りの幅は左右の余白（写真は中央）。
 * 写真の幅が全体の65%を切るなら { photoOnly: true }（帯を付けず写真だけの見出し画像にする）。
 * 比率を保つので、左右の余白は上より広くなる（写真が横長でも、帯の分だけ縦が増えるため）。
 */
function photoGeometry(pw, ph) {
  const H = Math.round(ph / (1 - BAND_RATIO - TOP_RATIO));
  const W = Math.round(H * RATIO);
  const fraction = pw / W;
  if (fraction < MIN_PHOTO_WIDTH) return { photoOnly: true, fraction };
  const py = Math.round(H * TOP_RATIO);
  return { u: W / 1280, W, H, px: Math.floor((W - pw) / 2), py, pw, ph, bandTop: py + ph, bandH: H - py - ph, fraction };
}

/** 写真の日の図: 地の上に、写真（原寸・無加工）と、その下の題と日付の帯。photoSrc は data: URI。字の大きさは全体の幅（u = 幅/1280）に比例 */
function photoHtml(title, date, photoSrc, g, size) {
  const u = g.u;
  return `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0}
  .c{width:${g.W}px;height:${g.H}px;position:relative;overflow:hidden;background:${GROUND}}
  .c img{position:absolute;left:${g.px}px;top:${g.py}px;width:${g.pw}px;height:${g.ph}px;display:block}
  .band{position:absolute;left:0;top:${g.bandTop}px;width:${g.W}px;height:${g.bandH}px;color:#241c10}
  h1{position:absolute;left:${56 * u}px;right:${56 * u}px;top:${10 * u}px;margin:0;font:700 ${size * u}px/1.36 "Hiragino Mincho ProN","Yu Mincho",serif;letter-spacing:.02em;line-break:strict;word-break:auto-phrase}
  .f{position:absolute;left:${56 * u}px;right:${56 * u}px;bottom:${10 * u}px;display:flex;justify-content:space-between;align-items:baseline;font:${31 * u}px "Hiragino Sans","Yu Gothic",sans-serif;color:#5d4a2a}
  .k{font-size:${28 * u}px;font-weight:600;letter-spacing:.18em;color:#7b5a12}
  </style><div class="c"><img src="${photoSrc}"><div class="band"><h1>${titleHtml(title)}</h1><div class="f"><span>${esc(date)} ／ 名古屋の飲食店ジャーナル</span><span class="k">NAGOYA BITES JOURNAL</span></div></div></div>`;
}

/**
 * 見出し画像の検査（K4・2026-11-13・純粋関数）。画面上の位置（px）を受け取り、問題の説明の配列を返す（空なら合格）。
 * 題（h1）が上のラベルや下のフッターに重ならず、キャンバスからはみ出していないこと。
 */
function inspectEyecatchBoxes({ canvas, label, title, footer }) {
  const p = [];
  if (!title) return ['題が描かれていない'];
  if (title.top < canvas.top || title.bottom > canvas.bottom || title.left < canvas.left || title.right > canvas.right) p.push('題がキャンバスからはみ出す');
  if (label && title.top < label.bottom) p.push('題が上のラベルに重なる');
  if (footer && title.bottom > footer.top) p.push('題が下のフッターに重なる');
  return p;
}

/** ページ上の位置を測って検査する。不合格なら例外（呼び出し側は見出し画像なしで続ける） */
async function assertEyecatchClean(page, opts = {}) {
  const boxes = await page.evaluate((opts) => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
    const c = document.querySelector('.c');
    const rng = document.createRange(); rng.selectNodeContents(document.querySelector('h1'));
    const t = rng.getBoundingClientRect();
    // 折り返した行（文字ごとの位置から行に分ける）
    const lines = []; let lastTop = null;
    const walker = document.createTreeWalker(document.querySelector('h1'), NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (let i = 0; i < node.length; i++) {
        const q = document.createRange(); q.setStart(node, i); q.setEnd(node, i + 1);
        const b = q.getBoundingClientRect(); if (!b.width) continue;
        if (lastTop === null || Math.abs(b.top - lastTop) > 4) { lines.push(''); lastTop = b.top; }
        lines[lines.length - 1] += node.data[i];
      }
    }
    return { canvas: opts.band ? r('.band') : { top: 0, left: 0, right: c.clientWidth, bottom: c.clientHeight }, label: opts.band ? null : r('.k'), title: { top: t.top, bottom: t.bottom, left: t.left, right: t.right }, footer: r('.f'), lines };
  }, { band: !!opts.band });
  const problems = inspectEyecatchBoxes(boxes);
  if (opts.title) problems.push(...findWordBreaks(boxes.lines, opts.title));
  if (opts.maxLines && boxes.lines.length > opts.maxLines) problems.push(`題が${opts.maxLines}行に収まらない`);
  if (problems.length) throw new Error('見出し画像の検査に不合格: ' + problems.join(' / '));
}

/** 題と日付から PNG を作ってパスを返す。browser を渡すと、その中に新しいタブを開いて描く（同じプロファイルで二重に起動しない）。 */
async function makeEyecatch(title, date, outPath, browser) {
  const out = outPath || path.join(os.tmpdir(), `nb-note-eyecatch-${date}.png`);
  const own = !browser;
  const br = browser || (await B.launch({ headless: true }));
  try {
    const page = await br.newPage();
    await page.setViewport({ width: 1280, height: 670 });
    await page.setContent(html(title, date));
    await assertEyecatchClean(page); // 重なり・はみ出しがあれば例外（post_note は見出し画像なしで続ける）
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1280, height: 670 } });
    await page.close();
  } finally { if (own) await br.close(); }
  return out;
}

/**
 * 写真の下に題と日付の帯を足した PNG を作ってパスを返す（写真の画素・フレームはそのまま。縮小・切り抜き・重ね描きなし）。
 * 題が語の途中で折れる・2行に収まらない・帯からはみ出す・日付に重なるときは字を小さくして試し（46→42→38）、
 * それでも合格しなければ例外（呼び出し側は写真そのままに落とす）。
 */
async function makePhotoEyecatch(photoPath, title, date, outPath, browser) {
  const out = outPath || path.join(os.tmpdir(), `nb-note-eyecatch-photo-${date}.png`);
  const mime = /\.png$/i.test(photoPath) ? 'image/png' : 'image/jpeg';
  const src = `data:${mime};base64,${fs.readFileSync(photoPath).toString('base64')}`;
  const own = !browser;
  const br = browser || (await B.launch({ headless: true }));
  try {
    const page = await br.newPage();
    await page.setViewport({ width: 1280, height: 670, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><img id="p" src="${src}">`);
    const dim = await page.evaluate(() => { const i = document.getElementById('p'); return { w: i.naturalWidth, h: i.naturalHeight }; });
    if (!dim.w || !dim.h) throw new Error('写真の大きさが読めない');
    const g = photoGeometry(dim.w, dim.h);
    if (g.photoOnly) { await page.close(); return photoPath; } // 写真が小さく見える日は、帯を付けず写真だけ（呼び出し側は返り値が元の写真なら何もしない）
    await page.setViewport({ width: g.W, height: g.H, deviceScaleFactor: 1 });
    let lastErr = null;
    for (const size of [34, 32, 30]) {
      await page.setContent(photoHtml(title, date, src, g, size));
      try { await assertEyecatchClean(page, { title, maxLines: 2, band: true }); lastErr = null; break; } catch (e) { lastErr = e; }
    }
    if (lastErr) throw lastErr;
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: g.W, height: g.H } });
    await page.close();
  } finally { if (own) await br.close(); }
  return out;
}

module.exports = { makePhotoEyecatch, photoHtml, photoGeometry, makeEyecatch, inspectEyecatchBoxes, html, downloadPhoto, photoUrl };
