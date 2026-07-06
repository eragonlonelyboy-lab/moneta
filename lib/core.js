'use strict';
// MONETA core: the runtime-agnostic harness brain (Tier 2).
// Adapters (hooks/, one per runtime) normalize their event into { sessionId, tool, input, response }
// and render the returned decision in their runtime's dialect. The core stays deterministic,
// token-free, and honest: warn-first, lower bounds only, nothing here ever calls a model.
const fs = require('fs');
const path = require('path');
const { loadConfig, readJSON, writeJSON, appendJSONL, readJSONL, statePath, bridgePath, ledgerPath, estTokens } = require('./config');

const WORK_TOOLS = /^(Write|Edit|NotebookEdit)$/;
const WRITE_MCP = /(create|update|add|edit|delete|transition|push)/i;

function freshState() {
  return { work_started: false, prework_read_tokens: 0, avoided_tokens_lb: 0, gate_warned: false, warns: 0, dedup_warned: [], output_warned: [], budget_warned: [] };
}
function loadState(sid) { return { ...freshState(), ...readJSON(statePath(sid), {}) }; }

// Classify a tool into an intake class for accounting and output nudges.
function toolClass(tool) {
  if (tool === 'Read') return 'read';
  if (tool === 'Grep') return 'grep';
  if (tool === 'Glob') return 'glob';
  if (tool === 'Bash' || tool === 'PowerShell') return 'shell';
  if (tool === 'WebFetch' || tool === 'WebSearch') return 'webfetch';
  if (tool === 'Agent' || tool === 'Task') return 'agent';
  if (tool.startsWith('mcp__')) return WRITE_MCP.test(tool.slice(tool.lastIndexOf('__') + 2)) ? 'mcp_write' : 'mcp';
  return 'other';
}

function grepSig(ti) { return ['grep', ti.pattern, ti.path || '', ti.glob || '', ti.type || '', ti.output_mode || ''].join('|'); }

// --- Redundancy lens: has this exact ingestion already happened this session? ---
// Warn-only and once per key: after a compaction the context may genuinely need a re-read,
// so the message says so. No savings are ever banked for dedup (no observable counterfactual).
function dedupCheck(evt, st, ledger) {
  const ti = evt.input || {};
  let key = null, msg = null;
  if (evt.tool === 'Read' && ti.file_path) {
    const prior = ledger.filter(e => e.kind === 'read' && e.file === ti.file_path);
    const full = prior.some(p => !p.targeted);
    const sameRange = prior.some(p => p.range && p.range[0] === (ti.offset || 0) && p.range[1] === (ti.limit || 0));
    if (full || sameRange) {
      key = 'read|' + ti.file_path;
      msg = `MONETA DEDUP: ${path.basename(ti.file_path)} was already read this session${full ? ' in full' : ' at this exact range'}: it should still be in context. Re-read only if the file changed or the context was compacted since.`;
    }
  } else if (evt.tool === 'Grep' && ti.pattern) {
    const sig = grepSig(ti);
    if (ledger.some(e => e.kind === 'grep' && e.sig === sig)) {
      key = sig;
      msg = 'MONETA DEDUP: this exact search already ran this session: the result is in context. Vary the pattern/scope if you need something new.';
    }
  } else if ((evt.tool === 'WebFetch' || evt.tool === 'WebSearch') && (ti.url || ti.query)) {
    const u = ti.url || ti.query;
    if (ledger.some(e => e.kind === 'webfetch' && e.url === u)) {
      key = 'webfetch|' + u;
      msg = 'MONETA DEDUP: this URL/query was already fetched this session: the content is in context. Fetch again only if you expect it changed.';
    }
  }
  if (key && !st.dedup_warned.includes(key)) return { key, msg };
  return null;
}

