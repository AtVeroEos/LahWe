'use strict';
// 3.4: barcode numbers, foods you can create and correct, editing meals, past days, training and
// rest day targets, and "what fits". The camera itself is covered by test/e2e/scanner.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-15T18:30:00'; // a Monday evening
const day = n => { const d = new Date(NOW); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const at = (n, h) => { const d = new Date(NOW); d.setDate(d.getDate() - n); d.setHours(h == null ? 17 : h, 0, 0, 0); return d.getTime(); };
const meal = (id, date, type, p, c, f, items) => ({ id, date, type, name: type, protein: p, carbs: c, fat: f, cals: Math.round(p * 4 + c * 4 + f * 9), items });
const workout = (id, n) => ({ id, name: 'W', started: at(n), ended: at(n) + 3e6, exercises: [{ exId: 'squat', sets: [{ w: '200', r: '5', done: true }] }] });
// Stand-ins for a few page elements; everything else behaves as the harness normally does.
const els = (app, map) => { const orig = app.ctx.__get || (app.ctx.__get = app.ctx.document.getElementById); app.ctx.document.getElementById = id => (Object.prototype.hasOwnProperty.call(map, id) ? map[id] : orig(id)); };
const fields = v => { const m = {}; ['fe-name', 'fe-serving', 'fe-pro', 'fe-carb', 'fe-fat', 'fe-cal'].forEach(id => { m[id] = { value: v[id] != null ? String(v[id]) : '', style: {} }; }); m['fe-note'] = { style: {}, textContent: '' }; return m; };
const nut = over => { const app = loadApp({ now: NOW }); app.state(Object.assign({ tab: 'nutrition', macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 } }, over || {})); return app; };

