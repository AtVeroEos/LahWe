'use strict';
// Prompts for a chat assistant, and reading what comes back: the answer is checked like a coach proposal
// and nothing changes until it is applied.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const fresh = () => { const app = loadApp({ now: '2026-10-08T09:00:00' }); app.state({ unit: 'lbs', bodyweight: 190 }); return app; };
const reply = (app, o) => app.json(`aiParseReply(${JSON.stringify(typeof o === 'string' ? o : JSON.stringify(o))})`);
const MEAL = { type: 'meal_plan', mode: 'update_days', note: 'Simple prep.', days: [{ day: 'Mon', meals: [
  { meal: 'Breakfast', name: 'Yogurt bowl', items: [{ name: 'Greek yogurt', serving: '1 cup', kcal: 130, protein: 23, carbs: 9, fat: 0 }] },
  { meal: 'Dinner', items: [{ name: 'Chicken breast', serving: '150 g', servings: 2, kcal: 250, protein: 46, carbs: 0, fat: 5 }] }] }] };

test('every prompt names its format; the workout one is the existing program prompt', () => {
  const app = fresh();
  for (const k of ['workout', 'meal_plan', 'targets', 'habits']) assert.ok(app.run(`aiPromptText(${JSON.stringify(k)})`).length > 300, k);
  assert.equal(app.run(`aiPromptText('workout')`), app.run('importPromptText()'));
  assert.match(app.run(`aiPromptText('meal_plan')`), /"type":"meal_plan"[\s\S]*Breakfast, Lunch, Dinner/);
  assert.match(app.run(`aiPromptText('targets')`), /weight_goal is in lb/);
  assert.match(app.run(`aiPromptText('habits')`), /"type":"habits"[\s\S]*trained/);
});

test('reading a reply: fenced or chatty JSON is found; each kind is told apart; junk is refused', () => {
  const app = fresh();
  assert.equal(reply(app, 'Sure!\n```json\n' + JSON.stringify(MEAL) + '\n```\nEnjoy').kind, 'meal_plan');
  assert.equal(reply(app, { type: 'targets', kcal: 2400, protein_g: 180, carbs_g: 250, fat_g: 70, reason: 'x' }).kind, 'targets');
  assert.equal(reply(app, { type: 'habits', habits: [{ kind: 'done', name: 'Read' }] }).kind, 'habits');
  assert.equal(reply(app, { routines: [{ name: 'A', exercises: [{ name: 'Barbell Bench Press', sets: 3, reps: '8' }] }] }).kind, 'workout');
  assert.ok(reply(app, 'no json here').error);
  assert.ok(reply(app, '{"type":"meal_plan","days":[').error);
  assert.ok(reply(app, { hello: 1 }).error);
});

test('meal plan: previewed without writing, then applied to only the listed days', () => {
  const app = fresh();
  const r = reply(app, MEAL);
  const pv = app.json(`aiPreview(${JSON.stringify(r)})`);
  assert.ok(!pv.error, pv.error);
  assert.equal(app.json('planHasMeals()'), false, 'preview writes nothing');
  assert.equal(app.json(`coachApplyProposal('propose_meal_plan',${JSON.stringify(r.data)}).ok`), true);
  assert.equal(app.json('S.mealPlan.days[1].length'), 2);
  assert.equal(app.json('S.mealPlan.days[1][1].items[0].qty'), 2);
  assert.equal(app.json('S.mealPlan.days[2].length'), 0);
});

test('meal plan: a food with numbers that do not add up is refused with the reason', () => {
  const app = fresh();
  const bad = JSON.parse(JSON.stringify(MEAL)); bad.days[0].meals[0].items[0].kcal = 900;
  const pv = app.json(`aiPreview(${JSON.stringify(reply(app, bad))})`);
  assert.match(pv.error, /does not fit/);
  const noDay = { type: 'meal_plan', days: [{ day: 'Funday', meals: [] }] };
  assert.match(app.json(`aiPreview(${JSON.stringify(reply(app, noDay))})`).error, /not a day/);
});

test('targets: macros must agree with kcal; a valid set changes the goals', () => {
  const app = fresh();
  const off = reply(app, { type: 'targets', kcal: 2400, protein_g: 100, carbs_g: 100, fat_g: 20, reason: 'x' });
  assert.match(app.json(`aiPreview(${JSON.stringify(off)})`).error, /add up/);
  const ok = reply(app, { type: 'targets', kcal: 2400, protein_g: 180, carbs_g: 250, fat_g: 75, weight_goal: 185, weight_goal_direction: 'lose', reason: 'cut' });
  assert.ok(!app.json(`aiPreview(${JSON.stringify(ok)})`).error);
  app.run(`coachApplyProposal('propose_targets',${JSON.stringify(ok.data)})`);
  assert.equal(app.json('S.macroGoals.cals'), 2400);
  assert.equal(app.json('S.weightGoal'), 185);
});

test('habits: valid ones are added, duplicates and bad rows are skipped and said so', () => {
  const app = fresh();
  const r = reply(app, { type: 'habits', habits: [
    { kind: 'done', name: 'Read 10 pages' }, { kind: 'amount', name: 'Water', target: 64, unit: 'oz' },
    { kind: 'done', name: 'read 10 pages' }, { kind: 'amount', name: 'No target' }, { kind: 'auto', auto: 'trained' }] });
  const pv = app.json(`aiPreview(${JSON.stringify(r)})`);
  assert.equal(pv.title, '3 habits');
  assert.equal(pv.lines.filter(l => l.startsWith('Skipped')).length, 2);
  app.run(`window._aiParsed=${JSON.stringify(r)};aiPasteApply()`);
  assert.equal(app.json('activeHabits().length'), 3);
});
