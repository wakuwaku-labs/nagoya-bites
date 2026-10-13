#!/usr/bin/env node
'use strict';
/**
 * rewrite_journal_wording.js — 公開済みのジャーナル記事から、人が選んだ・書いたと読める言い方を外す移行（P-332・I-03f）
 *
 * オーナーの指示（2026-10-11）:
 *   「店舗の選定にはAIによる情報収集・分析を活用しています。人間の飲食業界関係者がすべての店舗を
 *    選定しているような表現は使用しないでください。」
 * 新しい記事は journal/_template.html と scripts/add_journal_site_intro.js が新しい言い方で作る（P-326）。
 * このスクリプトは、すでに公開している記事（journal/20YY-MM-DD-*.html）を同じ言い方にそろえる。日次では回さない。
 * 語の一覧の正本は data/selection_wording_policy.json。確認は node scripts/audit_selection_wording.js --only journal。
 *
 * 段階（--phase）:
 *   heading      区画の見出し「Inside Perspective — 業界人の目利き」→「知っておきたいポイント」、
 *                導入の 1 行「名古屋の厳選N店を業界視点で紹介する」→「名古屋のN店を、公開情報をもとに紹介する」、
 *                meta keywords の「業界人」「業界人視点」、未記入のまま公開された箱（P-369）
 *   description  説明文の系統（P-370）: <meta name="description">・og:description・JSON-LD の description・冒頭リード
 *                （<p class="art-lead">）と、data/journal_published.json の description、journal/index.html の冒頭
 *                （手で書かれた説明文。`landing` の対応表）。
 *                規則（「業界人視点で」「業界人の目で」などの副詞と「業界人が」の主語を落とす）で直る文は規則で、
 *                直らない文・崩れる文は scripts/lib/journal_wording_overrides.js の対応表で直す。同じ文は同じ文に直るので、
 *                3 つの写し（meta・og・JSON-LD）と published.json がそろう。一覧（journal/index.html）と
 *                フィード（feed.atom・feed.xml）は published.json から作るので、この後に
 *                node scripts/build_journal_index.js を回して作り直す（トップの最新 3 件は CI が作り直す）。
 *
 * 触らないもの: 記事の題の系統（<title>・og/twitter:title・<h1>・JSON-LD の headline と name・パンくず・
 *   関連リンクの題）。題を変えると検索の見え方が変わるので、前後の数字を決めてから P-334（I-03h）で変える。
 *
 * 安全の検査: 書き換えた文は、数字の並びと「」『』の中身が前と同じでなければならず、検査の語が残らず、
 *   文が崩れて見えない（「を。」「。、」など）こと。満たさない文は書き換えずに残し、exit 2 で止める。冪等（2 回目は何も変えない）。
 *
 * 使い方:
 *   node scripts/rewrite_journal_wording.js --phase heading            # 書き換える
 *   node scripts/rewrite_journal_wording.js --phase description --dry-run  # 件数だけ（書かない）
 *   node scripts/rewrite_journal_wording.js --phase description --check    # 書き換えが要る記事があれば exit 1
 *   --only <名前の一部>   記事を絞る
 *   --list [N]            書き換える行（文）の前後を N 件（既定 20）並べる
 *   --root <dir>          別のリポジトリ（テスト用の小さな fixture）を見る
 */

const fs = require('fs');
const path = require('path');
const OVERRIDES = require('./lib/journal_wording_overrides');

const REPO_ROOT = path.join(__dirname, '..');
const ARTICLE_RE = /^20\d\d-\d\d-\d\d-.+\.html$/;

// 数字の並びと「」『』の中身。書き換えの前後で変わってはいけない
function signature(line) {
  return (line.match(/[0-9０-９][0-9０-９,.]*|[「『][^」』]*[」』]/g) || []).join('|');
}

// ── 段階 heading ──

