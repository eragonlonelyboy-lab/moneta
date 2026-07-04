# HONEST NUMBERS: where MONETA loses

A cost tool that lies about savings is worse than no tool. Here is the full ledger of MONETA's limits, published before anyone asks.

## The estimates are estimates

- **chars/4 is an approximation.** Real tokenization varies by content (code tokenizes denser than prose). We state the divisor, we label every figure `(estimate)`, and we round down. If you need billing truth, use `/cost` and your provider invoice: MONETA prints the Claude Code cost figure on the card *because that one is not ours*.
- **"Loads avoided" is a lower bound with an assumption baked in:** when a warned Read is replaced by a Grep or a targeted Read, we bank the difference. We cannot know the model would truly have read the whole file, but we also don't count warns the agent ignored, warns followed by nothing, or anything twice. One warn banks at most once. The direction of every error is downward.
- **No per-rule attribution, permanently.** "The grep-first rule saved you 31%" requires a counterfactual session that never ran. Tools that publish per-rule percentages are decorating a guess. You get one aggregate lower bound.
- **The industry cautionary tale is why this page exists.** The most-starred token tool's 65–75% headline collapsed to 4–10% real session savings under independent testing, and its community *rewarded* the honest correction. We start where they were forced to arrive.

## When MONETA is worthless

- **Small repos.** Nothing big to read → nothing to avoid → the ticker stays at zero. Correct behavior, boring product.
- **Whole-file-context work.** Some tasks genuinely need full files (large refactors, file-level review). The warns become noise: set `read_warn_tokens` higher or `MONETA_DISABLED=1` for that session. An ignored warn costs you one paragraph of context; that cost is real and it's yours.
- **Sessions that are mostly conversation.** No reads, no ledger, no card.

## Mechanical limits

- **The bridge lags.** Hooks can't see context usage (no token fields in hook input: verified against docs). MONETA's statusline persists it per refresh, which trails by roughly one API response. The 40% gate therefore fires on an *approximate* number: it warns, it never blocks, and the card says "estimate."
- **No statusline, no bridge.** If you skip the statusline install, the gate falls back to summing read-estimates against a 200k window assumption, and `context % at first edit` shows `n/a`. Honest degradation, stated on the card.
- **Warn-mode adds a sentence to context each time it fires.** That's tokens too (~60–80 per warn). On terse, disciplined sessions MONETA can be net-negative: the exact failure mode we refuse to hide. The gate and lens exist for sessions that drift, not sessions already tight.
- **Deny-mode can block a read you actually needed.** That's why it ships OFF. Field reports on blocking-mode tools are unambiguous: false-positive blocks get tools uninstalled. Flip it only if you've watched warn-mode long enough to trust the thresholds.

## The only fully honest test

Provider-billing A/B: same work, gated vs ungated, real invoices. Short of that, run **holdout thinking**: disable MONETA for a week (`MONETA_DISABLED=1`), compare your `/cost` figures against a gated week on similar work. If the delta isn't visible there, don't quote the ticker: enjoy the discipline nudges and call it what it is.
