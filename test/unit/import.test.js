'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

test('exercise matching: same movement only — never the nearest neighbour', () => {
  const app = loadApp();
  const m = (name, eq) => app.run(`(matchExercise(${JSON.stringify(name)},${JSON.stringify(eq || '')})||{ex:{id:null}}).ex.id`);
  const cases = [
    // exact names, case/punctuation/plurals/shorthand
    ['Barbell Bench Press', '', 'bb-bench'], ['barbell bench press', '', 'bb-bench'], ['Pull Ups', '', 'pullup'], ['Pull-up', '', 'pullup'], ['Chin ups', '', 'chinup'],
    ['Lateral Raises', '', 'lat-raise'], ['Incline DB Bench Press', '', 'inc-db-bench'], ['Incline Dumbbell Bench Press', '', 'inc-db-bench'],
    ['T Bar Row', '', 'tbar-row'], ['Farmers Walk', '', 'farmers'], ['Skullcrushers', '', 'skull'], ['Tricep Pushdowns', '', 'tri-pd'], ['Triceps Push-down', '', 'tri-pd'],
    // the cases the old matcher got wrong
    ['Incline Barbell Bench Press', '', 'inc-bench'], ['Seated Leg Curl', '', null], ['Lying Leg Curl', 'Machine', null], ['Weighted Pull-Up', '', null],
    ['Single Leg Leg Press', '', null], ['Decline Dumbbell Bench Press', '', null], ['Standing Calf Raise', '', null], ['EZ Bar Curl', '', null],
    // aliases
    ['Bench Press', '', 'bb-bench'], ['Back Squat', '', 'squat'], ['Squat', 'Barbell', 'squat'], ['RDL', '', 'rdl'], ['Military Press', '', 'ohp'], ['OHP', '', 'ohp'],
    ['Bent-Over Row', '', 'bb-row'], ['Trap Bar Deadlift', '', 'hex-dl'], ['Lat Pull Down', '', 'lat-pd'], ['Single-Arm DB Row', '', 'db-row'],
    // equipment decides between variants, and blocks a wrong one
    ['Bench Press', 'Dumbbell', 'db-bench'], ['Squat', 'Bodyweight', 'bw-squat'], ['Squat', 'Dumbbell', null], ['Goblet Squat', 'Kettlebell', 'kb-goblet'],
    ['Dumbbell Goblet Squat', '', 'goblet'], ['Cable Lateral Raise', '', null], ['Machine Lateral Raise', '', null], ['Dumbbell Lateral Raise', '', 'lat-raise'],
    ['Barbell Deadlift', '', 'deadlift'], ['Machine Leg Curl', '', 'leg-curl'], ['Bodyweight Calf Raise', '', 'bw-calf'], ['Row', 'Dumbbell', 'db-row'],
    // too vague to guess
    ['Row', '', null], ['Curl', '', null], ['Press', '', null], ['', '', null],
  ];
  for (const [name, eq, want] of cases) assert.equal(m(name, eq), want, `${name}${eq ? ' [' + eq + ']' : ''}`);
});
test('an exact catalog name wins over a conflicting equipment hint, with a note', () => {
  const app = loadApp();
  const r = app.json(`matchExercise('Lat Pulldown','Machine')`);
  assert.equal(r.ex.id, 'lat-pd'); assert.match(r.note, /Machine/);
});
test('muscle guesses for new exercises land on the right muscle', () => {
  const app = loadApp();
  const cases = { 'Seated Leg Curl': 'Hamstrings', 'Lying Leg Curl': 'Hamstrings', 'Smith Machine Leg Press': 'Quads', 'Seated Leg Extension': 'Quads', 'Standing Calf Raise': 'Calves',
    'Cable Pull-Through': 'Glutes', 'Rear Delt Fly': 'Shoulders', 'Reverse Pec Deck': 'Shoulders', 'Nordic Hamstring Curl': 'Hamstrings', 'Plate Loaded Shrug': 'Traps',
    'Cable Lateral Raise': 'Shoulders', 'Machine Chest Press': 'Chest', 'Incline Machine Press': 'Chest', 'Chest Dip': 'Chest', 'EZ Bar Curl': 'Biceps', 'Rope Overhead Extension': 'Shoulders',
    'Tricep Overhead Extension': 'Triceps', 'Hanging Knee Raise': '', 'Back Extension': 'Lower Back', 'Wrist Curl': 'Forearms', 'Landmine Press': 'Shoulders', 'Sled Push': '' };
  for (const [name, want] of Object.entries(cases)) assert.equal(app.run(`guessMuscle(${JSON.stringify(name)})`), want, name);
});

