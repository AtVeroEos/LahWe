'use strict';
// 3.2: History and Schedule inside the Progress tab, discarding a mode, saved coach chats, reminders.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const at = iso => new Date(iso).getTime();

// ─── Progress / History / Schedule ───
test('five tabs; History and Schedule are views of Progress, and old saves land on the right one', () => {
  const app = loadApp();
  assert.deepEqual(app.json('TABS'), ['workout', 'progress', 'coach', 'nutrition', 'library']);
  app.run(`go('history')`); assert.deepEqual(app.json('[S.tab,S.progView]'), ['progress', 'history']);
  app.run(`go('schedule')`); assert.deepEqual(app.json('[S.tab,S.progView]'), ['progress', 'schedule']);
  app.run(`go('progress')`); assert.equal(app.run('S.progView'), 'progress', 'tapping the tab itself always opens on Progress');
  app.run(`setProgView('schedule');render()`); assert.equal(app.run('S.progView'), 'schedule', 'a redraw keeps the view that is open');
  app.run(`setProgView('progress')`); assert.equal(app.run('S.progView'), 'progress');
  app.run(`setHistTab('cal')`); assert.equal(app.run('S.progView'), 'schedule', 'older call sites still work');
  app.run(`setHistTab('list')`); assert.equal(app.run('S.progView'), 'history');
  app.run(`go('nonsense')`); assert.equal(app.run('S.tab'), 'workout');
  app.run(`coachOpen('history')`); assert.deepEqual(app.json('[S.tab,S.progView]'), ['progress', 'history'], 'links from the coach reach the views too');
  app.run(`coachOpen('schedule')`); assert.equal(app.run('S.progView'), 'schedule');
  // a save made when History was its own tab
  for (const [old, want] of [[{ tab: 'history', histTab: 'cal' }, ['progress', 'schedule']], [{ tab: 'history', histTab: 'list' }, ['progress', 'history']], [{ tab: 'history' }, ['progress', 'history']], [{ tab: 'progress', progView: 'bogus' }, ['progress', 'progress']]]) {
    app.set('__o', Object.assign({ onboarded: true, _schema: 3 }, old));
    const s = app.json('normalizeState(__o)');
    assert.deepEqual([s.tab, s.progView], want); assert.ok(!('histTab' in s));
  }
});
test('each view of the Progress tab draws its own content under the same switch', () => {
  const app = loadApp();
  app.state({ workouts: [{ id: 'w1', name: 'Push day', started: at('2026-06-13T18:00:00'), ended: at('2026-06-13T19:00:00'), exercises: [{ exId: 'bb-bench', sets: [{ w: '225', r: '5', done: true }] }] }] });
  const html = v => { app.run(`S.tab='progress';S.progView='${v}';renderProgress(document.getElementById('content'))`); return app.run(`document.getElementById('content').innerHTML`); };
  const h = html('history'); assert.match(h, /class="seg"/); assert.match(h, /Push day/); assert.match(h, /seg-b on" onclick="setProgView\('history'\)/);
  const s = html('schedule'); assert.match(s, /June 2026/); assert.match(s, /seg-b on" onclick="setProgView\('schedule'\)/);
  const p = html('progress'); assert.match(p, /dash-card/); assert.match(p, /seg-b on" onclick="setProgView\('progress'\)/); assert.ok(!/Push day<\/div><div class="hm"/.test(p));
});

