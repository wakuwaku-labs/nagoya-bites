'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'scripts', 'lib', 'x_follow_cta.js'));
const W = require(path.join(ROOT, 'scripts', 'write_x_draft.js'));
const X = require(path.join(ROOT, 'scripts', 'lib', 'x_post.js'));

test('x_follow_cta: UTM つきのリンクが URL として開ける', () => {
  for (const kind of ['journal', 'feature']) {
    const u = new URL(C.followUrl(kind));
    assert.equal(u.origin + u.pathname, 'https://x.com/NAGOYABITES');
    assert.equal(u.searchParams.get('utm_source'), 'web');
    assert.equal(u.searchParams.get('utm_medium'), 'follow_cta');
    assert.equal(u.searchParams.get('utm_campaign'), kind);
  }
});

test('x_follow_cta: 冪等で、共通フッターの直前に1つだけ入る', () => {
  const html = '<main><article>a</article>\n<!-- NB-CHROME:FOOTER:START -->\n</main>';
  const once = C.applyFollowCta(html, 'journal');
  assert.equal(C.applyFollowCta(once, 'journal'), once);
  assert.equal(once.split('nb-follow-cta').length - 1, 1);
  assert.ok(once.indexOf(C.START) < once.indexOf('NB-CHROME:FOOTER:START'));
  assert.equal(C.applyFollowCta('<p>no anchor</p>', 'journal'), '<p>no anchor</p>');
});

test('x_follow_cta: 一覧と記事でないページは対象外', () => {
  assert.equal(C.kindOf('journal/index.html', '</article>'), null);
  assert.equal(C.kindOf('features/index.html', '</article>'), null);
  assert.equal(C.kindOf('features/x.html', '<p>'), null);
  assert.equal(C.kindOf('features/x.html', '</article>'), 'feature');
  assert.equal(C.kindOf('features/x.html', '<main></main><!-- NB-CHROME:FOOTER:START -->'), 'feature');
  assert.equal(C.kindOf('journal/2026-01-01-a.html', '</article>'), 'journal');
});

test('x_follow_cta: 全ての日次記事と特集に当たっている（node scripts/apply_x_follow_cta.js）', () => {
  const missing = [];
  for (const dir of ['journal', 'features']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(n => n.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
      const kind = C.kindOf(`${dir}/${f}`, html);
      if (kind && C.applyFollowCta(html, kind) !== html) missing.push(`${dir}/${f}`);
    }
  }
  assert.deepStrictEqual(missing.slice(0, 5), [], `${missing.length}本に未反映`);
});

test('x_follow_cta: 新しい記事の元（journal/_template.html）にも入っている', () => {
  const t = fs.readFileSync(path.join(ROOT, 'journal', '_template.html'), 'utf8');
  assert.equal(C.applyFollowCta(t, 'journal'), t);
});

test('x_follow_cta: 見た目は既存トークンだけ（font-size のリテラルを足していない）', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'nb.css'), 'utf8');
  const rules = css.split('\n').filter(l => l.startsWith('.nb-follow-cta'));
  assert.ok(rules.length >= 1);
  for (const r of rules) assert.ok(!/font-size:\s*[\d.]+(px|rem|em)/.test(r), r);
});

test('series: 曜日にシリーズが割り当たり、期間限定は月が外れたら替わる', () => {
  const policy = X.loadPolicy(ROOT);
  assert.equal(W.seriesFor('2026-11-13', policy).name, '忘年会幹事'); // 金
  assert.equal(W.seriesFor('2026-10-30', policy).name, '駅ごとのひとり飲み'); // 金・10月は替わる
  assert.equal(W.seriesFor('2026-11-09', policy).name, '行く前に'); // 月
  assert.equal(W.seriesFor('2026-11-14', policy).name, '行く前に'); // 土
  assert.equal(W.seriesFor('2026-11-15', policy).name, '今週の新店・閉店'); // 日
  for (let d = 1; d <= 7; d++) assert.ok(W.seriesFor(`2026-11-0${d}`, policy), `11-0${d}`);
  assert.equal(W.seriesFor('2026-11-13', { ...policy, series: { ...policy.series, enabled: false } }), null);
  assert.equal(W.seriesFor('bad', policy), null);
});

test('series: 指示の節に出るが、投稿の数・時刻・上限（postSlot・maxReplies）は変えない', () => {
  const policy = X.loadPolicy(ROOT);
  const sec = W.seriesSection('2026-11-13', policy).join('\n');
  assert.match(sec, /シリーズ「忘年会幹事」/);
  assert.match(sec, /ランキング/);
  assert.equal(policy.postSlot.weekday, '11:30');
  assert.equal(policy.draft.maxReplies, 3);
  assert.deepStrictEqual(W.seriesSection('2026-11-13', { ...policy, series: { enabled: false } }), []);
});
