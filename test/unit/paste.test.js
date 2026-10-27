'use strict';
// 3.34.1: pastes that came through a phone. iOS Smart Punctuation, Notes and Messages turn straight
// quotes curly (“name”: “Plank”), which is not JSON; every import now reads them. The fixture is a real
// program that failed five times in a row before this.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('../harness.js');

const CURLY = fs.readFileSync(path.join(__dirname, '../fixtures/paste/curly-program.txt'), 'utf8');
const fresh = () => { const app = loadApp({ now: '2026-10-27T18:00:00' }); app.state({ onboarded: true }); return app; };
const curl = s => s.replace(/"([^"]*)"/g, '“$1”');

test('the program that failed on paste now imports: five workouts, 31 exercises', () => {
  const app = fresh();
  assert.ok(CURLY.includes('“'), 'the fixture really has curly quotes');
  const r = app.json(`(()=>{const j=extractJson(${JSON.stringify(CURLY)});if(j.error)return{err:j.error};const p=parseImport(j.value);return{err:p.error||null,n:p.routines.length,ex:p.routines.reduce((a,r)=>a+r.exercises.length,0),name:p.program&&p.program.name}})()`);
  assert.equal(r.err, null);
  assert.equal(r.n, 5); assert.equal(r.ex, 31);
  assert.match(r.name, /Women’s 45-Min Fat Loss/, 'the apostrophe inside a name is kept');
});

test('pasted into "Paste the answer", it is recognised as a workout plan', () => {
  const app = fresh();
  assert.equal(app.json(`aiParseReply(${JSON.stringify(CURLY)}).kind`), 'workout');
});

test('meal plans, targets and habits read with curly quotes too', () => {
  const app = fresh();
  const kind = s => app.json(`aiParseReply(${JSON.stringify(s)}).kind`);
  assert.equal(kind(curl('{"type":"targets","kcal":2400,"protein_g":180}')), 'targets');
  assert.equal(kind(curl('{"type":"habits","habits":[{"name":"Read"}]}')), 'habits');
  assert.equal(kind(curl('Here you go:\n```json\n{"type":"meal_plan","days":[]}\n```')), 'meal_plan');
});

test('a trailing comma and a non-breaking space are forgiven; a cut-off answer still says so', () => {
  const app = fresh();
  assert.equal(app.json(`extractJson(${JSON.stringify('{"a":[1,2,], "b":1,}')}).value.b`), 1);
  assert.match(app.json(`aiParseReply(${JSON.stringify('{"type":"targets","kcal":24')}).error`), /cut off or has a typo/);
});

test('straight JSON with a curly quote inside a note is left exactly as it was', () => {
  const app = fresh();
  const t = '{"routines":[{"name":"A","exercises":[{"name":"Plank","note":"say “hold”"}]}]}';
  assert.equal(app.json(`extractJson(${JSON.stringify(t)}).value.routines[0].exercises[0].note`), 'say “hold”');
});

test('a backup that went through a phone restores', () => {
  const app = fresh();
  assert.equal(app.json(`Store.parse(${JSON.stringify(curl('{"unit":"kg","name":"K"}'))}).unit`), 'kg');
  assert.equal(app.json(`Store.parse("not json")`), null);
});
