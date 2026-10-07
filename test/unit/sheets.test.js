'use strict';
// Sheets and the phone keyboard: when a tap on the dimmed area may close a sheet, and how much
// room the keyboard is taking.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-15T18:30:00';
const field = (tag, type) => ({ tagName: tag, type: type || '', blurred: 0, blur() { this.blurred++; } });
const sheet = (inside, over) => Object.assign({ contains: el => inside.includes(el), querySelector: () => null, _blurAt: 0 }, over || {});

test('a tap outside a sheet: closes it, unless the keyboard or typed text is in the way', () => {
  const app = loadApp({ now: NOW });
  const closes = (ov, pressedOutside) => { app.ctx.__ov = ov; return app.run(`backdropCloses(__ov,${pressedOutside})`); };
  app.ctx.document.activeElement = null;

  // nothing in the way
  assert.equal(closes(sheet([]), true), true);

  // the keyboard is up for a field in this sheet: the tap only puts it away
  const name = field('INPUT', 'text');
  app.ctx.document.activeElement = name;
  assert.equal(closes(sheet([name]), true), false);
  assert.equal(name.blurred, 1);

  // …and a field in some other sheet is none of this sheet's business
  assert.equal(closes(sheet([]), true), true);
  assert.equal(name.blurred, 1);

  // the same tap can arrive a moment after it has already taken the keyboard away
  app.ctx.document.activeElement = null;
  const now = new Date(NOW).getTime();
  assert.equal(closes(sheet([], { _blurAt: now - 150 }), true), false);
  assert.equal(closes(sheet([], { _blurAt: now - 900 }), true), true);

  // a press that began on a button inside the sheet never closes it
  assert.equal(closes(sheet([]), false), false);

  // a sheet holding something typed keeps it; once it is empty again the tap closes it
  let typed = 'Creatine';
  const ov = sheet([], { _keep: () => !!typed });
  assert.equal(closes(ov, true), false);
  typed = '';
  assert.equal(closes(ov, true), true);
  // a broken _keep must not trap anyone in a sheet
  assert.equal(closes(sheet([], { _keep: () => { throw new Error('x'); } }), true), true);

  // a menu or a tick box does not bring a keyboard up, so it does not swallow the tap
  const menu = field('SELECT', 'select-one'), tick = field('INPUT', 'checkbox'), date = field('INPUT', 'date');
  [menu, tick, date].forEach(el => { app.ctx.document.activeElement = el; assert.equal(closes(sheet([el]), true), true); assert.equal(el.blurred, 0); });
  // a number box and a text area do
  [field('INPUT', 'number'), field('TEXTAREA'), field('INPUT', 'search'), field('INPUT', '')].forEach(el => {
    app.ctx.document.activeElement = el; assert.equal(closes(sheet([el]), true), false); assert.equal(el.blurred, 1);
  });
});

test('how much of the screen the keyboard is taking', () => {
  const app = loadApp({ now: NOW });
  const kb = (inner, vv) => { app.ctx.innerHeight = inner; app.ctx.visualViewport = vv; return app.run('kbHeight()'); };
  assert.equal(kb(844, undefined), 0);                              // a browser that cannot say
  assert.equal(kb(844, { height: 844, scale: 1 }), 0);              // no keyboard
  assert.equal(kb(844, { height: 508, scale: 1 }), 336);            // keyboard up
  assert.equal(kb(844, { height: 800, scale: 1 }), 0);              // a toolbar's worth is not a keyboard
  assert.equal(kb(844, { height: 422, scale: 2 }), 0);              // zoomed in: smaller view, no keyboard
  assert.equal(kb(844, { height: 508 }), 336);                      // scale not reported
});
