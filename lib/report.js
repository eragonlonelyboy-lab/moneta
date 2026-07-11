'use strict';
// MONETA session report card. Honest by construction:
// lower bounds only, estimates labeled, no per-rule attribution, quality status via HORKOS handshake.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { HOME, readJSON, readJSONL, statePath, ledgerPath, bridgePath } = require('./config');

function latestSession() {
  const dir = path.join(HOME, 'sessions');
  if (!fs.existsSync(dir)) return null;
  const ids = fs.readdirSync(dir).map(id => ({ id, p: path.join(dir, id, 'ledger.jsonl') })).filter(x => fs.existsSync(x.p));
  ids.sort((a, b) => fs.statSync(b.p).mtimeMs - fs.statSync(a.p).mtimeMs);
  return ids[0] ? ids[0].id : null;
}

// House rule 3: the quality handshake. HORKOS (independent sibling) stamps not-worse.
function horkosHandshake(sessionId) {
  const auditP = path.join(os.homedir(), '.horkos', 'sessions', sessionId, 'audit.json');
  const audit = readJSON(auditP, null);
  if (!audit) {
    const installed = fs.existsSync(path.join(os.homedir(), '.horkos'));
    return { status: 'unproven', note: installed
      ? 'HORKOS installed but no audit for this session: savings are estimates only.'
      : 'Savings are estimates only. Pair with HORKOS (the evidence-audit sibling) to stamp sessions "cheaper AND provably not-worse": github.com/eragonlonelyboy-lab/horkos' };
  }
  if (audit.verdict === 'pass') return { status: 'not-worse', note: `HORKOS audited this session clean (${audit.summary.pass}/${audit.summary.writes} writes verified): cheaper AND provably not-worse.` };
  return { status: 'quality-flagged', note: `HORKOS audit FAILED this session (${audit.summary.fail} fails, ${audit.summary.phantom_claims} phantoms). Cheap is worthless if the work is not done: fix that first.` };
}

function buildReport(sessionId) {
  const sid = sessionId || latestSession();
  if (!sid) return null;
  const st = readJSON(statePath(sid), {});
  const ledger = readJSONL(ledgerPath(sid));
  const bridge = readJSON(bridgePath(sid), {});

  const reads = ledger.filter(e => e.kind === 'read');
  const greps = ledger.filter(e => e.kind === 'grep');
  const warns = ledger.filter(e => e.kind === 'warn');
  const avoided = ledger.filter(e => e.kind === 'avoided');
  const gate = ledger.find(e => e.kind === 'gate');
  const dedups = ledger.filter(e => e.kind === 'dedup_warn');
  const outputWarns = ledger.filter(e => e.kind === 'output_warn');
  const budgets = ledger.filter(e => e.kind === 'budget');

  // Intake by class: everything that entered context, grouped, largest first.
  const byClass = {};
  for (const e of ledger) {
    const cls = e.kind === 'intake' ? e.tool_class : (['read', 'grep', 'glob', 'webfetch'].includes(e.kind) ? e.kind : null);
    if (cls && e.est_tokens) byClass[cls] = (byClass[cls] || 0) + e.est_tokens;
  }
  const intakeByClass = Object.entries(byClass).sort((a, b) => b[1] - a[1]);

  const work = {};
  for (const e of ledger) {
    if (!e.work_id) continue;
    if (!work[e.work_id]) work[e.work_id] = { work_id: e.work_id, events: 0, intake_tokens_est: 0, budget_breaches: 0 };
    work[e.work_id].events++;
    work[e.work_id].intake_tokens_est += e.est_tokens || 0;
    if (e.kind === 'budget') work[e.work_id].budget_breaches++;
  }

  // Waste heatmap: full (untargeted) reads grouped by directory, largest first.
  const byDir = {};
  for (const r of reads.filter(r => !r.targeted && r.file)) {
    const dir = path.dirname(r.file);
    byDir[dir] = (byDir[dir] || 0) + r.est_tokens;
  }
  const heatmap = Object.entries(byDir).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    session: sid,
    avoided_tokens_lb: st.avoided_tokens_lb || 0,
    warns_fired: warns.length,
    warns_obeyed: avoided.length,
    pct_at_first_edit: st.pct_at_first_edit ?? null,
    gate_fired: !!gate,
    gate_pct: gate ? gate.pct : null,
    grep_read_ratio: `${greps.length}:${reads.length}`,
    ingested_read_tokens_est: reads.reduce((s, r) => s + (r.est_tokens || 0), 0),
    cost_usd: bridge.cost_usd ?? null,
    heatmap,
    dedup_catches: dedups.length,
    output_warns: outputWarns.map(e => ({ tool_class: e.tool_class, est_tokens: e.est_tokens })),
    budget_checkpoints: budgets.map(e => ({ threshold: e.threshold, pct: e.pct })),
    intake_by_class: intakeByClass,
    work_units: Object.values(work).sort((a, b) => b.intake_tokens_est - a.intake_tokens_est),
    handshake: horkosHandshake(sid)
  };
}

