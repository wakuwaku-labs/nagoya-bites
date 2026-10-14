'use strict';
// I-22（P-402・判断の記録 0038）: 店のモーダルをクイックビュー（スマホは下から出るシート・PC は中央の窓）に置き換えた。
// 見るもの:
//   1. 本日の営業時間（nbTodayHours）: 営業時間の文字列から機械的に読めたときだけ出す。読めなければ null
//   2. 要点（nbQvFactsHtml）: Google 評価（出典名つき）・口コミ信頼度・最寄駅 徒歩N分（P-404: 別の駅の分数を付けない）
//   3. 前の店・次の店（nbQvRefreshPager / nbQvStep）: 一覧の並びの中だけ・端は押せない・履歴を足さない（modal_nav）
//   4. 後ろのページの inert と焦点の戻り（nbQvSetInert / nbQvRelease）
//   5. 配線（マークアップの id・行動バーの出し分け・計測の名前・閉じ方）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 関数を中括弧の対応で取り出す（文字列・正規表現の中の括弧は、このファイルの対象関数では対応が取れている前提）
function fn(name) {
  const start = INDEX.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' が無い');
  let depth = 0, i = INDEX.indexOf('{', start), j = i;
  for (; j < INDEX.length; j++) {
    const c = INDEX[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  return INDEX.slice(start, j + 1);
}
function varLine(name) {
  const m = INDEX.match(new RegExp('^var ' + name + ' = [^\\n]*;', 'm'));
  assert.ok(m, 'var ' + name + ' が無い');
  return m[0];
}

// ───────── 1. 本日の営業時間 ─────────
function loadToday() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fn('nbTodayClosedState') + '\n' + fn('nbTodayHours'), ctx);
  return ctx;
}
const WED = new Date(2026, 9, 14);   // 2026-10-14 水曜日
const SUN = new Date(2026, 9, 11);
const SAT = new Date(2026, 9, 17);
const H = (hours, closed) => ({ '営業時間': hours, '定休日': closed === undefined ? '' : closed });

test('本日の営業時間: 曜日つきの群のうち今日を含む群がちょうど 1 つのときだけ採り、L.O. の括弧は除く', () => {
  const c = loadToday();
  const lunchDinner = '月～金: 11:00～14:0017:30～21:00 （料理L.O. 20:30 ドリンクL.O. 20:30）土、日、祝日: 11:00～21:00 （料理L.O. 20:30）';
  assert.deepStrictEqual({ ...c.nbTodayHours(H(lunchDinner, '不定休'), WED) }, { kind: 'open', text: '営業時間 水曜 11:00〜14:00 / 17:30〜21:00（祝日は別）' }, '定休日が読めない店は「本日」と言い切らない');
  assert.strictEqual(c.nbTodayHours(H(lunchDinner, '月'), WED).text, '営業時間 水曜 11:00〜14:00 / 17:30〜21:00（祝日は別）', '祝日の別時間がある店は「本日」と断定しない');
  assert.strictEqual(c.nbTodayHours(H(lunchDinner, '月'), SUN).text, '本日 11:00〜21:00', '日曜は 土、日、祝日 の群');
  assert.strictEqual(c.nbTodayHours(H(lunchDinner, '月'), SAT).text, '本日 11:00〜21:00');
});

test('本日の営業時間: 定休日が今日なら「本日 定休日」', () => {
  const c = loadToday();
  assert.deepStrictEqual({ ...c.nbTodayHours(H('月～日: 17:00～23:00', '水'), WED) }, { kind: 'closed', text: '本日 定休日' });
  assert.deepStrictEqual({ ...c.nbTodayHours(H('17:00～23:00', '水、日'), SUN) }, { kind: 'closed', text: '本日 定休日' });
  assert.strictEqual(c.nbTodayHours(H('17:00～23:00', '水曜日'), WED).kind, 'closed');
  assert.strictEqual(c.nbTodayHours(H('17:00～23:00', '年中無休'), WED).text, '本日 17:00〜23:00', '年中無休は休みでないと言える');
});

test('本日の営業時間: 読めないものは null（誤った「営業中」「定休日」は出さない）', () => {
  const c = loadToday();
  assert.strictEqual(c.nbTodayHours(H('', '月'), WED), null, '営業時間が無い');
  assert.strictEqual(c.nbTodayHours({}, WED), null);
  assert.strictEqual(c.nbTodayHours(H('月～水: 11:00～21:00 水～金: 12:00～22:00'), WED), null, '今日を含む群が 2 つ');
  assert.strictEqual(c.nbTodayHours(H('月、火、木～日: 11:00～21:00'), WED), null, '今日を含む群が無い（休みと決めつけない）');
  assert.strictEqual(c.nbTodayHours(H('月～金: 11:00～21:00 ランチのみ土曜も営業'), WED), null, '読み残した文字がある');
  assert.strictEqual(c.nbTodayHours(H('11:00頃から深夜まで'), WED), null, '時刻帯が読めない');
  assert.strictEqual(c.nbTodayHours(H('11:00～12:00 13:00～14:00 15:00～16:00 17:00～18:00'), WED), null, '帯が 4 つ以上は読み間違いの疑い');
  assert.strictEqual(c.nbTodayHours(H('毎日 11:00～21:00'), WED), null, '曜日でない語が付いている');
});

