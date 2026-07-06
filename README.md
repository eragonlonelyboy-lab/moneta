# MONETA: Measured Output, No Estimate Theater, Accounted

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

Claude Code already shows you context (`/context`), compacts it, and prices it (`/cost`). MONETA is the **token-discipline harness**: it governs the whole context economy in two tiers, and counts only what it can prove.

**Tier 2: the runtime harness (measured).** Hooks in the agent runtime — deterministic, token-free, warn-first:

1. **The discipline lens**: PreToolUse warn on oversized Reads, with the file stat'ed on disk *before* the read happens. Warn-mode by default; Claude sees the nudge and decides. Deny-mode and auto-shrink (rewrite to `offset/limit`) exist but are opt-in: you flip them, not us.
2. **The redundancy lens**: re-reading a file already ingested, re-running an identical search, re-fetching a URL already fetched — each warned once. It is already in context; the harness remembers so the model doesn't have to.
3. **The 40% pre-work budget gate**: if file-reading eats 40% of your context before the first edit is made, MONETA says stop and re-plan. Nothing else ships a *pre-work* gate.
4. **Budget checkpoints**: one nudge at 60% context (offload, summarize, plan the remainder) and one at 80% (wrap up and compact). A harness manages the window; a meter just watches it.
5. **Whole-intake accounting + output nudges**: every result that enters context is ledgered by class (reads, searches, shell, web, MCP, sub-agents). A shell dump or MCP payload over ~8k tokens gets a once-per-class filtering tip.
6. **The honest ledger**: loads avoided as a **lower bound**, `≥N (estimate)` always labeled, chars/4 stated as the approximation. No per-rule attribution, ever: there is no observable counterfactual, so that number would be theater.
7. **The report card**: `moneta report`: loads avoided, context-% at first edit, grep:read ratio, dedup catches, intake by class, a waste heatmap by directory, and the session cost from Claude Code itself.
8. **The quality handshake**: a savings number is meaningless if the work got worse. If [HORKOS](https://github.com/eragonlonelyboy-lab/horkos) is installed, MONETA stamps sessions **"cheaper AND provably not-worse"** from its evidence audit. Without it: `UNPROVEN: estimates only`, printed right on the card. Efficiency and quality, or it doesn't count.

**Tier 1: the doctrine (every agent, any model).** Your workspace folder is shared by every AI you point at it — so `moneta compile` writes the same discipline rules into the instruction files they all read (`CLAUDE.md`, `AGENTS.md`, Cursor rules, Windsurf rules), behind managed markers, dry-run by default. Any model that opens the folder is governed; only hooked runtimes are *measured*. The honest line, printed everywhere it matters: **Tier 1 agents are governed, unmeasured** — MONETA never invents a number for a session it couldn't see.

The hooks are thin adapters over a runtime-agnostic core (`lib/core.js`): Claude Code is the reference adapter, and any runtime that can call a command per tool event can be harnessed the same way — see [docs/ADAPTERS.md](docs/ADAPTERS.md).

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

Not sure where you are? `moneta setup` is a guided, state-aware walkthrough: it explains every step, every dial, and the honest math behind the ticker, and never changes anything itself.

## Benchmarks

Reproducible, in-repo, deterministic: `npm test` — **34/34**.

| group | checks | pass |
|---|---|---|
| discipline lens (warn / deny / shrink / silent-small) | 4 | YES |
| honest ledger (banks once, work-start, gate once, bridge fallback) | 6 | YES |
| redundancy lens (read / grep / webfetch dedup, once per key) | 5 | YES |
| broadened intake + output nudges (shell accounted, once per class) | 3 | YES |
| budget checkpoints (60/80, each once) | 4 | YES |
| Tier 1 compiler (dry-run, apply, idempotent, cursor, create, remove) | 6 | YES |
| report card (honesty line, tier line, dedup, intake by class) + stress | 6 | YES |

And read [docs/HONEST-NUMBERS.md](docs/HONEST-NUMBERS.md) before you quote any number: it lists exactly when MONETA is worthless, on purpose.

## CLI

```
moneta compile [--apply|--remove] [--create] [--target <dir>]
                                 # Tier 1: doctrine into CLAUDE.md/AGENTS.md/Cursor/Windsurf (dry-run default)
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
