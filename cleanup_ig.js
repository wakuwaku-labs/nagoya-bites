'use strict';
const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ';

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A:K',
  });
  const rows = res.data.values || [];

  // 不正なURLのパターン
  const BAD_PATTERNS = [
    'instagram.com/reels',
    'instagram.com/a11111111z1111',
    'instagram.com/popular',
  ];

  const requests = [];
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const cell = (rows[i][10] || '').trim();
    if (BAD_PATTERNS.some(p => cell.includes(p))) {
      requests.push({
        range: `K${i + 1}`,
        values: [['']],
      });
      console.log(`[${i + 1}] クリア: ${(rows[i][0] || '').slice(0, 30)} → ${cell}`);
      count++;
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: requests,
      },
    });
    console.log(`\n${count}件クリア完了`);
  } else {
    console.log('クリアする行はありませんでした');
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