test('本日の営業時間: 括弧つきの定休日・不定休は休みと決めつけず、時間だけを「営業時間」として出す', () => {
  const c = loadToday();
  assert.strictEqual(c.nbTodayClosedState({ '定休日': '水（第1・第3）' }, '水'), null, '括弧つきは全水曜が休みとは限らない');
  assert.strictEqual(c.nbTodayClosedState({ '定休日': '不定休' }, '水'), null);
  assert.strictEqual(c.nbTodayClosedState({ '定休日': '水～金' }, '水'), null, '範囲指定は読まない');
  assert.strictEqual(c.nbTodayClosedState({ '定休日': '' }, '水'), null);
  assert.strictEqual(c.nbTodayClosedState({ '定休日': '月・日' }, '水'), false);
  assert.strictEqual(c.nbTodayHours(H('17:00～23:00', '水（第1・第3）'), WED).text, '営業時間 17:00〜23:00');
  assert.strictEqual(c.nbTodayHours(H('17:00～23:00', ''), WED).text, '営業時間 17:00〜23:00', '定休日の記録が無い店は「本日」と言わない');
});

test('本日の営業時間: 翌日にまたぐ時刻・1 桁の時・別の区切りの文字を読み、祝日だけ別の群があれば添える', () => {
  const c = loadToday();
  assert.strictEqual(c.nbTodayHours(H('月～日: 18:00～翌5:00 （料理L.O. 翌4:00）', '月'), WED).text, '本日 18:00〜翌05:00');
  assert.strictEqual(c.nbTodayHours(H('9:30－18:00', '月'), WED).text, '本日 09:30〜18:00');
  assert.strictEqual(c.nbTodayHours(H('17:00–22:00', '月'), WED).text, '本日 17:00〜22:00', 'エヌダッシュ');
  assert.strictEqual(c.nbTodayHours(H('月～金: 11:00～21:00 祝日: 11:00～17:00', '日'), WED).text, '営業時間 水曜 11:00〜21:00（祝日は別）');
  assert.strictEqual(c.nbTodayHours(H('月～金、祝日: 11:00～21:00', '日'), WED).text, '本日 11:00〜21:00', '祝日が同じ群なら添えない');
  assert.strictEqual(c.nbTodayHours(H('月～金: 11:00～21:00 祝日: 11:00～21:00', '日'), WED).text, '本日 11:00〜21:00', '祝日の時間が同じなら添えない');
  assert.strictEqual(c.nbTodayHours(H('水曜日: 11:00～15:00', '日'), WED).text, '本日 11:00〜15:00', '曜日の「曜日」は読み飛ばす');
});

test('本日の営業時間（P-442）: 祝日の別時間がある店は、祝日（2026-10-12 月・祝）に平日の時刻を「本日」と断定しない', () => {
  const c = loadToday();
  const MON_HOLIDAY = new Date(2026, 9, 12);   // 2026-10-12 月曜・スポーツの日
  const r = H('月～金: 11:00～21:00 祝日: 11:00～17:00', '日');
  const t = c.nbTodayHours(r, MON_HOLIDAY).text;
  assert.strictEqual(t, '営業時間 月曜 11:00〜21:00（祝日は別）');
  assert.ok(!t.startsWith('本日'), '祝日かどうか確かめられない店は「本日」と書かない');
  // 実データ: 祝日の別時間を持つ店は、どの曜日でも「本日」を出さない
  const stores = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'stores.json'), 'utf8'));
  const list = Array.isArray(stores) ? stores : (stores.stores || []);
  let withHol = 0;
  for (const s of list) {
    if (!/祝日?\s*[:：]/.test(String(s['営業時間'] || ''))) continue;
    const res = c.nbTodayHours(s, MON_HOLIDAY);
    if (!res || res.kind !== 'open' || !/祝日は別/.test(res.text)) continue;
    withHol++;
    assert.ok(!res.text.startsWith('本日'), s['店名'] + ': ' + res.text);
  }
  if (list.length) assert.ok(withHol > 0, '実データに祝日の別時間を持つ店が見つからない（検査が空振り）');
});

// ───────── 2. 要点 ─────────
function loadFacts(trust) {
  const ctx = { TRUST_POLICY: trust === undefined ? null : trust };
  vm.createContext(ctx);
  vm.runInContext([fn('mEsc'), fn('mWalkFromAccess'), fn('nbStationKey'), fn('nbNearText'), fn('nbTodayClosedState'), fn('nbTodayHours'), fn('nbQvFactsHtml')].join('\n'), ctx);
  return ctx;
}
const POLICY = {
  name: '口コミ信頼度',
  na: { id: '—', label: '判定材料不足', cssClass: 'cc-tier-NA' },
  tiers: [{ id: 'A', label: 'そのまま参考にできます', cssClass: 'cc-tier-A' }, { id: 'B', label: 'おおむね参考にできます', cssClass: 'cc-tier-B' }],
};
const STORE = { '店名': 'テスト店', 'エリア': '栄', 'ジャンル': '居酒屋', 'Google評価': '4.3', '口コミ数': '812', '価格帯': '3001～4000円', '最寄駅': '栄', 'アクセス': '地下鉄栄駅 徒歩5分', reviewTrust: { t: 'B' } };

