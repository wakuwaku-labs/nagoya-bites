'use strict';
/**
 * 記事の事実台帳と、出典との機械照合の部品（S4-1・記録だけ）。
 * 計画: docs/plans/media-policy-2026-11/03-implementation-plan.md 1-2・S4-1。
 *
 * 検証できる事実だけで判定する（CLAUDE.md 制約10）:
 *   - 本文の数字・日付・価格が、機械が取り直した出典の本文にあるか
 *   - 出典が「予定・見込み」と書いているのに、記事が言い切っていないか
 *   - 出典・店舗データが「閉店」と言っている店を、営業中として載せていないか
 *   - 行っていない店を行ったように書いていないか（brand_policy と同じ判定）
 * 自己申告値（点数など）は使わない。表記の正規化は X の検査（x_post.js）のものを使い回す。
 *
 * 公開リポジトリに第三者のページ全文は置かない。残すのは URL・取得日・短い引用（最大120字）・全文のハッシュだけ。
 * 全文は .local-logs/claims-cache/ に置く（gitignore 対象）。
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const X = require('./x_post');
const { brandFindings } = require('./brand_policy');

const ROOT = path.resolve(__dirname, '..', '..');
const QUOTE_MAX = 120;

/** 引用と本文を突き合わせるための形（空白を除き、全角を半角に、桁区切りを外す）。x_post と同じ。 */
function compact(s) {
  return X.normalizeDigits(String(s || '').normalize('NFKC')).replace(/\s+/g, '');
}

/** 照合用の読みやすい形（NFKC・桁区切り除去・空白を1つに）。 */
function normText(s) {
  return X.normalizeDigits(String(s || '').normalize('NFKC')).replace(/\s+/g, ' ').trim();
}

// ── 記事からの取り出し ────────────────────────────────────────────────
function pick(html, re) {
  const m = String(html || '').match(re);
  return m ? X.htmlToText(m[1]).trim() : '';
}

/** 記事の題・説明・冒頭（柱になる事実の判定に使う）。 */
function articleHeads(html) {
  const title = pick(html, /<title>([\s\S]*?)<\/title>/i).replace(/｜NAGOYA BITES.*$/, '');
  const h1 = pick(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const desc = (String(html).match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || '';
  const lead = pick(html, /<p class="art-lead">([\s\S]*?)<\/p>/i);
  return { title, h1, description: X.htmlToText(desc).trim(), lead };
}

/** 出典欄（.source-note）の外部リンク。 */
function extractSources(html) {
  const m = String(html || '').match(/<div class="source-note">([\s\S]*?)<\/div>/);
  if (!m) return [];
  const out = [];
  const seen = new Set();
  const re = /<a\s[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>(?:\s*<span class="source-date">[（(]?([^<）)]*?)(?:掲載)?[）)]?<\/span>)?/g;
  for (const a of m[1].matchAll(re)) {
    const url = a[1].replace(/&amp;/g, '&');
    if (/(^|\.)nagoya-bites\.com/.test(new URL(url).hostname) || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, label: X.htmlToText(a[2]).trim(), date: (a[3] || '').trim() || null, type: sourceType(url) });
  }
  return out;
}

/** 出典の種類（台帳の source.type）。 */
function sourceType(url) {
  let h = '';
  try { h = new URL(url).hostname; } catch (_) { return '不明'; }
  if (/hotpepper\.jp|tabelog\.com|retty\.me|hitosara\.com|gnavi\.co\.jp/.test(h)) return '掲載サイト';
  if (/google\.[a-z.]+|maps\./.test(h)) return '地図';
  if (/prtimes\.jp|atpress|value-press/.test(h)) return '報道用の発表';
  if (/tsr-net|nikkei|asahi|yomiuri|mainichi|chunichi|nhk|itmedia|impress/.test(h)) return '報道';
  return '公式・その他';
}

/** 記事の本文（題〜出典欄の前）の読める文字。出典欄・写真の出典・店カードのボタンは含めない。 */
function articleBodyText(html) {
  let s = String(html || '');
  const a = s.search(/<h1[^>]*class="art-title"/);
  if (a >= 0) s = s.slice(a);
  const b = s.search(/<!-- NB_X_FOLLOW_START -->|<\/article>/);
  if (b >= 0) s = s.slice(0, b);
  s = s
    .replace(/<div class="source-note">[\s\S]*?<\/div>/g, ' ')
    .replace(/<figcaption[\s\S]*?<\/figcaption>/g, ' ')
    .replace(/<div class="store-cta-row">[\s\S]*?<\/div>/g, ' ')
    .replace(/<\/(p|li|h[1-6]|div|tr|figure)>/gi, '。</$1>')
    .replace(/<br\s*\/?>/gi, '。');
  return X.htmlToText(s).replace(/。\s*。+/g, '。');
}

/** 本文を文に分ける。 */
function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[。！？!?])\s*/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 8);
}

