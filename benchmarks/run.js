#!/usr/bin/env node
'use strict';
// MONETA accounting benchmark. Deterministic: simulated hook streams -> assert the honest math.
// Verifies: warn fires, gate fires once, avoided banks once (never double), report card renders.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

process.env.MONETA_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'moneta-bench-'));
const HOME = process.env.MONETA_HOME;
const REPO = path.resolve(__dirname, '..');
const SID = 'bench-session';

function hook(script, input) {
  return execFileSync('node', [path.join(REPO, 'hooks', script)], {
    input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, MONETA_HOME: HOME }
  }).trim();
}

function readState() {
  return JSON.parse(fs.readFileSync(path.join(HOME, 'sessions', SID, 'state.json'), 'utf8'));
}

const results = [];
function check(name, cond, detail) { results.push({ name, pass: !!cond, detail: detail || '' }); }

// Fixture: a fat file (~60k chars -> ~15k tokens est) and a small one.
const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'moneta-fx-'));
const FAT = path.join(fixtures, 'fat.log');
fs.writeFileSync(FAT, 'x'.repeat(60000));
const SMALL = path.join(fixtures, 'small.md');
fs.writeFileSync(SMALL, 'tiny');

// 1. Warn fires on a fat untargeted Read, and is allow-not-block.
let out = hook('pretooluse.js', { session_id: SID, tool_name: 'Read', tool_input: { file_path: FAT } });
check('warn fires on fat Read', out.includes('additionalContext') && out.includes('"permissionDecision":"allow"'), out.slice(0, 120));

// 2. Small read passes silently.
out = hook('pretooluse.js', { session_id: SID, tool_name: 'Read', tool_input: { file_path: SMALL } });
check('small Read passes silently', out === '');

// 3. Obeying the warn (Grep instead) banks avoided tokens ONCE.
hook('posttooluse.js', { session_id: SID, tool_name: 'Grep', tool_input: { pattern: 'x', path: FAT }, tool_response: 'one matching line' });
const bank1 = readState().avoided_tokens_lb;
hook('posttooluse.js', { session_id: SID, tool_name: 'Grep', tool_input: { pattern: 'y', path: FAT }, tool_response: 'another line' });
const bank2 = readState().avoided_tokens_lb;
check('avoided banks once (lower bound)', bank1 > 10000 && bank2 === bank1, `bank1=${bank1} bank2=${bank2} (double-bank would be a fake number)`);

// 4. Pre-work gate fires when bridge says over 40%, and only once.
fs.writeFileSync(path.join(HOME, 'sessions', SID, 'bridge.json'), JSON.stringify({ ts: Date.now(), used_percentage: 47 }));
out = hook('pretooluse.js', { session_id: SID, tool_name: 'Grep', tool_input: { pattern: 'q' } });
check('40% gate fires from bridge', out.includes('BUDGET GATE') && out.includes('47%'), out.slice(0, 100));
out = hook('pretooluse.js', { session_id: SID, tool_name: 'Grep', tool_input: { pattern: 'q2' } });
check('gate fires only once', out === '');

// 5. Work-start freezes pct_at_first_edit; gate never fires after work starts.
hook('posttooluse.js', { session_id: SID, tool_name: 'Write', tool_input: { file_path: SMALL }, tool_response: 'ok' });
check('work start recorded with pct', readState().work_started === true && readState().pct_at_first_edit === 47);

// 6. Deny-mode blocks a giant read (opt-in path).
fs.mkdirSync(path.join(HOME), { recursive: true });
fs.writeFileSync(path.join(HOME, 'config.json'), JSON.stringify({ mode: 'deny', deny_tokens: 10000 }));
out = hook('pretooluse.js', { session_id: SID + '2', tool_name: 'Read', tool_input: { file_path: FAT } });
check('deny-mode (opt-in) blocks giant Read', out.includes('"permissionDecision":"deny"'), out.slice(0, 100));
fs.writeFileSync(path.join(HOME, 'config.json'), JSON.stringify({}));

// 6b. Read-shrink (opt-in): oversized Read rewritten to offset/limit instead of blocked.
fs.writeFileSync(path.join(HOME, 'config.json'), JSON.stringify({ read_shrink: true, deny_tokens: 10000, mode: 'warn' }));
out = hook('pretooluse.js', { session_id: SID + '3', tool_name: 'Read', tool_input: { file_path: FAT } });
check('read-shrink rewrites Read via updatedInput (opt-in)', out.includes('"updatedInput"') && out.includes('"limit":200') && out.includes('"permissionDecision":"allow"'), out.slice(0, 140));
fs.writeFileSync(path.join(HOME, 'config.json'), JSON.stringify({}));

