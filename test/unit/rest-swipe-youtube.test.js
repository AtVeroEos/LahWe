'use strict';
// Rest timer styles, the expanded swipe modes, and the YouTube link parser.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-15T18:30:00';
const live = (ids, n) => {
  const app = loadApp({ now: NOW });
  app.run(`S.activeWorkout={id:'w1',routineId:null,name:'T',started:Date.now(),exercises:${JSON.stringify(ids)}.map(id=>sessionExercise(id,null,{exId:id,sets:${n || 3},r:'8'})),notes:''};`);
  return app;
};
const swipeHTML = (app, mode) => app.run(`(()=>{S.activeWorkout._swipe='${mode}';const el=document.createElement('div');renderSwipe(el);return el.innerHTML;})()`);

// ─── Rest timer ───
test('rest: +15 and −15 move this rest only; running out of time ends it', () => {
  const app = loadApp({ now: NOW });
  app.run(`S.restTimer={end:Date.now()+60000,total:60}`);
  app.run(`adjustRest(15)`);
  assert.equal(app.run(`restRemaining()`), 75); assert.equal(app.run(`S.restTimer.total`), 75);
  app.run(`adjustRest(-15);adjustRest(-15)`);
  assert.equal(app.run(`restRemaining()`), 45);
  assert.ok(app.run(`S.restTimer.total`) >= 45, 'the bar never reads more than full');
  app.run(`adjustRest(-60)`);
  assert.equal(app.run(`S.restTimer`), null, 'taking away more than is left finishes the rest');
  app.run(`adjustRest(15)`); // nothing running: nothing happens
  assert.equal(app.run(`S.restTimer`), null);
});

test('rest style: header is the default, bad values fall back, full screen can be put away', () => {
  const app = loadApp({ now: NOW });
  assert.equal(app.run(`restEffStyle()`), 'pill');
  app.run(`setRestStyle('float')`); assert.equal(app.run(`S.restStyle`), 'float'); assert.equal(app.run(`restEffStyle()`), 'float');
  app.run(`setRestStyle('nonsense')`); assert.equal(app.run(`S.restStyle`), 'pill');
  app.run(`setRestStyle('full');S.restTimer={end:Date.now()+30000,total:30}`);
  assert.equal(app.run(`restEffStyle()`), 'full');
  app.run(`hideRestFull()`);
  assert.equal(app.run(`restEffStyle()`), 'pill', 'put away: the header pill shows for this rest');
  app.run(`S.restTimer={end:Date.now()+90000,total:90}`);
  assert.equal(app.run(`restEffStyle()`), 'full', 'the next rest is full screen again');
});

