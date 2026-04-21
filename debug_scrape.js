'use strict';
const fetch = require('node-fetch');

async function main() {
  const storeName = '居酒屋 ヒノカミ 名古屋駅前店';
  const query = encodeURIComponent(storeName + ' 名古屋');
  const url = `https://www.google.com/search?q=${query}&hl=ja&gl=JP`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'ja-JP,ja;q=0.9',
    },
  });

  const html = await res.text();

  // ratingValue パターンを探す
  const m1 = html.match(/"ratingValue":\s*"?([\d.]+)"?/);
  console.log('ratingValue:', m1 ? m1[1] : 'なし');

  // 「X.X 5 つ星のうち」パターン
  const m2 = html.match(/([\d.]+)\s*[\/／]\s*5/);
  console.log('/5パターン:', m2 ? m2[1] : 'なし');

  // 評価っぽい数字（3.0〜5.0）を全部抽出
  const matches = [...html.matchAll(/([\d]\.\d)/g)]
    .map(m => m[1])
    .filter(v => parseFloat(v) >= 3.0 && parseFloat(v) <= 5.0);
  console.log('3.0〜5.0の数値:', [...new Set(matches)].join(', '));

  // JSON-LDを探す
  const jsonld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  if (jsonld) {
    console.log('\n=== JSON-LD ===');
    jsonld.forEach(s => console.log(s.slice(0, 500)));
  }

  // HTMLの一部を表示
  console.log('\n=== HTML 5000〜8000文字 ===');
  console.log(html.slice(5000, 8000));
}

main().catch(console.error);