// ─── Modes can be thrown away ───
const deck = { deck: [{ suit: 'h', label: '5', value: 5, exId: 'pushup' }, { suit: 'h', label: '9', value: 9, exId: 'pushup' }], cardIdx: 0, startTime: at('2026-06-15T11:50:00'), secPerRep: 3, buffer: 5, suitMap: { h: 'pushup' }, repsByEx: { pushup: 0 }, cardsByEx: { pushup: [] } };
test('a card deck can be discarded, and one ended before the first card logs nothing', () => {
  const app = loadApp();
  app.set('__d', deck); app.run('S.activeCardDeck=JSON.parse(JSON.stringify(__d));flipCard(false)');
  assert.equal(app.run('S.activeCardDeck.cardIdx'), 1);
  app.run('discardCardDeck()');
  assert.deepEqual(app.json('[S.activeCardDeck,S.workouts.length]'), [null, 0], 'discarded: nothing in history');
  app.run('S.activeCardDeck=JSON.parse(JSON.stringify(__d));endCardDeck()');
  assert.deepEqual(app.json('[S.activeCardDeck,S.workouts.length]'), [null, 0], 'no cards done: no empty workout');
  app.run('S.activeCardDeck=JSON.parse(JSON.stringify(__d));flipCard(false);endCardDeck()');
  assert.equal(app.run('S.workouts.length'), 1, 'saving still works');
  assert.deepEqual(app.json('S.workouts[0].exercises[0].sets.map(s=>s.r)'), ['5']);
});
test('a sprint session can be discarded instead of being logged', () => {
  const app = loadApp();
  app.run(`S.activeSprintTimer={sprintDur:30,walkDur:60,startTime:Date.now()-200000,rounds:0,isSprintPhase:true,phaseStart:Date.now()-200000};discardSprint()`);
  assert.deepEqual(app.json('[S.activeSprintTimer,S.activities.length]'), [null, 0]);
  app.run(`S.activeSprintTimer={sprintDur:30,walkDur:60,startTime:Date.now()-200000,rounds:0,isSprintPhase:true,phaseStart:Date.now()-200000};stopSprintTimer()`);
  assert.equal(app.run('S.activities.length'), 1, 'saving still works'); assert.equal(app.run('S.activities[0].rounds'), 2);
});

