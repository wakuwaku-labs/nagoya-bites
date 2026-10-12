'use strict';

/**
 * scripts/lib/heading_levels.js — 見出しの階層（h1〜h6）が飛んでいないかの唯一の判定器（I-26f・U-78）
 *
 * 見出しを文書の順に見て、直前の見出しより 2 段以上深い見出しが出る所を「飛び」と数える
 * （例: h1 のすぐ後に h3、h2 のすぐ後に h4）。ページの最初の見出しが h1 でないときも飛びと数える。
 * 浅くなる方向（h3 → h2 など）は飛びではない。画面の読み上げ（見出しの一覧・見出し間の移動）が
 * 階層を頼りにするので、飛んでいると「この見出しの親が無い」状態になる。
 *
 * 判定は HTML の文字列だけで行う（実行も描画もしない）。script / style / コメント / template は見出しとして数えない。
 * 監査（scripts/audit_heading_levels.js）と単体テストが同じ判定を共有する。
 */

function stripNonContent(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<template\b[\s\S]*?<\/template>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function textOf(inner) {
  return String(inner || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** 文書の順の見出し一覧: [{ level, text }] */
function outline(html) {
  const body = stripNonContent(html);
  const out = [];
  for (const m of body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    out.push({ level: Number(m[1]), text: textOf(m[2]) });
  }
  return out;
}

/** 階層が飛ぶ所の一覧: [{ from, to, text }]（from=直前の見出しの段、0 はページの先頭） */
function findJumps(html) {
  const jumps = [];
  let prev = 0;
  for (const h of outline(html)) {
    if (prev === 0 ? h.level > 1 : h.level > prev + 1) jumps.push({ from: prev, to: h.level, text: h.text });
    prev = h.level;
  }
  return jumps;
}

module.exports = { stripNonContent, outline, findJumps };
