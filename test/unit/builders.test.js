'use strict';
// The builders: programs, quick workouts, why a lift has stalled, targets and meal plans, answered by
// the app itself with no AI, and the Coach tab that offers them without a key.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const KEY = 'sk-' + 'ant-' + 'api03-' + 'B'.repeat(40); // assembled at run time; not a real key
const at = iso => new Date(iso).getTime();
const S_ = (w, r, o) => Object.assign({ w: String(w), r: String(r), done: true }, o || {});

// Ten weeks of push / pull / legs. Bench is stuck at 225 × 5 with missed reps late on; most else climbs.
// "Now" is Monday 15 June 2026, 12:00.
function lifter(over) {
  const app = loadApp();
  const wk = []; let id = 0;
  for (let d = 70; d >= 1; d--) {
    const day = new Date(at('2026-06-15T18:00:00') - d * 86400000); const dow = day.getDay(); const n = 70 - d;
    if (dow === 1) wk.push({ id: 'w' + (id++), name: 'Push', routineId: 'rP', started: day.getTime(), ended: day.getTime() + 55 * 60000, cals: 300, exercises: [
      { exId: 'bb-bench', sets: [S_(225, 5), S_(225, 5), S_(225, n > 40 ? 4 : 5)] }, { exId: 'ohp', sets: [S_(115 + Math.floor(n / 14) * 5, 8), S_(115 + Math.floor(n / 14) * 5, 8)] },
      { exId: 'lat-raise', sets: [S_(20 + Math.floor(n / 14) * 2.5, 12)] }, { exId: 'tri-pd', sets: [S_(60 + Math.floor(n / 14) * 5, 12)] }] });
    if (dow === 3) wk.push({ id: 'w' + (id++), name: 'Pull', routineId: 'rL', started: day.getTime(), ended: day.getTime() + 50 * 60000, cals: 280, exercises: [
      { exId: 'pullup', sets: [S_(0, 8 + Math.floor(n / 20)), S_(0, 8)] }, { exId: 'bb-row', sets: [S_(155 + Math.floor(n / 10) * 5, 8)] }, { exId: 'db-curl', sets: [S_(30 + Math.floor(n / 14) * 2.5, 10)] }] });
    if (dow === 5) wk.push({ id: 'w' + (id++), name: 'Legs', routineId: 'rG', started: day.getTime(), ended: day.getTime() + 60 * 60000, cals: 350, exercises: [
      { exId: 'squat', sets: [S_(275 + Math.floor(n / 7) * 5, 5), S_(275, 5)] }, { exId: 'rdl', sets: [S_(225 + Math.floor(n / 7) * 5, 8)] }, { exId: 'calf-raise', sets: [S_(150 + Math.floor(n / 7) * 5, 12)] }] });
  }
  wk.sort((a, b) => b.started - a.started);
  app.state(Object.assign({
    unit: 'lbs', bodyweight: 190, height: 70, goal: 'recomp', birthYear: 1994, aftGender: 'male',
    macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 }, workouts: wk,
    routines: [{ id: 'rP', name: 'Push', notes: '', days: [], exercises: [{ exId: 'bb-bench', sets: 3, w: '', r: '5', type: 'flat', rest: 180 }, { exId: 'ohp', sets: 2, w: '', r: '8', type: 'flat', rest: 120 }] },
      { id: 'rL', name: 'Pull', notes: '', days: [], exercises: [{ exId: 'pullup', sets: 2, w: '', r: '8', type: 'flat' }] },
      { id: 'rG', name: 'Legs', notes: '', days: [], exercises: [{ exId: 'squat', sets: 2, w: '', r: '5', type: 'flat' }] }],
    bodyweightLog: [{ date: '2026-06-14', weight: 190 }, { date: '2026-06-07', weight: 190.4 }, { date: '2026-05-31', weight: 190.6 }, { date: '2026-05-24', weight: 191 }],
  }, over || {}));
  return app;
}
const prog = (app, a) => { app.set('__a', a); return app.json('bldProgram(__a)'); };
const ex = id => id; // readability in assertions

