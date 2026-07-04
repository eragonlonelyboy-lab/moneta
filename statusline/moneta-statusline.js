#!/usr/bin/env node
'use strict';
// MONETA statusline: the bridge AND the ticker.
// Hooks receive no token/context fields (verified vs docs 2026-07). The statusline feed is the
// only reliable live source, so this script persists it per-session for the hooks to read,
// then prints the ticker segment. Optional passthrough wraps your existing statusline command.
const { execSync } = require('child_process');
const { loadConfig, readJSON, writeJSON, bridgePath, statePath } = require('../lib/config');

let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let input = {};
  try { input = JSON.parse(raw); } catch { /* keep going: still print something */ }
  const sessionId = input.session_id || (input.session && input.session.id) || 'unknown';
  const cw = input.context_window || {};
  const cost = input.cost || {};

  // 1. The bridge: persist what hooks cannot see. Approximate by nature (lags ~1 API response).
  try {
    writeJSON(bridgePath(sessionId), {
      ts: Date.now(),
      used_percentage: cw.used_percentage ?? null,
      total_input_tokens: cw.total_input_tokens ?? null,
      total_output_tokens: cw.total_output_tokens ?? null,
      cost_usd: cost.total_cost_usd ?? null,
      exceeds_200k: input.exceeds_200k_tokens ?? null
    });
  } catch { /* bridge failure must never break the statusline */ }

  // 2. Passthrough: run the user's original statusline if configured.
  let base = '';
  const cfg = loadConfig();
  if (cfg.statusline_passthrough) {
    try { base = execSync(cfg.statusline_passthrough, { input: raw, encoding: 'utf8', timeout: 4000 }).trim(); } catch { base = ''; }
  } else {
    const model = (input.model && (input.model.display_name || input.model.id)) || '';
    const pct = cw.used_percentage != null ? ` ${Math.round(cw.used_percentage)}% ctx` : '';
    base = `${model}${pct}`.trim();
  }

  // 3. The ticker: honest lower bound, always labeled an estimate.
  const st = readJSON(statePath(sessionId), {});
  const avoided = st.avoided_tokens_lb || 0;
  const ticker = avoided > 0 ? ` | [MONETA] ≥${avoided >= 1000 ? (avoided / 1000).toFixed(1) + 'k' : avoided} avoided (est.)` : '';
  process.stdout.write(base + ticker);
});
