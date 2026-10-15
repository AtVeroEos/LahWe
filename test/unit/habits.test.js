'use strict';
// Habits, mood, the daily check-in, the calendar's views, and what Patterns and the coach do with them.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-10-14T08:00:00'; // a Wednesday morning
const D = n => { const d = new Date(NOW); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const app0 = over => { const app = loadApp({ now: NOW }); app.state(over || {}); return app; };
const hab = o => Object.assign({ id: 'h', name: 'Read', type: 'done', days: [0, 1, 2, 3, 4, 5, 6], from: D(60) }, o);
const day = (app, id, n) => app.json(`habitDay(habitById(${JSON.stringify(id)}),${JSON.stringify(D(n))})`);
const overlay = (app, code) => app.run(`(()=>{window.__ovs=[];document.body.appendChild=e=>{__ovs.push(e);return e};${code};const o=__ovs[__ovs.length-1];return o?o.innerHTML:'';})()`);

test('stored habits are cleaned on the way in; logs keep only known habits and real values', () => {
  const app = app0({
    habits: [hab({ id: 'a"b<c', name: '  Read   10 pages ' }), { name: 'x', type: 'amount', target: 'abc' }, { type: 'auto', auto: 'nope' }, { name: '' }, hab({ id: 's', type: 'auto', auto: 'sleep', target: 8 })],
    habitLog: { [D(1)]: { abc: 1, ghost: 1 }, bad: { abc: 1 } }, moodLog: { [D(1)]: 4, [D(2)]: 9, nope: 3 },
  });
  const h = app.json('S.habits');
  assert.deepEqual(h.map(x => [x.id, x.name, x.type]), [['abc', 'Read 10 pages', 'done'], [h[1].id, 'x', 'amount'], ['s', 'Slept 8 h+', 'auto']]);
  assert.equal(h[1].target, 1, 'an amount without a usable target falls back to 1, not NaN');
  assert.deepEqual(app.json('S.habitLog'), { [D(1)]: { abc: 1 } });
  assert.deepEqual(app.json('S.moodLog'), { [D(1)]: 4 });
  assert.equal(app.json('normalizeState(JSON.parse(JSON.stringify(S))).habits.length'), 3, 'a backup round-trips');
});

test('a day with nothing logged is blank, not a miss — and an avoid habit is not "kept" on it', () => {
  const app = app0({ habits: [hab({ id: 'r' }), hab({ id: 'n', name: 'No alcohol', type: 'avoid' })] });
  assert.equal(day(app, 'r', 3).st, 'blank'); assert.equal(day(app, 'n', 3).st, 'blank');
  app.run(`S.bodyweightLog=[{date:${JSON.stringify(D(3))},weight:180}];bumpMemo()`);
  assert.equal(day(app, 'r', 3).st, 'miss', 'once anything is logged that day, an unticked habit is a miss');
  assert.equal(day(app, 'n', 3).st, 'done', 'and an avoid habit with no slip is kept');
  app.run(`habitToggle('n',${JSON.stringify(D(3))})`);
  assert.deepEqual([day(app, 'n', 3).st, day(app, 'n', 3).slip], ['miss', true]);
  assert.equal(day(app, 'r', 0).st, 'open', 'today is open, never a miss');
  assert.equal(app.json(`habitOkToday(habitById('n'))`), true, 'an avoid habit counts as kept today until a slip is marked');
});

test('schedules: weekdays, weekends and picked days; a day not due is off and counts for nothing', () => {
  const app = app0({ habits: [hab({ id: 'church', name: 'Church', days: [0] }), hab({ id: 'wk', days: [1, 2, 3, 4, 5] })] });
  // 2026-10-11 is a Sunday (3 days before the Wednesday)
  assert.equal(day(app, 'church', 3).st === 'off', false); assert.equal(day(app, 'church', 2).st, 'off');
  assert.equal(day(app, 'wk', 3).st, 'off'); assert.equal(app.json(`habitSchedText(habitById('wk'))`), 'Weekdays');
  assert.equal(app.json(`habitSchedText(habitById('church'))`), 'Sun');
  assert.equal(day(app, 'church', 70).st, 'off', 'before the habit existed');
});

test('streaks forgive one miss, end on two in a row; strength fades slowly', () => {
  const app = app0({ habits: [hab({ id: 'r', from: D(20) })] });
  const log = {}; for (let i = 20; i >= 1; i--) { log[D(i)] = { r: 1 }; } // 20 days kept
  log[D(5)] = { other: 1 }; delete log[D(5)].other; log[D(5)] = {}; // one miss five days ago
  const moods = {}; for (let i = 20; i >= 1; i--) moods[D(i)] = 3; // every day has something logged
  app.run(`S.habitLog=${JSON.stringify(log)};S.moodLog=${JSON.stringify(moods)};S.habitLog=normalizeHabitLog(S.habitLog,S.habits);bumpMemo()`);
  let st = app.json(`habitStats(habitById('r'))`);
  assert.equal(st.streak, 19, 'one miss does not end it'); assert.equal(st.best, 19); assert.ok(st.strength > 60 && st.strength < 75, 'about 70 after 20 days: ' + st.strength);
  app.run(`delete S.habitLog[${JSON.stringify(D(1))}];delete S.habitLog[${JSON.stringify(D(2))}];bumpMemo()`);
  st = app.json(`habitStats(habitById('r'))`);
  assert.equal(st.streak, 0, 'two scheduled misses in a row end it'); assert.equal(st.best, 17);
  app.run(`delete S.habitLog[${JSON.stringify(D(2))}];S.habitLog[${JSON.stringify(D(2))}]={r:1};bumpMemo()`);
  st = app.json(`habitStats(habitById('r'))`);
  assert.equal(st.atRisk, true, 'missed yesterday: at risk'); assert.ok(st.streak > 0);
});

test('amount habits are done at the target; auto habits read the log and need data to be judged', () => {
  const app = app0({ habits: [hab({ id: 'w', name: 'Water', type: 'amount', target: 100, unit: 'oz' }), hab({ id: 'p', type: 'auto', auto: 'protein' }), hab({ id: 't', type: 'auto', auto: 'trained' })], macroGoals: { cals: 2000, protein: 150, carbs: 200, fat: 60 } });
  app.run(`habitAmountSet('w',today(),60)`); assert.deepEqual([day(app, 'w', 0).st, day(app, 'w', 0).frac], ['open', 0.6]);
  app.run(`habitAmountAdd('w',today(),habitStep(habitById('w')))`); assert.equal(day(app, 'w', 0).v, 85, 'the + step is a quarter of the target');
  app.run(`habitAmountSet('w',today(),100)`); assert.equal(day(app, 'w', 0).st, 'done');
  assert.equal(day(app, 'p', 2).st, 'blank', 'no food logged: the app cannot say whether protein was hit');
  app.run(`S.macroLogs[${JSON.stringify(D(2))}]={cals:2000,protein:160,carbs:200,fat:60};S.macroLogs[${JSON.stringify(D(3))}]={cals:2000,protein:90,carbs:200,fat:60};bumpMemo()`);
  assert.equal(day(app, 'p', 2).st, 'done'); assert.equal(day(app, 'p', 3).st, 'miss');
  assert.equal(day(app, 't', 2).st, 'miss', 'trained is known every day');
  assert.equal(app.run(`habitToggle('p');S.habitLog[today()]&&S.habitLog[today()].p`), undefined, 'auto habits cannot be ticked by hand');
});

test('adding a habit: a name, a kind and days; the limit is enforced; autos start from their history', () => {
  const app = app0({ workouts: [{ id: 'w1', name: 'A', started: new Date(D(10) + 'T17:00:00').getTime(), ended: new Date(D(10) + 'T18:00:00').getTime(), exercises: [] }] });
  overlay(app, 'showAddHabit()');
  app.run(`document.getElementById=id=>id==='hadd-name'?{value:'  Church '}:null;habAddSched('pick');habAddDay(1);habAddDay(2);habAddDay(3);habAddDay(4);habAddDay(5);habAddDay(6);addHabit()`);
  assert.deepEqual(app.json('S.habits.map(h=>[h.name,h.days])'), [['Church', [0]]], 'every day but Sunday taken off leaves Sunday');
  app.run(`addAutoHabit('trained')`);
  assert.equal(app.json(`S.habits[1].from`), D(10), 'an auto habit starts from the first day the app has data for it');
  app.run(`for(let i=0;i<20;i++)habitCreate({name:'H'+i,type:'done'})`);
  assert.equal(app.json('activeHabits().length'), 12);
  assert.equal(app.run(`habitCreate({name:'one more'})`), null);
});

test('Home: a Habits tile once there are habits; it always opens the Habits page, and says when yesterday is unrated', () => {
  const app = app0({ name: 'K' });
  assert.ok(!app.json('homeAreas()').some(r => r.k === 'Habits' || r.k === 'Mood'));
  app.run(`S.habits=normalizeHabits(${JSON.stringify([hab({ id: 'r' }), hab({ id: 'c', days: [0] })])})`);
  let t = app.json('homeAreas()').find(r => r.k === 'Habits');
  assert.deepEqual([t.val, t.unit, t.js], ['0', '/ 1 today', "go('habits')"]); assert.match(t.sub, /Rate yesterday/);
  app.run(`setMood(daysAgoStr(1),4);habitToggle('r')`);
  t = app.json('homeAreas()').find(r => r.k === 'Habits');
  assert.deepEqual([t.val, t.js, t.tone], ['1', "go('habits')", 'good']);
  app.run(`S.trackMood=false;S.moodLog={}`);
  assert.equal(app.json('homeAreas()').find(r => r.k === 'Habits').js, "go('habits')", 'mood off: no nagging');
});

test('the daily check-in: weight optional, yesterday’s mood, yesterday’s habits; done with any one of them', () => {
  const app = app0({ habits: [hab({ id: 'r' }), hab({ id: 'n', name: 'No alcohol', type: 'avoid' }), hab({ id: 'c', name: 'Church', days: [0] })] });
  const h = overlay(app, 'showWeighIn()');
  assert.match(h, /Daily check-in/); assert.match(h, /id="ci-more"/);
  app.run(`(()=>{const el={innerHTML:''};const g=document.getElementById;document.getElementById=id=>id==='ci-more'?el:g(id);renderCheckInBody();window.__ci=el.innerHTML;document.getElementById=g;})()`);
  const ci = app.run('__ci');
  assert.match(ci, /How was yesterday\?/); assert.match(ci, /setMood\(&quot;2026-10-13&quot;,4\)|setMood\("2026-10-13",4\)/);
  assert.match(ci, /Read/); assert.match(ci, /No alcohol/); assert.doesNotMatch(ci, /Church/, 'not due yesterday');
  app.run(`setMood(daysAgoStr(1),2);(()=>{const g=document.getElementById;document.getElementById=id=>id==='bw-quick'?{value:''}:g(id);saveWeighIn();document.getElementById=g;})()`);
  assert.equal(app.json('S.bodyweightLog.length'), 0); assert.equal(app.json('S.moodLog[daysAgoStr(1)]'), 2);
  app.run(`setMood(daysAgoStr(1),2)`); assert.equal(app.json('S.moodLog[daysAgoStr(1)]||null'), null, 'tapping the chosen mood again clears it');
  const plain = app0({ trackMood: false }); assert.match(overlay(plain, 'showWeighIn()'), />Daily check-in</, 'one name for the one daily sheet, even when it only asks for weight');
});

test('the calendar shows one view at a time, only views with data, and a summary for each', () => {
  const app = app0({ habits: [hab({ id: 'r' })], moodLog: { [D(1)]: 5, [D(2)]: 1, [D(3)]: 4 }, habitLog: { [D(1)]: { r: 1 }, [D(2)]: {} } });
  app.run(`S.calMonth=9;S.calYear=2026`);
  assert.deepEqual(app.json('calLensesShown().map(l=>l.id)'), ['all', 'mood', 'habits', 'training']);
  let h = app.run(`renderCalendar('plan')`);
  assert.match(h, /setCalLens\('mood','plan'\)/); assert.match(h, /calTap\('2026-10-05','plan'\)/);
  app.run(`setCalLens('mood','review')`); assert.equal(app.json('S.calLens'), 'mood');
  h = app.run(`renderCalendar('review')`);
  assert.match(h, /cal-cell cl cm m5/); assert.match(h, /Great/); assert.match(h, /<b>3\.3<\/b> average over 3 rated days/);
  assert.match(app.run(`(setCalLens('habits','review'),renderCalendar('review'))`), /ch-p/);
  assert.match(app.run(`renderCalendar('review')`), /kept · 1 of 3/, 'the rated days count: something was logged, so an unticked habit is a miss');
  app.run(`setCalLens('weight','review')`); assert.equal(app.json(`calLens('review')`), 'all', 'a view with no data falls back to everything');
  const dayHtml = app.run(`(()=>{const el={innerHTML:''};const g=document.getElementById;document.getElementById=id=>id==='calday-body'?el:g(id);_calDay=${JSON.stringify(D(1))};renderCalDay();document.getElementById=g;return el.innerHTML;})()`);
  assert.match(dayHtml, /Plan this day/); assert.match(dayHtml, /mood-c m5 on/); assert.match(dayHtml, /Read/);
});

test('Patterns: mood is measured against nearby days without the neighbours, so a next-day test is not biased by construction', () => {
  // mood alternates good, bad, good…; the habit is done on good days. Same day: real. Next day: the
  // habit day is followed by a bad day, a true negative. With neighbours in the baseline the same-day
  // effect would be inflated; leaving them out keeps both honest.
  const app = app0();
  const log = {}, mood = {};
  for (let i = 80; i >= 1; i--) { const good = i % 2 === 0; mood[D(i)] = good ? 4 : 3; log[D(i)] = good ? { r: 1 } : {}; }
  app.run(`S.habits=normalizeHabits(${JSON.stringify([hab({ id: 'r', from: D(80) })])});S.moodLog=normalizeMoodLog(${JSON.stringify(mood)});S.habitLog=normalizeHabitLog(${JSON.stringify(log)},S.habits);bumpMemo()`);
  const r = app.json(`(()=>{const p=patterns();const g=id=>{const x=patById(id);return[+x.e.eff.toFixed(2),x.tier];};return{same:g('hm:r'),next:g('hmy:r'),even:patById('m-even').tier}})()`);
  // the baseline (days 2-10 away) mixes both kinds of day, so a full point shows as 0.89 either way
  assert.equal(r.same[0], 0.89); assert.ok(['solid', 'likely'].includes(r.same[1]));
  assert.equal(r.next[0], -0.89, 'the day after is the bad day, and it says so: same size, not shrunk or inflated by the neighbours');
  assert.equal(r.even, 'none', 'the placebo finds nothing');
  assert.equal(app.json(`patById('hm:r').t`), 'Your mood runs 0.9 points higher on days you do “Read”');
  const rev = app.json(`patReverse(patById('hmy:r').test)`); assert.equal(+rev.eff.toFixed(2), -0.89);
});

test('Patterns: a habit of the day before is tested against lifts and the morning weigh-in, ids and names stay data', () => {
  const app = app0({ habits: [hab({ id: 'r', name: 'Read "a" <b>' }), hab({ id: 'p', type: 'auto', auto: 'protein' })] });
  const ids = app.json('patCatalog(patData()).map(t=>t.id)');
  for (const id of ['hm:r', 'hmy:r', 'hl:r', 'hw:r', 'm-train', 'm-sleep', 'm-even']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('hl:p') && ids.includes('hm:p') === false, 'auto protein repeats m-prot, so it is not tested twice');
});

test('the coach reads habits and mood with the pattern results, and proposes a habit as a card', () => {
  const app = app0({ habits: [hab({ id: 'r' })], moodLog: { [D(1)]: 4 } });
  const run = (n, a) => app.json(`coachRunTool({name:${JSON.stringify(n)},args:${JSON.stringify(a || {})}})`);
  const r = run('get_habits_and_mood').out;
  assert.equal(r.habits[0].name, 'Read'); assert.deepEqual(r.mood.ratings, [{ date: D(1), mood: 4 }]); assert.ok(Array.isArray(r.patterns.needs_more_days));
  const p = run('propose_habit', { kind: 'amount', name: 'Water', target: 100, unit: 'oz', days: ['Mon', 'Wed'], reason: 'x' });
  assert.equal(p.out.applied, false); assert.equal(p.ui.kind, 'propose_habit'); assert.match(p.ui.lines[0], /Reach 100 oz a day · Mon Wed/);
  assert.equal(app.json('S.habits.length'), 1, 'nothing changes until the tap');
  const done = app.json(`coachApplyProposal('propose_habit',${JSON.stringify({ kind: 'amount', name: 'Water', target: 100, unit: 'oz', days: ['Mon', 'Wed'] })})`);
  assert.equal(done.ok, true); assert.equal(app.json('S.habits[1].days.join()'), '1,3');
  assert.match(run('propose_habit', { kind: 'done', name: 'read', reason: 'x' }).out.error, /already exists/);
  assert.match(run('propose_habit', { kind: 'amount', name: 'X', reason: 'x' }).out.error, /daily target/);
  assert.match(app.run('coachSystemPrompt()'), /Never claim that two things go together/);
  assert.ok(app.json('COACH_STARTERS.map(s=>s.id)').includes('habits'));
});

test('weekly check-in lists habits kept and the mood average against the week before', () => {
  const app = app0({ habits: [hab({ id: 'r' })] });
  const log = {}, mood = {}; for (let i = 1; i <= 14; i++) { mood[D(i)] = i <= 7 ? 4 : 3; if (i <= 7 || i % 2) log[D(i)] = { r: 1 }; }
  app.run(`S.moodLog=normalizeMoodLog(${JSON.stringify(mood)});S.habitLog=normalizeHabitLog(${JSON.stringify(log)},S.habits);bumpMemo()`);
  const rv = app.json('weekReview()');
  assert.deepEqual([rv.habits.cur, rv.habits.prev], [100, 43]);
  const titles = rv.points.map(p => p.title);
  assert.ok(titles.includes('Habits kept: 100%')); assert.ok(titles.includes('Mood averaged 4.0 of 5'));
});

test('a habit added from the Habits page is on the page while its sheet is still closing', () => {
  const app = app0({ name: 'K' });
  app.run(`go('habits');addAutoHabit('trained')`);
  assert.match(app.run(`document.getElementById('content').innerHTML`), /hab-row/, 'the page under the sheet was redrawn');
});

test('pull down to Home: on Home’s own pages and on a tab a Home tile opened, never from the tab bar or mid-workout', () => {
  const app = app0({ name: 'K' });
  const on = () => app.run('pullHomeOn()');
  app.run(`go('workout')`); assert.equal(on(), false, 'Home itself');
  app.run(`go('habits')`); assert.equal(on(), true); app.run(`go('schedule')`); assert.equal(on(), true);
  app.run(`homeGo('nutrition')`); assert.equal(on(), true); assert.equal(app.run('S.tab'), 'nutrition');
  app.run(`go('progress');go('nutrition')`); assert.equal(on(), false, 'reached from the tab bar');
  app.run(`homeGo('history')`); assert.equal(on(), true, 'the sessions milestone opens History, a view of Progress');
  app.run(`go('habits');S.activeWorkout={id:'w',name:'x',started:Date.now(),exercises:[]}`); assert.equal(on(), false);
  const home = app.json(`homeAreas().filter(a=>/go\\(/.test(a.js)).map(a=>a.js)`);
  assert.ok(home.every(js => !/go\('(nutrition|history|library)'\)/.test(js) || /homeGo/.test(js)), 'Home tiles that leave Home go through homeGo: ' + home);
});

test('on Progress, the Habits tile opens the habits themselves, and the month is a tile of its own', () => {
  const app = app0({ habits: [hab({ id: 'r' })], moodLog: { [D(1)]: 4 } });
  app.run(`window.__ovs=[];document.body.appendChild=e=>{__ovs.push(e);return e};const g=document.getElementById;document.getElementById=id=>(__ovs.find(o=>o.id===id)&&id==='habs-ov')?__ovs.find(o=>o.id===id):g(id)`);
  app.run(`openTile('habits')`);
  assert.equal(app.run('__ovs[0].id'), 'habs-ov', 'not the calendar');
  const html = app.run(`habitsBodyHTML()`); assert.match(html, /hab-row/); assert.match(html, /How was yesterday|Last 14 days/);
  const t = app.json(`METRICS.calfull.tile(boardRange(),{k:'calfull'})`);
  assert.match(t.html, /cal-grid/); assert.match(t.html, /setCalLens\(/);
  app.run(`go('progress');boardSet([{k:'calfull'},{k:'habits'}]);go('progress')`);
  assert.match(app.run(`document.getElementById('content').innerHTML`), /tile tile-wide tile-cal[\s\S]*cal-grid/);
});
