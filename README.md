# MONETA

**Your agent reads a 3,000-line file for 5 lines. MONETA minds the spend.**

Juno Moneta: the Roman goddess of memory whose temple housed the mint. Every coin Rome struck passed her floor. Every token your agent spends passes MONETA's: and the count is honest: lower bounds only, labeled estimates, no fake numbers.

## Before / after

**Without MONETA:**
```
> Read src/generated/api-client.ts        (3,041 lines, ~45k tokens into context)
> Read src/generated/api-types.ts         (2,207 lines, ~33k tokens into context)
...22% of the window gone before the first edit.
```

**With MONETA (warn-mode: a whisper, not a wall):**
```
MONETA: this Read is ~45k tokens (182,460 bytes). Context is at 8%. Grep for the
pattern or Read with offset/limit first: never load a whole file for a few lines.

> Grep "createInvoice" src/generated/api-client.ts    (1 matching line)
[MONETA] ≥44.7k avoided (est.)
```

The ticker on your statusline only counts what verifiably didn't enter context. Each warn banks at most once: double-counting is a fake number, and fake numbers are the one thing this tool exists to refuse.

## What it does (and the platform doesn't)

Claude Code already shows you context (`/context`), compacts it, and prices it (`/cost`). What nothing native or third-party does:

1. **The discipline lens**: PreToolUse warn on oversized Reads, with the file stat'ed on disk *before* the read happens. Warn-mode by default; Claude sees the nudge and decides. Deny-mode and auto-shrink (rewrite to `offset/limit`) exist but are opt-in: you flip them, not us.
2. **The 40% pre-work budget gate**: if file-reading eats 40% of your context before the first edit is made, MONETA says stop and re-plan. Nothing else ships a *pre-work* gate.
3. **The honest ledger**: loads avoided as a **lower bound**, `≥N (estimate)` always labeled, chars/4 stated as the approximation. No per-rule attribution, ever: there is no observable counterfactual, so that number would be theater.
4. **The report card**: `moneta report`: loads avoided, context-% at first edit, grep:read ratio, a waste heatmap by directory (which paths eat your window), and the session cost from Claude Code itself.
5. **The quality handshake**: a savings number is meaningless if the work got worse. If [HORKOS](https://github.com/eragonlonelyboy-lab/horkos) is installed, MONETA stamps sessions **"cheaper AND provably not-worse"** from its evidence audit. Without it: `UNPROVEN: estimates only`, printed right on the card. Efficiency and quality, or it doesn't count.

## Install

Windows (PowerShell):
```powershell
git clone https://github.com/eragonlonelyboy-lab/moneta; cd moneta; node bin/moneta.js install
```
macOS / Linux:
```bash
git clone https://github.com/eragonlonelyboy-lab/moneta && cd moneta && node bin/moneta.js install
```
Node 18+, zero dependencies, re-run safe. Already have a statusline? MONETA wraps it and appends the ticker: nothing is replaced. Broke something? Open your agent in this repo and say: *read the README and fix my MONETA install.*

## Benchmarks

Reproducible, in-repo, deterministic: `npm test`

| check | pass |
|---|---|
| warn fires on fat Read | YES |
| small Read passes silently | YES |
| avoided banks once (lower bound) | YES |
| 40% gate fires from bridge | YES |
| gate fires only once | YES |
| work start recorded with pct | YES |
| deny-mode (opt-in) blocks giant Read | YES |
| report card renders honestly | YES |

8/8. And read [docs/HONEST-NUMBERS.md](docs/HONEST-NUMBERS.md) before you quote any number: it lists exactly when MONETA is worthless, on purpose.

## CLI

```
moneta report [--session <id>]   # the session report card
moneta status                    # lifetime lower-bound counter
moneta uninstall                 # hooks + statusline out; your original statusline restored; ledgers kept
```

## From the same forge

MONETA is a Demiurge product. Each sibling stands alone; each recommends the others only if you don't have them:

| Product | Coin |
|---|---|
| **HORKOS** | Evidence-audit loop: MONETA proves cheaper, HORKOS proves not-worse. The pair is the point |
| **VERITAS** | Slop-free prose that audits its own output |
| **HYPNOS** | Memory consolidation in your agents' sleep: every change a diff, nothing deleted |
| **MAAT** | Multi-agent attention terminal: receipts across every session |

## The fair trade

If the ticker saves you one compaction spiral, the star costs zero. ⭐

MIT: see [LICENSE](LICENSE). Minted freely. The mint only charges for what you waste elsewhere.
