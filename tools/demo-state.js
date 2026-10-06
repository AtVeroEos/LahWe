// A realistic demo save: eight weeks of an upper/lower split with meals, weigh-ins and a fitness test.
// Used for screenshots (tools/shots.js) and by tests that need history. Nothing here is personal data.
'use strict';

function demoState(nowMs) {
  const now = new Date(nowMs || Date.now());
  const pad = n => String(n).padStart(2, '0');
  const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const ago = (n, h, m) => { const d = new Date(now); d.setDate(d.getDate() - n); d.setHours(h == null ? 12 : h, m || 0, 0, 0); return d; };
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  let n = 0; const id = p => p + (++n).toString(36);

  // Routine entries: [exId, sets, r, rMax, rest, startWeight, weeklyStep]
  const R = {
    upperA: { name: 'Upper A', days: [1], ex: [['bb-bench', 4, 5, 7, 180, 185, 2.5], ['bb-row', 4, 6, 8, 150, 155, 2.5], ['ohp', 3, 6, 8, 150, 105, 1.25], ['lat-pd', 3, 8, 12, 90, 130, 2.5], ['db-curl', 3, 10, 12, 60, 30, 0.6], ['tri-pd', 3, 10, 12, 60, 50, 1.2]] },
    lowerA: { name: 'Lower A', days: [2], ex: [['squat', 4, 5, 7, 180, 245, 5], ['rdl', 3, 6, 8, 150, 205, 5], ['leg-press', 3, 10, 12, 120, 360, 10], ['leg-curl', 3, 10, 12, 75, 90, 2.5], ['calf-raise', 3, 12, 15, 60, 135, 2.5]] },
    upperB: { name: 'Upper B', days: [4], ex: [['inc-db-bench', 4, 8, 10, 120, 60, 1.2], ['pullup', 4, 6, 10, 150, 0, 0], ['db-ohp', 3, 8, 10, 120, 45, 0.6], ['cable-row', 3, 10, 12, 90, 140, 2.5], ['lat-raise', 3, 12, 15, 60, 20, 0.3], ['skull', 3, 10, 12, 60, 65, 1.2]] },
    lowerB: { name: 'Lower B', days: [5], ex: [['hex-dl', 4, 3, 5, 210, 295, 5], ['front-squat', 3, 6, 8, 150, 165, 2.5], ['lunge', 3, 8, 10, 90, 50, 1.2], ['leg-ext', 3, 12, 15, 60, 110, 2.5], ['plank', 3, 60, 0, 60, 0, 0]] },
  };
  const routines = Object.keys(R).map(k => ({
    id: 'r-' + k, name: R[k].name, notes: '', days: [],
    exercises: R[k].ex.map(e => ({ exId: e[0], sets: e[1], w: '', r: String(e[2]), rMax: e[3] ? String(e[3]) : '', type: 'flat', rest: e[4], timed: e[0] === 'plank' })),
  }));
  const dayMap = {}; Object.keys(R).forEach(k => { dayMap['r-' + k] = R[k].days; });
  const groups = [{ id: 'g-ul', name: 'Upper / Lower', mode: 'daypicker', routineIds: routines.map(r => r.id), cursor: 0, dayMap, active: true }];

  const round = (v, inc) => Math.round(v / inc) * inc;
  const workouts = [];
  const mk = (key, daysAgo, week, opts) => {
    const def = R[key]; const start = ago(daysAgo, 17, 30 + Math.floor(rnd() * 20));
    const exercises = def.ex.map(e => {
      const [exId, sets, r, rMax, , w0, step] = e;
      const timed = exId === 'plank'; const bw = exId === 'pullup';
      const inc = /db-|lat-raise|lunge/.test(exId) ? 2.5 : 5;
      const w = timed || bw ? 0 : round(w0 + step * week, inc);
      const out = [];
      if (/bb-bench|squat|hex-dl/.test(exId) && !timed) out.push({ w: String(round(w * 0.5, 5)), r: '8', done: true, warmup: true, tag: '' });
      for (let i = 0; i < sets; i++) {
        const top = rMax || r; const reps = timed ? 60 + week * 5 : Math.max(r - 1, Math.min(top, r + ((week + (i ? 0 : 1)) % (top - r + 2)) - (i > 1 ? 1 : 0)));
        out.push({ w: w ? String(w) : '', r: String(bw ? 6 + Math.min(4, Math.floor(week / 2)) - (i > 1 ? 1 : 0) : reps), done: true, tag: i === sets - 1 && rnd() < 0.25 ? 'Hard' : '' });
      }
      return { exId, sets: out, timed, target: { sets, r: String(r), rMax: rMax ? String(rMax) : '', amrap: false, timed } };
    });
    if (opts && opts.skipLast) exercises.pop();
    const mins = 52 + Math.floor(rnd() * 16);
    workouts.push({ id: id('w'), name: def.name, routineId: 'r-' + key, started: start.getTime(), ended: start.getTime() + mins * 60000, cals: 330 + Math.floor(rnd() * 90), exercises, notes: '' });
  };
  // Walk back eight weeks; train on Mon/Tue/Thu/Fri, with two missed sessions so the data is honest.
  const byDow = { 1: 'upperA', 2: 'lowerA', 4: 'upperB', 5: 'lowerB' };
  for (let d = 56; d >= 0; d--) {
    const day = ago(d); const key = byDow[day.getDay()]; if (!key) continue;
    if (d === 0) continue;                       // today is still to do
    if (d === 23 || d === 38) continue;          // missed
    mk(key, d, Math.floor((56 - d) / 7), d === 10 ? { skipLast: true } : null);
  }
  workouts.sort((a, b) => b.started - a.started);

  const bodyweightLog = [];
  for (let d = 56; d >= 0; d -= (d % 3 === 0 ? 1 : 2)) bodyweightLog.push({ date: dstr(ago(d)), weight: Math.round((193.4 - (56 - d) * 0.085 + (rnd() - 0.5) * 1.3) * 10) / 10 });
  bodyweightLog.sort((a, b) => (a.date < b.date ? 1 : -1));

  const meal = (date, type, name, p, c, f) => ({ id: id('m'), date, type, name: type, items: [{ foodId: null, name, qty: 1, serving: '1 serving', protein: p, carbs: c, fat: f, cals: Math.round(p * 4 + c * 4 + f * 9) }], protein: p, carbs: c, fat: f, cals: Math.round(p * 4 + c * 4 + f * 9) });
  const meals = [];
  for (let d = 13; d >= 0; d--) {
    const ds = dstr(ago(d)); const j = () => Math.round((rnd() - 0.5) * 12);
    meals.push(meal(ds, 'Breakfast', 'Eggs, oats and berries', 38 + j(), 62 + j(), 18));
    meals.push(meal(ds, 'Lunch', 'Chicken rice bowl', 52 + j(), 78 + j(), 16));
    if (d !== 0) { meals.push(meal(ds, 'Dinner', 'Salmon, potatoes, greens', 46 + j(), 58 + j(), 24)); if (d % 3) meals.push(meal(ds, 'Snack', 'Greek yogurt and whey', 36 + j(), 22, 4)); }
  }
  const stepsLog = {}; for (let d = 13; d >= 0; d--) stepsLog[dstr(ago(d))] = d === 0 ? 4120 : 6800 + Math.floor(rnd() * 4200);
  const activities = [
    { id: id('a'), date: dstr(ago(1)), type: 'run', dist: '3.1', dur: '27', cals: 352 },
    { id: id('a'), date: dstr(ago(4)), type: 'run', dist: '2', dur: '16', cals: 221 },
    { id: id('a'), date: dstr(ago(8)), type: 'ruck', dist: '4', dur: '62', ruckWeight: '35', cals: 498 },
    { id: id('a'), date: dstr(ago(11)), type: 'run', dist: '3.1', dur: '28', cals: 360 },
  ];
  const supps = [{ id: 's1', name: 'Creatine', dose: '5 g', timing: 'Morning' }, { id: 's2', name: 'Vitamin D', dose: '2000 IU', timing: 'Morning' }];
  const suppLogs = {}; for (let d = 6; d >= 1; d--) suppLogs[dstr(ago(d))] = { s1: true, s2: d % 2 === 0 };
  suppLogs[dstr(ago(0))] = { s1: true };

  return {
    _schema: 3, tab: 'workout', unit: 'lbs', name: 'Alex', bodyweight: 188.6, height: 71, onboarded: true, goal: 'strength',
    birthYear: now.getFullYear() - 29, birthMonth: 3, aftGender: 'male', aftStandard: 'general',
    aftCurrent: { MDL: '280', HRP: '34', SDC: '112', PLK: '150', '2MR': '950' },
    aftGoals: { MDL: '320', HRP: '45', SDC: '100', PLK: '190', '2MR': '880' },
    aftHistory: [], workouts, routines, groups, custom: [], prsManual: {},
    bodyweightLog, meals, stepsLog, activities, supps, suppLogs,
    macroGoals: { protein: 185, carbs: 260, fat: 75, cals: 2460 }, restGoals: { protein: 185, carbs: 195, fat: 75, cals: 2200 },
    starredFoods: ['qf_greek_yogurt', 'qf_chicken_breast', 'qf_egg'], recentFoods: ['qf_banana', 'qf_oatmeal', 'qf_whey'], weightGoal: 185, weightGoalDir: 'lose',
    testPlan: { date: dstr(ago(-44)), start: dstr(ago(12)), from: { MDL: '270', HRP: '31', SDC: '116', PLK: '140', '2MR': '965' } },
    lastExportAt: now.getTime() - 3 * 86400000, darkMode: false, primaryColor: 'navy',
    schedule: { type: 'weekly', weeklyDays: [1, 2, 4, 5], cycleOn: 2, cycleOff: 1, cycleStart: dstr(ago(56)), overrides: {}, routineOverrides: {} },
  };
}

module.exports = { demoState };