// ─── Barcode numbers ───
test('check digits: real barcodes pass, a single wrong digit does not', () => {
  const app = loadApp({ now: NOW });
  for (const good of ['4006381333931', '036000291452', '0036000291452', '96385074', '00012345678905']) assert.equal(app.run(`gtinCheck('${good}')`), true, good);
  for (const bad of ['4006381333932', '036000291453', '4006381333', 'abc', '']) assert.equal(app.run(`gtinCheck('${bad}')`), false, bad);
  assert.equal(app.run(`barcodeProblem('4006381333931')`), '');
  assert.match(app.run(`barcodeProblem('4006381333932')`), /last digit does not match/);
  assert.match(app.run(`barcodeProblem('12345')`), /8, 12 or 13 digits\. That was 5/);
  assert.match(app.run(`barcodeProblem('40063813A3931')`), /digits only/);
  // every single-digit typo in a valid code is caught
  const code = '036000291452';
  for (let i = 0; i < code.length; i++) { const d = code.slice(0, i) + ((+code[i] + 1) % 10) + code.slice(i + 1); assert.notEqual(app.run(`barcodeProblem('${d}')`), '', d); }
});
test('the short UPC-E on small packages expands to the full number, and one product is found under every way of writing it', () => {
  const app = loadApp({ now: NOW });
  assert.equal(app.run(`upceToUpca('01234565')`), '012345000065');
  assert.equal(app.run(`upceToUpca('04252614')`), '042100005264');
  assert.equal(app.run(`upceToUpca('12345678')`), '123456000078', 'expanded by rule even when its check digit is wrong');
  assert.equal(app.run(`upceToUpca('91234567')`), null, 'UPC-E starts with 0 or 1');
  assert.equal(app.run(`barcodeProblem('04252614')`), '', 'a valid UPC-E is accepted');
  assert.deepEqual(app.json(`barcodeForms('036000291452')`), ['036000291452', '0036000291452']);
  assert.deepEqual(app.json(`barcodeForms('0036000291452')`), ['0036000291452', '036000291452']);
  assert.deepEqual(app.json(`barcodeForms('4006381333931')`), ['4006381333931'], 'a true EAN-13 has one form');
  assert.deepEqual(app.json(`barcodeForms('04252614')`), ['04252614', '042100005264', '0042100005264']);
  const prod = { name: 'Soda', brand: '', serving: '1 can', servingG: 355, per100: { protein: 0, carbs: 11, fat: 0, cals: 39 }, perServing: { protein: 0, carbs: 39, fat: 0, cals: 140 } };
  app.set('__p', prod); app.run(`cacheProduct('036000291452',__p)`);
  assert.equal(app.json(`cachedProductFor('0036000291452')`).barcode, '036000291452', 'saved with 12 digits, found with 13');
  assert.equal(app.json(`cachedProductFor('4006381333931')`), null);
  assert.equal(app.run(`cleanBarcode("0123'\\");alert(1)//")`), '0123alert1', 'ids stay safe to put in markup');
});
test('the scanner reads product barcodes only, and the reader file shipped with the app is the pinned one', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'js', '53-scanner.js'), 'utf8');
  const formats = src.match(/POSSIBLE_FORMATS,\[([^\]]+)\]/)[1];
  assert.deepEqual(formats.split(',').map(s => s.trim().replace('Z.BarcodeFormat.', '')), ['EAN_13', 'UPC_A', 'EAN_8', 'UPC_E'], 'no warehouse formats: those turned blur into made-up numbers');
  assert.ok(!/decodeFromVideoElement|BrowserMultiFormatReader|\.reset\(\)/.test(src), 'the library is never handed the video element (that path never started decoding)');
  const lib = fs.readFileSync(path.join(__dirname, '..', '..', 'vendor', 'zxing.min.js'));
  const sri = 'sha384-' + crypto.createHash('sha384').update(lib).digest('base64');
  assert.ok(src.includes(`const SCAN_LIB_SRI='${sri}'`), 'the integrity hash in the app matches the vendored file');
  assert.ok(fs.readFileSync(path.join(__dirname, '..', '..', 'dist', 'zxing.min.js')).equals(lib), 'the built copy is byte-for-byte the vendored one');
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'public', 'sw.js'), 'utf8'), /'zxing\.min\.js'/, 'and it is kept for offline use');
  // camera request comes before any wait in the tap handler
  const open = src.slice(src.indexOf('function showBarcodeScanner'), src.indexOf('function scanConstraints')).replace(/\/\/.*$/gm, '');
  const beforeStart = open.slice(0, open.indexOf('startScanner(0)'));
  assert.ok(open.includes('startScanner(0)') && !/\bawait\b|setTimeout|\.then\(/.test(beforeStart), 'nothing delays the camera request after the tap');
});
test('each way the phone can refuse the camera has its own plain explanation', () => {
  const app = loadApp({ now: NOW });
  assert.match(app.run(`scanErrorText('NotAllowedError')`), /Settings → Apps → Safari → Camera/);
  assert.match(app.run(`scanErrorText('NotReadableError')`), /busy/);
  assert.match(app.run(`scanErrorText('NotFoundError')`), /No usable camera/);
  assert.match(app.run(`scanErrorText('Whatever')`), /did not start/);
  assert.deepEqual(app.json(`[0,1,2,9].map(l=>Object.keys(scanConstraints(l).video||{}).length)`), [3, 1, 0, 0], 'settings get looser on each retry');
  app.run('teardownScanner();teardownScanner()'); // safe when nothing is open
});

