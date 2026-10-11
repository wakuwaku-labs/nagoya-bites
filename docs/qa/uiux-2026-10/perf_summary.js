// perf.js の出力（1回の測定ごとに1行の JSON）から、ページ種別ごとの中央値を出す（UI・UX改修計画 I-02）。
// 1回の測定は揺れるので、前後の比較には「同じ条件で10周測った中央値」と、最小・最大・目標超の回数を使う（計画 2.2 節・10.2 節）。
//
// 使い方:
//   node perf.js 10 > runs.jsonl                        … 10周測る（本番。BASE=http://localhost:8082 で手元の配信も測れる）
//   node perf_summary.js runs.jsonl [--label 名前] [--date YYYY-MM-DD] [--base URL] [--note 測った時の事情]... [--out ファイル] [--table]
// 出力: { schema, label, date, base, conditions, host, notes, target, invalidRuns, pages: { top: { runs, invalid, median, min, max, over, samples, lcpElement, lcpUrl }, ... } }
//   clsDefinition = CLS の定義。session-window（いちばん大きいセッション窓・web.dev）／sum-of-shifts（旧定義: 全部のずれの合計。ずれの生の値 shifts が無い古い行）／mixed。clsSum = 全部のずれの合計（参考）
//   excludedRuns = 「直前の入力あり」と判定されて CLS に数えなかったずれがあった回の数（perf.js は入力を出さないので、あれば測定環境の影響。モバイル相当の表示にした直後の約 0.6 秒に起きる）。古い行（除外の記録が無い）だけなら null。clsExcluded = 数えなかったずれの合計
//   invalid = 描画されなかった回（FCP か LCP が 0）か、ページを開けなかった回（navError がある・finalUrl が chrome-error://）。中央値・最小・最大・over・samples には入れない（画面が消えている間などに全部 0 で返り、入れると「速くなった」ように見える）
//   over = 目標を超えた回数。中央値は割れる指標（ハブの CLS は 0.013 と 0.652 に割れた）を平らにするので、回数も並べる
//   samples = 1回ごとの要点（測った URL・LCP・CLS・TBT と、そのときの電源 power・低電力モード lowPowerMode[1 入／0 切]・描画側の速さの目安 rendererBenchMs）。TBT は同じページ・同じ内容でも、
//             電源で数十 ms と数秒に割れた（2026-10-11 に充電器を抜いた時刻から）。中央値だけでは割れたことが見えない。前後を比べるときは、電源が同じ回どうしで見る
//   host = 測った端末の CPU 数と、電源ごとの回数（バッテリー駆動か充電器か）・低電力モードの入り切りごとの回数（on / off）。notes = --note で渡した、測った時の事情（他の作業を止めたか など）
'use strict';
const fs = require('fs');

// perf.js の測定条件（perf.js の設定と同じ。変えたらここも変える）
const CONDITIONS = {
  viewport: '412x823 DPR 1.75（Android の UA）',
  cpu: '4倍遅く',
  network: '遅延 150ms・下り 1.6Mbps・上り 750kbps',
  cache: 'なし（初回の表示）',
  blocked: 'GA4 などの計測は遮断',
  waitAfterLoadMs: 5000,
};
// 目標（計画 10.2 節の「速さ」の行。LCP は 2.5s 以下・CLS は 0.1 以下）。ちょうどは超えていない
const TARGET = { lcp: 2500, cls: 0.1 };
// 中央値を出す項目
const FIELDS = ['ttfb', 'fcp', 'lcp', 'cls', 'clsSum', 'clsExcluded', 'tbt', 'dcl', 'load', 'totalKB', 'reqs', 'dom', 'htmlBytes', 'longTasks', 'heapMB', 'fontKB', 'fontFiles', 'rendererBenchMs', 'loadAvg1'];

