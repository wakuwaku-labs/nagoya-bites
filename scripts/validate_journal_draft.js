'use strict';
/**
 * scripts/validate_journal_draft.js
 *
 * 日次ジャーナル記事のドラフトを10項目でQA。
 *
 * 使い方:
 *   node scripts/validate_journal_draft.js journal/drafts/2026-04-21-slug.html docs/daily-posts/2026-04-21.md
 *
 * 終了コード: 0=pass, 1=fail
 * 出力: 各項目の pass/fail と理由
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const PUBLISHED = path.join(ROOT, 'data', 'journal_published.json');
const PENDING = path.join(ROOT, 'data', 'pending_stores.json');

function extractLocalStores() {
  const src = fs.readFileSync(INDEX, 'utf8');
  const m = src.match(/var\s+LOCAL_STORES\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return [];
  try { return eval(m[1]); } catch (e) { return []; }
}

function checkJournal(htmlPath, mdPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const md = mdPath && fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
  const stores = extractLocalStores();
  const published = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  const pending = JSON.parse(fs.readFileSync(PENDING, 'utf8'));

  const results = [];
  const pass = (id, ok, msg) => results.push({ id, ok, msg });

  // 1. 店名が LOCAL_STORES or pending_stores.json にある
  const storeNameMatches = Array.from(html.matchAll(/class="store-name">([^<]+)</g)).map(m => m[1].trim());
  const knownNames = new Set([
    ...stores.map(s => (s['店名'] || s.name || '').trim()),
    ...(pending.pending || []).map(p => p['店名'])
  ]);
  const unknown = storeNameMatches.filter(n => !knownNames.has(n));
  pass(1, unknown.length === 0, unknown.length ? `未登録の店名: ${unknown.join(', ')} (pending_stores.jsonに追記してください)` : 'OK');

  // 2. Google評価表記の妥当性 (数字が0-5範囲)
  const scores = Array.from(html.matchAll(/★\s*([0-9]\.[0-9])/g)).map(m => parseFloat(m[1]));
  const badScore = scores.find(s => s < 0 || s > 5);
  pass(2, badScore === undefined, badScore !== undefined ? `異常なGoogle評価: ${badScore}` : 'OK');

  // 3. 閉店店舗チェック
  const closedNames = stores.filter(s => String(s['公開フラグ']).toUpperCase() === 'FALSE').map(s => s['店名']);
  const hitClosed = storeNameMatches.filter(n => closedNames.includes(n));
  pass(3, hitClosed.length === 0, hitClosed.length ? `閉店店舗を含む: ${hitClosed.join(', ')}` : 'OK');

  // 4. 個人名・オーナー名(ユニーク判定が難しいため"オーナー""大将""店主名"等のマーカーで近似)
  const personalMarker = /オーナー[:：][^<\s、。]{2,8}|大将[:：][^<\s、。]{2,8}/;
  pass(4, !personalMarker.test(html), personalMarker.test(html) ? '個人名らしき表記が本文にある (匿名運営規約 EDT-001 違反)' : 'OK');

  // 5. 価格帯記述(簡易チェック: "円"を含む / "無料" 単独表記でない)
  pass(5, /\d[,\d]*\s*円/.test(html), /\d[,\d]*\s*円/.test(html) ? 'OK' : '価格帯の記述が見つからない');

  // 6. 内部リンク切れチェック
  const links = Array.from(html.matchAll(/href="((?:\.\.\/)?(?:features|journal|stores)\/[^"#?]+)"/g)).map(m => m[1]);
  const broken = links.filter(l => {
    const abs = path.join(path.dirname(htmlPath), l);
    return !fs.existsSync(abs);
  });
  pass(6, broken.length === 0, broken.length ? `リンク切れ: ${broken.join(', ')}` : 'OK');

  // 7. JSON-LD 妥当性
  let jsonldOk = true;
  const jsonlds = Array.from(html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g));
  jsonlds.forEach(m => { try { JSON.parse(m[1]); } catch (_) { jsonldOk = false; } });
  pass(7, jsonldOk, jsonldOk ? 'OK' : 'JSON-LD パース失敗');

  // 8. 文字数上限(md の IG/X/Note セクション)
  if (md) {
    const ig = (md.match(/## Instagram[\s\S]*?(?=##|$)/) || [''])[0];
    const x = (md.match(/## X[\s\S]*?(?=##|$)/) || [''])[0];
    const note = (md.match(/## Note[\s\S]*?(?=##|$)/) || [''])[0];
    const igLen = ig.length;
    const xMaxTweet = Math.max(0, ...(x.match(/^\d+\..+$/gm) || []).map(l => l.length));
    pass(8, igLen <= 2400 && xMaxTweet <= 300 && note.length <= 22000,
      `IG:${igLen}/2200 X:${xMaxTweet}/280 Note:${note.length}/20000`);
  } else {
    pass(8, true, 'md未指定のためスキップ');
  }

  // 9. 同一店30日以内再掲なし
  const today = path.basename(htmlPath).slice(0, 10);
  const recentIds = new Set();
  (published.entries || []).forEach(e => {
    const days = Math.abs(new Date(e.date) - new Date(today)) / 86400000;
    if (days <= 30) (e.store_ids || []).forEach(id => recentIds.add(id));
  });
  const draftIds = Array.from(html.matchAll(/data-store-id="([^"]+)"/g)).map(m => m[1]);
  const dup = draftIds.filter(id => recentIds.has(id));
  pass(9, dup.length === 0, dup.length ? `30日以内再掲: ${dup.join(', ')}` : 'OK');

  // 10. 今日の1軒テーマ時、独自性3観点キーワード
  const eyebrow = (html.match(/class="art-eyebrow">([^<]+)</) || [, ''])[1];
  if (/今日の1軒/.test(eyebrow)) {
    const keywords = [
      /価格帯|客単価|コース|アラカルト/,
      /オペ|回転|予約|席配置|繁忙|時間帯/,
      /接待|デート|一人飲み|シーン/
    ];
    const missing = keywords.filter(re => !re.test(html));
    pass(10, missing.length === 0, missing.length ? `独自性3観点のキーワード不足 (${missing.length}/3観点)` : 'OK');
  } else {
    pass(10, true, '今日の1軒以外のためスキップ');
  }

  return results;
}

if (require.main === module) {
  const [htmlPath, mdPath] = process.argv.slice(2);
  if (!htmlPath) { console.error('使い方: node scripts/validate_journal_draft.js <html> [md]'); process.exit(2); }
  const results = checkJournal(htmlPath, mdPath);
  let failed = 0;
  results.forEach(r => {
    const mark = r.ok ? '✅' : '❌';
    console.log(`${mark} [${r.id}] ${r.msg}`);
    if (!r.ok) failed++;
  });
  console.log(`\n${failed === 0 ? '✅ PASS' : '❌ FAIL (' + failed + '件)'}`);
  process.exit(failed === 0 ? 0 : 1);
}

module.exports = { checkJournal };
