'use strict';
/**
 * scripts/lib/store_facts.js — 店舗ページの「基本情報」に足す行（I-14c・計画書 I-14）
 *
 * 背景: 店舗ページの基本情報は、エリア・住所・価格帯・営業時間・電話・アクセスだけだった。data/stores.json は
 * 定休日（4,239 店）・席数（4,205）・禁煙（4,239）・カード（3,550）・宴会の収容人数（3,252）・駐車場（1,235）も
 * 持っているのに、画面のどこにも出ていなかった。「行けるか」「使えるか」を決める手がかりなので、データがある
 * 項目だけ足す。
 *
 * 決めたこと:
 *   1. 出すのは data/stores.json の欄の事実だけ（制約10）。欄が空の項目は行ごと出さない。「不明」「なし」と書かない。
 *      「ある」としか持たない欄（カード可・駐車場）を、持たない店で「不可」「なし」にはしない。
 *   2. 値の意味は変えず、言い回しだけ整える（「日」→「日曜日」、「20」→「20席」、「あり ：4台」→「あり：4台」）。
 *   3. 定休日の欄は、宣伝・案内・日付つきの休業のような文章が混ざる（営業時間の変更の案内、「貸切や宴会も大歓迎」など）。
 *      曜日の並び・「なし」・「年中無休」・「不定休」として読めるものだけ出し、それ以外は出さない。文章を途中で切って
 *      出すことも、読めないまま載せることもしない（詳しくは予約・情報の確認先のページにある）。「不定休」で始まる文は、
 *      案内が続いても「不定休」とだけ出す（打ち消す文〔不定休はありません〕は出さない）。「年中無休」「無休」は、
 *      「年末年始を除く」のような例外が付くと意味が変わるので、例外つきは出さない。
 *   4. 駐車場の説明は、build.js の hpAvailability が 60 文字で切って stores.json に入れる。60 文字に達している店
 *      （2026-10-12 は 12 店。「…全幅2.1m車」のように文の途中で終わる）は、続きが切れているので「あり」だけを出す。
 *   5. 臨時休業（営業ステータス）はここでは出さない。stores.json に取得日の欄が無く（元の Places のキャッシュは
 *      店ごとに fetchedAt を持つが、build.js は business_status だけを写す）、数か月前の状態を日付なしで出すと
 *      どちらの向きにも誤解させるため。出すなら取得日を stores.json に通す変更と一緒に別に決める。
 *
 * 呼ぶ側（gen-store-pages.js）は basicFacts(store) の { schedule, facilities } を、営業時間の後・電話の後に並べる。
 * ここは HTML を作らない（エスケープは呼ぶ側）。
 */

const WEEKDAY = '[月火水木金土日]';
const NTH = '第?[1-5１-５]';
// 「（第３）」「（第２・第４）」
const NTH_PAREN = `（第[1-5１-５](?:[・、]${NTH})*）`;
const DAY_TOKEN = `(?:${WEEKDAY}(?:${NTH_PAREN})?|祝日|祝前日)`;
const DAY_LIST = new RegExp(`^${DAY_TOKEN}(?:、${DAY_TOKEN})*$`);
// 「なし」「無し」「無」「定休日なし」「定休日：なし」「定休日はございません！」
const NONE = /^(?:定休日)?[：:]?(?:は)?(?:なし|無し|無|ございません)[。！!]?$/;
// 「年中無休」「年中無休です。」「無休」
const ALL_YEAR = /^(?:年中)?無休(?:です)?[。！!]?$/;
// 「不定休」で始まるもの。「不定休です。」「不定休日あり」「※不定休」のほか、あとに案内（「お店の状況により営業時間が変更になる
// 場合があります」「年末年始は…」など）が続くものも「不定休」とだけ出す（案内を省いても言っていることは変わらない）。
// 「不定休はありません」「不定休ではなく」のように打ち消すものは出さない。
const IRREGULAR = /^※?不定休(?!日?[はも]?(?:ありませ|ございませ|な[しくい]|無[しくい]|ではあり|ではな|じゃな))/;

const clean = (raw) => String(raw == null ? '' : raw).trim();

/** build.js の hpAvailability が駐車場の説明を切る長さ。ここに達した文は途中で終わっている */
const SOURCE_CAP = 60;

/** 定休日。読めない文章は '' */
function closedDaysText(raw) {
  const v = clean(raw);
  if (!v) return '';
  // 「祝日」の「日」を曜日と取り違えないよう、祝日・祝前日を先に取る
  if (DAY_LIST.test(v)) return v.replace(/(祝前日|祝日)|([月火水木金土日])/g, (m, holiday, day) => holiday || day + '曜日');
  if (NONE.test(v)) return 'なし';
  if (ALL_YEAR.test(v)) return v.startsWith('年中') ? '年中無休' : '無休';
  if (IRREGULAR.test(v)) return '不定休';
  return '';
}

/** 席数「20」→「20席」 */
function seatsText(raw) {
  const v = clean(raw);
  return /^[1-9]\d{0,3}$/.test(v) ? `${v}席` : '';
}

/** 宴会の収容人数「30」→「30名」 */
function banquetText(raw) {
  const v = clean(raw);
  return /^[1-9]\d{0,3}$/.test(v) ? `${v}名` : '';
}

/** 禁煙・喫煙。データの言葉のまま（未確認は出さない） */
function smokingText(raw) {
  const v = clean(raw);
  return v === '全面禁煙' || v === '禁煙席なし' || v === '一部禁煙' ? v : '';
}

/** カード。データは「利用可」しか持たない */
function cardText(raw) {
  return clean(raw) === '利用可' ? '利用可' : '';
}

/** 駐車場「あり ：4台」→「あり：4台」。駐車場の説明は店が書いた文章なので、そのまま続ける（近隣のコインパーキングなど、
 *  店専用でない場合の但し書きを落とさない）。ただし切れている文（60 文字）は続けない */
function parkingText(raw) {
  const v = clean(raw);
  const m = v.match(/^(あり|なし)\s*(?:[：:]\s*([\s\S]*))?$/);
  if (!m) return '';
  if (v.length >= SOURCE_CAP) return m[1];
  const note = (m[2] || '').replace(/\s+/g, ' ').replace(/。+$/, '').trim();
  return note ? `${m[1]}：${note}` : m[1];
}

/**
 * 基本情報に足す行。{ schedule: [{label, value}], facilities: [{label, value}] }
 * schedule は営業時間の直後（定休日）、facilities は電話の直後に並べる。値が読めない・空の項目は入れない。
 */
function basicFacts(store) {
  const s = store || {};
  const row = (label, value) => (value ? [{ label, value }] : []);
  return {
    schedule: row('定休日', closedDaysText(s['定休日'])),
    facilities: [
      ...row('席数', seatsText(s['席数'])),
      ...row('宴会の収容人数', banquetText(s['宴会収容'])),
      ...row('禁煙・喫煙', smokingText(s['禁煙'])),
      ...row('カード', cardText(s['カード可'])),
      ...row('駐車場', parkingText(s['駐車場'])),
    ],
  };
}

module.exports = { basicFacts, closedDaysText, seatsText, banquetText, smokingText, cardText, parkingText, SOURCE_CAP };