function median(values) {
  const v = values.filter(x => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function mostCommon(values) {
  const c = {};
  values.filter(Boolean).forEach(x => { c[x] = (c[x] || 0) + 1; });
  const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return best ? { value: best[0], times: best[1] } : null;
}

/** 描画された回か。FCP も LCP も 0 より大きい回だけを測定として使う */
const isPainted = r => r.fcp > 0 && r.lcp > 0;

/** ページを開けなかった回か。goto が失敗した（net::ERR_NETWORK_CHANGED など）か、最終の URL が Chrome のエラーページ（chrome-error://）。
 *  エラーページにも FCP・LCP は付くので、isPainted だけでは見分けられない（2026-10-12: 店舗ページの1回が DOM 33 要素・LCP 500ms の行になった）。perf.js もこの判定でやり直す */
const notOpened = r => !!r.navError || /^chrome-error:/.test(r.finalUrl || '');

/** 測定として使える回か。描画され、ページを開けている */
const isMeasured = r => isPainted(r) && !notOpened(r);

/** perf.js の種類別の内訳から、Web フォントの通信量とファイル数を取り出す。内訳が無い古い行は null（0 にしない） */
const withFontTotals = r => ({ ...r, fontKB: r.kbType ? (r.kbType.Font || 0) : null, fontFiles: r.byType ? (r.byType.Font || 0) : null });

/** 行（perf.js の JSON を1行ずつ読んだ配列）→ ページごとの要約 */
function summarize(rows) {
  const by = {};
  rows.forEach(r => { (by[r.name] = by[r.name] || []).push(r); });
  const pages = {};
  Object.keys(by).forEach(name => {
    const rs = by[name].filter(isMeasured).map(withFontTotals);
    const invalid = by[name].length - rs.length;
    const med = {}, min = {}, max = {};
    FIELDS.forEach(f => {
      const vals = rs.map(r => r[f]).filter(x => typeof x === 'number' && Number.isFinite(x));
      med[f] = median(vals);
      min[f] = vals.length ? Math.min(...vals) : null;
      max[f] = vals.length ? Math.max(...vals) : null;
    });
    const overCount = f => rs.filter(r => typeof r[f] === 'number' && r[f] > TARGET[f]).length;
    const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const samples = rs.slice().sort((a, b) => (a.run || 0) - (b.run || 0)).map(r => ({ run: r.run == null ? null : r.run, url: r.url || null, lcp: num(r.lcp), cls: num(r.cls), tbt: num(r.tbt), rendererBenchMs: num(r.rendererBenchMs), loadAvg1: num(r.loadAvg1), power: r.power || null, lowPowerMode: num(r.lowPowerMode) }));
    // CLS の定義。ずれの生の値（shifts）がある行は、いちばん大きいセッション窓（cls.js）。無い古い行の cls は、全部のずれの合計（旧定義）で、比べられない
    const withShifts = rs.filter(r => Array.isArray(r.shifts)).length;
    const clsDefinition = !rs.length ? null : withShifts === rs.length ? 'session-window' : withShifts === 0 ? 'sum-of-shifts' : 'mixed';
    // 入力を出していない測定で、直前の入力ありと判定されて数えなかったずれがあった回（除外の記録 excludedCount が無い古い行しか無いときは null）
    const withExcluded = rs.filter(r => typeof r.excludedCount === 'number');
    const excludedRuns = withExcluded.length ? withExcluded.filter(r => r.excludedCount > 0).length : null;
    pages[name] = { runs: rs.length, invalid, clsDefinition, excludedRuns, median: med, min, max, over: { lcp: overCount('lcp'), cls: overCount('cls') }, samples, lcpElement: mostCommon(rs.map(r => r.lcpEl)), lcpUrl: mostCommon(rs.map(r => r.lcpUrl)) };
  });
  return pages;
}

function parseJsonl(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); } catch (e) { throw new Error(`${i + 1} 行目が JSON でない: ${e.message}`); }
  });
}

function tableOf(pages) {
  const head = '| ページ | 回数 | LCP(ms) | FCP(ms) | CLS | TBT(ms) | 読み込み完了(ms) | 通信量(KB) | 要求数 | DOM | 目標超の回数 |';
  const sep = '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|';
  const f = v => (v == null ? '—' : v);
  const lines = Object.keys(pages).map(n => {
    const m = pages[n].median;
    const runs = pages[n].invalid ? `${pages[n].runs} (無効 ${pages[n].invalid})` : pages[n].runs;
    return `| ${n} | ${runs} | ${f(m.lcp)} | ${f(m.fcp)} | ${f(m.cls)} | ${f(m.tbt)} | ${f(m.load)} | ${f(m.totalKB)} | ${f(m.reqs)} | ${f(m.dom)} | LCP ${pages[n].over.lcp}/${pages[n].runs} · CLS ${pages[n].over.cls}/${pages[n].runs} |`;
  });
  const legacy = Object.keys(pages).filter(n => pages[n].clsDefinition && pages[n].clsDefinition !== 'session-window');
  const note = legacy.length
    ? ['', `※ CLS の定義: ${legacy.join('・')} の CLS は、全部のずれの合計（旧定義）の行を含む。CLS はいちばん大きいセッション窓の値（web.dev）で、旧定義の値とは比べない`]
    : [];
  const excluded = Object.keys(pages).filter(n => pages[n].excludedRuns > 0);
  const note2 = excluded.length
    ? ['', `※ 入力を出していない測定で、「直前の入力あり」と判定されて CLS に数えなかったずれがある: ${excluded.map(n => `${n} ${pages[n].excludedRuns}/${pages[n].runs}回`).join('・')}。測定環境の影響（モバイル相当の表示にした直後の約 0.6 秒）の疑い。除外分の合計は clsExcluded`]
    : [];
  return [head, sep, ...lines, ...note, ...note2].join('\n');
}

