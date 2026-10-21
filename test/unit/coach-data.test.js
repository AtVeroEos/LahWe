'use strict';
// The coach's data tables (query_data), the data sheet, and the tool groups that keep each step small.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { loadApp } = require('../harness.js');
const { sheet, OUT } = require('../../tools/data-sheet.js');

const KEY = 'sk-' + 'ant-' + 'api03-' + 'Q'.repeat(40); // assembled at run time; not a real key
const at = iso => new Date(iso).getTime();
const set = (w, r, o) => Object.assign({ w: String(w), r: String(r), done: true }, o || {});
const wk = (id, iso, exs, o) => Object.assign({ id, name: 'Push', routineId: 'r1', started: at(iso), ended: at(iso) + 50 * 60000, cals: 300, exercises: exs }, o || {});

// "Now" is Monday 15 June 2026, 12:00.
function rich(over) {
  const app = loadApp();
  app.state(Object.assign({
    unit: 'lbs', bodyweight: 190, height: 70, goal: 'strength', birthYear: 1994,
    macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 },
    workouts: [
      wk('w3', '2026-06-13T18:00:00', [{ exId: 'bb-bench', sets: [set(135, 8, { warmup: true }), set(225, 5, { rir: '1' }), set(225, 5, { tag: 'Hard' })] }, { exId: 'ohp', sets: [set(135, 6, { tag: 'Pain' })] }], { feel: 4 }),
      wk('w2', '2026-06-09T18:00:00', [{ exId: 'bb-bench', sets: [set(225, 5), set(225, 5), set(225, 5)] }], { feel: 2 }),
      wk('w1', '2026-06-02T18:00:00', [{ exId: 'bb-bench', sets: [set(220, 5), set(220, 5), set(220, 4)] }]),
    ],
    routines: [{ id: 'r1', name: 'Push', notes: '', days: [], exercises: [{ exId: 'bb-bench', sets: 3, w: '', r: '5', type: 'flat', rest: 180 }] }],
    groups: [{ id: 'g1', name: 'PPL', mode: 'rotation', routineIds: ['r1'], cursor: 0, dayMap: {}, active: true }],
    bodyweightLog: [{ date: '2026-06-14', weight: 190 }, { date: '2026-06-07', weight: 191 }, { date: '2026-05-31', weight: 192 }],
    sleepLog: { '2026-06-13': 6, '2026-06-14': 8 }, moodLog: { '2026-06-14': 4, '2026-06-13': 3 }, stepsLog: { '2026-06-14': 9000 },
    meals: [{ id: 'm1', date: '2026-06-14', type: 'Lunch', items: [{ foodId: 'qf_egg', name: 'Egg (large)', qty: 3, serving: '1 egg', protein: 18, carbs: 1.8, fat: 15, cals: 216 }], protein: 18, carbs: 1.8, fat: 15, cals: 216 }],
    activities: [{ id: 'a1', type: 'run', date: '2026-06-12', dist: '3', dur: '27', cals: 350, notes: '' }],
    supps: [{ id: 's1', name: 'Creatine', dose: '5 g', timing: '' }], suppLogs: { '2026-06-14': { s1: true } },
  }, over || {}));
  return app;
};
const q = (app, args) => { app.set('__q', args); return app.json('coachQuery(__q)'); };

