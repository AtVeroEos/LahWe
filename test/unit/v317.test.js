'use strict';
// 3.17: programs kept side by side, the body map and recovery, form, records by kind, reps in
// reserve, progress photos and the month and year in review.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { demoState } = require('../../tools/demo-state.js');

const NOW = '2026-10-15T12:00:00'; // a Thursday
const demo = over => { const app = loadApp({ now: NOW }); app.state(Object.assign(demoState(new Date(NOW).getTime()), over || {})); return app; };
const blank = over => { const app = loadApp({ now: NOW }); app.state(over || {}); return app; };
const at = (ds, h) => new Date(`${ds}T${String(h || 18).padStart(2, '0')}:00:00`).getTime();
const wk = (id, ds, exs, over) => Object.assign({ id, name: 'W', started: at(ds), ended: at(ds, 19), exercises: exs }, over || {});
const sets = (n, w, r, extra) => Array.from({ length: n }, () => Object.assign({ w: String(w), r: String(r), done: true }, extra || {}));

test('an old single program becomes the first of the programs, with its workouts and its until-a-date phase in weeks', () => {
  const app = loadApp({ now: NOW });
  const s = app.json(`normalizeState(${JSON.stringify({
    _schema: 3, onboarded: true,
    routines: [{ id: 'r1', name: 'A', exercises: [{ exId: 'squat', sets: 3, r: '5' }] }, { id: 'r9', name: 'Z', exercises: [] }],
    groups: [{ id: 'g1', name: 'Base', mode: 'daypicker', routineIds: ['r1'], dayMap: { r1: [1] } }],
    program: { name: 'Block', startDate: '2026-09-07', phases: [{ groupId: 'g1', mode: 'until', untilDate: '2026-10-04' }, { groupId: 'gone', weeks: 2 }] },
    workouts: [wk('a', '2026-09-08', [], { routineId: 'r1' }), wk('b', '2026-09-01', [], { routineId: 'r1' }), wk('c', '2026-09-09', [], { routineId: 'r9' })],
    custom: [{ id: 'custom-1', name: 'Rear Delt Cable Fly', cat: 'Shoulders', eq: 'Cable', muscle: 'Shoulders', sec: ['Delts', 'Traps'] }, { id: 'custom-2', name: 'Seated Leg Curl', cat: 'Legs', eq: 'Machine', muscle: 'Hamstrings' }],
  })})`);
  assert.equal(s._schema, 4); assert.ok(!('program' in s));
  assert.equal(s.programs.length, 1);
  const p = s.programs[0];
  assert.deepEqual([p.name, p.status, p.phases.length, p.phases[0].weeks], ['Block', 'running', 1, 4], 'four weeks from Sep 7 to Oct 4; the phase whose split is gone is dropped');
  assert.deepEqual(['a', 'b', 'c'].map(id => !!s.workouts.find(w => w.id === id).prog), [true, false, false], 'stamped only from the start date and only for its workouts');
  const c = s.custom.find(x => x.id === 'custom-1');
  assert.equal(c.muscle, 'Rear Delts'); assert.deepEqual(c.sec, ['Front Delts', 'Traps']);
  assert.deepEqual(s.shoulderReview, ['custom-1'], 'listed once to confirm');
  assert.ok(!s.custom.some(x => x.id === 'custom-2'), 'a custom exercise the catalog now has is merged into it');
});

test('several programs: switching pauses the other, a finished one is never restarted by accident', () => {
  const app = blank({
    routines: [{ id: 'r1', name: 'A', exercises: [{ exId: 'squat', sets: 4, r: '5' }] }],
    groups: [{ id: 'g1', name: 'One', mode: 'daypicker', routineIds: ['r1'], dayMap: { r1: [1] } }],
    programs: [{ id: 'p1', name: 'First', status: 'running', phases: [{ groupId: 'g1', weeks: 4 }] }, { id: 'p2', name: 'Second', status: 'saved', phases: [{ groupId: 'g1', weeks: 2, deload: true }] },
      { id: 'p3', name: 'Done', status: 'finished', finishedAt: at('2026-09-01'), phases: [{ groupId: 'g1', weeks: 2 }] }],
  });
  app.run(`progStart('p3')`);
  assert.deepEqual(app.json(`S.programs.map(p=>p.status)`), ['running', 'saved', 'finished'], 'a finished program does not pause the running one');
  app.run(`customConfirm=(m,l,cb)=>cb();progStart('p2')`);
  assert.deepEqual(app.json(`S.programs.map(p=>p.status)`), ['paused', 'running', 'finished']);
  // the last week of a phase marked deload halves the sets
  assert.equal(app.run(`sessionExercise('squat','r1',S.routines[0].exercises[0],{deload:true}).sets.filter(s=>!s.warmup).length`), 2);
  app.run(`progArchive('p1',true)`);
  assert.equal(app.run(`programById('p1').status`), 'archived');
  app.run(`progArchive('p1',false)`);
  assert.equal(app.run(`programById('p1').status`), 'paused', 'an archived program that never finished comes back paused');
});

