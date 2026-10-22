'use strict';
// Import from another app: each app's file, units, set types, matching, duplicates, rebuilt routines,
// the write, linking an imported exercise, and removing an import.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const F = require('../fixtures/app-import.js');

const fresh = over => { const app = loadApp({ now: '2026-10-08T09:00:00' }); app.state(Object.assign({ unit: 'lbs', bodyweight: 190 }, over || {})); return app; };
const read = (app, text, chosen, name) => app.json(`ixReadText(${JSON.stringify(text)},${JSON.stringify(chosen)},${JSON.stringify(name || 'export.csv')})`);
// Plan from files, keeping the plan and files on window for a later commit.
const plan = (app, files, ans) => {
  app.run(`window._f=[${files.map(([t, c]) => `ixReadText(${JSON.stringify(t)},${JSON.stringify(c)},'export.csv')`).join(',')}];window._p=ixPlan(_f,${JSON.stringify(ans || {})})`);
  return app.json(`({n:_p.sessions.length,sets:_p.sets,skip:_p.skip,needUnit:_p.needUnit,rirConv:_p.rirConv,from:_p.from,to:_p.to,
    routines:_p.routines.map(r=>({name:r.name,ex:r.exercises.map(e=>({exId:e.exId,newKey:e._newKey,sets:e.sets,r:e.r,rMax:e.rMax||'',w:e.w,timed:!!e.timed}))})),
    names:[..._p.names.values()].map(r=>({given:r.given,exId:r.exId||null,how:r.how})),
    newEx:[..._p.newEx.values()].map(n=>({name:n.name,muscle:n.muscle,eq:n.eq,kind:n.kind||''})),
    weights:_p.weights,measures:_p.measures,sample:_p.sample,notes:_p.notes,unitWarn:_p.unitWarn||'',
    wk:_p.sessions.map(w=>({name:w.name,started:w.started,ended:w.ended,noTime:!!w.noTime,src:w.src,notes:w.notes,ex:w.exercises.map(e=>({exId:e.exId,newKey:e._newKey,link:e.link,timed:!!e.timed,dist:!!e.dist,cardio:!!e.cardio,note:e.note,sets:e.sets}))}))})`);
};

test('CSV: the delimiter comes from the header line; quotes, doubled quotes and line breaks stay in one field', () => {
  const app = fresh();
  assert.equal(app.run(`ixDelim('"a";"b";"c"\\n1;2;3')`), ';');
  assert.equal(app.run(`ixDelim('a,b;c,d\\n')`), ',');
  assert.deepEqual(app.json(`ixCsv('a;"b; c";"say ""hi""\\nthere"\\r\\n1;2;3\\n')`), [['a', 'b; c', 'say "hi"\nthere'], ['1', '2', '3']]);
});

test('dates: the formats these apps write; an offset is honoured, a bare date has no time of day', () => {
  const app = fresh();
  const d = s => app.json(`ixDate(${JSON.stringify(s)})`);
  assert.deepEqual(d('2026-09-28 18:00:00'), { t: new Date(2026, 8, 28, 18, 0, 0).getTime(), noTime: false });
  assert.equal(d('2026-09-29 14:02:51 +0000').t, Date.UTC(2026, 8, 29, 14, 2, 51));
  assert.equal(d('2026-09-29T10:02:51-04:00').t, Date.UTC(2026, 8, 29, 14, 2, 51));
  assert.equal(d('30 Sep 2026, 19:56').t, new Date(2026, 8, 30, 19, 56).getTime());
  assert.equal(d('Sep 30, 2026, 7:56 PM').t, new Date(2026, 8, 30, 19, 56).getTime());
  assert.equal(d('1758996000').t, 1758996000 * 1000);
  assert.equal(d('2026-10-04').noTime, true);
  assert.equal(d('14/03/2026').t, new Date(2026, 2, 14, 12).getTime(), 'a day over 12 first means day first');
  assert.equal(d('Brumaire'), null);
  assert.equal(app.run(`ixDur('1h 5m')`), 3900);
  assert.equal(app.run(`ixDur('58m')`), 3480);
  assert.equal(app.run(`ixDur('1:02:03')`), 3723);
  assert.equal(app.run(`ixDur('3600')`), 3600);
});

