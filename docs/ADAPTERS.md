# MONETA adapters: harness any runtime

MONETA's brain is runtime-agnostic. Everything that decides and counts lives in `lib/core.js`;
an adapter is the thin translation layer between one agent runtime's tool events and that core.
Claude Code (`hooks/pretooluse.js`, `hooks/posttooluse.js`) is the reference adapter: ~25 lines each.

## The SPI (two calls)

An adapter normalizes its runtime's event into one plain object and renders the result back
in the runtime's own dialect. That is the whole contract.

**Before a tool runs:**

```js
const { preDecision } = require('../lib/core');
const d = preDecision({ sessionId, tool, input });
// d = { decision: 'silent' }
//   | { decision: 'warn',   message }                 // surface message to the model, allow the call
//   | { decision: 'deny',   message }                 // block the call (only ever in opt-in deny-mode)
//   | { decision: 'shrink', message, updatedInput }   // allow with rewritten input (opt-in)
```

**After a tool returns:**

```js
const { postAccount } = require('../lib/core');
const r = postAccount({ sessionId, tool, input, response });
// r = { context: string | null }   // if non-null, surface it to the model; never blocks
```

Field notes:
- `sessionId`: any stable string for the session; it keys the ledger under `~/.moneta/sessions/<id>/`.
- `tool`: the runtime's tool name. The core classifies it (read/grep/glob/shell/webfetch/mcp/agent/other);
  unknown names fall into `other` and are still accounted.
- `input`: the tool's arguments as given. `response`: the tool's result (string or object); its size is
  ground truth for what entered context.
- Context-% features (the 40% gate, budget checkpoints) need `bridge.json` in the session dir:
  `{ "used_percentage": <number>, "cost_usd": <number|null> }`. In Claude Code the statusline writes it;
  in another runtime, write it from wherever that runtime exposes context usage. Without it, the gate
  falls back to summed read estimates and the checkpoints stay silent. Silent, not guessed.

## Laws every adapter inherits

1. Deterministic and token-free: an adapter never calls a model.
2. Warn is the default posture; deny/shrink only when the user opted in via config.
3. A broken adapter must fail open: swallow errors, never break the session.
4. No adapter invents numbers: if the runtime can't expose a signal (context %, response size),
   the corresponding feature stays silent rather than estimated-without-label.

## What Tier 1 covers when there is no adapter

No hooks in your runtime? `moneta compile` writes the same doctrine into the workspace instruction
files that runtime reads (CLAUDE.md, AGENTS.md, Cursor, Windsurf). Governed, unmeasured, and the
report card will never pretend otherwise.