// ─── Programs ───
test('every split builds inside its time, with real exercises, no repeats in a day, and main lifts that can carry a session', () => {
  const app = lifter();
  for (const days of [2, 3, 4, 5, 6]) for (const minutes of [30, 45, 60, 90]) {
    const p = prog(app, { days, minutes, aim: 'muscle', mix: 'mix' });
    assert.equal(p.days.length, days);
    p.days.forEach(d => {
      assert.ok(d.ex.length >= 2, `${days}d ${minutes}m ${d.name}: ${d.ex.length} lifts`);
      assert.ok(app.run(`bldEstMin(${JSON.stringify(d.ex)})`) <= minutes + 2, `${days}d ${minutes}m ${d.name} runs ${d.min} min`);
      assert.equal(new Set(d.ex.map(e => e.exId)).size, d.ex.length, `${d.name}: a lift twice in one day`);
      d.ex.forEach(e => { assert.ok(app.run(`!!getEx(${JSON.stringify(e.exId)})`), e.exId); if (e.role === 'main') assert.ok(app.run(`BLD_MAIN.has(${JSON.stringify(e.exId)})`), `${e.name} as a main lift`); });
      const n = {}; d.ex.forEach(e => { if (e.link) n[e.link] = (n[e.link] || 0) + 1; });
      Object.values(n).forEach(c => assert.ok(c >= 2, `${d.name}: a superset of one`));
    });
  }
});
test('the exact movement beats a familiar near-miss: a fly slot never gets a bench press', () => {
  const app = lifter();
  const p = prog(app, { days: 6, minutes: 75, aim: 'muscle', mix: 'familiar' });
  p.days.forEach(d => d.ex.filter(e => e.slot === 'fly').forEach(e => assert.equal(app.run(`exPattern(getEx(${JSON.stringify(e.exId)}))`), 'fly', `${d.name}: ${e.name} in the fly slot`)));
});
test('equipment, things to avoid and pain tags are respected; kept lifts always go in', () => {
  const app = lifter();
  const db = prog(app, { days: 3, minutes: 60, eq: 'dumbbells' });
  db.days.forEach(d => d.ex.forEach(e => assert.ok(['Dumbbell', 'Bodyweight'].includes(app.run(`getEx(${JSON.stringify(e.exId)}).eq`)), `${e.name} with dumbbells only`)));
  const back = prog(app, { days: 4, minutes: 60, avoid: ['back'], keep: ['face-pull', 'hammer-curl'] });
  back.days.forEach(d => d.ex.forEach(e => assert.ok(!['hinge', 'back-ext'].includes(app.run(`exPattern(getEx(${JSON.stringify(e.exId)}))`)) && !['bb-row', 'squat'].includes(e.exId), `${e.name} with a bad back`)));
  const all = back.days.flatMap(d => d.ex);
  ['face-pull', 'hammer-curl'].forEach(id => assert.ok(all.some(e => e.exId === id && e.pinned), id + ' kept'));
  // Pain tagged twice in the last three sessions: left out, and the matching thing to avoid is suggested.
  app.run(`S.workouts.filter(w=>w.name==='Push').slice(0,2).forEach(w=>w.exercises.find(e=>e.exId==='ohp').sets[0].tag='Pain');bumpMemo()`);
  assert.ok(!prog(app, { days: 4, minutes: 60 }).days.some(d => d.ex.some(e => e.exId === 'ohp')), 'a lift that hurts is left out');
  assert.ok(app.json('bldPainAvoid()').includes('overhead'));
});
test('muscles you ask for get the most weekly sets; with room, every major muscle reaches its minimum', () => {
  const app = lifter();
  const p = prog(app, { days: 4, minutes: 75, aim: 'muscle', emph: ['Side Delts', 'Biceps'] });
  const mm = app.json('MEV_MAV');
  assert.ok(p.weekly['Side Delts'] >= mm['Side Delts'].mev + 0.5 * (mm['Side Delts'].mav - mm['Side Delts'].mev), 'side delts ' + p.weekly['Side Delts']);
  assert.ok(p.weekly.Biceps >= mm.Biceps.mev + 0.5 * (mm.Biceps.mav - mm.Biceps.mev), 'biceps ' + p.weekly.Biceps);
  app.json('BLD_MAJOR').forEach(m => assert.ok(p.weekly[m] >= mm[m].mev, `${m} ${p.weekly[m]} under ${mm[m].mev}`));
  assert.ok(!p.notes.some(n => /weekly minimum/.test(n)));
  // Too little time: it says so instead of pretending.
  assert.ok(prog(app, { days: 2, minutes: 30 }).notes.some(n => /cannot reach the weekly minimum/.test(n)));
});
test('familiar leans on your history, new on what you have not done; the same answers give the same program and a shuffle changes it', () => {
  const app = lifter();
  const done = new Set(app.json('Object.keys(exUsage())'));
  const share = p => { const all = p.days.flatMap(d => d.ex); return all.filter(e => done.has(e.exId)).length / all.length; };
  const fam = prog(app, { days: 4, minutes: 60, mix: 'familiar' }), nw = prog(app, { days: 4, minutes: 60, mix: 'new' });
  assert.ok(share(fam) > share(nw) + 0.3, `familiar ${share(fam)} vs new ${share(nw)}`);
  assert.deepEqual(prog(app, { days: 4, minutes: 60 }), prog(app, { days: 4, minutes: 60 }));
  const ids = p => p.days.flatMap(d => d.ex.map(e => e.exId)).join();
  assert.notEqual(ids(prog(app, { days: 4, minutes: 60, mix: 'mix', seed: 3 })), ids(prog(app, { days: 4, minutes: 60, mix: 'mix' })));
});
test('rep schemes fit the lift: no 3-rep goblet squats or push-ups, timed holds in seconds', () => {
  const app = lifter();
  const p = prog(app, { days: 3, minutes: 60, aim: 'strength', eq: 'dumbbells' });
  p.days.forEach(d => d.ex.forEach(e => {
    const heavy = app.run(`BLD_HEAVY.has(${JSON.stringify(e.exId)})`);
    if (!heavy && !e.timed && !e.dist && !e.amrap) assert.ok(e.r >= 5, `${e.name} at ${e.r} reps`);
  }));
  const aft = prog(app, { days: 3, minutes: 60, aim: 'aft' });
  const all = aft.days.flatMap(d => d.ex);
  assert.ok(all.some(e => e.slot === 'carry') && all.some(e => e.slot === 'cond'), 'the test events are in');
  assert.ok(aft.notes.some(n => /two-mile run/.test(n)));
  all.filter(e => e.timed).forEach(e => assert.ok(e.r >= 20 && e.r <= 60, `${e.name} ${e.r}s`));
});
test('saving goes through the import checks: a timed program with a deload, or a split put into use', () => {
  const app = lifter();
  app.set('__p', prog(app, { days: 4, minutes: 60, weeks: 8, deload: true }));
  const parsed = app.json('parseImport(bldProgramImport(__p))');
  assert.ok(!parsed.error); assert.equal(parsed.newExercises.length, 0, 'every lift matched by id'); assert.equal(parsed.routines.length, 4);
  app.run('commitImport(parseImport(bldProgramImport(__p)),{program:true,start:true})');
  const pr = app.json('S.programs[S.programs.length-1]');
  assert.equal(pr.status, 'running'); assert.equal(pr.phases[0].weeks, 8); assert.equal(pr.phases[0].deload, true);
  // A second one gets its own name rather than overwriting the first.
  app.set('__q', prog(app, { days: 4, minutes: 60, weeks: 0 }));
  const names = app.json('parseImport(bldProgramImport(__q)).routines.map(r=>r.name)');
  assert.ok(names.every(n => /^Upper\/Lower 2 - /.test(n)), names.join());
});
test('swapping a lift in a draft keeps its place and sets, and lists only what fits the answers', () => {
  const app = lifter();
  app.set('__p', prog(app, { days: 4, minutes: 60, eq: 'dumbbells' }));
  const list = app.json('bldSwapList(__p,0,0).map(c=>c.ex.eq)');
  assert.ok(list.length && list.every(e => ['Dumbbell', 'Bodyweight'].includes(e)));
  const to = app.json('bldSwapList(__p,0,0)[0].ex.id');
  const sets = app.json('__p.days[0].ex[0].sets');
  app.run(`bldReplace(__p,0,0,${JSON.stringify(to)})`);
  assert.equal(app.json('__p.days[0].ex[0].exId'), to); assert.equal(app.json('__p.days[0].ex[0].sets'), sets);
});

