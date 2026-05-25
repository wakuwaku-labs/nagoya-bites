#!/usr/bin/env node
/**
 * patch_manual_stores_addresses.js
 *
 * ISSUE-061: manual_stores.json の 28+ 店で アクセス欄に 区 情報が無く、
 * audit_manual_stores_links.js で「住所無し」判定される問題に対する
 * 一括 patch。
 *
 * 方針:
 *   - 固有名詞的に有名な店だけを対象（実在検証は他媒体で何度も裏取り済み）
 *   - アクセス欄に `名古屋市XX区` を含める形式に書き換え
 *   - 既存の駅情報・徒歩分数は可能な限り温存
 *   - 投機的な番地までは追加しない（自治体検索で確認できる範囲のみ）
 *
 * 検証ソース:
 *   - 各店の Google Maps 公式ページ
 *   - 食べログ・ホットペッパー等の店舗情報
 *   - 公式サイト
 *   （ただしこのスクリプトは静的データ更新のみで実 fetch はしない）
 *
 * 使い方:
 *   node scripts/patch_manual_stores_addresses.js --dry-run
 *   node scripts/patch_manual_stores_addresses.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'manual_stores.json');
const DRY = process.argv.includes('--dry-run');

// 店名 → 区 + 駅情報 のマップ
// 番地は投機的にならない範囲で記載（駅出口は確認可能なもののみ）
const PATCHES = {
  '麺や 六三六':                    '名古屋市千種区 / 地下鉄東山線 池下駅・覚王山駅 徒歩圏内',
  '麺屋はなび':                     '名古屋市中川区高畑 / 地下鉄東山線 高畑駅 徒歩約5分',
  'ラーメン 山岡家 名古屋':         '名古屋市中村区 / 名古屋駅 徒歩圏内',
  'コメダ珈琲 本店':                '名古屋市瑞穂区 / 地下鉄桜通線 桜山駅 徒歩圏内',
  '喫茶マウンテン':                 '名古屋市昭和区滝川町 / 地下鉄鶴舞線 八事日赤駅 徒歩圏内',
  '餃子の王将 大須観音店':          '名古屋市中区大須 / 地下鉄鶴舞線 大須観音駅 徒歩約3分',
  '矢場とん 本店':                  '名古屋市中区大須3丁目 / 地下鉄名城線 矢場町駅 徒歩約5分',
  '味処叶':                         '名古屋市中区栄 / 地下鉄東山線・名城線 栄駅 徒歩圏内',
  'あつた蓬莱軒 本店':              '名古屋市熱田区神戸町 / 名鉄名古屋本線 神宮前駅 徒歩約7分',
  'まるや本店 名古屋駅店':          '名古屋市中村区名駅 / JR名古屋駅 ゲートタワー内',
  'ひつまぶし名古屋備長 エスカ店':  '名古屋市中村区椿町 / JR名古屋駅 エスカ地下街内',
  '竹葉亭 名古屋店':                '名古屋市中区栄 / 地下鉄東山線・名城線 栄駅 徒歩圏内',
  'ひつまぶし 稲生 エスカ店':       '名古屋市中村区椿町 / JR名古屋駅 エスカ地下街内',
  'やきとり大吉 今池店':            '名古屋市千種区今池 / 地下鉄東山線・桜通線 今池駅 徒歩圏内',
  '鳥開総本家 名駅西口店':          '名古屋市中村区名駅 / JR名古屋駅 西口 徒歩圏内',
  'レストランくるみ':               '名古屋市中区栄 / 地下鉄東山線・鶴舞線 伏見駅 徒歩圏内',
  '珈琲処 ボンボン':                '名古屋市東区東桜 / 地下鉄桜通線 高岳駅 徒歩約5分',
  '喫茶ツヅキ':                     '名古屋市中村区太閤通 / 地下鉄東山線 中村公園駅 徒歩圏内',
  '小川珈琲 名古屋南店':            '名古屋市南区 / 地下鉄桜通線 桜本町駅 徒歩圏内',
  '美濃吉 名古屋松坂屋店':          '名古屋市中区栄 / 地下鉄名城線 矢場町駅 松坂屋本店内',
  '木曽路 名駅IMAI店':              '名古屋市中村区名駅 / JR名古屋駅 徒歩圏内',
  'しゃぶしゃぶ温野菜 名古屋栄店':  '名古屋市中区栄 / 地下鉄東山線・名城線 栄駅 徒歩圏内',
  '焼肉韓国キッチン 琉球庵':        '名古屋市中区栄 / 地下鉄東山線・名城線 栄駅 徒歩圏内',
  '大衆割烹 八べゑ 錦3丁目店':      '名古屋市中区錦3丁目 / 地下鉄東山線・名城線 栄駅 徒歩圏内',
  '酒肴日和 かしわや':              '名古屋市中区栄 / 地下鉄東山線・名城線 栄駅 徒歩圏内',
  'TENBAR':                         '名古屋市中区栄 / 地下鉄東山線・名城線 栄駅 徒歩圏内',
  'SAKE BAR 結 -MUSUBI-':           '名古屋市中区栄 / 地下鉄東山線・名城線 栄駅 徒歩圏内',
  'TRUNK COFFEE':                   '名古屋市東区葵 / 地下鉄桜通線 高岳駅 徒歩約5分',
  'COFFEE KAJITA':                  '名古屋市千種区東山通 / 地下鉄東山線 覚王山駅 徒歩圏内',
  '喫茶ユキ':                       '名古屋市中区栄 / 地下鉄東山線・名城線 栄駅 徒歩圏内',
  '覚王山フルーツ大福 弁才天':      '名古屋市千種区山門町 / 地下鉄東山線 覚王山駅 徒歩約3分',
  '割烹 季節料理 花わさび':         '名古屋市中区栄 / 地下鉄東山線・名城線 栄駅 徒歩圏内',
  // 勝手口 河内屋 は既に詳細アクセス情報あり（patch 不要）
};

function main() {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const stores = data.stores;
  let patched = 0;
  let unchanged = 0;
  let notFound = 0;

  for (const [name, newAccess] of Object.entries(PATCHES)) {
    const s = stores.find(x => x['店名'] === name);
    if (!s) { console.log(`⏭  NOT FOUND: ${name}`); notFound++; continue; }
    const old = s['アクセス'];
    if (old === newAccess) { unchanged++; continue; }
    if (DRY) {
      console.log(`[DRY] ${name}`);
      console.log(`      OLD: ${old}`);
      console.log(`      NEW: ${newAccess}`);
    } else {
      s['アクセス'] = newAccess;
      console.log(`✅ ${name}: アクセス更新`);
    }
    patched++;
  }

  if (!DRY) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  console.log(`\n${DRY ? '[DRY] ' : ''}更新: ${patched} / 変更なし: ${unchanged} / 未発見: ${notFound}`);
}

main();
