'use strict';
// The coach: its rules, what its tools return, what they refuse, and the conversation loop.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const KEY = 'sk-' + 'ant-' + 'api03-' + 'T'.repeat(40); // assembled at run time; not a real key
const at = iso => new Date(iso).getTime();
const set = (w, r, o) => Object.assign({ w: String(w), r: String(r), done: true }, o || {});
const wk = (id, iso, name, exs) => ({ id, name, routineId: 'r1', started: at(iso), ended: at(iso) + 50 * 60000, cals: 300, exercises: exs });

// A lifter with a few weeks of history. "Now" is Monday 15 June 2026, 12:00.
function rich(over) {
  const app = loadApp();
  app.state(Object.assign({
    name: 'Kolbe', unit: 'lbs', bodyweight: 190, height: 70, goal: 'strength', birthYear: 1994, aftGender: 'male',
    macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 },
    workouts: [
      wk('w3', '2026-06-13T18:00:00', 'Push', [{ exId: 'bb-bench', sets: [set(135, 8, { warmup: true }), set(225, 5), set(225, 5), set(225, 5)] }, { exId: 'ohp', sets: [set(135, 6, { tag: 'Pain' })] }]),
      wk('w2', '2026-06-09T18:00:00', 'Push', [{ exId: 'bb-bench', sets: [set(225, 5), set(225, 5), set(225, 5)] }]),
      wk('w1', '2026-06-02T18:00:00', 'Push', [{ exId: 'bb-bench', sets: [set(225, 5), set(225, 5), set(225, 4)] }]),
    ],
    routines: [{ id: 'r1', name: 'Push', notes: '', days: [], exercises: [{ exId: 'bb-bench', sets: 3, w: '', r: '5', type: 'flat', rest: 180 }, { exId: 'ohp', sets: 3, w: '', r: '8', rMax: '10', type: 'flat', rest: 120, note: 'strict' }] }],
    groups: [{ id: 'g1', name: 'PPL', mode: 'rotation', routineIds: ['r1'], cursor: 0, dayMap: {}, active: true }],
    bodyweightLog: [{ date: '2026-06-14', weight: 190 }, { date: '2026-06-07', weight: 191 }, { date: '2026-05-31', weight: 192 }],
    meals: [{ id: 'm1', date: '2026-06-14', type: 'Lunch', name: 'Lunch', items: [{ foodId: 'qf_egg', name: 'Egg (large)', qty: 3, serving: '1 egg', protein: 18, carbs: 1.8, fat: 15, cals: 216 }], protein: 18, carbs: 1.8, fat: 15, cals: 216 }],
    activities: [{ id: 'a1', type: 'run', date: '2026-06-12', dist: '3', dur: '27', cals: 350, notes: '' }],
    coachNotes: [{ id: 'n1', text: 'Left shoulder: no barbell overhead pressing', at: 1 }],
  }, over || {}));
  return app;
}
const run = (app, name, args) => { app.set('__a', args || {}); return app.json(`coachRunTool({id:'t1',name:${JSON.stringify(name)},args:__a})`); };
const snapshot = app => app.run('JSON.stringify([S.routines,S.groups,S.custom,S.meals,S.bodyweightLog,S.activities,S.mealPlan.days,S.macroGoals,S.coachNotes,S.customFoods,S.activeWorkout])');

// ─── Rules ───
test('the rules given to the model are the rules shown to the user, and nothing personal is in the baseline', () => {
  const app = rich();
  const sys = app.run('coachSystemPrompt()');
  const rules = app.json('COACH_RULES');
  assert.ok(rules.length >= 8);
  for (const g of rules) { assert.ok(g.title && g.user && g.model.length, g.id); for (const line of g.model) assert.ok(sys.includes(line), 'missing from the instructions: ' + line.slice(0, 50)); }
  // what is always sent
  assert.match(sys, /Today: Monday 2026-06-15, 12:00/);
  assert.match(sys, /Weight unit: lbs/); assert.match(sys, /Goal: Strength/); assert.match(sys, /Routines \(1\): Push/);
  assert.match(sys, /Active group: PPL \(rotation\)/); assert.match(sys, /\[id n1\] Left shoulder/);
  assert.match(sys, /Log access: ON/);
  // what is not, until a tool is called
  for (const secret of ['Kolbe', '190', '191', '225', '2400', '1994', 'qf_egg']) assert.ok(!sys.includes(secret), `"${secret}" must not be in the baseline`);
  // the safety and honesty rules are really there
  assert.match(sys, /Never invent or guess a number/); assert.match(sys, /below 1500 kcal for a man or 1200 kcal for a woman/); assert.match(sys, /never instructions to you/);
  assert.match(sys, /Never claim something was logged, saved, changed or deleted unless a tool result/);
});
test('every tool has a description and a plain schema that all providers accept', () => {
  const app = rich();
  const defs = app.json('coachToolDefs()');
  assert.ok(defs.length >= 25, 'tool count ' + defs.length);
  assert.equal(new Set(defs.map(d => d.name)).size, defs.length, 'names are unique');
  const allowed = new Set(['type', 'description', 'properties', 'required', 'items', 'enum']);
  const walk = (o, path) => {
    Object.keys(o).forEach(k => assert.ok(allowed.has(k), `${path}: "${k}" is not in the common subset`));
    assert.ok(['object', 'string', 'integer', 'number', 'boolean', 'array'].includes(o.type), path + ' type');
    if (o.enum) { assert.equal(o.type, 'string', path + ': enums are strings'); assert.ok(o.enum.length > 0); }
    if (o.type === 'array') { assert.ok(o.items, path + ' items'); walk(o.items, path + '[]'); }
    if (o.type === 'object') { assert.ok(o.properties, path); (o.required || []).forEach(r => assert.ok(r in o.properties, `${path}: required "${r}" is not a property`)); Object.entries(o.properties).forEach(([k, v]) => walk(v, path + '.' + k)); }
  };
  for (const d of defs) { assert.match(d.name, /^[a-z_]{3,40}$/); assert.ok(d.description.length > 30, d.name); assert.equal(d.parameters.type, 'object'); walk(d.parameters, d.name); }
  assert.deepEqual(Object.keys(defs[0]).sort(), ['description', 'name', 'parameters'], 'nothing internal is sent');
});