// ─── Your own foods ───
test('a food can be created, corrected and deleted by hand; logged meals keep their own numbers', () => {
  const app = nut();
  const fill = v => els(app, fields(v));
  app.run(`showFoodEditor({})`);
  fill({ 'fe-name': '  Rice Cake ', 'fe-serving': '2 cakes', 'fe-pro': 2, 'fe-carb': 16, 'fe-fat': 0.5 });
  assert.equal(app.json('foodEdRead()').cals, 77, 'calories are worked out when left blank');
  app.run('saveFoodEditor()');
  let foods = app.json('S.customFoods');
  assert.equal(foods.length, 1);
  assert.deepEqual([foods[0].name, foods[0].serving, foods[0].protein, foods[0].cals], ['Rice Cake', '2 cakes', 2, 77]);
  assert.match(foods[0].id, /^cf_/);
  const id = foods[0].id;
  assert.equal(app.run(`isCustomFood(${JSON.stringify(id)})`), true); assert.equal(app.run(`isCustomFood('qf_egg')`), false);
  // log it, then correct it: the logged meal does not change
  els(app, {});
  app.run(`quickLogFood(${JSON.stringify(id)});doQuickLog('Snack')`);
  app.run(`showFoodEditor({id:${JSON.stringify(id)}})`);
  fill({ 'fe-name': 'Rice Cake', 'fe-serving': '2 cakes', 'fe-pro': 3, 'fe-carb': 16, 'fe-fat': 0.5, 'fe-cal': 80 });
  app.run('saveFoodEditor()');
  assert.equal(app.json('S.customFoods').length, 1, 'edited in place, not duplicated');
  assert.equal(app.json(`findFood(${JSON.stringify(id)})`).protein, 3);
  assert.equal(app.json('S.meals[0].protein'), 2, 'what was already logged keeps the numbers it was logged with');
  // empty name or no numbers is refused
  app.run(`showFoodEditor({})`); fill({ 'fe-name': '', 'fe-pro': 5 }); app.run('saveFoodEditor()');
  app.run(`showFoodEditor({})`); fill({ 'fe-name': 'Air' }); app.run('saveFoodEditor()');
  assert.equal(app.json('S.customFoods').length, 1);
  // delete: gone from the list, stars and recents
  els(app, {});
  app.run(`toggleStar(${JSON.stringify(id)});deleteCustomFood(${JSON.stringify(id)})`);
  assert.deepEqual(app.json('[S.customFoods.length,S.starredFoods.length,S.recentFoods.length,S.meals.length]'), [0, 0, 0, 1]);
});
test('correcting a scanned product updates what the next scan reads; deleting it forgets the barcode', () => {
  const app = nut();
  const fill = v => els(app, fields(v));
  app.set('__p', { name: 'Bar', brand: 'Acme', serving: '1 bar', servingG: 50, per100: { protein: 20, carbs: 40, fat: 10, cals: 330 }, perServing: { protein: 10, carbs: 20, fat: 5, cals: 165 } });
  app.run(`cacheProduct('036000291452',__p)`);
  app.run(`showFoodEditor({barcode:'036000291452',preset:{name:'Bar (Acme)',serving:'1 bar',protein:10,carbs:20,fat:5,cals:165}})`);
  fill({ 'fe-name': 'Bar (Acme)', 'fe-serving': '1 bar', 'fe-pro': 15, 'fe-carb': 20, 'fe-fat': 5, 'fe-cal': 185 });
  app.run('saveFoodEditor()');
  const hit = app.json(`cachedProductFor('0036000291452')`); // looked up the other way round
  assert.deepEqual([hit.product.perServing.protein, hit.product.perServing.cals, hit.product.manual], [15, 185, true]);
  assert.deepEqual(hit.product.per100, { protein: 0, carbs: 0, fat: 0, cals: 0 }, 'per-100 g is left empty rather than guessed');
  assert.equal(app.json('S.customFoods[0]').id, 'cf_036000291452');
  // a wrong calorie figure is flagged, not blocked
  const f = fields({ 'fe-pro': 15, 'fe-carb': 20, 'fe-fat': 5, 'fe-cal': 900 }); els(app, f);
  app.run('foodEdCheck()');
  assert.match(f['fe-note'].textContent, /add up to about 185 kcal, not 900/);
  els(app, {});
  app.run(`deleteCustomFood('cf_036000291452')`);
  assert.equal(app.json(`cachedProductFor('036000291452')`), null);
});

