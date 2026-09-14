'use strict';

/**
 * 流入元の SNS / 生成AI 判定（scripts/lib/traffic_source.js）の回帰テスト。
 * 2026-09-14: 部分一致 /t\.co/ が chatgpt.com・copilot.com を SNS と数え、
 * site_metrics.json の channels.social がほぼ全量生成AI流入になっていた事故の再発防止。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { isSocialSource, isAiAssistantSource } = require('../scripts/lib/traffic_source');
const { classify } = require('../scripts/search_channel_metrics');

test('生成AIのドメインを SNS と数えない（t.co 部分一致事故の再発防止）', () => {
  for (const s of ['chatgpt.com', 'copilot.com', 'microsoft.com', 'online.example.jp', 'netflix.com', 'reddit.com']) {
    assert.equal(isSocialSource(s), false, s);
  }
});

test('実際の SNS ドメインとサブドメイン・UTM の素の名前を SNS と判定する', () => {
  for (const s of ['t.co', 'x.com', 'l.instagram.com', 'instagram', 'm.facebook.com', 'lm.facebook.com', 'note.com', 'line', 'youtube.com']) {
    assert.equal(isSocialSource(s), true, s);
  }
});

test('生成AIは medium=ai-assistant かドメインで判定する', () => {
  assert.equal(isAiAssistantSource('chatgpt.com', 'ai-assistant'), true);
  assert.equal(isAiAssistantSource('copilot.com', '(not set)'), true);
  assert.equal(isAiAssistantSource('openai', 'organic'), true);
  assert.equal(isAiAssistantSource('t.co', 'referral'), false);
});

test('search_channel_metrics の分類が共有判定器と一致する', () => {
  assert.equal(classify('chatgpt.com'), 'ai_assistant');
  assert.equal(classify('copilot.com'), 'ai_assistant');
  assert.equal(classify('t.co'), 'social');
  assert.equal(classify('l.instagram.com'), 'social');
  assert.equal(classify('microsoft.com'), 'other');
});

test('GAS 側の複製判定器が CLI 側と同じ語彙で同じ結果を返す', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '.gas-deploy', 'Code.js'), 'utf8');
  const start = src.indexOf('const SOCIAL_SOURCE_DOMAINS');
  const end = src.indexOf('// 流入元を素人向け表記に');
  assert.ok(start !== -1 && end > start, 'GAS に複製判定器が無い');
  const ctx = {};
  vm.runInNewContext(src.slice(start, end) + '\nthis.isSocialTrafficSource = isSocialTrafficSource; this.isAiTrafficSource = isAiTrafficSource;', ctx);
  const lib = require('../scripts/lib/traffic_source');
  assert.deepEqual([...vm.runInNewContext('SOCIAL_SOURCE_DOMAINS', ctx)], lib.SOCIAL_DOMAINS);
  assert.deepEqual([...vm.runInNewContext('AI_SOURCE_DOMAINS', ctx)], lib.AI_DOMAINS);
  for (const s of ['chatgpt.com', 'copilot.com', 't.co', 'l.instagram.com', 'microsoft.com', 'online.example.jp']) {
    assert.equal(ctx.isSocialTrafficSource(s), isSocialSource(s), s);
    assert.equal(ctx.isAiTrafficSource(s, '(not set)'), isAiAssistantSource(s, '(not set)'), s);
  }
});

test('docs/sns-utm-convention.md の utm_source 値がすべて SNS と判定される', () => {
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'sns-utm-convention.md'), 'utf8');
  const values = [...doc.matchAll(/^\| [^|]+ \| `([a-z]+)` \|$/gm)].map(m => m[1]);
  assert.ok(values.length >= 8, `規約表から値を読めていない: ${values}`);
  for (const v of values) assert.equal(isSocialSource(v), true, v);
});