// ─── Quick workouts ───
test('a quick workout fits the time, picks a focus from recovery when asked, and starts as a live workout', () => {
  const app = lifter();
  for (const minutes of [20, 30, 45, 60]) {
    const q = app.json(`bldQuick({minutes:${minutes}})`);
    assert.ok(q.ex.length >= 3 && q.min <= minutes + 3, `${minutes} min → ${q.min} min, ${q.ex.length} lifts`);
    assert.match(q.why, /recovered|freshest/);
  }
  // A hard leg day yesterday: the automatic pick leaves legs alone today.
  app.run(`S.workouts.unshift({id:'yl',name:'Legs',started:${at('2026-06-14T17:00:00')},ended:${at('2026-06-14T18:00:00')},exercises:[{exId:'squat',sets:Array.from({length:6},()=>({w:'285',r:'5',done:true}))},{exId:'leg-press',sets:Array.from({length:5},()=>({w:'400',r:'10',done:true}))},{exId:'rdl',sets:Array.from({length:4},()=>({w:'245',r:'8',done:true}))}]});bumpMemo()`);
  const auto = app.json('bldQuick({minutes:45})');
  assert.ok(!/Lower|Full/.test(auto.name), auto.name);
  const both = app.json('bldQuick({minutes:45,focus:["upper","core"]})');
  assert.ok(both.ex.some(e => /core/.test(app.run(`exPattern(getEx(${JSON.stringify(e.exId)}))`))), 'core work is in');
  const cond = app.json('bldQuick({minutes:20,focus:["cond"]})');
  assert.ok(cond.ex.length >= 3 && cond.ex.every(e => e.link === 'A'), 'conditioning is one circuit');
  app.set('__q', app.json('bldQuick({minutes:30})'));
  assert.equal(app.run('startAdhocWorkout(parseImport(bldQuickImport(__q)))'), true);
  assert.equal(app.json('S.activeWorkout.exercises.length'), app.json('__q.ex.length'));
});