// ─── Meals ───
test('quick log takes an amount, suggests the likely meal from the clock, and logs to the day on screen', () => {
  const app = nut();
  assert.equal(app.run('likelyMealType()'), 'Dinner');
  for (const [t, want] of [['07:10', 'Breakfast'], ['12:30', 'Lunch'], ['15:45', 'Snack'], ['23:15', 'Snack']]) { app.setNow('2026-06-15T' + t + ':00'); assert.equal(app.run('likelyMealType()'), want, t); }
  app.setNow(NOW);
  app.run(`quickLogFood('qf_egg')`); els(app, { 'ql-qty': { value: '2.5' } }); app.run(`doQuickLog('Breakfast')`);
  const egg = app.json(`findFood('qf_egg')`);
  let m = app.json('S.meals[0]');
  assert.equal(m.items[0].qty, 2.5);
  assert.equal(m.protein, Math.round(egg.protein * 2.5 * 10) / 10); assert.equal(m.cals, Math.round(egg.cals * 2.5));
  assert.equal(m.date, day(0));
  // a past day on screen: the log goes there
  els(app, {});
  app.run(`window._nutDay='${day(2)}'`);
  assert.equal(app.run('nutDay()'), day(2));
  app.run(`quickLogFood('qf_egg');doQuickLog('Snack')`);
  assert.equal(app.json('S.meals[1]').date, day(2));
  assert.equal(app.json('S.meals[1]').items[0].qty, 1, 'one serving when no amount is set');
  // arriving on Nutrition from elsewhere always starts on today; a future or junk date is ignored
  app.run(`go('workout')`); assert.equal(app.run('nutDay()'), day(0), 'only the Nutrition tab can be on another day');
  app.run(`go('nutrition')`); assert.equal(app.run('nutDay()'), day(0));
  app.run(`window._nutDay='2999-01-01'`); assert.equal(app.run('nutDay()'), day(0));
  app.run(`setNutDay('${day(3)}');nutDayStep(1)`); assert.equal(app.run('nutDay()'), day(2));
  app.run(`nutDayStep(5)`); assert.equal(app.run('nutDay()'), day(0), 'cannot step into the future');
});
test('a logged meal opens in the builder per serving and is replaced in place when saved', () => {
  const app = nut({ meals: [
    meal('m0', day(0), 'Breakfast', 10, 10, 2),
    { id: 'm1', date: day(0), type: 'Lunch', name: 'Lunch', savedMealName: 'Bowl', planMealId: 'p9',
      items: [{ foodId: 'qf_chicken_breast', name: 'Chicken Breast', qty: 2, serving: '4 oz', protein: 52, carbs: 0, fat: 6, cals: 260 }, { foodId: 'qf_white_rice', name: 'Rice', qty: 1.5, serving: '1 cup', protein: 6, carbs: 67.5, fat: 0.6, cals: 308 }],
      protein: 63, carbs: 72.5, fat: 8.6, cals: 608 }, // 5 g protein, 5 g carbs, 2 g fat, 40 kcal were typed in on top of the foods
    meal('m2', day(0), 'Dinner', 30, 30, 10)] });
  const fields = { 'meal-pro': { value: '' }, 'meal-carb': { value: '' }, 'meal-fat': { value: '' }, 'meal-cal': { value: '' } };
  els(app, Object.assign({ 'meal-date': { value: day(0) }, 'meal-type-sel': { value: 'Dinner' }, 'manual-entry': { style: { display: 'none' } } }, fields));
  app.run(`editMeal('m1')`);
  assert.deepEqual(app.json('_mealItems.map(i=>[i.qty,i.protein,i.cals])'), [[2, 26, 130], [1.5, 4, 205.33333333333334]], 'totals are divided back to one serving');
  assert.deepEqual([fields['meal-pro'].value, fields['meal-carb'].value, fields['meal-fat'].value, fields['meal-cal'].value], [5, 5, 2, 40], 'the hand-typed part comes back in the manual fields');
  assert.deepEqual(app.json('window._mealEdit'), { id: 'm1', type: 'Lunch' });
  // change an amount and save: same id, same position, new totals, moved to Dinner
  app.run(`adjMealItem(0,-1);saveMeal()`);
  const meals = app.json('S.meals');
  assert.deepEqual(meals.map(m => m.id), ['m0', 'm1', 'm2'], 'the meal stays where it was');
  assert.equal(meals[1].type, 'Dinner');
  assert.equal(meals[1].items[0].qty, 1);
  assert.equal(meals[1].protein, 26 + 6 + 5); assert.equal(meals[1].cals, 130 + 308 + 40);
  assert.equal(meals[1].savedMealName, 'Bowl');
  assert.equal(app.run('window._mealEdit'), null);
  // a meal typed in as macros only opens with those macros
  Object.keys(fields).forEach(k => { fields[k].value = ''; });
  app.run(`editMeal('m0')`);
  assert.deepEqual([app.json('_mealItems.length'), fields['meal-pro'].value, fields['meal-cal'].value], [0, 10, 98]);
  app.run(`editMeal('nope')`);
});

