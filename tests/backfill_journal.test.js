'use strict';
// scripts/backfill_journal.sh の配線（ISSUE-185）: SNS原稿の停止設定を読み、生成の間に HEAD が動いたら止まる
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'backfill_journal.sh');
const src = fs.readFileSync(SCRIPT, 'utf8');

test('構文が正しい', () => {
  execFileSync('bash', ['-n', SCRIPT]);
});

test('generate_sns_draft=false なら SNS原稿を求めず、validator に md を渡さない', () => {
  assert.match(src, /journal_sns_draft_policy\.json'\)\.generate_sns_draft===false/);
  assert.match(src, /validate_journal_draft\.js "\$ART" \$\{MD:\+"\$MD"\}/);
});

test('生成の前の HEAD を覚え、成果物の確認の前に HEAD とブランチを確かめる', () => {
  const before = src.indexOf('HEAD_BEFORE=$(git rev-parse HEAD)');
  const gen = src.indexOf('if [ "$SKIP_GENERATION" = "0" ]; then');
  const check = src.indexOf('"$(git rev-parse HEAD)" != "$HEAD_BEFORE"');
  const validate = src.indexOf('validate_journal_draft.js');
  assert.ok(before > 0 && before < gen, 'HEAD_BEFORE は生成の前');
  assert.ok(check > gen && check < validate, 'HEAD の確認は生成の後・検証の前');
});