// ── 数字・日付の取り出し ─────────────────────────────────────────────
/**
 * 文の中の照合対象。日付（◯月◯日）は1つの札にし、4桁の年・「第◯」などは対象にしない。
 * 返り値は { raw, key, kind: 'date'|'num' } の配列。
 */
function claimTokens(sentence) {
  let s = normText(sentence);
  const out = [];
  // 「◯月◯日時点」「◯月◯日の投稿」は、記事が自分で確かめた日・出典の更新日を指す（出典の本文に無くてよい）
  s = s.replace(/(?:\d{4}年)?\d{1,2}月\d{1,2}日(?=の?(?:時点|現在|版|投稿|告知|発表|付け|更新|掲載|に出し|に公開|取得))/g, ' ');
  s = s.replace(/(\d{1,2})月(\d{1,2})日/g, (_, m, d) => {
    out.push({ raw: `${m}月${d}日`, key: `${Number(m)}/${Number(d)}`, kind: 'date' });
    return ' ';
  });
  s = s.replace(/(\d{1,2})月(?!\d)/g, (_, m) => {
    out.push({ raw: `${m}月`, key: `${Number(m)}/`, kind: 'month' });
    return ' ';
  });
  s = s.replace(/\d{4}年\d{0,2}月?\d{0,2}日?/g, ' ').replace(/\d{4}-\d{2}-\d{2}/g, ' ');
  for (const m of s.matchAll(/\d+(?:\.\d+)?/g)) out.push({ raw: m[0], key: m[0], kind: 'num' });
  return out;
}

/** その札が出典の本文にあるか。 */
function tokenInText(tok, text) {
  const t = normText(text);
  if (tok.kind === 'date') {
    const [m, d] = tok.key.split('/');
    return new RegExp(`(^|[^\\d])0?${m}\\s*月\\s*0?${d}\\s*日|(^|[^\\d])0?${m}\\s*[/.／]\\s*0?${d}($|[^\\d])`).test(t);
  }
  if (tok.kind === 'month') {
    const m = tok.key.split('/')[0];
    return new RegExp(`(^|[^\\d])0?${m}\\s*月|(^|[^\\d])0?${m}\\s*[/.／]\\s*\\d`).test(t);
  }
  return new RegExp(`(^|[^\\d.])${tok.key.replace('.', '\\.')}($|[^\\d])`).test(t);
}

/** 札を出典の本文から探す正規表現（日付は「◯月◯日」「◯/◯」、数字は桁の境界つき）。 */
function tokenRegex(tok) {
  if (tok.kind === 'date') {
    const [m, d] = tok.key.split('/');
    return new RegExp(`()0?${m}\\s*月\\s*0?${d}\\s*日|()0?${m}\\s*[/.／]\\s*0?${d}(?!\\d)`);
  }
  if (tok.kind === 'month') return new RegExp(`()0?${tok.key.split('/')[0]}\\s*月`);
  return new RegExp(`(^|[^\\d.])${tok.key.replace('.', '\\.')}(?=$|[^\\d])`);
}

/** 記事の文に近い出典の箇所（最大120字）。見つからなければ ''。 */
function quoteAround(tok, text) {
  const t = normText(text);
  const m = tokenRegex(tok).exec(t);
  if (!m) return '';
  const at = m.index + (m[1] ? m[1].length : 0);
  const from = Math.max(0, at - 50);
  return t.slice(from, from + QUOTE_MAX).trim();
}

