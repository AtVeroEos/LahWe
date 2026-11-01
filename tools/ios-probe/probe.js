// Runs inside Mobile Safari in the iOS Simulator (injected by tools/ios-probe/run.js, never in the app).
// Before the app starts: loads the demo save. After: checks what only a real iPhone browser can answer
// (storage, the share sheet, the service worker, the camera API), then opens every tab and the main
// sheets, asking the runner to take a screenshot at each, and reports page errors along the way.
(function () {
  'use strict';
  var errors = [];
  window.addEventListener('error', function (e) { errors.push((e.message || 'error') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
  window.addEventListener('unhandledrejection', function (e) { errors.push('unhandled: ' + (e.reason && e.reason.message || e.reason)); });
  function post(path, body) {
    var x = new XMLHttpRequest(); x.open('POST', path, false);
    try { x.send(JSON.stringify(body)); return x.responseText; } catch (e) { return ''; }
  }
  var log = function (m) { post('/__probe/log', { m: String(m) }); };
  // The demo save, before the app reads storage
  try {
    if (!localStorage.getItem('lahwe_v2')) {
      var x = new XMLHttpRequest(); x.open('GET', '/__probe/state.json', false); x.send();
      localStorage.setItem('lahwe_v2', x.responseText);
    }
  } catch (e) { errors.push('seeding: ' + e.message); }

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var results = [];
  var check = function (name, okv, detail) { results.push({ name: name, ok: !!okv, detail: detail == null ? '' : String(detail) }); };
  var shot = function (name) { post('/__probe/shot', { name: name }); };
  var closeAll = function () { document.querySelectorAll('.ov').forEach(function (o) { o.remove(); }); };
  var tryStep = async function (name, fn, wait) {
    var before = errors.length;
    try { await fn(); } catch (e) { errors.push(name + ': ' + e.message); }
    await sleep(wait || 700);
    shot(name);
    check(name + ' — no errors', errors.length === before, errors.slice(before).join(' | '));
    closeAll(); await sleep(250);
  };

  window.addEventListener('load', function () {
    setTimeout(async function () {
      log('app loaded: ' + navigator.userAgent);
      check('the app started on the seeded save', typeof S === 'object' && S.onboarded && S.workouts.length > 10, typeof S === 'object' ? S.workouts.length + ' workouts' : 'no S');
      // What this browser offers
      check('localStorage works', (function () { try { localStorage.setItem('__p', '1'); var v = localStorage.getItem('__p'); localStorage.removeItem('__p'); return v === '1'; } catch (e) { return false; } })());
      var idbOk = await new Promise(function (res) { try { var r = indexedDB.open('__probe', 1); r.onupgradeneeded = function () { r.result.createObjectStore('s'); }; r.onsuccess = function () { r.result.close(); res(true); }; r.onerror = function () { res(false); }; } catch (e) { res(false); } });
      check('IndexedDB works', idbOk);
      if (navigator.storage && navigator.storage.estimate) { var est = await navigator.storage.estimate(); check('storage quota reported', est.quota > 0, 'quota ' + Math.round(est.quota / 1048576) + ' MB, used ' + Math.round(est.usage / 1024) + ' KB'); }
      else check('storage quota reported', false, 'navigator.storage.estimate missing');
      if (navigator.storage && navigator.storage.persisted) check('storage persisted (info)', true, 'persisted=' + (await navigator.storage.persisted()));
      var f = typeof File !== 'undefined' ? new File(['x'], 'a.json', { type: 'application/json' }) : null;
      check('share sheet for files (info)', true, 'share=' + !!navigator.share + ' canShare(files)=' + !!(navigator.canShare && f && navigator.canShare({ files: [f] })));
      check('camera API present (info)', true, 'getUserMedia=' + !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) + ' BarcodeDetector=' + ('BarcodeDetector' in window));
      if (navigator.serviceWorker) { var reg = await Promise.race([navigator.serviceWorker.ready, sleep(8000).then(function () { return null; })]); check('service worker active', reg && reg.active, reg ? reg.scope : 'not ready after 8 s'); }
      else check('service worker active', false, 'navigator.serviceWorker missing');
      check('visualViewport present', !!window.visualViewport, window.visualViewport ? window.visualViewport.width + 'x' + window.visualViewport.height : '');
      check('nothing wider than the screen on Home', document.documentElement.scrollWidth <= window.innerWidth + 1, document.documentElement.scrollWidth + ' vs ' + window.innerWidth);
      shot('00-home');

      var tabs = ['workout', 'library', 'nutrition', 'progress', 'coach'];
      for (var i = 0; i < tabs.length; i++) {
        (function (t) {})(tabs[i]);
        var t = tabs[i];
        await tryStep('tab-' + t, function () { go(t); });
        check('tab ' + t + ': nothing wider than the screen', document.documentElement.scrollWidth <= window.innerWidth + 1, document.documentElement.scrollWidth + ' vs ' + window.innerWidth);
      }
      var sheets = [
        ['settings', function () { showSettings(); }],
        ['log-activity', function () { showLogActivity(); }],
        ['new-workout', function () { showCreateRoutine(); }],
        ['log-meal', function () { go('nutrition'); showAddMeal(); }],
        ['meal-plan', function () { go('nutrition'); if (typeof showMealPlan === 'function') showMealPlan(); }],
        ['history', function () { go('progress'); setProgView('history'); }],
        ['patterns', function () { showPatterns(); }],
        ['month-report', function () { showReport('month'); }],
        ['program-editor', function () { showProgramEditor(); }],
        ['exercise-bench', function () { showExDetail('bb-bench'); }],
        ['form-bench', function () { showForm('bb-bench'); }],
        ['modes', function () { showModes(); }],
        ['habits', function () { showHabitsSheet(); }],
        ['calendar', function () { if (typeof showCalendar === 'function') showCalendar('all'); }],
        ['photos', function () { if (typeof showPhotos === 'function') showPhotos(); }],
        ['chart-builder', function () { go('progress'); showChartBuilder(); }],
        ['import', function () { if (typeof showAppImport === 'function') showAppImport(); }],
      ];
      for (var j = 0; j < sheets.length; j++) await tryStep('sheet-' + sheets[j][0], sheets[j][1]);
      // A workout from the first routine: start, tick a set, the rest timer, finish
      await tryStep('workout-start', function () { go('library'); startWorkout(S.routines[0].id); }, 900);
      try {
        var tick = document.querySelector('#content .set-chk, #content [onclick*="togSet"], #content .chk');
        if (tick) { tick.click(); await sleep(800); shot('workout-ticked'); }
        check('a set can be ticked', S.activeWorkout && S.activeWorkout.exercises.some(function (e) { return e.sets.some(function (s) { return s.done; }); }), tick ? '' : 'no tick control found');
      } catch (e) { check('a set can be ticked', false, e.message); }
      // Saving and reading back through a reload is done by the runner (second visit).
      try { saveNow(); } catch (e) {}
      var stored = 0; try { for (var k = 0; k < localStorage.length; k++) { var key = localStorage.key(k); stored += (key.length + localStorage.getItem(key).length) * 2; } } catch (e) {}
      check('stored size (info)', true, Math.round(stored / 1024) + ' KB in localStorage');
      check('no page errors overall', errors.length === 0, errors.slice(0, 10).join(' | '));
      post('/__probe/done', { results: results, errors: errors, ua: navigator.userAgent, visit: (sessionStorage.getItem('__visit') || '1') });
    }, 1500);
  });
})();
