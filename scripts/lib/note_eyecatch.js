'use strict';
/**
 * note の見出し画像（アイキャッチ）の素材を用意する（docs/decisions/0056）。
 * - 記事に載せた店の実物写真（規約で note に上げてよい出どころだけ。note_draft.js の articlePhoto が選ぶ）は、
 *   そのまま取ってくる（downloadPhoto）。写真を全面に敷き、下部の暗い影に題と日付を白で重ねた図を作る
 *   （makePhotoEyecatch・2026-11-13 本人の指示「写真に重ねて」・docs/decisions/0065-note-eyecatch-overlay-on-photo.md。0064 の帯の形を置き換えた）。
 *   写真は比率合わせの切り抜きだけで、色は変えない。重ねてよいのは PR TIMES の報道目的のリリース写真だけ
 *   （ホットペッパー・Google の写真は規約で加工・複製を禁じているので、そもそも使わない）。
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

/** 題と日付を重ねてよい写真か（ADR 0065）。PR TIMES の報道目的のリリース写真（配信元のホスト）だけ。それ以外は重ねず写真だけにする */
const OVERLAY_HOSTS = ['prcdn.freetls.fastly.net', 'prtimes.jp'];
function overlayAllowed(src) {
  try { const h = new URL(src).hostname; return OVERLAY_HOSTS.some((d) => h === d || h.endsWith('.' + d)); } catch { return false; }
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
function titleHtml(title, breakAfter = -1) {
  if (breakAfter > 0 && breakAfter < title.length) return titleHtml(title.slice(0, breakAfter)) + '<br>' + titleHtml(title.slice(breakAfter).replace(/^\s+/, ''));
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

const RATIO = 1280 / 670; // note の見出し画像の比率

const MIN_KEEP = 0.5; // 比率合わせで残す写真の割合（短い辺の向き）がこれを切る日（縦長など）は、写真だけにする
const MIN_SRC_WIDTH = 640; // 切り抜いた後の写真の幅がこれ未満（2倍超に引き伸ばす）なら、写真だけにする
const TITLE_SIZES = [48, 44, 40]; // 題の字の大きさ（px・1280幅）。大きい順に試す

/**
 * 写真の日の図の寸法（純粋関数・ADR 0065）。写真（pw x ph）を全面（1280x670）に敷く。
 * 比率合わせの切り抜き（中央）だけを行う。keep = 写真の残る割合（横長なら左右、縦長なら上下を切る）。
 * 残る割合が50%を切る（縦長・正方形より細い）か、切り抜いた写真の幅が640px 未満（ぼやける）なら { photoOnly: true }。
 */
function photoGeometry(pw, ph) {
  const r = pw / ph;
  const keep = r >= RATIO ? RATIO / r : r / RATIO;
  const srcW = r >= RATIO ? ph * RATIO : pw; // 切り抜いた後の写真の幅（元の画素）
  if (keep < MIN_KEEP || srcW < MIN_SRC_WIDTH) return { photoOnly: true, keep, srcW };
  return { W: 1280, H: 670, keep, srcW };
}

/**
 * 写真の日の図（ADR 0065・2026-11-13 本人の指示「写真に重ねて」・見本は AI組織設計 design/brands/choices/03-b.png）:
 * 写真を全面に敷き（比率合わせの切り抜きだけ・色は変えない）、上と下に暗い影を重ね、
 * 上に「NAGOYA BITES JOURNAL」、下に題（明朝）と日付を白で載せる。影の無い中ほど（22〜45%）は写真の画素のまま。photoSrc は data: URI。
 */
/** 題を2行に分けるなら読点「、」の後で折りたい（「バターの／いとこ」のような商品名の途中を避ける）。真ん中にいちばん近い「、」の直後の位置（無ければ -1） */
function commaBreak(title) {
  let best = -1; const mid = title.length / 2;
  for (let i = title.indexOf('、'); i >= 0; i = title.indexOf('、', i + 1)) if (i + 1 < title.length && (best < 0 || Math.abs(i + 1 - mid) < Math.abs(best - mid))) best = i + 1;
  return best;
}

function photoHtml(title, date, photoSrc, size, breakAfter = -1) {
  return `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0}
  .c{width:1280px;height:670px;position:relative;overflow:hidden;background:#000}
  .c img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}
  .sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.42) 0,rgba(0,0,0,0) 22%,rgba(0,0,0,0) 45%,rgba(0,0,0,.55) 65%,rgba(0,0,0,.8) 100%)}
  .k{position:absolute;left:56px;top:44px;font:600 28px "Hiragino Sans","Yu Gothic",sans-serif;letter-spacing:.18em;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.45)}
  h1{position:absolute;left:56px;right:56px;bottom:96px;margin:0;font:700 ${size}px/1.38 "Hiragino Mincho ProN","Yu Mincho",serif;color:#fff;letter-spacing:.02em;line-break:strict;word-break:auto-phrase;text-shadow:0 2px 10px rgba(0,0,0,.45)}
  .f{position:absolute;left:56px;bottom:42px;font:26px "Hiragino Sans","Yu Gothic",sans-serif;color:#eee;text-shadow:0 1px 6px rgba(0,0,0,.45)}
  </style><div class="c"><img src="${photoSrc}"><div class="sh"></div><div class="k">NAGOYA BITES JOURNAL</div><h1>${titleHtml(title, breakAfter)}</h1><div class="f">${esc(date)} ／ 名古屋の飲食店ジャーナル</div></div>`;
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
  for (const [name, b] of [['ラベル', label], ['日付', footer]]) {
    if (b && b.left !== undefined && (b.top < canvas.top || b.bottom > canvas.bottom || b.left < canvas.left || b.right > canvas.right)) p.push(`${name}がキャンバスからはみ出す`);
  }
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
    return { canvas: { top: 0, left: 0, right: c.clientWidth, bottom: c.clientHeight }, label: r('.k'), title: { top: t.top, bottom: t.bottom, left: t.left, right: t.right }, footer: r('.f'), lines };
  }, {});
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
 * 写真を全面に敷き、影の上に題と日付を重ねた PNG を作ってパスを返す（ADR 0065。写真は比率合わせの切り抜きだけで、色は変えない）。
 * 写真が縦長・小さすぎる日は何も作らず写真そのもの（photoPath）を返す（呼び出し側は写真だけを使う）。
 * 題が語の途中で折れる・2行に収まらない・はみ出す・ラベルや日付に重なるときは字を小さくして試し（48→44→40）、
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
    if (g.photoOnly) { await page.close(); return photoPath; } // 縦長・小さすぎる写真の日は、重ねず写真だけ
    let lastErr = null;
    const comma = commaBreak(title);
    const tries = TITLE_SIZES.flatMap((size) => (comma > 0 ? [[size, comma], [size, -1]] : [[size, -1]])); // 同じ大きさで「、」の後で折る形を先に試す
    for (const [size, brk] of tries) {
      await page.setContent(photoHtml(title, date, src, size, brk));
      await page.evaluate(() => document.fonts && document.fonts.ready);
      try { await assertEyecatchClean(page, { title, maxLines: 2 }); lastErr = null; break; } catch (e) { lastErr = e; }
    }
    if (lastErr) throw lastErr;
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1280, height: 670 } });
    await page.close();
  } finally { if (own) await br.close(); }
  return out;
}

module.exports = { commaBreak, titleHtml, overlayAllowed, makePhotoEyecatch, photoHtml, photoGeometry, makeEyecatch, inspectEyecatchBoxes, html, downloadPhoto, photoUrl };
