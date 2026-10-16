'use strict';
// 3.18: Settings in groups, the day's end and the week's start, Pause, plates and dumbbells you own,
// weight steps, automatic warm-ups, "last time" from any workout, louder cues that lower other audio,
// the Simple card's rest countdown that flips itself, timed sets that run themselves, CSV export.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-10-15T12:00:00'; // a Thursday
const blank = over => { const app = loadApp({ now: NOW }); app.state(over || {}); return app; };
const at = (ds, h) => new Date(`${ds}T${String(h == null ? 18 : h).padStart(2, '0')}:00:00`).getTime();
const html = (app, code) => app.run(`(()=>{const el=document.createElement('div');${code};return el.innerHTML;})()`);
const content = app => app.run(`document.getElementById('content').innerHTML`);
// A sound card that counts what is played, and an audio session to see ducking.
const withAudio = app => {
  app.ctx.__osc = []; app.ctx.__gains = [];
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime() {} });
  app.ctx.AudioContext = class {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createGain() { const g = { gain: param(), connect() {} }; app.ctx.__gains.push(g); return g; }
    createOscillator() { const o = { type: '', frequency: param(), connect() {}, start() {}, stop() {} }; app.ctx.__osc.push(o); return o; }
    createDynamicsCompressor() { return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect() {} }; }
    resume() {}
  };
  app.ctx.__timers = []; app.ctx.setTimeout = f => { app.ctx.__timers.push(f); return app.ctx.__timers.length; };
  return app;
};
const flushTimers = app => { const t = app.ctx.__timers.splice(0); t.forEach(f => f()); };