// ─── The tables ───
test('every table builds without error, and every row has exactly the columns the sheet lists', () => {
  const app = rich();
  for (const name of app.json('Object.keys(QD_TABLES)')) {
    const r = q(app, { table: name, from: '400', limit: 200 });
    assert.ok(!r.isError, name + ': ' + JSON.stringify(r.out).slice(0, 200));
    assert.deepEqual(r.out.columns, app.json(`Object.keys(QD_TABLES[${JSON.stringify(name)}].cols)`), name);
    r.out.rows.forEach(row => assert.equal(row.length, r.out.columns.length, name));
  }
});
test('daily puts each day side by side, with nulls (not zeros) where nothing was logged', () => {
  const app = rich();
  const r = q(app, { table: 'daily', from: '2026-06-13', to: '2026-06-14' }).out;
  const row = d => Object.fromEntries(r.columns.map((c, i) => [c, r.rows.find(x => x[0] === d)[i]]));
  const sat = row('2026-06-13'), sun = row('2026-06-14');
  assert.equal(r.rows[0][0], '2026-06-14', 'newest first');
  assert.deepEqual([sat.trained, sat.sessions, sat.working_sets, sat.feel, sat.sleep_h, sat.mood, sat.kcal], [true, 1, 3, 4, 6, 3, null]);
  assert.deepEqual([sun.trained, sun.kcal, sun.protein_g, sun.weight, sun.sleep_h, sun.steps, sun.supplements_taken], [false, 216, 18, 190, 8, 9000, 1]);
});
test('sets are working sets only, with the app\'s own e1RM; warm-ups never appear', () => {
  const app = rich();
  const r = q(app, { table: 'sets', where: [{ col: 'exercise', op: 'contains', value: 'bench' }], from: '30' }).out;
  assert.equal(r.rows_matched, 8);
  const i = r.columns.indexOf('e1rm'), w = r.columns.indexOf('weight');
  assert.ok(!r.rows.some(x => x[w] === 135), 'no warm-up');
  assert.equal(r.rows.find(x => x[w] === 225)[i], app.run('e1rm(225,5)'));
});
test('grouping and sums are done by the app, per week, month or weekday', () => {
  const app = rich();
  const r = q(app, { table: 'daily', from: '2026-06-01', to: '2026-06-14', group_by: ['week'], aggregate: [{ fn: 'sum', col: 'sessions' }, { fn: 'avg', col: 'weight' }, { fn: 'count' }] }).out;
  assert.deepEqual(r.columns, ['week', 'sum_sessions', 'avg_weight', 'count']);
  assert.deepEqual(r.rows, [['2026-06-08', 2, 190, 7], ['2026-06-01', 1, 191, 7]], 'newest group first, Monday weeks');
  const best = q(app, { table: 'sets', from: '60', group_by: ['exercise'], aggregate: [{ fn: 'max', col: 'e1rm' }, { fn: 'distinct', col: 'date' }], sort: '-max_e1rm' }).out;
  assert.deepEqual(best.rows[0], ['Barbell Bench Press', app.run('e1rm(225,5)'), 3]);
  const total = q(app, { table: 'meals', from: '30', aggregate: [{ fn: 'sum', col: 'kcal' }] }).out;
  assert.deepEqual(total.rows, [[216]], 'without group_by: one total row');
  const none = q(app, { table: 'meals', from: '2026-01-01', to: '2026-01-31', aggregate: [{ fn: 'sum', col: 'kcal' }] }).out;
  assert.deepEqual(none.rows, [[null]]); assert.match(none.note, /Nothing in this range/);
});
test('filters compare numbers as numbers, text case-insensitively, and booleans as booleans', () => {
  const app = rich();
  assert.equal(q(app, { table: 'daily', from: '30', where: [{ col: 'trained', value: 'true' }] }).out.rows_matched, 3);
  assert.equal(q(app, { table: 'sets', from: '30', where: [{ col: 'reps', op: '<', value: '5' }] }).out.rows_matched, 1);
  assert.equal(q(app, { table: 'sets', from: '30', where: [{ col: 'tag', op: 'in', value: 'hard, pain' }] }).out.rows_matched, 2);
  assert.equal(q(app, { table: 'daily', from: '30', where: [{ col: 'weekday', value: 'Sat' }] }).out.rows_matched, 5, 'May 16 to June 13');
});
test('mistakes come back as errors that name what would work', () => {
  const app = rich();
  const e1 = q(app, { table: 'sets', where: [{ col: 'load', value: '1' }] });
  assert.equal(e1.isError, true); assert.match(e1.out.error, /Columns: date, workout/);
  assert.match(q(app, { table: 'nope' }).out.error, /Tables: daily/);
  assert.match(q(app, { table: 'daily', from: 'last week' }).out.error, /not a date/);
  assert.match(q(app, { table: 'daily', aggregate: [{ fn: 'median', col: 'kcal' }] }).out.error, /must be one of/);
  assert.match(q(app, { table: 'daily', group_by: ['week'], sort: 'kcal' }).out.error, /sort must be one of/);
});
test('dates: days back, future clamped except on the schedule, which looks ahead by default', () => {
  const app = rich();
  const d = q(app, { table: 'daily', from: '6', to: '+5' }).out;
  assert.deepEqual([d.from, d.to], ['2026-06-09', '2026-06-15']);
  const s = q(app, { table: 'schedule' }).out;
  assert.deepEqual([s.from, s.to, s.rows_matched], ['2026-06-15', '2026-06-28', 14]);
});
test('results stay inside the size cap and say how many more there are', () => {
  const app = rich();
  const r = q(app, { table: 'daily', from: '400', limit: 200 }).out;
  assert.ok(JSON.stringify(r).length <= app.run('QD_CHARS'));
  assert.ok(r.rows.length < 200 && /more not shown/.test(r.more), r.more);
  assert.equal(q(app, { table: 'daily', from: '30', limit: 5 }).out.rows.length, 5);
});
test('with log access off only the setup tables remain, and the history ones refuse', () => {
  const app = rich(); app.run('S.ai.logAccess=false');
  const tool = app.json('coachToolDefs(new Set()).find(t=>t.name==="query_data")');
  assert.deepEqual(tool.parameters.properties.table.enum.sort(), ['formulas', 'pauses', 'schedule', 'settings']);
  const r = q(app, { table: 'sets' });
  assert.equal(r.isError, true); assert.match(r.out.error, /Log access is turned off/);
  assert.match(JSON.stringify(q(app, { describe: true }).out), /tables built from the user's logs are hidden/);
});
test('settings are readable, and nothing key-shaped or private is in any table', () => {
  const app = rich();
  app.set('__k', KEY); app.run(`setAiKey('anthropic',__k)`);
  app.run(`S.coachNotes=[{id:'n1',text:'secret note',at:1}]`);
  const all = app.json('Object.keys(QD_TABLES)').map(name => JSON.stringify(q(app, { table: name, from: '400', limit: 200 }).out)).join('\n');
  assert.ok(!all.includes(KEY) && !all.includes('secret note'));
  const st = q(app, { table: 'settings', where: [{ col: 'setting', value: 'unit' }] }).out;
  assert.deepEqual(st.rows[0].slice(0, 2), ['unit', 'lbs']);
});
test('describe explains a table with its formulas, and the run label names the table', () => {
  const app = rich();
  const d = q(app, { table: 'sets', describe: true }).out;
  assert.equal(d.columns.e1rm.startsWith('estimated max'), true);
  assert.ok(d.formulas.some(f => f.name === 'e1rm' && /Epley/.test(f.how)));
  const r = app.json(`coachRunTool({id:'t',name:'query_data',args:{table:'daily',from:'7'}})`);
  assert.equal(r.ui.label, 'Data: daily');
});
test('the data sheet in docs/ is the one the code makes', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), sheet(), 'run npm run sheet');
  assert.match(sheet(), /### sets[\s\S]*\| `e1rm` \|/);
});

