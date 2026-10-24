'use strict';
/**
 * note の見出し画像（アイキャッチ）の素材を用意する（docs/decisions/0056）。
 * - 記事に載せた店の実物写真（規約で note に上げてよい出どころだけ。note_draft.js の articlePhoto が選ぶ）は、
 *   加工せずにそのまま取ってくる（downloadPhoto）。
 * - それが無い日は、記事の題と日付だけの図を作る（makeEyecatch・1280x670 PNG）。店と関係の無い写真は使わない
 *   （以前は共通の居酒屋の写真を毎日使い、別の店の記事にも同じ写真が出ていた・2026-10-24 オーナー指摘）。
 * 書体は端末にあるものだけを指す（CLAUDE.md 制約12 の方針に合わせる）。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./note_browser');

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

/** 題と日付から PNG を作ってパスを返す。browser を渡すと、その中に新しいタブを開いて描く（同じプロファイルで二重に起動しない）。 */
async function makeEyecatch(title, date, outPath, browser) {
  const out = outPath || path.join(os.tmpdir(), `nb-note-eyecatch-${date}.png`);
  const own = !browser;
  const br = browser || (await B.launch({ headless: true }));
  try {
    const page = await br.newPage();
    await page.setViewport({ width: 1280, height: 670 });
    await page.setContent(html(title, date));
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1280, height: 670 } });
    await page.close();
  } finally { if (own) await br.close(); }
  return out;
}

module.exports = { makeEyecatch, html, downloadPhoto, photoUrl };