test('parseReps understands the ways programs write a target', () => {
  const app = loadApp();
  const p = e => { const o = app.json(`parseReps(${JSON.stringify(e)})`); return [o.r, o.rMax, o.amrap, o.timed, o.extra]; };
  assert.deepEqual(p({ reps: 10 }), ['10', '', false, false, '']);
  assert.deepEqual(p({ reps: '8-12' }), ['8', '12', false, false, '']);
  assert.deepEqual(p({ reps: '8–12 reps' }), ['8', '12', false, false, '']);
  assert.deepEqual(p({ reps: '6 to 8' }), ['6', '8', false, false, '']);
  assert.deepEqual(p({ reps: 'AMRAP' }), ['', '', true, false, '']);
  assert.deepEqual(p({ reps: 0 }), ['', '', true, false, '']);
  assert.deepEqual(p({ reps: '10+' }), ['10', '', true, false, '']);
  assert.deepEqual(p({ reps: 'to failure' }), ['', '', true, false, '']);
  assert.deepEqual(p({ reps: '30s' }), ['30', '', false, true, '']);
  assert.deepEqual(p({ reps: '45 sec' }), ['45', '', false, true, '']);
  assert.deepEqual(p({ reps: '30-45 seconds' }), ['30', '45', false, true, '']);
  assert.deepEqual(p({ reps: '1:30' }), ['90', '', false, true, '']);
  assert.deepEqual(p({ reps: '2 min' }), ['120', '', false, true, '']);
  assert.deepEqual(p({ reps: '8-12 each side' }), ['8', '12', false, false, 'each side']);
  assert.deepEqual(p({ repsMin: 5, repsMax: 0, amrap: false, timed: false }), ['5', '', false, false, '']);
  assert.deepEqual(p({ repsMin: 40, repsMax: 60, timed: true }), ['40', '60', false, true, '']);
  assert.deepEqual(p({ repsMin: 0, repsMax: 0, amrap: true }), ['', '', true, false, '']);
  assert.deepEqual(p({ reps: '12-8' }), ['12', '', false, false, ''], 'a reversed range keeps the first number');
  assert.deepEqual(p({}), ['', '', false, false, '']);
});
test('extractJson finds the object inside fences or prose', () => {
  const app = loadApp();
  assert.deepEqual(app.json('extractJson(\'{"a":1}\').value'), { a: 1 });
  assert.deepEqual(app.json('extractJson("Here you go:\\n```json\\n{\\"a\\":[1,2]}\\n```\\nEnjoy").value'), { a: [1, 2] });
  assert.deepEqual(app.json('extractJson("sure — {\\"a\\":{\\"b\\":2}} done").value'), { a: { b: 2 } });
  assert.equal(app.run('extractJson("not json").value'), undefined);
});

