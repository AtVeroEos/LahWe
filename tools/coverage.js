#!/usr/bin/env node
// Line and function coverage of src/js/*, from the unit tests and the Chromium browser tests together.
//   node tools/coverage.js run          runs both with coverage on, then reports
//   node tools/coverage.js report DIR   reports from coverage files already in DIR
// Writes test/e2e/out/coverage.txt (readable) and coverage.json (per file: lines, functions never called).
// A line counts as run when the code at its start ran in any test. Blank and comment-only lines are left out.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test', 'e2e', 'out');
const MARK = /^\/\/ ──────── src\/js\/(.+?) ────────$/;

function run(dir) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const unit = fs.readdirSync(path.join(ROOT, 'test', 'unit')).filter(f => f.endsWith('.test.js')).map(f => path.join('test', 'unit', f));
  console.log('Unit tests with coverage…');
  spawnSync(process.execPath, ['--test', ...unit], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_V8_COVERAGE: dir } });
  console.log('Browser tests with coverage…');
  spawnSync(process.execPath, [path.join(ROOT, 'tools', 'run-e2e.js')], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, LW_ENGINE: 'chromium', LW_COVERAGE: dir } });
}

// For one script's text: where each line starts, and which src file / line it belongs to.
const layouts = new Map();
function layout(src) {
  if (layouts.has(src)) return layouts.get(src);
  const starts = [0]; for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
  const map = []; let file = null, base = 0;
  for (let l = 0; l < starts.length; l++) {
    const text = src.slice(starts[l], (starts[l + 1] || src.length + 1) - 1);
    const m = text.match(MARK);
    if (m) { file = m[1]; base = l; map.push(null); continue; }
    if (!file) { map.push(null); continue; }
    const t = text.trim();
    const code = t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    map.push(code ? { file, line: l - base, col: text.length - text.trimStart().length } : null);
  }
  const lineOf = off => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; } return lo; };
  const L = { starts, map, lineOf }; layouts.set(src, L); return L;
}

function report(dir) {
  const builtJs = require(path.join(ROOT, 'build.js')).buildJs();
  const lines = {};   // file -> Map(line -> ran?)
  const fns = {};     // file -> Map("line name" -> ran?)
  const note = (tbl, file, key, ran) => { const m = tbl[file] || (tbl[file] = new Map()); m.set(key, m.get(key) || ran); };
  let scripts = 0;
  const take = (src, functions) => {
    const L = layout(src); scripts++;
    const cov = new Int8Array(src.length); // 0 unknown, 1 ran, -1 did not
    const ranges = [];
    for (const f of functions) for (const r of f.ranges) ranges.push(r);
    ranges.sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
    for (const r of ranges) cov.fill(r.count > 0 ? 1 : -1, r.startOffset, Math.min(r.endOffset, src.length));
    for (let l = 0; l < L.map.length; l++) {
      const at = L.map[l]; if (!at) continue;
      note(lines, at.file, at.line, cov[L.starts[l] + at.col] === 1);
    }
    for (const f of functions) {
      if (!f.functionName || !f.ranges.length) continue;
      const at = L.map[L.lineOf(f.ranges[0].startOffset)]; if (!at) continue;
      note(fns, at.file, `${at.line} ${f.functionName}`, f.ranges[0].count > 0);
    }
  };
  for (const f of fs.readdirSync(dir)) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (Array.isArray(j)) { for (const e of j) take(e.source, e.functions); continue; }      // browser
    for (const s of j.result || []) if (s.url === 'app.js' || s.url.endsWith('/app.js')) take(builtJs, s.functions); // unit (vm)
  }
  const rows = Object.keys(lines).sort().map(file => {
    const m = lines[file]; const total = m.size; let ran = 0; for (const v of m.values()) if (v) ran++;
    const never = [...(fns[file] || new Map())].filter(([, v]) => !v).map(([k]) => k).sort((a, b) => parseInt(a) - parseInt(b));
    const fnTotal = (fns[file] || new Map()).size;
    return { file, lines: total, ran, pct: total ? Math.round(1000 * ran / total) / 10 : 100, functions: fnTotal, neverCalled: never };
  });
  const T = rows.reduce((a, r) => ({ lines: a.lines + r.lines, ran: a.ran + r.ran, fn: a.fn + r.functions, never: a.never + r.neverCalled.length }), { lines: 0, ran: 0, fn: 0, never: 0 });
  const txt = [`Coverage of src/js from ${scripts} script runs (unit + Chromium browser tests)`,
    `Overall: ${T.ran}/${T.lines} lines (${(100 * T.ran / T.lines).toFixed(1)}%), ${T.fn - T.never}/${T.fn} named functions called`, '',
    ...rows.slice().sort((a, b) => a.pct - b.pct).map(r => `${String(r.pct.toFixed(1)).padStart(5)}%  ${r.file.padEnd(22)} ${String(r.ran).padStart(5)}/${String(r.lines).padEnd(5)} lines  ${r.neverCalled.length} of ${r.functions} functions never called`)].join('\n');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'coverage.txt'), txt + '\n');
  fs.writeFileSync(path.join(OUT, 'coverage.json'), JSON.stringify({ total: T, files: rows }, null, 1));
  console.log(txt);
}

const [cmd, arg] = process.argv.slice(2);
const dir = arg ? path.resolve(arg) : path.join(OUT, 'v8');
if (cmd === 'run') { run(dir); report(dir); }
else if (cmd === 'report') report(dir);
else { console.log('usage: node tools/coverage.js run | report DIR'); process.exit(2); }