// ─── Saved chats ───
const KEY = 'sk-' + 'ant-' + 'api03-' + 'V'.repeat(40);
const reply = (...blocks) => ({ body: { content: blocks, stop_reason: blocks.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } } });
const settle = async app => { for (let i = 0; i < 200 && app.run('Coach.busy'); i++) await new Promise(r => setImmediate(r)); };
async function twoChats() {
  const app = loadApp();
  app.set('__k', KEY); app.run(`setAiKey('anthropic',__k)`);
  const quick = { name: 'Quick Push', exercises: [{ exId: 'bb-bench', name: 'Bench', sets: 3, repsMin: 5, rest: 90 }] };
  let i = 0; const script = [
    reply({ type: 'tool_use', id: 'a', name: 'propose_quick_workout', input: quick }), reply({ type: 'text', text: 'Tap Start.' }),
    reply({ type: 'tool_use', id: 'b', name: 'log_meal', input: { meal: 'Lunch', items: [{ food_id: 'qf_egg', servings: 2 }] } }), reply({ type: 'text', text: 'Logged.' })];
  app.mockFetch(() => script[Math.min(i++, script.length - 1)]);
  app.run(`Coach.attachments.push({kind:'image',media:'image/jpeg',data:'UElDVFVSRUJZVEVT',name:'p.jpg'})`);
  app.run(`coachSend('give me a quick push workout')`); await settle(app);
  await app.run('coachNewChat()');
  app.run(`coachSend('I had two eggs')`); await settle(app);
  return app;
}
test('starting a new chat keeps the old one; chats can be reopened and deleted', async () => {
  const app = await twoChats();
  assert.deepEqual(app.json('Coach.archive.map(c=>c.title)'), ['give me a quick push workout']);
  assert.equal(app.run('Coach.turns[0].text'), 'I had two eggs');
  assert.deepEqual(app.json('coachAllChats().map(c=>[c.title,c.current])'), [['I had two eggs', true], ['give me a quick push workout', false]]);
  const stored = app.ctx.localStorage.getItem('lahwe_coach_archive');
  assert.ok(stored.includes('quick push workout') && !stored.includes(KEY) && !stored.includes('UElDVFVSRUJZVEVT') && !stored.includes('"raw"'), 'saved without key, photo bytes or reasoning state');
  assert.ok(!app.run('backupJSON()').includes('quick push workout'), 'saved chats are not in backups');
  // reopen the first chat: the one that was open is saved in its place
  const first = app.run('Coach.archive[0].id'); const second = app.run('Coach.id');
  assert.equal(app.run(`coachOpenChat(${JSON.stringify(first)})`), true);
  assert.equal(app.run('Coach.turns[0].text'), 'give me a quick push workout');
  assert.deepEqual(app.json('Coach.archive.map(c=>c.id)'), [second]);
  assert.equal(JSON.parse(app.ctx.localStorage.getItem('lahwe_coach_v1')).id, first, 'and it is the one restored on the next launch');
  // the card it made is still usable
  assert.equal(app.run('Coach.turns[2].results[0].ui.status'), 'pending');
  app.run('coachCardApply(2,0)'); assert.equal(app.run('S.activeWorkout.name'), 'Quick Push');
  // delete the other one
  app.run(`coachDeleteChat(${JSON.stringify(second)})`);
  assert.equal(app.run('Coach.archive.length'), 0); assert.equal(app.ctx.localStorage.getItem('lahwe_coach_archive'), null);
  assert.equal(app.run(`coachOpenChat('missing')`), false);
});
test('"Made by coach" lists every card and receipt across chats, with what became of it', async () => {
  const app = await twoChats();
  const made = app.json('coachAllMade()');
  assert.deepEqual(made.map(m => [m.kind, m.status, m.open]), [['Meal logged', 'Done', false], ['Workout', 'Waiting for you', true]]);
  assert.match(made[0].title, /^Lunch — 144 kcal/); assert.match(made[1].title, /^Quick Push — ~\d+ min$/);
  assert.equal(made[1].chatId, app.run('Coach.archive[0].id')); assert.deepEqual([made[1].ti, made[1].ri], [2, 0]);
  assert.ok(made[0].at >= made[1].at, 'newest first');
  // dismissed things can be put back; applying is still a separate step
  app.run(`coachOpenChat(Coach.archive[0].id);coachCardDismiss(2,0)`);
  assert.equal(app.json('coachAllMade()').find(m => m.kind === 'Workout').status, 'Not used');
  app.run('coachCardReopen(2,0)');
  assert.equal(app.run('Coach.turns[2].results[0].ui.status'), 'pending'); assert.equal(app.run('S.activeWorkout'), null);
  // receipts cannot be "used again"
  app.run(`coachOpenChat(Coach.archive[0].id);coachCardReopen(2,0)`);
  assert.equal(app.run('Coach.turns[2].results[0].ui.type'), 'receipt');
  const html = app.run('coachThreadHTML()');
  assert.match(html, /id="cc-2-0"/, 'cards carry an id so the list can jump to them');
});
test('the saved-chat store stays within its limits and reset removes it', async () => {
  const app = await twoChats();
  app.run(`for(let i=0;i<60;i++)Coach.archive.push({id:'x'+i,title:'t'+i,at:i,updatedAt:i,turns:[{role:'user',text:'q'.repeat(20000),at:i}]});coachArchiveSave()`);
  assert.ok(app.run('Coach.archive.length') <= 40);
  assert.ok(app.ctx.localStorage.getItem('lahwe_coach_archive').length <= 500000, 'app storage is small: the fallback store is capped well under it');
  assert.equal(app.run('Coach.archive[0].title'), 'give me a quick push workout', 'the newest are the ones kept');
  app.run('coachClearAll()');
  assert.equal(app.run('Coach.archive.length'), 0); assert.equal(app.run('Coach.turns.length'), 0);
  assert.equal(app.ctx.localStorage.getItem('lahwe_coach_archive'), null); assert.equal(app.ctx.localStorage.getItem('lahwe_coach_v1'), null);
  // damaged store → empty list, not a crash
  const app2 = loadApp(); app2.ctx.localStorage.setItem('lahwe_coach_archive', '{"chats":[{"id":1},"x",{"id":"ok","turns":[{"role":"user","text":"hi","attachments":[{"kind":"image","name":"a","data":"SECRET"}]}]}]}');
  await app2.run('coachArchiveLoad()');
  assert.deepEqual(app2.json('Coach.archive.map(c=>[c.id,c.turns.length])'), [['ok', 1]]);
  assert.ok(!JSON.stringify(app2.json('Coach.archive')).includes('SECRET'));
});

