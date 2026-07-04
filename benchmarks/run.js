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

// 7. Report card renders with the honesty line.
const { buildReport, renderReport } = require('../lib/report');
const card = renderReport(buildReport(SID));
check('report card renders honestly', card.includes('lower bound') && card.includes('not billing truth') && card.includes('estimate'), '');

// Results
console.log('\nMONETA accounting benchmark');
console.log('| check | pass |');
console.log('|---|---|');
for (const r of results) console.log(`| ${r.name} | ${r.pass ? 'YES' : 'NO — ' + r.detail} |`);
const passed = results.filter(r => r.pass).length;
console.log(`\n${passed}/${results.length} checks pass.`);
process.exit(passed === results.length ? 0 : 1);