// 「(業界人視点を記述)」だけが入ったまま公開された箱（下書きの仮の文が残っていた）。箱ごと外す
const PLACEHOLDER_BOX = /[ \t]*<div class="insider-box">\s*<p class="insider-title">[^<]*<\/p>\s*<ul>\s*<li>\(業界人視点を記述\)<\/li>\s*<\/ul>\s*<\/div>[ \t]*\n(?:[ \t]*\n)?/g;

function rewriteHeadingLine(line) {
  return line.replace(/(<p class="insider-title">)Inside Perspective — 業界人の(?:目利き|目線)(<\/p>)/, '$1知っておきたいポイント$2');
}

// 数（約5,000・1,100店超など）は記事の今の表記を引き継ぐ。数の更新は scripts/sync_store_count.js の担当
function rewriteIntroLine(line) {
  if (!line.includes('class="nb-site-intro"')) return line;
  return line.replace(/名古屋の厳選([^<]{1,12}?店(?:超)?)を業界視点で紹介する/, '名古屋の$1を、公開情報をもとに紹介する');
}

function rewriteKeywordsLine(line) {
  return line.replace(/(<meta name="keywords" content=")([^"]*)(")/, (m, a, content, c) => {
    const out = [];
    for (const raw of content.split(',')) {
      const t = raw.trim();
      if (t === '業界人' || t === '業界人視点') continue;
      out.push(raw.replace(/^(\s*)業界人\s+/, '$1'));
    }
    return a + out.join(',') + c;
  });
}

const LINE_RULES = {
  heading: [
    ['headings', rewriteHeadingLine],
    ['intros', rewriteIntroLine],
    ['keywords', rewriteKeywordsLine],
  ],
};

// ── 段階 description ──

// 検査の語。error の語すべてと、規則で直す info の語（業界視点／目線・業界の内側）。「厳選」単独などは対象にしない
const INFO_TARGETS = new Set(['gyokai-no-kijun', 'gyokai-uchigawa']);

function loadTargetTerms(root) {
  const audit = require('./audit_selection_wording');
  const base = fs.existsSync(path.join(root, 'data', 'selection_wording_policy.json')) ? root : REPO_ROOT;
  return audit.compilePolicy(audit.loadPolicy(base)).terms.filter((t) => t.severity === 'error' || INFO_TARGETS.has(t.id));
}

function hasHit(terms, s) {
  return terms.some((t) => { t.re.lastIndex = 0; return t.re.test(s); });
}

// 「業界人視点で」「業界人の目で」「業界目線で」「業界人の視点から」…（副詞）。前後の読点は文の形に合わせて整える
const ADVERB = /(、)?(?:業界人(?:の)?(?:視点|目線|目)(?:で|から)|業界(?:視点|目線)(?:で|から))(、)?/g;
const VERB_HEAD = /^(?:解説|読|整理|解剖|分解|振り返|解読|逆算|比較|紹介|解く|書く|伝え|説明|まとめ|見|考え)/;
// 「業界人が読む」「業界人が解剖」…（主語）。読点が続く形（「業界人が、」）は規則では直さない
const SUBJECT = /業界人が(?=[^、])/g;

function dropAdverbs(s) {
  return s.replace(ADVERB, (m, lead, trail, off, str) => {
    const prev = off > 0 ? str[off - 1] : '';
    const rest = str.slice(off + m.length);
    if (lead && VERB_HEAD.test(rest) && prev !== 'か') return '';      // 「〜を、業界人の目で読み解く」→「〜を読み解く」（「〜のか、…」は読点を残す）
    const atSentenceStart = !lead && (prev === '' || /[。！？」』\s—]/.test(prev));
    if (atSentenceStart && trail) return '';                           // 「。業界人視点で、なぜ…」→「。なぜ…」
    return (lead || '') + (trail || '');                               // 「…並べて、業界人の目で回収の…」→「…並べて、回収の…」
  });
}

function dropPersona(s) {
  return dropAdverbs(s).replace(SUBJECT, '');
}