test('which app wrote the file is found from its columns, whatever app was tapped', () => {
  const app = fresh();
  const det = t => app.json(`ixDetect(${JSON.stringify(t)})`);
  assert.deepEqual(det(F.STRONG), { app: 'strong', kind: 'workouts' });
  assert.deepEqual(det(F.STRONG6), { app: 'strong', kind: 'workouts' });
  assert.deepEqual(det(F.STRONG_MEAS), { app: 'strong', kind: 'measures' });
  assert.deepEqual(det(F.HEVY), { app: 'hevy', kind: 'workouts' });
  assert.equal(det(F.HEVY_MEAS).kind, 'measures');
  assert.deepEqual(det(F.FITBOD), { app: 'fitbod', kind: 'workouts' });
  assert.deepEqual(det(F.JEFIT), { app: 'jefit', kind: 'workouts' });
  assert.equal(det(F.ALPHA).kind, 'workouts', 'a date, exercise and weight file is workouts, not measurements');
  assert.equal(read(app, F.HEVY, 'strong').detected, 'hevy');
});

test('Strong: unit asked, warm-ups and drop sets, rest-timer rows skipped, holds timed, RPE becomes reps in reserve, a run becomes cardio', () => {
  const app = fresh();
  const P = plan(app, [[F.STRONG, 'strong']], { unit: 'lb' });
  assert.equal(P.needUnit, true, 'the comma file does not say kg or lb');
  assert.equal(P.n, 4);
  const w = P.wk.find(x => x.started === new Date(2026, 8, 28, 18).getTime());
  assert.equal(w.name, 'Push A');
  assert.equal(w.ended - w.started, 65 * 60000);
  assert.equal(w.notes, 'Felt strong');
  const bench = w.ex[0];
  assert.equal(bench.exId, 'bb-bench');
  assert.deepEqual(bench.sets.map(s => [s.w, s.r, s.warmup]), [['95', '10', true], ['185', '8', false], ['185', '7', false]], 'the rest-timer row is not a set');
  assert.deepEqual(bench.sets.map(s => s.rir), [undefined, 2, 1], 'RPE 8 → 2 in reserve, RPE 9 → 1; warm-ups get none');
  assert.equal(P.rirConv, true);
  assert.equal(w.ex[1].exId, 'ohp'); assert.equal(w.ex[1].note, 'grip, a bit wider');
  const plank = w.ex.find(e => e.exId === 'plank');
  assert.equal(plank.timed, true); assert.equal(plank.sets[0].r, '60');
  assert.equal(w.ex.find(e => e.newKey).newKey, app.run(`exNameKey('Cable Crossover Hold Thing (Cable)')`), 'an unknown lift becomes a new exercise');
  const run = P.wk.find(x => x.name === 'Morning Workout').ex[0];
  assert.equal(run.cardio, true); assert.equal(run.sets[0].r, '1800'); assert.equal(run.sets[0].d, '3.1', 'distance in miles when the file is in lb');
  const drop = P.wk.find(x => x.started === new Date(2026, 9, 5, 18, 10).getTime()).ex[0].sets;
  assert.deepEqual(drop.map(s => s.w), ['190', '190', '135'], 'a drop set comes in as a working set');
});