function renderReport(r) {
  if (!r) return 'MONETA: no session ledger found yet. Run a session with the hooks installed.';
  const L = [];
  L.push('MONETA session report card: ' + r.session.slice(0, 8));
  L.push('  tier: MEASURED (runtime hooks). Agents governed only by compiled doctrine have no card: governed, unmeasured.');
  L.push('');
  L.push(`  loads avoided (lower bound) : >= ${r.avoided_tokens_lb.toLocaleString()} tokens (estimate)`);
  L.push(`  warns fired / obeyed        : ${r.warns_fired} / ${r.warns_obeyed}`);
  L.push(`  context %% at first edit    : ${r.pct_at_first_edit != null ? r.pct_at_first_edit + '%' : 'n/a (no bridge data: is the statusline installed?)'}`);
  L.push(`  40%% pre-work gate           : ${r.gate_fired ? 'FIRED at ' + r.gate_pct + '%' : 'not crossed'}`);
  L.push(`  grep : read ratio           : ${r.grep_read_ratio}`);
  L.push(`  tokens ingested via reads   : ~${r.ingested_read_tokens_est.toLocaleString()} (estimate)`);
  L.push(`  dedup catches               : ${r.dedup_catches} (repeat read/search/fetch warned; never counted as savings)`);
  if (r.output_warns.length) L.push(`  oversized outputs nudged    : ${r.output_warns.map(w => `${w.tool_class} ~${Math.round(w.est_tokens / 1000)}k`).join(', ')}`);
  if (r.budget_checkpoints.length) L.push(`  budget checkpoints fired    : ${r.budget_checkpoints.map(b => `${b.threshold}% (at ${b.pct}%)`).join(', ')}`);
  if (r.cost_usd != null) L.push(`  session cost                : $${r.cost_usd.toFixed(4)} (from Claude Code, not an estimate)`);
  if (r.intake_by_class.length) {
    L.push('  intake by class (everything that entered context):');
    for (const [cls, tok] of r.intake_by_class) L.push(`    ~${Math.round(tok / 1000)}k  ${cls}`);
  }
  if (r.work_units.length) {
    L.push('  work units (stable ids from MONETA_WORK_ID):');
    for (const w of r.work_units) L.push(`    ${w.work_id}: ~${w.intake_tokens_est.toLocaleString()} tokens, ${w.events} events, ${w.budget_breaches} budget checkpoint(s)`);
  }
  if (r.heatmap.length) {
    L.push('  waste heatmap (full reads by directory):');
    for (const [dir, tok] of r.heatmap) L.push(`    ~${Math.round(tok / 1000)}k  ${dir}`);
  }
  L.push('');
  L.push(`  quality: ${r.handshake.status.toUpperCase()}: ${r.handshake.note}`);
  L.push('');
  L.push('  Honesty line: every token figure above is a labeled lower-bound estimate (chars/4),');
  L.push('  not billing truth. No per-rule attribution is reported because no counterfactual exists.');
  return L.join('\n');
}

module.exports = { buildReport, renderReport, latestSession, horkosHandshake };