test('recovery: a hard session leaves the muscle tired, it is ready in about two to three days, helpers and runs count', () => {
  const app = blank({
    workouts: [wk('w1', '2026-10-14', [{ exId: 'squat', sets: sets(5, 225, 5, { rir: 1 }) }, { exId: 'leg-curl', sets: sets(4, 90, 10) }, { exId: 'bb-curl', sets: sets(4, 60, 10) }])],
    activities: [{ id: 'a1', type: 'run', date: '2026-10-13', dur: '40', dist: '4' }],
  });
  const r = app.json(`recoveryState()`);
  assert.ok(r.Quads.fresh < 70, `quads well short of fresh the day after (${r.Quads.fresh}%)`);
  assert.ok(r.Glutes.fresh < r.Chest.fresh, 'a squat works the glutes too');
  assert.equal(r.Chest.fresh, 100);
  assert.ok(r.Calves.fresh < 100, 'the run counts toward the calves');
  const hrs = m => (r[m].readyAt - Date.parse(NOW)) / 3600000;
  assert.ok(hrs('Quads') > 30 && hrs('Quads') < 80, `quads ready in ${Math.round(hrs('Quads'))} h`);
  assert.ok(r.Biceps.fresh > r.Quads.fresh, 'small muscles recover faster');
  assert.equal(app.run(`recoveryHours('Quads')`), 71); assert.equal(app.run(`recoveryHours('Biceps')`), 49);
  app.setNow('2026-10-20T12:00:00'); app.run('bumpMemo()');
  assert.ok(app.json(`recoveryState()`).Quads.fresh >= 95, 'nearly fresh six days on');
  // the tile and Home name the tired muscles a workout would train
  app.setNow(NOW); app.run('bumpMemo()');
  assert.deepEqual(app.json(`routineFatigue({exercises:[{exId:'front-squat'},{exId:'bb-bench'}]}).map(x=>x.m)`), ['Quads']);
  assert.match(app.run(`fmtReady(Date.now()+30*3600000)`), /tomorrow|in 2 days/);
});

test('the Muscles tile: sets or recovery, flags only muscles you train, and the lens is remembered', () => {
  const app = blank({ workouts: [wk('w1', '2026-10-13', [{ exId: 'bb-bench', sets: sets(4, 185, 8) }]), wk('w0', '2026-09-30', [{ exId: 'face-pull', sets: sets(3, 40, 15) }])] });
  const flags = app.json(`bodyFlags('sets').map(x=>x.m)`);
  assert.ok(flags.includes('Chest') && flags.includes('Rear Delts'), 'under range and trained this month');
  assert.ok(!flags.includes('Calves'), 'never trained: not nagged about');
  app.run(`setBodyLens('recovery')`); assert.equal(app.run('S.bodyLens'), 'recovery');
  assert.match(app.run(`bodyTileHTML()`), /All fresh|recovering/);
  assert.equal(app.json(`normalizeState({bodyLens:'x'}).bodyLens`), 'sets');
  const d = app.json(`metricDetail('body',{},boardRange())`);
  assert.equal(d.title, 'Muscles'); assert.match(d.body, /mus-grid/);
});

