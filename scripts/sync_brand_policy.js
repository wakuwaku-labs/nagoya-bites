'use strict';
// 基本方針の写し（docs/brand-policy/nagoya_bites.md・data/brand_policy/nagoya_bites.json）を
// SNS分析ツールの正本から取り直す（Ondine #2093・tests/brand_policy.test.js の失敗の直し方）。
// 使い方: node scripts/sync_brand_policy.js   （正本の無い端末では何もしない）
const fs = require('fs');
const os = require('os');
const path = require('path');
const BP = require('./lib/brand_policy');
const ROOT = path.resolve(__dirname, '..');
const src = path.join(os.homedir(), 'orca/projects/SNS分析ツール/config/brand-policy');
if (!fs.existsSync(src)) { console.log('正本が無い端末なので何もしません'); process.exit(0); }
for (const [rel, name] of [[BP.ORIGINAL_REL, 'nagoya_bites.md'], [BP.POLICY_REL, 'nagoya_bites.json']]) {
  const from = fs.readFileSync(path.join(src, name), 'utf8');
  const to = path.join(ROOT, rel);
  const same = fs.existsSync(to) && fs.readFileSync(to, 'utf8') === from;
  if (!same) fs.writeFileSync(to, from);
  console.log((same ? '一致 ' : '更新 ') + rel);
}
