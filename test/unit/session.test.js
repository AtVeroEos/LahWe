'use strict';
// 3.34: the workout screen. Lifts fold to one line except the one you are on; timed sets (holds,
// runs, intervals) are ticked as planned or timed with ▶ in every view; the rest counts past zero and
// the rest taken is kept; notes that show every time; a run saved from a workout is not imported twice.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-10-27T18:30:00';
const fresh = over => { const app = loadApp({ now: NOW }); app.state(Object.assign({ onboarded: true }, over || {})); return app; };
// A workout from routine-like entries: [{exId, sets, r, ...}]
const start = (app, entries) => app.run(`S.activeWorkout={id:'w1',routineId:null,name:'T',started:Date.now(),notes:'',
  exercises:${JSON.stringify(entries)}.map(e=>sessionExercise(e.exId,null,Object.assign({sets:2,r:'8'},e)))};`);
const html = app => app.run(`(()=>{const el=document.createElement('div');renderSession(el);return el.innerHTML;})()`);
const set = (app, ei, si) => app.json(`S.activeWorkout.exercises[${ei}].sets[${si}]`);
const fill = (app, ei, w, r) => app.run(`S.activeWorkout.exercises[${ei}].sets.forEach(s=>{s.w='${w}';s.r='${r}';})`);

// ─── Which lifts are open ───
test('only the lift you are on is open; finished lifts fold to what you did; others to their plan', () => {
  const app = fresh();
  start(app, [{ exId: 'bb-bench' }, { exId: 'bb-row' }, { exId: 'ohp' }]);
  fill(app, 0, '185', '8'); fill(app, 1, '135', '8');
  let h = html(app);
  assert.match(h, /class="exb exb-open" id="exb-0"/);
  assert.match(h, /class="exr" id="exb-1"/);
  assert.match(h, /class="exr" id="exb-2"/);
  app.run('togSet(0,0);togSet(0,1)');
  h = html(app);
  assert.match(h, /class="exr exr-done" id="exb-0"/, 'bench is done and folds');
  assert.match(h, /2 × 8 @ 185/);
  assert.match(h, /class="exb exb-open" id="exb-1"/, 'rows open next');
});

test('tapping a folded lift opens it without closing the one you are on; ⌃ folds it', () => {
  const app = fresh();
  start(app, [{ exId: 'bb-bench' }, { exId: 'bb-row' }, { exId: 'ohp' }]);
  app.run('sessToggle(2,true)');
  let h = html(app);
  assert.match(h, /id="exb-0"[^>]*>/); assert.match(h, /class="exb exb-open" id="exb-0"/);
  assert.match(h, /class="exb exb-open" id="exb-2"/);
  assert.match(h, /sessToggle\(2,false\)/, 'an open lift has the fold button');
  app.run('sessToggle(0,false)');
  h = html(app);
  assert.match(h, /class="exr" id="exb-0"/, 'the lift you are on can be folded too');
  assert.match(h, /class="exb exb-open" id="exb-2"/);
});

test('a lift you opened folds when its last set is ticked', () => {
  const app = fresh();
  start(app, [{ exId: 'bb-bench' }, { exId: 'bb-row', sets: 1 }]);
  fill(app, 1, '135', '8');
  app.run('sessToggle(1,true);togSet(1,0)');
  assert.match(html(app), /class="exr exr-done" id="exb-1"/);
  assert.match(html(app), /class="exb exb-open" id="exb-0"/);
});

test('a superset opens and folds as one', () => {
  const app = fresh();
  start(app, [{ exId: 'bb-bench' }, { exId: 'bb-row' }, { exId: 'ohp' }]);
  app.run(`const x=S.activeWorkout.exercises;x[1].link=x[2].link='g';`);
  app.run('sessToggle(2,true)');
  const h = html(app);
  assert.match(h, /class="exb exb-open" id="exb-1"/);
  assert.match(h, /class="exb exb-open" id="exb-2"/);
});