test('muscles an exercise counts toward can be changed: built-ins by override, your own in full', () => {
  const app = blank({ custom: [{ id: 'custom-zp', name: 'Z Press', cat: 'Shoulders', eq: 'Barbell', muscle: 'Front Delts', sec: [] }], workouts: [wk('w1', '2026-10-13', [{ exId: 'custom-zp', sets: sets(3, 95, 8) }])] });
  assert.deepEqual(app.json(`muscleContribs('lat-raise')`), [{ muscle: 'Side Delts', w: 1 }]);
  app.run(`S.exMuscle['lat-raise']={muscle:'Side Delts',sec:['Traps']};bumpMemo()`);
  assert.deepEqual(app.json(`muscleContribs('lat-raise')`), [{ muscle: 'Side Delts', w: 1 }, { muscle: 'Traps', w: 0.5 }]);
  assert.deepEqual(app.json(`normalizeExMuscle({'lat-raise':{muscle:'side delts',sec:['traps','Side Delts']},'custom-zp':{muscle:'Chest'},'squat':{muscle:'Nope'}})`), { 'lat-raise': { muscle: 'Side Delts', sec: ['Traps'] } });
  // editing your own keeps its id, so its history stays with it
  const doc = { 'cex-n': { value: 'Z-Press (seated)' }, 'cex-m': { value: 'Front Delts' }, 'cex-c': { value: 'Shoulders' }, 'cex-e': { value: 'Barbell' } };
  app.ctx.__doc = doc;
  app.run(`document.getElementById=id=>__doc[id]||null;const _qsa=document.querySelectorAll;document.querySelectorAll=sel=>/cex-sec/.test(sel)?[{dataset:{m:'Triceps'}}]:[];saveCustomEx('custom-zp')`);
  assert.deepEqual(app.json(`S.custom.map(c=>[c.id,c.name,c.sec])`), [['custom-zp', 'Z-Press (seated)', ['Triceps']]]);
  assert.equal(app.run(`S.workouts[0].exercises[0].exId`), 'custom-zp');
  assert.equal(app.run(`exName('custom-zp')`), 'Z-Press (seated)');
  app.run(`S.shoulderReview=['custom-zp'];setShoulderHead('custom-zp','Side Delts')`);
  assert.equal(app.run(`S.custom[0].muscle`), 'Side Delts');
});

test('reps in reserve steer the next target', () => {
  const app = blank({ routines: [{ id: 'r1', name: 'A', exercises: [{ exId: 'bb-bench', sets: 3, r: '5', rir: 2 }, { exId: 'ohp', sets: 3, r: '8', rMax: '12' }] }] });
  const aim = (exId, s) => {
    app.run(`S.workouts=${JSON.stringify([wk('w1', '2026-10-13', [{ exId, sets: s }], { routineId: 'r1' })])};bumpMemo()`);
    return app.json(`ruleTarget(${JSON.stringify(exId)},S.routines[0].exercises.find(e=>e.exId===${JSON.stringify(exId)}),'r1')`);
  };
  assert.equal(aim('bb-bench', sets(3, 200, 5)).w, 205, 'nothing logged: the usual step');
  const easy = aim('bb-bench', sets(3, 200, 5, { rir: 4 }));
  assert.deepEqual([easy.kind, easy.w], ['up', 210], 'four left against an aim of two: a bigger jump');
  const spent = aim('bb-bench', [...sets(2, 200, 5, { rir: 0 }), ...sets(1, 200, 5, { rir: 2 })]);
  assert.deepEqual([spent.kind, spent.w], ['hold', 200]);
  assert.match(spent.why, /less in reserve/);
  const range = aim('ohp', sets(3, 95, 9, { rir: 4 }));
  assert.deepEqual([range.kind, range.w, range.r], ['up', 100, 8], 'easy inside a range: add weight now');
  assert.equal(aim('ohp', sets(3, 95, 9, { rir: 2 })).kind, 'reps', 'otherwise climb the range');
});

test('records by kind: weight, reps, holds and distances each have their own best', () => {
  const app = blank({ workouts: [
    wk('w2', '2026-10-13', [{ exId: 'pullup', sets: [{ w: '', r: '14', done: true }] }, { exId: 'plank', timed: true, sets: [{ w: '', r: '95', done: true }] }, { exId: 'sled-push', dist: true, sets: [{ w: '180', r: '40', done: true }] }]),
    wk('w1', '2026-10-06', [{ exId: 'pullup', sets: [{ w: '', r: '12', done: true }] }, { exId: 'plank', timed: true, sets: [{ w: '', r: '60', done: true }] }]),
  ] });
  assert.deepEqual(app.json(`['pullup','plank','sled-push','squat'].map(exKind)`), ['reps', 'hold', 'dist', 'e1rm']);
  assert.equal(app.run(`fmtKind('hold',95)`), '1:35');
  assert.equal(app.json(`exRecords('pullup').reps.v`), 14);
  assert.equal(app.json(`exRecords('plank').hold.v`), 95);
  const r = app.json(`repRecords('2026-10-01','2026-10-31').map(x=>[x.exId,x.was,x.v])`);
  assert.deepEqual(r.sort(), [['plank', 60, 95], ['pullup', 12, 14]], 'only beats of an earlier best; a first session is not a record');
});

