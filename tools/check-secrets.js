#!/usr/bin/env node
// Fails if anything that looks like a real credential is in the repository or the built app.
// The app has no key of its own: every person supplies theirs on their own device. This check is
// what stops one from being committed or baked into dist/ by accident.
//   node tools/check-secrets.js            scan tracked files + dist/
//   node tools/check-secrets.js --staged   scan what is about to be committed (pre-commit hook)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
// Written so that this file does not match its own patterns.
const PATTERNS = [
  ['Anthropic API key', new RegExp('sk-' + 'ant-[A-Za-z0-9_\\-]{20,}')],
  ['OpenRouter API key', new RegExp('sk-' + 'or-v1-[A-Za-z0-9]{24,}')],
  ['OpenAI API key', new RegExp('sk-' + '(?:proj|svcacct|admin)-[A-Za-z0-9_\\-]{20,}')],
  ['OpenAI-style API key', new RegExp('\\bsk-' + '[A-Za-z0-9]{32,}\\b')],
  ['Google API key', new RegExp('AI' + 'za[0-9A-Za-z_\\-]{35}')],
  ['GitHub token', new RegExp('\\bgh[pousr]_' + '[A-Za-z0-9]{36,}\\b')],
  ['GitHub fine-grained token', new RegExp('github_' + 'pat_[A-Za-z0-9_]{40,}')],
  ['xAI API key', new RegExp('\\bxai-' + '[A-Za-z0-9]{40,}\\b')],
  ['Groq API key', new RegExp('\\bgsk_' + '[A-Za-z0-9]{40,}\\b')],
  ['Private key block', new RegExp('-----BEGIN ' + '(?:RSA |EC |OPENSSH )?PRIVATE KEY-----')],
];
// A run of one repeated character is test filler, never a real key.
const isFiller = s => /(.)\1{15,}/.test(s);
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip)$/i;

function scanText(text, file) {
  const hits = [];
  if (text.indexOf('\u0000') >= 0) return hits; // binary
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 200000) { // minified bundles: scan in one go without printing the line
      for (const [name, re] of PATTERNS) { const m = line.match(re); if (m && !isFiller(m[0])) hits.push({ file, line: i + 1, name, sample: m[0].slice(0, 10) + '…' }); }
      continue;
    }
    for (const [name, re] of PATTERNS) {
      const m = line.match(re);
      if (m && !isFiller(m[0])) hits.push({ file, line: i + 1, name, sample: m[0].slice(0, 10) + '…' });
    }
  }
  return hits;
}
function trackedFiles() {
  try { return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean); }
  catch (e) { return null; }
}
function walk(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name === 'node_modules' || f.name === '.git') continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out); else out.push(path.relative(ROOT, p));
  }
  return out;
}
function scan(opts) {
  opts = opts || {};
  let files;
  if (opts.staged) files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  else {
    files = trackedFiles() || walk(ROOT, []);
    const dist = path.join(ROOT, 'dist');
    if (fs.existsSync(dist)) walk(dist, []).forEach(f => { if (!files.includes(f)) files.push(f); });
  }
  const hits = [];
  for (const f of files) {
    if (BINARY.test(f)) continue;
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) continue;
    hits.push(...scanText(fs.readFileSync(p, 'utf8'), f));
  }
  return { files: files.length, hits };
}
module.exports = { scan, scanText, PATTERNS };

if (require.main === module) {
  const r = scan({ staged: process.argv.includes('--staged') });
  if (r.hits.length) {
    console.error(`\nSECRET CHECK FAILED — ${r.hits.length} thing(s) that look like credentials:\n`);
    r.hits.forEach(h => console.error(`  ${h.file}:${h.line}  ${h.name}  (${h.sample})`));
    console.error('\nRemove them (and revoke the key — assume it is compromised) before committing.\n');
    process.exit(1);
  }
  console.log(`Secret check passed — ${r.files} files, nothing key-shaped.`);
}