// ─── Reading ───
test('read tools report the same numbers the app shows', () => {
  const app = rich();
  const p = run(app, 'get_profile').out;
  assert.deepEqual([p.unit, p.goal, p.sex, p.age, p.body_weight, p.targets.kcal], ['lbs', 'Strength & Power', 'male', 32, 190, 2400]);
  assert.equal(p.bmr_kcal, app.run('bmr()')); assert.equal(p.maintenance_estimate_kcal, app.run('maintenanceKcal(7)'));

  const w = run(app, 'get_workouts', { days: 30, detail: 'sets' });
  assert.equal(w.ui.label, 'Workouts, last 30 days'); assert.equal(w.out.total_in_window, 3);
  assert.equal(w.out.workouts[0].exercises[0].sets, '225x5, 225x5, 225x5', 'warm-ups are left out');
  assert.equal(w.out.workouts[0].exercises[1].sets, '135x6 (Pain)');
  assert.equal(run(app, 'get_workouts', { days: 3, limit: 1 }).out.workouts.length, 1);

  const h = run(app, 'get_exercise_history', { exercise: 'bench press' }).out;
  assert.equal(h.exercise.id, 'bb-bench'); assert.equal(h.sessions.length, 3);
  assert.deepEqual([h.record.weight, h.record.reps, h.record.est_1rm], [225, 5, app.run('e1rm(225,5)')]);
  assert.equal(h.stalled, true, 'three sessions with the same estimated max');
  assert.match(h.app_suggestion, /add 5 lbs/);
  assert.equal(run(app, 'get_exercise_history', { exercise: 'ohp' }).out.pain_flagged_in_last_3_sessions, 1);
  const miss = run(app, 'get_exercise_history', { exercise: 'underwater basket weaving' });
  assert.equal(miss.isError, true); assert.equal(miss.ui, null, 'a failed lookup shows no "read" chip');

  const s = run(app, 'get_training_summary', { weeks: 4 }).out;
  assert.equal(s.muscles.Chest.last_7_days, 6); assert.equal(s.muscles.Chest.minimum, 8); assert.equal(s.muscles.Quads.status, 'untrained');
  assert.equal(s.days_since_last_workout, 2); assert.equal(s.next_routine, 'Push'); assert.deepEqual(s.stalled_lifts, [app.run(`exName('bb-bench')`)]);

  const r = run(app, 'get_routines', { name: 'push' }).out;
  assert.deepEqual(r.exercises.map(e => [e.exId, e.sets, e.target, e.rest]), [['bb-bench', 3, '5', 180], ['ohp', 3, '8–10', 120]]);
  assert.ok(r.est_minutes > 10);
  assert.equal(run(app, 'get_routines').out.groups[0].name, 'PPL');

  const n = run(app, 'get_nutrition', { days: 7, meals: true }).out;
  assert.equal(n.completed_days_logged, 1); assert.equal(n.average_of_logged_completed_days.kcal, 216);
  assert.equal(n.days.find(d => d.date === '2026-06-14').meals[0].id, 'm1');

  const b = run(app, 'get_body', { days: 30 }).out;
  assert.equal(b.weigh_ins_newest_first.length, 3); assert.equal(b.trend_4_weeks.change_per_week, app.json('weightTrend()').perWeek);

  assert.equal(run(app, 'get_activity', { days: 7 }).out.activities[0].miles, 3);
  assert.equal(run(app, 'get_records').out.records[0].exercise, app.run(`exName('bb-bench')`));
  assert.equal(run(app, 'get_current_workout').out.open, false);
  assert.equal(run(app, 'get_fitness_test').out.events.length, 5);
});
test('the exercise list respects the equipment setting and never offers a deleted exercise', () => {
  const app = rich({ equipPreset: 'dumbbells', custom: [{ id: 'custom-1', name: 'Z Press', cat: 'Shoulders', eq: 'Dumbbell', muscle: 'Shoulders' }, { id: 'custom-2', name: 'Gone', cat: 'Legs', eq: 'Dumbbell', muscle: 'Quads', archived: true }] });
  const c = run(app, 'get_exercise_catalog').out;
  const lines = c.exercises.split('\n');
  assert.ok(lines.every(l => / \| (Dumbbell|Bodyweight) \| /.test(l)), 'only the equipment they have');
  assert.ok(lines.some(l => l.startsWith('custom-1 | Z Press')) && !c.exercises.includes('custom-2'));
  assert.ok(run(app, 'get_exercise_catalog', { all_equipment: true }).out.count > c.count);
  assert.ok(run(app, 'get_exercise_catalog', { muscle: 'Chest', all_equipment: true }).out.exercises.split('\n').every(l => l.endsWith('| Chest')));
  assert.equal(run(app, 'get_exercise_catalog', { search: 'zzzz' }).out.count, 0);
  const f = run(app, 'search_foods', { query: 'chicken breast' }).out;
  assert.equal(f.foods[0].id, 'qf_chicken_breast'); assert.deepEqual([f.foods[0].kcal, f.foods[0].protein], [130, 26]);
});
test('with log access off the history tools are gone and the profile hides body stats', () => {
  const app = rich(); app.run('S.ai.logAccess=false');
  const names = app.json('coachToolDefs().map(t=>t.name)');
  for (const hidden of ['get_workouts', 'get_exercise_history', 'get_training_summary', 'get_records', 'get_nutrition', 'get_body', 'get_activity', 'get_fitness_test', 'get_current_workout']) assert.ok(!names.includes(hidden), hidden);
  for (const kept of ['get_profile', 'get_routines', 'get_exercise_catalog', 'get_meal_plan', 'search_foods', 'log_meal', 'propose_routines']) assert.ok(names.includes(kept), kept);
  const blocked = run(app, 'get_workouts', { days: 7 });
  assert.equal(blocked.isError, true); assert.match(blocked.out.error, /Log access is turned off/);
  const p = run(app, 'get_profile').out;
  assert.ok(!('body_weight' in p) && !('age' in p) && !('bmr_kcal' in p)); assert.equal(p.targets.kcal, 2400);
  assert.equal(run(app, 'get_routines').out.routines[0].last_done, undefined);
  assert.match(app.run('coachSystemPrompt()'), /Log access: OFF/);
});
test('unknown tools, broken arguments, crashes and huge results all come back as tidy errors', () => {
  const app = rich();
  assert.match(run(app, 'delete_everything').out.error, /no tool called/);
  assert.match(app.json(`coachRunTool({id:'x',name:'log_meal',args:{},bad:true})`).out.error, /not valid JSON/);
  app.run(`getStreak=()=>{throw new Error('boom sk-'+'x'.repeat(30))}`);
  const crash = run(app, 'get_training_summary');
  assert.equal(crash.isError, true); assert.match(crash.out.error, /hit an error/); assert.ok(!/x{20}/.test(crash.out.error));
  const big = app.json(`coachCap({a:'y'.repeat(50000)})`);
  assert.equal(big.truncated, true); assert.ok(big.partial.length <= 14000);
});