// ─── Training days and rest days ───
test('one set of targets until rest-day targets are switched on; then each day uses the right set', () => {
  const app = nut({ workouts: [workout('w1', 1)] });
  assert.equal(app.run('hasRestGoals()'), false);
  assert.deepEqual(app.json(`goalsFor('${day(3)}')`), { protein: 180, carbs: 250, fat: 70, cals: 2400 }, 'off: every day is the same');
  assert.deepEqual(app.json('suggestRestGoals()'), { protein: 180, carbs: 190, fat: 70, cals: 2160 }, 'same protein and fat, about a quarter fewer carbs, calories follow');
  app.run('S.restGoals=suggestRestGoals()');
  // no fixed weekly schedule: trained = training day; a past day without a workout = rest; today = training until told otherwise
  assert.deepEqual(app.json(`[0,1,2].map(n=>dayKind(daysAgoStr(n)))`), ['train', 'train', 'rest']);
  assert.equal(app.json(`goalsFor('${day(2)}')`).cals, 2160); assert.equal(app.json(`goalsFor('${day(1)}')`).cals, 2400);
  // your own choice for a day wins, and a choice that matches the default is not stored
  app.run(`setDayKind('${day(0)}','rest')`); assert.equal(app.run(`dayKind('${day(0)}')`), 'rest');
  app.run(`setDayKind('${day(0)}','train')`); assert.deepEqual(app.json('S.dayKind'), {}, 'back to the default: nothing left to remember');
  app.run(`toggleDayKind('${day(2)}')`); assert.deepEqual(app.json('S.dayKind'), { [day(2)]: 'train' });
  assert.equal(app.json(`dayRemaining('${day(2)}')`).goals.cals, 2400);
  // a workout in progress makes today a training day
  app.run(`setDayKind('${day(0)}','rest');S.dayKind={};S.activeWorkout={id:'a',started:Date.now(),exercises:[]}`);
  assert.equal(app.run('dayKind()'), 'train');
});
test('with fixed training weekdays the schedule decides, a logged workout overrides it, and the week is judged day by day', () => {
  const app = nut({ routines: [{ id: 'r', name: 'A', exercises: [{ exId: 'squat', sets: 3, r: '5' }], days: [] }],
    groups: [{ id: 'g', name: 'G', mode: 'daypicker', routineIds: ['r'], dayMap: { r: [1, 4] }, active: true, cursor: 0 }],   // Monday and Thursday
    restGoals: { protein: 180, carbs: 180, fat: 70, cals: 2100 },
    workouts: [workout('sat', 2)],                                                                                             // trained on Saturday anyway
    meals: [1, 2, 3, 4].map(n => meal('m' + n, day(n), 'Lunch', 150, 200, 60)) });                                             // Sun, Sat, Fri, Thu
  assert.deepEqual(app.json(`[0,1,2,3,4].map(n=>dayKind(daysAgoStr(n)))`), ['train', 'rest', 'train', 'rest', 'train'], 'Mon plan, Sun rest, Sat trained, Fri rest, Thu plan');
  assert.deepEqual(app.json(`[1,2].map(d=>goalsForDow(d).cals)`), [2400, 2100], 'the meal plan uses the weekday’s kind');
  const g = app.json(`avgGoals('${day(4)}','${day(1)}')`);
  assert.deepEqual([g.cals, g.protein, g.days], [2250, 180, 4], 'two training days and two rest days average to the middle');
  const rv = app.json('weekReview()');
  assert.equal(rv.goal.cals, 2250);
  // rest-day targets survive bad input and are part of a backup
  assert.equal(app.json(`normalizeRestGoals({protein:'x',cals:0})`), null);
  assert.deepEqual(app.json(`normalizeRestGoals({protein:'150',carbs:100,fat:60,cals:'1900.4'})`), { protein: 150, carbs: 100, fat: 60, cals: 1900 });
  assert.deepEqual(app.json(`normalizeDayKind({'${day(1)}':'rest','${day(2)}':'party','2019-01-01':'rest',junk:'rest'})`), { [day(1)]: 'rest' });
  assert.ok(app.run('backupJSON()').includes('"restGoals"'));
  const coach = app.json(`coachReadTools().find(t=>t.name==='get_nutrition').run({days:3}).out`);
  assert.deepEqual(coach.rest_day_targets, { kcal: 2100, protein_g: 180, carbs_g: 180, fat_g: 70 });
  assert.deepEqual(coach.days.filter(d => d.kcal > 0).map(d => [d.day, d.target_kcal]), [['rest', 2100], ['training', 2400]], 'the coach sees each day against its own target');
});

