'use strict';
// Modules (v3.33): the person picks what the app shows; everything else is hidden everywhere, never deleted.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { demoState } = require('../../tools/demo-state.js');

const NOW = '2026-10-14T08:00:00';
const T0 = new Date(NOW).getTime();
const demo = over => { const app = loadApp({ now: NOW }); app.state(Object.assign(demoState(T0), over || {})); app.run('S.modIntro=false'); return app; };
const home = (app, l) => app.run(`homeHTML(${JSON.stringify(l || 'balanced')})`);
const board = app => app.json('boardTiles().map(t=>t.k)');
const off = (app, id) => app.run(`modSet(${JSON.stringify(id)},false,{quiet:true})`);
const on = (app, id) => app.run(`modSet(${JSON.stringify(id)},true,{quiet:true})`);

test('an install from before modules keeps everything on and is offered the choice once; a new one starts small', () => {
  const old = loadApp({ now: NOW }); old.state(demoState(T0));
  assert.equal(old.json('MODULES.every(m=>modOn(m.id))'), true, 'nothing disappears on an update');
  assert.equal(old.json('S.modIntro'), true);
  assert.match(home(old), /New: choose what Lah We shows/);
  old.run('modIntroDone(false)'); assert.equal(old.json('S.modIntro'), false);
  assert.doesNotMatch(home(old), /New: choose what Lah We shows/, 'asked once');
  const fresh = loadApp({ now: NOW }); fresh.run('S=normalizeState({})');
  assert.deepEqual(fresh.json(`MODULES.filter(m=>modShowing(m.id)).map(m=>m.id)`), ['workouts', 'body', 'coach'], 'Workouts, Body (weight) and Coach');
  assert.deepEqual(fresh.json(`['weight','measure','photos'].map(modOn)`), [true, false, false]);
  // a saved choice survives a save and a reload; junk is ignored
  fresh.run(`S.modules.nutrition=true;S.modules.music='yes'`);
  const back = fresh.json('normalizeState(JSON.parse(JSON.stringify(S))).modules');
  assert.equal(back.nutrition, true); assert.equal(back.music, false);
});

test('the tab bar is Home, Workout, Nutrition, Progress, Coach; Nutrition and Coach follow their modules', () => {
  const app = demo();
  assert.deepEqual(app.json('navTabs()'), ['workout', 'library', 'nutrition', 'progress', 'coach']);
  off(app, 'nutrition'); off(app, 'coach');
  assert.deepEqual(app.json('navTabs()'), ['workout', 'library', 'progress']);
  app.run(`go('nutrition')`); assert.equal(app.run('S.tab'), 'workout', 'a hidden tab cannot be reached');
  app.run(`go('coach')`); assert.equal(app.run('S.tab'), 'workout');
  on(app, 'nutrition'); app.run(`go('nutrition')`); assert.equal(app.run('S.tab'), 'nutrition');
  off(app, 'nutrition'); assert.equal(app.run('S.tab'), 'workout', 'turning off the tab you are on takes you Home');
});

