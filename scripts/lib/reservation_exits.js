'use strict';
/**
 * 予約送客の計測語彙と集計の唯一の情報源（ISSUE-149・2026-10-09）。
 *
 * 名古屋バイツは予約を自分で受けないため、「予約が成立した」事実は観測できない。
 * 自分たち側で正直に持てるのは次の2段だけで、この2つを混ぜずに数える
 * （判断の経緯は docs/decisions/0009-reservation-measurement-tiers.md・手順は docs/reservation-measurement.md）。
 *
 *   exits   … 予約送客。その店の予約導線（HotPepper の店舗ページ・食べログの店舗ページ・電話）を
 *             押した回数。GA4 のイベントとして第三者が検算できる事実（制約10）。
 *   reports … 予約申告。予約導線から戻ってきた人が「予約した／していない」を1タップで答えた数。
 *             お客様の自己申告なので「少なくともこれだけ予約された」という下限としてだけ扱う。
 *
 * 利用側: scripts/fetch_ga4_views.js（GA4 → data/store_referrals.json）、tests/reservation_exits.test.js。
 * サイト側の送信語彙（イベント名・パラメータ名）は下の EXIT_EVENTS / REPORT_EVENTS と一致させる。
 */

// 予約送客として数えるイベント。outbound_click は全外部リンクで自動発火し、
// 同じクリックが cta_click と二重に届くため、店舗別の集計には使わない。
const EXIT_EVENTS = ['cta_click', 'cta_reserve', 'cta_call_click'];
const REPORT_EVENTS = { reserve_report_yes: 'yes', reserve_report_no: 'no' };

const CHANNELS = ['hotpepper', 'tabelog', 'tel'];

// 「予約につながった」と数えるリンク先ドメイン（記事単位の outbound_click 集計でも使う）。
// 掲載店は Hot Pepper 未掲載の店も多く、hotpepper.jp だけを数えると予約導線の実力を過小評価する。
const RESERVATION_DOMAINS = [
  'hotpepper.jp',
  'tabelog.com',
  'tablecheck.com',
  'ebica.jp',
  'toreta.in',
  'opentable',
  'ikyu.com',
  'gurunavi.com',
  'retty.me',
];

function isReservationDomain(domain) {
  const d = String(domain || '');
  return RESERVATION_DOMAINS.some(x => d.includes(x));
}

// link_domain（サイトが送る値）→ 経路。
// link_domain が無い cta_click / cta_reserve は、ISSUE-149 以前の送信（当時はホットペッパーの
// ボタンにしか付いていなかった）なので hotpepper に寄せる。cta_call_click は常に電話。
function channelOf(eventName, linkDomain) {
  if (eventName === 'cta_call_click') return 'tel';
  const d = String(linkDomain || '').toLowerCase();
  if (!d || d === '(not set)') return 'hotpepper';
  if (d === 'tel') return 'tel';
  if (d.includes('hotpepper.jp')) return 'hotpepper';
  if (d.includes('tabelog.com')) return 'tabelog';
  return 'other';
}

function emptyExits() {
  return { hotpepper: 0, tabelog: 0, tel: 0, other: 0, total: 0 };
}

/**
 * GA4 の行を店舗別にまとめる純関数。
 * @param {Array<{event:string, store:string, domain?:string, count:number}>} rows
 * @returns {{totals:{exits:object, reports:{yes:number,no:number}}, unattributedExits:number, stores:Array}}
 *   店名が取れない行（ISSUE-149 以前の店舗ページは店名を送っていなかった）は unattributedExits に分ける。
 */
function aggregateStoreReferrals(rows) {
  const byStore = new Map();
  const totals = { exits: emptyExits(), reports: { yes: 0, no: 0 } };
  let unattributedExits = 0;
  const get = (name) => {
    if (!byStore.has(name)) byStore.set(name, { store_name: name, exits: emptyExits(), reports: { yes: 0, no: 0 } });
    return byStore.get(name);
  };
  for (const r of rows || []) {
    const n = parseInt(r.count, 10) || 0;
    if (n <= 0) continue;
    const store = String(r.store || '').trim();
    const named = store && store !== '(not set)';
    if (EXIT_EVENTS.includes(r.event)) {
      const ch = channelOf(r.event, r.domain);
      totals.exits[ch] += n;
      totals.exits.total += n;
      if (!named) { unattributedExits += n; continue; }
      const s = get(store);
      s.exits[ch] += n;
      s.exits.total += n;
    } else if (REPORT_EVENTS[r.event]) {
      const k = REPORT_EVENTS[r.event];
      totals.reports[k] += n;
      if (named) get(store).reports[k] += n;
    }
  }
  const stores = [...byStore.values()].sort((a, b) =>
    (b.exits.total - a.exits.total) || (b.reports.yes - a.reports.yes) || a.store_name.localeCompare(b.store_name, 'ja'));
  return { totals, unattributedExits, stores };
}

const DEFINITIONS = {
  exits: '予約送客: その店の予約導線（HotPepper・食べログの店舗ページ、電話）を押した回数。GA4 で検算できる事実',
  reports: '予約申告: 予約導線から戻った人が「予約した／していない」を答えた数。自己申告なので下限としてだけ使う',
  completed: '予約成立: 計測しない。名古屋バイツは予約を受けず、店側の導入もアフィリエイトも使わないため観測経路が無い（docs/decisions/0009）',
};

module.exports = {
  EXIT_EVENTS, REPORT_EVENTS, CHANNELS, RESERVATION_DOMAINS, DEFINITIONS,
  isReservationDomain, channelOf, aggregateStoreReferrals,
};
