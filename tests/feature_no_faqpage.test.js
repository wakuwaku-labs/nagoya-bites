'use strict';

/**
 * 特集（features/*.html）に FAQPage の構造化データ（JSON-LD）を出さないことの試験（P-317・判断の記録 0025）。
 *
 * このゲートが守るもの:
 *   (1) 公開中の特集のどれにも FAQPage の JSON-LD が無いこと（配列・@graph の中も見る）
 *   (2) 画面の FAQ（よくある質問）は残っていること（構造化データだけを外す決定。画面は変えない）
 *   (3) 特集を書く側（build_features.js の injectFAQ・scripts/gen_industry_features.js）が
 *       FAQPage を書き戻さないこと。過去に差し込んだ FAQ-LD の区画は消すこと
 *   (4) 特集に FAQPage を一括で足す単発のスクリプト（apply_faq_per_topic.js）が動かないこと
 *   (5) 監査（audit_feature_schema_alignment.js）が、特集の FAQPage を違反として数えること
 * ハブページ（stores/area/）の同じ決定は tests/area_genre_hub_body.test.js が見ている。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FEATURES = path.join(ROOT, 'features');
const files = fs.readdirSync(FEATURES).filter((f) => f.endsWith('.html')).sort();

const { injectFAQ } = require(path.join(ROOT, 'build_features.js'));

function ldBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

// JSON-LD の値の中に、@type が FAQPage のものがあるか（配列・@graph・入れ子も見る）
function hasFaqPage(value) {
  if (Array.isArray(value)) return value.some(hasFaqPage);
  if (value && typeof value === 'object') {
    const t = value['@type'];
    if (t === 'FAQPage' || (Array.isArray(t) && t.includes('FAQPage'))) return true;
    return Object.values(value).some(hasFaqPage);
  }
  return false;
}

test('特集: どのページにも FAQPage の JSON-LD が無い（配列・@graph の中も含む）', () => {
  assert.ok(files.length > 60, `特集が ${files.length} 本しか見つからない`);
  const bad = [];
  for (const f of files) {
    const html = fs.readFileSync(path.join(FEATURES, f), 'utf8');
    for (const block of ldBlocks(html)) {
      let found;
      try {
        found = hasFaqPage(JSON.parse(block));
      } catch (e) {
        found = /FAQPage/.test(block); // 読めない JSON-LD は文字列で見る
      }
      if (found) {
        bad.push(f);
        break;
      }
    }
  }
  assert.deepEqual(bad, [], `FAQPage の JSON-LD が残っている特集: ${bad.join(', ')}`);
});

test('特集: 過去に差し込んだ FAQ-LD の区画（<!-- FAQ-LD:START -->）が残っていない', () => {
  const bad = files.filter((f) => /FAQ-LD:(START|END)/.test(fs.readFileSync(path.join(FEATURES, f), 'utf8')));
  assert.deepEqual(bad, [], `FAQ-LD の区画が残っている特集: ${bad.join(', ')}`);
});

test('特集: 画面の FAQ（よくある質問）は残っている（構造化データだけを外した）', () => {
  let withSection = 0;
  let withAnyFaq = 0;
  for (const f of files) {
    const html = fs.readFileSync(path.join(FEATURES, f), 'utf8');
    if (/class="faq-section"/.test(html)) withSection++;
    if (/class="faq-section"|class="faq-item"/.test(html)) withAnyFaq++;
  }
  // 2026-10-13 の実測: faq-section 55 本・faq-item を持つページを含めて 63 本。減っていたら画面の FAQ を消している
  assert.ok(withSection >= 55, `faq-section を持つ特集が ${withSection} 本に減っている（55 本以上あるはず）`);
  assert.ok(withAnyFaq >= 63, `画面の FAQ を持つ特集が ${withAnyFaq} 本に減っている（63 本以上あるはず）`);
});

test('特集を書く側: FAQPage の文字列を持たない（build_features.js・scripts/gen_industry_features.js）', () => {
  for (const rel of ['build_features.js', path.join('scripts', 'gen_industry_features.js')]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.doesNotMatch(src, /['"`]FAQPage['"`]/, `${rel} が FAQPage の型を書き出している（特集には出さない・0025）`);
    assert.doesNotMatch(src, /"@type"\s*:\s*"FAQPage"/, `${rel} が FAQPage の JSON-LD を書き出している`);
  }
});

test('injectFAQ: 画面の FAQ だけを差し込み、FAQ-LD の区画は消し、FAQPage を書き戻さない（2 回流しても同じ）', () => {
  const faqMap = {
    'x.html': [
      { q: '質問その1ですか', a: '答えその1です。' },
      { q: '質問その2ですか', a: '答えその2です。' },
    ],
  };
  const withOldLd = [
    '<html><head>',
    '<!-- FAQ-LD:START -->',
    '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}</script>',
    '<!-- FAQ-LD:END -->',
    '</head><body><article><p>本文</p></article></body></html>',
  ].join('\n');

  const once = injectFAQ(withOldLd, 'x.html', faqMap);
  assert.doesNotMatch(once, /FAQ-LD/, '古い FAQ-LD の区画が消えていない');
  assert.doesNotMatch(once, /FAQPage/, 'FAQPage が書き戻されている');
  assert.match(once, /<!-- FAQ-HTML:START -->/);
  assert.match(once, /<section class="faq-section" aria-label="よくある質問">/);
  assert.equal((once.match(/class="faq-item"/g) || []).length, 2, '画面の質問が 2 つ出ていない');
  assert.match(once, /質問その1ですか/);
  assert.ok(once.indexOf('FAQ-HTML:START') < once.indexOf('</article>'), '画面の FAQ が記事の中に入っていない');

  const twice = injectFAQ(once, 'x.html', faqMap);
  assert.equal(twice, once, '2 回流すと結果が変わる（冪等でない）');

  // 台帳に無いファイルは触らない
  assert.equal(injectFAQ(withOldLd, 'other.html', faqMap), withOldLd);
});

test('apply_faq_per_topic.js: 特集に FAQPage を一括で足す単発のスクリプトは、実行しても何も書かずに止まる', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'apply_faq_per_topic.js'), '--dry-run'], { encoding: 'utf8' });
  assert.equal(r.status, 1, '止まっていない（exit 1 になるはず）');
  assert.match(r.stderr + r.stdout, /0025/, '止めた理由（判断の記録 0025）を出していない');
});

test('audit_feature_schema_alignment.js: 特集の FAQPage を違反として数える（journal は対象外のまま）', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'audit_feature_schema_alignment.js'), 'utf8');
  assert.match(src, /faqpage_not_allowed_in_feature/, '監査が特集の FAQPage を違反にしていない');
  assert.match(src, /faqOnly/, 'journal 用の faqOnly 指定が無い');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'audit_feature_schema_alignment.js')], { encoding: 'utf8' });
  assert.equal(r.status, 0, `監査が失敗している: ${(r.stdout + r.stderr).slice(0, 400)}`);
});