test('a workout in progress lives on the Workout tab; Home stays Home with the bar back to it', () => {
  const app = demo();
  app.run(`go('workout');startWorkout(S.routines[0].id)`);
  assert.equal(app.run('S.tab'), 'library');
  assert.match(app.run(`document.getElementById('content').innerHTML`), /fin-btn|Finish/);
  app.run(`go('workout')`);
  const h = app.run(`document.getElementById('content').innerHTML`);
  assert.match(h, /hm-top/, 'Home is Home, not the session');
  app.run(`go('library')`); assert.match(app.run(`document.getElementById('content').innerHTML`), /Finish/);
  // nothing open: the Workout tab is what to start, then the Library
  app.run(`S.activeWorkout=null;go('library')`);
  const w = app.run(`document.getElementById('content').innerHTML`);
  assert.match(w, /page-title">Workout</); assert.match(w, /tr-start/); assert.match(w, /setLibTab\('groups'\)/);
});

test('Nutrition off: no tab, tile, layout, board tiles, targets row, builder, reminder or auto-logging', () => {
  const app = demo({ homeLayout: 'nutrition' });
  assert.match(home(app, 'nutrition'), /Food today/);
  off(app, 'nutrition');
  assert.doesNotMatch(home(app, 'nutrition'), /Food today/, 'the Nutrition layout falls back to Balanced');
  assert.equal(app.json('homeLayout(S.homeLayout).id'), 'balanced');
  assert.equal(app.json('S.homeLayout'), 'nutrition', 'the choice is kept for when it is back');
  assert.doesNotMatch(home(app), /aria-label="Food"/);
  assert.ok(!app.json('homeLayouts().map(l=>l.id)').includes('nutrition'));
  for (const k of ['calories', 'protein', 'maintenance']) assert.ok(!board(app).includes(k), k);
  app.run(`showSettings();`); assert.doesNotMatch(app.run(`SET_PAGES.goals.html()`), /Food targets/);
  assert.doesNotMatch(app.run('coachStartersHTML()'), /Check my targets|Plan my meals/);
  assert.ok(!app.json('remKinds().map(k=>k.id)').includes('food'));
  assert.ok(!app.json('calLensesShown().map(l=>l.id)').includes('food'));
  assert.deepEqual(app.json('planAutoLog()'), [], 'a hidden meal plan never logs food by itself');
  assert.doesNotMatch(app.run('homeStats(weekReview()).map(s=>s.lbl).join()'), /Protein|Calories/);
  // the data stays, and comes back in place
  const meals = app.json('S.meals.length'); assert.ok(meals > 0);
  on(app, 'nutrition'); assert.equal(app.json('S.meals.length'), meals);
  assert.ok(board(app).includes('calories'));
});

test('Body parts: weight off takes the tile, the board tile and the weigh-in field; photos and measurements on their own', () => {
  const app = demo();
  off(app, 'weight');
  assert.doesNotMatch(home(app), /aria-label="Weight"/);
  assert.ok(!board(app).includes('weight'));
  app.run('showWeighIn()');
  assert.doesNotMatch(app.run(`String(showWeighIn)`), /S\.trackSleep/);
  assert.equal(app.run(`modOn('body')`), true, 'the module stays while another part is on');
  off(app, 'photos'); off(app, 'measure');
  assert.equal(app.run(`modShowing('body')`), false, 'a module with every part off shows nothing');
  assert.ok(!board(app).includes('photos'));
});

test('Cardio off: no Cardio tile, Activity button, running tiles, layout or activities in History', () => {
  const app = demo();
  off(app, 'cardio');
  const h = home(app);
  assert.doesNotMatch(h, /aria-label="Cardio"/); assert.doesNotMatch(h, /showLogActivity\(\)/);
  assert.equal(app.run('runningOn()'), false);
  for (const k of ['runpace', 'runmiles', 'runroutes', 'runbest']) assert.ok(!board(app).includes(k), k);
  assert.ok(!app.json('homeLayouts().map(l=>l.id)').includes('running'));
  assert.equal(app.json(`histItems().filter(x=>x.type==='activity').length`), 0);
});

test('Habits & mood off: no tile, no questions in the check-in, no habit or mood tests in Patterns', () => {
  const app = demo({ habits: [{ id: 'r', name: 'Read', type: 'done', from: '2026-09-01' }], moodLog: { '2026-10-12': 4 } });
  assert.ok(app.json('activeHabits().length') === 1);
  off(app, 'habits');
  assert.equal(app.json('activeHabits().length'), 0); assert.equal(app.run('moodAsked()'), false); assert.equal(app.run('sleepAsked()'), false);
  assert.doesNotMatch(home(app), /aria-label="Habits"|aria-label="Mood"/);
  app.run(`go('habits')`); assert.equal(app.run('S.homeView'), '', 'the Habits page cannot be opened');
  assert.equal(app.json('S.habits.length'), 1, 'the list is kept');
  const fams = app.json('[...new Set(patterns().all.map(r=>r.test.fam))]');
  for (const f of ['habits', 'happiness', 'sleep']) assert.ok(!fams.includes(f), f);
  on(app, 'habits'); assert.equal(app.json('activeHabits().length'), 1);
});

test('a Patterns test reading a hidden module is not run, which also keeps the correction honest', () => {
  const app = demo();
  const n = app.json('patterns().all.length');
  assert.ok(app.json(`patterns().all.some(r=>r.test.fam==='fuel')`));
  off(app, 'nutrition');
  assert.ok(!app.json(`patterns().all.some(r=>r.test.fam==='fuel'||r.test.id==='p-kcal'||r.test.id==='m-prot')`));
  assert.ok(app.json('patterns().all.length') < n);
  off(app, 'patterns');
  assert.equal(app.run('patHomeLine()'), null); assert.ok(!board(app).includes('patterns'));
});

test('Coach off: no tab, no Home card, no "Ask the coach" anywhere; the builders stay on the Workout tab', () => {
  const app = demo();
  off(app, 'coach');
  assert.doesNotMatch(home(app), /home-coach/);
  assert.equal(app.run('coachAI()'), false);
  app.run(`S.activeWorkout=null;go('library')`);
  assert.match(app.run(`document.getElementById('content').innerHTML`), /showBuilder\('program'\)/);
});

test('the opening: its screens follow the modules picked, imports pre-tick, and Start records the day', () => {
  const app = loadApp({ now: NOW }); app.run(`S=normalizeState({});window._ob=null;obInit()`);
  assert.deepEqual(app.json('obSteps()'), ['you', 'bring', 'track', 'set:about', 'set:body', 'set:coach', 'look', 'ready']);
  app.run(`modPick('nutrition');modPick('habits');modPick('coach')`);
  assert.deepEqual(app.json('obSteps()'), ['you', 'bring', 'track', 'set:about', 'set:body', 'set:food', 'set:habits', 'look', 'ready']);
  assert.equal(app.json('S.onboarded'), false, 'nothing is set up until Start');
  // something imported pre-ticks its module
  app.run(`S.activities=[{id:'a',type:'run',date:'2026-10-01',dist:'3'}];obPrecheck()`); assert.equal(app.run(`modOn('cardio')`), true);
  // the habits screen makes what was picked
  app.run(`obHabit('read');obHabit('protein');window._ob.i=obSteps().indexOf('set:habits');OB_CHECK['set:habits']()`);
  assert.deepEqual(app.json('S.habits.map(h=>h.name||habitAutoName(h)).sort()'), ['Hit protein', 'Read']);
  app.run(`window._ob.name='Sam';finishOb()`);
  assert.deepEqual(app.json('[S.onboarded,S.modIntro,S.modSince,S.homeView]'), [true, false, '2026-10-14', '']);
  // layouts on offer are the ones the modules allow
  assert.ok(app.json('homeLayouts().map(l=>l.id)').includes('nutrition'));
  assert.ok(app.json('homeLayouts().map(l=>l.id)').includes('running'), 'the imported runs pre-ticked Cardio, so its layout is offered');
  assert.ok(app.json('homeLayouts().map(l=>l.id)').includes('habits'));
});

test('suggestions: from the data, one a week, Not now for 90 days, Never for good, nothing in the first week or a pause', () => {
  const app = demo();
  app.run(`S.modules=normalizeModules({},MOD_DEFAULT);S.modSince='2026-09-01';S.modReview={d30:true};S.modSuggest={at:0,mute:{},cur:null}`);
  // six weeks of training: photos is suggested, and Turn on brings Body with only photos
  const x = app.json('(suggestNow()||{}).r||null'); assert.equal(x && x.id, 'photos');
  assert.match(home(app), /Want progress photos/);
  app.run(`S.modules.body=false;S.modules.weight=true;suggestAnswer('photos','on')`);
  assert.deepEqual(app.json(`[modOn('body'),modOn('photos'),modOn('weight')]`), [true, true, false]);
  assert.equal(app.json('suggestNow()'), null, 'the next one waits a week');
  app.setNow('2026-10-22T08:00:00'); app.run('bumpMemo()');
  const y = app.json('(suggestNow()||{}).r||null'); assert.ok(y && y.id !== 'photos');
  app.run(`suggestAnswer(${JSON.stringify(y.id)},'later')`);
  assert.ok(app.json(`S.modSuggest.mute[${JSON.stringify(y.id)}]`) > Date.parse('2027-01-01'));
  app.setNow('2026-11-01T08:00:00');
  const z = app.json('(suggestNow()||{}).r||null'); if (z) { assert.notEqual(z.id, y.id, 'muted'); app.run(`suggestAnswer(${JSON.stringify(z.id)},'never')`); assert.equal(app.json(`S.modSuggest.mute[${JSON.stringify(z.id)}]`), -1); }
  // a fresh opening: nothing for a week
  app.run(`S.modSince=today();S.modSuggest={at:0,mute:{},cur:null}`); assert.equal(app.json('suggestNow()'), null);
  // a pause: nothing
  app.run(`S.modSince='2026-09-01';S.pauses=[{id:'p',from:daysAgoStr(1),to:addDays(today(),2),why:'sick'}]`); assert.equal(app.json('suggestNow()'), null);
});

test('setup reviews at 30 and 90 days: what is used, what is idle (Hide), what is off (Turn on)', () => {
  const app = demo();
  app.run(`S.modSince=daysAgoStr(10)`); assert.equal(app.json('reviewDue()'), null);
  app.run(`S.modSince=daysAgoStr(31)`); assert.equal(app.json('reviewDue()'), 30);
  assert.match(home(app), /Your setup, 30 days in/);
  app.run(`S.modules.music=false;S.supps=[];S.habits=[];S.habitLog={};S.moodLog={};S.sleepLog={};showModReview(30)`);
  const html = app.run(`(()=>{let h='';const g=document.getElementById;document.getElementById=id=>id==='mrev-body'?{set innerHTML(v){h=v},get innerHTML(){return h},closest:()=>null}:g(id);renderModReview();document.getElementById=g;return h;})()`);
  assert.match(html, /Habits &amp; mood[\s\S]*Nothing logged in the last 3 weeks[\s\S]*Hide/);
  assert.match(html, /Off[\s\S]*Music[\s\S]*Turn on/);
  app.run(`S.modReview={d30:true}`); assert.equal(app.json('reviewDue()'), null);
  app.run(`S.modSince=daysAgoStr(95)`); assert.equal(app.json('reviewDue()'), 90);
});

test('Running analysis is a part of Cardio & runs that keeps its switch-itself-on rule', () => {
  const app = loadApp({ now: NOW }); app.state({ name: 'K', activities: [1, 2, 3].map(i => ({ id: 'r' + i, type: 'run', date: `2026-10-0${i}`, dist: '3', dur: '27' })) });
  assert.equal(app.run('runningOn()'), true);
  off(app, 'running'); assert.deepEqual(app.json('[S.running,runningOn()]'), [false, false]);
  on(app, 'running'); assert.deepEqual(app.json('[S.running,runningOn()]'), [null, true], 'back to switching itself on');
  off(app, 'cardio'); assert.equal(app.run('runningOn()'), false);
});