test('units: a kg file in a pounds app is converted; the unit in the column name is trusted', () => {
  const app = fresh();
  const P = plan(app, [[F.STRONG6, 'strong']]);
  assert.equal(P.needUnit, false);
  const sq = P.wk[0].ex[0];
  assert.equal(sq.exId, 'squat');
  assert.deepEqual(sq.sets.map(s => s.w), ['220.5', '220.5']);
  assert.equal(P.wk[0].ended - P.wk[0].started, 3600000);
  const sled = P.wk[0].ex[1];
  assert.equal(sled.dist, true); assert.equal(sled.sets[0].r, '20'); assert.equal(sled.sets[0].w, '88');
  const kg = fresh({ unit: 'kg' });
  const P2 = plan(kg, [[F.STRONG, 'strong']], { unit: 'lb' });
  assert.equal(P2.wk[0].ex[0].sets[0].w, '84', '185 lb is 84 kg (to the quarter)');
  // A wrong unit shows up on the confirm screen.
  const P3 = plan(fresh(), [[F.STRONG.replace(/,185,/g, ',385,'), 'strong']], { unit: 'kg' });
  assert.match(P3.unitWarn, /bench press comes out at 849/);
});

test('Strong and Hevy measurements: weigh-ins and tape lengths in the app units; body fat is named as not brought in', () => {
  const app = fresh({ measureUnit: 'in' });
  const P = plan(app, [[F.STRONG_MEAS, 'strong'], [F.HEVY_MEAS, 'hevy']]);
  assert.deepEqual(P.weights.map(w => [w.date, w.weight]), [['2026-10-01', 199.5], ['2026-10-02', 198.6]], 'one a day: the Hevy weigh-in on the same day is not added twice');
  const m = P.measures.find(x => x.date === '2026-10-01');
  assert.equal(m.values.waist, 33.1, 'Strong 84 cm → 33.1 in (first file wins on a day)');
  assert.match(P.notes.join(' '), /Body Fat %/);
  assert.match(P.notes.join(' '), /fat_percent/);
});

test('Hevy: set types, supersets, notes, and the same lift again later in the session is its own entry', () => {
  const app = fresh();
  const P = plan(app, [[F.HEVY, 'hevy']]);
  assert.equal(P.needUnit, false);
  const w = P.wk[0];
  assert.equal(w.ended - w.started, 65 * 60000);
  assert.equal(w.notes, 'Good one');
  assert.deepEqual(w.ex.map(e => e.exId), ['bb-bench', 'lat-raise', 'tri-pd', 'bb-bench', 'assisted-pullup'].map(x => x === 'assisted-pullup' ? w.ex[4].exId : x));
  assert.equal(app.run(`exName(${JSON.stringify(w.ex[4].exId)})`), 'Assisted Pull-Up', '"Pull Up (Assisted)" is the assisted pull-up');
  assert.deepEqual(w.ex[0].sets.map(s => [s.warmup, !!s.fail, s.rir]), [[true, false, undefined], [false, false, 2], [false, true, 0]]);
  assert.equal(w.ex[1].link, 'A'); assert.equal(w.ex[2].link, 'A'); assert.equal(w.ex[0].link, null);
  assert.equal(w.ex[1].note, 'slow');
  assert.equal(w.ex[3].note, 'back-off');
  assert.equal(w.ex[4].sets[0].w, '', 'no weight: a bodyweight set');
  const de = read(app, F.HEVY_DE, 'hevy');
  assert.match(de.error, /English/);
});

test('Fitbod: the offset time, warm-ups, one workout per stretch of sets, and no routines without names', () => {
  const app = fresh();
  const P = plan(app, [[F.FITBOD, 'fitbod']]);
  assert.equal(P.n, 2);
  assert.equal(P.wk[0].started, Date.UTC(2026, 8, 29, 14, 2, 51));
  assert.deepEqual(P.wk[0].ex[0].sets.map(s => [s.w, s.r, s.warmup]), [['88', '10', true], ['176.5', '8', false], ['176.5', '8', false]]);
  assert.equal(P.wk[0].ex[1].exId, 'db-curl');
  assert.equal(P.wk[1].ex[0].timed, true);
  assert.equal(P.routines.length, 0);
});