test('要点: Google 評価は出典名つき・口コミ信頼度は段階つきのボタン・最寄駅の分数は同じ駅のときだけ', () => {
  const c = loadFacts(POLICY);
  const html = c.nbQvFactsHtml({ ...STORE, '営業時間': '17:00～23:00', '定休日': '月' }, WED);
  assert.match(html, /<span class="num">4\.3<\/span><span class="m-count">（Google 812件）<\/span>/);
  assert.match(html, /<span class="visually-hidden">Google 評価 <\/span>/, '星の数字の意味を読み上げに残す');
  assert.match(html, /<button type="button" class="m-trust-link" onclick="mScrollTo\('m-cross-check'\)"[^>]*>口コミ信頼度 <span class="cc-tier cc-tier-B">B<\/span>/);
  assert.match(html, /aria-label="口コミ信頼度 B、おおむね参考にできます。内訳を見る"/);
  assert.match(html, /<span>栄<\/span><span>栄駅 徒歩5分<\/span><span>3001～4000円<\/span>/);
  assert.match(html, /<span class="m-today m-open">本日 17:00〜23:00<\/span>/);
});

test('要点（P-404）: 最寄駅と別の駅の徒歩の分数を付けない（アクセスの文は複数の駅を並べる）', () => {
  const c = loadFacts(POLICY);
  const html = c.nbQvFactsHtml({ ...STORE, '最寄駅': '久屋大通', 'アクセス': '地下鉄栄駅 徒歩8分／久屋大通駅 徒歩12分' }, WED);
  assert.ok(html.includes('<span>久屋大通駅</span>'), '最寄駅は駅名だけ');
  assert.ok(!/徒歩8分/.test(html), '栄駅の分数を久屋大通駅に付けない');
  const same = c.nbQvFactsHtml({ ...STORE, '最寄駅': '久屋大通', 'アクセス': '久屋大通駅 徒歩2分' }, WED);
  assert.ok(same.includes('久屋大通駅 徒歩2分'));
});

test('要点: 判定材料不足は段階の文字でなくラベルを出し、無い値の行は作らない', () => {
  const c = loadFacts(POLICY);
  const na = c.nbQvFactsHtml({ ...STORE, reviewTrust: { t: '—' } }, WED);
  assert.match(na, /口コミ信頼度 <span class="m-count">判定材料不足<\/span>/);
  assert.ok(!/cc-tier cc-tier-NA/.test(na));
  const noRating = c.nbQvFactsHtml({ '店名': 'x', 'エリア': '栄' }, WED);
  assert.ok(!/m-rate|m-trust-link|m-today/.test(noRating), '評価・信頼度・本日の行は値があるときだけ');
  assert.match(noRating, /<div class="m-fact m-fact-sub"><span>栄<\/span><\/div>/);
  assert.strictEqual(c.nbQvFactsHtml({}, WED), '', '何も無ければ空');
  const noCount = c.nbQvFactsHtml({ 'Google評価': '4.0' }, WED);
  assert.match(noCount, /（Google）/, '件数が無くても出典名は残す');
  const noPolicy = loadFacts(null).nbQvFactsHtml(STORE, WED);
  assert.ok(!/m-trust-link/.test(noPolicy), '段階の定義が無いビルド前でも例外を出さず信頼度だけ出さない');
});

test('要点: 店の名前などの文字は HTML として解釈させない', () => {
  const c = loadFacts(POLICY);
  const html = c.nbQvFactsHtml({ 'エリア': '<b>栄</b>', '価格帯': '"安い"' }, WED);
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;b&gt;栄&lt;/b&gt;') && html.includes('&quot;安い&quot;'));
});

// ───────── 3. 前の店・次の店 ─────────
function fakeEl(id) {
  return { id, style: {}, disabled: false, innerHTML: '', textContent: '', attrs: {}, children: [],
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; }, hasAttribute(k) { return k in this.attrs; },
    focus() { doc.activeElement = this; }, contains(o) { return o === this; } };
}
let doc;
function loadPager(list, current, opts) {
  const els = {};
  ['m-pager', 'm-pg-prev', 'm-pg-next', 'm-pg-pos', 'mn', 'm-store-link'].forEach((id) => { els[id] = fakeEl(id); });
  els['m-pager'].contains = (o) => o === els['m-pg-prev'] || o === els['m-pg-next'];
  doc = { getElementById: (id) => els[id] || null, activeElement: null, documentElement: { contains: () => true } };
  const calls = [];
  const ctx = { document: doc, RENDER_DATA: list, ALL_STORES: opts && opts.all || list, nbModalIsOpen: () => !(opts && opts.closed), openM: (i, s) => calls.push([i, s]),
    nbStoreHref: (r) => r.href || '', trackEvent: (n, p) => calls.push([n, p]) };
  vm.createContext(ctx);
  vm.runInContext('var NB_QV_STORE = null; var NB_QV_FROM_LIST = false; var NB_QV_PAGER_ON = false;\n' + [fn('nbQvFocusTitle'), fn('nbQvRefreshPager'), fn('nbQvStep'), fn('nbQvStoreLinkRefresh'), fn('nbQvStoreLinkClick')].join('\n'), ctx);
  ctx.NB_QV_FROM_LIST = true;
  ctx.NB_QV_STORE = current;
  return { ctx, els, calls };
}
const L = [{ n: 'a' }, { n: 'b' }, { n: 'c' }];