// STRESS: malformed statusline stdin must not crash and still emits something safe.
out = execFileSync('node', [path.join(REPO, 'statusline', 'moneta-statusline.js')], { input: 'not json at all {', encoding: 'utf8', env: { ...process.env, MONETA_HOME: HOME } });
check('statusline survives garbage stdin', typeof out === 'string');

// STRESS: Read of a nonexistent file passes silently (no stat crash).
out = hook('pretooluse.js', { session_id: SID, tool_name: 'Read', tool_input: { file_path: path.join(fixtures, 'ghost.md') } });
check('nonexistent-file Read passes silently', out === '');

// STRESS: 40% gate fires WITHOUT the bridge (fallback: summed read estimates vs 200k window).
const SID4 = SID + '4';
const bigResp = 'y'.repeat(200000); // ~50k tokens est per response
hook('posttooluse.js', { session_id: SID4, tool_name: 'Read', tool_input: { file_path: SMALL }, tool_response: bigResp });
hook('posttooluse.js', { session_id: SID4, tool_name: 'Read', tool_input: { file_path: SMALL }, tool_response: bigResp });
out = hook('pretooluse.js', { session_id: SID4, tool_name: 'Grep', tool_input: { pattern: 'z' } });
check('gate falls back without bridge data', out.includes('BUDGET GATE'), out.slice(0, 100));

// STRESS: report on an unknown session renders without crashing.
const { buildReport: br2, renderReport: rr2 } = require('../lib/report');
check('report survives unknown session', typeof rr2(br2('no-such-session')) === 'string');

// ---------- v2: redundancy lens ----------
// 8. Re-reading a file already read in full warns once, then stays silent (once per key).
const SID5 = SID + '5';
hook('posttooluse.js', { session_id: SID5, tool_name: 'Read', tool_input: { file_path: FAT }, tool_response: 'full content' });
out = hook('pretooluse.js', { session_id: SID5, tool_name: 'Read', tool_input: { file_path: SMALL } });
check('fresh Read passes dedup silently', out === '');
out = hook('pretooluse.js', { session_id: SID5, tool_name: 'Read', tool_input: { file_path: FAT, offset: 10, limit: 5 } });
check('re-Read of ingested file warns DEDUP', out.includes('DEDUP') && out.includes('"permissionDecision":"allow"'), out.slice(0, 120));
out = hook('pretooluse.js', { session_id: SID5, tool_name: 'Read', tool_input: { file_path: FAT, offset: 20, limit: 5 } });
check('dedup warns once per key', out === '', out.slice(0, 120));

// 9. Identical Grep warns; varied Grep passes.
hook('posttooluse.js', { session_id: SID5, tool_name: 'Grep', tool_input: { pattern: 'foo', path: '/x' }, tool_response: 'hit' });
out = hook('pretooluse.js', { session_id: SID5, tool_name: 'Grep', tool_input: { pattern: 'foo', path: '/x' } });
check('identical Grep warns DEDUP', out.includes('DEDUP'), out.slice(0, 120));
out = hook('pretooluse.js', { session_id: SID5, tool_name: 'Grep', tool_input: { pattern: 'foo', path: '/y' } });
check('varied Grep passes silently', out === '');

// 10. Repeat WebFetch of the same URL warns.
hook('posttooluse.js', { session_id: SID5, tool_name: 'WebFetch', tool_input: { url: 'https://a.example/doc' }, tool_response: 'page body' });
out = hook('pretooluse.js', { session_id: SID5, tool_name: 'WebFetch', tool_input: { url: 'https://a.example/doc' } });
check('repeat WebFetch warns DEDUP', out.includes('DEDUP'), out.slice(0, 120));

// ---------- v2: broadened intake + output nudge ----------
// 11. A fat Bash result is accounted AND nudges once per class.
const SID6 = SID + '6';
out = hook('posttooluse.js', { session_id: SID6, tool_name: 'Bash', tool_input: { command: 'cat big.log' }, tool_response: 'z'.repeat(80000) });
check('fat shell output nudges (PostToolUse)', out.includes('additionalContext') && out.includes('~20k'), out.slice(0, 140));
out = hook('posttooluse.js', { session_id: SID6, tool_name: 'Bash', tool_input: { command: 'cat big2.log' }, tool_response: 'z'.repeat(80000) });
check('output nudge fires once per class', out === '', out.slice(0, 120));
const led6 = fs.readFileSync(path.join(HOME, 'sessions', SID6, 'ledger.jsonl'), 'utf8');
check('shell intake accounted in ledger', led6.includes('"kind":"intake"') && led6.includes('"tool_class":"shell"'), '');

