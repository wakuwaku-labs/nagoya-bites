'use strict';
// P-370（P-332 の 2 本目）: 公開済みのジャーナル記事の「説明文の系統」から、人が選んだ・書いたと読める言い方を外す移行の検査。
// 対象: <meta name="description">・og:description・JSON-LD の description・冒頭リード（<p class="art-lead">）と、
// data/journal_published.json の description（一覧・フィード・トップの最新 3 件の元）。
// 題の系統（title・h1・og／twitter:title・headline・パンくず・関連リンクの題・published.json の title）と本文は、この段階では触らない（P-334・P-371）。
// ジャーナルは毎日新しい記事が加わるので、公開中の記事の語を数える検査はここに置かない（ADR 0033）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  dropPersona, looksBroken, checkedRewrite, rewriteDescriptionText, rewritePublished, rewriteText,
  rewriteLanding, loadTargetTerms, hasHit, unesc, escLike, signature, main,
} = require('../scripts/rewrite_journal_wording');
const OVERRIDES = require('../scripts/lib/journal_wording_overrides');

const ROOT = path.join(__dirname, '..');
const terms = loadTargetTerms(ROOT);
const quiet = () => {};

test('規則: 「業界人視点で」「業界人の目で」などの副詞を落とし、読点は文の形に合わせて整える', () => {
  const cases = [
    // 文の途中（読点なし）
    ['GW期間中の名古屋飲食シーンを業界人目線で解説。栄と名駅を比べる。', 'GW期間中の名古屋飲食シーンを解説。栄と名駅を比べる。'],
    ['席の選び方を業界目線で読む。', '席の選び方を読む。'],
    // 前に読点があり、動詞が続くとき: 読点も落とす
    ['同じ評価軸で並ぶ理由を、業界人視点で読み解く週次ダイジェスト。', '同じ評価軸で並ぶ理由を読み解く週次ダイジェスト。'],
    ['価格の階段を、業界人の目で読む。', '価格の階段を読む。'],
    // 「のか、」は読点を残す（「のか読み解く」と詰めない）
    ['なぜ10年の暖簾を替えたのか、業界人視点で読み解く。', 'なぜ10年の暖簾を替えたのか、読み解く。'],
    // 動詞が続かないときは前の読点を残す
    ['価格表を並べて、業界人の目で回収の仕組みを読み解く。', '価格表を並べて、回収の仕組みを読み解く。'],
    // 文頭: 後ろの読点も落とす
    ['連休の谷間。業界人視点で、なぜ今この細分化が起きるのかを読み解く。', '連休の谷間。なぜ今この細分化が起きるのかを読み解く。'],
    ['業界人の視点から3つの理由を読み解く。', '3つの理由を読み解く。'],
    // 主語
    ['予約困難店の予約が空く。業界人が連休の谷間日をどう使うかを実例で示す。', '予約困難店の予約が空く。連休の谷間日をどう使うかを実例で示す。'],
    ['ドリンク構造から業界人が解剖。5,000円が8,000円に化ける理由。', 'ドリンク構造から解剖。5,000円が8,000円に化ける理由。'],
  ];
  for (const [before, after] of cases) {
    assert.equal(dropPersona(before), after, before);
    assert.equal(dropPersona(after), after, `冪等: ${after}`);
    assert.equal(signature(before), signature(after), `数字と「」『』は動かさない: ${before}`);
  }
  // 「業界人が、」（読点が続く形）は規則では直さない（対応表で個別に直す）
  assert.equal(dropPersona('深夜は、業界人が、静かに通う店。'), '深夜は、業界人が、静かに通う店。');
  // 規則の対象でない語は触らない（名詞の「業界人」「業界の内側」は対応表の担当）
  assert.equal(dropPersona('業界人の選ぶ名店を紹介する。'), '業界人の選ぶ名店を紹介する。');
});

test('looksBroken: 規則が助詞のあとの句点・句点のあとの読点などを作ったときだけ true（前からある形は数えない）', () => {
  assert.equal(looksBroken('席を業界人視点で解説する。', '席を。'), true);
  assert.equal(looksBroken('席を整理する。業界人視点で、', '席を整理する。、'), true);
  assert.equal(looksBroken('A業界人がB。', '、AB。'), true);
  assert.equal(looksBroken('席を業界人が読む。', '席を読む。'), false);
  // 前の文にすでにある形は、書き換えが作ったものではない
  assert.equal(looksBroken('店を。業界人が読む。', '店を。読む。'), false);
});

