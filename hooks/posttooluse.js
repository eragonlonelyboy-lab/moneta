#!/usr/bin/env node
'use strict';
// MONETA PostToolUse: the honest ledger. Records what was actually ingested and when work started.
// Pure accounting: never blocks, never throws.
const { loadConfig, readJSON, writeJSON, appendJSONL, statePath, ledgerPath, estTokens } = require('../lib/config');

const WORK_TOOLS = /^(Write|Edit|NotebookEdit)$/;
const WRITE_MCP = /(create|update|add|edit|delete|transition|push)/i;

let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  if (process.env.MONETA_DISABLED === '1') process.exit(0);
  const cfg = loadConfig();
  const sid = input.session_id;
  const tool = input.tool_name;
  const ti = input.tool_input || {};
  const st = readJSON(statePath(sid), { work_started: false, prework_read_tokens: 0, avoided_tokens_lb: 0, gate_warned: false, warns: 0 });

  try {
    // Work starts at the first artifact write (file edit or external system write).
    if (!st.work_started && (WORK_TOOLS.test(tool) || (tool.startsWith('mcp__') && WRITE_MCP.test(tool.slice(tool.lastIndexOf('__') + 2))))) {
      st.work_started = true;
      st.work_started_ts = Date.now();
      // Freeze the context % at first edit: a headline report-card number.
      const bridge = readJSON(require('../lib/config').bridgePath(sid), {});
      st.pct_at_first_edit = bridge.used_percentage != null ? Math.round(bridge.used_percentage) : null;
      writeJSON(statePath(sid), st);
      appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'work_start', tool });
    }

    // Reads: log actual ingested size (response length is ground truth for what entered context).
    if (tool === 'Read' || tool === 'Grep' || tool === 'Glob') {
      let respChars = 0;
      const r = input.tool_response;
      if (typeof r === 'string') respChars = r.length;
      else if (r && typeof r === 'object') respChars = JSON.stringify(r).length;
      const est = estTokens(respChars, cfg);
      appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: tool.toLowerCase(), file: ti.file_path || ti.pattern || ti.path || null, est_tokens: est, targeted: !!(ti.offset || ti.limit) });
      if (!st.work_started) { st.prework_read_tokens += est; writeJSON(statePath(sid), st); }

      // Warn-obeyed accounting (lower bound): a prior warn on this file, and this access is
      // a Grep or a targeted Read instead of the full Read -> the avoided delta is banked.
      // Each warn banks at most ONCE (banked_warn_ts in state): double-counting would be a fake number.
      if (ti.file_path || tool === 'Grep') {
        st.banked_warn_ts = st.banked_warn_ts || [];
        const entries = require('../lib/config').readJSONL(ledgerPath(sid));
        const lastWarn = [...entries].reverse().find(e => e.kind === 'warn' && !st.banked_warn_ts.includes(e.ts) && (e.file === ti.file_path || tool === 'Grep'));
        if (lastWarn && (tool === 'Grep' || (tool === 'Read' && (ti.offset || ti.limit)))) {
          const avoided = Math.max(0, lastWarn.est_tokens - est);
          if (avoided > 0) {
            st.avoided_tokens_lb += avoided;
            st.banked_warn_ts.push(lastWarn.ts);
            writeJSON(statePath(sid), st);
            appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'avoided', file: lastWarn.file, tokens_lb: avoided, warn_ts: lastWarn.ts });
          }
        }
      }
    }
  } catch { /* accounting must never break a session */ }
  process.exit(0);
});