// ─── Reminders ───
test('reminders become a calendar file with repeating events and alerts at the chosen local time', () => {
  const app = loadApp({ now: '2026-06-15T12:00:00' }); // a Monday
  assert.equal(app.run('remindersICS()'), '', 'nothing switched on: no file');
  app.run(`S.reminders.workout.on=true;S.reminders.workout.time='17:30';S.reminders.workout.days=[2,4,6];S.reminders.weigh.on=true;S.reminders.weigh.time='07:05'`);
  const ics = app.run('remindersICS()');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.split('\r\n').every(l => l.length <= 75), 'no line over the 75-character limit');
  const events = ics.split('BEGIN:VEVENT').slice(1);
  assert.equal(events.length, 2);
  assert.match(events[0], /UID:lahwe-workout@lahwe\.app/); assert.match(events[0], /RRULE:FREQ=WEEKLY;BYDAY=TU,TH,SA/);
  assert.match(events[0], /DTSTART:20260616T173000\r\n/, 'starts on the first chosen weekday (Tuesday), with no time zone so it is local time');
  assert.match(events[0], /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Time to train\r\nTRIGGER:PT0M\r\nEND:VALARM/);
  assert.match(events[0], /SUMMARY:Workout — Lah We/);
  assert.match(events[1], /RRULE:FREQ=DAILY/); assert.match(events[1], /DTSTART:20260615T070500\r\n/);
  assert.ok(!ics.includes('lahwe-food'), 'a reminder that is off is not in the file');
  assert.equal(app.run(`icsEscape('a,b;c\\\\d\\ne')`), 'a\\,b\;c\\\\d\\ne');
});
test('reminder settings survive bad input and follow the group when it pins training to weekdays', () => {
  const app = loadApp();
  const n = o => { app.set('__r', o); return app.json('normalizeReminders(__r)'); };
  assert.deepEqual(n(null).workout, { on: false, time: '17:30', days: [1, 2, 4, 5] });
  assert.deepEqual(n({ workout: { on: 'yes', time: '25:99', days: [9, 'x'] } }).workout, { on: false, time: '17:30', days: [1, 2, 4, 5] });
  assert.deepEqual(n({ weigh: { on: true, time: '06:15', days: [6, 0, 6] } }).weigh, { on: true, time: '06:15', days: [0, 6] });
  assert.equal(app.run('plannedTrainingDays()'), null);
  app.state({ routines: [{ id: 'r1', name: 'A', exercises: [{ exId: 'squat', sets: 3 }] }, { id: 'r2', name: 'B', exercises: [{ exId: 'squat', sets: 3 }] }], groups: [{ id: 'g', name: 'G', mode: 'daypicker', routineIds: ['r1', 'r2'], dayMap: { r1: [1, 4], r2: [2] }, active: true }] });
  assert.deepEqual(app.json('plannedTrainingDays()'), [1, 2, 4]);
  app.run(`setReminder('workout','on',true);toggleReminderDay('workout',1);toggleReminderDay('workout',2);toggleReminderDay('workout',4);toggleReminderDay('workout',5)`);
  assert.deepEqual(app.json('S.reminders.workout.days'), [5], 'the last day cannot be removed');
  const bk = JSON.parse(app.run('backupJSON()')); assert.equal(bk.reminders.workout.on, true, 'reminder choices are part of a backup');
});
