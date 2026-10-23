'use strict';
/**
 * note の見出し画像（アイキャッチ）を、記事の題から自前で作る（1280x670 PNG）。
 * 他者の写真（ホットペッパー等）は複製・再配信できないので使わない。題・日付・ブランド名だけの図なので権利の問題がない。
 * 書体は端末にあるものだけを指す（CLAUDE.md 制約12 の方針に合わせる）。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const B = require('./note_browser');

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** assets/note-eyecatch の写真から、日付で決まる1枚を選ぶ（同じ日は同じ写真）。写真が無ければ null（題だけの図に倒す）。 */
function pickPhoto(date) {
  const dir = path.join(__dirname, '..', '..', 'assets', 'note-eyecatch');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort(); } catch { /* 無ければ図に倒す */ }
  if (!files.length) return null;
  const n = Number(String(date).replace(/\D/g, '')) || 0;
  return path.join(dir, files[n % files.length]);
}

function html(title, date, photo) {
  const size = title.length > 44 ? 46 : title.length > 30 ? 54 : 62;
  if (!photo) return htmlPlain(title, date);
  const src = `data:image/${/png$/i.test(photo) ? 'png' : 'jpeg'};base64,${fs.readFileSync(photo).toString('base64')}`;
  return `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0}
  .c{width:1280px;height:670px;position:relative;overflow:hidden;background:#241c10 url(${src}) center 68%/cover no-repeat;
     font-family:"Hiragino Mincho ProN","Hiragino Sans","Yu Mincho",serif;color:#fff}
  .g{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(20,12,4,.45) 0,rgba(20,12,4,0) 28%,rgba(20,12,4,0) 42%,rgba(20,12,4,.88) 100%)}
  .k{position:absolute;left:56px;top:40px;font-family:"Hiragino Sans","Yu Gothic",sans-serif;font-size:26px;letter-spacing:.18em;font-weight:600;text-shadow:0 1px 6px rgba(0,0,0,.6)}
  h1{position:absolute;left:56px;right:56px;bottom:74px;margin:0;font-size:${size}px;line-height:1.36;font-weight:700;letter-spacing:.02em;text-shadow:0 2px 10px rgba(0,0,0,.55)}
  .f{position:absolute;left:56px;right:56px;bottom:28px;display:flex;justify-content:space-between;font-family:"Hiragino Sans","Yu Gothic",sans-serif;font-size:22px;color:rgba(255,255,255,.88)}
  </style><div class="c"><div class="g"></div><div class="k">NAGOYA BITES JOURNAL</div><h1>${esc(title)}</h1>
  <div class="f"><span>${esc(date)} ／ 名古屋の飲食店ジャーナル</span><span>※写真はイメージです</span></div></div>`;
}

function htmlPlain(title, date) {

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
    await page.setContent(html(title, date, pickPhoto(date)));
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1280, height: 670 } });
    await page.close();
  } finally { if (own) await br.close(); }
  return out;
}

module.exports = { makeEyecatch, html, pickPhoto };
