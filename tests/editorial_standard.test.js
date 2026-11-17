'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ES = require('../scripts/lib/editorial_standard');
const { renderHtml } = require('../scripts/generate_daily_draft');
const { parseArticle, buildNoteDraft, loadPolicy } = require('../scripts/lib/note_draft');
const X = require('../scripts/lib/x_post');
const SS = require('../scripts/lib/store_stats');

const INPUT = {
  date: '2026-11-16', slug: '2026-11-16-test', theme: 'today_one', title: 'テスト', description: '説明', lead: 'リード',
  body_html: '<h2>見出し</h2><p>本文の段落。</p>', stores: [], insider_points: ['旧ポイント'],
  sources: [{ label: '公式', url: 'https://example.com/', checked: '2026-11-16' }],
  status: { checked: '2026-11-16', visited: false },
  conclusion: { fit: '少人数の宴会', check_first: '飲み放題の最終注文' },
  checklist: [
    { item: 'お通し・席料', status: 'confirmed', value: 'お通し代 300円', source: 'ホットペッパー掲載', checked: '2026-11-16' },
    { item: '喫煙', status: 'unconfirmed', source: '公式・ホットペッパー', checked: '2026-11-16' }
  ],
  fit_for: ['少人数で飲みたい人'], not_fit_for: ['煙が苦手な人']
};

test('編集基準: 定型7項目・読み替え10規則・3種の記事の必須情報を持つ', () => {
  const std = ES.loadStandard();
  assert.strictEqual(std.checklist.items.length, 7);
  assert.ok(std.conversionRules.rules.length >= 10);
  assert.deepStrictEqual(Object.keys(std.articleTypes).filter((k) => k[0] !== '_'), ['shop_intro', 'guide', 'comparison']);
  assert.ok(std.conversionRules.rules.every((r) => r.fact && r.reading && r.basis));
});

test('状態の帯: 確認日・未訪問・AIが作成（決定5）。開店前は「開店前に執筆」', () => {
  assert.strictEqual(ES.statusBandText(INPUT), '11月16日確認・編集部は未訪問・公開情報をもとにAIが作成');
  assert.match(ES.statusBandText({ date: '2026-11-16', status: { pre_open: true } }), /開店前に執筆/);
  assert.match(ES.statusBandText({ date: '2026-11-16' }), /未訪問/); // 既定は未訪問（訪問したと書かない）
});

test('チェックリスト: 定型7項目を順に出し、未記入・確認できなかった項目は空欄にせず言葉で書く', () => {
  const html = ES.buildChecklist(INPUT);
  assert.strictEqual((html.match(/<li>/g) || []).length, 7);
  // 札は確認できなかった行だけ
  assert.match(html, /お通し・席料<\/span>: お通し代 300円（ホットペッパー掲載・11月16日確認）/);
  assert.match(html, /喫煙<\/span> <span class="nb-check-state">確認できなかった<\/span>: 記載なし（公式・ホットペッパー・11月16日確認）。予約時に店へ確認を/);
  assert.match(html, /支払い方法<\/span> <span class="nb-check-state">確認できなかった<\/span>: 記載なし。予約時に店へ確認を/);
  assert.strictEqual((html.match(/nb-check-state/g) || []).length, 6);
  assert.ok(!html.includes('未記入'));
  assert.strictEqual(ES.unknownCount(INPUT), 6);
});

test('値の無い confirmed は確認できた扱いにしない', () => {
  const r = ES.normalizeChecklist([{ item: '喫煙', status: 'confirmed', value: '' }]).rows.find((x) => x.id === 'smoking');
  assert.strictEqual(r.status, 'unconfirmed');
});

test('警告: 無い項目は文で返す（止めない）。そろっていれば項目の欠けだけ', () => {
  const w = ES.judgementWarnings({ date: '2026-11-16' });
  assert.ok(w.some((x) => /先に結論/.test(x)) && w.some((x) => /向く人/.test(x)) && w.some((x) => /出典/.test(x)));
  assert.ok(ES.judgementWarnings(INPUT).some((x) => /支払い方法/.test(x)));
});

test('訂正の履歴: 空でも data-correction-log の要素と空の ul を出し hidden（道具が行を足す）。履歴があれば hidden を外す', () => {
  const empty = ES.buildCorrections({});
  assert.match(empty, /data-correction-log hidden/);
  assert.match(empty, /<ul><\/ul>/);
  const one = ES.buildCorrections({ corrections: [{ date: '2026-11-20', text: '営業時間を訂正' }] });
  assert.doesNotMatch(one, /hidden/);
  assert.match(one, /11月20日<\/span> 営業時間を訂正/);
});

test('記事: 6つの部品が出て、従来の要点欄は置き換わる。部品が無い入力は従来どおり', () => {
  const html = renderHtml(INPUT);
  assert.match(html, /<p class="nb-status-band" role="note">11月16日確認・編集部は未訪問・公開情報をもとにAIが作成<\/p>/);
  assert.match(html, /class="insider-box nb-jbox nb-jconclusion"><p class="insider-title">先に結論/);
  assert.match(html, /向く人: 少人数の宴会/);
  assert.match(html, /向かない人: 煙が苦手な人/);
  assert.match(html, /確かめたい点: 飲み放題の最終注文。分からなかった点は6点で、項目ごとに下の一覧に書いています。/);
  // 帯は日付の行の直下、先に結論はリードの直後（1画面目に出す）
  assert.ok(html.indexOf('class="art-meta"') < html.indexOf('nb-status-band') && html.indexOf('nb-status-band') < html.indexOf('art-lead') && html.indexOf('art-lead') < html.indexOf('nb-jconclusion'));
  assert.match(html, /来店前に確かめたいこと/);
  assert.match(html, /data-correction-log hidden/);
  assert.ok(!html.includes('知っておきたいポイント'));
  assert.ok(!html.includes('NB-LEGACY-INSIDER'));
  const legacy = renderHtml({ ...INPUT, conclusion: undefined, checklist: undefined, fit_for: undefined, not_fit_for: undefined });
  assert.ok(legacy.includes('<p class="insider-title">知っておきたいポイント</p>'));
  assert.ok(legacy.includes('旧ポイント'));
  assert.ok(!legacy.includes('NB-LEGACY-INSIDER'));
});

