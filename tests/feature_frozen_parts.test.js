'use strict';
// 基本方針 S5-2（ADR 0069）: 検索流入のある特集6本に「確認メモ」を足すとき、題・URL・大見出し・冒頭は変えない。
// 題を意図して変える施策（「業界人」を題から外す・決定4）が入るときは、この表の該当行を同じ変更で更新する。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const FROZEN = {
  'nagoya-solo-dining': {
    title: '名古屋 一人飲み完全ガイド 2026｜カウンター名店から立ち飲みまで10店｜NAGOYA BITES',
    canonical: 'https://nagoya-bites.com/features/nagoya-solo-dining.html',
    h1: '名古屋 一人飲み完全ガイド 2026カウンター名店から立ち飲みまで',
    lead: 'c647930e1cc216b9083f9d7d5f97c27837705eb9',
  },
  date: {
    title: '名古屋 デートディナーおすすめ10選｜予算・エリア別【2026年版】｜NAGOYA BITES',
    canonical: 'https://nagoya-bites.com/features/date.html',
    h1: '名古屋 デートディナーおすすめ10選',
    lead: '81b1b18a99d2b2513c72094ff0b2db7356cb34a3', // 2026-11-23 冒頭の見出しを「先に結論」→「ここがポイント」（本人の依頼・Ondine #2576）
  },
  'nagoya-tebasaki': {
    title: '名古屋の手羽先、風来坊と山ちゃんの違い｜8店【2026】｜NAGOYA BITES',
    canonical: 'https://nagoya-bites.com/features/nagoya-tebasaki.html',
    h1: '名古屋 手羽先完全ガイド｜風来坊・世界の山ちゃん・むつみ系の違いと厳選8店',
    lead: '05c6368c12014434c0f28c1ad21087b327d0e0aa',
  },
  'nagoya-autumn-2026': {
    title: '名古屋の秋グルメおすすめ10選【2026年版】｜NAGOYA BITES',
    canonical: 'https://nagoya-bites.com/features/nagoya-autumn-2026.html',
    h1: '名古屋の秋おすすめ10選【2026年版】',
    lead: 'a259f8d9b2dcee38655adc50339f75a350211240',
  },
  'nagoya-miso-nikomi-udon': {
    title: '名古屋 味噌煮込みうどん完全ガイド｜山本屋本店・総本家の違いと厳選4店【2026年最新】｜NAGOYA BITES',
    canonical: 'https://nagoya-bites.com/features/nagoya-miso-nikomi-udon.html',
    h1: '名古屋 味噌煮込みうどん完全ガイド｜山本屋本店・総本家の違いと厳選4店',
    lead: '6ad3f811d9937c0e1eb16526ee449ab345faae92',
  },
  'kospa-insider': {
    title: '名古屋のコスパ最強グルメ【見極め方】｜NAGOYA BITES',
    canonical: 'https://nagoya-bites.com/features/kospa-insider.html',
    h1: '名古屋のコスパ最強グルメ',
    lead: '522fb5c6280a5e1d65b3f4238c834d2be7a85f24',
  },
};

const MEMO_RE = /<!-- NB_CONFIRM_MEMO_START -->[\s\S]*?<!-- NB_CONFIRM_MEMO_END -->/;

function parts(html) {
  const title = (/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1];
  const canonical = (/<link rel="canonical" href="([^"]+)"/.exec(html) || [])[1];
  const h1s = html.indexOf('<h1');
  const h1 = html.slice(h1s, html.indexOf('</h1>', h1s) + 5).replace(/<[^>]+>/g, '');
  const h2 = html.indexOf('<h2', h1s);
  const lead = html.slice(h1s, h2)
    .replace(/<!-- NB_BYLINE_START -->[\s\S]*?<!-- NB_BYLINE_END -->/, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { title, canonical, h1, lead: crypto.createHash('sha1').update(lead).digest('hex') };
}

const page = (slug) => fs.readFileSync(path.join(ROOT, 'features', `${slug}.html`), 'utf8');