test('checkedRewrite: 語が無い文は触らない。語がある文は、直った結果が安全の検査を通るときだけ書き換える', () => {
  assert.deepEqual(checkedRewrite('矢場味仙を解説する。', terms), { text: '矢場味仙を解説する。' });
  assert.deepEqual(checkedRewrite('矢場味仙を業界人視点で解説する。', terms), { text: '矢場味仙を解説する。' });
  const unfixable = checkedRewrite('業界人の選ぶ名店を紹介する。', terms);
  assert.equal(unfixable.text, '業界人の選ぶ名店を紹介する。');
  assert.match(unfixable.problem, /直らない/);

  // 対応表の書き換えにも同じ検査をかける（対応表をその場で足して確かめる）
  const own = OVERRIDES.description;
  const add = (k, v, fn) => {
    own[k] = v;
    try { fn(); } finally { delete own[k]; }
  };
  add('約5,000店を業界人が紹介する。', '約4,000店を紹介する。', () => {
    assert.match(checkedRewrite('約5,000店を業界人が紹介する。', terms).problem, /数字/);
  });
  add('「A店」を業界人の目で読む。', '「B店」を読む。', () => {
    assert.match(checkedRewrite('「A店」を業界人の目で読む。', terms).problem, /「」『』/);
  });
  add('席を業界人の選ぶ目で読む。', '席を業界人の視点で読む。', () => {
    assert.match(checkedRewrite('席を業界人の選ぶ目で読む。', terms).problem, /検査の語が残る/);
  });
  add('席は業界人が使い分ける。', '席を。', () => {
    assert.match(checkedRewrite('席は業界人が使い分ける。', terms).problem, /崩れ/);
  });
  // 対応表が優先される（規則より先に引く）
  add('席の選び方を業界目線で。', '席の選び方を紹介する。', () => {
    assert.equal(rewriteDescriptionText('席の選び方を業界目線で。'), '席の選び方を紹介する。');
  });
});

test('実体参照: meta の属性値は元の書き方（&#39; を使うか）を引き継いで戻す', () => {
  assert.equal(unesc('A&amp;B &quot;x&quot; &#39;y&#39; &lt;z&gt;'), 'A&B "x" \'y\' <z>');
  assert.equal(escLike('Tom\'s Bar & "Grill"', 'Tom&#39;s'), 'Tom&#39;s Bar &amp; &quot;Grill&quot;');
  assert.equal(escLike('Tom\'s Bar', 'Tom\'s'), 'Tom\'s Bar', '元が生の \' ならそのまま');
  const raw = 'Tom&#39;s Bar &amp; Grill を業界人視点で解説する。';
  assert.equal(escLike(unesc(raw), raw), raw, '往復で変わらない');
});

const ART = [
  '<!DOCTYPE html>',
  '<html lang="ja"><head>',
  '<title>矢場味仙を業界人視点で解剖｜NAGOYA BITES</title>',
  '<meta name="description" content="台湾ラーメン発祥の名店・矢場味仙。業界人視点で価格帯を読み解く。">',
  '<meta property="og:title" content="矢場味仙を業界人視点で解剖">',
  '<meta property="og:description" content="台湾ラーメン発祥の名店・矢場味仙。業界人視点で価格帯を読み解く。">',
  '<script type="application/ld+json">',
  '{',
  '  "@context": "https://schema.org",',
  '  "@type": "Article",',
  '  "headline": "矢場味仙を業界人視点で解剖",',
  '  "description": "台湾ラーメン発祥の名店・矢場味仙。業界人視点で価格帯を読み解く。",',
  '  "author": {"@type": "Organization", "name": "NAGOYA BITES"}',
  '}',
  '</script>',
  '</head><body>',
  '<h1>矢場味仙を業界人視点で解剖</h1>',
  '<p class="art-lead">矢場町の味仙を、業界人の目で読み解く。</p>',
  '<p>本文はこの段階では触らない。業界人の目で読む。</p>',
  '</body></html>',
  '',
].join('\n');

const NEW_DESC = '台湾ラーメン発祥の名店・矢場味仙。価格帯を読み解く。';

