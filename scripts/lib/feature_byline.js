'use strict';
/**
 * 特集の「公開日・更新日・書き手」の部品（SEO-145）。
 *
 * 日付の正本は記事の JSON-LD（datePublished・dateModified）だけにする。画面の日付はこの部品1つに
 * まとめ、meta 行に手で書かれていた日付（「2026.05.14 更新」「公開 2026年5月8日」「最終更新 2026年8月」
 * など）は消す。手書きの日付は JSON-LD と食い違ったまま残っていた（例: 画面「2026-05-22 公開」・
 * JSON-LD 2026-05-14）。「2026年版」のような版の表記と、公開・更新の語が付かない催しの日付
 * （母の日特集の「2026年5月10日」）は日付の主張ではないので残す。
 *
 * 生成器（scripts/gen_industry_features.js）と一括適用（scripts/apply_feature_byline.js）が
 * この1本を共有する。冪等（何度当てても同じ結果）。部品の見た目は assets/css/nb.css の .nb-byline。
 */

const START = '<!-- NB_BYLINE_START -->';
const END = '<!-- NB_BYLINE_END -->';
const AUTHOR_PAGE = 'editorial-policy.html';
const AUTHOR_NAME = 'NAGOYA BITES 編集部';
const AUTHOR_NOTE = '（現役の飲食店マネージャー）';
// h1 の後ろでこの文字数以内にある meta 行だけを、その記事の meta 行として扱う
const META_SEARCH_WINDOW = 1500;

const DATE = '\\d{4}(?:\\s*年\\s*\\d{1,2}\\s*月(?:\\s*\\d{1,2}\\s*日?)?|[./-]\\d{1,2}[./-]\\d{1,2})';
const MARK = '(?:最終更新|更新|公開|初版)';
const DATED_SEGMENT = new RegExp(`^(?:${MARK}\\s*[:：]?\\s*${DATE}|${DATE}\\s*${MARK})$`);
const DATED_PREFIX = new RegExp(`^${DATE}\\s*${MARK}\\s*[—–-]+\\s*`);
const AUTHOR_SEGMENT = /^(?:編集\s*[:：]\s*)?NAGOYA BITES\s*編集部$/;
const META_ROW = /(\n[ \t]*)?(<(div|p) class="(?:art-meta|hero-meta)"[^>]*>)([\s\S]*?)(<\/\3>)/;

function plainText(html) {
  return String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 公開・更新の語が付いた日付か、書き手の名前だけの区切りか（部品と重なるので消す対象） */
function isRedundantSegment(text) {
  const t = plainText(text);
  return DATED_SEGMENT.test(t) || AUTHOR_SEGMENT.test(t);
}

/** JSON-LD の datePublished（最も古い値）と dateModified（最も新しい値）。datePublished が無ければ null */
function readJsonLdDates(html) {
  let published = '';
  let modified = '';
  const blocks = String(html).matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g);
  for (const [, body] of blocks) {
    for (const [, key, value] of body.matchAll(/"date(Published|Modified)"\s*:\s*"(\d{4}-\d{2}-\d{2})/g)) {
      if (key === 'Published') { if (!published || value < published) published = value; }
      else if (!modified || value > modified) modified = value;
    }
  }
  if (!published) return null;
  if (!modified || modified < published) modified = published;
  return { published, modified };
}

function formatJa(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

function renderByline(dates, { selfFile = '', end = false } = {}) {
  const parts = [`<span>公開 <time datetime="${dates.published}">${formatJa(dates.published)}</time></span>`];
  if (dates.modified > dates.published) {
    parts.push(`<span>更新 <time datetime="${dates.modified}">${formatJa(dates.modified)}</time></span>`);
  }
  const name = selfFile === AUTHOR_PAGE ? AUTHOR_NAME : `<a href="${AUTHOR_PAGE}">${AUTHOR_NAME}</a>`;
  parts.push(`<span>執筆 ${name}<span class="nb-byline-note">${AUTHOR_NOTE}</span></span>`);
  return `${START}<p class="nb-byline${end ? ' nb-byline--end' : ''}">${parts.join('')}</p>${END}`;
}

/** meta 行の中身から、部品と重なる日付・書き手を除く。何も残らなければ '' */
function cleanMetaInner(inner) {
  if (/<span\b/.test(inner)) {
    const kept = inner.replace(/\s*<span\b[^>]*>([\s\S]*?)<\/span>/g, (all, text) => (isRedundantSegment(text) ? '' : all));
    return /<span\b/.test(kept) ? kept : '';
  }
  const lead = inner.match(/^\s*/)[0];
  const trail = inner.match(/\s*$/)[0];
  const segments = inner.trim().split(/\s*[｜|]\s*/)
    .filter(seg => !isRedundantSegment(seg))
    .map(seg => seg.replace(DATED_PREFIX, ''))
    .filter(seg => plainText(seg) !== '');
  return segments.length ? lead + segments.join(' ｜ ') + trail : '';
}

/**
 * 記事 HTML に部品を当てる。JSON-LD に datePublished が無いページ（一覧・相談窓口）と
 * h1 が無いページはそのまま返す。
 */
function applyByline(html, { selfFile = '' } = {}) {
  const dates = readJsonLdDates(html);
  const h1End = html.indexOf('</h1>');
  if (!dates || h1End < 0) return html;

  let out = html;
  const hasBlock = out.includes(START) && out.includes(END);

  // 1. meta 行から、部品と重なる日付・書き手を除く（行が空になれば行ごと除く）
  const tail = out.slice(h1End);
  const meta = tail.match(META_ROW);
  let metaRemains = false;
  if (meta && meta.index <= META_SEARCH_WINDOW) {
    const [whole, indent = '', open, , inner, close] = meta;
    const cleaned = cleanMetaInner(inner);
    const at = h1End + meta.index;
    let replacement;
    if (cleaned === '') {
      replacement = hasBlock ? '' : indent + START + END;
    } else {
      metaRemains = true;
      const row = open + cleaned + close;
      replacement = hasBlock ? indent + row : indent + START + END + indent + row;
    }
    out = out.slice(0, at) + replacement + out.slice(at + whole.length);
  } else if (!hasBlock) {
    const indent = (out.slice(0, h1End).match(/\n([ \t]*)[^\n]*$/) || [, ''])[1];
    out = out.slice(0, h1End + 5) + '\n' + indent + START + END + out.slice(h1End + 5);
  }

  // 2. 部品を書き直す（部品の直後に meta 行が残るときは間を詰める）
  const s = out.indexOf(START);
  const e = out.indexOf(END, s) + END.length;
  if (hasBlock) metaRemains = /^\s*<(?:div|p) class="(?:art-meta|hero-meta)"/.test(out.slice(e));
  return out.slice(0, s) + renderByline(dates, { selfFile, end: !metaRemains }) + out.slice(e);
}

module.exports = {
  START, END, AUTHOR_PAGE,
  readJsonLdDates, formatJa, renderByline, cleanMetaInner, isRedundantSegment, applyByline,
};