// ─── Tool groups ───
test('a plain question sends only the core; building tools come with their group', () => {
  const app = rich();
  const core = app.json('coachToolDefs(new Set()).map(t=>t.name)');
  for (const n of ['get_workouts', 'log_meal', 'propose_targets', 'propose_delete', 'query_data', 'load_tools', 'show_link']) assert.ok(core.includes(n), n);
  for (const n of ['propose_routines', 'propose_quick_workout', 'get_exercise_catalog', 'propose_meal_plan', 'add_food', 'propose_habit']) assert.ok(!core.includes(n), n);
  const build = app.json('coachToolDefs(new Set(["build"])).map(t=>t.name)');
  assert.ok(build.includes('propose_routines') && !build.includes('propose_meal_plan'));
  const coreRules = app.run('coachRulesPrompt(new Set())'), buildRules = app.run('coachRulesPrompt(new Set(["build"]))');
  assert.ok(!/Put compound lifts first/.test(coreRules) && /Put compound lifts first/.test(buildRules));
  assert.match(coreRules, /Progress conservatively/, 'advice rules stay in the core');
  assert.match(coreRules, /use query_data/);
  const fixed = app.run('coachFixedTokens()'), all = app.run('coachFixedTokens(new Set(Object.keys(COACH_GROUPS)))');
  assert.ok(fixed < 5500 && all - fixed > 2500, `core ${fixed}, everything ${all}`);
});
test('the message picks the groups', () => {
  const app = rich();
  const r = t => app.json(`coachRouteGroups(${JSON.stringify(t)})`);
  assert.deepEqual(r('how was my week?'), []);
  assert.deepEqual(r('I had three eggs'), []);
  assert.deepEqual(r('how is my bench going'), []);
  assert.deepEqual(r('Build me a 4-day program'), ['build']);
  assert.deepEqual(r('give me a 30-minute workout'), ['build']);
  assert.deepEqual(r('swap squats for something easier on my knee'), ['build']);
  assert.deepEqual(r('Change my meal plan: more fish'), ['meals']);
  assert.deepEqual(r('add this protein bar to my foods'), ['meals']);
  assert.deepEqual(r('which habit should I add?'), ['habits']);
});

