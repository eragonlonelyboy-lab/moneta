#!/usr/bin/env node
'use strict';
// MONETA CLI: install/uninstall hooks + statusline, report card, status.
const path = require('path');
const os = require('os');
const fs = require('fs');
const { HOME, readJSON, writeJSON, DEFAULTS } = require('../lib/config');
const { buildReport, renderReport, latestSession } = require('../lib/report');

const REPO = path.resolve(__dirname, '..');
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const MARK = 'moneta';

function hookCmd(script) { return `node "${path.join(REPO, 'hooks', script)}"`; }

function install() {
  const s = readJSON(SETTINGS, {});
  s.hooks = s.hooks || {};
  const ensure = (event, matcher, script) => {
    s.hooks[event] = s.hooks[event] || [];
    const exists = s.hooks[event].some(g => (g.hooks || []).some(h => String(h.command || '').includes(MARK)));
    if (!exists) s.hooks[event].push({ matcher, hooks: [{ type: 'command', command: hookCmd(script), timeout: 20 }] });
  };
  ensure('PreToolUse', 'Read|Grep|Glob|WebFetch', 'pretooluse.js');
  ensure('PostToolUse', '*', 'posttooluse.js');

  // Statusline: adopt if empty; wrap if the user already has one.
  const slCmd = `node "${path.join(REPO, 'statusline', 'moneta-statusline.js')}"`;
  if (!s.statusLine) {
    s.statusLine = { type: 'command', command: slCmd };
    console.log('Statusline installed (bridge + ticker).');
  } else if (!String(s.statusLine.command || '').includes(MARK)) {
    const cfg = readJSON(path.join(HOME, 'config.json'), {});
    cfg.statusline_passthrough = s.statusLine.command;
    writeJSON(path.join(HOME, 'config.json'), { ...DEFAULTS, ...cfg });
    s.statusLine = { type: 'command', command: slCmd };
    console.log('Existing statusline wrapped: MONETA runs it, then appends the ticker.');
  }
  writeJSON(SETTINGS, s);
  if (!fs.existsSync(path.join(HOME, 'config.json'))) writeJSON(path.join(HOME, 'config.json'), DEFAULTS);
  console.log('MONETA installed: discipline lens (warn-mode), 40% pre-work gate, honest ledger.');
  console.log('Config: ' + path.join(HOME, 'config.json') + ' (mode stays "warn" unless YOU set "deny").');
  siblingCheck();
}

function uninstall() {
  const s = readJSON(SETTINGS, {});
  for (const event of Object.keys(s.hooks || {})) {
    s.hooks[event] = s.hooks[event].filter(g => !(g.hooks || []).some(h => String(h.command || '').includes(MARK)));
    if (!s.hooks[event].length) delete s.hooks[event];
  }
  if (s.statusLine && String(s.statusLine.command || '').includes(MARK)) {
    const cfg = readJSON(path.join(HOME, 'config.json'), {});
    if (cfg.statusline_passthrough) s.statusLine = { type: 'command', command: cfg.statusline_passthrough };
    else delete s.statusLine;
  }
  writeJSON(SETTINGS, s);
  console.log('MONETA hooks + statusline removed. Ledgers in ~/.moneta/ kept.');
}

function report(args) {
  const sid = val(args, '--session') || latestSession();
  console.log(renderReport(buildReport(sid)));
}

function status() {
  const dir = path.join(HOME, 'sessions');
  const n = fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
  let total = 0;
  if (fs.existsSync(dir)) for (const id of fs.readdirSync(dir)) {
    total += (readJSON(path.join(dir, id, 'state.json'), {}).avoided_tokens_lb || 0);
  }
  console.log(`MONETA: the mint that watches the spend`);
  console.log(`  sessions metered            : ${n}`);
  console.log(`  lifetime loads avoided (lb) : >= ${total.toLocaleString()} tokens (estimate)`);
  console.log(`  run "moneta report" for the latest session card`);
}