const PROGRAM = { groups: [
  { name: 'Block 1', mode: 'rotation', weeks: 4, routines: [
    { name: 'B1 - Upper', exercises: [
      { name: 'Bench Press', sets: 4, reps: '6-8', rest: 150, equipment: 'Barbell', muscle: 'pecs', secondaryMuscles: ['Triceps', 'front delts', 'Nonsense'] },
      { name: 'Bayesian Cable Curl', sets: 3, reps: '10-12', equipment: 'cable', muscle: 'Biceps', secondaryMuscles: [], link: 'ss-1' },
      { name: 'Face Pull', sets: 3, reps: 15, link: 'ss-1' },
      { name: 'Plank', sets: 2, reps: '45s', link: 'ss-2' },
    ] },
    { name: 'B1 - Lower', exercises: [
      { name: 'Bayesian Cable Curls', sets: 2, reps: 12, equipment: 'Cable', muscle: 'Biceps' },
      { name: 'Mystery Lift', sets: 99, reps: 5, rest: -4, type: 'weird', muscle: 'Soul' },
      { sets: 3 }, 'Leg Press',
    ] },
    { name: 'Empty day', exercises: [] },
  ] },
  { name: 'Block 2', mode: 'daypicker', weeks: 6, routines: [{ name: 'B2 - Full', exercises: [{ name: 'Deadlift', sets: 3, reps: 5 }] }] },
] };
test('parseImport is pure and describes exactly what an import would do', () => {
  const app = loadApp();
  const before = app.run('JSON.stringify([S,Object.keys(SEC_MUSCLE).length])');
  app.set('__p', PROGRAM);
  const r = app.json('parseImport(__p)');
  assert.equal(app.run('JSON.stringify([S,Object.keys(SEC_MUSCLE).length])'), before, 'nothing in the app changed');
  assert.deepEqual(r.routines.map(x => x.name), ['B1 - Upper', 'B1 - Lower', 'B2 - Full']);
  const up = r.routines[0].exercises, lo = r.routines[1].exercises;
  assert.equal(up[0].exId, 'bb-bench'); assert.deepEqual([up[0].r, up[0].rMax, up[0].sets, up[0].rest], ['6', '8', 4, 150]);
  assert.equal(up[1]._how, 'new'); assert.equal(up[1].link, 'ss-1'); assert.equal(up[2].link, 'ss-1');
  assert.equal(up[3].link, null, 'a superset of one is not a superset');
  assert.equal(up[3].timed, true);
  assert.equal(lo[0]._newKey, up[1]._newKey, '"Curls" and "Curl" are one new exercise, not two');
  assert.deepEqual([lo[1].sets, lo[1].rest, lo[1].type], [20, null, 'flat'], 'out-of-range values are clamped or dropped');
  assert.equal(lo.length, 3, 'the nameless entry is skipped, the bare string is kept');
  assert.equal(lo[2].exId, 'leg-press');
  assert.deepEqual(r.newExercises.map(n => [n.name, n.cat, n.eq, n.muscle]), [['Bayesian Cable Curl', 'Biceps', 'Cable', 'Biceps'], ['Mystery Lift', 'Full Body', 'Other', '']]);
  assert.equal(r.groups[1].mode, 'rotation', 'fixed weekdays with no days given falls back to a rotation');
  assert.equal(r.timed, true);
  assert.ok(r.warnings.some(w => /Empty day/.test(w)) && r.warnings.some(w => /Soul/.test(w)) && r.warnings.some(w => /no name/.test(w)));
});
test('commitImport creates routines, groups, exercises and (optionally) the timed program', () => {
  const app = loadApp({ now: '2026-06-15T12:00:00' });
  app.set('__p', PROGRAM);
  app.run('__res=commitImport(parseImport(__p),{program:true})');
  const s = app.json('({r:S.routines,g:S.groups,c:S.custom,p:S.program,res:__res})');
  assert.equal(s.r.length, 3); assert.equal(s.c.length, 2); assert.equal(s.g.length, 2);
  const curl = s.c.find(c => c.name === 'Bayesian Cable Curl');
  assert.equal(s.r[0].exercises[1].exId, curl.id); assert.equal(s.r[1].exercises[0].exId, curl.id);
  assert.ok(!('_how' in s.r[0].exercises[0]) && !('_newKey' in s.r[0].exercises[1]), 'preview-only fields are not stored');
  assert.deepEqual(s.g[0].routineIds, [s.r[0].id, s.r[1].id]);
  assert.deepEqual(s.p.phases.map(ph => [ph.groupId, ph.weeks]), [[s.g[0].id, 4], [s.g[1].id, 6]]);
  assert.equal(s.p.startDate, '2026-06-15');
  assert.equal(s.g[0].active, true, 'the first phase is the active group');
  assert.equal(app.run(`getEx(${JSON.stringify(curl.id)}).name`), 'Bayesian Cable Curl');
});
test('re-importing with "replace" updates routines in place and keeps their history link', () => {
  const app = loadApp();
  app.set('__p', { routines: [{ name: 'Push', exercises: [{ name: 'Bench Press', sets: 3, reps: 5 }] }] });
  app.run('commitImport(parseImport(__p),{})');
  const id = app.run('S.routines[0].id');
  app.set('__p2', { routines: [{ name: 'push', exercises: [{ name: 'Bench Press', sets: 5, reps: 3 }, { name: 'Dips', sets: 3, reps: 'AMRAP' }] }] });
  assert.deepEqual(app.json('parseImport(__p2).dupes'), ['push']);
  app.run('commitImport(parseImport(__p2),{replace:true})');
  assert.equal(app.run('S.routines.length'), 1); assert.equal(app.run('S.routines[0].id'), id); assert.equal(app.run('S.routines[0].exercises.length'), 2);
  app.run('commitImport(parseImport(__p2),{})');
  assert.equal(app.run('S.routines.length'), 2, 'without replace, a second copy is added');
});
test('import refuses things that are not programs', () => {
  const app = loadApp();
  for (const bad of ['null', '42', '"x"', '{}', '{routines:[]}', '{routines:[{name:"x",exercises:[]}]}', '{groups:[{name:"g",routines:[]}]}']) assert.ok(app.json(`parseImport(${bad})`).error, bad);
});

