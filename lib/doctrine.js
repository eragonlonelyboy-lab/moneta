'use strict';
// MONETA Tier 1 doctrine: the discipline rules compiled into agent instruction files.
// This is DATA, not enforcement. Any model that reads the workspace obeys these rules;
// only Tier 2 (runtime hooks) can MEASURE. Tier 1 alone = governed, unmeasured.
const DOCTRINE_VERSION = 2;

// Thresholds are read from the live config so the compiled text never contradicts the hooks.
function doctrineText(cfg) {
  const warnK = Math.round(cfg.read_warn_tokens / 1000);
  const [t1, t2] = cfg.budget_thresholds;
  return [
    `## Token discipline (MONETA v${DOCTRINE_VERSION})`,
    '',
    'Rules for ANY agent working in this workspace. Efficiency never trumps correctness:',
    'when a rule below conflicts with doing the work right, do the work right.',
    '',
    `1. **Targeted reads first.** Grep/search for the pattern before opening a file. Open big files with offset/limit (or head/tail). Never load a whole file above ~${warnK}k tokens to use a few lines.`,
    '2. **Never re-ingest.** Do not re-read a file already read this session, re-run an identical search, or re-fetch a URL already fetched. It is already in context.',
    `3. **Pre-work budget.** If file reading consumes ~${cfg.pregate_pct}% of the context window before the first real output or edit, stop and re-plan the data gathering: targeted reads, summaries, only what the next step needs.`,
    '4. **Filter at the source.** Pipe large command output through head/tail/grep/jq instead of dumping it. Cap listing depth. Request only the fields you need from APIs.',
    '5. **Delegate bulk.** Sub-agents return structured summaries with an explicit output contract, never raw dumps.',
    `6. **Budget checkpoints.** At ~${t1}% context used, offload or summarize before continuing. At ~${t2}%, wrap up the current step and compact.`,
    '7. **Honest numbers.** Never claim token savings you did not measure. In this workspace only the MONETA runtime ledger counts; an agent following these rules without hooks is governed but unmeasured.'
  ].join('\n');
}

module.exports = { DOCTRINE_VERSION, doctrineText };