// ─── Settings ───
test('Settings is a list of groups with what is set now; every page draws, and every button on it does something', () => {
  const app = blank({ name: 'Kolbe' });
  const hub = app.run('setHubHTML()');
  for (const g of ['Units &amp; calendar', 'Goals &amp; targets', 'Workout', 'Check-in &amp; tracking', 'Appearance', 'Connections', 'Your data', 'Pause']) assert.ok(hub.includes(g), g);
  assert.match(hub, /lbs · in · week from Mon/);
  assert.doesNotMatch(hub, /saveSettings|Reset All Data|confirmReset/, 'no Save button, and erasing is inside Your data');
  const pages = app.json('Object.keys(SET_PAGES)');
  assert.deepEqual(pages, ['profile', 'units', 'goals', 'workout', 'tracking', 'look', 'connect', 'data']);
  for (const id of pages) {
    const h = app.run(`SET_PAGES['${id}'].html()`);
    const fns = [...h.matchAll(/onclick="([A-Za-z_$][\w$]*)/g)].map(m => m[1]).concat([...h.matchAll(/onchange="([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
    for (const f of new Set(fns)) if (f !== 'S') assert.equal(app.run(`typeof ${f}`), 'function', `${id}: ${f}`);
  }
  assert.match(app.run(`SET_PAGES.data.html()`), /confirmReset\(\)[^>]*>Erase everything/);
  assert.match(app.run(`SET_PAGES.data.html()`), /exportCSV\(\)/);
  assert.doesNotMatch(app.run(`SET_PAGES.profile.html()`), /id="set-bw"/, 'bodyweight is logged with the weigh-in, not typed into Settings');
  assert.match(app.run(`SET_PAGES.profile.html()`), /showWeighIn\(\)/);
});

test('profile fields save as you leave them; nothing waits for a Save button', () => {
  const app = blank();
  const field = v => ({ value: v, closest: () => true });
  app.ctx.__f = { 'set-name': field('Kolbe'), 'set-height': field('70'), 'set-byear': field('1995'), 'set-bmonth': field('4') };
  app.run(`(g=>{document.getElementById=id=>__f[id]||g(id);})(document.getElementById);commitProfile()`);
  assert.deepEqual(app.json('[S.name,S.height,S.birthYear,S.birthMonth,S.profileSet.height]'), ['Kolbe', 70, 1995, 4, true]);
  app.run(`setSex('female')`); assert.deepEqual(app.json('[S.aftGender,S.profileSet.sex]'), ['female', true]);
  assert.equal(app.run('refreshSettings()'), undefined, 'refreshing with Settings closed does nothing');
});

test('new settings come out of any save in range; an old save keeps the light or dark it was showing', () => {
  const app = blank();
  const n = o => app.json(`(()=>{const s=normalizeState(${JSON.stringify(o)});return[s.themeMode,s.weekStart,s.dayEnd,s.cueVol,s.cueSound,s.autoWarm,s.lastFrom,s.gear.mode,s.pauses.length];})()`);
  assert.deepEqual(n(null), ['system', 1, 0, 3, 'chime', 'off', 'routine', 'standard', 0]);
  assert.deepEqual(n({ _schema: 4, darkMode: true }).slice(0, 1), ['dark']);
  assert.deepEqual(n({ _schema: 4, darkMode: false }).slice(0, 1), ['light']);
  assert.deepEqual(n({ _schema: 4, themeMode: 'system', darkMode: true }).slice(0, 1), ['system']);
  assert.deepEqual(n({ _schema: 4, weekStart: 3, dayEnd: 9, cueVol: 7, cueSound: 'kazoo', autoWarm: 'x', lastFrom: 'y', gear: { mode: 'z' }, pauses: [{ from: 'nope' }, { from: '2026-10-01', to: '2026-09-01', why: 'x' }] }),
    ['system', 1, 0, 3, 'chime', 'off', 'routine', 'standard', 1]);
  assert.deepEqual(app.json(`normalizeState({pauses:[{from:'2026-10-01',to:'2026-09-01',why:'x'}]}).pauses[0]`).to, null, 'an end before the start is dropped, not trusted');
  app.run(`setThemeMode('dark')`); assert.equal(app.json('S.darkMode'), true);
  app.run(`setThemeMode('light')`); assert.equal(app.json('S.darkMode'), false);
});

// ─── The day and the week ───
test('"Day ends at": before that hour it is still yesterday, for today and for anything logged then', () => {
  const app = blank();
  app.setNow('2026-10-15T01:30:00');
  assert.equal(app.run('today()'), '2026-10-15');
  app.run('S.dayEnd=3');
  assert.equal(app.run('today()'), '2026-10-14');
  assert.equal(app.run(`dayOf(${at('2026-10-15', 1)})`), '2026-10-14', 'a 1 AM lift lands on the day you are still in');
  assert.equal(app.run(`dayOf(${at('2026-10-15', 3)})`), '2026-10-15');
  assert.equal(app.run('daysAgoStr(1)'), '2026-10-13');
  assert.equal(app.run('todayDow()'), 3, 'Wednesday');
  app.setNow('2026-10-15T09:00:00'); assert.equal(app.run('today()'), '2026-10-15');
});

test('the week can start on Sunday: weeks, the week strip and the calendar all follow', () => {
  const app = blank();
  assert.equal(app.run(`weekStartOf('2026-10-15')`), '2026-10-12');
  app.run('setWeekStart(0)');
  assert.equal(app.run(`weekStartOf('2026-10-15')`), '2026-10-11');
  assert.equal(app.run(`weekStartOf('2026-10-11')`), '2026-10-11');
  assert.equal(app.json(`weekDays().map(d=>d.letter).join('')`), 'SMTWTFS');
  assert.equal(app.json(`weekDays()[0].ds`), '2026-10-11');
  app.run(`S.calYear=2026;S.calMonth=9`);
  const cal = app.run(`renderCalendar('review')`);
  assert.match(cal, /cal-grid[^>]*><div class="cal-day-hdr">Su<\/div><div class="cal-day-hdr">Mo/);
  assert.equal((cal.split('cal-grid')[1].match(/cal-cell empty/g) || []).length, 4, 'Oct 1 2026 is a Thursday: four blanks from Sunday');
  app.run('setWeekStart(1)');
  assert.equal((app.run(`renderCalendar('review')`).split('cal-grid')[1].match(/cal-cell empty/g) || []).length, 3);
});

// ─── Pause ───
test('a pause holds habit and training streaks, and paused days are not judged', () => {
  const app = blank();
  const ago = n => app.run(`daysAgoStr(${n})`);
  app.run(`S.habits=normalizeHabits([{id:'r',name:'Read',type:'done',from:daysAgoStr(20)}]);S.habitLog={};
    [1,2,3,7,8,9,10].forEach(i=>{S.habitLog[daysAgoStr(i)]={r:true};});
    S.bodyweightLog=[1,2,3,4,5,6,7,8,9,10].map(i=>({date:daysAgoStr(i),weight:180}));bumpMemo()`);
  assert.equal(app.json(`habitStats(habitById('r')).streak`), 3, 'three missed days break it');
  const r = app.json(`pauseAdd('sick',${JSON.stringify(ago(6))},${JSON.stringify(ago(4))})`);
  assert.equal(r.ok, true);
  assert.equal(app.json(`habitStats(habitById('r')).streak`), 7, 'paused days neither count nor break');
  assert.equal(app.json(`habitDay(habitById('r'),daysAgoStr(5)).st`), 'off');
  // training streak, no fixed days: three idle days would end it
  app.run(`S.workouts=[1,2,7,8].map(i=>({id:'w'+i,name:'W',started:new Date(daysAgoStr(i)+'T18:00:00').getTime(),exercises:[]}));bumpMemo()`);
  assert.equal(app.run('getStreak()'), 4);
  assert.equal(app.run(`isTrainingDay(daysAgoStr(5))`), false);
  // food: a paused day is left out of "on target"
  app.run(`S.macroLogs[daysAgoStr(5)]={cals:500,protein:10,carbs:0,fat:0};S.macroLogs[daysAgoStr(2)]={cals:2000,protein:150,carbs:0,fat:0};bumpMemo()`);
  assert.deepEqual(app.json(`foodDays(7).filter(d=>d.logged).map(d=>d.ds)`), [ago(2)]);
  // overlaps are refused; an open pause stops counting after 60 days; ending one keeps today
  assert.match(app.json(`pauseAdd('travel',daysAgoStr(5),null)`).error, /overlaps/);
  const sig0 = app.run('patSig()');
  app.run(`pauseAdd('field',daysAgoStr(80),daysAgoStr(70))`);
  assert.notEqual(app.run('patSig()'), sig0, 'Patterns recompute when the paused days change');
  const app2 = blank();
  app2.run(`pauseAdd('other',daysAgoStr(70),null)`);
  assert.deepEqual(app2.json(`[isPaused(daysAgoStr(15)),isPaused(daysAgoStr(5)),pauseNow()]`), [true, false, null]);
  app2.run(`S.pauses=[];pauseAdd('sick',daysAgoStr(2),null)`);
  assert.match(app2.run('pauseSummary()'), /^Sick or hurt · since/);
  assert.match(app2.run('setHubHTML()'), /set-dot/, 'Settings shows a pause is on');
  assert.match(app2.run('pauseBannerHTML()'), /Paused/);
  app2.run(`pauseEndNow(S.pauses[0].id)`);
  assert.deepEqual(app2.json(`[S.pauses[0].to,isPaused(today()),isPaused(addDays(today(),1))]`), ['2026-10-15', true, false]);
});

// ─── Plates, dumbbells, steps ───
test('with only the plates you own, the bar loads only what they make, and + and − move between those weights', () => {
  const app = blank();
  app.run(`gearSet('mode','fixed');S.gear.plates={'45':1,'35':0,'25':1,'10':1,'5':1,'2.5':1,'1.25':0};_loadMemo=null`);
  assert.equal(app.run('gearBar()'), 45);
  const t = app.json('barbellLoads().totals');
  assert.equal(t[0], 45); assert.equal(t[t.length - 1], 220); assert.ok(t.includes(140) && !t.includes(225));
  assert.deepEqual(app.json(`platesFor(135,45)`).plates, [45]);
  const miss = app.json(`platesFor(225,45)`);
  assert.deepEqual([miss.exact, miss.below, miss.above], [false, 220, null]);
  assert.equal(app.run(`nextLoad('Barbell',135,1)`), 140);
  assert.equal(app.run(`nextLoad('Barbell',135,-1)`), 130);
  assert.equal(app.run(`stepUp(135,'Barbell')`), 140, "next session's weight is one you can load");
  // a kg set: fewest plates for a load
  const kg = blank({ unit: 'kg' });
  kg.run(`gearSet('mode','fixed')`);
  assert.deepEqual(kg.json(`platesFor(110,20)`).plates, [25, 20]);
  // switching the unit resets the kit; the mode stays
  app.run(`convertStoredWeights('kg')`);
  assert.deepEqual(app.json('[S.gear.mode,S.gear.bar,S.gear.plates]'), ['fixed', null, null]);
});

test('dumbbells as typed; weight steps per kind of equipment', () => {
  const app = blank();
  assert.deepEqual(app.json(`parseDumbbells('5-15/2.5, 20,25 , 30-40')`), [5, 7.5, 10, 12.5, 15, 20, 25, 30, 35, 40]);
  assert.deepEqual(app.json(`parseDumbbells('nonsense, -5, 60-50')`), []);
  app.run(`S.gear.dbs='5-25, 30'`);
  assert.equal(app.run(`nextLoad('Dumbbell',25,1)`), 30);
  assert.equal(app.run(`nextLoad('Dumbbell',30,-1)`), 25);
  assert.equal(app.run(`nextLoad('Machine',50,1)`), 52.5, 'no list for machines: the built-in step');
  app.run(`setStep('Machine',10)`); assert.equal(app.run(`loadInc('Machine',50)`), 10);
  assert.equal(app.run(`nextLoad('Machine',50,1)`), 60);
  app.run(`setStep('Machine',0)`); assert.equal(app.run(`loadInc('Machine',50)`), 2.5, 'Auto: the built-in step again');
  assert.equal(app.run('stepsSummary()'), 'Built-in');
});

// ─── Warm-ups and last time ───
test('automatic warm-ups: ramped to the first working weight, on the first lift or every barbell lift', () => {
  const routine = { id: 'r1', name: 'A', exercises: [{ exId: 'bb-bench', sets: 3, r: '5', w: '225' }, { exId: 'squat', sets: 3, r: '5', w: '135' }, { exId: 'db-curl', sets: 3, r: '10', w: '30' }] };
  const run = mode => { const app = blank({ routines: [routine], autoWarm: mode }); app.run(`startWorkout('r1')`); return app.json(`S.activeWorkout.exercises.map(e=>e.sets.filter(s=>s.warmup).map(s=>s.w+'x'+s.r))`); };
  assert.deepEqual(run('off'), [[], [], []]);
  assert.deepEqual(run('first'), [['90x5', '135x3', '180x2'], [], []]);
  const all = run('barbell');
  assert.deepEqual(all[0], ['90x5', '135x3', '180x2']);
  assert.equal(all[1].length, 2, '135 gets two'); assert.deepEqual(all[2], [], 'not dumbbells');
});

test('"last time" can be the most recent session with the lift, whichever workout it was in', () => {
  const app = blank({ routines: [{ id: 'r1', name: 'A', exercises: [{ exId: 'bb-bench', sets: 1, r: '5' }] }] });
  app.run(`S.workouts=[
    {id:'new',name:'Other',routineId:null,started:${at('2026-10-14')},exercises:[{exId:'bb-bench',sets:[{w:'210',r:'5',done:true}]}]},
    {id:'old',name:'A',routineId:'r1',started:${at('2026-10-10')},exercises:[{exId:'bb-bench',sets:[{w:'200',r:'5',done:true}]}]}];bumpMemo()`);
  assert.equal(app.run(`lastSetsFor('bb-bench','r1')[0].w`), '200');
  app.run(`setLastFrom('any')`);
  assert.equal(app.run(`lastSetsFor('bb-bench','r1')[0].w`), '210');
});

// ─── Sound ───
test('cues: the sound and volume picked, louder levels add harmonics, Max plays twice, other audio is lowered and given back', () => {
  const app = withAudio(blank());
  const play = (k, vol, sound) => { app.ctx.__osc.length = 0; app.run(`S.cueVol=${vol};S.cueSound='${sound}';playCue('${k}')`); return app.ctx.__osc.length; };
  assert.equal(play('rest', 1, 'chime'), 2, 'Normal: two plain notes');
  assert.equal(play('rest', 3, 'chime'), 6, 'Louder: each note with two harmonics');
  assert.equal(play('rest', 4, 'chime'), 12, 'Max: twice');
  assert.equal(play('rest', 2, 'beep'), 3);
  assert.equal(app.ctx.__osc[0].type, 'square');
  assert.equal(play('sprint', 2, 'ring'), 1);
  assert.equal(app.run(`cueBus(getAudioCtx()).input.gain.value`), 2.2);
  // ducking
  app.ctx.navigator.audioSession = { type: 'auto' };
  app.run(`S.cueDuck=true;playCue('rest')`);
  assert.equal(app.ctx.navigator.audioSession.type, 'transient');
  app.run(`playCue('walk')`); flushTimers(app);
  assert.equal(app.ctx.navigator.audioSession.type, 'auto', 'back to how it was once both have played');
  app.run(`S.cueDuck=false;playCue('rest')`); assert.equal(app.ctx.navigator.audioSession.type, 'auto');
  app.run(`S.cueDuck=true;playCue('tick')`); assert.equal(app.ctx.navigator.audioSession.type, 'auto', 'a countdown tick does not duck');
  // the old entry points use it
  app.ctx.__osc.length = 0; app.run(`S.cueVol=1;S.cueSound='chime';playRestBeep();playSprintBeep('walk')`);
  assert.equal(app.ctx.__osc.length, 3);
});

// ─── The Simple card ───
const live = (app, ids, over) => app.run(`S.activeWorkout={id:'w1',routineId:null,name:'T',started:Date.now(),exercises:${JSON.stringify(ids)}.map(id=>sessionExercise(id,null,Object.assign({exId:id,sets:2,r:'8'},${JSON.stringify(over || {})}))),notes:''};S.activeWorkout._swipe='simple';`);
test('the rest card: after a set it counts down, "See the set" peeks, and when rest ends it flips to the set', () => {
  const app = blank();
  live(app, ['bb-bench']);
  app.run(`S.activeWorkout.exercises[0].sets.forEach(s=>{s.w='100'});renderSwipe(document.getElementById('content'));swipeLog('ok')`);
  assert.ok(app.json('!!S.restTimer'), 'logging a set started the rest');
  let h = content(app);
  assert.match(h, /id="sw-rest"/); assert.match(h, /Up next · set 2/); assert.match(h, /100 lbs × 8/); assert.match(h, /swipePeek\(\)/);
  app.run('swipePeek()'); h = content(app);
  assert.doesNotMatch(h, /id="sw-rest"/); assert.match(h, /id="sw-card"/);
  app.run(`_sw.peek=0;renderSwipe(document.getElementById('content'))`); assert.match(content(app), /id="sw-rest"/);
  // the rest ends: the card flips to the set
  app.run(`S.restTimer=null;(g=>{document.getElementById=id=>id==='sw-rest'?{}:g(id);})(document.getElementById);swipeRestTick(false,0)`);
  h = content(app); assert.match(h, /class="sw-card sw-flip"/); assert.doesNotMatch(h, /id="sw-rest"/);
  // off in Settings, or in Super Simple: the set card, as before
  app.run(`S.restTimer={end:Date.now()+60000,total:60};S.swipeRest=false;renderSwipe(document.getElementById('content'))`); assert.doesNotMatch(content(app), /id="sw-rest"/);
  app.run(`S.swipeRest=true;S.activeWorkout._swipe='super';renderSwipe(document.getElementById('content'))`); assert.doesNotMatch(content(app), /id="sw-rest"/);
});

test('timed sets run themselves: Start, 3-2-1, the hold, logged at the plan; Stop early logs what you held', () => {
  const app = blank();
  live(app, ['plank'], { timed: true, r: '45' });
  app.run(`S.swipeRest=false;renderSwipe(document.getElementById('content'))`);
  assert.match(content(app), /holdStart\(\)[^>]*>.*Start · 45 s/);
  app.run('holdStart()');
  assert.match(content(app), /id="sw-hold-t">3</); assert.match(content(app), /Get set/);
  assert.equal(app.json('_sw.hold.total'), 45);
  app.run('holdDone(45)');
  assert.deepEqual(app.json('[S.activeWorkout.exercises[0].sets[0].done,S.activeWorkout.exercises[0].sets[0].r,!!S.activeWorkout.exercises[0].sets[0].fail]'), [true, '45', false]);
  assert.equal(app.json('_sw.hold'), null);
  // the second set, stopped at 20 s of 45: logged, as missed
  app.run(`holdStart();_sw.hold.go=Date.now()-20000;holdFinish()`);
  assert.deepEqual(app.json('[S.activeWorkout.exercises[0].sets[1].done,S.activeWorkout.exercises[0].sets[1].r,!!S.activeWorkout.exercises[0].sets[1].fail]'), [true, '20', true]);
  // off in Settings: no Start button
  const off = blank({ swipeHold: false }); live(off, ['plank'], { timed: true, r: '45' });
  off.run(`renderSwipe(document.getElementById('content'))`); assert.doesNotMatch(content(off), /holdStart/);
  // no seconds planned: nothing to start, so no button
  const none = blank(); live(none, ['plank'], { timed: true, r: '' });
  none.run(`S.activeWorkout.exercises[0].sets.forEach(s=>{s.r=''});renderSwipe(document.getElementById('content'))`); assert.doesNotMatch(content(none), /holdStart/);
});

// ─── Export ───
test('CSV export: every set, meal, weigh-in and activity; cells that would run as formulas are made text', async () => {
  const app = blank();
  app.run(`S.workouts=[{id:'a',name:'Push, heavy',started:${at('2026-10-14', 7)},exercises:[{exId:'bb-bench',sets:[{w:'95',r:'5',done:true,warmup:true},{w:'185',r:'5',done:true,rir:2},{w:'185',r:'3',done:true,fail:true}]}]}];
    S.meals=[{id:'m',date:'2026-10-14',type:'Lunch',items:[{name:'=HYPERLINK("x")'}],cals:600,protein:40,carbs:50,fat:20}];
    S.bodyweightLog=[{date:'2026-10-14',weight:181.2}];S.activities=[{id:'r',type:'run',date:'2026-10-13',dur:'30',dist:'3.1',cals:350}]`);
  const f = app.json('csvFiles().map(f=>[f.name,f.rows.length])');
  assert.deepEqual(f, [['Workouts (sets).csv', 4], ['Meals.csv', 2], ['Weigh-ins.csv', 2], ['Activities.csv', 2]]);
  const sets = app.json('csvFiles()[0].rows');
  assert.deepEqual(sets[1].slice(0, 6), ['2026-10-14', '07:00', 'Push, heavy', 'Barbell Bench Press', 'W1', 'yes']);
  assert.deepEqual([sets[2][4], sets[2][10], sets[2][12], sets[3][9]], [1, 2, 216, 'yes']);
  const text = app.run('csvText(csvFiles()[1].rows)');
  assert.match(text, /"'=HYPERLINK\(""x""\)"/);
  assert.match(app.run('csvText(csvFiles()[0].rows)'), /"Push, heavy"/);
  // the zip opens with the four files inside
  const entries = await app.run(`(async()=>{const enc=new TextEncoder();const b=zipStore(csvFiles().map(f=>({name:'X/'+f.name,data:enc.encode(csvText(f.rows))})));return(await zipIndex(b)).map(e=>e.name);})()`);
  assert.deepEqual(Array.from(entries), ['X/Workouts (sets).csv', 'X/Meals.csv', 'X/Weigh-ins.csv', 'X/Activities.csv']);
});
