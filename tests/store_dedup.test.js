'use strict';

/**
 * 重複レコード統合（scripts/lib/store_dedup.js・ISSUE-132 acceptance②③）の単体テスト。
 * HOTPEPPER_API_KEY 不要（build.js を通さずに統合ロジックだけを検査する）。
 *
 * 固定している対は data/stores.json（2026-10-05）の実データ由来。
 *   - 統合すべき: 「尾張山荘 くろぎ」（店名完全一致・片方だけ食べログURL）など
 *   - 統合してはいけない: 区が食い違う / HotPepper が別店として載せている / 1号店と2号店
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dedupeStores, judgePair, mergeGroup, wardOf, looseName } = require('../scripts/lib/store_dedup.js');

const manual = (o) => ({ 'キュレーター': '編集部', '編集部推薦': true, '話題フラグ': true, '話題スコア': 85, ...o });

test('店名完全一致の組は統合され、片方にしか無い食べログURLが残るカードに乗る', () => {
  const a = manual({ '店名': '尾張山荘 くろぎ', 'エリア': '名古屋市中村区', placeId: 'P1', '食べログURL': 'https://tabelog.com/aichi/A2301/A230101/23000001/', 'Instagram': 'https://www.instagram.com/kurogi/', 'おすすめポイント': '編集部の推薦文' });
  const b = { '店名': '尾張山荘 くろぎ', 'エリア': '名駅', placeId: 'P1', '価格帯': '10000円〜', '緯度': '35.1', '経度': '136.8' };
  const r = dedupeStores([a, b]);
  assert.equal(r.stores.length, 1);
  const s = r.stores[0];
  assert.equal(s['食べログURL'], a['食べログURL']);
  assert.equal(s['Instagram'], a['Instagram']);
  assert.equal(s['価格帯'], '10000円〜');
  assert.equal(r.merged.length, 1);
  assert.deepEqual(r.merged[0].reasons, ['name_exact']);
});

test('HotPepper 側を残しても、手動キュレーション店の編集部フィールドは失われない', () => {
  // HotPepper 側の方がフィールドが多い＝こちらが残る
  const hp = { '店名': '松軒亭', 'エリア': '栄ｷﾀ錦/伏見丸の内/泉/東桜/新栄', '住所': '愛知県名古屋市千種区千種１-21-6', 'ホットペッパーID': 'J004576942', placeId: 'P2', 'おすすめポイント': 'HotPepperのキャッチ文', '席数': '20', '定休日': '月', '平均予算': '5000円', 'コース': 'あり', '禁煙': '全席禁煙', mediaFeatures: [{ url: 'https://a.example/1', name: 'A' }] };
  const m = manual({ '店名': '松軒亭', 'エリア': '名古屋市千種区', 'おすすめポイント': '編集部の推薦文', editorReason: '業界人の理由', insiderNote: 'メモ', visitStatus: 'visited', '選定理由': '理由', 'おすすめシーン': ['接待'], 'トレンド情報源': ['https://b.example/'], mediaFeatures: [{ url: 'https://b.example/2', name: 'B' }, { url: 'https://a.example/1', name: 'A' }] });
  const r = dedupeStores([hp, m]);
  assert.equal(r.stores.length, 1);
  const s = r.stores[0];
  assert.equal(s['ホットペッパーID'], 'J004576942', '情報の多い HotPepper 側が残る');
  assert.equal(s['キュレーター'], '編集部');
  assert.equal(s['編集部推薦'], true);
  assert.equal(s['話題フラグ'], true);
  assert.equal(s['話題スコア'], 85);
  assert.equal(s['おすすめポイント'], '編集部の推薦文', '編集部の文が HotPepper の文より優先');
  assert.equal(s.editorReason, '業界人の理由');
  assert.equal(s.insiderNote, 'メモ');
  assert.equal(s.visitStatus, 'visited');
  assert.equal(s['選定理由'], '理由');
  assert.deepEqual(s['おすすめシーン'], ['接待']);
  assert.deepEqual(s['トレンド情報源'], ['https://b.example/']);
  assert.deepEqual(s.mediaFeatures.map((x) => x.url).sort(), ['https://a.example/1', 'https://b.example/2'], '掲載メディアは和集合（重複なし）');
});

test('既に値のあるフィールドは上書きしない／写真は束ごと補う', () => {
  const base = { '店名': '珈琲 ぶりこ', 'エリア': '栄(ミナミ)/矢場町/大須/上前津', '住所': '愛知県名古屋市中区大須2-1', 'ホットペッパーID': 'J000108015', placeId: 'P3', 'Google評価': '4.1', '席数': '10', '定休日': '火' };
  const other = { '店名': '珈琲ぶりこ', 'エリア': '名古屋市中区', placeId: 'P3', 'Google評価': '3.0', '写真URL': 'https://img.example/x.jpg', '写真出所': 'places-owner', '写真クレジット': '珈琲ぶりこ' };
  const { base: out, filled } = mergeGroup([base, other]);
  assert.equal(out['Google評価'], '4.1');
  assert.equal(out['写真URL'], 'https://img.example/x.jpg');
  assert.equal(out['写真出所'], 'places-owner');
  assert.equal(out['写真クレジット'], '珈琲ぶりこ');
  assert.ok(filled.includes('写真URL'));
});

test('写真URL を持つ側の写真クレジットに、別レコードのクレジットを混ぜない', () => {
  const base = { '店名': 'X', 'エリア': '名古屋市中区', '写真URL': 'https://hp.example/a.jpg', '席数': '1', '定休日': '月' };
  const other = { '店名': 'X', 'エリア': '名古屋市中区', '写真URL': 'https://places.example/b.jpg', '写真クレジット': '別人', '写真出所': 'places-user' };
  const { base: out } = mergeGroup([base, other]);
  assert.equal(out['写真URL'], 'https://hp.example/a.jpg');
  assert.equal(out['写真クレジット'], undefined);
  assert.equal(out['写真出所'], undefined);
});

test('区が食い違う組は統合しない（とんかつ朱寿: 手動=中村区 / HotPepper住所=名東区）', () => {
  const a = manual({ '店名': 'とんかつ朱寿', 'エリア': '名古屋市中村区', placeId: 'P4' });
  const b = { '店名': 'とんかつ朱寿', 'エリア': '本山・覚王山・藤が丘', '住所': '愛知県名古屋市名東区香流２-１０１５', 'ホットペッパーID': 'J004558109', placeId: 'P4' };
  const v = judgePair(a, b);
  assert.equal(v.ok, false);
  assert.equal(v.blocker, 'ward_conflict');
  assert.equal(dedupeStores([a, b]).stores.length, 2);
});

test('placeId が食い違う同名店は統合しない', () => {
  const v = judgePair({ '店名': 'もも', placeId: 'A' }, { '店名': 'もも', placeId: 'B' });
  assert.equal(v.blocker, 'placeId_conflict');
});

test('HotPepper が別々のIDで載せている、名前の違う店は placeId が同じでも統合しない', () => {
  const pairs = [
    ['居酒屋 権兵衛 名駅店', '権兵衛 名駅南店'],
    ['Cafe & Bar ゆきっち はなれ', 'Cafe & Bar ゆきっち'],
    ['シャンタムール サウス', 'シャンタムール'],
  ];
  for (const [x, y] of pairs) {
    const v = judgePair(
      { '店名': x, 'ホットペッパーID': 'J1', placeId: 'P', '住所': '愛知県名古屋市中村区名駅1' },
      { '店名': y, 'ホットペッパーID': 'J2', placeId: 'P', '住所': '愛知県名古屋市中村区名駅1' });
    assert.equal(v.ok, false, `${x} / ${y}`);
  }
});

test('1号店と2号店は統合しない', () => {
  const v = judgePair({ '店名': 'YOHAKU COFFEE 今池2号店', placeId: 'P' }, { '店名': 'YOHAKU COFFEE 今池1号店', placeId: 'P' });
  assert.equal(v.ok, false);
});

test('placeId 一致でも、表記揺れ以上に名前が違い区の裏付けも無ければ統合しない', () => {
  const v = judgePair(
    { '店名': '完全個室居酒屋 哉月', 'エリア': '名古屋市中村区', placeId: 'P' },
    { '店名': '居酒屋 哉月', 'エリア': '栄', 'ホットペッパーID': 'J001143580', placeId: 'P' });
  assert.equal(v.ok, false);
  assert.equal(v.blocker, 'no_corroboration');
});

test('placeId 一致＋名前一致＋同じ区なら統合する（読み仮名併記）', () => {
  const v = judgePair(
    { '店名': '那古野 しば福や 名駅店 (なごの しばふくや めいえきてん)', 'エリア': '名古屋市中村区', placeId: 'P' },
    { '店名': '那古野 しば福や 名駅店', 'エリア': '名古屋（名古屋駅/西区/中村区）', '住所': '愛知県名古屋市中村区名駅３丁目２３－１', 'ホットペッパーID': 'J003671888', placeId: 'P' });
  assert.equal(v.ok, true);
  assert.equal(v.reason, 'placeid_match');
});

test('全角空白だけが違う HotPepper の二重掲載は統合する', () => {
  const v = judgePair(
    { '店名': '英吉利西屋 本店', 'ホットペッパーID': 'J004510140', placeId: 'P' },
    { '店名': '英吉利西屋　本店', 'ホットペッパーID': 'J004678947', placeId: 'P' });
  assert.equal(v.ok, true);
});

test('推移的な結合でも区が食い違うレコードは同じグループに入れない', () => {
  const a = { '店名': '店A', 'エリア': '名古屋市中区', placeId: 'P' };
  const b = { '店名': '店A', placeId: 'P' };
  const c = { '店名': '店A', 'エリア': '名古屋市東区' };
  // a=b, b=c は候補だが a と c は区が違う → c は統合されない
  const r = dedupeStores([a, b, c]);
  assert.equal(r.stores.length, 2);
});

test('名前も placeId も違う店には触れない（入力をそのまま返す）', () => {
  const list = [{ '店名': 'A', placeId: '1' }, { '店名': 'B', placeId: '2' }, { '店名': 'C' }];
  const r = dedupeStores(list);
  assert.equal(r.stores.length, 3);
  assert.equal(r.merged.length, 0);
});

test('決定的: 同じ入力から同じ結果', () => {
  const mk = () => [
    { '店名': '串たつ 金山駅店', 'ホットペッパーID': 'J003763594', placeId: 'P', 'Instagram': 'x' },
    { '店名': '串たつ 金山駅店', 'ホットペッパーID': 'J000029144', placeId: 'P' },
  ];
  const r1 = dedupeStores(mk()), r2 = dedupeStores(mk());
  assert.deepEqual(r1.stores, r2.stores);
  assert.deepEqual(r1.merged, r2.merged);
});

test('補助関数: 区の読み取りと店名の表記揺れ', () => {
  assert.equal(wardOf({ '住所': '愛知県名古屋市中村区名駅4' }), '中村区');
  assert.equal(wardOf({ 'エリア': '名古屋市中区錦' }), '中区');
  assert.equal(wardOf({ 'エリア': '昭和区 川名' }), '昭和区');
  assert.equal(wardOf({ 'エリア': '名古屋（名古屋駅/西区/中村区）' }), '');
  assert.equal(wardOf({ 'エリア': '中川区・港区' }), '');
  assert.equal(looseName('焼肉　SEJONG　錦店　（セジョン）'), looseName('焼肉 SEJONG 錦店 セジョン'));
});

test('冪等: 統合済みの結果にもう一度かけても何も統合されず件数が変わらない（再発防止の決定的チェック）', () => {
  const list = [
    { '店名': '串たつ 金山駅店', 'ホットペッパーID': 'J003763594', placeId: 'P', 'Instagram': 'x' },
    { '店名': '串たつ 金山駅店', 'ホットペッパーID': 'J000029144', placeId: 'P' },
    { '店名': '別の店', placeId: 'Q' },
  ];
  const once = dedupeStores(list);
  assert.equal(once.stores.length, 2);
  const twice = dedupeStores(once.stores);
  assert.equal(twice.merged.length, 0);
  assert.equal(twice.stores.length, once.stores.length);
});

// ── オーナー確認済みペア（data/store_merge_confirmed.json・ISSUE-132・2026-10-06）──
const fs = require('node:fs');
const path = require('node:path');
const confirmedFile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'store_merge_confirmed.json'), 'utf8'));

test('確認済みペアは区の食い違いで見送られる組でも統合され、HP ID 持ちの側の ID は残る', () => {
  const m = manual({ '店名': 'ルコネッサンス', 'エリア': '名古屋市東区', placeId: 'PX' });
  const h = { '店名': 'Reconnaissance ルコネッサンス', 'エリア': '栄', '住所': '愛知県名古屋市中区大井町1-24', 'ホットペッパーID': 'J1', placeId: 'PX', '席数': '10' };
  assert.equal(dedupeStores([m, h], { confirmedPairs: [] }).stores.length, 2, '確認なしなら区の食い違いで統合されない');
  const cp = [{ sides: [{ '店名': 'ルコネッサンス', placeId: 'PX' }, { '店名': 'Reconnaissance ルコネッサンス', 'ホットペッパーID': 'J1' }] }];
  const r = dedupeStores([m, h], { confirmedPairs: cp });
  assert.equal(r.stores.length, 1);
  assert.equal(r.stores[0]['ホットペッパーID'], 'J1');
  assert.equal(r.stores[0]['編集部推薦'], true);
  assert.deepEqual(r.merged[0].reasons, ['owner_confirmed']);
  assert.equal(r.skipped.length, 0);
  assert.equal(r.unresolved.length, 0);
});

test('確認済みペアが3件の推移（囲い屋型）でも1枚に統合され、skipped に残らない', () => {
  const mk = (n, id) => ({ '店名': n, 'エリア': '金山', placeId: 'PP', 'ホットペッパーID': id });
  const a = mk('居酒屋 囲い屋 金山店', 'A'), b = mk('隠れ家個室居酒屋 囲い屋 金山店', 'B'), c = mk('囲い屋 金山店', 'C');
  const cp = [
    { sides: [{ '店名': a['店名'], 'ホットペッパーID': 'A' }, { '店名': b['店名'], 'ホットペッパーID': 'B' }] },
    { sides: [{ '店名': a['店名'], 'ホットペッパーID': 'A' }, { '店名': c['店名'], 'ホットペッパーID': 'C' }] },
  ];
  const r = dedupeStores([a, b, c], { confirmedPairs: cp });
  assert.equal(r.stores.length, 1);
  assert.equal(r.skipped.length, 0);
});

test('確認済みでない組は従来どおり見送る（リストにない別支店は統合しない）', () => {
  const a = { '店名': '鳥正', 'エリア': '名古屋', placeId: 'Q', 'ホットペッパーID': 'X1' };
  const b = { '店名': '鳥正 名古屋', 'エリア': '名古屋', placeId: 'Q', 'ホットペッパーID': 'X2' };
  const r = dedupeStores([a, b], { confirmedPairs: [] });
  assert.equal(r.stores.length, 2);
  assert.equal(r.skipped.length, 1);
});

test('特定できない side（0件・複数件）は統合せず unresolved に報告する', () => {
  const a = { '店名': 'X店', placeId: 'Z1' }, b = { '店名': 'X店', placeId: 'Z1' };
  const r = dedupeStores([a, b], { confirmedPairs: [{ sides: [{ '店名': 'X店' }, { '店名': '存在しない' }] }] });
  assert.equal(r.unresolved.length, 1);
});

test('確認済みペアの正本ファイルは27組（2026-10-06 の23組＋追加4組）・全組にオーナー確認日があり、side が空でない', () => {
  assert.equal(confirmedFile.pairs.length, 27);
  for (const p of confirmedFile.pairs) {
    assert.equal(p.ownerConfirmedAt, '2026-10-06');
    assert.equal(p.sides.length, 2);
    for (const s of p.sides) assert.ok(s['店名'] && (s['ホットペッパーID'] || s.placeId));
  }
});

// ── P-265: 統合で残す側を、前回の記録どおりに固定する ──
// 2026-10-11 の自動ビルドで、統合済みの4組の残す側が前回と逆になり、現役の店舗ページと誘導ページが入れ替わった。
// 項目数などが並ぶと、最後の決め手が元の配列の順（ホットペッパーの並び順に左右される）だったため。
const { keptMatcher, loadPrevKept } = require('../scripts/lib/store_dedup.js');

test('P-265: 前回残したレコードがいれば、元の並びが逆でも、そのレコードを残す', () => {
  const mk = (id) => ({ '店名': '肉ト魚 大衆酒場 ひとめぼれ 名駅3丁目店', 'エリア': '名古屋駅/西区/中村区', 'ホットペッパーID': id, placeId: 'PL' });
  // 従来: 項目数が同じなら元の並びで決まる＝並びが逆になると残る側も逆になる（これが入れ替わりの原因）
  assert.equal(dedupeStores([mk('J004026739'), mk('J004026741')]).stores[0]['ホットペッパーID'], 'J004026739');
  assert.equal(dedupeStores([mk('J004026741'), mk('J004026739')]).stores[0]['ホットペッパーID'], 'J004026741');
  // 前回 J004026741 を残していたら、並びがどちらでも J004026741
  const prevKept = [{ 'ホットペッパーID': 'J004026741', slug: 'J004026741' }];
  for (const list of [[mk('J004026739'), mk('J004026741')], [mk('J004026741'), mk('J004026739')]]) {
    const r = dedupeStores(list, { prevKept });
    assert.equal(r.stores.length, 1);
    assert.equal(r.stores[0]['ホットペッパーID'], 'J004026741');
    assert.equal(r.merged[0].kept['ホットペッパーID'], 'J004026741');
    assert.deepEqual(r.merged[0].absorbed.map((x) => x['ホットペッパーID']), ['J004026739']);
  }
});

test('P-265: 前回残した側の項目が相手より少なくなっても入れ替わらず、足りない項目は相手から補う', () => {
  const kept = () => ({ '店名': 'X食堂', 'エリア': '栄', 'ホットペッパーID': 'J1', placeId: 'P' });
  const richer = () => ({ '店名': 'X食堂', 'エリア': '栄', 'ホットペッパーID': 'J2', placeId: 'P', '席数': '20', '定休日': '月', '価格帯': '3000円' });
  assert.equal(dedupeStores([kept(), richer()]).stores[0]['ホットペッパーID'], 'J2', '従来は項目数の多い側');
  const r = dedupeStores([kept(), richer()], { prevKept: [{ 'ホットペッパーID': 'J1' }] });
  assert.equal(r.stores[0]['ホットペッパーID'], 'J1');
  assert.equal(r.stores[0]['席数'], '20', '足りない項目は相手から補う');
  assert.ok(r.merged[0].filledFields.includes('席数'));
});

test('P-265: オーナー確認済みの組（店名が違う）でも、前回残した側を残す', () => {
  const one = () => ({ '店名': 'YOHAKU COFFEE 今池1号店', 'エリア': '大曽根･千種･今池･池下･守山区', 'ホットペッパーID': 'J003624657', placeId: 'PY' });
  const two = () => ({ '店名': 'YOHAKU COFFEE 今池2号店', 'エリア': '大曽根･千種･今池･池下･守山区', 'ホットペッパーID': 'J003624656', placeId: 'PY' });
  const cp = [{ sides: [{ '店名': 'YOHAKU COFFEE 今池1号店', 'ホットペッパーID': 'J003624657' }, { '店名': 'YOHAKU COFFEE 今池2号店', 'ホットペッパーID': 'J003624656' }] }];
  for (const [list, prev, want] of [
    [[one(), two()], 'J003624656', '今池2号店'],
    [[two(), one()], 'J003624656', '今池2号店'],
    [[one(), two()], 'J003624657', '今池1号店'],
    [[two(), one()], 'J003624657', '今池1号店'],
  ]) {
    const r = dedupeStores(list, { confirmedPairs: cp, prevKept: [{ 'ホットペッパーID': prev }] });
    assert.equal(r.stores.length, 1);
    assert.ok(r.stores[0]['店名'].endsWith(want), `${prev} を残す: ${r.stores[0]['店名']}`);
  }
});

test('P-265: 前回の記録が無い・他の店のものだけのときは、従来どおりの決め方', () => {
  const mk = (id, extra) => Object.assign({ '店名': 'Y亭', 'エリア': '栄', 'ホットペッパーID': id, placeId: 'PQ' }, extra || {});
  const want = (opts) => dedupeStores([mk('A1'), mk('B2', { '席数': '8' })], opts).stores[0]['ホットペッパーID'];
  assert.equal(want(undefined), 'B2', '項目数の多い側');
  assert.equal(want({ prevKept: [] }), 'B2');
  assert.equal(want({ prevKept: [{ 'ホットペッパーID': 'ZZ9', slug: 'ZZ9' }] }), 'B2', '別の店の記録は影響しない');
  assert.equal(want({ prevKept: null }), 'B2');
});

test('P-265: 前回残した側が両方に当たる（別々の組が1つにつながった）ときは、従来どおりの決め方に戻る', () => {
  const mk = (id, extra) => Object.assign({ '店名': 'Z庵', 'エリア': '栄', 'ホットペッパーID': id, placeId: 'PZ' }, extra || {});
  const r = dedupeStores([mk('A1'), mk('B2', { '席数': '8' })], { prevKept: [{ 'ホットペッパーID': 'A1' }, { 'ホットペッパーID': 'B2' }] });
  assert.equal(r.stores[0]['ホットペッパーID'], 'B2');
});

test('P-265: 毎日の入力の並びと項目数が揺れても、残す側は動かない（30日分の模擬）。記録を使わないと動く', () => {
  // 決定的な疑似乱数（実行ごとに結果が変わらない）
  let seed = 20261011;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const groups = [
    ['G1', ['H11', 'H12']],
    ['G2', ['H21', 'H22', 'H23']],
    ['G3', ['H31', 'H32']],
  ];
  const day = () => {
    const list = [];
    for (const [g, ids] of groups) {
      for (const id of ids) {
        const rec = { '店名': `店${g}`, 'エリア': '名古屋駅', 'ホットペッパーID': id, placeId: `P${g}` };
        // 日によって取れている項目数が揺れる（写真・評価の取得できた/できなかった）
        for (const f of ['席数', '定休日', '価格帯', 'Google評価']) if (rnd() < 0.5) rec[f] = '1';
        list.push(rec);
      }
    }
    // 並びも毎日変わる（ホットペッパーの並び順）
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  };
  const keptBy = (r) => Object.fromEntries(r.merged.map((m) => [m.kept['店名'], m.kept['ホットペッパーID']]));
  const withRecord = new Map(), withoutRecord = new Map();
  let prev = [];
  for (let d = 0; d < 30; d++) {
    const input = day();
    const a = dedupeStores(input.map((x) => ({ ...x })), { confirmedPairs: [], prevKept: prev });
    prev = a.merged.map((m) => m.kept);
    for (const [k, v] of Object.entries(keptBy(a))) withRecord.set(k, (withRecord.get(k) || new Set()).add(v));
    const b = dedupeStores(input.map((x) => ({ ...x })), { confirmedPairs: [] });
    for (const [k, v] of Object.entries(keptBy(b))) withoutRecord.set(k, (withoutRecord.get(k) || new Set()).add(v));
  }
  for (const [k, ids] of withRecord) assert.equal(ids.size, 1, `${k}: 記録を使うと残す側は1つに固定される（${[...ids].join(',')}）`);
  assert.ok([...withoutRecord.values()].some((ids) => ids.size > 1), '記録を使わないと残す側が日ごとに入れ替わる（この模擬が空振りでないことの確認）');
});

test('P-265: keptMatcher は ID か slug で一致し、空どうしは一致とみなさない', () => {
  const m = keptMatcher([{ 'ホットペッパーID': 'J1', slug: 'J1' }, { 'ホットペッパーID': '', slug: 'store-abc' }, null, 'x'], (s) => s.__slug || '');
  assert.equal(m({ 'ホットペッパーID': 'J1' }), true);
  assert.equal(m({ __slug: 'store-abc' }), true);
  assert.equal(m({ 'ホットペッパーID': '', __slug: '' }), false, '空どうしは一致しない');
  assert.equal(m({ 'ホットペッパーID': 'J2', __slug: 'zzz' }), false);
  assert.equal(keptMatcher([], () => '')({ 'ホットペッパーID': 'J1' }), false);
  assert.equal(keptMatcher(undefined, () => '')({ 'ホットペッパーID': 'J1' }), false);
});

test('P-265: ホットペッパーID を持たないレコードは slug で前回残した側と照合する', () => {
  const a = () => ({ '店名': 'Bar 月', 'エリア': '名古屋市中区', placeId: 'PM', __slug: 'store-aaa' });
  const b = () => ({ '店名': 'Bar 月', 'エリア': '名古屋市中区', placeId: 'PM', __slug: 'store-bbb' });
  const slugOf = (s) => s.__slug || '';
  for (const list of [[a(), b()], [b(), a()]]) {
    const r = dedupeStores(list, { slugOf, prevKept: [{ 'ホットペッパーID': '', slug: 'store-bbb' }] });
    assert.equal(r.stores.length, 1);
    assert.equal(r.stores[0].__slug, 'store-bbb');
    assert.equal(r.merged[0].kept.slug, 'store-bbb');
  }
});

test('P-265: loadPrevKept は記録の kept を返し、無い・壊れている・形が違うときは空を返す（ビルドを止めない）', () => {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'prevkept-'));
  const f = path.join(dir, 'pairs.json');
  assert.deepEqual(loadPrevKept(f), [], 'ファイルが無い');
  fs.writeFileSync(f, '{ not json');
  assert.deepEqual(loadPrevKept(f), [], '壊れている');
  fs.writeFileSync(f, JSON.stringify({ merged: 'x' }));
  assert.deepEqual(loadPrevKept(f), [], '形が違う');
  fs.writeFileSync(f, JSON.stringify({ merged: [{ kept: { 'ホットペッパーID': 'J1', slug: 'J1' } }, null, { kept: null }, {}] }));
  assert.deepEqual(loadPrevKept(f), [{ 'ホットペッパーID': 'J1', slug: 'J1' }]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('P-265: リポジトリの統合の記録を読めて、全件に ID か slug がある（残す側の照合に使える）', () => {
  const kept = loadPrevKept();
  assert.ok(kept.length > 0, 'data/store_merge_pairs.json の kept が読めない');
  for (const k of kept) assert.ok(k['ホットペッパーID'] || k.slug, `ID も slug も無い: ${JSON.stringify(k)}`);
});