// ─── What fits ───
test('what fits: your own foods, in a normal portion, never over for the day, protein first when protein is short', () => {
  const eggs = n => ({ foodId: 'qf_egg', name: 'Egg', qty: n, serving: '1 egg', protein: 6 * n, carbs: 0.4 * n, fat: 5 * n, cals: 72 * n });
  const app = nut({ starredFoods: ['qf_chicken_breast'], recentFoods: ['qf_banana', 'qf_greek_yogurt', 'qf_peanut_butter'],
    meals: [meal('a', day(0), 'Breakfast', 60, 150, 30, [eggs(2)]), meal('b', day(3), 'Breakfast', 12, 1, 10, [eggs(2)]), meal('c', day(5), 'Breakfast', 12, 1, 10, [eggs(2)])] });
  const r = app.json('dayRemaining()');
  assert.deepEqual([r.cals, r.protein, r.over], [2400 - 1110, 120, 0]);
  const f = app.json('whatFits(today(),10)');
  assert.ok(f.items.length >= 3);
  assert.equal(f.items[0].id, 'qf_chicken_breast', 'the leanest thing you eat leads when protein is the gap: ' + f.items.map(x => x.id).join());
  assert.ok(f.items.every(x => x.qty <= 2), 'no "three scoops to close the day"');
  assert.ok(f.items.every(x => x.cals <= r.cals * 1.05 + 15), 'nothing takes the day over');
  assert.ok(!f.items.some(x => x.id === 'qf_banana'), 'a food that barely touches the protein gap is left out');
  assert.ok(f.items.every(x => ['qf_chicken_breast', 'qf_greek_yogurt', 'qf_peanut_butter', 'qf_egg'].includes(x.id)), 'only foods you log, star or used recently: ' + f.items.map(x => x.id).join());
  const idx = id => f.items.findIndex(x => x.id === id);
  assert.ok(idx('qf_greek_yogurt') < idx('qf_peanut_butter'), 'more protein for the calories ranks higher');
  // little left: small portions only
  app.run(`S.meals.push(${JSON.stringify(meal('big', day(0), 'Dinner', 100, 60, 34))})`); app.run('bumpMemo()');
  const r2 = app.json('dayRemaining()'); assert.equal(r2.cals, 344);
  const f2 = app.json('whatFits(today(),10)');
  assert.ok(f2.items.length && f2.items.every(x => x.cals <= 344 * 1.05 + 15), JSON.stringify(f2.items.map(x => [x.id, x.qty, x.cals])));
  // nothing left, and over
  app.run(`S.meals.push(${JSON.stringify(meal('x', day(0), 'Snack', 20, 40, 10))})`); app.run('bumpMemo()');
  assert.deepEqual([app.json('whatFits()').items.length, app.json('whatFits()').why], [0, 'done']);
  app.run(`S.meals.push(${JSON.stringify(meal('y', day(0), 'Snack', 20, 60, 20))})`); app.run('bumpMemo()');
  assert.equal(app.json('whatFits()').why, 'over'); assert.ok(app.json('dayRemaining()').over > 0);
});
test('what fits works from day one, counts saved meals as a unit, and makes no network call', () => {
  const app = nut();
  const reqs = app.mockFetch(() => ({ body: {} }));
  const first = app.json('whatFits(today(),6)');
  assert.ok(first.items.length >= 3, 'no history yet: lean staples from the built-in list');
  assert.ok(first.items.every(x => x.protein >= 10));
  app.run(`S.savedMeals=[{id:'sm1',name:'Shake',items:[{foodId:'qf_whey',name:'Whey',qty:2,serving:'1 scoop',protein:24,carbs:3,fat:1.5,cals:120}]}];S.recentSavedMeals=['sm1'];bumpMemo()`);
  const withMeal = app.json('whatFits(today(),10)').items.find(x => x.kind === 'meal');
  assert.deepEqual([withMeal.name, withMeal.qty, withMeal.protein, withMeal.cals], ['Shake', 1, 48, 240], 'a saved meal is offered whole');
  app.run(`renderNutrition(document.getElementById('content'));showWhatFits();showMacroGoals();showFoodEditor({})`);
  assert.equal(reqs.length, 0);
});

