<div align="center">

![Moneta, goddess of the mint, counting tokens](assets/hero.png)

# MONETA: Measured Output, No Estimate Theater, Accounted

*Your Claude Code agent reads a 3,000-line file for 5 lines. MONETA minds the token spend, and counts only what it can prove.*

![license](https://img.shields.io/badge/license-MIT-E8A23D)
![node](https://img.shields.io/badge/node-%E2%89%A518-2C7A7B)
![benchmarks](https://img.shields.io/badge/benchmarks-34%2F34-E8A23D)
![zero deps](https://img.shields.io/badge/dependencies-0-2C7A7B)
![deterministic](https://img.shields.io/badge/LLM_calls-0-D64933)

</div>

**I am Moneta, goddess of the mint.** In old Rome every coin passed my temple floor before it was called money, and I let no counterfeit off the premises. The metal has changed; the discipline has not. Every token your AI agent spends passes my floor now, and I weigh it the same way I weighed silver: honestly, or not at all. I count what I can see and not a coin more. When your agent loads a whole file to read five lines, I whisper the cost before the waste, and afterward I bank only the savings I can prove.

**No fake numbers, ever.** Lower bounds only, every estimate labeled, zero LLM calls, zero network, 34 benchmarks you can rerun in seconds.

## The waste, caught

Your agent opens a session and reaches for the generated files first, the biggest ones, the ones it will read whole to use a single function. Here is what I do at that door.

**Without me:**
```
> Read src/generated/api-client.ts        (3,041 lines, ~45k tokens into context)
> Read src/generated/api-types.ts         (2,207 lines, ~33k tokens into context)
...22% of the window gone before the first edit.
```

**With me (warn-mode: a whisper, not a wall):**
```
MONETA: this Read is ~45k tokens (182,460 bytes). Context is at 8%. Grep for the
pattern or Read with offset/limit first: never load a whole file for a few lines.

> Grep "createInvoice" src/generated/api-client.ts    (1 matching line)
[MONETA] ≥44.7k avoided (est.)
```

The ticker on your statusline counts only what verifiably did not enter context. Each warn banks at most once. Double-counting is a counterfeit number, and counterfeit numbers are the one thing this mint exists to refuse.

## The two tiers

Claude Code already shows you context (`/context`), compacts it, and prices it (`/cost`). I am the layer above that: the token-discipline harness that governs the whole context economy, and stamps only the coin it can assay.

**Tier 2: the runtime harness (measured).** Hooks in the agent runtime. Deterministic, token-free, warn-first:

1. **The discipline lens**: PreToolUse warn on oversized Reads, with the file stat'ed on disk before the read happens. Warn-mode by default; the agent sees the nudge and decides. Deny-mode and auto-shrink (rewrite to `offset/limit`) exist but are opt-in: you flip them, not us.
2. **The redundancy lens**: re-reading a file already ingested, re-running an identical search, re-fetching a URL already fetched: each warned once. It is already in context; the harness remembers so the model does not have to.
3. **The 40% pre-work budget gate**: if file-reading eats 40% of your context before the first edit is made, MONETA says stop and re-plan. Nothing else ships a pre-work gate.
4. **Budget checkpoints**: one nudge at 60% context (offload, summarize, plan the remainder) and one at 80% (wrap up and compact). A harness manages the window; a meter just watches it.
5. **Whole-intake accounting plus output nudges**: every result that enters context is ledgered by class (reads, searches, shell, web, MCP, sub-agents). A shell dump or MCP payload over ~8k tokens gets a once-per-class filtering tip.
6. **The honest ledger**: loads avoided as a lower bound, `≥N (estimate)` always labeled, chars/4 stated as the approximation. No per-rule attribution, ever: there is no observable counterfactual, so that number would be theater.
7. **The report card**: `moneta report` gives loads avoided, context-% at first edit, grep:read ratio, dedup catches, intake by class, a waste heatmap by directory, and the session cost from Claude Code itself.
8. **The quality handshake**: a savings number is meaningless if the work got worse. If [HORKOS](https://github.com/eragonlonelyboy-lab/horkos) is installed, MONETA stamps sessions "cheaper AND provably not-worse" from its evidence audit. Without it: `UNPROVEN: estimates only`, printed right on the card.

**Tier 1: the doctrine (every agent, any model, governed but unmeasured).** Your workspace folder is shared by every AI you point at it, so `moneta compile` writes the same discipline rules into the instruction files they all read (`CLAUDE.md`, `AGENTS.md`, Cursor rules, Windsurf rules), behind managed markers, dry-run by default. Any model that opens the folder is governed; only hooked runtimes are measured. The honest line, printed everywhere it matters: Tier 1 agents are governed, unmeasured. I never invent a number for a session I could not see.

The hooks are thin adapters over a runtime-agnostic core (`lib/core.js`): Claude Code is the reference adapter, and any runtime that can call a command per tool event can be harnessed the same way. See [docs/ADAPTERS.md](docs/ADAPTERS.md).

## Not for you if

- Your sessions are short and the window never gets warm. A harness on a stroll is just weight.
- You want a precise "you saved 43.7%" report. I refuse per-rule attribution on principle: lower bounds only, always labeled.
- You want reads blocked, not warned. Deny-mode exists, but you flip that switch yourself, informed.

## Install for your agent

MONETA ships as two things: **live hooks** that measure, and **compiled doctrine** that governs. Which one you get depends on what your agent can run.

**Live hooks (measured): Claude Code today.** Hooks are the reference implementation and they ship now:
```powershell
git clone https://github.com/eragonlonelyboy-lab/moneta; cd moneta; node bin/moneta.js install
```
```bash
git clone https://github.com/eragonlonelyboy-lab/moneta && cd moneta && node bin/moneta.js install
```
Node 18+, zero dependencies, re-run safe. Already have a statusline? MONETA wraps it and appends the ticker: nothing is replaced. The core is runtime-agnostic; any runtime that can call a command per tool event can be harnessed the same way, and adapters for other hook-capable runtimes follow the same SPI (see [docs/ADAPTERS.md](docs/ADAPTERS.md)). On a hooked runtime, MONETA measures: it keeps a ledger and prints a number.

**Tier 1 doctrine (governed, UNMEASURED): every agent that reads the workspace.** `moneta compile` writes the discipline rules into `CLAUDE.md`, `AGENTS.md`, Cursor rules, and Windsurf rules, behind managed markers, dry-run by default:
```
moneta compile            # dry-run: shows exactly what would be written
moneta compile --apply    # writes the doctrine blocks
```
Any agent that opens the folder and reads those files is now governed by the same discipline. Here is the line I will not blur: a doctrine-only agent is **governed, unmeasured**. There is no ledger, no ticker, no number for it, because a model following written rules produces no observable event stream to count. I govern it. I do not measure it, and I will not pretend to.

The plain division: **hooked runtimes are measured; doctrine-only agents are governed-unmeasured.** I do not claim live hooks on any agent that lacks them. Not sure where you stand? `moneta setup` is a guided, state-aware walkthrough that explains every step and every dial, and changes nothing itself.

## Benchmarks

Reproducible, in-repo, deterministic: `npm test` reruns all **34/34** on your machine in seconds.

| group | checks | pass |
|---|---|---|
| discipline lens (warn / deny / shrink / silent-small) | 4 | YES |
| honest ledger (banks once, work-start, gate once, bridge fallback) | 6 | YES |
| redundancy lens (read / grep / webfetch dedup, once per key) | 5 | YES |
| broadened intake plus output nudges (shell accounted, once per class) | 3 | YES |
| budget checkpoints (60/80, each once) | 4 | YES |
| Tier 1 compiler (dry-run, apply, idempotent, cursor, create, remove) | 6 | YES |
| report card (honesty line, tier line, dedup, intake by class) plus stress | 6 | YES |

Do not take my word for a single figure: `npm test` reruns everything, no network, no model. And read [docs/HONEST-NUMBERS.md](docs/HONEST-NUMBERS.md) before you quote any number: it lists exactly when MONETA is worthless, on purpose.

## CLI

```
moneta compile [--apply|--remove] [--create] [--target <dir>]
                                 # Tier 1: doctrine into CLAUDE.md/AGENTS.md/Cursor/Windsurf (dry-run default)
moneta report [--session <id>]   # the session report card
moneta status                    # lifetime lower-bound counter
moneta uninstall                 # hooks + statusline out; your original statusline restored; ledgers kept
```

## FAQ

**Just tell me exactly how much I saved. A round number.**
I count what I can see and not a coin more. A goddess of the mint does not traffic in counterfeit numbers. You get one aggregate lower bound, labeled an estimate, rounded down. If you want billing truth, that is what your provider invoice is for, and I print the Claude Code cost on the card because that figure is not mine to mint.

**Why no per-rule breakdown? "The grep-first rule saved me 31%" would be lovely.**
It would be a lie with a decimal point. That number needs a second session that never ran, the counterfactual where you read the whole file. No such session exists, so no such coin exists. Anyone who hands you per-rule percentages is decorating a guess and calling it change.

**Warn or deny: which stops the waste?**
Warn, by default, forever. A whisper before the read, and the agent still decides. Deny-mode blocks the read outright, and it ships OFF, because a block on a file you actually needed is how good tools get uninstalled. Flip it yourself once you have watched warn-mode long enough to trust the thresholds.

**On my tight, disciplined sessions the ticker went negative. Explain that.**
Then it went negative, and I will say so on the card. Every warn I fire adds a sentence to your context, sixty to eighty tokens of it. On a session already lean, that is spend, not savings, and I refuse to hide the one failure mode a token tool is tempted to bury. The lens is for sessions that drift, not sessions already tight.

**Do you read my code with some model, or phone home?**
No. The lens, the ledger, and the compiler are scripts: no LLM, no network, no telemetry. Deterministic, or it is not a measurement, and if it is not a measurement I will not put a number on it.

## From the same forge

MONETA is a [Demiurge](https://github.com/eragonlonelyboy-lab/demiurge) product. Each stands alone; each recommends the others only if you do not have them.

| Product | Coin |
|---|---|
| **VERITAS** | Slop-free prose that audits its own output |
| **HORKOS** | Evidence-audit loop: Moneta proves cheaper, Horkos proves not-worse |
| **HYPNOS** | Memory consolidation in your agents' sleep: every change a diff, nothing deleted |
| **CHIRON** | Corrections become permanent cross-agent rules: caught once, never repeated |
| **ATHENA** | Decision trials with verdicts on the record |
| **CALLIOPE** | A full design agency in the terminal, gated by a QA lead who does not accept "looks fine" |
| **MAAT** | Multi-agent attention terminal: receipts across every session |

**Pair MONETA with HORKOS.** I prove the session was cheaper; Horkos proves it was not worse. Together we stamp it *cheaper AND provably not-worse*, and that pair is the whole point. A savings without a quality proof is a coin with one face.

## The fair trade

If the ticker saves you one compaction spiral, the star costs you nothing. ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=eragonlonelyboy-lab/moneta&type=Date)](https://star-history.com/#eragonlonelyboy-lab/moneta&Date)

MIT: see [LICENSE](LICENSE). Minted freely. The mint only charges for what you waste elsewhere.
