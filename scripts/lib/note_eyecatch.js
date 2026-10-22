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

module.exports = { makeEyecatch, html };
