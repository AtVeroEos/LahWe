'use strict';
// Superset linking: what the Link button does, that two neighbouring supersets stay two, and the
// order the swipe walks them in.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-15T18:30:00';
const setup = () => loadApp({ now: NOW });
// Four exercises, each with the given number of sets; returns the array and helpers inside the app.
const make = (app, n, sets) => app.run(`window._t=Array.from({length:${n}},(_,i)=>({exId:'e'+i,link:null,sets:Array.from({length:${sets||2}},()=>({}))}));1`);
const links = app => app.run(`JSON.stringify(window._t.map(e=>e.link?e.link:null))`);
const groups = app => JSON.parse(app.run(`JSON.stringify(ssGroups(window._t).map(g=>[g.start,g.end]))`));
const act = (app, i) => app.run(`linkAction(window._t,${i})`);
const tap = (app, i) => app.run(`toggleLinkAt(window._t,${i});1`);

test('a pair, then a second pair next to it, stay two groups', () => {
  const app = setup(); make(app, 4);
  assert.equal(act(app, 0), 'link'); tap(app, 0);
  assert.equal(act(app, 2), 'link'); tap(app, 2);
  assert.deepEqual(groups(app), [[0, 1], [2, 3]]);
  const l = JSON.parse(links(app)); assert.notEqual(l[0], l[2]);
});

test('the button names what it will do', () => {
  const app = setup(); make(app, 4);
  tap(app, 0); // A+B
  assert.equal(act(app, 0), 'unlink');   // inside the pair
  assert.equal(act(app, 1), 'add');      // B and a loose C
  tap(app, 2);                           // C+D
  assert.equal(act(app, 1), 'merge');    // B and C belong to different groups
  assert.equal(app.run(`LINK_LABEL.merge`), 'Merge groups');
});

test('merging puts every member of both groups under one label, nobody is stranded', () => {
  const app = setup(); make(app, 4);
  tap(app, 0); tap(app, 2); tap(app, 1);
  assert.deepEqual(groups(app), [[0, 3]]);
  assert.equal(new Set(JSON.parse(links(app))).size, 1);
});

test('adding a loose exercise extends the neighbouring group either way', () => {
  const app = setup(); make(app, 4);
  tap(app, 1);                  // B+C
  tap(app, 0);                  // A joins from the left
  tap(app, 2);                  // D joins from the right
  assert.deepEqual(groups(app), [[0, 3]]);
});

test('split cuts a big group in two at the button, and unlink clears a pair', () => {
  const app = setup(); make(app, 4);
  tap(app, 0); tap(app, 1); tap(app, 2);          // one group of four
  assert.equal(act(app, 1), 'split');
  tap(app, 1);                                    // cut between B and C
  assert.deepEqual(groups(app), [[0, 1], [2, 3]]);
  tap(app, 0);                                    // unlink the first pair
  assert.deepEqual(groups(app), [[2, 3]]);
  assert.equal(JSON.parse(links(app))[0], null);
});

test('splitting off one exercise leaves no one-member "group" behind', () => {
  const app = setup(); make(app, 3);
  tap(app, 0); tap(app, 1);                       // A B C
  tap(app, 1);                                    // cut between B and C: C is alone
  assert.deepEqual(groups(app), [[0, 1]]);
  assert.equal(JSON.parse(links(app))[2], null);
});

test('the last row has no button, and a bad index does nothing', () => {
  const app = setup(); make(app, 2);
  assert.equal(app.run(`linkAction(window._t,1)`), null);
  assert.equal(app.run(`linkAction(window._t,-1)`), null);
  assert.equal(app.run(`toggleLinkAt(window._t,5);JSON.stringify(window._t.map(e=>e.link))`), '[null,null]');
});

test('merging asks first; cancelling changes nothing, confirming merges', () => {
  const app = setup(); make(app, 4);
  tap(app, 0); tap(app, 2);
  const before = links(app);
  app.run(`window._done=0;toggleLinkAsk(window._t,1,()=>{window._done++});1`);
  assert.equal(links(app), before, 'nothing changes before the answer');
  assert.equal(app.run(`window._done`), 0);
  app.run(`doConfirm()`);
  assert.deepEqual(groups(app), [[0, 3]]);
  assert.equal(app.run(`window._done`), 1);
  // everything else goes straight through
  make(app, 3);
  app.run(`window._done=0;toggleLinkAsk(window._t,0,()=>{window._done++});1`);
  assert.deepEqual(groups(app), [[0, 1]]);
  assert.equal(app.run(`window._done`), 1);
});

test('swipe order: round by round inside a pair, and two neighbouring pairs do not mix', () => {
  const app = setup(); make(app, 4, 2);
  tap(app, 0); tap(app, 2);
  const order = app.run(`swipeOrder({exercises:window._t}).map(o=>'ABCD'[o.ei]+(o.si+1)).join(' ')`);
  assert.equal(order, 'A1 B1 A2 B2 C1 D1 C2 D2');
  // merged into one group of four the order is round by round across all four, which is what
  // the Merge confirm warns about
  tap(app, 1); // asks nothing at this level; the confirm lives in toggleLinkAsk
  assert.equal(app.run(`swipeOrder({exercises:window._t}).map(o=>'ABCD'[o.ei]+(o.si+1)).join(' ')`), 'A1 B1 C1 D1 A2 B2 C2 D2');
});

test('an import where one label covers four neighbouring exercises is flagged, not silently merged or dropped', () => {
  const app = setup();
  app.set('__p', { groups: [{ name: 'G', mode: 'rotation', routines: [{ name: 'Upper', exercises: [
    { name: 'Bench Press', sets: 3, reps: 8, link: 'A' }, { name: 'Barbell Row', sets: 3, reps: 8, link: 'A' },
    { name: 'Overhead Press', sets: 3, reps: 8, link: 'A' }, { name: 'Pull-Up', sets: 3, reps: 8, link: 'A' },
  ] }] }] });
  const r = app.json('parseImport(__p)');
  assert.ok(r.warnings.some(w => /4 exercises share superset A/.test(w)), r.warnings.join(' | '));
  assert.equal(r.routines[0].exercises.filter(e => e.link === 'A').length, 4, 'left as the file said; the person decides');
});
