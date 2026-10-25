'use strict';
// Golden files for the other-app importers: each fixture's read result and the import plan built from
// it, compared field by field with what is saved in test/fixtures/golden/import/. Any change to how
// a file is read (a column, a unit, a date, an exercise match) shows up here as a diff.
//
// These goldens were recorded from the code, not worked out by hand, so they prove a reader did not
// change, not that it was right. JEFIT_REAL is the one built from a real export. When a reader is
// changed on purpose: UPDATE_GOLDEN=1 node --test test/unit/import-golden.test.js, then read the diff
// in git before committing it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('../harness.js');
const F = require('../fixtures/app-import.js');

const DIR = path.join(__dirname, '..', 'fixtures', 'golden', 'import');
const UPDATE = process.env.UPDATE_GOLDEN === '1';
const NOW = '2026-10-25T12:00:00';
const ANS = { unit: 'lb', range: 'all', routines: {}, fix: {}, muscle: {} };
// fixture → the app the user tapped
const CASES = { STRONG: 'strong', STRONG6: 'strong', STRONG_MEAS: 'strong', HEVY: 'hevy', HEVY_MEAS: 'hevy', HEVY_DE: 'hevy',
  FITBOD: 'fitbod', JEFIT: 'jefit', JEFIT_RESAVED: 'jefit', JEFIT_REAL: 'jefit', ALPHA: 'alpha', STRONGLIFTS: 'stronglifts' };

// Stable text: sorted keys, floats to 4 places, so a re-ordered object or 0.1+0.2 noise is not a "change".
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = stable(v[k]); return o; }, {});
  if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 1e4) / 1e4;
  return v;
}
function firstDiff(a, b, p) {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], p + (Array.isArray(a) ? `[${k}]` : '.' + k)); if (d) return d; }
  }
  return `${p}: expected ${JSON.stringify(b)} but got ${JSON.stringify(a)}`.slice(0, 400);
}

for (const [name, app] of Object.entries(CASES)) {
  test(`golden: ${name} (${app})`, () => {
    assert.ok(F[name] != null, name + ' fixture exists');
    const a = loadApp({ now: NOW });
    a.set('__t', F[name]);
    a.run(`window.__f=[ixReadText(__t,${JSON.stringify(app)},${JSON.stringify(name.toLowerCase() + '.csv')})]`);
    const read = a.json('__f[0]');
    let plan = null;
    if (!read.error) {
      a.set('__ans', JSON.parse(JSON.stringify(ANS)));
      plan = a.json('(()=>{const P=ixPlan(__f,__ans);const o=Object.assign({},P);delete o.candidates;return o;})()');
    }
    const got = stable({ read, plan });
    const file = path.join(DIR, name + '.json');
    if (UPDATE || !fs.existsSync(file)) {
      if (!UPDATE) assert.fail(`no golden for ${name}: run with UPDATE_GOLDEN=1 once, then review it`);
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(got, null, 1) + '\n');
      return;
    }
    const want = JSON.parse(fs.readFileSync(file, 'utf8'));
    const d = firstDiff(got, want, name);
    assert.equal(d, null, d || '');
  });
}

test('every fixture in app-import.js has a golden case', () => {
  assert.deepEqual(Object.keys(F).sort(), Object.keys(CASES).sort());
});