// 書き換えの結果が崩れて見えるか（助詞のあとの句点・句点のあとの読点・読点の重なりなど）。前より増えたときだけ数える
function looksBroken(before, after) {
  const count = (re, s) => (s.match(re) || []).length;
  return [/[をにがはでと]。/g, /。、/g, /、、/g, /、。/g, /^[、。を]/g].some((re) => count(re, after) > count(re, before));
}

function rewriteDescriptionText(text) {
  const own = OVERRIDES.description;
  return Object.prototype.hasOwnProperty.call(own, text) ? own[text] : dropPersona(text);
}

// 検査の語が無い文には触らない。語がある文は、書き換えが安全の検査を通るときだけ書き換える
function checkedRewrite(text, terms) {
  if (!hasHit(terms, text)) return { text };
  const next = rewriteDescriptionText(text);
  if (next === text) return { text, problem: '規則でも対応表でも直らない' };
  if (signature(text) !== signature(next)) return { text, problem: '数字か「」『』の中身が変わる' };
  if (hasHit(terms, next)) return { text, problem: '書き換えた後にも検査の語が残る' };
  if (looksBroken(text, next)) return { text, problem: '文が崩れて見える（対応表で直す）' };
  return { text: next };
}

function unesc(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// 元の書き方（' を &#39; にしていたか）に合わせて、属性の中の文字を実体参照にする
function escLike(s, like) {
  let t = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  if (/&#39;/.test(like) && !/'/.test(like)) t = t.replace(/'/g, '&#39;');
  return t;
}

const META_DESC_RE = /(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")([^"]*)(")/g;
const LD_BLOCK_RE = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g;
const LD_DESC_RE = /("description"\s*:\s*)("(?:[^"\\]|\\.)*")/g;
const LEAD_RE = /(<p class="art-lead">)([\s\S]*?)(<\/p>)/g;

function lineAt(text, off) {
  return text.slice(0, off).split('\n').length;
}

function rewriteDescriptions(text, terms, stats, violations, changes) {
  const apply = (key, n, plain, build, original) => {
    if (!hasHit(terms, plain)) return original;
    const r = checkedRewrite(plain, terms);
    if (r.problem) { violations.push({ n, key, before: plain, after: r.problem }); return original; }
    stats[key] = (stats[key] || 0) + 1;
    changes.push({ n, key, before: plain, after: r.text });
    return build(r.text);
  };

  let t = text.replace(META_DESC_RE, (m, a, raw, c, off, str) => {
    const plain = unesc(raw);
    if (escLike(plain, raw) !== raw) {
      if (hasHit(terms, plain)) violations.push({ n: lineAt(str, off), key: 'meta', before: plain, after: '実体参照の形が想定外' });
      return m;
    }
    return apply('meta', lineAt(str, off), plain, (s) => a + escLike(s, raw) + c, m);
  });

  t = t.replace(LD_BLOCK_RE, (m, a, body, c, blockOff, str) => {
    const startLine = lineAt(str, blockOff);
    return a + body.replace(LD_DESC_RE, (mm, k, lit, off, inner) => {
      const n = startLine + lineAt(inner, off) - 1;
      let plain;
      try { plain = JSON.parse(lit); } catch (e) { return mm; }
      if (typeof plain !== 'string') return mm;
      if (JSON.stringify(plain) !== lit) {
        if (hasHit(terms, plain)) violations.push({ n, key: 'jsonld', before: plain, after: 'JSON の文字列の書き方が想定外' });
        return mm;
      }
      return apply('jsonld', n, plain, (s) => k + JSON.stringify(s), mm);
    }) + c;
  });

  t = t.replace(LEAD_RE, (m, a, raw, c, off, str) => {
    const n = lineAt(str, off);
    if (/</.test(raw)) {
      if (hasHit(terms, raw.replace(/<[^>]+>/g, ''))) violations.push({ n, key: 'lead', before: raw.slice(0, 80), after: 'リードの中にタグがある' });
      return m;
    }
    const plain = unesc(raw);
    if (escLike(plain, raw) !== raw) {
      if (hasHit(terms, plain)) violations.push({ n, key: 'lead', before: plain, after: '実体参照の形が想定外' });
      return m;
    }
    return apply('lead', n, plain, (s) => a + escLike(s, raw) + c, m);
  });
  return t;
}

// journal/index.html の冒頭（meta description・og:description・JSON-LD の description・見出し下の説明）。対応表は journal_wording_overrides.js の landing
function rewriteLanding(text, terms) {
  const stats = {};
  const violations = [];
  const changes = [];
  let t = text;
  for (const [before, after] of OVERRIDES.landing) {
    const n = t.split(before).length - 1;
    if (n === 0) continue;
    const at = lineAt(t, t.indexOf(before));
    if (n > 1) { violations.push({ n: at, key: 'landing', before, after: '同じ行が複数ある' }); continue; }
    if (signature(before) !== signature(after)) { violations.push({ n: at, key: 'landing', before, after: '数字か「」『』の中身が変わる' }); continue; }
    if (hasHit(terms, after)) { violations.push({ n: at, key: 'landing', before, after: '書き換えた後にも検査の語が残る' }); continue; }
    t = t.replace(before, () => after);
    stats.landing = (stats.landing || 0) + 1;
    changes.push({ n: at, key: 'landing', before: before.trim(), after: after.trim() });
  }
  return { text: t, stats, violations, changes };
}

const PHASES = ['heading', 'description'];

// 行ごとに規則を当てる。前後の署名が違う行は書き換えず、violations に残す
function applyLineRules(text, rules, stats, violations, changes) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const [key, fn] of rules) {
      const before = lines[i];
      const after = fn(before);
      if (after === before) continue;
      if (signature(before) !== signature(after)) {
        violations.push({ n: i + 1, key, before, after });
        continue;
      }
      lines[i] = after;
      stats[key] = (stats[key] || 0) + 1;
      changes.push({ n: i + 1, key, before: before.trim(), after: after.trim() });
    }
  }
  return lines.join('\n');
}

