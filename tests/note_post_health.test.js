'use strict';
// note 自動投稿の見張り役（scripts/check_note_post_health.js・P-638）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { check, issueBody, parseRss } = require('../scripts/check_note_post_health');

const SLUG = '2026-10-23-test';
const TITLE = '伏見の店で読む、二軒目の入り方';
const NOW = new Date('2026-10-23T04:00:00Z'); // 13:00 JST

function fixture({ mode = 'live', health = null, published = '2026-10-23T08:00:00+09:00' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'notewd-'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.mkdirSync(path.join(root, 'journal'));
  const policy = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/note_post_policy.json'), 'utf8'));
  fs.writeFileSync(path.join(root, 'data/note_post_policy.json'), JSON.stringify({ ...policy, mode, liveSince: '2026-10-22' }));
  fs.writeFileSync(path.join(root, 'data/journal_published.json'), JSON.stringify({ entries: [
    { slug: '2026-10-01-old', date: '2026-10-01', title: '古い記事', published_at: '2026-10-01T08:00:00+09:00' },
    { slug: SLUG, date: '2026-10-23', title: '公開記録の題名', published_at: published },
  ] }));
  // note の題名は記事の h1 から作る（post_note.js と同じ）。公開の記録の題名とは別物にしておく
  fs.writeFileSync(path.join(root, 'journal', `${SLUG}.html`), `<h1 class="art-title">伏見の店で<em>読む</em>、二軒目の入り方</h1>`);
  fs.writeFileSync(path.join(root, 'data/note_post_health.json'), JSON.stringify({ last_run: health }));
  return root;
}

const rssWith = (...titles) => `<?xml version="1.0"?><rss version="2.0"><channel><title>NAGOYA BITES</title>${
  titles.map((t, i) => `<item><title>${t}</title><link>https://note.com/nagoya_bites/n/n${i}</link><pubDate>Fri, 23 Oct 2026 09:40:00 +0900</pubDate></item>`).join('')}</channel></rss>`;

test('RSS: 題名と URL を取り出す（実体参照も戻す）', () => {
  const items = parseRss(rssWith('A &amp; B', TITLE));
  assert.deepStrictEqual(items.map((i) => i.title), ['A & B', TITLE]);
  assert.strictEqual(items[1].link, 'https://note.com/nagoya_bites/n/n1');
});

test('note に記事が出ていれば OK（題名は記事の h1 で照合し、空白の違いは無視）', () => {
  const r = check({ root: fixture(), now: NOW, rss: rssWith('別の記事', ` ${TITLE} `) });
  assert.strictEqual(r.ok, true, JSON.stringify(r.problems));
});

test('mode が live でなければ鳴らさない', () => {
  const r = check({ root: fixture({ mode: 'draft' }), now: NOW, rss: rssWith() });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.status, 'not_live');
});

test('出ていない・猶予を過ぎた → missing_post（Mac の記録が無いことを理由に書く）', () => {
  const r = check({ root: fixture(), now: NOW, rss: rssWith('別の記事') });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.problems.length, 1);
  assert.strictEqual(r.problems[0].kind, 'missing_post');
  assert.match(r.problems[0].reason, /送信の記録がない/);
  assert.match(issueBody(r), /note-fail\/2026-10-23\.png/);
});

test('猶予の内なら missing_post では鳴らさない', () => {
  const r = check({ root: fixture({ published: '2026-10-23T12:00:00+09:00' }), now: NOW, rss: rssWith() });
  assert.strictEqual(r.ok, true);
});

test('未ログイン・別アカウントは猶予を待たずに human_action で鳴らし、直し方を書く', () => {
  const health = { date: '2026-10-23', slug: SLUG, result: 'failed', error_class: 'login', reason: '投稿先のアカウントが違います（今: 未ログイン / 必要: NAGOYA BITES）', recorded_at: '2026-10-23T00:40:00Z' };
  const r = check({ root: fixture({ health, published: '2026-10-23T12:00:00+09:00' }), now: NOW, rss: rssWith() });
  assert.strictEqual(r.problems[0].kind, 'human_action');
  assert.match(issueBody(r), /note_login\.js --google/);
});

test('検査落ちは blocked で鳴らす', () => {
  const health = { date: '2026-10-23', slug: SLUG, result: 'blocked', reason: '検査に落ちた: numbers_not_in_article:3', recorded_at: '2026-10-23T00:40:00Z' };
  const r = check({ root: fixture({ health }), now: NOW, rss: rssWith() });
  assert.strictEqual(r.problems[0].kind, 'blocked');
  assert.match(r.problems[0].reason, /numbers_not_in_article/);
});

test('RSS が読めない日は Mac の記録で代える（公開済みなら鳴らさない・記録が無ければ鳴らす）', () => {
  const live = { date: '2026-10-23', slug: SLUG, result: 'live', url: 'https://editor.note.com/notes/x/edit/', recorded_at: '2026-10-23T00:40:00Z' };
  assert.strictEqual(check({ root: fixture({ health: live }), now: NOW, rss: null }).ok, true);
  const r = check({ root: fixture(), now: NOW, rss: null });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.rss, '読めなかった');
});

test('liveSince より前の記事・昨日より前の記事は見ない', () => {
  const r = check({ root: fixture(), now: new Date('2026-10-26T04:00:00Z'), rss: rssWith() });
  assert.strictEqual(r.ok, true);
});