test('前の店・次の店: 位置と件数・先頭は前が、最後は次が押せない', () => {
  let t = loadPager(L, L[0]);
  t.ctx.nbQvRefreshPager();
  assert.strictEqual(t.els['m-pager'].style.display, '');
  assert.match(t.els['m-pg-pos'].innerHTML, /^1 \/ 3<span class="visually-hidden">件<\/span>$/);
  assert.strictEqual(t.els['m-pg-prev'].disabled, true);
  assert.strictEqual(t.els['m-pg-next'].disabled, false);
  t = loadPager(L, L[1]); t.ctx.nbQvRefreshPager();
  assert.deepStrictEqual([t.els['m-pg-prev'].disabled, t.els['m-pg-next'].disabled], [false, false]);
  t = loadPager(L, L[2]); t.ctx.nbQvRefreshPager();
  assert.deepStrictEqual([t.els['m-pg-prev'].disabled, t.els['m-pg-next'].disabled], [false, true]);
  assert.match(t.els['m-pg-pos'].innerHTML, /^3 \/ 3/);
});

test('前の店・次の店: 件数は 3 桁区切り。一覧の外から開いた店・1 件だけ・閉じているときは出さない', () => {
  const big = Array.from({ length: 1913 }, (_, i) => ({ n: i }));
  let t = loadPager(big, big[1]); t.ctx.nbQvRefreshPager();
  assert.match(t.els['m-pg-pos'].innerHTML, /^2 \/ 1,913/);
  t = loadPager(L, { n: 'zzz' }); t.ctx.nbQvRefreshPager();
  assert.strictEqual(t.els['m-pager'].style.display, 'none', '今の一覧に無い店（共有リンク・似た店）');
  t = loadPager([L[0]], L[0]); t.ctx.nbQvRefreshPager();
  assert.strictEqual(t.els['m-pager'].style.display, 'none', '1 件だけなら隣が無い');
  t = loadPager(L, L[1]); t.ctx.NB_QV_FROM_LIST = false; t.ctx.nbQvRefreshPager();
  assert.strictEqual(t.els['m-pager'].style.display, 'none', '一覧のカードから開いたときだけ');
  t = loadPager(L, L[1], { closed: true }); t.ctx.nbQvRefreshPager();
  assert.strictEqual(t.els['m-pager'].style.display, 'none', '閉じているとき');
});

test('前の店・次の店: 押すと隣の店を modal_nav で開く。端・出していないときは何もしない', () => {
  const t = loadPager(L, L[1]);
  t.ctx.nbQvRefreshPager();
  t.ctx.nbQvStep(1); t.ctx.nbQvStep(-1);
  assert.deepStrictEqual(t.calls, [[2, 'modal_nav'], [0, 'modal_nav']]);
  const e = loadPager(L, L[2]); e.ctx.nbQvRefreshPager(); e.ctx.nbQvStep(1);
  assert.deepStrictEqual(e.calls, [], '最後の次は無い');
  const f = loadPager(L, L[0]); f.ctx.nbQvRefreshPager(); f.ctx.nbQvStep(-1);
  assert.deepStrictEqual(f.calls, [], '先頭の前は無い');
  const off = loadPager(L, L[1]); off.ctx.NB_QV_FROM_LIST = false; off.ctx.nbQvRefreshPager(); off.ctx.nbQvStep(1);
  assert.deepStrictEqual(off.calls, [], '前後の行を出していないときはスワイプでも動かない');
});

test('前の店・次の店: 端まで来て押せなくなったボタンから、焦点を店名へ逃がす', () => {
  const t = loadPager(L, L[2]);
  doc.activeElement = t.els['m-pg-next'];
  t.ctx.nbQvRefreshPager();
  assert.strictEqual(doc.activeElement, t.els['mn']);
  const u = loadPager(L, L[1]);
  doc.activeElement = u.els['m-pg-next'];
  u.ctx.nbQvRefreshPager();
  assert.strictEqual(doc.activeElement, u.els['m-pg-next'], '押せるあいだは焦点を動かさない');
});

test('この店のページを見る: 店舗ページが分かる店にだけ出し、押すと internal_link_click（block=quick_view）', () => {
  const t = loadPager(L, L[0]);
  t.ctx.nbQvStoreLinkRefresh({ href: 'stores/J1.html' });
  assert.strictEqual(t.els['m-store-link'].getAttribute('href'), 'stores/J1.html');
  assert.strictEqual(t.els['m-store-link'].style.display, '');
  t.ctx.nbQvStoreLinkRefresh({ href: '' });
  assert.strictEqual(t.els['m-store-link'].style.display, 'none');
  assert.strictEqual(t.els['m-store-link'].getAttribute('href'), null, '前の店のリンク先を残さない');
  t.ctx.NB_QV_STORE = { '店名': 'テスト店' };
  t.ctx.nbQvStoreLinkClick({ getAttribute: () => 'stores/J1.html' });
  assert.deepStrictEqual(t.calls[0][0], 'internal_link_click');
  assert.deepStrictEqual({ ...t.calls[0][1] }, { store_name: 'テスト店', link_url: 'stores/J1.html', block: 'quick_view' });
});