function rewriteText(text, phases, terms = null) {
  const stats = {};
  const violations = [];
  const changes = [];
  let t = text;
  if (phases.includes('heading')) {
    t = t.replace(PLACEHOLDER_BOX, () => { stats.boxes = (stats.boxes || 0) + 1; return ''; });
  }
  const rules = phases.flatMap((p) => LINE_RULES[p] || []);
  t = applyLineRules(t, rules, stats, violations, changes);
  if (phases.includes('description')) {
    if (!terms) throw new Error('description 段階には検査の語（terms）が要る');
    t = rewriteDescriptions(t, terms, stats, violations, changes);
  }
  return { text: t, stats, violations, changes };
}

// data/journal_published.json の description（一覧・フィード・トップの最新 3 件の元）
function rewritePublished(raw, terms) {
  const stats = {};
  const violations = [];
  const changes = [];
  const j = JSON.parse(raw);
  if (JSON.stringify(j, null, 2) + '\n' !== raw) {
    return { text: raw, stats, violations: [{ n: 0, key: 'published', before: 'data/journal_published.json', after: '書式（2 スペース・末尾の改行）が想定外' }], changes };
  }
  (j.entries || []).forEach((e, i) => {
    if (typeof e.description !== 'string' || !hasHit(terms, e.description)) return;
    const r = checkedRewrite(e.description, terms);
    if (r.problem) { violations.push({ n: i + 1, key: 'published', before: e.description, after: r.problem }); return; }
    changes.push({ n: i + 1, key: 'published', before: e.description, after: r.text });
    stats.published = (stats.published || 0) + 1;
    e.description = r.text;
  });
  return { text: JSON.stringify(j, null, 2) + '\n', stats, violations, changes };
}

function listArticles(root, only) {
  const dir = path.join(root, 'journal');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => ARTICLE_RE.test(f) && (!only || f.includes(only))).sort().map((f) => path.join(dir, f));
}