// ─── Swipe modes ───
test('swipe: the two modes differ. Simple: steppers, tags, plates, Skip. Super Simple: the numbers to tap, dots, nothing else', () => {
  const app = live(['bb-bench', 'bb-row'], 2);
  app.run(`S.swipeRest=false;S.activeWorkout.exercises.forEach(e=>e.sets.forEach(s=>s.w='100'))`);
  const simple = swipeHTML(app, 'simple'), sup = swipeHTML(app, 'super');
  for (const h of [simple, sup]) { assert.match(h, /class="sw-foot"><span>Next<\/span><b>Set 2<\/b><em>100 lbs × 8<\/em>/); assert.match(h, /class="sw-rail"/); }
  assert.match(simple, /swipeSkip\(\)/); assert.match(simple, /swipeAdj\('w',1\)/); assert.match(simple, /swipeAdj\('r',1\)/);
  assert.match(simple, /swipeTag\('Hard'\)/); assert.match(simple, /showPlateCalc\(0\)/);
  for (const re of [/swipeAdj/, /swipeTag/, /showPlateCalc/, /swipeSkip/, /applyLast/]) assert.doesNotMatch(sup, re);
  assert.match(sup, /swipeEdit\('w'\)/); assert.match(sup, /swipeEdit\('r'\)/); assert.match(sup, /class="ss-rows"/);
  assert.match(sup, /<b class="ss-n">100<\/b><span class="ss-u">lbs<\/span>/); assert.match(sup, /<b class="ss-n">8<\/b><span class="ss-u">reps<\/span>/);
  // tapping a number opens a stepper for that number only, and it closes when the set is logged
  app.run(`swipeEdit('w')`);
  let h = swipeHTML(app, 'super'); assert.match(h, /class="ss-row on"/); assert.match(h, /swipeAdj\('w',1\)/); assert.doesNotMatch(h, /swipeAdj\('r'/);
  app.run(`swipeAdj('w',1)`); assert.ok(parseFloat(app.run(`S.activeWorkout.exercises[0].sets[0].w`)) > 100);
  app.run(`swipeLog('ok')`); h = swipeHTML(app, 'super'); assert.doesNotMatch(h, /swipeAdj/);
  // a weighted lift with no weight: Super Simple says to tap the weight
  app.run(`S.activeWorkout._swipe='super';S.activeWorkout.exercises[0].sets[1].w=''`);
  assert.match(app.json(`swipePlan('r').msg`), /Tap the weight/);
});

test('swipe: "Another set" is offered only on the last set of a lift, and adds one', () => {
  const app = live(['bb-bench'], 2);
  app.run(`S.swipeRest=false;S.activeWorkout.exercises[0].sets.forEach(s=>s.w='100')`); // the rest card (v318.test.js) would cover the set
  assert.doesNotMatch(swipeHTML(app, 'simple'), /swipeAddSet/);
  app.run(`swipeLog('ok')`);
  assert.match(swipeHTML(app, 'simple'), /swipeAddSet/);
  assert.doesNotMatch(swipeHTML(app, 'super'), /swipeAddSet/, 'Super Simple keeps to the set in front of you');
  app.run(`swipeAddSet()`);
  assert.equal(app.run(`S.activeWorkout.exercises[0].sets.length`), 3);
  assert.doesNotMatch(swipeHTML(app, 'simple'), /swipeAddSet/, 'the new set is not the last one until it is');
});

test('swipe: the last set says so, and a tag toggles on and off and survives logging', () => {
  const app = live(['bb-bench'], 1);
  app.run(`S.activeWorkout.exercises[0].sets[0].w='100'`);
  assert.match(swipeHTML(app, 'simple'), /Last set of the workout/);
  app.run(`swipeTag('Hard')`); assert.equal(app.run(`S.activeWorkout.exercises[0].sets[0].tag`), 'Hard');
  app.run(`swipeTag('Hard')`); assert.equal(app.run(`S.activeWorkout.exercises[0].sets[0].tag`), '');
  app.run(`swipeTag('Pain');swipeLog('ok')`);
  const s = app.json(`S.activeWorkout.exercises[0].sets[0]`);
  assert.equal(s.tag, 'Pain'); assert.equal(s.done, true);
});

test('swipe: warm-ups get no tag row; superset order is named in "Next"', () => {
  const app = live(['bb-bench', 'bb-row'], 2);
  app.run(`const ex=S.activeWorkout.exercises;ex[0].link=ex[1].link='x';ex[0].sets.forEach(s=>s.w='100');ex[1].sets.forEach(s=>s.w='90');ex[0].sets.unshift({w:'45',r:'10',done:false,tag:'',warmup:true});`);
  const h = swipeHTML(app, 'simple');
  assert.doesNotMatch(h, /swipeTag/, 'the first card is the warm-up');
  assert.match(h, /Superset · 1 of 2/);
});

// ─── YouTube ───
test('youtube links: videos, short links, shorts, playlists and music.youtube all parse; nothing else does', () => {
  const app = loadApp({ now: NOW });
  const p = s => app.run(`JSON.stringify(ytParse(${JSON.stringify(s)}))`);
  const ok = (s, kind, id, list) => assert.deepEqual(JSON.parse(p(s)), { kind, id, list: list || '' }, s);
  ok('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video', 'dQw4w9WgXcQ');
  ok('youtube.com/watch?v=dQw4w9WgXcQ&t=30s', 'video', 'dQw4w9WgXcQ');
  ok('https://youtu.be/dQw4w9WgXcQ?si=abc', 'video', 'dQw4w9WgXcQ');
  ok('https://m.youtube.com/shorts/dQw4w9WgXcQ', 'video', 'dQw4w9WgXcQ');
  ok('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghijk123', 'video', 'dQw4w9WgXcQ', 'PLabcdefghijk123');
  ok('https://www.youtube.com/playlist?list=PLabcdefghijk123', 'playlist', 'PLabcdefghijk123', 'PLabcdefghijk123');
  for (const bad of ['', 'hello', 'https://evil.example/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short', 'https://www.youtube.com/watch?v="><script>alert(1)</script>', 'javascript:alert(1)',
    'https://www.youtube.com/', 'https://youtu.be/' + 'a'.repeat(400)]) assert.equal(p(bad), 'null', bad);
});

test('youtube: the player address is YouTube\'s no-cookie embed, ids are encoded, stored junk is ignored', () => {
  const app = loadApp({ now: NOW });
  assert.equal(app.run(`ytEmbedSrc({kind:'video',id:'dQw4w9WgXcQ',list:''})`), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&modestbranding=1');
  assert.match(app.run(`ytEmbedSrc({kind:'playlist',id:'PLabcdefghijk123',list:'PLabcdefghijk123'})`), /embed\/videoseries\?list=PLabcdefghijk123/);
  app.run(`localStorage.setItem(YT_KEY,'{"kind":"video","id":"\\"><script>"}')`);
  assert.equal(app.run(`ytRead()`), null);
  app.run(`localStorage.setItem(YT_KEY,'not json')`); assert.equal(app.run(`ytRead()`), null);
  app.run(`ytWrite(ytParse('https://youtu.be/dQw4w9WgXcQ'))`);
  assert.equal(app.run(`ytRead().id`), 'dQw4w9WgXcQ');
  assert.match(app.run(`ytSectionHTML()`), /Play here/);
  app.run(`ytWrite(null)`);
  assert.doesNotMatch(app.run(`ytSectionHTML()`), /Play here/, 'no link saved: no Play button');
});