// ---------- PRE: the discipline lens ----------
// Returns { decision: 'silent' } | { decision: 'warn'|'deny'|'shrink', message, updatedInput? }
function preDecision(evt) {
  if (process.env.MONETA_DISABLED === '1') return { decision: 'silent' };
  const cfg = loadConfig();
  const sid = evt.sessionId;
  const ti = evt.input || {};
  const st = loadState(sid);

  try {
    // Fat-Read lens: only an untargeted Read of a real file.
    if (evt.tool === 'Read' && ti.file_path && !ti.offset && !ti.limit && fs.existsSync(ti.file_path)) {
      const bytes = fs.statSync(ti.file_path).size;
      const est = estTokens(bytes, cfg);
      if (est >= cfg.read_warn_tokens) {
        appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'warn', file: ti.file_path, est_tokens: est });
        st.warns += 1; writeJSON(statePath(sid), st);
        const bridge = readJSON(bridgePath(sid), {});
        const pctNote = bridge.used_percentage != null ? ` Context is at ${Math.round(bridge.used_percentage)}%.` : '';
        const message = `MONETA: this Read is ~${Math.round(est / 1000)}k tokens (${bytes} bytes).${pctNote} Grep for the pattern or Read with offset/limit first: never load a whole file for a few lines. If you truly need the full file, proceed; this is a warning, not a wall.`;
        if (cfg.mode === 'deny' && est >= cfg.deny_tokens) {
          return { decision: 'deny', message: `MONETA (deny-mode, opt-in): Read of ~${Math.round(est / 1000)}k tokens exceeds the ${Math.round(cfg.deny_tokens / 1000)}k hard cap. Grep or use offset/limit. Override: set mode:"warn" in ~/.moneta/config.json.` };
        }
        if (cfg.read_shrink && est >= cfg.deny_tokens) {
          return { decision: 'shrink', updatedInput: { ...ti, offset: 1, limit: 200 }, message: message + ' (MONETA rewrote this Read to the first 200 lines: re-Read with a targeted offset if you need more.)' };
        }
        return { decision: 'warn', message };
      }
    }

    // Redundancy lens: identical Read/Grep/WebFetch this session.
    const ledger = readJSONL(ledgerPath(sid));
    const dup = dedupCheck(evt, st, ledger);
    if (dup) {
      st.dedup_warned.push(dup.key); writeJSON(statePath(sid), st);
      appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'dedup_warn', key: dup.key });
      return { decision: 'warn', message: dup.msg };
    }

    // The pre-work budget gate.
    if (!st.work_started && !st.gate_warned) {
      const bridge = readJSON(bridgePath(sid), {});
      const pct = bridge.used_percentage != null ? bridge.used_percentage : (st.prework_read_tokens / cfg.context_window_tokens) * 100;
      if (pct >= cfg.pregate_pct) {
        st.gate_warned = true; writeJSON(statePath(sid), st);
        appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'gate', pct: Math.round(pct) });
        return { decision: 'warn', message: `MONETA BUDGET GATE: pre-work reading has consumed ~${Math.round(pct)}% of context and no output has been produced yet. Stop and re-plan the data gathering: targeted reads (Grep first, offset/limit), agents that return summaries instead of raw dumps, and only what the next step will actually use. (Estimate; the gate warns, it never blocks.)` };
      }
    }
  } catch { /* the lens must never break a session */ }
  return { decision: 'silent' };
}

