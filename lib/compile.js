'use strict';
// MONETA Tier 1 compiler: writes the discipline doctrine into agent instruction files
// behind managed markers. Dry-run by DEFAULT; --apply writes. Idempotent: re-compiling
// replaces the managed block and touches nothing outside it.
//
// Targets (per workspace dir):
//   CLAUDE.md, AGENTS.md          -> updated when present (never created unless --create)
//   .cursor/rules/moneta.mdc      -> written only when .cursor/ exists (the user uses Cursor)
//   .windsurf/rules/moneta.md     -> written only when .windsurf/ exists
// If neither CLAUDE.md nor AGENTS.md exists, --create scaffolds AGENTS.md (the cross-vendor file).
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./config');
const { DOCTRINE_VERSION, doctrineText } = require('./doctrine');

const BEGIN = '<!-- MONETA:BEGIN (managed block: edits inside are overwritten by "moneta compile --apply") -->';
const END = '<!-- MONETA:END -->';

function block(cfg) { return `${BEGIN}\n${doctrineText(cfg)}\n${END}`; }

// Replace an existing managed block, or append one. Preserves everything outside the markers.
function upsert(content, cfg) {
  const b = content.indexOf(BEGIN), e = content.indexOf(END);
  if (b >= 0 && e > b) return content.slice(0, b) + block(cfg) + content.slice(e + END.length);
  const sep = content.length && !content.endsWith('\n\n') ? (content.endsWith('\n') ? '\n' : '\n\n') : '';
  return content + sep + block(cfg) + '\n';
}

function stripBlock(content) {
  const b = content.indexOf(BEGIN), e = content.indexOf(END);
  if (b < 0 || e <= b) return null;
  let out = content.slice(0, b) + content.slice(e + END.length);
  return out.replace(/\n{3,}$/, '\n\n');
}

function mdcWrap(cfg) {
  return ['---', 'description: MONETA token discipline (managed by "moneta compile")', 'alwaysApply: true', '---', '', block(cfg), ''].join('\n');
}

function listTargets(dir) {
  const t = [];
  for (const f of ['CLAUDE.md', 'AGENTS.md']) {
    const p = path.join(dir, f);
    t.push({ file: p, kind: 'md', exists: fs.existsSync(p) });
  }
  if (fs.existsSync(path.join(dir, '.cursor'))) t.push({ file: path.join(dir, '.cursor', 'rules', 'moneta.mdc'), kind: 'mdc', exists: fs.existsSync(path.join(dir, '.cursor', 'rules', 'moneta.mdc')) });
  if (fs.existsSync(path.join(dir, '.windsurf'))) t.push({ file: path.join(dir, '.windsurf', 'rules', 'moneta.md'), kind: 'own', exists: fs.existsSync(path.join(dir, '.windsurf', 'rules', 'moneta.md')) });
  return t;
}

// opts: { dir, apply, create, remove }
function compile(opts) {
  const dir = path.resolve(opts.dir || process.cwd());
  const cfg = loadConfig();
  const targets = listTargets(dir);
  const actions = [];
  const act = (file, action) => actions.push({ file, action });

  if (opts.remove) {
    for (const t of targets.filter(t => t.exists)) {
      const content = fs.readFileSync(t.file, 'utf8');
      if (t.kind === 'md') {
        const stripped = stripBlock(content);
        if (stripped == null) { act(t.file, 'no block'); continue; }
        if (opts.apply) fs.writeFileSync(t.file, stripped, 'utf8');
        act(t.file, opts.apply ? 'block removed' : 'would remove block');
      } else {
        // .mdc / windsurf files are wholly MONETA-owned: remove the file.
        if (opts.apply) fs.unlinkSync(t.file);
        act(t.file, opts.apply ? 'file removed' : 'would remove file');
      }
    }
    return { dir, version: DOCTRINE_VERSION, applied: !!opts.apply, actions };
  }

  const mdTargets = targets.filter(t => t.kind === 'md');
  const anyMd = mdTargets.some(t => t.exists);
  for (const t of targets) {
    if (t.kind === 'md') {
      if (!t.exists) {
        // Create only AGENTS.md, only with --create, only when no agent file exists at all.
        if (opts.create && !anyMd && path.basename(t.file) === 'AGENTS.md') {
          if (opts.apply) fs.writeFileSync(t.file, '# Agent instructions\n\n' + block(cfg) + '\n', 'utf8');
          act(t.file, opts.apply ? 'created with block' : 'would create with block');
        } else act(t.file, 'absent (skipped; use --create to scaffold AGENTS.md)');
        continue;
      }
      const content = fs.readFileSync(t.file, 'utf8');
      const next = upsert(content, cfg);
      if (next === content) { act(t.file, 'up to date'); continue; }
      const had = content.includes(BEGIN);
      if (opts.apply) fs.writeFileSync(t.file, next, 'utf8');
      act(t.file, (opts.apply ? '' : 'would ') + (had ? 'update block' : 'insert block'));
    } else {
      const next = t.kind === 'mdc' ? mdcWrap(cfg) : block(cfg) + '\n';
      if (t.exists && fs.readFileSync(t.file, 'utf8') === next) { act(t.file, 'up to date'); continue; }
      if (opts.apply) { fs.mkdirSync(path.dirname(t.file), { recursive: true }); fs.writeFileSync(t.file, next, 'utf8'); }
      act(t.file, (opts.apply ? '' : 'would ') + (t.exists ? 'update' : 'write'));
    }
  }
  return { dir, version: DOCTRINE_VERSION, applied: !!opts.apply, actions };
}

function renderCompile(r) {
  const L = [];
  L.push(`MONETA compile (Tier 1 doctrine v${r.version}) -> ${r.dir}`);
  L.push(r.applied ? '  APPLIED:' : '  DRY-RUN (nothing written; add --apply to write):');
  for (const a of r.actions) L.push(`    ${a.action.padEnd(42)} ${a.file}`);
  L.push('');
  L.push('  Tier 1 is governance without measurement: any agent reading these files is governed');
  L.push('  but UNMEASURED. Only Tier 2 (runtime hooks) produces counted numbers, and those are');
  L.push('  lower-bound estimates. MONETA never reports savings for Tier 1 obedience.');
  return L.join('\n');
}

module.exports = { compile, renderCompile, BEGIN, END };