function parseArgs(argv) {
  const a = { phases: [], dryRun: false, check: false, only: '', list: 0, root: REPO_ROOT };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--phase') a.phases.push(argv[++i]);
    else if (v === '--dry-run') a.dryRun = true;
    else if (v === '--check') a.check = true;
    else if (v === '--only') a.only = argv[++i] || '';
    else if (v === '--root') a.root = path.resolve(argv[++i]);
    else if (v === '--list') a.list = /^\d+$/.test(argv[i + 1] || '') ? Number(argv[++i]) : 20;
    else throw new Error(`知らない引数: ${v}`);
  }
  if (!a.phases.length) throw new Error(`--phase が要る（${PHASES.join(' / ')}）`);
  for (const p of a.phases) if (!PHASES.includes(p)) throw new Error(`知らない段階: ${p}（${PHASES.join(' / ')}）`);
  return a;
}

function main(argv, out = console.log) {
  const args = parseArgs(argv);
  const terms = args.phases.includes('description') ? loadTargetTerms(args.root) : null;
  const files = listArticles(args.root, args.only);
  const total = {};
  let changedFiles = 0;
  let bad = 0;
  const sample = [];
  const writes = [];
  const show = (name, c) => sample.length < args.list && sample.push(`${name}:${c.n} [${c.key}]\n  前: ${c.before.slice(0, 200)}\n  後: ${c.after.slice(0, 200)}`);
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const r = rewriteText(text, args.phases, terms);
    for (const v of r.violations) { bad++; out(`NG ${path.basename(f)}:${v.n} [${v.key}] ${v.after}`); }
    if (r.text === text) continue;
    changedFiles++;
    for (const [k, n] of Object.entries(r.stats)) total[k] = (total[k] || 0) + n;
    for (const c of r.changes) show(path.basename(f), c);
    writes.push([f, r.text]);
  }
  if (args.phases.includes('description') && !args.only) {
    const lf = path.join(args.root, 'journal', 'index.html');
    if (fs.existsSync(lf)) {
      const raw = fs.readFileSync(lf, 'utf8');
      const r = rewriteLanding(raw, terms);
      for (const v of r.violations) { bad++; out(`NG journal/index.html:${v.n} [${v.key}] ${v.after}`); }
      if (r.text !== raw) {
        changedFiles++;
        for (const [k, n] of Object.entries(r.stats)) total[k] = (total[k] || 0) + n;
        for (const c of r.changes) show('index.html', c);
        writes.push([lf, r.text]);
      }
    }
    const pf = path.join(args.root, 'data', 'journal_published.json');
    if (fs.existsSync(pf)) {
      const raw = fs.readFileSync(pf, 'utf8');
      const r = rewritePublished(raw, terms);
      for (const v of r.violations) { bad++; out(`NG data/journal_published.json:${v.n} [${v.key}] ${v.after}`); }
      if (r.text !== raw) {
        changedFiles++;
        for (const [k, n] of Object.entries(r.stats)) total[k] = (total[k] || 0) + n;
        for (const c of r.changes) show('journal_published.json', c);
        writes.push([pf, r.text]);
      }
    }
  }
  if (!bad && !args.dryRun && !args.check) for (const [f, t] of writes) fs.writeFileSync(f, t);
  const detail = Object.entries(total).map(([k, n]) => `${k} ${n}`).join('・') || '変更なし';
  out(`ジャーナルの言い方の移行（${args.phases.join('+')}）: 記事 ${files.length} 本 / 書き換え ${changedFiles} 件（${detail}）${args.dryRun ? ' [dry-run]' : ''}${args.check ? ' [check]' : ''}`);
  for (const s of sample) out(s);
  if (bad) return 2;
  if (args.check && changedFiles) return 1;
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(`rewrite_journal_wording: ${e.message}`);
    process.exit(2);
  }
}

module.exports = {
  rewriteText, rewriteHeadingLine, rewriteIntroLine, rewriteKeywordsLine, applyLineRules, signature, main, PHASES, PLACEHOLDER_BOX,
  dropPersona, dropAdverbs, looksBroken, checkedRewrite, rewriteDescriptionText, rewritePublished, rewriteLanding, loadTargetTerms, hasHit, unesc, escLike,
};
