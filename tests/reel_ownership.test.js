'use strict';

/**
 * カードに出すリール動画の所有者検証テスト。
 *
 * 守りたい一点:「その店を写していない動画が、その店のカードに出ない」こと。
 * 投稿者が誰か（公式アカかインフルエンサーか）は問わない。
 *
 * 実際に起きていた事故:
 *   - popular      → ブランドの異なる 25 店に同じアカウントが紐づいていた
 *   - yuichi5016   → 個人アカウントが無関係な複数店に紐づいていた
 *   - shinjidai_phads → 運営会社アカに「新時代」と「一軒め酒場」が混在していた
 * これらは「どの店の動画か決められない」ため、機械的に遮断する。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { audit, sameBrand, normH, evidenceFor } = require('../scripts/audit_reel_ownership.js');
const { loadStores } = require('../scripts/lib/load_stores.js');

const stores = loadStores();
const { results, byPost, byUrl } = audit(stores);
const passed = results.filter(r => r.verdict.startsWith('PASS'));

test('リール: ブランドが割れている共有アカウント由来を1件も通さない', () => {
  const leaked = passed.filter(r => {
    const names = byPost.get(normH(r.postHandle)) || [];
    return names.length > 1 && !sameBrand(names);
  });
  assert.equal(leaked.length, 0,
    `別ブランドと共有のアカウント由来が通過: ${leaked.slice(0, 5).map(r => `${r.store}←${r.postHandle}`).join(', ')}`);
});

test('リール: 実際に事故を起こしたアカウントを通さない', () => {
  for (const handle of ['popular', 'yuichi5016', 'shinjidaiphads', 'gassyosennin']) {
    const leaked = passed.filter(r => normH(r.postHandle) === handle);
    assert.equal(leaked.length, 0, `${handle} 由来が ${leaked.length} 件通過している`);
  }
});

test('リール: 通過したものは投稿アカが登録アカと一致 or 同一ブランド接頭辞（証跡ありは除く）', () => {
  const bad = passed.filter(r => {
    if (r.evidence) return false;   // 証跡があるものは投稿者が誰でもよい
    const p = normH(r.postHandle), a = normH(r.acctHandle);
    return !(p === a || p.startsWith(a) || a.startsWith(p));
  });
  assert.equal(bad.length, 0,
    `照合できない組み合わせが通過: ${bad.slice(0, 5).map(r => `${r.store}: ${r.acctHandle}≠${r.postHandle}`).join(', ')}`);
});

test('同じ1本の投稿を別ブランドの複数店で共有したまま通さない', () => {
  const leaked = passed.filter(r => {
    const holders = byUrl.get(r.url) || [];
    return holders.length > 1 && !sameBrand(holders);
  });
  assert.equal(leaked.length, 0,
    `同一投稿の重複割当が通過: ${leaked.slice(0, 3).map(r => `${r.store}←${r.url}`).join(', ')}`);
});

test('写真投稿(/p/)にもリールと同じ所有者検証がかかっている', () => {
  const photos = results.filter(r => r.kind === 'p');
  assert.ok(photos.length > 0, '写真投稿が検証対象になっていない');
  const blockedPhotos = photos.filter(r => !r.verdict.startsWith('PASS'));
  assert.ok(blockedPhotos.length > 0, '写真投稿が1件も遮断されていない（ゲート未適用の疑い）');
});

test('証跡があれば第三者アカの投稿も通す（インフルエンサー投稿の解禁経路）', () => {
  // キャプションに店名が入っていれば、投稿者が無関係なアカウントでも通ること
  const store = { '店名': 'テスト居酒屋 栄店', 'Instagram': 'https://www.instagram.com/testizakaya/' };
  assert.equal(evidenceFor(store, { caption: '今日は テスト居酒屋 に行ってきた' }), 'caption');
  assert.equal(evidenceFor(store, { location: 'テスト居酒屋' }), 'location');
  assert.equal(evidenceFor(store, { caption: '最高でした @testizakaya' }), 'mention');
  // 別の店の話しか書かれていなければ通さない
  assert.equal(evidenceFor(store, { caption: '別の店の紹介です' }), '');
  assert.equal(evidenceFor(store, null), '');
});

test('リール: 出せる本数が枯れていない（データ経路の断線検知）', () => {
  assert.ok(passed.length > 1000, `カードに出せるリールが少なすぎる: ${passed.length}`);
});

test('index.html: ランタイム側のゲートが外れていない', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const marker of ['function nbVerifiedReel', 'function nbSameBrand', 'nbVerifiedReel(r)']) {
    assert.ok(html.includes(marker), `index.html から ${marker} が消えている`);
  }
  // カード・モーダルの双方が検証を通していること
  assert.ok(html.includes("if (igPost && !nbVerifiedReel(r)) igPost = '';"),
    'モーダル側の投稿検証が外れている');
  assert.ok(html.includes("r['動画証跡']"), 'ランタイム側の証跡経路が外れている');
});

test('sameBrand: 同一ブランドは通し、別ブランドは弾く', () => {
  assert.ok(sameBrand(['鳥貴族 錦三袋町通店', '鳥貴族 広小路伏見店', '鳥貴族 いりなか店']));
  assert.ok(sameBrand(['餃子のかっちゃん 栄錦店', '餃子のかっちゃん 栄住吉店']));
  assert.equal(sameBrand(['イベントバー エデン名古屋', '韓流居酒屋 RED酒場', 'あつた蓬莱軒 松坂屋店']), false);
  assert.equal(sameBrand(['新時代 藤が丘駅前店', '一軒め酒場 伏見店']), false);
});