// ─── Small changes: done at once, undoable, validated ───
test('log_meal: built from the food list, added to the day, undoable; bad input changes nothing', () => {
  const app = rich();
  const before = snapshot(app);
  for (const [args, why] of [
    [{ meal: 'Brunch', items: [{ food_id: 'qf_egg' }] }, /meal must be one of/],
    [{ meal: 'Lunch', items: [] }, /items is empty/],
    [{ meal: 'Lunch', items: [{ food_id: 'qf_nope' }] }, /no food with id/],
    [{ meal: 'Lunch', date: '2026-06-16', items: [{ food_id: 'qf_egg' }] }, /future/],
    [{ meal: 'Lunch', date: 'last tuesday', items: [{ food_id: 'qf_egg' }] }, /not a date/],
    [{ meal: 'Lunch', date: '2024-01-01', items: [{ food_id: 'qf_egg' }] }, /more than a year ago/],
    [{ meal: 'Lunch', items: [{ name: 'Pizza', kcal: 2000, protein: 10, carbs: 20, fat: 5 }] }, /does not fit/],
  ]) { const r = run(app, 'log_meal', args); assert.equal(r.out.applied, false); assert.match(r.out.error, why); assert.equal(r.isError, true); }
  assert.equal(snapshot(app), before, 'nothing was written by the failed attempts');

  const ok = run(app, 'log_meal', { meal: 'Dinner', name: 'Chicken and eggs', items: [{ food_id: 'qf_chicken_breast', servings: 2, kcal: 1 }, { food_id: 'qf_egg', servings: 2 }] });
  assert.equal(ok.out.applied, true);
  assert.deepEqual([ok.out.logged.kcal, ok.out.logged.protein_g, ok.out.logged.contains_estimates], [404, 64, false], 'numbers come from the food list, not the model');
  assert.equal(ok.out.day_total.kcal, 404); assert.equal(ok.out.left_today.kcal, 1996);
  assert.equal(ok.ui.type, 'receipt'); assert.match(ok.ui.title, /Dinner: Chicken and eggs — 404 kcal/);
  const m = app.json('S.meals[S.meals.length-1]');
  assert.deepEqual([m.date, m.type, m.savedMealName, m.items.length], ['2026-06-15', 'Dinner', 'Chicken and eggs', 2]);
  app.set('__u', ok.ui.undo);
  assert.equal(app.run('coachUndo(__u)'), true); assert.equal(app.run('S.meals.length'), 1);
  assert.equal(app.run('coachUndo(__u)'), false, 'undoing twice is harmless');

  const est = run(app, 'log_meal', { meal: 'Snack', date: 'yesterday', items: [{ name: 'Trail mix', serving: '1 handful', kcal: 180, protein: 5, carbs: 15, fat: 12 }] });
  assert.equal(est.out.logged.contains_estimates, true); assert.equal(app.run('S.meals[S.meals.length-1].date'), '2026-06-14');
  assert.equal(est.out.left_today, undefined, 'no "left today" for another day');
});
test('log_weight: range and unit-mix-up guard, one reading a day, undo puts the old one back', () => {
  const app = rich();
  assert.match(run(app, 'log_weight', { weight: 20 }).out.error, /between 55 and 700/);
  assert.match(run(app, 'log_weight', { weight: 86 }).out.error, /more than 10% away from the last reading \(190 lbs/);
  assert.equal(app.run('S.bodyweightLog.length'), 3);
  const a = run(app, 'log_weight', { weight: 189.44 });
  assert.equal(a.out.applied, true); assert.equal(a.out.logged.weight, 189.4); assert.equal(app.run('S.bodyweight'), 189.4);
  const again = run(app, 'log_weight', { weight: 188, date: '2026-06-14' });
  assert.equal(again.out.replaced_earlier_reading_that_day, true); assert.equal(app.run('S.bodyweightLog.length'), 4);
  app.set('__u', again.ui.undo); app.run('coachUndo(__u)');
  assert.equal(app.run(`S.bodyweightLog.find(b=>b.date==='2026-06-14').weight`), 190, 'the earlier reading is back');
  app.set('__u', a.ui.undo); app.run('coachUndo(__u)');
  assert.equal(app.run('S.bodyweightLog.length'), 3); assert.equal(app.run('S.bodyweight'), 190);
  assert.equal(run(app, 'log_weight', { weight: 150, confirmed: true }).out.applied, true, 'a confirmed big change is allowed');
});
test('log_activity, notes and add_food', () => {
  const app = rich();
  assert.match(run(app, 'log_activity', { type: 'swim', miles: 1 }).out.error, /give minutes/);
  assert.match(run(app, 'log_activity', { type: 'sprint', minutes: 10 }).out.error, /unknown activity/);
  const act = run(app, 'log_activity', { type: 'run', miles: 3 });
  assert.equal(act.out.applied, true); assert.ok(act.out.logged.minutes > 0 && act.out.logged.kcal_estimate > 0, 'time and calories are estimated by the app');
  app.set('__u', act.ui.undo); app.run('coachUndo(__u)'); assert.equal(app.run('S.activities.length'), 1);

  assert.match(run(app, 'save_note', { text: ' ' }).out.error, /empty/);
  assert.match(run(app, 'save_note', { text: 'left shoulder: no barbell overhead pressing' }).out.error, /already saved/);
  const note = run(app, 'save_note', { text: 'No   fish. ' + 'x'.repeat(400) });
  assert.equal(note.out.applied, true); assert.equal(app.run('S.coachNotes[1].text.length'), 240);
  assert.match(app.run('coachSystemPrompt()'), /No fish\./);
  const rm = run(app, 'remove_note', { id: 'n1' });
  assert.equal(app.run('S.coachNotes.length'), 1);
  app.set('__u', rm.ui.undo); app.run('coachUndo(__u)'); assert.equal(app.run('S.coachNotes[0].id'), 'n1', 'restored in its old place');
  app.run(`for(let i=0;i<30;i++)S.coachNotes.push({id:'x'+i,text:'t'+i,at:0})`);
  assert.match(run(app, 'save_note', { text: 'one more' }).out.error, /already 20 notes|already \d+ notes/);

  assert.match(run(app, 'add_food', { name: 'Egg (large)', serving: '1', kcal: 72, protein: 6, carbs: 1, fat: 5 }).out.error, /already/);
  assert.match(run(app, 'add_food', { name: 'Skyr', serving: '1 cup' }).out.error, /required/);
  const food = run(app, 'add_food', { name: 'Skyr', serving: '1 cup', kcal: 130, protein: 22, carbs: 8, fat: 0.5 });
  assert.equal(food.out.applied, true); assert.match(food.out.added.id, /^cf_/);
  assert.equal(run(app, 'search_foods', { query: 'skyr' }).out.foods[0].id, food.out.added.id);
  app.set('__u', food.ui.undo); app.run('coachUndo(__u)'); assert.equal(app.run('S.customFoods.length'), 0);
});
test('with instant changes off, small changes wait for a tap like everything else', () => {
  const app = rich(); app.run('S.ai.instant=false');
  const before = snapshot(app);
  const r = run(app, 'log_meal', { meal: 'Lunch', items: [{ food_id: 'qf_egg', servings: 2 }] });
  assert.equal(r.out.applied, false); assert.match(r.out.status, /NOT done yet/);
  assert.deepEqual([r.ui.type, r.ui.status, r.ui.kind, r.ui.action], ['proposal', 'pending', 'log_meal', true]);
  assert.equal(snapshot(app), before);
  app.set('__args', r.ui.args);
  const done = app.json(`coachApplyProposal('log_meal',__args,{})`);
  assert.equal(done.ok, true); assert.equal(app.run('S.meals.length'), 2);
  assert.match(app.run('coachSystemPrompt()'), /shown as a card first/);
});

// ─── Big changes: proposed, checked, applied only on a tap ───
const PROGRAM = { summary: 'Two-day upper/lower.', groups: [{ name: 'Coach UL', mode: 'rotation', weeks: 0, daysPerWeek: 4, routines: [
  { name: 'Coach UL - Upper', notes: 'Leave a rep in reserve', exercises: [
    { exId: 'bb-bench', name: 'Bench', sets: 4, repsMin: 5, rest: 180 },
    { exId: 'NEW', name: 'Chest-Supported Row', equipment: 'Dumbbell', muscle: 'Lats', secondaryMuscles: ['Biceps'], sets: 4, repsMin: 8, repsMax: 12, rest: 120 },
    { exId: 'made-up', name: 'Plank', sets: 3, repsMin: 45, timed: true, rest: 60 }] },
  { name: 'Coach UL - Lower', exercises: [{ exId: 'squat', name: 'Squat', sets: 4, repsMin: 5, rest: 180 }, { exId: 'rdl', name: 'Romanian Deadlift', sets: 3, repsMin: 8, amrap: true, rest: 120 }] }] }] };
test('propose_routines: checked and described, nothing saved until applied', () => {
  const app = rich();
  const before = snapshot(app);
  const r = run(app, 'propose_routines', PROGRAM);
  assert.equal(snapshot(app), before, 'a proposal writes nothing');
  assert.deepEqual([r.out.proposed, r.out.applied], [true, false]); assert.match(r.out.status, /NOT applied/);
  assert.deepEqual(r.out.routines.map(x => [x.name, x.exercises, x.working_sets]), [['Coach UL - Upper', 3, 11], ['Coach UL - Lower', 2, 7]]);
  assert.ok(r.out.routines.every(x => x.est_minutes > 15 && x.est_minutes < 90));
  assert.deepEqual(r.out.new_custom_exercises, ['Chest-Supported Row']);
  const sets = r.out.groups[0].weekly_sets_if_each_routine_is_done_once;
  assert.equal(sets.Chest, 4); assert.equal(sets.Lats, 4); assert.equal(sets.Biceps, 2, 'secondary muscles of a new exercise count half');
  assert.equal(r.ui.title, '2 workouts in 1 split'); assert.equal(r.ui.summary, 'Two-day upper/lower.');
  assert.match(run(app, 'propose_routines', { summary: 'x', groups: [] }).out.error, /Nothing to import|No routines|expected/i);
  assert.match(run(app, 'propose_routines', { summary: 'x' }).out.error, /groups is missing/);

  app.set('__p', PROGRAM);
  const done = app.json(`coachApplyProposal('propose_routines',__p,{activate:true})`);
  assert.equal(done.ok, true); assert.match(done.message, /Added 2 workouts and 1 split/);
  const up = app.json(`S.routines.find(r=>r.name==='Coach UL - Upper')`);
  assert.deepEqual(up.exercises.map(e => [e.sets, e.r, e.rMax || '', !!e.timed]), [[4, '5', '', false], [4, '8', '12', false], [3, '45', '', true]]);
  assert.equal(app.run(`S.custom.find(c=>c.name==='Chest-Supported Row').muscle`), 'Lats');
  assert.equal(app.run('getActiveGroup().name'), 'Coach UL');
  // editing: the same names again, with replace
  const again = run(app, 'propose_routines', PROGRAM);
  assert.deepEqual(again.out.replaces_existing, ['Coach UL - Upper', 'Coach UL - Lower']);
  app.json(`coachApplyProposal('propose_routines',__p,{replace:true})`);
  assert.equal(app.run(`S.routines.filter(r=>r.name==='Coach UL - Upper').length`), 1, 'replaced in place, not duplicated');
});
test('propose_quick_workout: start now or save; never over an open workout', () => {
  const app = rich();
  const args = { name: '30-min Push', summary: 's', exercises: [{ exId: 'bb-bench', name: 'Bench', sets: 3, repsMin: 8, repsMax: 10, rest: 90, note: 'pause' }, { exId: 'NEW', name: 'Deficit Push-Up', equipment: 'Bodyweight', muscle: 'Chest', sets: 2, repsMin: 0, amrap: true, rest: 60 }] };
  const before = snapshot(app);
  const r = run(app, 'propose_quick_workout', args);
  assert.equal(snapshot(app), before);
  assert.equal(r.out.working_sets, 5); assert.ok(r.out.est_minutes >= 8 && r.out.est_minutes <= 20); assert.equal(r.out.workout_already_open, false);
  assert.match(r.ui.title, /^30-min Push — ~\d+ min$/);
  app.set('__q', args);
  const started = app.json(`coachApplyProposal('propose_quick_workout',__q,{})`);
  assert.deepEqual([started.ok, started.started], [true, true]);
  const w = app.json('S.activeWorkout');
  assert.deepEqual([w.name, w.routineId, w.exercises.length], ['30-min Push', null, 2]);
  assert.deepEqual([w.exercises[0].sets.filter(s => !s.warmup).length, w.exercises[0].target.r, w.exercises[0].target.rMax, w.exercises[0].note, w.exercises[0].rest], [3, '8', '10', 'pause', 90]);
  assert.equal(w.exercises[0].sets.find(s => !s.warmup).w, '225', 'loads still come from the lifter\'s own history');
  assert.equal(w.exercises[1].target.amrap, true);
  assert.equal(app.run('S.routines.length'), 1, 'starting it does not save a routine');
  assert.match(app.json(`coachApplyProposal('propose_quick_workout',__q,{})`).error, /Finish or discard/);
  assert.equal(run(app, 'propose_quick_workout', args).out.workout_already_open, true);
  const saved = app.json(`coachApplyProposal('propose_quick_workout',__q,{save:true})`);
  assert.match(saved.message, /Saved “30-min Push” as a routine/); assert.equal(app.run('S.routines.length'), 2);
});
const day = (d, meals) => ({ day: d, meals });
const meal = (m, name, items) => ({ meal: m, name, items });
test('propose_meal_plan: every item checked, totals reported against targets, applied only on a tap', () => {
  const app = rich({ macroGoals: { protein: 100, carbs: 100, fat: 50, cals: 1250 } });
  const bad = run(app, 'propose_meal_plan', { mode: 'replace_week', days: [day('Mon', [meal('Lunch', 'x', [{ food_id: 'qf_nope' }]), meal('Elevenses', 'y', [{ food_id: 'qf_egg' }])]), day('Funday', [])] });
  assert.equal(bad.out.proposed, false); assert.match(bad.out.error, /Mon Lunch: .*no food with id/); assert.match(bad.out.error, /Mon meal 2: meal must be one of/); assert.match(bad.out.error, /"Funday" is not a day/);
  assert.match(run(app, 'propose_meal_plan', { mode: 'replace_week', days: [] }).out.error, /days is empty/);

  const plan = { mode: 'replace_week', note: 'Batch cook chicken on Sunday.', days: [
    day('Mon', [meal('Breakfast', 'Eggs', [{ food_id: 'qf_egg', servings: 4 }]), meal('Dinner', 'Chicken', [{ food_id: 'qf_chicken_breast', servings: 7 }])]),
    day('Tue', [meal('Lunch', 'Light', [{ food_id: 'qf_egg', servings: 2 }])])] };
  const before = snapshot(app);
  const r = run(app, 'propose_meal_plan', plan);
  assert.equal(snapshot(app), before);
  assert.deepEqual(r.out.days.map(d => [d.day, d.meals, d.kcal, d.protein_g, d.kcal_vs_target]), [['Mon', 2, 1198, 206, '96%'], ['Tue', 1, 144, 12, '12%']]);
  assert.deepEqual(r.out.days_more_than_7pct_off_calories, ['Tue']); assert.deepEqual(r.out.days_below_protein_target, ['Tue']);
  assert.match(r.out.verdict, /propose again/);
  assert.equal(r.ui.title, 'Meal plan — 2 days');

  app.run(`S.mealPlan.days[3].push(cleanPlanMeal({type:'Snack',name:'old',items:[{name:'x',cals:100,qty:1}]}))`);
  app.set('__p', plan);
  const done = app.json(`coachApplyProposal('propose_meal_plan',__p,{})`);
  assert.equal(done.ok, true);
  assert.deepEqual(app.json('S.mealPlan.days.map(d=>d.length)'), [0, 2, 1, 0, 0, 0, 0], 'replace_week empties the days that were not listed');
  assert.equal(app.run('S.mealPlan.note'), 'Batch cook chicken on Sunday.');
  // update_days leaves the rest alone
  app.set('__u', { mode: 'update_days', days: [day('Wed', [meal('Dinner', 'New', [{ food_id: 'qf_egg', servings: 1 }])])] });
  app.json(`coachApplyProposal('propose_meal_plan',__u,{})`);
  assert.deepEqual(app.json('S.mealPlan.days.map(d=>d.length)'), [0, 2, 1, 1, 0, 0, 0]);
  assert.equal(run(app, 'get_meal_plan').out.days[0].meals[0].items[0].food_id, 'qf_egg', 'and the coach can read it back with ids');
});
test('propose_targets: floors, arithmetic that must add up, and a guard against crash diets', () => {
  const app = rich();
  const err = a => run(app, 'propose_targets', Object.assign({ reason: 'r' }, a)).out.error;
  assert.match(err({ kcal: 900 }), /Calories must be between 1500 and 6000/);
  assert.match(err({ kcal: 1400, protein_g: 120, carbs_g: 130, fat_g: 45 }), /Calories must be between 1500 and 6000/, 'the floor for a man');
  app.run(`S.aftGender='female'`);
  assert.match(err({ kcal: 900 }), /Calories must be between 1200 and 6000/, 'and the lower one for a woman');
  app.run(`S.aftGender='male'`);
  assert.match(err({ protein_g: 900 }), /Protein must be between/);
  assert.match(err({ kcal: 3000 }), /macros add up to 2350 kcal but the calorie target would be 3000/);
  // above the floor but still a crash diet for this body: 1,300 for a woman whose resting burn is about 1,650
  app.run(`S.aftGender='female'`);
  assert.match(err({ kcal: 1300, protein_g: 150, carbs_g: 100, fat_g: 35 }), /far below this person's resting burn/);
  app.run(`S.aftGender='male'`);
  assert.match(err({ kcal: 2400, protein_g: 180 }), /nothing would change/);
  assert.match(err({ weight_goal: 20 }), /weight_goal must be between/);
  const before = snapshot(app);
  const ok = run(app, 'propose_targets', { kcal: 2200, protein_g: 190, carbs_g: 210, fat_g: 65, weight_goal: 185, weight_goal_direction: 'lose', reason: 'Trend is flat; a 200 kcal cut.' });
  assert.equal(snapshot(app), before);
  assert.deepEqual(ok.ui.lines, ['Calories: 2400 → 2200 kcal', 'Protein: 180 → 190 g', 'Carbs: 250 → 210 g', 'Fat: 70 → 65 g', 'Weight goal: none → 185 lbs', 'Direction: not set → lose']);
  assert.ok(!('_next' in ok.out), 'internal fields are not sent to the model');
  app.set('__t', ok.ui.args);
  app.run(`__r=coachApplyProposal('propose_targets',__t,{})`);
  assert.deepEqual(app.json('[S.macroGoals,S.weightGoal,S.weightGoalDir]'), [{ protein: 190, carbs: 210, fat: 65, cals: 2200 }, 185, 'lose']);
  app.run('__r.restore()');
  assert.deepEqual(app.json('[S.macroGoals.cals,S.weightGoal]'), [2400, null], 'undo puts the old targets back');
});
test('propose_delete: names exactly what will go, deletes only on apply, and can be put back', () => {
  const app = rich();
  const before = snapshot(app);
  const r = run(app, 'propose_delete', { kind: 'routine', id: 'push', reason: 'replaced' });
  assert.equal(r.ui.title, 'Delete routine “Push”'); assert.match(r.ui.lines[0], /your 3 logged workouts from it stay in History/); assert.equal(r.ui.danger, true);
  assert.match(run(app, 'propose_delete', { kind: 'routine', id: 'nope' }).out.error, /no routine matches/);
  assert.match(run(app, 'propose_delete', { kind: 'meal', id: 'zz' }).out.error, /no logged meal/);
  assert.match(run(app, 'propose_delete', { kind: 'workout', id: 'w1' }).out.error, /unknown kind/, 'workout history cannot be deleted by the coach');
  assert.match(run(app, 'propose_delete', { kind: 'meal_plan' }).out.error, /no meal plan/);
  assert.equal(snapshot(app), before);
  app.set('__d', r.ui.args);
  app.run(`__r=coachApplyProposal('propose_delete',__d,{})`);
  assert.equal(app.run('S.routines.length'), 0); assert.deepEqual(app.json('S.groups[0].routineIds'), []); assert.equal(app.run('S.workouts.length'), 3, 'history is kept');
  app.run('__r.restore()');
  assert.equal(snapshot(app), before, 'restored exactly, including its place in the group');
  for (const [kind, id, check] of [['meal', 'm1', 'S.meals.length'], ['weigh_in', '2026-06-07', 'S.bodyweightLog.length'], ['activity', 'a1', 'S.activities.length']]) {
    const n = app.run(check); app.set('__d', { kind, id });
    app.run(`__r=coachApplyProposal('propose_delete',__d,{})`); assert.equal(app.run(check), n - 1, kind);
    app.run('__r.restore()'); assert.equal(app.run(check), n, kind + ' restored');
  }
  assert.equal(app.run('S.bodyweight'), 190);
});
test('a card is re-checked against the data as it is when tapped, not as it was when proposed', () => {
  const app = rich();
  const r = run(app, 'propose_delete', { kind: 'meal', id: 'm1' });
  app.run('S.meals=[]');
  app.set('__d', r.ui.args);
  assert.match(app.json(`coachApplyProposal('propose_delete',__d,{})`).error, /no logged meal/);
  assert.match(app.json(`coachApplyProposal('make_coffee',{},{})`).error, /not supported/);
});

// ─── The conversation loop ───
const claude = (...blocks) => ({ body: { content: blocks, stop_reason: blocks.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn', usage: { input_tokens: 1000, output_tokens: 50 } } });
const text = t => ({ type: 'text', text: t });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
function scripted(app, steps) {
  let i = 0;
  app.set('__k', KEY); app.run(`setAiKey('anthropic',__k)`);
  return app.mockFetch(() => steps[Math.min(i++, steps.length - 1)]);
}
const settle = async app => { for (let i = 0; i < 200 && app.run('Coach.busy'); i++) await new Promise(r => setImmediate(r)); };

test('a full exchange: the model reads, logs a meal, and answers; the chat that is stored holds no key', async () => {
  const app = rich();
  const reqs = scripted(app, [
    claude({ type: 'thinking', thinking: 'plan', signature: 'SIG' }, text('Checking.'), use('tu_1', 'get_nutrition', { days: 1 }), use('tu_2', 'search_foods', { query: 'egg' })),
    claude(use('tu_3', 'log_meal', { meal: 'Breakfast', items: [{ food_id: 'qf_egg', servings: 3 }] })),
    claude(text('Logged **3 eggs** — 216 kcal. You have 2,184 left today.')),
  ]);
  app.run(`Coach.attachments.push({kind:'image',media:'image/jpeg',data:'QUJD',name:'plate.jpg'})`);
  assert.equal(app.run(`coachSend('I had three eggs')`), true);
  await settle(app);
  assert.equal(app.run('Coach.error'), null);
  assert.equal(reqs.length, 3);
  // request 1: rules, tools, the user's message and photo
  assert.match(reqs[0].body.system[0].text, /RULES — these are shown to the user/);
  assert.equal(reqs[0].body.tools.length, app.run('coachToolDefs().length'));
  assert.deepEqual(reqs[0].body.messages[0].content.map(b => b.type), ['image', 'text']);
  // request 2: the model's own blocks (thinking included) replayed, then both results in one user message
  assert.deepEqual(reqs[1].body.messages[1].content.map(b => b.type), ['thinking', 'text', 'tool_use', 'tool_use']);
  assert.deepEqual(reqs[1].body.messages[2].content.map(b => [b.type, b.tool_use_id]), [['tool_result', 'tu_1'], ['tool_result', 'tu_2']]);
  assert.equal(JSON.parse(reqs[2].body.messages[4].content[0].content).applied, true);
  // what happened in the app
  assert.equal(app.run('S.meals.length'), 2); assert.equal(app.json('getDayTotals(today())').cals, 216);
  const turns = app.json('Coach.turns');
  assert.deepEqual(turns.map(t => t.role), ['user', 'assistant', 'tool', 'assistant', 'tool', 'assistant']);
  assert.deepEqual(turns[2].results.map(r => r.ui.type), ['read', 'read']); assert.equal(turns[4].results[0].ui.type, 'receipt');
  assert.deepEqual(turns[5].meta, { model: 'claude-sonnet-5-5', steps: 3, in: 3000, out: 150, cached: 0 });
  assert.ok(turns.every(t => !('raw' in t)), 'reasoning state is dropped once the answer is in');
  assert.deepEqual(turns[0].attachments, [{ kind: 'image', name: 'plate.jpg' }], 'the photo itself is not kept');
  const stored = app.ctx.localStorage.getItem('lahwe_coach_v1');
  assert.ok(stored.includes('I had three eggs') && !stored.includes(KEY) && !stored.includes('QUJD') && !stored.includes('SIG'));
  assert.ok(!app.run('backupJSON()').includes('I had three eggs'), 'the chat is not in backups');
  // the thread renders, with the markup escaped and the bold applied
  const html = app.run('coachThreadHTML()');
  assert.match(html, /Logged <b>3 eggs<\/b>/); assert.match(html, /<span>Read<\/span><i>Nutrition, today<\/i>/); assert.match(html, /coachReceiptUndo\(4,0\)/);
  // a later question does not resend the photo or the bulky old results
  app.run(`coachSend('thanks')`); await settle(app);
  const last = reqs[reqs.length - 1].body.messages;
  assert.deepEqual(last[0].content.map(b => b.type), ['text']); assert.match(last[0].content[0].text, /no longer available/);
  assert.match(last[2].content[1].content, /dropped to save space|foods/, 'old results are stubbed when large');
});
test('what the provider can cache is byte-for-byte the same from one question to the next, whatever the clock says', async () => {
  const app = rich();
  const reqs = scripted(app, [claude(text('One.')), claude(text('Two.'))]);
  app.run(`coachSend('first')`); await settle(app);
  app.setNow('2026-06-15T12:07:30'); // minutes later, and the user has saved a note in between
  app.run(`S.coachNotes.push({id:'n2',text:'No fish',at:2})`);
  app.run(`coachSend('second')`); await settle(app);
  const [a, b] = [reqs[0].body, reqs[1].body];
  assert.equal(JSON.stringify(a.tools), JSON.stringify(b.tools), 'tool descriptions unchanged');
  assert.equal(a.system[0].text, b.system[0].text, 'fixed instructions unchanged');
  assert.deepEqual(a.system[0].cache_control, { type: 'ephemeral' });
  assert.ok(a.system[0].text.length > 5000 && !/\d\d:\d\d local time/.test(a.system[0].text) && !a.system[0].text.includes('Left shoulder'), 'nothing that changes is in the cached block');
  assert.match(a.system[1].text, /12:00 local time/); assert.match(b.system[1].text, /12:07 local time/); assert.match(b.system[1].text, /No fish/);
  assert.ok(!('cache_control' in a.system[1]), 'the changing block is never the cache boundary');
  assert.equal(app.run('coachSystemPrompt()'), app.run(`coachRulesPrompt()+'\\n\\n'+coachContextPrompt()`));
});
test('the loop stops after a fixed number of steps instead of running up a bill', async () => {
  const app = rich();
  const reqs = scripted(app, [claude(use('tu_x', 'get_profile', {}))]);
  app.run(`coachSend('loop forever')`); await settle(app);
  assert.equal(reqs.length, app.run('COACH_MAX_STEPS'));
  const last = app.json('Coach.turns[Coach.turns.length-1]');
  assert.equal(last.role, 'assistant'); assert.match(last.text, /I stopped after 8 steps/);
});
test('a newer proposal replaces the older one made for the same message; taps are reported to the model next time', async () => {
  const app = rich();
  const q = n => ({ name: n, exercises: [{ exId: 'bb-bench', name: 'Bench', sets: 3, repsMin: 5, rest: 90 }] });
  const reqs = scripted(app, [claude(use('a', 'propose_quick_workout', q('First try'))), claude(use('b', 'propose_quick_workout', q('Second try'))), claude(text('Here is a shorter one — tap Start.')), claude(text('Good.'))]);
  app.run(`coachSend('quick push workout')`); await settle(app);
  assert.deepEqual(app.json(`Coach.turns.filter(t=>t.role==='tool').map(t=>t.results[0].ui.status)`), ['replaced', 'pending']);
  assert.equal(app.run('S.activeWorkout'), null, 'proposing started nothing');
  const html = app.run('coachThreadHTML()');
  assert.match(html, /Replaced by a newer version/); assert.match(html, /Nothing has changed yet/);
  app.run('coachCardDismiss(4,0)');
  assert.equal(app.run('Coach.turns[4].results[0].ui.status'), 'dismissed');
  app.run('coachCardApply(4,0)'); assert.equal(app.run('S.activeWorkout'), null, 'a dismissed card cannot be applied');
  app.run(`coachSend('ok')`); await settle(app);
  const lastUser = reqs[reqs.length - 1].body.messages.filter(m => m.role === 'user').pop();
  assert.match(lastUser.content[lastUser.content.length - 1].text, /^\[App note: The user dismissed your proposal "Second try — ~\d+ min" without applying it\.\]\n\nok$/);
});
test('applying a card from the chat changes the app once and records it', async () => {
  const app = rich();
  scripted(app, [claude(use('a', 'propose_targets', { kcal: 2300, protein_g: 185, carbs_g: 230, fat_g: 70, reason: 'small cut' })), claude(text('Tap Apply.'))]);
  app.run(`coachSend('trim my calories a little')`); await settle(app);
  assert.equal(app.run('S.macroGoals.cals'), 2400);
  app.run('coachCardApply(2,0)');
  assert.equal(app.run('S.macroGoals.cals'), 2300);
  assert.deepEqual(app.json('[Coach.turns[2].results[0].ui.status,Coach.turns[2].results[0].ui.go]'), ['applied', 'nutrition']);
  app.run('coachCardApply(2,0)'); assert.equal(app.run('S.macroGoals.cals'), 2300, 'a second tap does nothing');
  assert.match(app.run('Coach.events[0]'), /applied your proposal "New targets"/);
  assert.match(JSON.parse(app.ctx.localStorage.getItem('lahwe_coach_v1')).turns[2].results[0].ui.status, /applied/);
});
test('a provider error is shown without the key, and the chat can be retried from where it stopped', async () => {
  const app = rich();
  const reqs = scripted(app, [claude(use('a', 'get_profile', {})), { status: 401, body: { error: { message: `invalid x-api-key ${KEY}` } } }, claude(text('Recovered.'))]);
  app.run(`Coach.attachments.push({kind:'image',media:'image/jpeg',data:'UEhPVE9CWVRFUw',name:'p.jpg'})`);
  app.run(`coachSend('hello')`); await settle(app);
  assert.ok(!app.ctx.localStorage.getItem('lahwe_coach_v1').includes('UEhPVE9CWVRFUw'), 'attachment bytes are never written to storage, even mid-conversation');
  assert.equal(app.run('Coach.turns[0].attachments[0].data'), 'UEhPVE9CWVRFUw', 'but they are still in memory so a retry can resend them');
  assert.match(app.run('Coach.error'), /Claude rejected the API key/); assert.ok(!app.run('Coach.error').includes(KEY));
  assert.deepEqual(app.json('Coach.turns.map(t=>t.role)'), ['user', 'assistant', 'tool']);
  assert.ok(!app.run('coachThreadHTML()').includes(KEY));
  app.run('coachRetry()'); await settle(app);
  assert.equal(app.run('Coach.error'), null); assert.equal(app.run('Coach.turns[3].text'), 'Recovered.');
  assert.equal(reqs.length, 3); assert.equal(reqs[2].body.messages.length, 3, 'the retry resumes; it does not start over');
});
test('a chat cut off mid-step is closed off on the next launch so any provider can read it', () => {
  const app = rich();
  app.ctx.localStorage.setItem('lahwe_coach_v1', JSON.stringify({ v: 1, turns: [{ role: 'user', text: 'hi' }, { role: 'assistant', text: '', calls: [{ id: 'c1', name: 'get_profile', args: {} }], raw: { wire: 'anthropic', data: [1] } }, { role: 'tool', results: [{ id: 'c1', name: 'get_profile', out: {}, ui: { type: 'read', label: 'Profile' } }] }, { nonsense: true }] }));
  app.run('Coach.loaded=false;coachLoad()');
  assert.deepEqual(app.json('Coach.turns.map(t=>t.role)'), ['user', 'assistant', 'tool', 'assistant']);
  assert.match(app.run('Coach.turns[3].text'), /interrupted/); assert.equal(app.run(`'raw' in Coach.turns[1]`), false);
  app.ctx.localStorage.setItem('lahwe_coach_v1', '{broken');
  app.run('Coach.loaded=false;coachLoad()'); assert.equal(app.run('Coach.turns.length'), 0);
});
test('nothing is sent and nothing breaks when the coach is not set up, the box is empty, or a reply is already on its way', async () => {
  const app = rich();
  const reqs = app.mockFetch(() => claude(text('x')));
  assert.equal(app.run(`coachSend('hello')`), false, 'no key');
  assert.deepEqual(app.json('Coach.pending'), { text: 'hello' }, 'the message waits for setup');
  app.set('__k', KEY); app.run(`setAiKey('anthropic',__k)`);
  assert.equal(app.run(`coachSend('   ')`), false);
  assert.equal(app.run(`coachSend('x'.repeat(13000))`), false);
  assert.equal(reqs.length, 0);
  app.run('coachAfterSetup()'); assert.equal(app.run(`coachSend('second')`), false, 'busy');
  await settle(app);
  assert.equal(reqs.length, 1); assert.deepEqual(app.json('Coach.turns.map(t=>t.text)'), ['hello', 'x']);
});
test('text from the model and from the user is escaped before it is shown', () => {
  const app = rich();
  const evil = '<img src=x onerror=alert(1)> **bold** `code` </div><script>alert(2)</script>\n- item "quoted"\n1. one\n# Heading';
  const html = app.run(`mdLite(${JSON.stringify(evil)})`);
  assert.ok(!/<img|<script|<\/div><script/.test(html), html);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; <b>bold<\/b> <code>code<\/code>/);
  assert.match(html, /<div class="md-li"><span>•<\/span><div>item &quot;quoted&quot;<\/div><\/div>/);
  assert.match(html, /<div class="md-li"><span>1\.<\/span>/); assert.match(html, /<div class="md-h">Heading<\/div>/);
  app.set('__t', [{ role: 'user', text: evil, attachments: [{ kind: 'image', name: '"><svg onload=alert(3)>' }] }, { role: 'assistant', text: evil, calls: [], meta: { model: '<b>m</b>', steps: 1, in: 1, out: 1 } },
    { role: 'tool', results: [{ id: 'x', name: 'n', out: {}, ui: { type: 'read', label: evil } }, { id: 'y', name: 'n', out: {}, ui: { type: 'receipt', title: evil, lines: [evil], undo: null } }, { id: 'z', name: 'n', out: {}, ui: { type: 'proposal', kind: 'propose_targets', status: 'pending', title: evil, lines: [evil], summary: evil, args: {} } }, { id: 'l', name: 'n', out: {}, ui: { type: 'link', screen: '"><script>' } }] }]);
  app.run('Coach.turns=__t;Coach.error=' + JSON.stringify(evil));
  const thread = app.run('coachThreadHTML()');
  assert.ok(!/<img|<script|<svg/.test(thread), 'no raw markup anywhere in the thread');
});
