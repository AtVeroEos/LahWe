#!/usr/bin/env node
// The app is one concatenated script, so two files that both declare `function foo` do not error:
// the later one silently replaces the earlier one everywhere. let/const/class repeats would throw at
// load, but are listed here too so the message names both files.
// No parser and no dependencies: top-level declarations in this codebase always start at column 0 and
// nested ones are indented. Skipping strings/comments by hand mis-reads regex literals and hides real
// declarations, so nothing is skipped: text inside a template that happens to start a line with
// "function x" would be reported, which fails loudly rather than letting a real repeat through.
//   node tools/check-dupes.js        (build.js runs it and stops on a repeat)
'use strict';
const fs = require('fs');
const path = require('path');

const DECL = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^(?:var|let|const)\s+([A-Za-z_$][\w$]*)|^class\s+([A-Za-z_$][\w$]*)/gm;

function findDupesIn(files) { // files: [{name, src}] in build order
  const seen = new Map(); const dupes = [];
  for (const { name: f, src } of files) {
    let m; DECL.lastIndex = 0;
    while ((m = DECL.exec(src))) {
      const name = m[1] || m[2] || m[3];
      const at = `${f}:${src.slice(0, m.index).split('\n').length}`;
      if (seen.has(name)) dupes.push({ name, first: seen.get(name), again: at });
      else seen.set(name, at);
    }
  }
  return { count: seen.size, dupes };
}
function findDupes(dir) {
  return findDupesIn(fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => ({ name: f, src: fs.readFileSync(path.join(dir, f), 'utf8') })));
}
function dupesMessage(r) {
  return 'Declared twice (the later one silently replaces the earlier):\n' + r.dupes.map(d => `  ${d.name}: ${d.first} and ${d.again}`).join('\n');
}

module.exports = { findDupes, findDupesIn, dupesMessage };

if (require.main === module) {
  const r = findDupes(path.join(__dirname, '..', 'src', 'js'));
  if (r.dupes.length) { console.error(dupesMessage(r)); process.exit(1); }
  console.log(`Duplicate check passed — ${r.count} top-level names, none repeated.`);
}
