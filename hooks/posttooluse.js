#!/usr/bin/env node
'use strict';
// Claude Code adapter (PostToolUse) -> MONETA core. Accounting + budget nudges; never blocks.
const { postAccount } = require('../lib/core');

let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { return process.exit(0); }
  const r = postAccount({ sessionId: input.session_id, tool: input.tool_name, input: input.tool_input || {}, response: input.tool_response });
  if (r.context) {
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: r.context } }));
  }
  process.exit(0);
});