test('the month and the year in review', () => {
  const app = demo();
  const m = app.json(`(()=>{const R=periodReport('month','2026-09');return{label:R.label,live:R.live,s:R.cur.sessions,active:R.activeDays,rec:R.records.length,lifts:R.lifts.length,mus:R.muscles.length,empty:R.empty};})()`);
  assert.equal(m.label, 'September 2026'); assert.equal(m.live, false); assert.equal(m.empty, false);
  assert.ok(m.s > 8 && m.active >= m.s - 2 && m.rec > 0 && m.lifts > 0 && m.mus > 5, JSON.stringify(m));
  const cur = app.json(`(()=>{const R=periodReport('month','2026-10');return{live:R.live,to:R.to,days:R.days};})()`);
  assert.deepEqual(cur, { live: true, to: '2026-10-15', days: 15 });
  assert.equal(app.json(`periodReport('month','2025-01').empty`), true);
  assert.deepEqual(app.json(`[repRange('month','2026-01').prev,repRange('month','2026-12').next,repRange('year','2026').from]`), ['2025-12', '2027-01', '2026-01-01']);
  // Home offers last month in the first week of the next, once
  app.setNow('2026-10-03T09:00:00'); app.run('bumpMemo()');
  assert.deepEqual(app.json(`reportDue()`), { kind: 'month', key: '2026-09', label: 'September in review' });
  app.run(`S.reportSeen='2026-09'`); assert.equal(app.json(`reportDue()`), null);
  app.setNow('2026-12-20T09:00:00'); app.run('bumpMemo()');
  assert.equal(app.json(`reportDue()`).kind, 'year');
  assert.match(app.run(`repVolumeFact(1200000)`), /^1\.2M|1200k|elephants|whale/);
  assert.equal(app.json(`normalizeState({reportSeen:'nope',yearSeen:'2026'})`).reportSeen, null);
});

test('progress photos: kept apart from the state, the pair to compare, and a photos file fills in what a backup lacks', async () => {
  const app = blank({ bodyweightLog: [{ date: '2026-10-14', weight: 181.2 }, { date: '2026-08-01', weight: 190 }] });
  const px = 'data:image/jpeg;base64,/9j/AAAA';
  app.run(`Photos.put('a',{v:1,full:'${px}',thumb:'${px}'});Photos.put('b',{v:1,full:'${px}',thumb:'${px}'})`);
  app.run(`S.photos=normalizePhotos([{id:'a',date:'2026-08-02',pose:'front',weight:weightNear('2026-08-02')},{id:'b',date:'2026-10-14',pose:'front',weight:weightNear('2026-10-14')},{id:'c',date:'2026-10-14',pose:'side'},{id:'x',date:'bad'}])`);
  assert.deepEqual(app.json(`S.photos.map(p=>[p.id,p.weight||null])`), [['b', 181.2], ['c', null], ['a', 190]], 'newest first, weight from the nearest weigh-in');
  assert.deepEqual(app.json(`photoPair().map(p=>p.id)`), ['a', 'b'], 'first and latest of the pose with most photos');
  const tile = app.json(`METRICS.photos.tile()`);
  assert.equal(tile.value, '3'); assert.match(tile.sub, /Aug 2 to Oct 14 · −8\.8/);
  assert.ok(!app.run(`JSON.stringify(S)`).includes('base64'), 'pictures never enter the state or the backup');
  // a restored backup lists photo "c" but its picture is not on this phone; the photos file brings it
  const added = await app.run(`photosImport({_app:'lahwe-photos',photos:[{id:'c',date:'2026-10-14',pose:'side',full:'${px}',thumb:'${px}'},{id:'d',date:'2026-10-01',pose:'back',full:'${px}'},{id:'e',date:'2026-10-01',pose:'back',full:'javascript:alert(1)'},{id:'a',date:'2026-08-02',pose:'front',full:'${px}'}]})`);
  assert.equal(added, 2, 'the missing picture and the new photo; a bad one and one already here are skipped');
  assert.deepEqual(app.json(`S.photos.map(p=>p.id)`), ['b', 'c', 'd', 'a']);
  assert.equal(app.run(`!!Photos.mem.get('c')`), true);
  app.run(`deletePhoto('d')`);
  assert.ok(!app.json(`S.photos.map(p=>p.id)`).includes('d'));
});