test('JEFIT: sections, packed sets, a session with only a date, body stats; a re-saved file is explained', () => {
  const app = fresh();
  const P = plan(app, [[F.JEFIT, 'jefit']], { unit: 'lb' });
  assert.equal(P.needUnit, true);
  assert.equal(P.n, 2);
  const a = P.wk.find(w => !w.noTime);
  assert.equal(a.started, 1758996000 * 1000); assert.equal(a.ended - a.started, 3600000);
  assert.deepEqual(a.ex.map(e => [e.exId, e.sets.map(s => s.w + 'x' + s.r).join(',')]), [['bb-bench', '135x8,155x6'], ['lat-pd', '120x10,120x10']]);
  assert.equal(P.wk.find(w => w.noTime).ex[0].sets.length, 1);
  assert.deepEqual(P.weights.map(w => w.weight), [190]);
  const m = P.measures[0].values;
  assert.equal(m.waist, 34); assert.equal(m.chest, 42);
  assert.match(read(app, F.JEFIT_RESAVED, 'jefit').error, /not a workout export|sections/);
});

test('Alpha Progression and StrongLifts: read by column name, reps in reserve kept, set counts expanded, 5×5 offered', () => {
  const app = fresh();
  const A = plan(app, [[F.ALPHA, 'alpha']]);
  assert.equal(A.n, 1);
  assert.deepEqual(A.wk[0].ex[0].sets.map(s => [s.w, s.r, s.rir]), [['176.5', '8', 2], ['176.5', '7', 1]]);
  assert.equal(A.rirConv, false, 'reps in reserve from the file is not a conversion');
  const S5 = plan(app, [[F.STRONGLIFTS, 'stronglifts']]);
  assert.equal(S5.n, 2);
  assert.equal(S5.wk[0].ex[0].sets.length, 5);
  assert.equal(S5.wk[0].noTime, true);
  assert.equal(app.run('_p.sl5x5'), true);
  assert.match(read(app, 'Date,Foo,Bar\n2026-10-01,1,2\n', 'alpha').error, /could not be read|not a workout export/);
});

test('routines rebuilt from the last six weeks: order, usual set count, rep range and the last weight', () => {
  const app = fresh();
  const P = plan(app, [[F.STRONG, 'strong']], { unit: 'lb' });
  const push = P.routines.find(r => r.name === 'Push A');
  assert.ok(push, 'Push A has three sessions in six weeks');
  assert.equal(P.routines.some(r => /Morning/.test(r.name)), false, 'an app’s automatic name is not a routine');
  const bench = push.ex.find(e => e.exId === 'bb-bench');
  assert.equal(bench.sets, 2);
  assert.equal(bench.r, '6'); assert.equal(bench.rMax, '12', 'the drop set’s 12 widens the range: what was actually done');
  assert.equal(bench.w, '190');
  const plank = push.ex.find(e => e.exId === 'plank');
  assert.equal(plank.timed, true); assert.equal(plank.r, '75');
  const off = plan(app, [[F.STRONG, 'strong']], { unit: 'lb', routines: { 'push a': false } });
  assert.equal(off.routines.length, 0);
});

test('the write: everything tagged with its app, logged, PRs rebuilt; importing the same file again adds nothing', async () => {
  const app = fresh();
  plan(app, [[F.STRONG, 'strong']], { unit: 'lb' });
  const res = await app.run('ixCommit(_p,_f)');
  assert.equal(res.rec.counts.workouts, 4);
  const S = app.json('({w:S.workouts.map(w=>({src:w.src,key:w.srcKey,cals:w.cals})),r:S.routines.map(r=>({name:r.name,src:r.src})),c:S.custom.map(c=>({name:c.name,src:c.src})),log:S.importLog,pr:S.prs["bb-bench"],acts:S.activities.map(a=>({type:a.type,wkId:!!a.wkId,dist:a.dist,dur:a.dur}))})');
  assert.ok(S.w.every(w => w.src === 'strong' && w.key));
  assert.ok(S.w.find(w => w.cals > 0), 'a workout with a duration gets its calories');
  assert.deepEqual(S.r.map(r => [r.name, r.src]), [['Push A', 'strong']]);
  assert.deepEqual(S.c.map(c => c.src), ['strong']);
  assert.equal(S.log.length, 1); assert.equal(S.log[0].app, 'strong');
  assert.equal(Number(S.pr.w), 190);
  assert.deepEqual(S.acts, [{ type: 'run', wkId: true, dist: '3.1', dur: '30' }]);
  const again = plan(app, [[F.STRONG, 'strong']], { unit: 'lb' });
  assert.equal(again.n, 0); assert.equal(again.skip.dup, 4);
  // A second import of routines with the same name does not replace yours.
  await app.run('ixCommit(ixPlan(_f,{unit:"lb"}),_f)');
  assert.equal(app.run('S.routines.filter(r=>r.name==="Push A").length'), 1);
});

