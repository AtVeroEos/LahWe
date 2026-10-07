'use strict';
// The Library: one exercise sheet for the whole app, workouts drawn as what they hit, programs
// drawn as time, equipment as a filter, and the reminder time.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { demoState } = require('../../tools/demo-state.js');

const NOW = '2026-10-07T12:00:00'; // a Wednesday
const demo = over => { const app = loadApp({ now: NOW }); app.state(Object.assign(demoState(new Date(NOW).getTime()), over || {})); return app; };
const blank = over => { const app = loadApp({ now: NOW }); app.state(over || {}); return app; };
const html = app => app.run(`document.getElementById('content').innerHTML`);
const text = h => String(h).replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('one exercise sheet: how often, the best of it, where it sits, and a way to add it', () => {
  const app = demo();
  const d = app.json(`metricDetail('lift',{id:'squat'},boardRange())`);
  assert.equal(d.title, 'Barbell Back Squat');
  assert.match(d.sub, /^Legs · Barbell · last done /);
  assert.deepEqual(d.stats.map(s => s.l.replace(/, .*/, '')), ['Best set', 'Sessions in 12 wk', 'Times a week', 'Gained a week']);
  assert.equal(d.stats[1].v, 8);
  assert.ok(Math.abs(parseFloat(d.stats[2].v) - 1) < 0.25, `about once a week (${d.stats[2].v})`);
  const body = text(d.body);
  assert.match(body, /In 1 workout Lower A \d sets? × /);
  assert.match(body, /Sessions .*best set 280 × 7/);
  assert.match(body, /Record 280 × 7 Set in Lower A on /);
  assert.match(d.acts, /Add to a workout/);
  // the sheet a record opens and the sheet the Library opens are this same one
  assert.match(app.run('String(showPRDetail)') + app.run('String(showExDetail)'), /showMetric\('lift'[\s\S]*showMetric\('lift'/);
  // never done: no chart and no numbers, but the facts and the way in
  const n = app.json(`metricDetail('lift',{id:'db-fly'},boardRange())`);
  assert.deepEqual([n.title, n.sub, n.plain, n.noRange, n.value], ['Dumbbell Fly', 'Chest · Dumbbell', true, true, undefined]);
  assert.match(text(n.body), /No sets logged yet/);
  assert.match(n.acts, /Add to a workout/);
  // times a week counts from the first session when the lift is newer than the period
  const young = blank({ workouts: [3, 1].map((ago, i) => { const t = new Date(NOW); t.setDate(t.getDate() - ago); return { id: 'w' + i, name: 'A', started: t.getTime(), ended: t.getTime() + 3e6, exercises: [{ exId: 'squat', sets: [{ w: '200', r: '5', done: true }] }] }; }) });
  assert.equal(young.json(`metricDetail('lift',{id:'squat'},boardRange())`).stats[2].v, '2.0'); // twice in its first week, not twice in twelve
  // a carried-over record with no session behind it can be removed from the sheet
  const carried = blank({ prsManual: { 'bb-bench': { w: 225, r: 3, est: 248 } } });
  assert.equal(carried.run(`!!(S.prs['bb-bench']&&S.prs['bb-bench'].manual)`), true);
  const cb = carried.json(`metricDetail('lift',{id:'bb-bench'},boardRange())`).body;
  assert.match(cb, /removeCarriedPR/); assert.match(text(cb), /Record 225 × 3 was carried over/);
  carried.run(`removeCarriedPR('bb-bench')`);
  assert.doesNotMatch(carried.json(`metricDetail('lift',{id:'bb-bench'},boardRange())`).body, /carried over/);
});

test('adding an exercise to a workout from its sheet', () => {
  const app = demo();
  const before = app.run(`S.routines.find(r=>r.id==='r-upperA').exercises.length`);
  app.run(`addExerciseTo('r-upperA','db-fly')`);
  assert.deepEqual(app.json(`S.routines.find(r=>r.id==='r-upperA').exercises.slice(-1)[0]`), { exId: 'db-fly', sets: 3, w: '', r: '', type: 'flat', rest: null });
  app.run(`addExerciseTo('r-upperA','db-fly')`); // twice is once
  assert.equal(app.run(`S.routines.find(r=>r.id==='r-upperA').exercises.length`), before + 1);
  app.run(`addExerciseTo('nope','db-fly');addExerciseTo('r-upperA','nope')`);
  assert.equal(app.run(`S.routines.find(r=>r.id==='r-upperA').exercises.length`), before + 1);
  assert.deepEqual(app.json(`exRoutines('db-fly').map(x=>x.r.name)`), ['Upper A']);
  assert.equal(app.run(`rtnPlanText({sets:4,r:'5',rMax:'7'})`), '4 sets × 5–7');
  assert.equal(app.run(`rtnPlanText({r:'8'})`), '3 sets × 8');
  assert.equal(app.run(`rtnPlanText({sets:1,amrap:true})`), '1 set × max');
});

test('a workout card: sets per muscle, how long it takes, when it is next', () => {
  const app = demo();
  const ms = app.json(`rtnMuscleSets(S.routines.find(r=>r.id==='r-lowerA'))`);
  assert.ok(ms.length >= 2 && ms.length <= 4);
  assert.ok(ms.every((x, i) => i === 0 || x.m === 'Other' || ms[i - 1].sets >= x.sets), 'most sets first');
  assert.equal(ms.reduce((t, x) => t + x.sets, 0), app.run(`S.routines.find(r=>r.id==='r-lowerA').exercises.reduce((t,e)=>t+(e.sets==null?3:e.sets),0)`), 'every set is counted once');
  // more than four muscles: the three biggest and the rest together
  const many = app.json(`rtnMuscleSets({exercises:['squat','bench','bb-row','ohp','bb-curl','plank'].filter(id=>getEx(id)).map(id=>({exId:id,sets:3}))})`);
  assert.ok(many.length <= 4 && (many.length < 4 || many[3].m === 'Other'));
  assert.deepEqual(app.json(`rtnMuscleSets({exercises:[]})`), []);
  // time: what it really took when it has been done, else an estimate from sets and rest
  const real = app.json(`rtnMinutes(S.routines.find(r=>r.id==='r-lowerA'))`);
  assert.equal(real.real, true); assert.ok(real.min >= 5 && real.min % 5 === 0);
  assert.deepEqual(app.json(`rtnMinutes({id:'new',exercises:[{exId:'squat',sets:4,rest:120},{exId:'bench',sets:3,rest:80}]})`), { min: 15, real: false }); // 4×160 s + 3×120 s = 16.7 min, to the nearest five
  assert.deepEqual(app.json(`rtnMinutes({id:'new',exercises:[]})`), { min: 0, real: false });
  // labels for the week strip tell the workouts apart, by the shortest scheme that does
  const codes = names => app.json(`rtnCodes(${JSON.stringify(names.map(n => ({ name: n })))})`);
  assert.deepEqual(codes(['Upper A', 'Lower A', 'Upper B', 'Lower B']), ['UA', 'LA', 'UB', 'LB']);
  assert.deepEqual(codes(['Push', 'Pull', 'Legs']), ['Push', 'Pull', 'Legs']);
  assert.deepEqual(codes(['Upper Arms', 'Upper Abs']), ['Uppe', 'Uppe'].length && ['1', '2']); // initials and four letters both collide
  assert.deepEqual(codes(['Full Body', '']), ['1', '2']);
  // fixed days: it is Wednesday; Upper/Lower runs Mon Tue Thu Fri and this week's first two are done
  const g = app.json('getActiveGroup()');
  const next = app.json('rtnNextIn(getActiveGroup())');
  const byDay = Object.fromEntries(Object.entries(g.dayMap).map(([rid, days]) => [days[0], rid]));
  assert.deepEqual([next[byDay[4]], next[byDay[5]], next[byDay[1]], next[byDay[2]]], [1, 2, 5, 6]);
  // a rotation: next is the one the cursor is on
  const rot = demo(); rot.run(`const g=getActiveGroup();g.mode='rotation';g.cursor=2`);
  const rn = rot.json('rtnNextIn(getActiveGroup())'); const ids = rot.json('getActiveGroup().routineIds');
  assert.deepEqual(ids.map(id => rn[id]), [2, 3, 0, 1]);
});

test('the Library page: three views, old tab names still land, equipment is a filter', () => {
  const app = demo({ tab: 'library' });
  const page = t => { app.run(`S.libTab=${JSON.stringify(t)};renderLibrary(document.getElementById('content'))`); return html(app); };
  // workouts: the next one first with a primary Start, the muscle bar, where it sits
  let h = page('routines');
  assert.match(h, /role="tab" aria-selected="true"[^>]*>Workouts</);
  assert.match(h, /Build with coach/);
  const cards = h.split(/class="lib-card[" ]/).slice(1);
  assert.equal(cards.length, 4);
  assert.match(cards[0], /btn btp lc-go/); assert.match(cards[0], /Next up · tomorrow/); assert.match(cards[0], /Upper \/ Lower · Thursdays/);
  assert.ok(cards.slice(1).every(c => /btn bts lc-go/.test(c)), 'only the next one is the primary button');
  assert.ok(cards.every(c => /class="mbar"/.test(c) && /about \d+ min/.test(c)));
  // programs: the split in use as this week, with what is done
  h = page('groups');
  assert.match(h, /Running now/); assert.match(h, /In use/);
  assert.equal((h.match(/wk-c has done/g) || []).length, 2, 'Monday and Tuesday are done');
  assert.match(text(h), /Next: Upper B · tomorrow/);
  // a timed program: phases to scale, the week it is in
  app.run(`S.groups.push({id:'g2',name:'PPL',mode:'rotation',routineIds:S.routines.slice(0,3).map(r=>r.id),cursor:1,dayMap:{},active:false});S.program={active:true,startDate:addDays(today(),-9),phases:[{groupId:getActiveGroup().id,mode:'weeks',weeks:4},{groupId:'g2',mode:'weeks',weeks:3},{groupId:'gone',mode:'weeks',weeks:1}]}`);
  h = page('groups');
  assert.match(text(h), /Timed program Week 2 of 8/);
  assert.deepEqual((h.match(/class="ph-seg" style="flex:(\d+)"/g) || []).map(x => +x.match(/flex:(\d+)/)[1]), [28, 21, 7]);
  assert.match(h, /<i style="width:32%"><\/i>/); // nine of the first phase's 28 days
  assert.match(text(h), /Other splits PPL From /);
  assert.match(h, /class="rot"/);
  // exercises: yours first, most recent on top; the rest under them
  h = page('exercises');
  const t = text(h);
  assert.ok(t.indexOf('Yours · ') >= 0 && t.indexOf('Yours · ') < t.indexOf('Not tried yet · '));
  assert.match(t, /Barbell Back Squat Legs · in Lower A 345 \+51/);
  // equipment is a filter here, and one setting for the whole app
  const all = app.json('libExMatches()');
  app.run(`setEquipFilter('dumbbells')`);
  const db = app.json('libExMatches()');
  assert.ok(db.canDo < all.canDo && db.exs.every(e => ['Dumbbell', 'Bodyweight'].includes(e.eq)));
  assert.match(text(html(app)), new RegExp(`Showing what you can do with dumbbell, bodyweight: ${db.canDo} of ${all.total}`));
  assert.equal(app.run('S.equipPreset'), 'dumbbells');
  app.run(`setEquipFilter('nope');setLibEquipPreset('full')`);
  assert.equal(app.run('S.equipPreset'), 'full');
  // saved states and links from before
  assert.equal(page('equipment') && app.run('libTab()'), 'exercises');
  assert.equal(page('zzz') && app.run('libTab()'), 'routines');
  assert.equal(blank().run('libTab()'), 'routines');
  // nothing yet
  const empty = blank({ tab: 'library' });
  for (const [tab, re] of [['routines', /No workouts yet/], ['groups', /No program yet/], ['exercises', /Exercises · \d+/]]) {
    empty.run(`S.libTab='${tab}';renderLibrary(document.getElementById('content'))`);
    assert.match(text(html(empty)), re);
  }
});

test('reminders: setting a time is asking for the reminder', () => {
  const app = blank();
  assert.equal(app.run('S.reminders.weigh.on'), false);
  app.run(`setReminder('weigh','time','06:40')`);
  assert.deepEqual(app.json('[S.reminders.weigh.on,S.reminders.weigh.time]'), [true, '06:40']);
  app.run(`setReminder('food','time','25:99')`); // nonsense changes nothing
  assert.deepEqual(app.json('[S.reminders.food.on,S.reminders.food.time]'), [false, '20:00']);
  assert.match(app.run('String(renderReminders)'), /class="rem-time/);
  assert.doesNotMatch(app.run('String(renderReminders)'), /disabled'}>\$\{tog/);
});