// ─── The tab ───
test('the Nutrition tab shows what is left, each meal as an editable row, and any earlier day', () => {
  const app = nut({ restGoals: { protein: 180, carbs: 180, fat: 70, cals: 2100 }, meals: [
    meal('t1', day(0), 'Breakfast', 40, 60, 20, [{ foodId: 'qf_egg', name: 'Egg <b>x</b>', qty: 3, serving: '1 egg', protein: 18, carbs: 1, fat: 15, cals: 216 }]),
    meal('y1', day(1), 'Dinner', 50, 70, 25)] });
  const html = () => app.run(`document.getElementById('content').innerHTML`);
  app.run(`go('nutrition')`);
  let h = html();
  assert.match(h, /nut-big[^>]*>1,820</, 'calories left, large');
  assert.match(h, /kcal left · 580 eaten of 2,400/);
  assert.match(h, /140 left/); // protein
  assert.ok(h.includes('Training day') && h.includes('toggleDayKind'), 'the day’s kind is shown and can be flipped');
  assert.ok(h.includes(`editMeal(&quot;t1&quot;)`) && h.includes('3 × Egg &lt;b&gt;x&lt;/b&gt;') && !h.includes('<b>x</b>'), 'meals are rows that open for editing; names are escaped');
  assert.ok(h.includes('Fits what’s left'), 'suggestions show while something is left');
  assert.ok(h.includes(`setNutDay(&quot;${day(1)}&quot;)`), 'recent days open that day');
  app.run(`setNutDay('${day(1)}')`);
  h = html();
  assert.ok(h.includes('Yesterday') && h.includes('editMeal(&quot;y1&quot;)') && !h.includes('editMeal(&quot;t1&quot;)'), 'yesterday shows yesterday’s meals');
  assert.match(h, /kcal left · 705 eaten of 2,100/, 'against that day’s own target (a rest day)');
  assert.ok(h.includes('Back to today') && !h.includes('Fits what’s left') && !h.includes('plan-card'), 'suggestions and the meal plan are for today only');
  app.run(`toggleDayKind('${day(1)}')`);
  assert.match(html(), /eaten of 2,400/, 'flipping the day switches its target at once');
  // over target
  app.run(`setNutDay(null);S.meals.push(${JSON.stringify(meal('huge', day(0), 'Dinner', 150, 300, 80))});renderNutrition(document.getElementById('content'))`);
  assert.match(html(), /nut-big over[^>]*>700<[\s\S]*?kcal over/);
  // empty day
  const blank = nut(); blank.run(`go('nutrition')`);
  assert.ok(blank.run(`document.getElementById('content').innerHTML`).includes('Nothing logged yet today'));
});