test('photo check-ins: poses from Settings, Keep moves on, a retake replaces, the first time explains where photos go', async () => {
  const app = blank({ bodyweightLog: [{ date: '2026-10-15', weight: 180 }] });
  assert.deepEqual(app.json('photoSetPoses()'), ['front', 'side'], 'two by default');
  app.run(`setPhotoSetting('photoSet',4)`); assert.deepEqual(app.json('photoSetPoses()'), ['front', 'side', 'back', 'side2']);
  app.run(`setPhotoSetting('photoSet',7);setPhotoSetting('photoTimer',10)`); assert.deepEqual(app.json('[S.photoSet,S.photoTimer]'), [4, 10]);
  assert.deepEqual(app.json(`(()=>{const s=normalizeState({photoSet:9,photoTimer:5,photoGhost:0,photoFacing:'x'});return[s.photoSet,s.photoTimer,s.photoGhost,s.photoFacing,s.photoIntro];})()`), [2, 0, true, 'user', false]);
  // the first time, the note comes first and the camera does not open
  app.run(`PC.poses=[];photoCheckIn()`); assert.equal(app.run('PC.poses.length'), 0);
  app.run(`S.photoIntro=true;photoCheckIn()`); assert.equal(app.run('PC.poses.length'), 4);
  const px = 'data:image/jpeg;base64,/9j/AAAA';
  app.run(`PC.poses=['front','side'];PC.i=0;PC.date=today();PC.shot={full:'${px}',thumb:'${px}'};pcKeep()`);
  assert.equal(app.run('PC.i'), 1, 'Keep moves to the next pose');
  app.run(`PC.shot={full:'${px}',thumb:'${px}'};pcKeep()`);
  assert.deepEqual(app.json(`S.photos.map(p=>[p.pose,p.date,p.weight])`).sort(), [['front', '2026-10-15', 180], ['side', '2026-10-15', 180]]);
  const firstFront = app.run(`S.photos.find(p=>p.pose==='front').id`);
  await app.run(`photoSave({full:'${px}',thumb:'${px}'},{date:'2026-10-15',pose:'front'})`);
  assert.equal(app.json(`S.photos.filter(p=>p.pose==='front').length`), 1, 'a retake the same day replaces the earlier one');
  assert.notEqual(app.run(`S.photos.find(p=>p.pose==='front').id`), firstFront);
  assert.equal(app.run(`Photos.mem.has(${JSON.stringify(firstFront)})`), false, 'and its picture is removed');
  assert.deepEqual(app.json(`photoDays().map(d=>[d.date,Object.keys(d.ps).sort()])`), [['2026-10-15', ['front', 'side']]]);
  assert.deepEqual(app.json('photoCols()'), ['front', 'side']);
});