test('確認メモを足した6本で、題・URL・大見出し・冒頭が変わっていない', () => {
  for (const [slug, want] of Object.entries(FROZEN)) {
    assert.deepStrictEqual(parts(page(slug)), want, slug);
  }
});

test('6本とも確認メモの区画が1つあり、確認できた項目だけを載せ、推測で埋めていない', () => {
  for (const slug of Object.keys(FROZEN)) {
    const html = page(slug);
    assert.strictEqual((html.match(/NB_CONFIRM_MEMO_START/g) || []).length, 1, slug);
    const memo = MEMO_RE.exec(html)[0];
    assert.ok(/data-nb-confirm-memo/.test(memo), slug);
    // 確認できなかった項目は出さない（2026-11-23 本人の依頼・Ondine #2576）。予約可否はデータが無いので載らない
    assert.ok(!/未確認|nb-confirm-un|予約・混雑/.test(memo), `${slug}: 未確認の項目を出していない`);
    assert.ok(/確認日/.test(memo), slug);
    // 区画は店カードの外・題の前（本文の最初の見出し）より後ろにあり、店カードの中に入っていない
    assert.ok(html.indexOf('NB_CONFIRM_MEMO_START') > html.indexOf('<h1'), slug);
  }
});

test('確認メモ以外の部分は、確認メモを外すと、足す前の姿に戻せる（区画が独立している）', () => {
  for (const slug of Object.keys(FROZEN)) {
    const without = page(slug).replace(MEMO_RE, '');
    assert.ok(!/nb-confirm/.test(without.replace(/<style>[\s\S]*?<\/style>/g, '')), slug);
  }
});

test('確認メモの生成は2回当てても変わらない（冪等）', () => {
  const { apply } = require('../scripts/apply_confirmation_memo');
  const stores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));
  const byId = new Map();
  for (const s of stores) if (s['ホットペッパーID']) byId.set(s['ホットペッパーID'], s);
  for (const slug of Object.keys(FROZEN)) {
    const once = apply(page(slug), byId);
    assert.strictEqual(apply(once, byId), once, slug);
  }
});

test('行事・季節が終わった特集4本は、消さずに「内容は終わった行事・季節のもの」と冒頭に注記している', () => {
  for (const slug of ['gw-2026', 'mothers-day', 'fathers-day-2026', 'nagoya-summer-2026']) {
    const html = page(slug);
    assert.strictEqual((html.match(/data-nb-season-over/g) || []).length, 1, slug);
    assert.ok(/行事は終わりました|季節は過ぎました/.test(html), slug);
    assert.ok(html.indexOf('data-nb-season-over') > html.indexOf('<h1'), slug);
    assert.ok(!/noindex/.test(html), `${slug}: 検索に出さない設定は本人の確認まで入れない`);
  }
});

test('編集規約は、AIが収集・執筆・検査・公開することと、人のレビュワーの募集停止を書いている', () => {
  const ep = page('editorial-policy');
  assert.ok(/id="ai-operation"/.test(ep));
  assert.ok(/AIが行っています/.test(ep));
  assert.ok(/募集を停止/.test(ep));
  assert.ok(!/AIが集めた情報の一部（選定理由など）は、確認してから載せる/.test(ep), '人が確認して載せるという古い文は残さない');
  assert.ok(!/未確認の店舗情報は掲載しない/.test(ep));
  const rv = page('become-reviewer');
  assert.ok(/募集を停止/.test(rv));
  assert.ok(!/編集部に応募する/.test(rv));
  const llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
  assert.ok(/AIが行っている/.test(llms));
  const about = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8');
  assert.ok(/ai-operation/.test(about));
});

test('特集の構造化データの書き手（Organization）に、AIが書いている実態の説明が付いている', () => {
  const dir = path.join(ROOT, 'features');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!/"author"\s*:\s*\{/.test(html)) continue;
    assert.ok(/"author"\s*:\s*\{[^}]*"description"\s*:\s*"記事の収集・執筆・検査・公開はAIが行い/.test(html), f);
  }
});