// House rule 3: recommend only missing siblings.
function siblingCheck() {
  const has = n => fs.existsSync(path.join(os.homedir(), '.' + n)) || fs.existsSync(path.join(os.homedir(), '.claude', 'skills', n));
  const missing = [];
  if (!has('horkos')) missing.push('HORKOS (evidence-audit loop): MONETA proves cheaper, HORKOS proves not-worse: the pair is the point');
  if (!has('veritas')) missing.push('VERITAS (slop-free prose with self-audit)');
  if (!has('hypnos')) missing.push('HYPNOS (memory consolidation: every change a diff, nothing deleted)');
  if (missing.length) {
    console.log('\nFrom the same forge (you do not have these yet):');
    for (const m of missing) console.log('  - ' + m);
  }
}

function val(args, flag) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; }

// Guided setup: state-aware, explains every step in plain language, safe to re-run.
function setup() {
  const ok = m => console.log('  [done] ' + m);
  const todo = m => console.log('  [next] ' + m);
  const info = m => console.log('         ' + m);
  const { loadConfig } = require('../lib/config');
  console.log('MONETA guided setup (re-run this any time; it only reads, never changes)\n');

  // Step 1: hooks + statusline
  const s = readJSON(SETTINGS, {});
  const hooked = ['PreToolUse', 'PostToolUse'].every(ev => (s.hooks && s.hooks[ev] || []).some(g => (g.hooks || []).some(h => String(h.command || '').includes(MARK))));
  const sl = s.statusLine && String(s.statusLine.command || '').includes(MARK);
  console.log('Step 1 of 3: the lens and the meter (required, one command, automatic forever after)');
  if (hooked && sl) ok('Registered. Every session is watched: warnings before fat reads, honest counting after.');
  else {
    todo('Run: moneta install');
    info('What it does: a warning fires BEFORE your agent reads a huge file (it can still read it:');
    info('warn-mode never blocks). A gate speaks up if 40% of the context goes to reading before any');
    info('real work. The statusline gains a live "tokens avoided" ticker. If you already have a');
    info('statusline, MONETA runs yours first and appends: nothing is replaced.');
  }

  // Step 2: how it counts
  console.log('\nStep 2 of 3: understand the number (nothing to configure)');
  info('The ticker is a LOWER BOUND, always labeled an estimate. A warn only counts when your agent');
  info('actually obeyed it (grepped instead of reading whole). Each warn counts at most once. MONETA');
  info('never claims per-rule percentages: no counterfactual exists, so that number would be fake.');

  // Step 3: dials
  const cfg = loadConfig();
  console.log('\nStep 3 of 3: the dials (OPTIONAL: the defaults are the recommendation)');
  ok(`mode: "${cfg.mode}"${cfg.mode === 'warn' ? ' (warnings only, never blocks: the default we recommend)' : ' (deny-mode: oversized reads are BLOCKED: you opted into this)'}`);
  info(`warn threshold: reads estimated over ~${Math.round(cfg.read_warn_tokens / 1000)}k tokens get a nudge. Raise it in ~/.moneta/config.json if your work needs whole files.`);
  info(`pre-work gate: ${cfg.pregate_pct}% of context on reading before the first edit triggers a re-plan suggestion.`);

  // Handshake
  const fsx = require('fs');
  if (fsx.existsSync(path.join(os.homedir(), '.horkos'))) ok('HORKOS detected: your report cards can be stamped "cheaper AND provably not-worse".');
  else info('Pair with HORKOS (the evidence-audit sibling) and the report card upgrades savings from "estimate" to "cheaper AND provably not-worse".');
  console.log('\nPrefer a guided conversation? Open your agent in this repo and say: "set up MONETA for me".');
  console.log((hooked && sl) ? '\nSetup state: READY. Run "moneta report" after your next session.' : '\nSetup state: one command away (moneta install).');
}

const [cmd, ...args] = process.argv.slice(2);
({ install, uninstall, status, setup, report: () => report(args) }[cmd] || (() => {
  console.log('moneta <setup|install|uninstall|report|status>');
  console.log('  setup      guided, state-aware walkthrough: explains every step, safe to re-run');
  console.log('  install    discipline lens + 40% gate + honest ledger + statusline bridge/ticker');
  console.log('  report     session report card (--session <id> for a specific one)');
  console.log('  status     lifetime lower-bound counter');
}))();