test('backup with photos is one zip: data.json and each photo as a JPEG named by date and pose; restore brings them back', async () => {
  const app = blank();
  const jpg = n => 'data:image/jpeg;base64,' + Buffer.from(`fake-jpeg-${n}-`.repeat(40)).toString('base64');
  app.run(`Photos.put('a',{v:1,full:'${jpg(1)}',thumb:'${jpg('t1')}'});Photos.put('b',{v:1,full:'${jpg(2)}',thumb:'${jpg('t2')}'});Photos.put('c',{v:1,full:'${jpg(3)}',thumb:'${jpg('t3')}'})`);
  app.run(`S.photos=normalizePhotos([{id:'a',date:'2026-10-14',pose:'front'},{id:'b',date:'2026-10-14',pose:'side'},{id:'c',date:'2026-08-01',pose:'front'},{id:'gone',date:'2026-07-01',pose:'back'}])`);
  assert.equal(app.run(`backupName(true)`), 'Lah We backup 2026-10-15 with photos.zip');
  assert.equal(app.run(`backupName(false)`), 'Lah We backup 2026-10-15.json');
  assert.deepEqual(app.json(`photoFileNames([{id:'x',date:'2026-10-14',pose:'front'},{id:'y',date:'2026-10-14',pose:'front'},{id:'z',date:'2026-10-14',pose:'side2'}])`),
    { x: 'Photos/2026-10-14 Front.jpg', y: 'Photos/2026-10-14 Front 2.jpg', z: 'Photos/2026-10-14 Other side.jpg' });
  const built = await app.run(`photosBackupBuild(backupJSON({})).then(z=>{window.__z=z;return{n:z.n,missing:z.missing,type:z.blob.type}})`);
  assert.deepEqual(JSON.parse(JSON.stringify(built)), { n: 3, missing: 1, type: 'application/zip' });
  const names = await app.run(`zipIndex(__z.blob).then(e=>e.map(x=>x.name))`);
  assert.deepEqual([...names], ['data.json', 'Photos/2026-10-14 Front.jpg', 'Photos/2026-10-14 Side.jpg', 'Photos/2026-08-01 Front.jpg']);
  // the zip is a real one: an independent reader checks every entry's checksum
  const blob = app.ctx.__z.blob;
  const buf = Buffer.from(await blob.arrayBuffer());
  const { execFileSync } = require('child_process');
  const fs = require('fs'), os = require('os'), path = require('path');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lahwe-zip-')), 'b.zip'); fs.writeFileSync(f, buf);
  const py = execFileSync('python3', ['-I', '-c', 'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(len(z.read("Photos/2026-10-14 Side.jpg")))', f]).toString().trim().split('\n');
  assert.equal(py[0], 'None', 'no damaged entries');
  assert.equal(Number(py[1]), Buffer.from(jpg(2).split(',')[1], 'base64').length);
  // restore on another phone
  const other = blank();
  other.ctx.__blob = blob;
  const n = await other.run(`(async()=>{const entries=await zipIndex(__blob);const ent=entries.find(e=>e.name==='data.json');const data=JSON.parse(new TextDecoder().decode(await zipExtract(__blob,ent,80e6)));const ph=photoFilesFromBackup(data);window.__had=('_photoFiles' in data)||('_photoThumbs' in data);replaceState(data);return photosRestoreZip(__blob,entries,ph);})()`);
  assert.equal(n, 3); assert.equal(other.run('__had'), false, 'the photo blocks never reach the state');
  assert.equal(other.run(`Photos.mem.get('b').full`), jpg(2)); assert.equal(other.run(`Photos.mem.get('b').thumb`), jpg('t2'));
  assert.deepEqual(other.json(`S.photos.map(p=>p.id)`), ['a', 'b', 'c', 'gone']);
  assert.ok(!other.run('JSON.stringify(S)').includes('base64'));
});

test('form: every built-in has steps and tips, photos come from one pinned source', () => {
  const app = blank();
  const r = app.json(`(()=>{const ids=EXERCISES.map(e=>e.id);const miss=ids.filter(id=>!FORM[id]||!FORM[id].steps.length||!FORM[id].tips.length);const extra=Object.keys(FORM).filter(id=>!ids.includes(id));const photos=ids.filter(id=>FORM[id]&&FORM[id].img).length;return{n:ids.length,miss,extra,photos};})()`);
  assert.deepEqual(r.miss, []); assert.deepEqual(r.extra, []);
  assert.ok(r.photos >= 120, `${r.photos} of ${r.n} with photos`);
  assert.match(app.run(`formImg(FORM['bb-bench'],1)`), /^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db@[0-9a-f]{40}\/exercises\/[^ ]+\/1\.jpg$/);
  assert.match(app.run(`formBlockHTML('bb-bench')`), /All steps/);
  assert.equal(app.run(`formBlockHTML('custom-nope')`), '');
});

test('cardio in a workout becomes an activity, with its minutes and miles, and is not counted twice', () => {
  const app = blank();
  const acts = app.json(`cardioActivities({id:'w1',name:'Conditioning',started:${at('2026-10-14')},exercises:[{exId:'easy-run',cardio:true,sets:[{r:'1800',d:'3.1',done:true}]},{exId:'rower',cardio:true,sets:[{r:'600',done:true}]},{exId:'squat',sets:[{w:'225',r:'5',done:true}]}]})`);
  assert.deepEqual(acts.map(a => [a.type, a.dur, a.dist, a.wkId]), [['run', '30', '3.1', 'w1'], ['row', '10', acts[1].dist, 'w1']]);
  assert.ok(acts[0].cals > 0);
});

test('importing: reps in reserve, a deload week and plain text', () => {
  const app = blank();
  const parsed = app.json(`parseImport(parsePlainProgram('Upper A\\nBench Press 4x5 RIR 2\\nPull-Up 3x8-10 rest 90s\\nLower A\\nBack Squat 5x5\\nHamstring curl 3x12'))`);
  assert.equal(parsed.routines.length, 2);
  const bench = parsed.routines[0].exercises[0];
  assert.deepEqual([bench.exId, bench.sets, bench.r, bench.rir], ['bb-bench', 4, '5', 2]);
  assert.equal(parsed.routines[0].exercises[1].rest, 90);
  assert.equal(parsed.routines[1].exercises[1].exId, 'leg-curl');
});
