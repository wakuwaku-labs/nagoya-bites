'use strict';

/**
 * scripts/lib/ig_post_policy.js
 *
 * 「その Instagram 投稿を店舗カードに埋め込んでよいか」の判定器の正本。
 * 基準そのものは data/ig_post_policy.json（唯一の情報源）。ここは実装だけを持つ。
 *
 * ── 何を判定するか ───────────────────────────────────────────
 * 所有者検証（その投稿がその店を写しているか）は scripts/audit_reel_ownership.js の担当。
 * ここが見るのは内容の関連性だけ ＝ 消費者から見て「店の料理・内装・外観がわかるか」。
 *
 * ── 判定に使う事実（CLAUDE.md 制約10）────────────────────────
 * 公開 embed から取れるキャプション本文のみ。誰でも同じ URL を開いて検算できる。
 * score / 話題度のような、誰も検算できない自己申告値は使わない。
 *
 * ── 中核: ハッシュタグを採点対象から外す ─────────────────────
 * 飲食店の投稿はほぼ全てが #焼肉 #名古屋グルメ 等で終わる。旧ロジックはこれを
 * 料理語として加点していたため、求人・休業案内・御礼投稿まで料理投稿として通っていた
 * （ISSUE-092）。飾りではなく本文の記述だけを根拠にする。
 */

const fs   = require('fs');
const path = require('path');

const POLICY_PATH = path.resolve(__dirname, '..', '..', 'data', 'ig_post_policy.json');

let _policy = null;
function loadPolicy() {
  if (!_policy) _policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
  return _policy;
}

/**
 * 店名は本文から除いてから採点する。
 * 例:「昭和焼肉ホルえもん名駅本店をご愛顧いただき…」は 1周年の御礼投稿だが、
 * 店名に含まれる「焼肉」が料理語として数えられ、料理の紹介投稿に見えてしまう。
 * 店名は毎回書かれる定型で「何を写したか」の情報を持たないので、飾りとして落とす。
 */
function stripStoreName(text, storeName) {
  if (!storeName) return text;
  const src = String(text || '');
  const full = String(storeName).replace(/[\s　]+/g, '');
  if (!full) return src;

  // 表記ゆれ（空白の有無・カタカナ/ひらがな）を吸収して照合する。
  // 例: 登録名「鮮魚とおばんざい浜金 池下店」/ 投稿「鮮魚とおばんざい浜金池下店です」
  //     登録名「焼肉ほるえもん」/ 投稿「焼肉ホルえもん」
  // 素の文字列一致だと剥がれず、店名由来の「鮮魚」「焼肉」が料理語に化ける。
  const kana = c => (c >= 'ァ' && c <= 'ヶ') ? String.fromCharCode(c.charCodeAt(0) - 0x60) : c;

  // 正規化文字列と、その各文字が元文字列のどの位置だったかの対応表を同時に作る
  let norm = '';
  const pos = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (/[\s　]/.test(c)) continue;      // 空白は畳む
    norm += kana(c);
    pos.push(i);
  }
  const normName = [...full].map(kana).join('');
  if (!normName) return src;

  // 正規化上で見つけた区間を、元文字列の区間に戻して落とす
  const cuts = [];
  let cursor = 0, idx;
  while ((idx = norm.indexOf(normName, cursor)) !== -1) {
    cuts.push([pos[idx], pos[idx + normName.length - 1] + 1]);
    cursor = idx + normName.length;
  }
  if (!cuts.length) return src;

  let res = '', prev = 0;
  for (const [a, b] of cuts) { res += src.slice(prev, a) + ' '; prev = b; }
  return res + src.slice(prev);
}

/**
 * キャプションを「本文」だけに削ぎ落とす。
 * ハッシュタグ・@メンション・URL・絵文字・記号列は判定材料にしない。
 */
