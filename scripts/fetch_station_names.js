#!/usr/bin/env node
'use strict';
/**
 * scripts/fetch_station_names.js
 *
 * 駅名監査（scripts/audit_station_names.js・SEO-120）が使う駅名リスト data/station_names.json を作り直す。
 *   aichi            … 愛知県内の駅名（アクセス文の「〜駅」がこれに当たれば県内）
 *   outsideAichiOnly … 愛知県外にしか無い駅名（これに当たれば県外の駅と確定できる）
 * 県外の駅を「愛知の一覧に無い語」で判定すると、表記ゆれ（半角カナ・旧駅名・「名駅」）を
 * すべて県外扱いしてしまう。県外は全国の駅名で確かめられたものだけにする（制約10）。
 *
 * 出典は HeartRails Express API（駅データ.jp 由来の路線・駅データ）。
 *   getPrefectures → 都道府県ごとに getLines → 路線ごとに getStations（各駅に prefecture が付く）
 * 外部 API を読むだけで何も送らない。路線の新設・駅名の変更があったときに手で実行する（約5分）。
 *   node scripts/fetch_station_names.js            # 取得して書き出す
 *   node scripts/fetch_station_names.js --dry-run  # 件数だけ表示
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'station_names.json');
const API = 'https://express.heartrails.com/api/json';
const PREF = '愛知県';

async function getJson(params) {
  const url = `${API}?${new URLSearchParams(params)}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.response || json.response.error) throw new Error(`API error: ${JSON.stringify(json.response)}`);
      return json.response;
    } catch (e) {
      if (attempt >= 3) throw new Error(`${e.message}: ${url}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const prefectures = (await getJson({ method: 'getPrefectures' })).prefecture || [];
  if (prefectures.length !== 47) throw new Error(`都道府県が ${prefectures.length} 件。API の応答が変わった可能性がある`);

  const lines = new Set();
  for (const prefecture of prefectures) {
    for (const line of (await getJson({ method: 'getLines', prefecture })).line || []) lines.add(line);
    await sleep(150);
  }

  const aichi = new Set();
  const outside = new Set();
  let done = 0;
  for (const line of lines) {
    for (const s of (await getJson({ method: 'getStations', line })).station || []) {
      if (!s.name) continue;
      (s.prefecture === PREF ? aichi : outside).add(s.name);
    }
    if (++done % 100 === 0) console.log(`  ${done}/${lines.size} 路線`);
    await sleep(150);
  }
  if (aichi.size < 300) throw new Error(`愛知県の駅が ${aichi.size} 件しかない。取得が欠けている`);

  const sortJa = (set) => [...set].sort((a, b) => a.localeCompare(b, 'ja'));
  const aichiList = sortJa(aichi);
  const outsideOnly = sortJa(new Set([...outside].filter((n) => !aichi.has(n))));
  console.log(`路線 ${lines.size} / 愛知県内の駅名 ${aichiList.length} / 県外にしか無い駅名 ${outsideOnly.length}`);
  if (dryRun) return;

  // 配列は1行に収める（9千語を1語1行にすると差分が読めなくなる）
  const body = [
    '{',
    `  "_comment": ${JSON.stringify('駅名リスト（SEO-120）。scripts/audit_station_names.js がアクセス文の「〜駅」の照合に使う。作り直しは node scripts/fetch_station_names.js')},`,
    `  "source": ${JSON.stringify('HeartRails Express API（https://express.heartrails.com/api.html）getPrefectures → getLines?prefecture=… → getStations?line=… の各駅の prefecture で愛知県内と県外に分けた')},`,
    `  "fetchedAt": ${JSON.stringify(new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10))},`,
    `  "lineCount": ${lines.size},`,
    `  "aichi": ${JSON.stringify(aichiList)},`,
    `  "outsideAichiOnly": ${JSON.stringify(outsideOnly)}`,
    '}',
    '',
  ].join('\n');
  fs.writeFileSync(OUT, body);
  console.log(`書き出し: ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
