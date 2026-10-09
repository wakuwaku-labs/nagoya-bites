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

// ── 予約ボタンの回数（ISSUE-152）── .gas-deploy/Code.js に同じものを複製している。
// 変えるときは両方を直す（tests/reservation_exits.test.js が同じ結果になることを検査する）。
//
// 予約ボタンは <a href="https://…"> で、サイト共通の外部リンク計測（document の click を捕捉段階で拾う
// outbound_click・scripts/lib/ga_snippet.js）にも同じ1回が届く。「予約導線イベント＋予約サイトへの
// outbound_click」と足すと、ボタン1回を2回数える。ページ×リンク先ごとに大きい方を取ると、予約ボタン
// （両方に届く）と、ボタン以外の予約サイトへのリンク（outbound_click だけに届く。特集の店名リンクなど）を
// 1回ずつ数えられる。電話（cta_call_click）は外部リンクではないので入れない。
const RESERVE_LINK_EVENTS = ['cta_click', 'cta_reserve'];

// リンク先のホスト名 → 予約サイト（RESERVATION_DOMAINS の要素）。予約サイトでなければ null
function reservationSite(domain) {
  const d = String(domain || '').toLowerCase();
  for (let i = 0; i < RESERVATION_DOMAINS.length; i++) {
    if (d.indexOf(RESERVATION_DOMAINS[i]) !== -1) return RESERVATION_DOMAINS[i];
  }
  return null;
}

/**
 * @param {Array<{event:string, path:string, domain?:string, count:number|string}>} rows
 *   GA4 の pagePath × eventName × customEvent:link_domain（eventCount）の行
 * @returns {{ctaEvents:number, reservationOutbound:number, naiveSum:number, deduped:number, overlap:number,
 *   bySite:Array<{site:string, cta:number, outbound:number, deduped:number}>}}
 *   naiveSum は足し算（ISSUE-152 以前の数え方）、overlap は同じクリックを2回数えていた分（naiveSum − deduped）
 */
function dedupeReservationClicks(rows) {
  const pairs = {};
  let ctaEvents = 0;
  let reservationOutbound = 0;
  (rows || []).forEach(function (r) {
    const n = parseInt(r.count, 10) || 0;
    if (n <= 0) return;
    let site;
    const isOutbound = r.event === 'outbound_click';
    if (isOutbound) {
      site = reservationSite(r.domain);
      if (!site) return; // 予約サイト以外（マップ・Instagram 等）は数えない
      reservationOutbound += n;
    } else if (RESERVE_LINK_EVENTS.indexOf(r.event) !== -1) {
      const raw = String(r.domain || '').trim().toLowerCase();
      // link_domain の無い送信は ISSUE-149 以前のホットペッパーのボタン（channelOf と同じ扱い）
      site = (!raw || raw === '(not set)') ? 'hotpepper.jp' : (reservationSite(raw) || raw);
      ctaEvents += n;
    } else {
      return;
    }
    const key = String(r.path || '') + '\t' + site;
    if (!pairs[key]) pairs[key] = { site: site, cta: 0, outbound: 0 };
    if (isOutbound) pairs[key].outbound += n; else pairs[key].cta += n;
  });
  const bySite = {};
  let deduped = 0;
  Object.keys(pairs).forEach(function (k) {
    const p = pairs[k];
    const d = Math.max(p.cta, p.outbound);
    deduped += d;
    if (!bySite[p.site]) bySite[p.site] = { site: p.site, cta: 0, outbound: 0, deduped: 0 };
    bySite[p.site].cta += p.cta;
    bySite[p.site].outbound += p.outbound;
    bySite[p.site].deduped += d;
  });
  const naiveSum = ctaEvents + reservationOutbound;
  return {
    ctaEvents: ctaEvents,
    reservationOutbound: reservationOutbound,
    naiveSum: naiveSum,
    deduped: deduped,
    overlap: naiveSum - deduped,
    bySite: Object.keys(bySite).map(function (k) { return bySite[k]; })
      .sort(function (a, b) { return (b.deduped - a.deduped) || (a.site < b.site ? -1 : a.site > b.site ? 1 : 0); }),
  };
}
// ── ここまで（.gas-deploy/Code.js に複製）──

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
  RESERVE_LINK_EVENTS, reservationSite, dedupeReservationClicks,
};