test('description 段階: meta・og・JSON-LD・冒頭リードだけを同じ言い方に直す。題・見出し・本文には触らない。冪等', () => {
  const r = rewriteText(ART, ['description'], terms);
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.stats, { meta: 2, jsonld: 1, lead: 1 });
  const want = ART
    .split('台湾ラーメン発祥の名店・矢場味仙。業界人視点で価格帯を読み解く。').join(NEW_DESC)
    .replace('矢場町の味仙を、業界人の目で読み解く。', '矢場町の味仙を読み解く。');
  assert.equal(r.text, want);
  // 3 つの写しは同じ文になる
  const metas = r.text.match(/(?:name="description"|property="og:description") content="([^"]*)"/g);
  assert.equal(metas.length, 2);
  assert.ok(metas.every((m) => m.includes(NEW_DESC)));
  assert.ok(r.text.includes(`"description": "${NEW_DESC}"`));
  // 触らないもの
  for (const kept of [
    '<title>矢場味仙を業界人視点で解剖｜NAGOYA BITES</title>',
    '<meta property="og:title" content="矢場味仙を業界人視点で解剖">',
    '"headline": "矢場味仙を業界人視点で解剖"',
    '<h1>矢場味仙を業界人視点で解剖</h1>',
    '<p>本文はこの段階では触らない。業界人の目で読む。</p>',
  ]) assert.ok(r.text.includes(kept), kept);
  const r2 = rewriteText(r.text, ['description'], terms);
  assert.equal(r2.text, r.text);
  assert.deepEqual(r2.stats, {});
  assert.throws(() => rewriteText(ART, ['description']), /terms/);
});

test('description 段階: 書き方が想定外の属性・文字列・タグ入りのリードは書き換えず、violations に残す（語が無ければ黙って通す）', () => {
  const bad = [
    '<meta name="description" content="席を業界人視点で&#x27;解説&#x27;する。">',
    '<meta property="og:description" content="Tom&#39;s Barを業界人視点で解説する。 \'x\'">',
    '<script type="application/ld+json">',
    '{',
    '  "description": "\\u5e2d\\u3092\\u696d\\u754c\\u4eba\\u8996\\u70b9\\u3067\\u89e3\\u8aac\\u3059\\u308b\\u3002",',
    '  "other": "業界人視点で触らない"',
    '}',
    '</script>',
    '<p class="art-lead">席を<strong>業界人視点</strong>で解説する。</p>',
    '<meta name="description" content="席を解説する。&#x27;">',
    '',
  ].join('\n');
  const r = rewriteText(bad, ['description'], terms);
  assert.equal(r.text, bad, '1 つも書き換えない');
  assert.deepEqual(r.stats, {});
  assert.deepEqual(r.violations.map((v) => v.key).sort(), ['jsonld', 'lead', 'meta', 'meta']);
  assert.ok(r.violations.every((v) => v.n > 0), '行番号が入る');
  assert.ok(r.violations.find((v) => v.key === 'jsonld').n >= 5, 'JSON-LD の行番号はブロックの中の位置');
});

test('description 段階: &#39; を使う meta は書き方を保ち、JSON-LD はエスケープ（\\n・\\"）を保つ', () => {
  const doc = [
    '<meta name="description" content="Tom&#39;s Bar &amp; Grill を業界人視点で解説する。">',
    '<script type="application/ld+json">',
    '{ "description": "Tom\'s \\"Bar\\" を業界人視点で解説する。" }',
    '</script>',
    '',
  ].join('\n');
  const r = rewriteText(doc, ['description'], terms);
  assert.deepEqual(r.violations, []);
  assert.ok(r.text.includes('<meta name="description" content="Tom&#39;s Bar &amp; Grill を解説する。">'));
  assert.ok(r.text.includes('{ "description": "Tom\'s \\"Bar\\" を解説する。" }'));
});

test('heading と description は同じ実行で一緒に当てられる', () => {
  const doc = `${ART.replace('<h1>', '    <p class="insider-title">Inside Perspective — 業界人の目利き</p>\n<h1>')}`;
  const r = rewriteText(doc, ['heading', 'description'], terms);
  assert.equal(r.stats.headings, 1);
  assert.equal(r.stats.meta, 2);
  assert.ok(r.text.includes('知っておきたいポイント') && r.text.includes(NEW_DESC));
});

const PUBLISHED = {
  description: '公開済みジャーナル記事の台帳',
  schema: 1,
  entries: [
    { slug: '2026-10-01-a', title: '矢場味仙を業界人視点で解剖', description: '台湾ラーメン発祥の名店・矢場味仙。業界人視点で価格帯を読み解く。', gate_note: '' },
    { slug: '2026-10-02-b', title: '問題のない題', description: '問題のない説明。' },
  ],
};
const PUBLISHED_RAW = `${JSON.stringify(PUBLISHED, null, 2)}\n`;