function main(argv) {
  const file = argv[0];
  if (!file || file.startsWith('--')) { console.error('使い方: node perf_summary.js runs.jsonl [--label 名前] [--date YYYY-MM-DD] [--base URL] [--note 測った時の事情]... [--out ファイル] [--table]'); return 1; }
  const opt = { label: '', date: new Date().toISOString().slice(0, 10), base: 'https://nagoya-bites.com', out: '', table: false, notes: [] };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--table') opt.table = true;
    else if (k === '--note') { const v = argv[++i]; if (!v) { console.error('--note には測った時の事情を渡す'); return 1; } opt.notes.push(v); }
    else if (['--label', '--date', '--base', '--out'].includes(k)) opt[k.slice(2)] = argv[++i];
    else { console.error(`知らない引数: ${k}`); return 1; }
  }
  const rows = parseJsonl(fs.readFileSync(file, 'utf8'));
  if (!rows.length) { console.error('測定の行が1つも無い'); return 1; }
  const pages = summarize(rows);
  if (opt.table) { console.log(tableOf(pages)); return 0; }
  const invalidRuns = Object.values(pages).reduce((a, p) => a + p.invalid, 0);
  const legacyCls = Object.entries(pages).filter(([, p]) => p.clsDefinition && p.clsDefinition !== 'session-window').map(([n]) => n);
  if (legacyCls.length) console.error(`CLS が旧定義（全部のずれの合計）の行を含む: ${legacyCls.join('・')}。セッション窓の最大とは比べない`);
  const excludedPages = Object.entries(pages).filter(([, p]) => p.excludedRuns > 0);
  if (excludedPages.length) console.error(`入力を出していない測定で、「直前の入力あり」と判定されて数えなかったずれがある: ${excludedPages.map(([n, p]) => `${n} ${p.excludedRuns}/${p.runs}回（除外分の最大 ${p.max.clsExcluded}）`).join('・')}。測定環境の影響の疑い`);
  if (invalidRuns) console.error(`無効（描画されなかった・ページを開けなかった）回が ${invalidRuns} 回ある。中央値には入れていない。ページ別: ${Object.entries(pages).filter(([, p]) => p.invalid).map(([n, p]) => `${n} ${p.invalid}`).join('・')}`);
  const cpus = mostCommon(rows.map(r => r.cpus));
  const power = {};
  rows.forEach(r => { if (r.power) power[r.power] = (power[r.power] || 0) + 1; });
  const lowPowerMode = {};
  rows.forEach(r => { if (r.lowPowerMode === 0 || r.lowPowerMode === 1) { const k = r.lowPowerMode ? 'on' : 'off'; lowPowerMode[k] = (lowPowerMode[k] || 0) + 1; } });
  const out = { schema: 'nb-perf-baseline/1', label: opt.label, date: opt.date, base: opt.base, conditions: CONDITIONS, host: { cpus: cpus ? Number(cpus.value) : null, power, lowPowerMode }, notes: opt.notes, target: TARGET, runsPerPage: Math.max(...Object.values(pages).map(p => p.runs)), invalidRuns, pages };
  const text = JSON.stringify(out, null, 1) + '\n';
  if (opt.out) { fs.writeFileSync(opt.out, text); console.error(`書き出した: ${opt.out}`); } else process.stdout.write(text);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { median, mostCommon, isPainted, notOpened, isMeasured, summarize, parseJsonl, tableOf, CONDITIONS, FIELDS, TARGET };
