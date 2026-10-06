'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

// FNV-1a over every row of a table ("points:v1,…,v20", highest points first, times in seconds,
// "-" where a point value is not awarded). The expected values were computed from the text layer of
// the official PDF (AFT_Scoring_Scales_250601.pdf) in a browser, independently of this code's tables.
const CHECKSUMS = { MDL: 'bf172038', HRP: 'df116368', SDC: '9f7ac018', PLK: '4700f5ae', '2MR': '6bcbd1ec' };
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };

test('AFT score tables match the official document cell for cell', () => {
  const app = loadApp();
  const T = app.json('AFT_TABLES');
  for (const ev of Object.keys(CHECKSUMS)) {
    const rows = Object.keys(T[ev]).map(Number).sort((a, b) => b - a);
    assert.ok(rows.every(p => T[ev][p].length === 20), ev + ': 20 columns in every row');
    const canon = rows.map(p => p + ':' + T[ev][p].map(v => (v == null ? '-' : String(v))).join(',')).join('\n');
    assert.equal(fnv(canon), CHECKSUMS[ev], ev);
  }
});
test('AFT scoring: between rows earns the lower row; unattainable cells are skipped', () => {
  const app = loadApp();
  // column 2 = age 22-26, male / combat
  assert.equal(app.run(`aftScore('MDL',350,2)`), 100);
  assert.equal(app.run(`aftScore('MDL',400,2)`), 100);
  assert.equal(app.run(`aftScore('MDL',345,2)`), 99, '340 is the 99-point lift at 22-26');
  assert.equal(app.run(`aftScore('MDL',339,2)`), 97, 'no 98-point cell in this column: falls to 97 (330)');
  assert.equal(app.run(`aftScore('MDL','',2)`), null);
  assert.equal(app.run(`aftScore('MDL','abc',2)`), null);
  // two-mile run, 17-21 male (column 0): 60 points is 19:57, one second slower is 59
  assert.equal(app.run(`aftScore('2MR',19*60+57,0)`), 60);
  assert.equal(app.run(`aftScore('2MR',19*60+58,0)`), 59);
  assert.equal(app.run(`aftScore('2MR',19*60+57+3,0)`), 59);
  assert.equal(app.run(`aftScore('2MR',19*60+57+4,0)`), 58);
  assert.equal(app.run(`aftScore('2MR',3600,0)`), 0);
});
test('AFT columns, standards and pass marks', () => {
  const app = loadApp({ now: '2026-06-15T12:00:00' });
  app.state({ birthYear: 1996, birthMonth: 9, aftGender: 'female', aftStandard: 'general' });
  assert.equal(app.run('userAge()'), 29);
  assert.equal(app.run('aftColumn()'), 5, '27-31, female');
  app.run(`S.aftStandard='combat'`);
  assert.equal(app.run('aftColumn()'), 4, 'the combat standard is sex-neutral: male column');
  assert.equal(app.run(`aftSummary({MDL:'',HRP:'',SDC:'',PLK:'','2MR':''}).pass`), null, 'nothing entered is neither pass nor fail');
  const need60 = app.json(`AFT_EVENTS.reduce((o,e)=>(o[e.id]=String(aftNeed(e.id,60,4)),o),{})`);
  app.set('__raw', need60);
  const a = app.json('aftSummary(__raw,4)');
  assert.equal(a.total, 300); assert.equal(a.need, 350); assert.equal(a.pass, false, '60 in every event is not enough for combat');
  app.run(`S.aftStandard='general'`);
  assert.equal(app.json('aftSummary(__raw,4)').pass, true);
  const one59 = Object.assign({}, need60, { HRP: String(Number(need60.HRP) - 1) });
  app.set('__raw2', one59);
  assert.equal(app.json('aftSummary(__raw2,4)').pass, false, 'under 60 in any one event fails');
});