// ───────── 4. inert と焦点 ─────────
function fakeTree() {
  const mk = (id, tag) => ({ id: id || '', tagName: tag || 'DIV', parentNode: null, children: [], attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, hasAttribute(k) { return k in this.attrs; } });
  const body = mk('', 'BODY');
  const kids = ['hdr', 'main', 'toast', 'ov', 'footer'].map((id) => mk(id));
  kids.push(mk('', 'SCRIPT'));
  kids.forEach((k) => { k.parentNode = body; });
  body.children = kids;
  const wrap = mk('wrap');                  // ov が入れ子のとき
  return { body, kids, wrap, mk };
}
function loadInert(body, ovNode) {
  const opener = { focused: 0, focus() { this.focused++; } };
  const ctx = { document: { body, getElementById: (id) => id === 'ov' ? ovNode : null, activeElement: opener, documentElement: { contains: () => true } } };
  vm.createContext(ctx);
  vm.runInContext('var NB_QV_OPENER = null; var NB_QV_KEEP = false; var NB_QV_STORE = null; var NB_QV_INERT = [];\n' + [fn('nbQvRememberOpener'), fn('nbQvSetInert'), fn('nbQvRelease')].join('\n'), ctx);
  return { ctx, opener };
}

test('後ろのページ: シートが開いている間は ov 以外を inert にし（#toast と script は除く）、閉じたら外す', () => {
  const { body, kids } = fakeTree();
  const ov = kids[3];
  ov.classList = { contains: () => false };
  const { ctx } = loadInert(body, ov);
  ctx.nbQvSetInert(true);
  const flagged = kids.filter((k) => k.hasAttribute('inert')).map((k) => k.id || k.tagName);
  assert.deepStrictEqual(flagged, ['hdr', 'main', 'footer']);
  ctx.nbQvSetInert(true);
  assert.strictEqual(ctx.NB_QV_INERT.length, 3, '2 回呼んでも増えない');
  ctx.nbQvSetInert(false);
  assert.strictEqual(kids.filter((k) => k.hasAttribute('inert')).length, 0);
});

test('後ろのページ: もともと inert の要素は触らず、ov が入れ子でも兄弟すべてを止める', () => {
  const { body, kids, wrap, mk } = fakeTree();
  const ov = mk('ov');
  const sib = mk('sib');
  wrap.children = [ov, sib]; ov.parentNode = wrap; sib.parentNode = wrap;
  body.children = [wrap, kids[0]]; wrap.parentNode = body; kids[0].parentNode = body;
  kids[0].setAttribute('inert', '');
  const { ctx } = loadInert(body, ov);
  ctx.nbQvSetInert(true);
  assert.ok(sib.hasAttribute('inert'), '入れ子の兄弟');
  assert.ok(!wrap.hasAttribute('inert'), 'ov を含む枝は止めない（止めるとシートも動かない）');
  ctx.nbQvSetInert(false);
  assert.ok(kids[0].hasAttribute('inert'), 'もともと付いていたものは外さない');
  assert.ok(!sib.hasAttribute('inert'));
});

test('焦点: 開く前の要素を覚え、閉じたら inert を外してから戻す。開いたまま別の店・似たお店への切り替えでは変えない', () => {
  const { body, kids } = fakeTree();
  const ov = kids[3];
  let open = false;
  ov.classList = { contains: () => open };
  const { ctx, opener } = loadInert(body, ov);
  ctx.nbQvRememberOpener();
  assert.strictEqual(ctx.NB_QV_OPENER, opener);
  open = true;
  ctx.document.activeElement = { other: true };
  ctx.nbQvRememberOpener();
  assert.strictEqual(ctx.NB_QV_OPENER, opener, '開いたまま（前の店・次の店）では覚え直さない');
  // swap
  open = false;
  ctx.nbQvRelease(true, true);
  assert.strictEqual(ctx.NB_QV_KEEP, true);
  ctx.nbQvRememberOpener();
  assert.strictEqual(ctx.NB_QV_OPENER, opener, '似たお店への切り替え中は元のまま');
  assert.strictEqual(ctx.NB_QV_KEEP, false);
  // close
  ctx.nbQvSetInert(true);
  ctx.nbQvRelease(false, true);
  assert.strictEqual(opener.focused, 1, '開いたボタンへ焦点を戻す');
  assert.strictEqual(kids.filter((k) => k.hasAttribute('inert')).length, 0);
  assert.strictEqual(ctx.NB_QV_OPENER, null);
  ctx.nbQvRelease(false, true);
  assert.strictEqual(opener.focused, 1, '2 回閉じても焦点を動かさない');
});

test('焦点: 開いた要素が消えていた（一覧が描き直された）・開く前の焦点が body のときは何もしない', () => {
  const { body, kids } = fakeTree();
  const ov = kids[3]; ov.classList = { contains: () => false };
  const { ctx, opener } = loadInert(body, ov);
  ctx.document.activeElement = body;
  ctx.nbQvRememberOpener();
  assert.strictEqual(ctx.NB_QV_OPENER, null, '開く前の焦点が body（マウスで押した・共有リンク）なら、戻す先は無い');
  ctx.NB_QV_OPENER = opener;
  ctx.document.documentElement.contains = () => false;
  ctx.nbQvRelease(false, true);
  assert.strictEqual(opener.focused, 0, 'ページから消えた要素へは戻さない');
});

