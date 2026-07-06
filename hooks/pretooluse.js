#!/usr/bin/env node
'use strict';
// Claude Code adapter (PreToolUse) -> MONETA core. All lens logic lives in lib/core.js;
// this file only translates the runtime's stdin event and renders the decision in its dialect.
const { preDecision } = require('../lib/core');

let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { return process.exit(0); }
  const d = preDecision({ sessionId: input.session_id, tool: input.tool_name, input: input.tool_input || {} });
  if (d.decision === 'deny') {
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: d.message } }));
  } else if (d.decision === 'shrink') {
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: d.updatedInput, additionalContext: d.message } }));
  } else if (d.decision === 'warn') {
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', additionalContext: d.message } }));
  }
  process.exit(0);
});
