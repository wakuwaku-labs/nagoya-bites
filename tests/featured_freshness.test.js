'use strict';

/**
 * 特集の鮮度保証カレンダーのガードテスト（scripts/build_featured.js）。
 *
 * 「季節特集が全部期限切れ → ストリップが evergreen だけで陳腐化」事故の再発防止。
 *   - monthlyFeature が 12ヶ月すべてを実在ページで埋めている（鮮度の穴ゼロ）
 *   - showcase / showcasePinned の slug が実在し画像も取得できる
 *   - season.recurring が年に依存せず MM-DD で判定される（翌年も自動復活）
 *   - validateConfig が穴・壊れ参照を検出する
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'featured.json'), 'utf8'));
const {
  isActive, isoWeek, monthOf, selectShowcase, validateConfig,
  parseFeatureCards, listFeatureSlugs,
} = require('../scripts/build_featured.js');

const featMap = parseFeatureCards(fs.readFileSync(path.join(ROOT, 'features', 'index.html'), 'utf8'));
const featureSlugs = listFeatureSlugs();

test('鮮度ガード: validateConfig が穴・壊れ参照を検出しない', () => {
  const errs = validateConfig(cfg, featMap, featureSlugs);
  assert.deepEqual(errs, [], errs.join('\n'));
});

test('monthlyScenes: 12ヶ月すべてが実在ページで埋まっている（鮮度の穴ゼロ）', () => {
  const scenes = cfg.monthlyScenes;
  assert.ok(scenes, 'monthlyScenes が未定義');
  for (let m = 1; m <= 12; m++) {
    const ms = scenes[String(m)];
    assert.ok(ms && Array.isArray(ms.scenes) && ms.scenes.length > 0, `${m}月のシーンが未定義または空`);
    for (const sc of ms.scenes) {
      assert.ok(featureSlugs.has(sc.slug), `${m}月の ${sc.slug}.html が存在しない`);
      assert.ok(sc.title && sc.badge, `${m}月のシーン ${sc.slug} の title/badge が欠落`);
    }
  }
});

test('どの日付でも「今月の旬」シーンが必ず1本以上立つ（年に依存しない）', () => {
  const scenes = cfg.monthlyScenes;
  for (const y of ['2026', '2027', '2030']) {
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const ms = scenes[String(monthOf(`${y}-${mm}-15`))];
      assert.ok(ms && Array.isArray(ms.scenes) && ms.scenes.length > 0, `${y}-${mm} の旬シーンが解決できない`);
      assert.ok(featureSlugs.has(ms.scenes[0].slug), `${y}-${mm} の先頭シーン ${ms.scenes[0].slug}.html が存在しない`);
    }
  }
});

test('showcase/showcasePinned: 全 slug が実在し画像も取得できる', () => {
  for (const e of [...(cfg.showcasePinned || []), ...(cfg.showcase || [])]) {
    assert.ok(featureSlugs.has(e.slug), `${e.slug}.html が存在しない`);
    assert.ok(featMap[e.slug] && featMap[e.slug].img, `${e.slug} の画像が features/index.html から取得できない`);
  }
});

test('showcase: 定番(pinned)は常時表示され、件数は showcaseCount に一致', () => {
  const count = cfg.showcaseCount || 9;
  const pinned = (cfg.showcasePinned || []).map(p => p.slug);
  for (const d of ['2026-01-05', '2026-06-15', '2026-09-21', '2026-12-28']) {
    const picks = selectShowcase(cfg, d).map(p => p.slug);
    assert.equal(picks.length, count, `${d}: 件数が ${picks.length}（期待 ${count}）`);
    for (const p of pinned) assert.ok(picks.includes(p), `${d}: 定番 ${p} が欠落`);
    assert.equal(new Set(picks).size, picks.length, `${d}: 重複あり`);
  }
});

test('showcase: 週が変わると並びが入れ替わる（鮮度ローテーション）', () => {
  const w1 = selectShowcase(cfg, '2026-06-15').map(p => p.slug).join(',');
  const w2 = selectShowcase(cfg, '2026-07-13').map(p => p.slug).join(',');
  assert.notEqual(w1, w2, '週が違っても並びが同じ（ローテーションが効いていない）');
});

test('season.recurring: 年に依存せず MM-DD で判定（翌年も自動復活）', () => {
  const rec = { season: { start: '2026-06-01', end: '2026-08-31', recurring: true } };
  assert.equal(isActive(rec, '2027-07-15'), true, '翌年も期間内は active であるべき');
  assert.equal(isActive(rec, '2030-12-01'), false, '期間外は inactive であるべき');
  // 年跨ぎ（12月→1月）
  const wrap = { season: { start: '2026-12-20', end: '2026-01-05', recurring: true } };
  assert.equal(isActive(wrap, '2031-12-31'), true, '年跨ぎ期間の内側は active');
  assert.equal(isActive(wrap, '2031-06-15'), false, '年跨ぎ期間の外側は inactive');
});

test('isoWeek: 既知の日付で妥当な週番号を返す', () => {
  assert.equal(isoWeek('2026-01-01'), 1);
  assert.ok(isoWeek('2026-06-15') >= 24 && isoWeek('2026-06-15') <= 26);
});