test('published.json: description だけを同じ文に直す。題・他の記事・書式は変えない。冪等', () => {
  const r = rewritePublished(PUBLISHED_RAW, terms);
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.stats, { published: 1 });
  const j = JSON.parse(r.text);
  assert.equal(j.entries[0].description, NEW_DESC);
  assert.equal(j.entries[0].title, '矢場味仙を業界人視点で解剖', '題は触らない（P-334）');
  assert.deepEqual(j.entries[1], PUBLISHED.entries[1]);
  assert.equal(r.text, `${JSON.stringify(j, null, 2)}\n`, '書式は 2 スペース＋末尾の改行のまま');
  const r2 = rewritePublished(r.text, terms);
  assert.equal(r2.text, r.text);
  assert.deepEqual(r2.stats, {});
  // 書式が想定外（一行 JSON）のときは書き換えずに止める
  const compact = JSON.stringify(PUBLISHED);
  const rc = rewritePublished(compact, terms);
  assert.equal(rc.text, compact);
  assert.equal(rc.violations.length, 1);
  assert.equal(rc.violations[0].key, 'published');
});

test('対応表: 全件が「旧は語を含む・新は語を含まない・数字と「」『』が同じ・文が崩れない・旧と違う」。キーの重複なし', () => {
  const entries = Object.entries(OVERRIDES.description);
  assert.ok(entries.length >= 40, '手書きの対応表がある');
  const problems = [];
  for (const [before, after] of entries) {
    if (!hasHit(terms, before)) problems.push(`旧に検査の語が無い（不要な行）: ${before.slice(0, 40)}`);
    if (hasHit(terms, after)) problems.push(`新にも検査の語が残る: ${after.slice(0, 40)}`);
    if (signature(before) !== signature(after)) problems.push(`数字か「」『』が変わる: ${before.slice(0, 40)}`);
    if (looksBroken(before, after)) problems.push(`文が崩れて見える: ${after.slice(0, 40)}`);
    if (before === after) problems.push(`旧と同じ: ${before.slice(0, 40)}`);
    if (/\n/.test(before + after)) problems.push(`改行を含む: ${before.slice(0, 40)}`);
  }
  assert.deepEqual(problems, []);
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'journal_wording_overrides.js'), 'utf8');
  const keys = [...src.matchAll(/^\s*\[`([^`]+)`\]:/gm)].map((m) => m[1]);
  assert.equal(new Set(keys).size, keys.length, 'キーの重複（後の行が前の行を黙って上書きする）');
  assert.equal(keys.length, entries.length, '全部のキーを数えている');
});

test('一覧ページの冒頭（landing）: 旧は語を含み、新は語を含まず、数字と「」『』が同じ。旧が無ければ何もしない（冪等）', () => {
  assert.equal(OVERRIDES.landing.length, 4, 'meta description・og:description・JSON-LD の description・見出し下の説明');
  for (const [before, after] of OVERRIDES.landing) {
    assert.ok(hasHit(terms, before), `旧に検査の語が無い: ${before.slice(0, 40)}`);
    assert.ok(!hasHit(terms, after), `新にも検査の語が残る: ${after.slice(0, 40)}`);
    assert.equal(signature(before), signature(after), before.slice(0, 40));
  }
  const page = `<head>\n${OVERRIDES.landing.map(([b]) => b).join('\n')}\n</head>\n<p>変えない</p>\n`;
  const r = rewriteLanding(page, terms);
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.stats, { landing: 4 });
  assert.equal(r.text, `<head>\n${OVERRIDES.landing.map(([, a]) => a).join('\n')}\n</head>\n<p>変えない</p>\n`);
  assert.equal(rewriteLanding(r.text, terms).text, r.text, '2 回目は何も変えない');
  // 同じ行が 2 つあるときは、どちらを直すか決められないので書き換えずに止める
  const twice = rewriteLanding(`${OVERRIDES.landing[0][0]}\n${OVERRIDES.landing[0][0]}\n`, terms);
  assert.equal(twice.violations.length, 1);
  assert.equal(twice.stats.landing, undefined);
});

function tmpRoot(articles, published) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-journal-desc-'));
  fs.mkdirSync(path.join(root, 'journal'));
  fs.mkdirSync(path.join(root, 'data'));
  for (const [name, html] of Object.entries(articles)) fs.writeFileSync(path.join(root, 'journal', name), html);
  if (published) fs.writeFileSync(path.join(root, 'data', 'journal_published.json'), published);
  return root;
}
const read = (root, ...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

test('CLI: --check は要るとき exit 1、--dry-run は書かない、実行後は --check が exit 0。記事以外・題・本文は触らない', () => {
  const root = tmpRoot({ '2026-10-01-a.html': ART, 'index.html': ART, '_template.html': ART }, PUBLISHED_RAW);
  assert.equal(main(['--phase', 'description', '--check', '--root', root], quiet), 1);
  assert.equal(main(['--phase', 'description', '--dry-run', '--root', root], quiet), 0);
  assert.equal(read(root, 'journal', '2026-10-01-a.html'), ART, 'dry-run は書かない');
  assert.equal(read(root, 'data', 'journal_published.json'), PUBLISHED_RAW, 'dry-run は published.json も書かない');
  assert.equal(main(['--phase', 'description', '--root', root], quiet), 0);
  const art = read(root, 'journal', '2026-10-01-a.html');
  assert.equal(art, rewriteText(ART, ['description'], terms).text);
  assert.equal(JSON.parse(read(root, 'data', 'journal_published.json')).entries[0].description, NEW_DESC);
  assert.equal(read(root, 'journal', 'index.html'), ART, '記事以外は触らない');
  assert.equal(read(root, 'journal', '_template.html'), ART, 'テンプレートは触らない');
  assert.equal(main(['--phase', 'description', '--check', '--root', root], quiet), 0, '2 回目は何も変えない');
  assert.throws(() => main(['--phase', 'description', '--oops', '--root', root], quiet), /知らない引数/);
});

test('CLI: 一覧ページの冒頭も直す。--only で絞ると published.json と一覧ページは触らない。published.json が無い root でも動く', () => {
  const landingPage = `<head>\n${OVERRIDES.landing.map(([b]) => b).join('\n')}\n</head>\n`;
  const root = tmpRoot({ '2026-10-01-a.html': ART, '2026-10-02-b.html': ART, 'index.html': landingPage }, PUBLISHED_RAW);
  assert.equal(main(['--phase', 'description', '--only', '10-02-b', '--root', root], quiet), 0);
  assert.equal(read(root, 'journal', '2026-10-01-a.html'), ART, '絞った外の記事は触らない');
  assert.notEqual(read(root, 'journal', '2026-10-02-b.html'), ART);
  assert.equal(read(root, 'data', 'journal_published.json'), PUBLISHED_RAW, '--only のときは published.json に触らない');
  assert.equal(read(root, 'journal', 'index.html'), landingPage, '--only のときは一覧ページに触らない');
  assert.equal(main(['--phase', 'description', '--root', root], quiet), 0);
  assert.equal(read(root, 'journal', 'index.html'), `<head>\n${OVERRIDES.landing.map(([, a]) => a).join('\n')}\n</head>\n`);
  assert.equal(main(['--phase', 'description', '--check', '--root', root], quiet), 0);
  const noPub = tmpRoot({ '2026-10-01-a.html': ART });
  assert.equal(main(['--phase', 'description', '--root', noPub], quiet), 0);
  assert.notEqual(read(noPub, 'journal', '2026-10-01-a.html'), ART);
});

test('CLI: 直せない文が 1 つでもあれば exit 2 で止まり、他の記事も published.json も 1 つも書き換えない', () => {
  const unfixable = ART.replace('台湾ラーメン発祥の名店・矢場味仙。業界人視点で価格帯を読み解く。', '業界人の選ぶ名店を紹介する。');
  const root = tmpRoot({ '2026-10-01-a.html': ART, '2026-10-02-b.html': unfixable }, PUBLISHED_RAW);
  const lines = [];
  assert.equal(main(['--phase', 'description', '--root', root], (l) => lines.push(l)), 2);
  assert.ok(lines.some((l) => /^NG 2026-10-02-b\.html:\d+ \[(?:meta|jsonld)\] 規則でも対応表でも直らない/.test(l)), lines.join('\n'));
  assert.equal(read(root, 'journal', '2026-10-01-a.html'), ART);
  assert.equal(read(root, 'journal', '2026-10-02-b.html'), unfixable);
  assert.equal(read(root, 'data', 'journal_published.json'), PUBLISHED_RAW);
});