// ─── Why am I stuck ───
test('a stalled lift is explained from the log, food and sleep are said once, and every fix can be undone', () => {
  const app = lifter();
  // Too little protein and sleep across the board.
  app.run(`for(let i=1;i<=20;i++){const ds=daysAgoStr(i);S.meals.push({id:'m'+i,date:ds,type:'Lunch',items:[],protein:90,carbs:300,fat:80,cals:2300});S.sleepLog[ds]=6;}bumpMemo()`);
  const st = app.json('bldStalled()');
  assert.equal(st.stalled[0].exId, ex('bb-bench'), 'the main lift comes first');
  assert.ok(!st.stalled.some(m => m.exId === 'squat') && st.moving.length, 'a climbing lift is not called stalled');
  const body = app.json('bldBodyFindings()');
  assert.ok(body.some(f => /Protein 90 g/.test(f.t)) && body.some(f => /Sleep 6 h/.test(f.t)));
  const d = app.json(`bldDiagnose(bldStalled().stalled[0],bldBodyFindings())`);
  assert.ok(d.findings.some(f => /came up short of 5 reps/.test(f.t)), JSON.stringify(d.findings));
  assert.ok(!d.findings.some(f => /Protein|Sleep/.test(f.t)), 'body-wide findings are not repeated per lift');
  assert.ok(d.fixes.includes('backoff'));
  // Back off: next bench is about 10% lighter, then undone.
  app.run('window.__u=bldFixBackoff("bb-bench")');
  assert.equal(app.json('S.nextTargets.rP.items["bb-bench"].w'), 200);
  app.run('window.__u()'); assert.equal(app.json('S.nextTargets.rP||null'), null);
  // One more set, then undone; a swap in every workout with it, logged as your pick, then undone.
  app.run('window.__u=bldFixSets("bb-bench",1)'); assert.equal(app.json('S.routines[0].exercises[0].sets'), 4); app.run('window.__u()'); assert.equal(app.json('S.routines[0].exercises[0].sets'), 3);
  app.run('window.__u=bldFixSwap("bb-bench","db-bench")'); assert.equal(app.json('S.routines[0].exercises[0].exId'), 'db-bench'); assert.equal(app.json('S.swapLog["bb-bench"]["db-bench"]'), 1);
  app.run('window.__u()'); assert.equal(app.json('S.routines[0].exercises[0].exId'), 'bb-bench');
  // A stalled lift that is in no workout gets findings but no buttons.
  app.run('S.routines[0].exercises=S.routines[0].exercises.filter(e=>e.exId!=="bb-bench")');
  assert.deepEqual(app.json(`bldDiagnose(bldStalled().stalled[0],[]).fixes`), []);
});
test('with almost no history, nothing is called stalled', () => {
  const app = loadApp(); app.state({});
  const st = app.json('bldStalled()');
  assert.deepEqual([st.stalled.length, st.enough], [0, 0]);
});