test('AI: the model answer maps onto the import format, whatever its capitalisation', () => {
  const app = loadApp();
  app.set('__a', { summary: 's', groups: [{ name: 'G', mode: 'ROTATION', weeks: 0, routines: [{ name: 'G - A', notes: '', days: [], exercises: [
    { exId: 'SQUAT', name: 'whatever', equipment: 'BARBELL', muscle: 'quads', secondaryMuscles: ['GLUTES'], sets: 3, repsMin: 5, repsMax: 0, amrap: false, timed: false, rest: 180, type: 'FLAT', link: '', note: '' },
    { exId: 'NEW', name: 'Sissy Squat', equipment: 'bodyweight', muscle: 'QUADS', secondaryMuscles: [], sets: 2, repsMin: 12, repsMax: 15, amrap: false, timed: false, rest: 60, type: 'flat', link: '', note: 'slow' },
    { exId: 'made-up-id', name: 'Leg Press', equipment: 'Machine', muscle: 'Quads', secondaryMuscles: [], sets: 3, repsMin: 10, repsMax: 0, amrap: true, timed: false, rest: 90, type: 'flat', link: '', note: '' },
  ] }] }] });
  const r = app.json('parseImport(aiToImport(__a))');
  const e = r.routines[0].exercises;
  assert.equal(e[0].exId, 'squat'); assert.equal(e[0].rMax, '');
  assert.equal(e[1]._how, 'new'); assert.deepEqual([e[1].r, e[1].rMax, e[1].note], ['12', '15', 'slow']);
  assert.deepEqual(r.newExercises.map(n => [n.name, n.eq, n.muscle, n.cat]), [['Sissy Squat', 'Bodyweight', 'Quads', 'Legs']]);
  assert.equal(e[2].exId, 'leg-press', 'an id the catalog does not have falls back to the name');
  assert.equal(e[2].amrap, true); assert.equal(e[2].r, '10');
  assert.equal(r.groups[0].mode, 'rotation');
  assert.equal(app.run('aiToImport({nope:1})'), null);
});
test('AI: the request asks for a strict schema and carries no history', () => {
  const app = loadApp();
  app.state({ name: 'Kolbe', workouts: [{ id: 'w', started: Date.now(), exercises: [{ exId: 'squat', sets: [{ w: '405', r: '5', done: true }] }] }], custom: [{ id: 'custom-9', name: 'Z Press', cat: 'Shoulders', eq: 'Barbell', muscle: 'Shoulders' }, { id: 'custom-8', name: 'Old', cat: 'Legs', eq: 'Other', muscle: 'Quads', archived: true }] });
  const body = app.json(`aiRequestBody([{role:'user',content:aiFirstUserContent('4 day split',[],{days:'4',minutes:'60'})}],true)`);
  const sch = body.output_config.format.schema;
  const walk = (o, path) => {
    if (o.type === 'object') { assert.equal(o.additionalProperties, false, path); assert.deepEqual(o.required, Object.keys(o.properties), path + ' — every property required'); Object.entries(o.properties).forEach(([k, v]) => walk(v, path + '.' + k)); }
    if (o.type === 'array') walk(o.items, path + '[]');
    for (const banned of ['minimum', 'maximum', 'minLength', 'maxLength', 'pattern']) assert.ok(!(banned in o), `${path} uses unsupported "${banned}"`);
  };
  walk(sch, 'schema');
  const ids = sch.properties.groups.items.properties.routines.items.properties.exercises.items.properties.exId.enum;
  assert.ok(ids.includes('NEW') && ids.includes('custom-9') && !ids.includes('custom-8'), 'catalog + own exercises, not deleted ones');
  const text = body.messages[0].content[0].text;
  assert.match(text, /Training days per week: 4/); assert.match(text, /custom-9 \| Z Press \| Barbell \| Shoulders/);
  const all = JSON.stringify(body);
  assert.ok(!all.includes('405') && !all.includes('Kolbe'), 'no logged lifts, no name');
  assert.equal(app.json(`aiRequestBody([],false)`).output_config, undefined);
});
test('AI: attachments become image and document blocks ahead of the text', () => {
  const app = loadApp();
  const c = app.json(`aiFirstUserContent('',[{kind:'image',media:'image/jpeg',data:'QUJD'},{kind:'pdf',data:'REVG'}],{})`);
  assert.deepEqual(c.map(b => b.type), ['image', 'document', 'text']);
  assert.deepEqual(c[0].source, { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' });
  assert.equal(c[1].source.media_type, 'application/pdf');
  assert.match(c[2].text, /Convert the attached program/);
});
test('AI: API failures are explained in plain words', () => {
  const app = loadApp();
  assert.match(app.run(`aiErrorMessage(401,'invalid x-api-key')`), /key was rejected/);
  assert.match(app.run(`aiErrorMessage(404,'model: x')`), /model is not available/);
  assert.match(app.run(`aiErrorMessage(429,'')`), /rate-limiting/);
  assert.match(app.run(`aiErrorMessage(529,'')`), /overloaded/);
  assert.match(app.run(`aiErrorMessage(400,'messages: too long')`), /messages: too long/);
});
test('the example in docs/import-format.md imports without warnings', () => {
  const fs = require('fs'), path = require('path');
  const md = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'import-format.md'), 'utf8');
  const json = md.split('## Example')[1].match(/```json\n([\s\S]*?)```/)[1];
  const app = loadApp();
  app.set('__p', JSON.parse(json));
  const r = app.json('parseImport(__p)');
  assert.equal(r.error, undefined); assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.newExercises.map(n => n.name), ['Seated Leg Curl']);
  assert.equal(r.groups[0].mode, 'daypicker');
});
