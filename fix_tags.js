'use strict';

const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ';

// タグ判定ルール: [タグ名, 判定関数(row) => boolean]
// row: {店名, アクセス, 備考, タグ, ジャンル, 価格帯}
const TAG_RULES = [
  ['個室', r =>
    /個室|完全個室|プライベートルーム/.test(r.店名) ||
    /個室|完全個室/.test(r.アクセス) ||
    /個室|完全個室/.test(r.備考)
  ],
  ['半個室', r =>
    /半個室/.test(r.店名) ||
    /半個室/.test(r.アクセス) ||
    /半個室/.test(r.備考)
  ],
  ['カウンター', r =>
    /カウンター/.test(r.アクセス) || /カウンター/.test(r.備考)
  ],
  ['貸切可', r =>
    /貸切/.test(r.店名) || /貸切/.test(r.アクセス) || /貸切/.test(r.備考)
  ],
  ['食べ放題', r =>
    /食べ放題|食放題/.test(r.店名) || /食べ放題/.test(r.アクセス)
  ],
  ['飲み放題', r =>
    /飲み放題|飲放題/.test(r.店名) || /飲み放題/.test(r.アクセス)
  ],
  ['焼肉', r => /焼肉|焼き肉/.test(r.ジャンル) || /焼肉/.test(r.店名)],
  ['海鮮', r => /海鮮|鮮魚|魚/.test(r.ジャンル) || /海鮮|鮮魚/.test(r.店名)],
  ['イタリアン', r => /イタリアン/.test(r.ジャンル)],
  ['和食', r => /和食|日本料理/.test(r.ジャンル)],
  ['居酒屋', r => /居酒屋/.test(r.ジャンル) || /居酒屋/.test(r.店名)],
];

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A:Q',
  });
  const rows = res.data.values || [];
  const headers = rows[0];
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

  const updates = [];
  let changed = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const r = {
      店名:   (row[idx['店名']]   || ''),
      アクセス:(row[idx['アクセス']]|| ''),
      備考:   (row[idx['備考']]   || ''),
      ジャンル:(row[idx['ジャンル']]|| ''),
      価格帯: (row[idx['価格帯']] || ''),
      タグ:   (row[idx['タグ']]   || ''),
    };

    const existingTags = r.タグ.split(',').map(t => t.trim()).filter(Boolean);
    const newTags = [...existingTags];

    for (const [tagName, testFn] of TAG_RULES) {
      if (!newTags.includes(tagName) && testFn(r)) {
        newTags.push(tagName);
      }
    }

    if (newTags.join(',') !== existingTags.join(',')) {
      updates.push({ range: `Q${i + 1}`, values: [[newTags.join(',')]] });
      if (changed < 10) {
        console.log(`[${i+1}] ${r.店名.slice(0,20)}`);
        const added = newTags.filter(t => !existingTags.includes(t));
        console.log(`  追加タグ: ${added.join(', ')}`);
      }
      changed++;
    }
  }

  console.log(`\n更新対象: ${changed}件`);

  if (updates.length === 0) { console.log('変更なし'); return; }

  // 50件ずつバッチ更新
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: batch },
    });
    process.stdout.write(`  ${Math.min(i + 50, updates.length)}/${updates.length} 更新済み\r`);
  }
  console.log('\n完了');
}

main().catch(e => { console.error(e.message); process.exit(1); });