// ─── In the conversation ───
const claude = (...blocks) => ({ body: { content: blocks, stop_reason: blocks.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn', usage: { input_tokens: 1000, output_tokens: 50 } } });
const text = t => ({ type: 'text', text: t });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
function scripted(app, steps) { let i = 0; app.set('__k', KEY); app.run(`setAiKey('anthropic',__k)`); return app.mockFetch(() => steps[Math.min(i++, steps.length - 1)]); }
const settle = async app => { for (let i = 0; i < 200 && app.run('Coach.busy'); i++) await new Promise(r => setImmediate(r)); };
const names = req => req.body.tools.map(t => t.name);

test('the model can load a group itself; it arrives on the next step and stays for the chat', async () => {
  const app = rich();
  const reqs = scripted(app, [
    claude(use('tu_1', 'load_tools', { groups: ['meals'] })),
    claude(text('Ready to plan.')),
    claude(text('Sure.')),
  ]);
  app.run(`coachSend('dinner ideas for the week?')`); await settle(app);
  assert.ok(!names(reqs[0]).includes('propose_meal_plan'), 'not sent at first');
  assert.ok(names(reqs[1]).includes('propose_meal_plan'), 'sent from the next step');
  app.run(`coachSend('thanks')`); await settle(app);
  assert.ok(names(reqs[2]).includes('propose_meal_plan'), 'still there for the rest of the chat');
  assert.match(reqs[1].body.system[0].text, /A day of a meal plan should land/, 'the group\'s rules come with it');
  assert.ok(!/Put compound lifts first/.test(reqs[2].body.system[0].text));
  assert.equal(app.run('coachLoadedGroups().has("meals")'), true);
  // a stored chat remembers it
  app.run('Coach.loaded=false;coachLoad()');
  assert.equal(app.run('coachLoadedGroups().has("meals")'), true);
});
test('a starter or the message loads its group before the first request, and query_data runs in the loop', async () => {
  const app = rich();
  const reqs = scripted(app, [
    claude(use('tu_1', 'query_data', { table: 'daily', from: '14', group_by: ['week'], aggregate: [{ fn: 'avg', col: 'protein_g' }] })),
    claude(text('Fine.')),
  ]);
  app.run(`coachSend('Build me a program and tell me my weekly protein')`); await settle(app);
  assert.ok(names(reqs[0]).includes('propose_routines'), 'build sent on the first request');
  const res = JSON.parse(reqs[1].body.messages[2].content[0].content);
  assert.deepEqual(res.columns, ['week', 'avg_protein_g']);
  app.run('coachClear()');
  const reqs2 = scripted(app, [claude(text('ok'))]);
  app.run(`coachSend('A plain question',{groups:['habits']})`); await settle(app);
  assert.ok(names(reqs2[0]).includes('propose_habit'));
});
test('a card proposed earlier still applies, whatever is loaded now', () => {
  const app = rich();
  const r = app.json(`coachApplyProposal('propose_habit',{kind:'done',name:'Read 10 pages',reason:'x'})`);
  assert.equal(r.ok, true);
});
test('everyday talk about a workout does not load the building tools', () => {
  const app = rich();
  for (const t of ['I did a workout this morning', 'how was my workout?', 'log a 3 mile run']) assert.deepEqual(app.json(`coachRouteGroups(${JSON.stringify(t)})`), [], t);
  assert.deepEqual(app.json(`coachRouteGroups("give me a workout for today")`), ['build']);
});