// ── 分類 ──────────────────────────────────────────────────────────────
const HEDGE_RE = /予定|見込|予想|とみられ|と見られ|らしい|可能性|かもしれ|未定|目安|推定|とされ|ようだ|思われ|そうだ|検討|未確認|変更になる場合/;
// 出典側の「予定・見込み」。「場合があります」のような定型の注意書きは含めない（どのページにもあり、誤検知になる）
const HEDGE_SRC_RE = /予定です|予定。|予定\)|を予定|予定の|見込み|見込ま|予想され|とみられ|と見られ|らしい|未定|検討中/;
const ANALYSIS_RE = /計算|換算|合計|あたり|割ると|割り|ずつ|倍|差額|差は|増え|減[るり]|比べ|比較|なら[ばは]?、|おおよそ|概算|当サイト|このサイト|NAGOYA BITES|掲載店|掲載している|編集部|整理|まとめ/;
const REVIEW_RE = /口コミ|評価|★|レビュー|クチコミ/;
const SPECULATIVE_RE = /未確認|確認できていません|確かめていません/;

function classify(sentence) {
  if (SPECULATIVE_RE.test(sentence)) return '未確認';
  if (REVIEW_RE.test(sentence)) return '口コミの数字';
  if (ANALYSIS_RE.test(sentence)) return '編集部の分析';
  return '確認済みの事実';
}

