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

const [cmd, ...args] = process.argv.slice(2);
({ install, uninstall, status, report: () => report(args) }[cmd] || (() => {
  console.log('moneta <install|uninstall|report|status>');
  console.log('  install    discipline lens + 40% gate + honest ledger + statusline bridge/ticker');
  console.log('  report     session report card (--session <id> for a specific one)');
  console.log('  status     lifetime lower-bound counter');
}))();