test('the open lift: name, ⋯ and ⌃, one line of facts, − and +; no Rest, Plates, Form or Swap buttons', () => {
  const app = fresh();
  start(app, [{ exId: 'bb-bench', sets: 3 }]);
  fill(app, 0, '225', '5');
  const h = html(app);
  assert.match(h, /showExMenu\(0\)/);
  assert.match(h, /showRestPicker\(/, 'rest is the tappable text in the facts line');
  assert.doesNotMatch(h, /class="ib ib-wide"/);
  assert.doesNotMatch(h, /aria-label="Plate calculator"/);
  assert.match(h, /225: 45 \+ 45 a side/, 'the plates for the next set, as text');
  assert.doesNotMatch(h, /confirmCancel/);
  assert.match(h, /aria-label="Remove the last set"/);
  assert.match(h, /aria-label="Add a set"/);
  assert.match(h, /id="ss-plan">3</, 'the bar counts the sets planned');
});

test('saving drops the open/folded state and the clock', () => {
  const app = fresh();
  start(app, [{ exId: 'plank', timed: true, r: '30', sets: 1 }]);
  app.run(`sessToggle(0,true);S.activeWorkout.exercises[0].sets[0].done=true;S.activeWorkout._tm={ei:0,si:0,exId:'x',k:'hold',go:0,total:1};saveWorkout()`);
  const w = app.json('S.workouts[0]');
  assert.equal(w._tm, undefined);
  assert.equal(w.exercises[0]._open, undefined);
});

// ─── Timed sets ───
test('cardio: ticked off, it logs the planned time and the activity says so', () => {
  const app = fresh();
  start(app, [{ exId: 'treadmill-run', sets: 1, r: '900', timed: true }]);
  app.run('togSet(0,0)');
  const s = set(app, 0, 0);
  assert.equal(s.done, true); assert.equal(s.r, '900');
  app.run('saveWorkout()');
  const a = app.json('S.activities[0]');
  assert.equal(a.type, 'run'); assert.equal(a.dur, '15'); assert.equal(a.durPlan, true); assert.equal(a.sec, undefined);
});

test('cardio with no plan and nothing typed is not ticked: there is nothing to log', () => {
  const app = fresh();
  start(app, [{ exId: 'walk', sets: 1, r: '' }]);
  app.run(`S.activeWorkout.exercises[0].sets[0].r='';S.activeWorkout.exercises[0].target.r='';togSet(0,0)`);
  assert.equal(set(app, 0, 0).done, false);
});

test('cardio on the clock: counts up past the target, rings once, logs the real time on Stop', () => {
  const app = fresh();
  start(app, [{ exId: 'easy-run', sets: 1, r: '900' }]);
  app.run('tmStart(0,0)');
  assert.equal(app.json('S.activeWorkout._tm.k'), 'up');
  app.run('S.activeWorkout._tm.go=Date.now()-950*1000;tmTick()');
  assert.equal(app.json('S.activeWorkout._tm.cue'), 'target', 'the target cue');
  assert.equal(set(app, 0, 0).done, false, 'it keeps going past the target');
  app.run(`S.activeWorkout._tm.go=Date.now()-1031*1000;tmFinish('stop')`);
  const s = set(app, 0, 0);
  assert.equal(s.done, true); assert.equal(s.r, '1031'); assert.equal(s.clock, true);
  app.run('saveWorkout()');
  const a = app.json('S.activities[0]');
  assert.equal(a.sec, 1031); assert.equal(a.durPlan, undefined); assert.equal(a.dur, '17');
});

test('a time typed in is a measurement, not the plan', () => {
  const app = fresh();
  start(app, [{ exId: 'easy-run', sets: 1, r: '900' }]);
  app.run(`upd(0,0,'rmin','16');togSet(0,0,false,true);saveWorkout()`);
  const a = app.json('S.activities[0]');
  assert.equal(a.dur, '16'); assert.equal(a.durPlan, undefined);
});

test('intervals: hard and easy in turn, a cue at each change, logged when the time is up', () => {
  const app = fresh();
  start(app, [{ exId: 'interval-run', sets: 1, r: '360' }]);
  app.run('tmStart(0,0)');
  const t = app.json('S.activeWorkout._tm');
  assert.deepEqual([t.k, t.w, t.r, t.total], ['iv', 60, 120, 360]);
  const st = e => app.json(`tmState(S.activeWorkout._tm,S.activeWorkout._tm.go+${e}*1000)`);
  assert.deepEqual([st(10).hard, st(10).round, st(10).rounds], [true, 1, 2]);
  assert.deepEqual([st(70).hard, Math.round(st(70).phRem)], [false, 110]);
  assert.deepEqual([st(190).hard, st(190).round], [true, 2]);
  app.run('S.activeWorkout._tm.go=Date.now()-361*1000;tmTick()');
  assert.deepEqual([set(app, 0, 0).done, set(app, 0, 0).r], [true, '360']);
});

test('interval lengths can be changed and are kept with the workout', () => {
  const app = fresh();
  app.run(`S.routines=[{id:'r1',name:'Run',exercises:[{exId:'interval-run',sets:1,r:'600',timed:true}]}]`);
  app.run(`startWorkout('r1')`);
  app.run(`document.getElementById=(orig=>id=>({'iv-w':{value:'30'},'iv-r':{value:'90'}})[id]||orig(id))(document.getElementById);saveIvCfg(0)`);
  assert.deepEqual(app.json('S.activeWorkout.exercises[0].iv'), { w: 30, r: 90 });
  assert.deepEqual(app.json('S.routines[0].exercises[0].iv'), { w: 30, r: 90 });
});

test('one clock at a time; ticking the set by hand stops it', () => {
  const app = fresh();
  start(app, [{ exId: 'plank', timed: true, r: '45', sets: 2 }]);
  app.run('tmStart(0,0);tmStart(0,1)');
  assert.equal(app.json('S.activeWorkout._tm.si'), 0);
  app.run('togSet(0,0)');
  assert.equal(app.json('S.activeWorkout._tm||null'), null);
});

test('▶ is on a hold with a time and on any cardio; not on a lift', () => {
  const app = fresh();
  start(app, [{ exId: 'plank', timed: true, r: '45' }, { exId: 'easy-run', sets: 1, r: '' }, { exId: 'bb-bench' }]);
  app.run('sessToggle(1,true);sessToggle(2,true)');
  const h = html(app);
  assert.match(h, /tmStart\(0,0\)/);
  assert.match(h, /tmStart\(1,0\)/, 'a run with no time planned still has ▶ (open time)');
  assert.doesNotMatch(h, /tmStart\(2,/);
});

test('a folded one-set run keeps ▶ and the tick on its line', () => {
  const app = fresh();
  start(app, [{ exId: 'bb-bench' }, { exId: 'treadmill-run', sets: 1, r: '900' }]);
  const h = html(app);
  assert.match(h, /class="exr" id="exb-1"[\s\S]*tmStart\(1,0\)[\s\S]*togSet\(1,0\)/);
});

test('swipe views: a run shows minutes, not seconds, and ▶ in both modes', () => {
  const app = fresh();
  start(app, [{ exId: 'easy-run', sets: 1, r: '900' }]);
  const card = mode => app.run(`(()=>{S.activeWorkout._swipe='${mode}';const el=document.createElement('div');renderSwipe(el);return el.innerHTML;})()`);
  const simple = card('simple');
  assert.match(simple, />15:00</); assert.doesNotMatch(simple, />900</);
  assert.match(simple, /tmStart\(0,0\)/);
  const sup = card('super');
  assert.match(sup, /15:00/); assert.match(sup, /tmStart\(0,0\)/);
  app.run(`S.activeWorkout._swipe='simple';swipeAdj('r',1)`);
  assert.equal(set(app, 0, 0).r, '960', 'the stepper moves a minute at a time');
});

test('the timer survives a reload: the clock is on the workout, not in memory', () => {
  const app = fresh();
  start(app, [{ exId: 'plank', timed: true, r: '45' }]);
  app.run('tmStart(0,0)');
  const st = app.json('normalizeState(JSON.parse(JSON.stringify(S))).activeWorkout._tm');
  assert.equal(st.k, 'hold'); assert.equal(st.total, 45);
});

// ─── Rest ───
test('the rest counts past zero, then clears itself after ten minutes over', () => {
  const app = fresh();
  start(app, [{ exId: 'bb-bench' }]);
  app.run('startRest(60);S.restTimer.end=Date.now()-5000;tickRest()');
  assert.equal(app.json('S.restTimer.over'), true);
  app.run('tickRest()');
  assert.ok(app.json('S.restTimer'), 'still there, counting up');
  app.run('S.restTimer.end=Date.now()-601000;tickRest()');
  assert.equal(app.json('S.restTimer'), null);
});

test('each ticked set keeps the time since the set before it; a long gap is not a rest', () => {
  const app = fresh();
  start(app, [{ exId: 'bb-bench', sets: 3 }]);
  fill(app, 0, '185', '5');
  app.run(`togSet(0,0);S.activeWorkout.exercises[0].sets[0].t=Date.now()-150000;togSet(0,1)`);
  assert.equal(set(app, 0, 1).rt, 150);
  assert.equal(set(app, 0, 0).rt, undefined, 'the first set has nothing before it');
  app.run(`S.activeWorkout.exercises[0].sets.slice(0,2).forEach(x=>{x.t=Date.now()-3600000;});togSet(0,2)`);
  assert.equal(set(app, 0, 2).rt, undefined);
  app.run('togSet(0,1)');
  assert.equal(set(app, 0, 1).rt, undefined, 'unticked, it goes');
});

test('Patterns reads the rest between a lift’s working sets, not the walk over to it', () => {
  const app = fresh();
  app.run(`S.workouts=[{id:'a',name:'A',started:Date.now()-86400000,exercises:[{exId:'bb-bench',sets:[{w:'185',r:'5',done:true,rt:400},{w:'185',r:'5',done:true,rt:120},{w:'185',r:'5',done:true,rt:180}]}]}]`);
  const fn = app.run(`String(patData)`);
  assert.match(fn, /slice\(1\)\.map\(s=>\+s\.rt\)/);
});

// ─── Notes ───
test('notes: one that shows every time, one for today; both on the lift, today’s in History', () => {
  const app = fresh();
  start(app, [{ exId: 'bb-bench' }]);
  app.run(`document.getElementById=(orig=>id=>({'note-pin':{value:'  Seat on 4 '},'note-now':{value:'Shoulder tight'}})[id]||orig(id))(document.getElementById);saveExNote(0)`);
  assert.equal(app.json('S.exNotes["bb-bench"]'), 'Seat on 4');
  assert.equal(app.json('S.activeWorkout.exercises[0].noteNow'), 'Shoulder tight');
  const h = html(app);
  assert.match(h, /Seat on 4/); assert.match(h, /Shoulder tight/);
  app.run(`S.activeWorkout.exercises[0].sets[0].done=true;S.activeWorkout.exercises[0].sets[0].w='185';S.activeWorkout.exercises[0].sets[0].r='5';saveWorkout()`);
  assert.match(app.run('wkDetailExHTML(S.workouts[0])'), /Shoulder tight/);
  // a later workout shows the pinned note again, not today's
  start(app, [{ exId: 'bb-bench' }]);
  const h2 = html(app);
  assert.match(h2, /Seat on 4/); assert.doesNotMatch(h2, /Shoulder tight/);
});

test('pinned notes survive a restore (trimmed) and follow an exercise that is merged into another', () => {
  const app = fresh();
  const s = app.json(`normalizeState({exNotes:{'bb-bench':'  pins at 6  ','x':'',y:5}}).exNotes`);
  assert.deepEqual(s, { 'bb-bench': 'pins at 6' });
  app.run(`S.exNotes={'c1':'note'};remapExerciseId(S,'c1','bb-bench')`);
  assert.equal(app.json('S.exNotes["bb-bench"]'), 'note');
});

// ─── Strava and the old setting ───
test('a run saved from a workout is the same run as Strava’s that day, whatever the time', () => {
  const app = fresh();
  app.run(`S.activities=[{id:'w',type:'run',date:'2026-10-27',dur:'15',dist:'',src:'workout',wkId:'w1',durPlan:true}]`);
  const at = app.run(`new Date(2026,9,27,7,0).getTime()`);
  const plan = app.json(`stravaPlan([{srcId:'s1',at:${at},type:'run',name:'Morning Run',distMi:2.1,durMin:17.2}])`);
  assert.equal(plan.add.length, 0); assert.equal(plan.dup, 1);
  // a workout's "other" (an elliptical) does not swallow a Strava lift
  app.run(`S.activities=[{id:'w',type:'other',date:'2026-10-27',dur:'20',src:'workout'}]`);
  const p2 = app.json(`stravaPlan([{srcId:'s2',at:${at},type:'lift',name:'Weights',distMi:0,durMin:55}])`);
  assert.equal(p2.add.length, 1);
});

test('the old "timed sets run themselves" switch is gone: ▶ is always there', () => {
  const app = fresh();
  assert.equal(app.run('String(normalizeState({swipeHold:false}).swipeHold)'), 'undefined');
});

test('History shows a run as time and distance', () => {
  const app = fresh();
  app.run(`S.workouts=[{id:'a',name:'A',started:Date.now(),exercises:[{exId:'easy-run',cardio:true,timed:true,sets:[{r:'1031',d:'2.1',done:true}]}]}]`);
  assert.match(app.run('wkDetailExHTML(S.workouts[0])'), /17:11 · 2\.1 mi/);
});

test('new cardio exercises are in the catalog with form steps and an activity kind', () => {
  const app = fresh();
  for (const id of ['treadmill-run', 'walk', 'incline-walk', 'elliptical', 'stair-climber', 'air-bike', 'ski-erg']) {
    const e = app.json(`getEx('${id}')`);
    assert.equal(e.kind, 'cardio', id);
    assert.ok(app.json(`ACT_TYPES.some(a=>a.id===getEx('${id}').act)`), id);
    assert.ok(app.json(`!!(FORM['${id}']||{}).steps`), id + ' has form steps');
  }
});