test('開いた直後: 後ろを inert にし、店舗ページのリンクと前後の行を整え、題へ焦点を送る（前の店・次の店では焦点を動かさない）', () => {
  const calls = [];
  const ctx = { nbQvStoreLinkRefresh: (r) => calls.push('link'), nbQvSetInert: (on) => calls.push('inert:' + on), nbQvRefreshPager: () => calls.push('pager'), nbQvFocusTitle: () => calls.push('focus') };
  vm.createContext(ctx);
  vm.runInContext('var NB_QV_STORE = null; var NB_QV_FROM_LIST = false;\n' + fn('nbQvOpened'), ctx);
  const r = { n: 1 };
  ctx.nbQvOpened(r, 'grid');
  assert.deepStrictEqual(calls, ['link', 'inert:true', 'pager', 'focus']);
  assert.strictEqual(ctx.NB_QV_STORE, r);
  assert.strictEqual(ctx.NB_QV_FROM_LIST, true, '一覧のカードから開いた');
  calls.length = 0;
  ctx.nbQvOpened(r, 'modal_nav');
  assert.deepStrictEqual(calls, ['link', 'inert:true', 'pager'], '焦点は押したボタンに残す');
  assert.strictEqual(ctx.NB_QV_FROM_LIST, true);
  ctx.nbQvOpened(r, 'popstate');
  assert.strictEqual(ctx.NB_QV_FROM_LIST, true, '戻る・進むは直前の開き方を引き継ぐ');
  ['deeplink', 'modal_reco', 'trending', 'history'].forEach((src) => {
    ctx.NB_QV_FROM_LIST = true;
    ctx.nbQvOpened(r, src);
    assert.strictEqual(ctx.NB_QV_FROM_LIST, false, src + ' から開いたときは前後の行を出さない');
  });
});

// ───────── 5. 配線 ─────────
const OPEN_M = INDEX.slice(INDEX.indexOf('function openM(i, source) {'), INDEX.indexOf('function renderMhi('));
const CLOSE_M = fn('closeM');

test('マークアップ: シートの題・♡・店舗ページ・前後・折りたたみ・行動バーが同じ部品として並び、旧モーダルの行は無い', () => {
  assert.match(INDEX, /<div class="ov" id="ov" role="dialog" aria-modal="true" aria-labelledby="mn">/);
  assert.match(INDEX, /<h2 class="min2" id="mn" tabindex="-1"><\/h2>/);
  assert.match(INDEX, /<button id="modal-fav-btn" class="m-fav" type="button" onclick="toggleModalFav\(\)" aria-label="保存" aria-pressed="false">/);
  assert.match(INDEX, /<a class="m-store-link" id="m-store-link"[^>]*onclick="nbQvStoreLinkClick\(this\)">この店のページを見る/);
  assert.match(INDEX, /<nav class="m-pager" id="m-pager" aria-label="一覧の隣の店へ"/);
  assert.match(INDEX, /id="m-pg-prev" onclick="nbQvStep\(-1\)"[^>]*>[\s\S]*?前の店/);
  assert.match(INDEX, /id="m-pg-next" onclick="nbQvStep\(1\)"[^>]*>次の店/);
  assert.match(INDEX, /<span class="m-pg-pos" id="m-pg-pos" role="status">/);
  assert.match(INDEX, /<details class="m-more" id="m-more">\s*<summary>ほかの情報/);
  assert.ok(INDEX.indexOf('<div class="m-sticky-cta" id="m-sticky-cta"></div>') > INDEX.indexOf('id="m-footnote"'), '行動バーはシートの一番下');
  ['modal-cta-row', 'id="m-glance"', 'id="m-sub"', 'm-gcell'].forEach((s) => assert.ok(!INDEX.includes(s), s + ' は廃した'));
  assert.ok(!/M_STICKY_OBS|mSetupStickyCta/.test(INDEX), '追従バーの出し入れ（IntersectionObserver）は廃した。バーは常に見える');
});

test('マークアップ: 残すもの（口コミ信頼度の箱・基本情報・Instagram・出典の注記・特集・経験者レビュー・各媒体・似た店・共有）の id が全部ある', () => {
  ['m-cross-check', 'm-cc-tier', 'm-cc-breakdown', 'm-info', 'm-info-rows', 'mig-wrap', 'mig-container', 'm-footnote', 'm-features-section', 'm-readmore-section', 'm-insider-reviews', 'm-insider-form', 'ir-form', 'mmg', 'modal-related', 'share-bar', 'm-ir-linkwrap', 'm-sig', 'm-lead', 'm-scenes', 'mhi', 'mhi-track'].forEach((id) => {
    assert.ok(INDEX.includes('id="' + id + '"'), id + ' がある');
  });
  const more = INDEX.slice(INDEX.indexOf('<details class="m-more"'), INDEX.indexOf('id="m-footnote"'));
  ['m-features-section', 'm-insider-reviews', 'id="mmg"', 'modal-related', 'share-bar'].forEach((s) => assert.ok(more.includes(s), s + ' は「ほかの情報」の中'));
  const outside = INDEX.slice(INDEX.indexOf('id="m-facts"'), INDEX.indexOf('<details class="m-more"'));
  ['m-cross-check', 'm-info"', 'mig-wrap'].forEach((s) => assert.ok(outside.includes(s), s + ' は折りたたまない'));
  assert.ok(outside.indexOf('id="m-store-link"') < outside.indexOf('id="m-pager"') && outside.indexOf('id="m-pager"') < outside.indexOf('id="m-cross-check"'), '順: 点 → 店舗ページ → 前後 → 口コミ信頼度');
});