// ---------- POST: the honest ledger + budget manager ----------
// Returns { context: string|null } - an optional nudge the adapter surfaces to the model.
function postAccount(evt) {
  if (process.env.MONETA_DISABLED === '1') return { context: null };
  const cfg = loadConfig();
  const sid = evt.sessionId;
  const tool = evt.tool;
  const ti = evt.input || {};
  const st = loadState(sid);
  const cls = toolClass(tool);
  let context = null;

  try {
    // Work starts at the first artifact write (file edit or external system write).
    if (!st.work_started && (WORK_TOOLS.test(tool) || cls === 'mcp_write')) {
      st.work_started = true;
      st.work_started_ts = Date.now();
      const bridge = readJSON(bridgePath(sid), {});
      st.pct_at_first_edit = bridge.used_percentage != null ? Math.round(bridge.used_percentage) : null;
      writeJSON(statePath(sid), st);
      appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'work_start', tool });
    }

    // Intake accounting: response size is ground truth for what entered context.
    let respChars = 0;
    const r = evt.response;
    if (typeof r === 'string') respChars = r.length;
    else if (r && typeof r === 'object') respChars = JSON.stringify(r).length;
    const est = estTokens(respChars, cfg);

    if (cls === 'read' || cls === 'grep' || cls === 'glob') {
      appendJSONL(ledgerPath(sid), {
        ts: Date.now(), kind: cls, file: ti.file_path || ti.pattern || ti.path || null,
        est_tokens: est, targeted: !!(ti.offset || ti.limit),
        range: ti.offset || ti.limit ? [ti.offset || 0, ti.limit || 0] : null,
        sig: cls === 'grep' ? grepSig(ti) : undefined
      });
      if (!st.work_started) { st.prework_read_tokens += est; writeJSON(statePath(sid), st); }

      // Warn-obeyed accounting (lower bound): a prior warn on this file, and this access is
      // a Grep or a targeted Read instead of the full Read -> the avoided delta is banked.
      // Each warn banks at most ONCE (banked_warn_ts): double-counting would be a fake number.
      if (ti.file_path || cls === 'grep') {
        st.banked_warn_ts = st.banked_warn_ts || [];
        const entries = readJSONL(ledgerPath(sid));
        const lastWarn = [...entries].reverse().find(e => e.kind === 'warn' && !st.banked_warn_ts.includes(e.ts) && (e.file === ti.file_path || cls === 'grep'));
        if (lastWarn && (cls === 'grep' || (cls === 'read' && (ti.offset || ti.limit)))) {
          const avoided = Math.max(0, lastWarn.est_tokens - est);
          if (avoided > 0) {
            st.avoided_tokens_lb += avoided;
            st.banked_warn_ts.push(lastWarn.ts);
            writeJSON(statePath(sid), st);
            appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'avoided', file: lastWarn.file, tokens_lb: avoided, warn_ts: lastWarn.ts });
          }
        }
      }
    } else if (cls === 'webfetch') {
      appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'webfetch', url: ti.url || ti.query || null, est_tokens: est });
      if (!st.work_started) { st.prework_read_tokens += est; writeJSON(statePath(sid), st); }
    } else if (respChars > 0) {
      appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'intake', tool_class: cls, tool, est_tokens: est });
      if (!st.work_started && cls !== 'mcp_write') { st.prework_read_tokens += est; writeJSON(statePath(sid), st); }
    }

    // Oversized-output nudge: once per tool class, for the dump-prone classes.
    if (['shell', 'webfetch', 'mcp', 'agent'].includes(cls) && est >= cfg.output_warn_tokens && !st.output_warned.includes(cls)) {
      st.output_warned.push(cls); writeJSON(statePath(sid), st);
      appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'output_warn', tool_class: cls, est_tokens: est });
      const advice = {
        shell: 'pipe through head/tail/grep/jq or a filter next time instead of dumping the raw output',
        webfetch: 'fetch a narrower page or extract the relevant section next time',
        mcp: 'request fewer items/fields or paginate the call next time',
        agent: 'give sub-agents an explicit output contract: structured summaries, never raw dumps'
      }[cls];
      context = `MONETA: that ${cls} result was ~${Math.round(est / 1000)}k tokens into context. Already ingested (nothing to undo): ${advice}. (Warned once per class per session.)`;
    }

    // Budget manager: threshold checkpoints from the bridge, each fires once.
    const bridge = readJSON(bridgePath(sid), {});
    if (bridge.used_percentage != null) {
      for (const th of [...(cfg.budget_thresholds || [])].sort((a, b) => b - a)) {
        if (bridge.used_percentage >= th && !st.budget_warned.includes(th)) {
          st.budget_warned.push(th); writeJSON(statePath(sid), st);
          appendJSONL(ledgerPath(sid), { ts: Date.now(), kind: 'budget', threshold: th, pct: Math.round(bridge.used_percentage) });
          const move = th >= (cfg.budget_thresholds[1] || 80)
            ? 'Wrap up the current step, write pending state down, and compact before continuing: past this point quality degrades quietly.'
            : 'Prefer offloading now: sub-agents returning summaries, targeted reads only, and plan the remaining work against the window you have left.';
          context = `MONETA BUDGET: context is at ~${Math.round(bridge.used_percentage)}% (checkpoint ${th}%). ${move} (Each checkpoint speaks once; this is a nudge, not a wall.)`;
          break;
        }
      }
    }
  } catch { /* accounting must never break a session */ }
  return { context };
}

module.exports = { preDecision, postAccount, toolClass };