test('a workout already logged here by hand on the same day is skipped as a twin', () => {
  const app = fresh();
  app.state({ unit: 'lbs', workouts: [{ id: 'own', name: 'Push', started: new Date(2026, 9, 5, 7).getTime(), ended: new Date(2026, 9, 5, 8).getTime(),
    exercises: [{ exId: 'bb-bench', sets: [{ w: '190', r: '8', done: true, warmup: false }] }, { exId: 'ohp', sets: [{ w: '120', r: '5', done: true, warmup: false }] }] }] });
  const P = plan(app, [[F.STRONG, 'strong']], { unit: 'lb' });
  assert.equal(P.skip.twin, 1);
  assert.equal(P.n, 3);
});

test('a routine name you already use gets the app’s name after it', async () => {
  const app = fresh();
  app.state({ unit: 'lbs', routines: [{ id: 'r1', name: 'Push A', exercises: [{ exId: 'bb-bench', sets: 3 }], days: [] }] });
  plan(app, [[F.STRONG, 'strong']], { unit: 'lb' });
  await app.run('ixCommit(_p,_f)');
  assert.deepEqual(app.json('S.routines.map(r=>r.name)'), ['Push A', 'Push A (Strong)']);
});

test('StrongLifts 5×5 routines are created on import', async () => {
  const app = fresh();
  plan(app, [[F.STRONGLIFTS, 'stronglifts']]);
  await app.run('ixCommit(_p,_f)');
  const r = app.json('S.routines.filter(r=>/5x5/.test(r.name)).map(r=>({n:r.name,ex:r.exercises.map(e=>e.exId+":"+e.sets+"x"+e.r)}))');
  assert.deepEqual(r.find(x => x.n === 'StrongLifts 5x5 A').ex, ['squat:5x5', 'bb-bench:5x5', 'bb-row:5x5']);
  assert.deepEqual(r.find(x => x.n === 'StrongLifts 5x5 B').ex, ['squat:5x5', 'ohp:5x5', 'deadlift:1x5']);
});

test('fixing a match before importing: use one of ours, or set the muscle of a new one', () => {
  const app = fresh();
  const key = app.run(`exNameKey('Cable Crossover Hold Thing (Cable)')`);
  const P = plan(app, [[F.STRONG, 'strong']], { unit: 'lb', fix: { [key]: 'cable-fly' } });
  assert.ok(P.wk.some(w => w.ex.some(e => e.exId === 'cable-fly')));
  assert.equal(P.newEx.length, 0);
  const P2 = plan(app, [[F.STRONG, 'strong']], { unit: 'lb', muscle: { [key]: 'Chest' } });
  assert.equal(P2.newEx[0].muscle, 'Chest');
});

test('linking an imported exercise to one here moves its whole history and removes it', async () => {
  const app = fresh();
  plan(app, [[F.STRONG, 'strong']], { unit: 'lb' });
  await app.run('ixCommit(_p,_f)');
  const id = app.run('S.custom[0].id');
  assert.deepEqual(app.json(`ixLinkCounts(${JSON.stringify(id)})`), { workouts: 1, sets: 1, routines: 0 });
  assert.equal(app.run(`ixLink(${JSON.stringify(id)},'cable-fly')`), true);
  assert.equal(app.run('S.custom.length'), 0);
  assert.equal(app.run(`S.workouts.some(w=>w.exercises.some(e=>e.exId===${JSON.stringify(id)}))`), false);
  assert.equal(app.run(`S.workouts.filter(w=>w.exercises.some(e=>e.exId==='cable-fly')).length`), 1);
  assert.ok(app.json('S.prs["cable-fly"]'));
  assert.equal(app.run('S.importLog[0].counts.newEx'), 0);
});