test('行動バー: 予約先あり＋電話可＝予約(塗り)・電話・地図／予約先ありのみ＝予約・地図／電話のみ＝電話(塗り)・地図／どちらも無し＝地図を開く(塗り)', () => {
  assert.match(OPEN_M, /stickyEl\.innerHTML = \(hpId2 \? \(hpBtnHtml \+ callIconBtn \+ mapIconBtn\)\n\s+: nbCanCall\(r\) \? \(callBtnHtml \+ mapBtnHtml\)\n\s+: mapOnlyBtnHtml\) \+ callStatusHtml;/);
  assert.match(OPEN_M, /stickyEl\.setAttribute\('data-primary', hpId2 \? 'hp' : nbCanCall\(r\) \? 'call' : 'map'\);/);
  assert.match(OPEN_M, /mapBtnHtml\.replace\('<\/svg>地図<\/a>', '<\/svg>地図を開く<\/a>'\)/);
  assert.match(OPEN_M, /class="modal-cta-btn modal-cta-hp"[^`]*?>HotPepperで予約<\/a>/, '予約ボタンは行き先を書く');
  assert.ok(!/この店を予約する/.test(OPEN_M));
  assert.match(INDEX, /\.m-sticky-cta\[data-primary="call"\] \.modal-cta-call,\.m-sticky-cta\[data-primary="map"\] \.modal-cta-gm\{background:var\(--ember\)/, '電話・地図が主のときだけ塗る（予約が主のときは予約だけ）');
  assert.match(INDEX, /\.m-sticky-cta\{position:sticky;bottom:0;[^}]*display:flex;/, 'バーは常に表示');
  assert.ok(!/\.m-sticky-cta\.show/.test(INDEX), '出し入れの .show は廃した');
});

test('計測: modal_open の名前と source・cta_click・cta_gmap_click の location・♡ は従来のまま。前後は source=modal_nav', () => {
  assert.match(OPEN_M, /if \(source !== 'popstate'\) trackEvent\('modal_open', \{store_name: r\['店名'\], store_id: nbStoreKey\(r\), genre: r\['ジャンル'\], area: r\['エリア'\], source: source \|\| 'unknown'\}\);/);
  assert.match(OPEN_M, /nbReserveExit\(\\'cta_click\\',\{store_name:\\'' \+ ctaEsc\(r\['店名'\]\) \+ '\\',store_id:\\'' \+ ctaEsc\(hpId2\) \+ '\\',link_domain:\\'www\.hotpepper\.jp\\',location:\\'modal\\'\}\)/);
  ['modal_cta', 'modal_sticky', 'modal_address', 'modal_media_row'].forEach((loc) => assert.ok(OPEN_M.includes(loc), 'cta_gmap_click の location ' + loc));
  assert.match(fn('nbQvStep'), /openM\(idx, 'modal_nav'\)/);
  assert.match(fn('nbQvOpened'), /source === 'grid' \|\| source === 'modal_nav'/, '前後の行は一覧のカードから開いたときだけ');
});

test('履歴: 前の店・次の店は履歴を足さない（開いたまま別の店へ＝今の履歴の置き換え）。閉じ方はすべて closeM()', () => {
  const hist = INDEX.slice(INDEX.indexOf('function nbModalHistoryOpen('), INDEX.indexOf('function nbModalHistoryClose('));
  assert.match(hist, /if \(swapping \|\| \(history\.state && history\.state\.nbM\)\) history\.replaceState/, '印があるときは置き換え');
  assert.match(CLOSE_M, /if \(typeof nbQvRelease === 'function'\) nbQvRelease\(!!\(opts && opts\.swap\), wasOpen\);/, '閉じたら inert を外して焦点を戻す');
  assert.ok(/nbQvOpened\(r, source\);\n\}/.test(OPEN_M), 'openM は最後に nbQvOpened を呼ぶ');
  assert.match(OPEN_M, /nbModalHistoryOpen\(nbStoreKey\(r\), source\);/);
  assert.match(OPEN_M, /nbQvRememberOpener\(\);/);
});

test('下スワイプで閉じる・横スワイプで前後: しきい値と、横に動かしてはいけない場所', () => {
  const sw = INDEX.slice(INDEX.indexOf("var startX = 0, startY = 0, startScrollTop = 0, tracking = false, blocked = false;"));
  const body = sw.slice(0, sw.indexOf('})();'));
  assert.match(body, /if \(Math\.abs\(dx\) < Math\.abs\(dy\)\) \{\s*\/\/[^\n]*\n\s*if \(dy > 80 && startScrollTop <= 0\) closeM\(\);\s*return;/, '縦が大きい動きは従来どおり（80px・一番上）');
  assert.match(body, /Math\.abs\(dx\) >= 72 && Math\.abs\(dx\) > Math\.abs\(dy\) \* 1\.5\) nbQvStep\(dx < 0 \? 1 : -1\)/, '横は 72px 以上・縦の 1.5 倍より大きく。左へ=次、右へ=前');
  assert.match(body, /MHI_PHOTOS\.length > 1 && t\.closest\('\.mhi'\)/, '複数枚の写真は写真のスワイプを優先');
  ['.mmg', '.modal-related-stores', 'form', 'iframe', 'input', 'textarea'].forEach((s) => assert.ok(body.includes(s), s + ' の上では前後へ動かさない'));
  assert.match(body, /if \(e\.touches\.length !== 1\) \{ tracking = false; return; \}/, '2 本指（ピンチ）では動かさない');
});

test('キーボード: Tab はシートの中だけを一周し（閉じた折りたたみ・押せないボタンを除く）、Esc は closeM', () => {
  const trap = INDEX.slice(INDEX.indexOf("document.getElementById('ov').addEventListener('keydown', function(e) {\n  if (!this.classList.contains('open') || e.key !== 'Tab') return;"));
  const body = trap.slice(0, trap.indexOf('\n});') + 4);
  assert.match(body, /button:not\(\[disabled\]\)/);
  assert.match(body, /getClientRects\(\)\.length > 0/, '見えていないもの（閉じた details の中）は数えない');
  assert.match(body, /act === first \|\| !this\.contains\(act\) \|\| act\.id === 'mn'/, '最初・外・題から Shift+Tab で最後へ');
  assert.match(INDEX, /if \(e\.key === 'Escape'\) \{\n    var ov = document\.getElementById\('ov'\);\n    if \(ov && ov\.classList\.contains\('open'\)\) closeM\(\);/);
});

test('♡: 開いたときも押したときも aria-pressed を合わせる。「ほかの情報」はレビュー投稿リンクから開く', () => {
  assert.match(OPEN_M, /mfavBtn\.setAttribute\('aria-pressed', isMFav \? 'true' : 'false'\);/);
  assert.match(fn('toggleModalFav'), /btn\.setAttribute\('aria-pressed', isFav \? 'true' : 'false'\);/);
  assert.match(fn('nbOpenInsiderForm'), /var moreD = document\.getElementById\('m-more'\); if \(moreD\) moreD\.open = true;/, '折りたたみの中のフォームを開く前に、折りたたみを開く');
  assert.match(OPEN_M, /var moreEl0 = document\.getElementById\('m-more'\); if \(moreEl0\) moreEl0\.open = false;/, '別の店を開いたら折りたたみは閉じる');
});

test('写真: 実写が無い店は枠ごと出さず（.is-nophoto）、写真のクレジット・複数枚のスワイプは残す', () => {
  const mhi = fn('renderMhi');
  assert.match(mhi, /modalForPhoto\.classList\.toggle\('is-nophoto', !hasRealPhoto\)/);
  assert.match(mhi, /var hasRealPhoto = !!\(r\['写真URL'\] \|\| ''\)\.trim\(\) \|\| photos\.some\(function\(p\) \{ return p\.label; \}\);/);
  assert.match(mhi, /nbPhotoCredit\(r\)/, '撮影者のクレジットを残す');
  assert.match(INDEX, /\.modal\.is-nophoto \.mhi\{display:none;\}/);
  assert.match(INDEX, /\.mhi\{[^}]*aspect-ratio:1\/1;/, '写真は 1:1');
});

test('一覧の並びが変わったら、開いているシートの前後の行も合わせる', () => {
  assert.match(fn('renderGrid'), /RENDER_DATA = data;\n  CURRENT_PAGE = 1;\n  renderPage\(1\);\n  if \(typeof nbQvRefreshPager === 'function'\) nbQvRefreshPager\(\);/);
});

test('文字の大きさ: クイックビューで足した規則は 13px 未満の直書きをしない（トークン var(--fs-*) を使う）', () => {
  const css = INDEX.slice(INDEX.indexOf('.m-titlerow{'), INDEX.indexOf('.m-more>.m-section:first-of-type'));
  assert.ok(css.length > 500);
  const lits = css.match(/font-size:\s*[\d.]+(px|rem|em)/g) || [];
  assert.deepStrictEqual(lits, [], 'font-size の直書きなし');
});

// ───────── P-439: 予約確認プロンプトは後ろの inert の対象外 ─────────
test('P-439: nbQvSetInert は body 直下の予約確認プロンプト（.nb-reserve-ask）に inert を付けず、他の兄弟には付ける', () => {
  const mk = (o) => Object.assign({ hasAttribute(n) { return !!this.attrs[n]; }, setAttribute(n) { this.attrs[n] = true; }, removeAttribute(n) { delete this.attrs[n]; }, attrs: {}, classList: { contains: () => false } }, o);
  const ask = mk({ tagName: 'DIV', id: '', attrs: {}, classList: { contains: (c) => c === 'nb-reserve-ask' } });
  const main = mk({ tagName: 'DIV', id: 'main', attrs: {} });
  const ov = mk({ tagName: 'DIV', id: 'ov', attrs: {} });
  const body = { children: [main, ov, ask] };
  ov.parentNode = body; main.parentNode = body; ask.parentNode = body;
  const bodyEl = { parentNode: {} };
  body.parentNode = bodyEl;
  const ctx = { document: { body, getElementById: (id) => (id === 'ov' ? ov : null) } };
  vm.createContext(ctx);
  vm.runInContext('var NB_QV_INERT = [];\n' + fn('nbQvSetInert') + '\nnbQvSetInert(true);', ctx);
  assert.ok(main.attrs.inert, '後ろのページには inert を付ける');
  assert.ok(!ask.attrs.inert, '予約確認プロンプトには付けない');
  vm.runInContext('nbQvSetInert(false);', ctx);
  assert.ok(!main.attrs.inert);
});