// ─── Targets ───
test('targets follow the goal, never go under the floor, and the macros add up exactly', () => {
  const app = lifter();
  const base = app.json('bldTargets("maintain")');
  for (const dir of ['lose', 'maintain', 'gain']) {
    const t = app.json(`bldTargets(${JSON.stringify(dir)})`);
    assert.equal(t.kcal, t.protein * 4 + t.carbs * 4 + t.fat * 9, dir);
    assert.ok(t.kcal >= app.run('calorieFloor()'));
    if (dir === 'lose') { assert.ok(t.kcal < base.kcal - 250); assert.equal(t.protein, 190); }
    if (dir === 'gain') assert.ok(t.kcal > base.kcal + 150);
  }
  app.run('window.__u=bldApplyTargets(bldTargets("lose"))');
  assert.equal(app.json('S.weightGoalDir'), 'lose'); assert.equal(app.json('S.macroGoals.protein'), 190);
  app.run('window.__u()'); assert.equal(app.json('S.macroGoals.cals'), 2400);
});
test('a food log that averages under resting burn is not trusted as maintenance', () => {
  const app = lifter();
  app.run(`for(let i=1;i<=27;i++)S.meals.push({id:'q'+i,date:daysAgoStr(i),type:'Lunch',items:[],protein:30,carbs:40,fat:10,cals:400});bumpMemo()`);
  const t = app.json('bldTargets("maintain")');
  assert.equal(t.src, 'formula'); assert.match(t.why[0], /some meals are not logged/);
  assert.ok(t.base > 1800);
});

