'use strict';
// SEO-137: ジャーナルの title の前30字に「エリア＋店名かジャンル＋シーン語」を置く規則の検査
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { checkTitleFront, titleBody, TITLE_FRONT } = require('../scripts/journal_seo_kw');
const { report, checkTitles, aggregate } = require('../scripts/journal_title_experiment');

const ROOT = path.resolve(__dirname, '..');
const EXP = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/journal_title_experiment.json'), 'utf8'));
const strip = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function articleFacts(rel) {
  const h = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const names = [...new Set([...h.matchAll(/class="store-name"[^>]*>([\s\S]*?)<\//g)].map(m => strip(m[1]))
    .concat([...h.matchAll(/data-hero-store="([^"]*)"/g)].map(m => m[1])))].filter(Boolean);
  const desc = (h.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1];
  const h1 = strip((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1]);
  return { html: h, names, context: `${h1}\n${desc}` };
}

test('title の本体: 末尾の「｜NAGOYA BITES Journal」を外し、前30字で判定する', () => {
  assert.strictEqual(titleBody('栄の居酒屋「A」｜NAGOYA BITES Journal'), '栄の居酒屋「A」');
  assert.strictEqual(titleBody('栄の居酒屋「A」｜NAGOYA BITES'), '栄の居酒屋「A」');
  assert.strictEqual(TITLE_FRONT.chars, 30);
  const r = checkTitleFront('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほ栄の居酒屋｜NAGOYA BITES Journal');
  assert.strictEqual(r.front.length, 30);
  assert.ok(r.missing.includes('エリア語'), '31字目以降の地名は数えない');
});

test('エリア語: エリアの語・愛知県内の駅名・名古屋を数える', () => {
  assert.strictEqual(checkTitleFront('栄の居酒屋で').area, '栄');
  assert.strictEqual(checkTitleFront('鶴里駅1分の焼きそば').area, '鶴里');
  assert.strictEqual(checkTitleFront('名古屋初出店のカフェ').area, '名古屋');
  assert.deepStrictEqual(checkTitleFront('北京飯980円はコスパか').missing.slice(0, 1), ['エリア語']);
});

test('店名: 末尾の支店名は外し、屋号が「店」で終わる名前は残す。ジャンル語でも満たす', () => {
  const pekin = checkTitleFront('北京本店（名古屋・ナゴヤドーム前）北京飯980円', { storeNames: ['北京本店 イオンモールナゴヤドーム前店'] });
  assert.strictEqual(pekin.store, '北京本店');
  const sawee = checkTitleFront('サウィ食堂 名古屋栄店、東海初上陸', { storeNames: ['サウィ食堂 名古屋栄店'] });
  assert.ok(sawee.store && sawee.store.startsWith('サウィ食堂'));
  assert.strictEqual(checkTitleFront('Pizzeria mimi（ピッツェリア ミミ）名古屋・車道', { storeNames: ['Pizzeria mimi'] }).store, 'pizzeria mimi', '英字は大文字小文字を区別しない');
  const genreOnly = checkTitleFront('栄の韓国料理食べ放題2,500円と5,000円');
  assert.strictEqual(genreOnly.genre, '韓国料理');
  assert.ok(!genreOnly.missing.includes('店名かジャンル語'));
  assert.ok(checkTitleFront('栄で読む、開店の話').missing.includes('店名かジャンル語'));
});

test('シーン語: 記事（h1・description）にシーンがあるときだけ前30字に求める。業界人・カウンターは数えない', () => {
  const t = '錦の名古屋めし食堂 丸八 伏見別邸、手羽先も味噌かつも一会計の宴会';
  assert.ok(checkTitleFront(t, { context: '最大60名貸切を宴会幹事の目で読む' }).missing.some(m => m.startsWith('シーン語')));
  assert.ok(checkTitleFront('名古屋めし食堂 丸八 伏見別邸（錦）最大60名の貸切宴会', { storeNames: ['名古屋めし食堂 丸八 伏見別邸'], context: '宴会幹事' }).ok);
  assert.ok(checkTitleFront('栄の居酒屋「A」29席', { context: '24席・カウンターなし' }).ok, '「カウンターなし」でシーン語を求めない');
  assert.strictEqual(checkTitleFront('業界人が読む栄の居酒屋「A」').scene, null, '「業界人」はシーンに数えない');
  assert.ok(checkTitleFront('栄の居酒屋「A」', { context: '' }).ok, 'シーンの無い題材にシーン語を求めない');
});

test('validate_journal_draft.js の項目18は WARNING だけで、公開を止めない', () => {
  const { checkJournal } = require('../scripts/validate_journal_draft');
  const rel = EXP.pages[0].path;
  const r = checkJournal(path.join(ROOT, rel)).find(x => x.id === '18_title_front_warn');
  assert.ok(r, '項目18がある');
  assert.strictEqual(r.ok, true);
});

test('効果比較の台帳: 書き換えた title が今のページと一致し、規則を満たし、店名を含む', () => {
  assert.deepStrictEqual(checkTitles(EXP), []);
  const changed = EXP.pages.filter(p => p.changed);
  assert.ok(changed.length >= 1 && EXP.pages.length <= 20, '書き換えは上位20本の中だけ');
  for (const p of changed) {
    const f = articleFacts(p.path);
    const r = checkTitleFront(p.after, { storeNames: f.names, context: f.context });
    assert.ok(r.ok, `${p.path}: ${r.missing.join('・')}`);
    assert.notStrictEqual(p.after, p.before);
    assert.ok(p.after.length <= 50, `${p.path}: 長すぎる（${p.after.length}字・目安は50字以内）`);
    const og = (f.html.match(/<meta property="og:title" content="([^"]*)"/) || [, ''])[1];
    assert.strictEqual(og, `${p.after}｜NAGOYA BITES`, `${p.path}: og:title も同じ title`);
  }
  // 書き換えなかった記事は、規則を満たし、CTR がジャーナル全体以上（選び方の記録どおり）
  for (const p of EXP.pages.filter(x => !x.changed)) {
    assert.strictEqual(p.after, p.before);
    assert.strictEqual(p.beforeFront, 'ok');
    assert.ok(p.baseline.ctr >= EXP.baseline.journal.ctr, `${p.path}: CTR が平均未満なのに書き換えていない`);
  }
});

test('比較の表: 基線と今を、書き換えた記事・参照・新規記事・ジャーナル全体で並べる', () => {
  assert.deepStrictEqual(aggregate([{ impressions: 100, clicks: 2, position: 8 }, { impressions: 300, clicks: 9, position: 10 }]),
    { pages: 2, impressions: 400, clicks: 11, ctr: 0.0275, position: 9.5 });
  const exp = {
    changedOn: '2026-10-09', baseline: { dateRange: { startDate: 'a', endDate: 'b' }, journal: { ctr: 0.03 } },
    pages: [
      { path: 'journal/2026-08-01-a.html', changed: true, baseline: { impressions: 100, clicks: 1, ctr: 0.01, position: 9 } },
      { path: 'journal/2026-08-02-b.html', changed: false, baseline: { impressions: 50, clicks: 5, ctr: 0.1, position: 5 } },
    ],
  };
  const gsc = {
    dateRange: { startDate: 'c', endDate: 'd' }, pageTypes: { journal: { ctr: 0.04 } },
    pages: [
      { page: 'https://nagoya-bites.com/journal/2026-08-01-a.html', impressions: 200, clicks: 8, position: 7 },
      { page: 'https://nagoya-bites.com/journal/2026-10-20-new.html', impressions: 40, clicks: 2, position: 6 },
      { page: 'https://nagoya-bites.com/journal/2026-10-09-same-day.html', impressions: 10, clicks: 0, position: 9 },
    ],
  };
  const r = report(exp, gsc);
  assert.strictEqual(r.changed.now.ctr, 0.04);
  assert.strictEqual(r.changed.before.ctr, 0.01);
  assert.deepStrictEqual(r.reference.missing, ['journal/2026-08-02-b.html']);
  assert.strictEqual(r.new_articles.now.pages, 1, '書き換えた日より後に公開した記事だけ');
  assert.strictEqual(r.journal.now.ctr, 0.04);
});

test('data/journal_seo_keywords.json の規則が判定器の設定と一致する', () => {
  const kw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/journal_seo_keywords.json'), 'utf8'));
  assert.deepStrictEqual(kw.title_front, TITLE_FRONT);
  assert.match(kw.rules.title_front, /前30字/);
});
