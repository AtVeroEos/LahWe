#!/usr/bin/env node
// Runs every browser suite, even after one fails, and prints one line per suite at the end.
// Each suite's output is also kept in test/e2e/out/<suite>.<engine>.log.
//   node tools/run-e2e.js                 Chromium
//   LW_ENGINE=webkit node tools/run-e2e.js
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const SUITES = ['smoke', 'upgrade', 'subpath', 'scanner', 'settings', 'keyboard', 'swipe', 'security', 'flows', 'targets'];
const engine = process.env.LW_ENGINE || 'chromium';
const OUT = path.join(__dirname, '..', 'test', 'e2e', 'out');
fs.mkdirSync(OUT, { recursive: true });
const rows = [];
for (const s of SUITES) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'test', 'e2e', s + '.js')], { encoding: 'utf8', timeout: 15 * 60 * 1000 });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(out);
  fs.writeFileSync(path.join(OUT, `${s}.${engine}.log`), out);
  const pass = (out.match(/✓/g) || []).length, fail = (out.match(/✗/g) || []).length;
  rows.push({ s, code: r.status, pass, fail, sec: Math.round((Date.now() - t0) / 1000) });
}
console.log(`\n=== ${engine} ===`);
for (const r of rows) console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${r.s.padEnd(9)} ${String(r.pass).padStart(4)} passed  ${String(r.fail).padStart(3)} failed  ${r.sec}s${r.code !== 0 && !r.fail ? '  (crashed: exit ' + r.code + ')' : ''}`);
process.exit(rows.some(r => r.code !== 0) ? 1 : 0);
