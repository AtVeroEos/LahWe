'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { demoState } = require('../../tools/demo-state.js');
const NOW = '2026-10-20T18:00:00';
const deck = auto => `S.activeCardDeck={deck:[{suit:'spades',label:'5',value:5,exId:'pushup'},{suit:'spades',label:'6',value:6,exId:'pushup'},{suit:'spades',label:'7',value:7,exId:'pushup'},{suit:'spades',label:'8',value:8,exId:'pushup'}],cardIdx:0,startTime:Date.now(),secPerRep:1,buffer:0,suitMap:{spades:'pushup'},repsByEx:{pushup:0},cardsByEx:{pushup:[]},auto:${auto},_autoRun:0};`;

test('Card Deck: with auto-flip off nothing flips by itself; with it on, two untapped cards and it stops', () => {
  const app = loadApp({ now: NOW });
  app.state({});
  app.run(deck(false) + 'schedCDAutoFlip()');
  assert.equal(app.run('S.activeCardDeck._phaseStart'), null, 'off: no timer');
  app.run(deck(true) + 'schedCDAutoFlip()');
  assert.ok(app.run('S.activeCardDeck._phaseStart') > 0, 'on: the pace timer runs');
  app.run('flipCard(true);flipCard(true);schedCDAutoFlip()');
  assert.equal(app.run('S.activeCardDeck._phaseStart'), null, 'two cards nobody tapped: it stops');
  app.run('flipCard(false)');
  assert.ok(app.run('S.activeCardDeck._phaseStart') > 0, 'a tap starts it again');
});

test('converting units can be undone exactly', () => {
  const app = loadApp({ now: NOW });
  app.state(demoState(new Date(NOW).getTime()));
  app.run(`toast=(m,c,o)=>{globalThis.__t={m,o};};`);
  const before = app.run(`JSON.stringify(S.workouts.map(w=>w.exercises.map(e=>e.sets.map(s=>s.w))))`);
  app.run(`applyUnit('kg',true)`);
  assert.equal(app.run('S.unit'), 'kg');
  app.run(`__t.o.onAction()`);
  assert.equal(app.run('S.unit'), 'lbs');
  assert.equal(app.run(`JSON.stringify(S.workouts.map(w=>w.exercises.map(e=>e.sets.map(s=>s.w))))`), before);
});