function captionBody(caption, storeName) {
  return stripStoreName(String(caption || ''), storeName)
    .replace(/[#＃][^\s#＃]+/g, ' ')          // ハッシュタグ（飾り。採点対象外）
    .replace(/[@＠][A-Za-z0-9._]+/g, ' ')     // メンション
    .replace(/https?:\/\/\S+/g, ' ')          // URL
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ') // 絵文字
    .replace(/[・．。、,.\-—―ｰ_=+*<>|\\/【】\[\]（）()「」『』"'`~^｡､･:;!?！？♪☆★●○◆◇■□▲△▼▽※\u{1CC00}-\u{1CEFF}\u{10000}-\u{1007F}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 本文の実質文字数（かな・漢字・英数のみ数える） */
function bodyLength(body) {
  return (String(body || '').match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9]/gu) || []).length;
}

/**
 * 語のリストと本文を照合する。
 * `re:` で始まる要素は正規表現として扱う（「7選」のように数字が変わる形を書けるようにするため。
 * これも基準の一部なので JSON 側に置き、実装には埋めない）。
 */
function matchAny(haystack, list) {
  const raw = String(haystack || '');
  const h = raw.toLowerCase();
  const out = [];
  for (const w of (list || [])) {
    const s = String(w);
    if (s.startsWith('re:')) {
      const m = raw.match(new RegExp(s.slice(3)));
      if (m) out.push(m[0]);
    } else if (h.includes(s.toLowerCase())) {
      out.push(s);
    }
  }
  return out;
}

/**
 * 投稿1件を判定する。
 * @param {object} evidence  { caption, error } — fetch_ig_post_evidence.js が保存した証跡
 * @param {object} [opts]    { storeName } — 与えると店名を採点対象から外す
 * @returns {{verdict:string, ok:boolean, reason:string, matched:object, body:string}}
 */
function judgePost(evidence, opts) {
  const P = loadPolicy();

  // ① 証跡が無い＝検証できない。取り繕わず載せない
  if (!evidence) {
    return { verdict: 'NO_EVIDENCE', ok: false, reason: '本文を未回収（検証不能）', matched: {}, body: '' };
  }
  if (evidence.error) {
    if (evidence.error === 'removed') {
      return { verdict: 'REJECT_REMOVED', ok: false, reason: '投稿が削除済み（埋め込みが壊れて表示される）', matched: {}, body: '' };
    }
    return { verdict: 'NO_EVIDENCE', ok: false, reason: `本文を取得できず（${evidence.error}）`, matched: {}, body: '' };
  }

  const body = captionBody(evidence.caption, opts && opts.storeName);
  const len  = bodyLength(body);

  // ② 本文が実質ハッシュタグだけ → 何を写した投稿か検証できない
  if (len < P.thresholds.minBodyChars) {
    return {
      verdict: 'REJECT_HASHTAG_ONLY', ok: false,
      reason: `本文が実質${len}字（ハッシュタグのみ）で内容を検証できない`,
      matched: {}, body
    };
  }

  // 「何のための投稿か」は冒頭で宣言される。末尾にはアカウントの署名代わりの定型文
  // （「スタッフ募集中」「フォローして」「ご予約お待ちしております」）がほぼ必ず付くため、
  // 全文を見ると主題が料理の投稿までその定型文で落ちる。以降の目的判定は lead だけを見る。
  const lead = body.slice(0, P.thresholds.subject_lead_chars || body.length);

  // ③ ハードブロック: 投稿の目的が「店の中身を見せること」ではないもの。
  //    カテゴリは data/ig_post_policy.json の hard_block を総なめする（＝カテゴリを
  //    足すときに JSON だけ直せばよく、この実装を触らなくて済む）。
  for (const [key, words] of Object.entries(P.hard_block)) {
    if (key.startsWith('_') || !Array.isArray(words)) continue;
    const hit = matchAny(lead, words);
    if (hit.length) {
      return {
        verdict: 'REJECT_' + key.toUpperCase(), ok: false,
        reason: `${key}: 「${hit.join('」「')}」`, matched: { hard: hit }, body
      };
    }
  }

  // ③' 組み合わせブロック: 単独の語では誤判定するため、複数条件の同時成立を要求する規則。
  //     （例: 「グランドオープン」単独では自店の開店告知＋料理紹介まで落ちるので、
  //      愛知県外の地名と同時に出たときだけ「他の土地の店の告知」と判断する）
  for (const [key, rule] of Object.entries(P.combination_block || {})) {
    if (key.startsWith('_') || !rule || !Array.isArray(rule.all_of)) continue;
    const hits = rule.all_of.map(list => matchAny(lead, list));
    // none_of は「本文のどこかに1つでもあれば、この規則を適用しない」打ち消し条件。
    // 例: 他地域の地名が出ていても、本文に「名古屋」「愛知」があるなら
    //     それは仕入れ先や食材の産地の話（「富山産ホタルイカ入荷しております。愛知県名古屋市…」）で、
    //     他地域の店を紹介した投稿ではない
    if (Array.isArray(rule.none_of) && matchAny(body, rule.none_of).length) continue;
    if (hits.every(h => h.length)) {
      return {
        verdict: rule.verdict || ('REJECT_' + key.toUpperCase()), ok: false,
        reason: `${key}: ${hits.map(h => `「${h.join('」「')}」`).join(' + ')}`,
        matched: { combination: hits }, body
      };
    }
  }

  // ④ 内容の positive 判定（本文にのみ現れたもの）
  const dish     = matchAny(body, P.positive.strong_dish);
  const interior = matchAny(body, P.positive.strong_interior);
  const weak     = matchAny(body, P.positive.weak);
  const strongN  = dish.length + interior.length;
  const matched  = { dish, interior, weak };

  if (strongN === 0) {
    return {
      verdict: 'REJECT_NO_SUBJECT', ok: false,
      reason: '本文に料理・内装・外観の記述が無い',
      matched, body
    };
  }

  // ⑤ ソフトブロック: 挨拶・御礼・キャンペーンが主目的の投稿。
  //    ただし具体的な料理・内装の説明が伴う場合（strong が閾値以上）は実際にそれを
  //    見せている投稿なので通す（正直な良い投稿を巻き込まないための逃げ道）。
  const softHits = [];
  for (const key of ['greeting', 'gratitude', 'campaign']) {
    const hit = matchAny(lead, P.soft_block[key]);
    if (hit.length) softHits.push(`${key}: 「${hit.join('」「')}」`);
  }
  if (softHits.length && strongN < P.soft_block.requires_strong) {
    return {
      verdict: 'REJECT_ANNOUNCEMENT', ok: false,
      reason: `告知・挨拶が主目的（${softHits.join(' / ')}）で具体的な料理・内装の説明が不足（strong=${strongN}）`,
      matched, body
    };
  }

  return {
    verdict: 'PASS', ok: true,
    reason: `料理語=${dish.length}（${dish.slice(0, 4).join('/')}）内装語=${interior.length}（${interior.slice(0, 3).join('/')}）`,
    matched, body
  };
}

// ── 証跡ストア（data/ig_post_evidence.json・shortcode をキーに持つ）──────────
const EVIDENCE_PATH = path.resolve(__dirname, '..', '..', 'data', 'ig_post_evidence.json');

let _evidence = null;
function loadEvidence() {
  if (!_evidence) {
    try { _evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8')); }
    catch { _evidence = {}; }
  }
  return _evidence;
}

function shortcodeOf(postUrl) {
  const m = String(postUrl || '').match(/instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * 投稿URLから直接判定する（呼び出し側の共通口）。
 * build.js も監査スクリプトもこれを使うので、判定が二重化しない。
 */
function judgeUrl(postUrl, opts) {
  const code = shortcodeOf(postUrl);
  if (!code) return { verdict: 'NO_EVIDENCE', ok: false, reason: '投稿URLとして解釈できない', matched: {}, body: '' };
  const store = (opts && opts.evidence) || loadEvidence();
  return judgePost(store[code], opts);
}

module.exports = {
  judgePost, judgeUrl, captionBody, bodyLength, stripStoreName,
  loadPolicy, loadEvidence, shortcodeOf, POLICY_PATH, EVIDENCE_PATH
};
