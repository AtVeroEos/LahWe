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

  // a sheet holding something typed is no longer decided here: the tap reaches tryDismissOv,
  // which asks (see the next test)
  assert.equal(closes(sheet([], { _form: true, _dirtyFn: () => true }), true), true);

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
  // Nothing being typed in: no keyboard, whatever the viewport says. The share sheet, a file picker
  // or another app can leave the viewport reading short with no "keyboard gone" event to follow;
  // counting that as a keyboard left the sheet pushed half way up the screen.
  app.ctx.document.activeElement = null;
  assert.equal(kb(844, { height: 508, scale: 1 }), 0);
  app.ctx.document.activeElement = { tagName: 'BUTTON' };
  assert.equal(kb(844, { height: 508, scale: 1 }), 0);
  app.ctx.document.activeElement = field('INPUT', 'text');
  assert.equal(kb(844, undefined), 0);                              // a browser that cannot say
  assert.equal(kb(844, { height: 844, scale: 1 }), 0);              // no keyboard
  assert.equal(kb(844, { height: 508, scale: 1 }), 336);            // keyboard up
  assert.equal(kb(844, { height: 800, scale: 1 }), 0);              // a toolbar's worth is not a keyboard
  assert.equal(kb(844, { height: 422, scale: 2 }), 0);              // zoomed in: smaller view, no keyboard
  assert.equal(kb(844, { height: 508 }), 336);                      // scale not reported
});

test('unsaved changes: one rule for every form sheet', () => {
  const app = loadApp({ now: NOW });
  app.ctx.document.activeElement = null;
  const inp = (tag, type, value, def, more) => Object.assign({ tagName: tag, type, value, defaultValue: def, disabled: false, closest: () => null }, more || {});
  const form = (els, over) => { const m = { querySelectorAll: () => els, style: {}, classList: { add() {}, remove() {} }, offsetWidth: 0 }; return Object.assign({ _form: true, querySelector: q => q === '.modal' ? m : null, isConnected: true, contains: () => false }, over || {}); };
  const changed = ov => { app.ctx.__ov = ov; return app.run('sheetChanged(__ov)'); };

  // untouched fields, or a sheet that is not a form, are not changes
  assert.equal(changed(form([inp('INPUT', 'text', 'Push', 'Push'), inp('TEXTAREA', 'textarea', '', '')])), false);
  assert.equal(changed(Object.assign(form([inp('INPUT', 'text', 'typed', '')]), { _form: false })), false);
  // typing in a field is; spaces alone are not
  assert.equal(changed(form([inp('INPUT', 'number', '185', '')])), true);
  assert.equal(changed(form([inp('INPUT', 'text', '  ', '')])), false);
  // a search box, a file picker and [data-nodraft] never count
  assert.equal(changed(form([inp('INPUT', 'search', 'curl', '')])), false);
  assert.equal(changed(form([inp('INPUT', 'text', 'x', '', { closest: () => ({}) })])), false);
  // tick boxes and menus count when moved from how they were drawn
  assert.equal(changed(form([inp('INPUT', 'checkbox', 'on', 'on', { checked: true, defaultChecked: false })])), true);
  const opts = [{ defaultSelected: false }, { defaultSelected: true }];
  assert.equal(changed(form([inp('SELECT', 'select-one', '', '', { options: opts, selectedIndex: 1 })])), false);
  assert.equal(changed(form([inp('SELECT', 'select-one', '', '', { options: opts, selectedIndex: 0 })])), true);
  // what the fields cannot show is said by the sheet (exercises added, a photo picked)
  assert.equal(changed(form([], { _dirtyFn: () => true })), true);
  // a broken dirty check falls back to the fields, so nobody is trapped
  assert.equal(changed(form([], { _dirtyFn: () => { throw new Error('x'); } })), false);

  // what a swipe or a stray tap does: unchanged closes; changed asks; busy only nudges
  app.run(`window.__asked=[];window.__closed=0;customConfirm=(m,l,cb,o)=>{__asked.push(o.title+'|'+l+'|'+o.cancel);window.__discard=cb;};dismissOv=()=>{__closed++;};`);
  const go = ov => { app.ctx.__ov = ov; app.run('tryDismissOv(__ov)'); return app.json('{asked:__asked.slice(),closed:__closed}'); };
  assert.deepEqual(go(form([inp('INPUT', 'text', 'a', 'a')])), { asked: [], closed: 1 });
  assert.deepEqual(go(form([inp('INPUT', 'text', 'typed', '')])), { asked: ['Discard changes?|Discard|Keep editing'], closed: 1 });
  app.run('__discard()');
  assert.equal(app.json('__closed'), 2, 'Discard closes it');
  assert.deepEqual(go(form([inp('INPUT', 'text', 'typed', '')], { _keep: () => true })), { asked: ['Discard changes?|Discard|Keep editing'], closed: 2 }, 'busy: neither asked nor closed');
});