// ---------- v2: budget checkpoints ----------
// 12. Bridge at 65% fires the 60 checkpoint once; at 85% the 80 checkpoint once; then silent.
const SID7 = SID + '7';
fs.mkdirSync(path.join(HOME, 'sessions', SID7), { recursive: true });
fs.writeFileSync(path.join(HOME, 'sessions', SID7, 'bridge.json'), JSON.stringify({ used_percentage: 65 }));
out = hook('posttooluse.js', { session_id: SID7, tool_name: 'Bash', tool_input: {}, tool_response: 'ok' });
check('budget checkpoint 60 fires at 65%', out.includes('BUDGET') && out.includes('checkpoint 60%'), out.slice(0, 140));
out = hook('posttooluse.js', { session_id: SID7, tool_name: 'Bash', tool_input: {}, tool_response: 'ok' });
check('checkpoint 60 fires only once', out === '', out.slice(0, 120));
fs.writeFileSync(path.join(HOME, 'sessions', SID7, 'bridge.json'), JSON.stringify({ used_percentage: 85 }));
out = hook('posttooluse.js', { session_id: SID7, tool_name: 'Bash', tool_input: {}, tool_response: 'ok' });
check('budget checkpoint 80 fires at 85%', out.includes('checkpoint 80%') && out.includes('compact'), out.slice(0, 140));
out = hook('posttooluse.js', { session_id: SID7, tool_name: 'Bash', tool_input: {}, tool_response: 'ok' });
check('checkpoint 80 fires only once', out === '', out.slice(0, 120));

// ---------- v2: Tier 1 compiler ----------
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'moneta-ws-'));
const { compile } = require('../lib/compile');
// 13. Dry-run writes nothing.
fs.writeFileSync(path.join(ws, 'CLAUDE.md'), '# My rules\n\nkeep me\n');
let cr = compile({ dir: ws });
check('compile dry-run writes nothing', !fs.readFileSync(path.join(ws, 'CLAUDE.md'), 'utf8').includes('MONETA:BEGIN') && cr.actions.some(a => a.action.startsWith('would')), '');
// 14. Apply inserts the managed block and preserves content outside it.
compile({ dir: ws, apply: true });
let claudeMd = fs.readFileSync(path.join(ws, 'CLAUDE.md'), 'utf8');
check('compile --apply inserts managed block', claudeMd.includes('MONETA:BEGIN') && claudeMd.includes('Token discipline') && claudeMd.includes('keep me'), '');
// 15. Re-apply is idempotent: exactly one block.
compile({ dir: ws, apply: true });
claudeMd = fs.readFileSync(path.join(ws, 'CLAUDE.md'), 'utf8');
check('compile re-apply idempotent (one block)', claudeMd.split('MONETA:BEGIN').length === 2, '');
// 16. Cursor target written only when .cursor/ exists.
fs.mkdirSync(path.join(ws, '.cursor'));
compile({ dir: ws, apply: true });
check('cursor .mdc written when .cursor exists', fs.existsSync(path.join(ws, '.cursor', 'rules', 'moneta.mdc')) && fs.readFileSync(path.join(ws, '.cursor', 'rules', 'moneta.mdc'), 'utf8').startsWith('---'), '');
// 17. --create scaffolds AGENTS.md only when no agent file exists.
const ws2 = fs.mkdtempSync(path.join(os.tmpdir(), 'moneta-ws2-'));
compile({ dir: ws2, apply: true, create: true });
check('--create scaffolds AGENTS.md when none exists', fs.existsSync(path.join(ws2, 'AGENTS.md')), '');
// 18. --remove strips the block, leaving the rest intact.
compile({ dir: ws, apply: true, remove: true });
claudeMd = fs.readFileSync(path.join(ws, 'CLAUDE.md'), 'utf8');
check('--remove strips block, keeps user content', !claudeMd.includes('MONETA:BEGIN') && claudeMd.includes('keep me') && !fs.existsSync(path.join(ws, '.cursor', 'rules', 'moneta.mdc')), '');

// 7. Report card renders with the honesty line + v2 sections.
const { buildReport, renderReport } = require('../lib/report');
const card = renderReport(buildReport(SID));
check('report card renders honestly', card.includes('lower bound') && card.includes('not billing truth') && card.includes('estimate'), '');
const card5 = renderReport(buildReport(SID5));
check('card shows dedup catches + tier line', card5.includes('dedup catches') && card5.includes('governed, unmeasured'), '');
const card6 = renderReport(buildReport(SID6));
check('card shows intake by class', card6.includes('intake by class') && card6.includes('shell'), '');

// Results
console.log('\nMONETA accounting benchmark');
console.log('| check | pass |');
console.log('|---|---|');
for (const r of results) console.log(`| ${r.name} | ${r.pass ? 'YES' : 'NO: ' + r.detail} |`);
const passed = results.filter(r => r.pass).length;
console.log(`\n${passed}/${results.length} checks pass.`);
process.exit(passed === results.length ? 0 : 1);
