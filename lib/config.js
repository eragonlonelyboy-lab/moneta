'use strict';
// MONETA shared config + state. Zero deps, Node >= 18, Windows-first.
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = process.env.MONETA_HOME || path.join(os.homedir(), '.moneta');
const REPO_ROOT = path.join(__dirname, '..');

// Doctrine defaults. All estimates use chars/4 ~= tokens: a stated, inspectable approximation.
const DEFAULTS = {
  mode: 'warn',                    // 'warn' (default) | 'deny' — deny is opt-in, per the council
  read_warn_tokens: 8000,          // warn when a single Read is estimated above this
  deny_tokens: 40000,              // deny-mode only: block single reads above this
  read_shrink: false,              // opt-in: rewrite oversized Reads to offset/limit via updatedInput
  pregate_pct: 40,                 // the 40% pre-work budget gate
  context_window_tokens: 200000,   // fallback when the statusline bridge has no data yet
  chars_per_token: 4,
  statusline_passthrough: ''       // optional: your existing statusline command; MONETA appends its ticker
};

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); } // strip UTF-8 BOM
  catch { return fallback; }
}

function writeJSON(p, obj) { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8'); }

function appendJSONL(p, obj) { ensureDir(path.dirname(p)); fs.appendFileSync(p, JSON.stringify(obj) + '\n', 'utf8'); }

function readJSONL(p) {
  try {
    return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

function loadConfig() { return { ...DEFAULTS, ...readJSON(path.join(HOME, 'config.json'), {}) }; }

function sessionDir(id) { return ensureDir(path.join(HOME, 'sessions', id || 'unknown')); }
function bridgePath(id) { return path.join(sessionDir(id), 'bridge.json'); }
function ledgerPath(id) { return path.join(sessionDir(id), 'ledger.jsonl'); }
function statePath(id) { return path.join(sessionDir(id), 'state.json'); }
function estTokens(chars, cfg) { return Math.round(chars / ((cfg || DEFAULTS).chars_per_token)); }

module.exports = { HOME, REPO_ROOT, DEFAULTS, ensureDir, readJSON, writeJSON, appendJSONL, readJSONL, loadConfig, sessionDir, bridgePath, ledgerPath, statePath, estTokens };