// ─── Meal plans ───
test('with an empty log the week is built from staples and every day lands on its targets', () => {
  const app = loadApp(); app.state({ macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 } });
  const p = app.json('bldMealPlan({meals:4,variety:"daily"})');
  assert.equal(p.sources.log + p.sources.saved, 0); assert.ok(p.notes.some(n => /basic staples/.test(n)));
  p.report.forEach(r => { assert.equal(r.ok, true, `day ${r.dow}: ${r.tot.cals} kcal, ${r.tot.protein} g`); });
  Object.values(p.days).flat().forEach(m => m.items.forEach(i => assert.ok(i.qty <= 3, `${i.qty} × ${i.name}`)));
});
test('meals you log are what the plan is made of; "same every day" repeats one day; a fast day stays empty', () => {
  const app = lifter();
  app.run(`for(let i=1;i<=20;i++){const ds=daysAgoStr(i);
    S.meals.push({id:'b'+i,date:ds,type:'Breakfast',items:[{foodId:'qf_oatmeal',name:'Oatmeal',qty:1,serving:'½ cup dry',protein:5,carbs:27,fat:3,cals:150},{foodId:'qf_whey',name:'Whey',qty:1,serving:'1 scoop',protein:24,carbs:3,fat:1.5,cals:120}],protein:29,carbs:30,fat:4.5,cals:270});
    S.meals.push({id:'d'+i,date:ds,type:'Dinner',items:[{foodId:'qf_sirloin',name:'Sirloin',qty:2,serving:'4 oz',protein:52,carbs:0,fat:16,cals:360},{foodId:'qf_white_rice',name:'Rice',qty:1.5,serving:'1 cup',protein:6,carbs:67.5,fat:0.6,cals:309}],protein:58,carbs:67.5,fat:16.6,cals:669});}
    S.mealPlan.fast[0]='full';bumpMemo()`);
  const p = app.json('bldMealPlan({meals:3,variety:"repeat"})');
  assert.ok(p.sources.log >= 2);
  const mon = p.days[1];
  assert.ok(mon.some(m => m.type === 'Breakfast' && m.items.some(i => i.foodId === 'qf_oatmeal')) && mon.some(m => m.type === 'Dinner' && m.items.some(i => i.foodId === 'qf_sirloin')));
  const sig = d => JSON.stringify(p.days[d].map(m => m.items.map(i => [i.foodId, i.qty])));
  [2, 3, 4, 5, 6].forEach(d => assert.equal(sig(d), sig(1)));
  assert.deepEqual(p.days[0], []);
  app.set('__p', p); app.run('window.__u=bldApplyMealPlan(__p)');
  assert.equal(app.json('S.mealPlan.days[1].length'), mon.length); assert.equal(app.json('S.mealPlan.fast[0]'), 'full', 'fast days are kept');
  app.run('window.__u()'); assert.equal(app.json('planHasMeals()'), false);
});

// ─── The Coach tab and the AI ───
test('the builders open without a key and never call the AI; the AI-only asks still need it', () => {
  const app = lifter();
  const sent = []; app.mockFetch(r => { sent.push(r); return { body: {} }; });
  for (const [id, kind] of [['program', 'program'], ['quick', 'quick'], ['mealplan', 'meals'], ['stall', 'stall'], ['targets', 'targets'], ['habits', 'habits']]) {
    app.run(`window._bld=null;coachStart(${JSON.stringify(id)})`);
    assert.equal(app.run('window._bld&&window._bld.kind'), kind, id);
  }
  app.run('bldBuild&&window._bld&&(window._bld.kind="program",window._bld.ans=Object.assign({days:3,minutes:45,aim:"general",emph:[],avoid:[],keep:[],mix:"mix",weeks:0,deload:false,eq:"usual",seed:0}),bldBuild())');
  assert.equal(sent.length, 0, 'nothing was sent anywhere');
  const html = app.run('coachSetupHTML()');
  assert.match(html, /Build a program/); assert.match(html, /Set up the coach/); assert.ok(!/Log a meal/.test(html), 'AI-only tiles are not shown without a key');
  assert.equal(app.run('bldAskHTML("program")'), '', 'no Ask coach box without a key');
  app.set('__k', KEY); app.run(`setAiKey('anthropic',__k)`);
  assert.match(app.run('coachStartersHTML(false)'), /With the AI coach[\s\S]*Log a meal/);
  assert.match(app.run('bldAskHTML("program")'), /Ask coach/);
});
test('"Ask coach" on a draft sends the draft as an app note, with the building tools loaded', async () => {
  const app = lifter();
  app.set('__k', KEY); app.run(`setAiKey('anthropic',__k)`);
  const reqs = app.mockFetch(() => ({ body: { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 2 } } }));
  app.run('showBuilder("program");bldBuild()');
  app.run(`(()=>{const g=document.getElementById;document.getElementById=id=>id==='bld-ask-in'?{value:'no barbell rows',blur(){}}:g(id);})()`);
  app.run('bldAsk()');
  for (let i = 0; i < 200 && app.run('Coach.busy'); i++) await new Promise(r => setImmediate(r));
  const body = reqs[0].body;
  const user = body.messages[0].content.map(c => c.text || '').join(' ');
  assert.match(user, /\[App note: Program draft \(not saved\)/); assert.match(user, /\[bb-bench\]|\[db-bench\]|\[inc-db-bench\]/); assert.match(user, /no barbell rows/);
  assert.ok(body.tools.some(t => t.name === 'propose_routines'), 'the build tools come with it');
});