/** 本文から事実の文を取り出す（数字・日付・価格を含む文）。 */
function extractClaimSentences(html) {
  const out = [];
  const seen = new Set();
  for (const s of splitSentences(articleBodyText(html))) {
    if (!/[0-9０-９]/.test(s)) continue;
    if (claimTokens(s).length === 0) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

// ── 店舗データ（サイト内の事実）────────────────────────────────────────
let storesCache = null;
function loadStores(root = ROOT) {
  if (storesCache && storesCache.root === root) return storesCache.map;
  const map = new Map();
  try {
    const list = JSON.parse(fs.readFileSync(path.join(root, 'data', 'stores.json'), 'utf8'));
    for (const s of Array.isArray(list) ? list : list.stores || []) if (s['店舗ID']) map.set(String(s['店舗ID']), s);
  } catch (_) { /* 無くても照合は続ける */ }
  storesCache = { root, map };
  return map;
}

/** 記事が載せている店の ID（店カードのリンク ../stores/<id>.html から）。 */
function articleStoreIds(html) {
  return [...new Set([...String(html || '').matchAll(/\.\.\/stores\/([A-Za-z0-9_-]+)\.html/g)].map((m) => m[1]))];
}

/** 店舗データを「出典の1つ」として読める文にする（長い自由記述は除く）。 */
function storeDataText(stores) {
  const keys = ['店名', '価格帯', 'アクセス', '住所', 'Google評価', '口コミ数', 'ジャンル', 'エリア'];
  return stores.map((s) => keys.filter((k) => s[k] !== undefined && s[k] !== null && s[k] !== '').map((k) => `${k}:${s[k]}`).join(' ')).join('\n');
}

// ── 出典の取得 ────────────────────────────────────────────────────────
function cacheDir(root = ROOT) { return path.join(root, '.local-logs', 'claims-cache'); }

/** 実ページの取得。返り値は { ok, status, text, reason }。text は読める文字（全文）。 */
async function fetchSourceLive(url, { timeoutMs = 15000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; NagoyaBitesClaimsCheck/1.0; +https://nagoya-bites.com/)', 'accept-language': 'ja' },
    });
    if (!res.ok) return { ok: false, status: res.status, reason: `http_${res.status}`, text: '' };
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || '';
    let cs = (ct.match(/charset=([\w-]+)/i) || [])[1];
    if (!cs) cs = (buf.slice(0, 2048).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html;
    try { html = new TextDecoder(cs).decode(buf); } catch (_) { html = buf.toString('utf8'); }
    const text = X.htmlToText(html);
    if (text.replace(/\s/g, '').length < 80) return { ok: false, status: res.status, reason: 'empty_body', text: '' };
    return { ok: true, status: res.status, text, bytes: buf.length };
  } catch (e) {
    return { ok: false, status: 0, reason: e.name === 'AbortError' ? 'timeout' : `error:${(e.cause && e.cause.code) || e.code || e.message}`, text: '' };
  } finally {
    clearTimeout(timer);
  }
}

/** 札のすぐ後ろ（同じ文の中の16字まで）。出典の「予定です」「見込み」がその数字にかかっているかを見る。 */
function hedgeWindow(tok, text) {
  const t = normText(text);
  const m = tokenRegex(tok).exec(t);
  if (!m) return '';
  const at = m.index + (m[1] ? m[1].length : 0);
  const endAt = t.indexOf('。', at);
  const to = Math.min(endAt < 0 ? t.length : endAt, at + tok.raw.length + 16);
  return t.slice(at, to);
}

// 計算で導ける数字（合計・差・割り算・掛け算）。前後の文の数字から作れるものは出典に無くてよい。
const ARITH_CUE_RE = /足|合計|総額|差額|安い|高い|あたり|ずつ|倍|換算|概算|掛け|割る|割り|×|÷|＋|増し|収ま|当たる|最低でも|引く|人分|席時間|開ければ|ぶん/;

function derivedFrom(tok, neighbors) {
  if (tok.kind !== 'num') return false;
  const v = Number(tok.key);
  if (!Number.isFinite(v)) return false;
  const base = [...new Set(neighbors.filter((n) => Number.isFinite(n) && n !== v && n > 0))].slice(0, 12);
  const near = (a, b, rel) => Math.abs(a - b) <= Math.max(rel * Math.abs(b), 0.0001);
  // 部分和（4個まで）
  const sums = [0];
  const walk = (i, depth, acc) => {
    if (depth > 0 && near(acc, v, 0)) sums.push(acc);
    if (depth >= 4) return;
    for (let j = i; j < base.length; j++) walk(j + 1, depth + 1, acc + base[j]);
  };
  walk(0, 0, 0);
  if (sums.length > 1) return true;
  for (let i = 0; i < base.length; i++) {
    for (let j = 0; j < base.length; j++) {
      if (i === j) continue;
      const a = base[i];
      const b = base[j];
      if (near(a * b, v, 0) || near(a - b, v, 0) || near(a / b, v, 0.006) || near(a / b, v, 0) || near(Math.round(a / b), v, 0)) return true;
    }
  }
  return false;
}

// ── 照合 ──────────────────────────────────────────────────────────────
/** 札の直前の言葉（「グラスワイン」「飲み放題」など、何の数字かを示す2〜8字）。無ければ ''。 */
function contextWord(sentence, tok) {
  const s = normText(sentence);
  const re = tok.kind === 'date' ? new RegExp(tok.raw) : new RegExp(`(^|[^\\d.])${tok.raw.replace('.', '\\.')}(?=$|[^\\d])`);
  const m = re.exec(s);
  if (!m) return '';
  const before = s.slice(0, m.index + (m[1] ? m[1].length : 0));
  const run = (before.match(/[一-龥ぁ-んァ-ヶーa-zA-Z]+[\s]*$/) || [''])[0].replace(/\s+$/, '').replace(/(は|が|の|を|で|に|も|と|へ|や|から|まで|なら|だと|では)$/, '');
  return run.slice(-8);
}

/** 札の直後の単位（円・席・分・品・人・%）。無ければ ''。 */
function unitAfter(sentence, tok) {
  const s = normText(sentence);
  const re = tok.kind === 'date' ? new RegExp(tok.raw) : new RegExp(`(^|[^\\d.])${tok.raw.replace('.', '\\.')}(?=$|[^\\d])`);
  const m = re.exec(s);
  if (!m) return '';
  const after = s.slice(m.index + (m[1] ? m[1].length : 0) + tok.raw.length, m.index + (m[1] ? m[1].length : 0) + tok.raw.length + 2);
  return (after.match(/^(円|席|分|品|人|%|種|個|枚|本|時間|時|名|店|卓|室|回|日)/) || [''])[0];
}

/** 出典の中で、同じ言葉（ctx）のすぐ後ろにある、同じ単位の数字・日付。 */
function numbersAfterContext(ctx, tok, text, unit = '') {
  if (ctx.length < 3) return [];
  const t = normText(text);
  const esc = ctx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out = [];
  const body = tok.kind === 'date' ? '(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*日' : `(\\d+(?:\\.\\d+)?)(?=\\s*${unit || '(?:円|席|分|品|人|%|種|個|枚|本|時間|時|名|店|卓|室|回|日)'})`;
  const re = new RegExp(`${esc}[^。\\d]{0,8}${body}`, 'g');
  let m;
  while ((m = re.exec(t)) && out.length < 6) out.push(tok.kind === 'date' ? `${Number(m[1])}/${Number(m[2])}` : m[1]);
  return out;
}

/**
 * 事実の文1つを、取得できた出典（pool: [{url, text, ok}]）と照らす。
 * 返り値: { status, source_url, evidence_quote, missing:[], unknown:[], hedge_dropped }
 *   status: 照合できた／取得できず照合不能／食い違い
 * 「食い違い」は、出典に同じ項目（直前の言葉が同じ）があり、数字が違うときだけ。
 * 出典に同じ項目が見つからない数字は「照合不能」（計算・言い換え・取得できなかった出典の可能性を捨てない）。
 */
function checkClaim(sentence, pool, kind) {
  const toks = claimTokens(sentence);
  const live = pool.filter((p) => p.ok && p.text);
  if (!live.length) return { status: '取得できず照合不能', source_url: null, evidence_quote: '', missing: [], unknown: [], hedge_dropped: false };

  let best = null;
  for (const p of live) {
    const miss = toks.filter((t) => !tokenInText(t, p.text));
    if (!best || miss.length < best.miss.length) best = { p, miss };
  }
  const missAll = toks.filter((t) => !live.some((p) => tokenInText(t, p.text)));

  if (kind === '編集部の分析') {
    const anyHit = toks.some((t) => live.some((p) => tokenInText(t, p.text)));
    return { status: anyHit ? '照合できた' : '取得できず照合不能', source_url: anyHit ? best.p.url : null, evidence_quote: anyHit ? quoteAround(toks.find((t) => tokenInText(t, best.p.text)) || toks[0], best.p.text) : '', missing: [], unknown: [], hedge_dropped: false, note: '分析の文（計算・まとめ）は食い違いにしない' };
  }

  if (missAll.length) {
    const contradicted = [];
    const unknown = [];
    for (const t of missAll) {
      const ctx = contextWord(sentence, t);
      const found = new Set();
      const unit = unitAfter(sentence, t);
      for (const p of live) numbersAfterContext(ctx, t, p.text, unit).forEach((x) => found.add(x));
      if (found.size && found.size <= 2 && !found.has(t.key)) contradicted.push({ tok: t, ctx, found: [...found] });
      else unknown.push(t);
    }
    if (contradicted.length) {
      return { status: '食い違い', source_url: best.p.url, evidence_quote: '', missing: contradicted.map((c) => c.tok.raw), contradictions: contradicted.map((c) => `${c.ctx}: 記事 ${c.tok.raw} ／ 出典 ${c.found.join('・')}`), unknown: unknown.map((t) => t.raw), hedge_dropped: false };
    }
    return { status: '取得できず照合不能', source_url: null, evidence_quote: '', missing: [], unknown: unknown.map((t) => t.raw), hedge_dropped: false, note: '出典に同じ項目の数字が見つからない' };
  }
  const src = best.miss.length === 0 ? best.p : live.find((p) => toks.some((t) => tokenInText(t, p.text))) || best.p;
  const first = toks.find((t) => tokenInText(t, src.text)) || toks[0];
  const quote = quoteAround(first, src.text);
  // 出典は予定・見込みと書いているのに、記事は言い切っていないか（その数字のすぐ後ろ）
  let hedgeDropped = false;
  if (!HEDGE_RE.test(sentence) && quote) {
    for (const t of toks) {
      // 1〜2桁の数字は他の数字の一部（◯月5日の5 など）と取り違えやすいので、予定の判定には使わない
      if (t.kind === 'num' && t.key.length < 3) continue;
      const w = hedgeWindow(t, src.text);
      if (w && HEDGE_SRC_RE.test(w)) { hedgeDropped = true; break; }
    }
  }
  return { status: '照合できた', source_url: src.url, evidence_quote: quote, missing: [], unknown: [], hedge_dropped: hedgeDropped };
}

/** 次に見直す日（YYYY-MM-DD）。価格は90日、期間のある文は文中の最後の日付の翌日、それ以外は180日。 */
function recheckAfter(sentence, baseDate) {
  const d = new Date(`${baseDate}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return null;
  const add = (n) => new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
  const dates = [...normText(sentence).matchAll(/(\d{1,2})月(\d{1,2})日/g)];
  if (dates.length && /まで|限定|期間|終了|締切|〜|~/.test(sentence)) {
    const last = dates[dates.length - 1];
    const y = d.getUTCFullYear();
    let c = new Date(Date.UTC(y, Number(last[1]) - 1, Number(last[2])));
    if (c.getTime() < d.getTime() - 30 * 86400000) c = new Date(Date.UTC(y + 1, Number(last[1]) - 1, Number(last[2])));
    return new Date(c.getTime() + 86400000).toISOString().slice(0, 10);
  }
  if (/円/.test(sentence)) return add(90);
  return add(180);
}

const CLOSED_SRC_RE = /閉店しました|閉店いたしました|閉店のお知らせ|閉店となり|閉業しました|閉業いたし|営業を終了|掲載を終了|閉店致し/;
const ARTICLE_CLOSED_RE = /閉店|閉業|営業終了|休業|移転/;

/**
 * 記事全体の問題（文単位でない検査）。
 *   store_closed / source_says_closed / visit_claim
 */
function articleIssues(html, { pool, stores, bodyText }) {
  const issues = [];
  for (const s of stores) {
    const st = String(s['営業ステータス'] || '');
    if (/^CLOSED/.test(st) && !ARTICLE_CLOSED_RE.test(bodyText)) {
      issues.push({ type: 'store_closed', severity: 'core', detail: `店舗データの営業ステータスが ${st}: ${s['店名']}` });
    }
  }
  for (const p of pool.filter((x) => x.ok && x.text)) {
    const t = normText(p.text);
    for (const st of stores) {
      const nm = normText(String(st['店名'] || '')).replace(/\s*(名駅.*店|.*店)$/, '').slice(0, 12);
      if (nm.length < 3) continue;
      let at = t.indexOf(nm);
      while (at >= 0) {
        const near = t.slice(Math.max(0, at - 40), at + nm.length + 60);
        const m = CLOSED_SRC_RE.exec(near);
        if (m && !ARTICLE_CLOSED_RE.test(bodyText)) {
          issues.push({ type: 'source_says_closed', severity: 'core', detail: `出典が店の閉店を示す記述（「${m[0]}」）: ${p.url}` });
          at = -1;
        } else at = t.indexOf(nm, at + nm.length);
      }
    }
  }
  const b = brandFindings(bodyText, { surface: 'article' });
  const visit = b.fail.filter((f) => f.id === 'visit');
  for (const f of visit) issues.push({ type: 'visit_claim', severity: 'core', detail: `行ったように見せる言い方: ${f.words.join('・')}` });
  const extra = bodyText.match(/(実際に|編集部が|筆者が|私が|わたしが)[^。]{0,12}(訪れ|伺っ|食べ|行っ|試し|注文し)|食べてみた|行ってみた|訪問したところ|伺ったところ/g);
  if (extra && !visit.length) issues.push({ type: 'visit_claim', severity: 'core', detail: `行ったように見せる言い方: ${[...new Set(extra)].join('・')}` });
  return issues;
}

/**
 * 記事1本の照合。pool は取得済みの出典（{url,label,type,date,ok,text,...}）。
 * 返り値: { claims, issues, summary }
 */
function verifyArticle(html, { date, pool, root = ROOT, ledger = null, storesMap = null }) {
  const heads = articleHeads(html);
  const titleToks = new Set(claimTokens(`${heads.title} ${heads.h1}`).map((t) => t.key));
  const bodyText = articleBodyText(html);
  const ids = articleStoreIds(html);
  const sdata = storesMap || loadStores(root);
  const stores = ids.map((id) => sdata.get(id)).filter(Boolean);
  const sitePool = stores.length ? [{ url: 'site:data/stores.json', ok: true, text: storeDataText(stores), label: '店舗データ（サイト内）', type: '掲載サイト' }] : [];
  const all = [...pool, ...sitePool];

  const sentences = ledger && Array.isArray(ledger.claims) && ledger.claims.length
    ? ledger.claims.map((c) => ({ text: String(c.text || ''), kind: c.kind || null }))
    : extractClaimSentences(html).map((t) => ({ text: t, kind: null }));

  const claims = [];
  const fetchedAt = new Date().toISOString();
  for (const sc of sentences) {
    if (!sc.text) continue;
    const kind = sc.kind || classify(sc.text);
    let r;
    if (kind === '未確認') r = { status: '取得できず照合不能', source_url: null, evidence_quote: '', missing: [], hedge_dropped: false, note: '記事自身が未確認と書いている文' };
    else if (kind === '口コミの数字') {
      // 口コミの数字はサイト内の店舗データ（Google 評価・件数）と照らす。本文は保存しない
      r = checkClaim(sc.text, all.filter((p) => p.url.startsWith('site:')), kind);
      if (r.status === '食い違い') r = { ...r, status: '取得できず照合不能', missing: [], note: '口コミの数字は店舗データに無い（算出日が違う可能性）。食い違いにはしない' };
    } else r = checkClaim(sc.text, all, kind);
    const toks = claimTokens(sc.text);
    if (r.status === '食い違い') {
      // 計算で導ける数字（前後の文の数字の合計・差・割り算）は、計算の文として扱う
      const idx = sentences.indexOf(sc);
      const neigh = [];
      for (let k = Math.max(0, idx - 3); k <= Math.min(sentences.length - 1, idx + 3); k++) {
        for (const t of claimTokens(sentences[k].text)) if (t.kind === 'num' && !r.missing.includes(t.raw)) neigh.push(Number(t.key));
      }
      const still = toks.filter((t) => r.missing.includes(t.raw) && !(ARITH_CUE_RE.test(sc.text) && derivedFrom(t, neigh)));
      if (!still.length) r = { ...r, status: '照合できた', missing: [], note: '計算で導ける数字（前後の文の数字の合計・差など）' };
      else r = { ...r, missing: still.map((t) => t.raw) };
    }
    const pillar = !ARITH_CUE_RE.test(sc.text) && toks.some((t) => titleToks.has(t.key) && (t.kind === 'date' || t.key.length >= 3));
    const src = all.find((p) => p.url === r.source_url) || null;
    claims.push({
      text: sc.text,
      kind,
      source: src ? { url: src.url, publisher: src.label || '', type: src.type || sourceType(src.url), date: src.date || null } : null,
      evidence_quote: r.evidence_quote,
      fetched_at: src && src.fetched_at ? src.fetched_at : (src ? fetchedAt : null),
      confirmed_at: date,
      status: r.status,
      recheck_after: recheckAfter(sc.text, date),
      rights: src && src.url.startsWith('site:') ? 'サイト内データ' : '引用（短い抜粋のみ）',
      pillar,
      ...(r.missing.length ? { missing: r.missing } : {}),
      ...(r.contradictions && r.status === '食い違い' ? { contradictions: r.contradictions } : {}),
      ...(r.unknown && r.unknown.length ? { unknown: r.unknown } : {}),
      ...(r.hedge_dropped ? { hedge_dropped: true } : {}),
      ...(r.note ? { note: r.note } : {}),
    });
  }

  const issues = articleIssues(html, { pool, stores, bodyText });
  // 出典がすべて取得できているのに、題の事実が照合できない／事実の半分以上が出典に見つからない（出典の取り違え）
  const allFetched = pool.length > 0 && pool.every((p) => p.ok);
  if (allFetched) {
    const elig = claims.filter((c) => c.kind === '確認済みの事実');
    const okN = elig.filter((c) => c.status === '照合できた').length;
    if (elig.length >= 6 && okN / elig.length < 0.5) issues.push({ type: 'sources_do_not_support', severity: 'core', detail: `出典はすべて取得できたが、事実の文 ${elig.length} 件のうち出典で確かめられたのは ${okN} 件（半分未満）` });
  }
  for (const c of claims) {
    if (c.status === '食い違い') issues.push({ type: 'number_mismatch', severity: 'core', detail: `出典の同じ項目と数字が違う（${(c.contradictions || []).join(' ／ ')}）: ${c.text.slice(0, 60)}` });
    if (c.hedge_dropped) issues.push({ type: 'hedge_dropped', severity: 'core', detail: `出典は予定・見込みの書き方なのに記事は言い切り: ${c.text.slice(0, 60)}` });
    if (allFetched && c.status === '取得できず照合不能' && c.pillar && c.kind === '確認済みの事実') issues.push({ type: 'pillar_unverifiable', severity: 'core', detail: `題にある事実が照合できない: ${c.text.slice(0, 60)}` });
  }
  const count = (s) => claims.filter((c) => c.status === s).length;
  return {
    claims,
    issues,
    summary: {
      claims: claims.length,
      verified: count('照合できた'),
      unverifiable: count('取得できず照合不能'),
      mismatch: count('食い違い'),
      stale: count('古い'),
      hedge_dropped: claims.filter((c) => c.hedge_dropped).length,
      issues: issues.length,
      core_issues: issues.filter((i) => i.severity === 'core').length,
    },
  };
}

function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

module.exports = {
  ROOT, QUOTE_MAX, compact, normText, articleHeads, extractSources, sourceType, articleBodyText, splitSentences,
  claimTokens, tokenInText, quoteAround, contextWord, unitAfter, numbersAfterContext, classify, extractClaimSentences, loadStores, articleStoreIds, storeDataText,
  cacheDir, fetchSourceLive, checkClaim, derivedFrom, recheckAfter, articleIssues, verifyArticle, sha256,
};
