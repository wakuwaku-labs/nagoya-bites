const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const match = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);\s*(?:var|let|const|function|\/\/)/);
if (!match) { fs.writeFileSync(__dirname + '/_store_data.txt', 'Pattern not found'); process.exit(1); }
const stores = JSON.parse(match[1]);

let out = '';

const meieki = stores.filter(s => {
  const area = s['エリア'] || '';
  return area.includes('名駅') || area.includes('名古屋駅');
});

const sakae = stores.filter(s => {
  const area = s['エリア'] || '';
  return area.includes('栄') || area.includes('錦');
});

const sortByScore = arr => arr.sort((a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0));
const top15 = arr => sortByScore(arr).slice(0, 15);

out += '=== MEIEKI (' + meieki.length + ' total) TOP 15 ===\n';
top15(meieki).forEach((s, i) => {
  out += JSON.stringify({
    n: i + 1,
    name: s['店名'],
    genre: s['ジャンル'],
    area: s['エリア'],
    score: s['Google評価'],
    tags: s['タグ'],
    hpid: s['ホットペッパーID'],
    point: s['おすすめポイント']
  }) + '\n';
});

out += '\n=== SAKAE (' + sakae.length + ' total) TOP 15 ===\n';
top15(sakae).forEach((s, i) => {
  out += JSON.stringify({
    n: i + 1,
    name: s['店名'],
    genre: s['ジャンル'],
    area: s['エリア'],
    score: s['Google評価'],
    tags: s['タグ'],
    hpid: s['ホットペッパーID'],
    point: s['おすすめポイント']
  }) + '\n';
});

fs.writeFileSync(__dirname + '/_store_data.txt', out);