test('removing an import takes what it brought and keeps what you logged here, and a rebuilt routine you have trained from', async () => {
  const app = fresh();
  plan(app, [[F.STRONG, 'strong'], [F.STRONG_MEAS, 'strong']], { unit: 'lb' });
  await app.run('ixCommit(_p,_f)');
  const rid = app.run('S.routines[0].id');
  app.run(`S.workouts.push({id:'mine',name:'Push A',routineId:${JSON.stringify(rid)},started:Date.now(),ended:Date.now()+3600000,exercises:[{exId:'bb-bench',sets:[{w:'195',r:'5',done:true,warmup:false}]}]});
    S.bodyweightLog.push({date:'2026-10-07',weight:200});`);
  const p = app.json('(()=>{const p=ixRemovalPlan("strong");return{w:p.wks.length,rt:p.rts.length,keep:p.rtKeep.length,ex:p.exs.length,bw:p.bw.length,acts:p.acts.length}})()');
  assert.deepEqual(p, { w: 4, rt: 0, keep: 1, ex: 1, bw: 2, acts: 1 });
  await app.run('ixRemove("strong")');
  const S = app.json('({w:S.workouts.map(w=>w.id),r:S.routines.length,c:S.custom.length,bw:S.bodyweightLog.map(b=>b.date),acts:S.activities.length,log:S.importLog.length,pr:S.prs["bb-bench"]})');
  assert.deepEqual(S.w, ['mine']);
  assert.equal(S.r, 1, 'the routine trained from since stays');
  assert.equal(S.c, 0); assert.equal(S.acts, 0); assert.equal(S.log, 0);
  assert.deepEqual(S.bw, ['2026-10-07']);
  assert.equal(Number(S.pr.w), 195);
});

test('Patterns: a workout with no time of day is left out of the morning test', () => {
  const app = fresh();
  app.run(`S.workouts=[{id:'a',name:'A',started:${new Date(2026, 9, 4, 12).getTime()},noTime:true,src:'jefit',exercises:[{exId:'bb-bench',sets:[{w:'135',r:'8',done:true,warmup:false}]}]}];bumpMemo();`);
  const s = app.json('patData().sessions.map(s=>s.hour)');
  assert.deepEqual(s, [null]);
});

test('the sheets render without throwing', () => {
  const app = fresh();
  app.run(`showAppImport();ixOpen('strong');window._ix.files=[ixReadText(${JSON.stringify(F.STRONG)},'strong','s.csv')];`);
  app.run('ixReview()');
  app.run(`window._ix.other='hevy';window._ix.otherOk=false;ixReview()`);
  app.run('showImportedData()');
});

