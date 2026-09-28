'use strict';
/**
 * ジャーナルの出典の偏り（同じ二次媒体の後追い）の判定
 * 基準: data/journal_source_diversity_policy.json / 判定器: scripts/lib/journal_source_diversity.js
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SD = require(path.join(ROOT, 'scripts/lib/journal_source_diversity.js'));
const { scoreAll } = require(path.join(ROOT, 'scripts/score_journal_candidates.js'));

const POLICY = { window_days: 30, min_articles: 3, saturation_share: 0.3,
  exempt_domains: { primary: ['prtimes.jp'], listing: ['tabelog.com'], social: ['x.com'] } };

function article(hrefs) {
  return `<p>本文 <a href="https://jouhou.nagoya/ignored/">本文中のリンクは数えない</a></p>
<div class="source-note"><strong>情報源:</strong> ${hrefs.map(h => `<a href="${h}">s</a>`).join(' / ')}</div>`;
}

function fixtureDir(articles) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-sd-'));
  articles.forEach(([name, hrefs]) => fs.writeFileSync(path.join(dir, name), article(hrefs)));
  return dir;
}

test('情報源欄の href だけを数え、一次発表・店舗ページ・SNSは飽和判定の対象外', () => {
  const dir = fixtureDir([
    ['2026-09-20-a.html', ['https://jouhou.nagoya/a/', 'https://prtimes.jp/1', 'https://x.com/1']],
    ['2026-09-21-b.html', ['https://jouhou.nagoya/b/', 'https://prtimes.jp/2', 'https://tabelog.com/1']],
    ['2026-09-22-c.html', ['https://www.jouhou.nagoya/c/', 'https://prtimes.jp/3', 'https://nagoyato.com/c']],
    ['2026-09-23-d.html', ['https://prtimes.jp/4', 'https://note.com/d']]
  ]);
  const r = SD.measure({ policy: POLICY, today: '2026-09-28', journalDir: dir });
  assert.strictEqual(r.articles, 4);
  assert.deepStrictEqual(r.saturated, ['jouhou.nagoya']); // 3/4=75%。prtimes は100%でも対象外
  assert.ok(!r.shares.some(s => s.host === 'prtimes.jp' || s.host === 'x.com' || s.host === 'tabelog.com'));
});

test('記事数が min_articles 未満のうちは判定しない／窓の外と当日は数えない', () => {
  const dir = fixtureDir([
    ['2026-07-01-old.html', ['https://jouhou.nagoya/x/']],
    ['2026-09-28-today.html', ['https://jouhou.nagoya/y/']],
    ['2026-09-20-a.html', ['https://jouhou.nagoya/a/']],
    ['2026-09-21-b.html', ['https://jouhou.nagoya/b/']]
  ]);
  const r = SD.measure({ policy: POLICY, today: '2026-09-28', journalDir: dir });
  assert.strictEqual(r.articles, 2);
  assert.deepStrictEqual(r.saturated, []);
});

test('飽和媒体は独立ドメイン数に数えないが、出典に書くこと自体は減点しない', () => {
  const cand = { id: 'c1', theme: 'today_one', title_draft: 't', angle: '', lead_draft: '',
    sources: [
      { url: 'https://jouhou.nagoya/a/', date: '2026-09-27' },
      { url: 'https://prtimes.jp/a', date: '2026-09-26' },
      { url: 'https://nagoyato.com/a', date: '2026-09-26' }
    ] };
  const base = scoreAll([cand], { today: '2026-09-28', published: { entries: [] }, diversity: { saturated: [] } });
  const div = scoreAll([cand], { today: '2026-09-28', published: { entries: [] }, diversity: { saturated: ['jouhou.nagoya'] } });
  const t0 = base.ranked[0].breakdown.topicality;
  const t1 = div.ranked[0].breakdown.topicality;
  assert.ok(t1 < t0, `3ドメイン→2ドメイン扱いで下がる (${t0} → ${t1})`);
  assert.strictEqual(t0 - t1, 4); // 12 → 8。減点ではなく「数えない」だけ
  const other = { ...cand, id: 'c2', sources: cand.sources.filter(s => !s.url.includes('jouhou')) };
  const noJ = scoreAll([other], { today: '2026-09-28', published: { entries: [] }, diversity: { saturated: ['jouhou.nagoya'] } });
  assert.strictEqual(noJ.ranked[0].breakdown.topicality, t1); // 書いても書かなくても同点＝書くことは罰しない
  assert.deepStrictEqual(div.saturated_sources, ['jouhou.nagoya']);
});
