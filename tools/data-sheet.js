#!/usr/bin/env node
// Writes docs/coach-data-sheet.md from the table and formula definitions in src/js/65b-coach-data.js,
// so the sheet the coach reads and the one people (and future AI sessions editing the app) read are
// the same text. test/unit/coach-data.test.js fails while the file is behind the code.
//   node tools/data-sheet.js           write it
//   node tools/data-sheet.js --check   exit 1 if it is out of date
'use strict';
const fs = require('fs');
const path = require('path');
const { loadApp } = require('../test/harness.js');

const OUT = path.join(__dirname, '..', 'docs', 'coach-data-sheet.md');
function sheet() { return loadApp().run('coachDataSheetMd()'); }

if (require.main === module) {
  const md = sheet();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== md) { console.error('docs/coach-data-sheet.md is out of date: run npm run sheet'); process.exit(1); }
    console.log('data sheet up to date');
  } else {
    fs.writeFileSync(OUT, md);
    console.log('wrote docs/coach-data-sheet.md');
  }
}
module.exports = { sheet, OUT };