test('JEFIT, a real export\'s layout: workout names come from the routine day, the unit from SETTING, personal sections are ignored', () => {
  const app = fresh();
  assert.deepEqual(app.json(`Object.keys(ixJefitSections(${JSON.stringify(F.JEFIT_REAL)}))`), ['SETTING', 'PROFILE', 'ROUTINES', 'WORKOUT SESSIONS', 'EXERCISE LOGS', 'EXERCISE SET LOGS', 'CARDIO LOGS'],
    'the closing line of hashes is not a section');
  const R = app.json(`ixReadText(${JSON.stringify(F.JEFIT_REAL)},'jefit','x.csv')`);
  assert.equal(R.error, undefined);
  assert.equal(R.unitKnown, true, 'the " lbs" in SETTING is the unit');
  assert.ok(R.notes.some(n => /read as lb/.test(n)));
  assert.equal(R.bad, 0);
  assert.deepEqual(R.sessions.map(s => s.name), ['Push Day', 'Push Day', 'JEFIT workout'], 'a session with no routine day (day_id 0) stays unnamed; one with no logs is dropped');
  assert.equal(R.sessions[2].noName, true);
  assert.ok(!JSON.stringify(R).includes('example.invalid'), 'the PROFILE section is never read');
  const a = R.sessions[0];
  assert.equal(a.t, new Date(2026, 8, 1, 18).getTime());
  assert.deepEqual(a.ex.map(e => [e.name, e.sets.map(s => `${s.w}x${s.r}`).join(',')]).slice(0, 2), [['Barbell Bench Press', '135x8,135x8,145x6'], ['Dumbbell Shoulder Press', '40x10,40x9']]);
  assert.ok(a.ex[0].sets.every(s => s.u === 'lb'));
  // Timed sets ("0:45") and cardio ("0x…" ×5, the last in seconds) are shapes another importer found in real files; not yet seen in one.
  assert.deepEqual(a.ex[2].sets.map(s => s.sec), [45, 50]);
  assert.deepEqual(R.sessions[2].ex[0].sets.map(s => [s.sec, s.r]), [[600, null]], 'one 10-minute set, not five sets of 102, 1, 5, 0 and 600 reps');
});

test('JEFIT, a real export: the routine days you trained come over with their plan; sample and untrained days do not', () => {
  const app = fresh();
  const R = app.json(`ixReadText(${JSON.stringify(F.JEFIT_REAL)},'jefit','x.csv')`);
  assert.deepEqual(R.routines.map(r => r.name), ['Push Day'], 'Sample Day and the untrained Pull Day are left out');
  assert.deepEqual(R.routines[0].exs, [
    { name: 'Barbell Bench Press', sets: 4, rMin: 6, rMax: 12, rest: 90, link: null }, // no name in the plan: found through exercise_id 12 in the logs
    { name: 'Dumbbell Shoulder Press', sets: 3, rMin: 10, rMax: 10, rest: 60, link: 'A' },
    { name: 'Plank', sets: 3, rMin: 8, rMax: 8, rest: 45, link: 'A' }]);
  assert.ok(R.notes.some(n => /^1 planned exercise .*left out/.test(n)), 'exercise_id 999 is named nowhere');
  const P = plan(app, [[F.JEFIT_REAL, 'jefit']], {});
  assert.equal(P.needUnit, false);
  assert.equal(P.n, 3);
  assert.equal(P.routines.length, 1);
  const r = app.json('_p.routines.map(r=>({name:r.name,plan:!!r.fromPlan,n:r.n,ex:r.exercises.map(e=>({id:e.exId,sets:e.sets,r:e.r,rMax:e.rMax||"",w:e.w,rest:e.rest,link:e.link}))}))')[0];
  assert.deepEqual([r.name, r.plan, r.n], ['Push Day', true, 2]);
  assert.deepEqual(r.ex[0], { id: 'bb-bench', sets: 4, r: '6', rMax: '12', w: '140', rest: 90, link: null }, 'the weight is the one last used for it in Push Day');
  assert.deepEqual(r.ex.slice(1).map(e => e.link), ['A', 'A']);
  assert.equal(plan(app, [[F.JEFIT_REAL, 'jefit']], { routines: { 'push day': false } }).routines.length, 0);
});

test('JEFIT, a real export: the write keeps the routine as "from your plan" and the workouts under its name', async () => {
  const app = fresh();
  plan(app, [[F.JEFIT_REAL, 'jefit']], {});
  const res = await app.run('ixCommit(_p,_f)');
  assert.equal(res.rec.counts.workouts, 3); assert.equal(res.rec.counts.routines, 1);
  const S = app.json('({w:S.workouts.map(w=>w.name).sort(),r:S.routines.map(r=>({name:r.name,notes:r.notes,src:r.src,n:r.exercises.length}))})');
  assert.deepEqual(S.w, ['JEFIT workout', 'Push Day', 'Push Day']);
  assert.deepEqual(S.r, [{ name: 'Push Day', notes: 'From your JEFIT routine', src: 'jefit', n: 3 }]);
});
