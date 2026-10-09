'use strict';
// SEO-102: 同じジャンルの特集が2〜3本あるもの（焼肉・焼き鳥・バー）へ、ジャーナルの記事タイトルの語で
// 振り分けてリンクを届ける。振り分け表は scripts/lib/journal_topics.js の1本で、関連記事
// （refresh_journal_related.js）と本文冒頭の「合わせて読む」（inject_journal_feature_cta.js）が共有する。
// あわせて、バーの特集3本の掲載店を記事の約束（カクテル・ワイン・ダイニングバー）にそろえる選定条件も見る。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { TOPIC_FEATURES } = require('../scripts/lib/journal_topics');
const { matchTopicFeature, hasOwnHubs, hubSlugFor } = require('../scripts/refresh_journal_related');
const { sceneMatch } = require('../scripts/refresh_feature_rosters');
const rosters = require('../data/feature_rosters.json');

const ROOT = path.join(__dirname, '..');
const slugOf = (title) => (matchTopicFeature(title) || {}).slug || null;
const BARS = ['nagoya-bar', 'nagoya-bar-guide', 'nagoya-dining-bar'];

test('振り分け表の特集はすべて実在し、まとまりは表の中の特集を指す', () => {
  const slugs = new Set(TOPIC_FEATURES.map((r) => r[1]));
  for (const [re, slug, label, group] of TOPIC_FEATURES) {
    assert.ok(re instanceof RegExp && !re.global && !re.sticky, slug); // test() が lastIndex を持ち越さない
    assert.ok(fs.existsSync(path.join(ROOT, 'features', `${slug}.html`)), slug);
    assert.ok(label, slug);
    if (group) assert.ok(slugs.has(group), `${slug} → ${group}`);
  }
});

test('inject_journal_feature_cta.js も同じ表を使う（表を2本持たない）', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'inject_journal_feature_cta.js'), 'utf8');
  assert.match(src, /require\('\.\/lib\/journal_topics'\)/);
  assert.doesNotMatch(src, /const TOPIC_FEATURES = \[/);
});

test('焼肉・焼き鳥: 記事の語で2本の特集に振り分ける', () => {
  assert.equal(slugOf('覚王山・池下に焼肉の新顔'), 'nagoya-yakiniku-guide');
  assert.equal(slugOf('ホルモンの名店'), 'nagoya-yakiniku-guide');
  assert.equal(slugOf('名駅で松阪牛の肉割烹'), 'nagoya-yakiniku');
  assert.equal(slugOf('和牛焼肉の新店'), 'nagoya-yakiniku'); // 和牛の行が先
  assert.equal(slugOf('名古屋コーチンの見分け方'), 'nagoya-yakitori-guide');
  assert.equal(slugOf('地鶏の炭火焼き'), 'nagoya-yakitori-guide');
  assert.equal(slugOf('栄の焼き鳥の新店'), 'nagoya-yakitori');
  assert.equal(slugOf('串焼きの立ち飲み'), 'nagoya-yakitori');
  assert.equal(slugOf('四間道のひつまぶし'), 'nagoya-hitsumabushi'); // SEO-091 の振り分けを保つ
});

test('バー: 3本の特集に振り分け、バーガー・メンバー・ライバル等を拾わない', () => {
  assert.equal(slugOf('ワインバーの新店'), 'nagoya-bar-guide');
  assert.equal(slugOf('栄のバーで一杯'), 'nagoya-bar-guide');
  assert.equal(slugOf('オーセンティックバーの流儀'), 'nagoya-bar');
  assert.equal(slugOf('カクテルの名店'), 'nagoya-bar');
  assert.equal(slugOf('錦のダイニングバー'), 'nagoya-dining-bar');
  assert.equal(slugOf('スペインバルが開店'), 'nagoya-dining-bar');
  assert.equal(slugOf('肉バルの新店'), 'nagoya-dining-bar');
  for (const t of ['クラフトバーガーの新店', 'メンバー限定の会', 'ナンバーワンの味', 'サーバーから注ぐ', 'カバーチャージ無し', 'ライバル店', 'グローバル展開', 'バルコニー席']) {
    assert.ok(!BARS.includes(slugOf(t)), `${t} → ${slugOf(t)}`);
  }
});

test('ハブ: 分けた特集に自分のハブが無ければ、まとまりの代表のハブを引く', () => {
  assert.equal(hubSlugFor({ slug: 'no-such-feature', group: 'nagoya-yakiniku' }), 'nagoya-yakiniku');
  assert.equal(hubSlugFor({ slug: 'no-such-feature' }), 'no-such-feature');
  // 表の中で「まとまり」を持つ行は、本人か代表のどちらかがハブを持つ（分けたことでハブへのリンクを失わない）
  for (const [, slug, , group] of TOPIC_FEATURES) {
    if (!group) continue;
    const hub = hubSlugFor({ slug, group });
    assert.ok(hub === slug || hub === group, slug);
    if (hasOwnHubs(group)) assert.ok(hasOwnHubs(hub), `${slug} → ${hub}`);
  }
});

test('バー3本の選定: 記事の約束（カクテル・ワイン・ダイニングバー）を守り、シーシャ・ポーカー等の店を載せない', () => {
  const [bar, wine, dining] = BARS.map((s) => rosters.features[s].scene);
  const base = { '店名': 'バー なにがし', 'ジャンル': 'バー・カクテル', 'タグ': 'バー', 'おすすめポイント': '' };
  // カクテル: ジャンル名「バー・カクテル」のカクテルだけでは通さない（数えると同じジャンルの店が全部通る）
  assert.equal(sceneMatch(base, bar), null);
  assert.ok(sceneMatch({ ...base, 'おすすめポイント': 'オリジナルカクテルが評判' }, bar));
  assert.ok(sceneMatch({ ...base, 'おすすめポイント': 'シングルモルトの品揃え' }, bar));
  assert.equal(sceneMatch({ ...base, 'おすすめポイント': '4500円のシーシャバーでカクテルも' }, bar), null);
  assert.equal(sceneMatch({ ...base, '店名': 'POKER BAR X', 'おすすめポイント': 'カクテル' }, bar), null);
  assert.equal(sceneMatch({ ...base, 'ジャンル': 'ハンバーガー', 'おすすめポイント': 'カクテル' }, bar), null);
  // ワイン: 紹介文にワインの語がある店だけ
  assert.equal(sceneMatch({ ...base, 'おすすめポイント': 'カクテル' }, wine), null);
  assert.ok(sceneMatch({ ...base, 'ジャンル': 'ダイニングバー・バル', 'おすすめポイント': 'ナチュールワインの品揃え' }, wine));
  assert.equal(sceneMatch({ ...base, 'ジャンル': 'ダイニングバー・バル', 'おすすめポイント': 'ワインとダーツ' }, wine), null);
  // ダイニングバー: ホットペッパーのジャンルがダイニングバー・バルの店だけ
  assert.equal(sceneMatch({ ...base, 'おすすめポイント': '料理が充実' }, dining), null);
  assert.ok(sceneMatch({ ...base, 'ジャンル': 'ダイニングバー・バル' }, dining));
  assert.equal(sceneMatch({ ...base, 'ジャンル': 'ダイニングバー・バル', '店名': 'シーシャ Lounge' }, dining), null);
  // 紹介文で外す条件はバー3本だけ（ほかの特集の選定は変えない）
  for (const [slug, f] of Object.entries(rosters.features)) {
    if (!BARS.includes(slug)) assert.equal(f.scene.excludeText, undefined, slug);
  }
});