test('note: 本文に部品が混ざらず、先に結論と状態の帯が入る', () => {
  const html = renderHtml(INPUT);
  const a = parseArticle(html);
  assert.strictEqual(a.pointsTitle, '先に結論');
  assert.ok(a.points.some((p) => /少人数の宴会/.test(p)));
  assert.strictEqual(a.sections.length, 1);
  assert.deepStrictEqual(a.sections[0].paras, ['本文の段落。']);
  assert.match(a.band, /AIが作成/);
  const policy = loadPolicy();
  const d = buildNoteDraft({ slug: INPUT.slug, title: 'テスト', store_ids: [] }, html, policy, []);
  assert.match(d.body, /^11月16日確認/);
  assert.match(d.body, /## 先に結論/);
});

test('X: 先に結論の箇条書きが引用元になる', () => {
  const pts = X.insiderPoints(renderHtml(INPUT));
  assert.ok(pts.length >= 3);
  assert.ok(pts.some((p) => /飲み放題の最終注文/.test(p)));
});

test('店選びガイド: 手計算の標本と集計が一致し、書き出しは「このサイトに載っている◯店のうち」', () => {
  const mk = (o) => ({ 'エリア': '名古屋（名古屋駅/西区）', 'ジャンル': '居酒屋', '営業ステータス': 'OPERATIONAL', ...o });
  const stores = [
    mk({ '価格帯': '2001～3000円', '個室': 'あり', '禁煙': '全面禁煙', '料金備考': 'お通し300円', '平均予算': '3,000円', '条件取得日': '2026-11-10' }),
    mk({ '価格帯': '3001～4000円', '個室': '', '禁煙': '禁煙席なし', '料金備考': '22時以降は深夜料金10%', '平均予算': '4,000円', '条件取得日': '2026-11-16' }),
    mk({ '価格帯': '3001～4000円', '個室': 'あり ：半個室あり', '禁煙': '一部禁煙', '料金備考': '', '平均予算': 'ディナー：5000円', '条件取得日': '2026-11-12' }),
    mk({ '価格帯': '', '個室': '', '禁煙': '', '料金備考': '' }),
    mk({ '営業ステータス': 'CLOSED_TEMPORARILY', '価格帯': '1001～1500円' }), // 休業は数えない
    mk({ 'エリア': '栄', '価格帯': '1001～1500円' }) // 別エリアは数えない
  ];
  const st = SS.aggregate({ area: '名古屋駅', genre: '居酒屋' }, stores);
  assert.strictEqual(st.n, 4);
  assert.strictEqual(st.asOf, '2026-11-16');
  assert.deepStrictEqual(st.price.bands, [{ label: '2001～3000円', count: 1 }, { label: '3001～4000円', count: 2 }]);
  assert.strictEqual(st.price.medianBand, '3001～4000円');
  assert.deepStrictEqual(st.budget, { withPlain: 2, median: 3500 });
  assert.deepStrictEqual(st.privateRoom, { yes: 2, noRecord: 2 });
  assert.deepStrictEqual(st.smoking, { 全面禁煙: 1, 一部禁煙: 1, 禁煙席なし: 1, 記載なし: 1 });
  assert.deepStrictEqual(st.feeNote, { withNote: 2, noNote: 2, otoshiMention: 1, midnightMention: 1 });
  const s = SS.guideSentences(st);
  assert.strictEqual(SS.scopeText(st), 'このサイトに載っている4店のうち');
  assert.ok(s.every((t) => !t.includes('このサイトに載っている')) && !s.join('').includes('下の一覧'));
  assert.throws(() => SS.buildGuideBlock({ area: '名古屋駅', genre: '居酒屋', stores }), /基準（10店）に満たない/);
});

test('店選びガイド: 実データで作れ、対象件数・取得日・「名古屋全体の実態ではない」断りが入る。記事に差し込める', () => {
  const block = SS.buildGuideBlock({ area: '名古屋駅', genre: '居酒屋', checked: '2026-11-17' });
  assert.match(block, /このサイトに載っている\d+店のうち（名古屋駅・居酒屋・11月17日時点の掲載データ）/);
  assert.ok(!block.includes('下の一覧'));
  assert.match(block, /名古屋全体の実態を表すものではありません/);
  const html = renderHtml({ ...INPUT, article_type: 'guide', guide: { area: '名古屋駅', genre: '居酒屋', checked: '2026-11-17' } });
  assert.match(html, /class="nb-guide-stats nb-jbox"/);
  assert.ok(html.indexOf('nb-guide-stats') < html.indexOf('<summary>来店前に確かめたいこと'));
});

test('記事の部品のスタイルが nb.css にあり、文字は13px未満のトークンを使わない', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'assets/css/nb.css'), 'utf8');
  for (const sel of ['.nb-status-band', '.nb-jbox', '.nb-fit', '.nb-jconclusion']) assert.ok(css.includes(sel), sel);
  const block = css.slice(css.indexOf('.nb-status-band{'), css.indexOf('.art-img-kind'));
  assert.ok(!/fs-2xs/.test(block));
});
