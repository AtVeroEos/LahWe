'use strict';
// A made-up training log for testing Patterns: about ten months of lifting, runs, food and
// weigh-ins, with effects planted on purpose (or none at all). Seeded, so every run is the same.
//   makeLog(seed, { rest: 3 })          lifts 3% better after a day off
//   makeLog(seed, { cardioLegs: -3 })   leg lifts 3% lower the day after a run
//   makeLog(seed, { restWeight: 0.8 })  0.8 lb heavier the morning after a rest day
//   makeLog(seed, { sleep: -3 })        lifts 3% lower after a short night (adds a sleep log)
//   makeLog(seed, { cardioUpper: -4 })  upper-body lifts lower after a run (what a placebo check catches)
//   loose: true                         training days vary, so a condition is not welded to one workout
const NOW = '2026-10-07T12:00:00';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function makeLog(seed, fx) {
  fx = fx || {}; const r = rng(seed); const weeks = fx.weeks || 40; const now = new Date(NOW);
  const ds = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const workouts = [], bw = [], activities = [], meals = [], sleepLog = {};
  const plan = { 1: ['squat', 'rdl'], 2: ['bb-bench', 'bb-row'], 4: ['squat', 'ohp'], 5: ['bb-bench', 'bb-row'] };
  const base = { squat: 250, rdl: 200, 'bb-bench': 180, 'bb-row': 150, ohp: 100 };
  let trainedY = false, cardioY = false, carbsY = 250;
  for (let d = weeks * 7; d >= 1; d--) {
    const day = new Date(now); day.setDate(day.getDate() - d); const dow = day.getDay(); const key = ds(day);
    const prog = (weeks * 7 - d) / 7; // weeks in
    // weight: slow loss + noise + planted bump after rest days
    const w = 195 - prog * 0.25 + gauss(r) * 0.7 + (fx.restWeight && !trainedY ? fx.restWeight : 0) + (fx.carbWeight ? (carbsY - 250) / 100 * fx.carbWeight : 0);
    if (r() < 0.9) bw.push({ date: key, weight: Math.round(w * 10) / 10 });
    const carbs = Math.max(80, 250 + gauss(r) * 70); const cals = Math.round(1100 + carbs * 4 + gauss(r) * 150);
    meals.push({ id: 'm' + d, date: key, type: 'Lunch', name: 'x', protein: 170, carbs: Math.round(carbs), fat: 60, cals });
    const cardio = (dow === 3 || dow === 6) && r() < 0.8; // Wed and Sat runs
    if (cardio) activities.push({ id: 'a' + d, type: 'run', date: key, dist: '3.1', dur: String(Math.round((27 - prog * 0.05 + gauss(r) * 0.5) * 10) / 10) });
    let trained = false;
    const planned = fx.loose ? (r() < 0.58 ? [['squat', 'rdl'], ['bb-bench', 'bb-row'], ['squat', 'ohp'], ['bb-bench', 'bb-row']][Math.floor(r() * 4)] : null) : (plan[dow] && r() < 0.92 ? plan[dow] : null);
    if (planned) {
      trained = true; const t = new Date(day); t.setHours(fx.hours ? (r() < 0.5 ? 7 : 18) : 18, 0, 0, 0);
      const short = fx.sleep ? r() < 0.4 : false; if (fx.sleep) sleepLog[key] = short ? 6 : 8;
      const boost = (fx.rest && !trainedY ? fx.rest : 0) + (short ? fx.sleep : 0);
      workouts.push({ id: 'w' + d, name: 'W' + dow, started: t.getTime(), ended: t.getTime() + 3.3e6, routineId: null,
        exercises: planned.map(id => {
          const leg = id === 'squat' || id === 'rdl';
          const e1 = base[id] * (1 + prog * 0.004) * (1 + (gauss(r) * 2 + boost + (fx.cardioLegs && leg && cardioY ? fx.cardioLegs : 0) + (fx.cardioUpper && !leg && cardioY ? fx.cardioUpper : 0)) / 100);
          const wgt = Math.round(e1 / (1 + 5 / 30) / 2.5) * 2.5;
          return { exId: id, sets: [{ w: String(wgt), r: '5', done: true, t: t.getTime() + 6e5 }, { w: String(wgt), r: '5', done: true, t: t.getTime() + 9e5 }] };
        }) });
    }
    trainedY = trained; cardioY = cardio; carbsY = carbs;
  }
  workouts.sort((a, b) => b.started - a.started); bw.sort((a, b) => a.date < b.date ? 1 : -1);
  return { workouts, bodyweightLog: bw, activities, meals, sleepLog, macroGoals: { protein: 170, carbs: 250, fat: 60, cals: 2200 }, onboarded: true };
}
module.exports = { makeLog, NOW };
