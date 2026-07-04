#!/usr/bin/env node
'use strict';
// MONETA PreToolUse: the discipline lens.
// Warn-mode DEFAULT (allow + additionalContext). Deny-mode and read-shrink are opt-in.
// Never guesses: file sizes are stat'ed on disk before the Read happens.
const fs = require('fs');
const { loadConfig, readJSON, writeJSON, appendJSONL, statePath, bridgePath, ledgerPath, estTokens } = require('../lib/config');

function out(obj) { console.log(JSON.stringify(obj)); process.exit(0); }
function allowSilently() { process.exit(0); }

let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { return allowSilently(); }
  if (process.env.MONETA_DISABLED === '1') return allowSilently();
  const cfg = loadConfig();
  const sid = input.session_id;
  const tool = input.tool_name;
  const ti = input.tool_input || {};
  const st = readJSON(statePath(sid), { work_started: false, prework_read_tokens: 0, avoided_tokens_lb: 0, gate_warned: false, warns: 0 });

  try {
    // --- Single-read lens: only Read of a real file, without offset/limit already set ---
    if (tool === 'Read' && ti.file_path && !ti.offset && !ti.limit && fs.existsSync(ti.file_path)) {
      const bytes = fs.statSync(ti.file_path).size;
      const est = estTokens(bytes, cfg);
      if (est >= cfg.read_warn_tokens) {
        appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'warn', file: ti.file_path, est_tokens: est });
        st.warns += 1; writeJSON(statePath(sid), st);

        const bridge = readJSON(bridgePath(sid), {});
        const pctNote = bridge.used_percentage != null ? ` Context is at ${Math.round(bridge.used_percentage)}%.` : '';
        const msg = `MONETA: this Read is ~${Math.round(est / 1000)}k tokens (${bytes} bytes).${pctNote} Grep for the pattern or Read with offset/limit first: never load a whole file for a few lines. If you truly need the full file, proceed; this is a warning, not a wall.`;

        if (cfg.mode === 'deny' && est >= cfg.deny_tokens) {
          return out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `MONETA (deny-mode, opt-in): Read of ~${Math.round(est / 1000)}k tokens exceeds the ${Math.round(cfg.deny_tokens / 1000)}k hard cap. Grep or use offset/limit. Override: set mode:"warn" in ~/.moneta/config.json.` } });
        }
        if (cfg.read_shrink && est >= cfg.deny_tokens) {
          // Opt-in: rewrite the oversized Read into a head slice instead of blocking.
          return out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...ti, offset: 1, limit: 200 }, additionalContext: msg + ' (MONETA rewrote this Read to the first 200 lines: re-Read with a targeted offset if you need more.)' } });
        }
        return out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', additionalContext: msg } });
      }
    }

    // --- The 40% pre-work budget gate ---
    if (!st.work_started && !st.gate_warned) {
      const bridge = readJSON(bridgePath(sid), {});
      const pct = bridge.used_percentage != null
        ? bridge.used_percentage
        : (st.prework_read_tokens / cfg.context_window_tokens) * 100;
      if (pct >= cfg.pregate_pct) {
        st.gate_warned = true; writeJSON(statePath(sid), st);
        appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'gate', pct: Math.round(pct) });
        return out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', additionalContext: `MONETA BUDGET GATE: pre-work reading has consumed ~${Math.round(pct)}% of context and no output has been produced yet. Stop and re-plan the data gathering: targeted reads (Grep first, offset/limit), agents that return summaries instead of raw dumps, and only what the next step will actually use. (Estimate; the gate warns, it never blocks.)` } });
      }
    }
  } catch { /* the lens must never break a session */ }
  allowSilently();
});
