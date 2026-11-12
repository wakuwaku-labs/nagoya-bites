'use strict';
// 同じ主題の特集の役割リンク（診断項目18・data/feature_roles.json）を固定する。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_roles.json'), 'utf8'));
const page = (slug) => fs.readFileSync(path.join(ROOT, 'features', `${slug}.html`), 'utf8');
const relatedBlock = (html) => {
  const s = html.indexOf('<div class="related">');
  return html.slice(s, html.indexOf('</div>', html.indexOf('<div class="related-links">', s)));
};
// うなぎの組・手羽先は別の作業者の持ち分。この仕組みでは触らない
const NOT_OURS = new Set(['nagoya-unaju', 'nagoya-hitsumabushi', 'nagoya-tebasaki']);

test('各組は主を1つ持ち、主は組の全員と相互にリンクする（従同士は任意）', () => {
  for (const g of spec.groups) {
    assert.ok(g.members.includes(g.main), `${g.theme}: main が members に無い`);
    for (const m of g.members) {
      if (m === g.main) continue;
      assert.ok(g.edges.some((e) => e.from === g.main && e.to === m), `${g.theme}: 主→${m} が無い`);
      assert.ok(g.edges.some((e) => e.from === m && e.to === g.main), `${g.theme}: ${m}→主 が無い`);
    }
  }
});

test('すべての行き先が実在し、各ページの「関連する特集」区画に役割の一言つきで載っている', () => {
  for (const g of spec.groups) for (const e of g.edges) {
    assert.ok(!NOT_OURS.has(e.from) && !NOT_OURS.has(e.to), `別の作業者の持ち分に触れている: ${e.from} / ${e.to}`);
    assert.ok(fs.existsSync(path.join(ROOT, 'features', `${e.to}.html`)), `${e.to} が無い`);
    const blk = relatedBlock(page(e.from));
    const re = new RegExp(`href="(?:/features/)?${e.to}\\.html"[^>]*>${e.label}</a>`);
    assert.ok(re.test(blk), `${e.from} → ${e.to}: 「${e.label}」のリンクが区画に無い`);
  }
});

test('文言は数字（N選・N軒）を含まず、店を選んだ主体を示す語を使わない', () => {
  const banned = /業界人|目利き|現役|飲食人|プロが/;
  for (const g of spec.groups) for (const e of g.edges) {
    assert.ok(!/\d+\s*(選|軒|店)/.test(e.label), `数字つき: ${e.label}`);
    assert.ok(!banned.test(e.label), `表現の決まりに当たる: ${e.label}`);
  }
});

test('リンクを足したページ（日付つき）は dateModified が touchDate 以降で、画面の更新日と同じ', () => {
  const pages = new Set(spec.groups.flatMap((g) => g.edges.map((e) => e.from)));
  for (const slug of pages) {
    const html = page(slug);
    const m = /"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(html);
    if (!m) continue; // 日付の無い相談窓口
    assert.ok(m[1] >= spec.touchDate, `${slug}: dateModified ${m[1]}`);
    assert.ok(html.includes(`更新 <time datetime="${m[1]}">`), `${slug}: 画面の更新日が JSON-LD と違う`);
  }
});

test('同じ行き先へのチップが区画に重複していない', () => {
  for (const g of spec.groups) for (const e of g.edges) {
    const n = (relatedBlock(page(e.from)).match(new RegExp(`href="(?:/features/)?${e.to}\\.html"`, 'g')) || []).length;
    assert.strictEqual(n, 1, `${e.from} → ${e.to}: ${n} 本`);
  }
});
