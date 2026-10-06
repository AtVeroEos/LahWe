#!/usr/bin/env node
// Prints the built-in exercise catalog grouped by category, in the form used by docs/import-format.md.
//   node tools/catalog.js
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '10-data.js'), 'utf8') + ';this.__ex=EXERCISES;this.__cats=CATS;', ctx);
for (const cat of ctx.__cats.filter(c => c !== 'All')) {
  console.log(`**${cat}**: ` + ctx.__ex.filter(e => e.cat === cat).map(e => e.name).join(', '));
}
