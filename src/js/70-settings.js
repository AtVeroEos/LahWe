// ═══════════════════════════════════════════════════
// SETTINGS · BACKUP / RESTORE
// ═══════════════════════════════════════════════════
function showSettings(){
  const ov=makeOv('set-ov');
  const kg=isKg();
  const htVal=S.height?(kg?Math.round(S.height*2.54):S.height):'';
  const tog=(on,fn,label)=>`<button class="tog${on?' on':''}" onclick="${fn}" role="switch" aria-checked="${on?'true':'false'}" aria-label="${label}"></button>`;
  const aiP=aiProvider();const aiKey=getAiKey(aiP);
  const bytes=(()=>{try{return JSON.stringify(S).length;}catch(e){return 0;}})();
  const lastBk=S.lastExportAt?`${fmtDay(dayOf(S.lastExportAt))} (${Math.max(0,daysBetween(dayOf(S.lastExportAt),today()))}d ago)`:'never';
  const places=[Store.lsOk?'app storage':null,Store.db&&Store.idbOk?'device database':null].filter(Boolean);
  ov.innerHTML=`<div class="modal" style="max-height:95vh"><div class="mh"></div><div class="mt">Settings</div>
    <div class="fg"><label class="fl">Name</label><input id="set-name" maxlength="40" value="${esc(S.name||'')}"></div>
    <div class="frow" style="gap:10px;margin-bottom:14px">
      <div style="flex:1"><label class="fl">Bodyweight (${S.unit})</label><input type="number" inputmode="decimal" id="set-bw" value="${S.bodyweight||''}"></div>
      <div style="flex:1"><label class="fl">Height (${kg?'cm':'in'})</label><input type="number" inputmode="decimal" id="set-height" value="${htVal}" placeholder="${kg?'175':'69'}"></div>
    </div>
    <div class="frow" style="gap:10px;margin-bottom:14px">
      <div style="flex:1.4"><label class="fl">Birth Month</label><select id="set-bmonth"><option value="">—</option>${MONTHS.map((m,i)=>`<option value="${i+1}"${S.birthMonth==i+1?' selected':''}>${m}</option>`).join('')}</select></div>
      <div style="flex:1"><label class="fl">Birth Year</label><input type="number" inputmode="numeric" id="set-byear" value="${S.birthYear||''}" placeholder="1990"></div>
    </div>
    <div class="fg"><label class="fl">Sex <span style="font-weight:500;text-transform:none;letter-spacing:0">(used for calorie and strength estimates)</span></label>
      <div class="frow">
        <button id="set-sex-male" class="btn ${S.aftGender!=='female'?'btp':'bts'} bfw" onclick="setSex('male')">Male</button>
        <button id="set-sex-female" class="btn ${S.aftGender==='female'?'btp':'bts'} bfw" onclick="setSex('female')">Female</button>
      </div>
    </div>
    <div class="fg"><label class="fl">Goal</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px" id="set-goals">
        ${GOALS.map(g=>`<button class="btn ${S.goal===g.id?'btp':'bts'}" id="sg-${g.id}" onclick="setGoal('${g.id}')" style="font-size:11px;text-align:left;justify-content:flex-start;gap:6px;padding:9px 10px">${ICON(g.icon,15)} ${g.label}</button>`).join('')}
      </div>
    </div>
    <div class="fg"><label class="fl">Weight Unit</label>
      <div class="frow">
        <button id="set-lbs" class="btn ${!kg?'btp':'bts'} bfw" onclick="setUnit('lbs')">lbs</button>
        <button id="set-kg" class="btn ${kg?'btp':'bts'} bfw" onclick="setUnit('kg')">kg</button>
      </div>
    </div>

    <div class="set-sec">
      <label class="fl">Workout</label>
      <div class="frow set-row"><span class="set-lbl">Default rest</span>
        <select id="set-rest" style="width:auto;padding:7px 10px" onchange="S.restDur=parseInt(this.value)||90;save()">${[30,45,60,75,90,120,150,180,240,300].map(v=>`<option value="${v}"${(S.restDur||90)===v?' selected':''}>${fmtMS(v)}</option>`).join('')}</select></div>
      <div class="frow set-row"><span class="set-lbl">Sound + vibration when rest ends</span>${tog(S.restSound,'toggleSetting(\'restSound\')','Rest sound')}</div>
      <div class="frow set-row"><span class="set-lbl">Keep the screen on during a workout</span>${tog(S.keepAwake,'toggleSetting(\'keepAwake\')','Keep screen on')}</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.5">Training days come from your active group: Library → Groups.</div>
    </div>

    <div class="set-sec">
      <label class="fl">App</label>
      <div class="frow set-row"><span class="set-lbl">Dark Mode</span>${tog(S.darkMode,'toggleDark()','Dark mode').replace('class="tog','id="dm-tog" class="tog')}</div>
      <div style="margin-bottom:4px"><span style="font-size:13px;font-weight:500">App Color</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;padding:6px 0 2px">
        ${THEMES.map(t=>`<div class="color-swatch${S.primaryColor===t.id?' on':''}" title="${t.label}" style="background:${t.light[0]}" onclick="setPrimaryColor('${t.id}')"></div>`).join('')}
      </div>
    </div>

    <div class="set-sec">
      <label class="fl">AI coach</label>
      <div class="frow set-row"><span class="set-lbl">${esc(AI_PROVIDERS[aiP].label)}${aiReady(aiP)?` · ${esc(aiModelFor(aiP))}`:''}<br><small>${aiP==='custom'?(getCustomUrl()?esc(aiWhere(aiP)):'no server address yet'):(aiKey?`your key ${esc(maskKey(aiKey))} — on this device only`:'no API key yet')}</small></span><button class="btn ${aiReady(aiP)?'bts':'btp'} bsm" onclick="showAiSettings()">${aiReady(aiP)?'Manage':'Set up'}</button></div>
      <div style="font-size:11px;color:var(--muted);line-height:1.5">Connect Claude, ChatGPT, Gemini, OpenRouter or your own server with your own API key, choose the model, and decide what the coach may read and change. Keys are never written into backups.</div>
    </div>

    <div class="set-sec">
      <label class="fl" style="margin-bottom:10px">Your data</label>
      <div class="frow">
        <button class="btn bts bfw" onclick="exportData()">⬇ Back up</button>
        <button class="btn bts bfw" onclick="importData()">⬆ Restore</button>
      </div>
      ${hasUndoSnapshot()?`<button class="btn bts bfw" style="margin-top:8px" onclick="undoRestore()">↩ Undo last restore</button>`:''}
      <div style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.55">Everything lives on this device only${places.length?` (${places.join(' + ')})`:''} — ${Math.max(1,Math.round(bytes/1024))} KB. Last backup: <b>${lastBk}</b>. Deleting the app from the Home Screen or clearing Safari data erases it, so keep a backup file somewhere else.</div>
    </div>
    <button class="btn btp bfw" onclick="saveSettings()">Save</button>
    <button class="btn btd bfw" style="margin-top:10px" onclick="confirmReset()">Reset All Data</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('set-ov')">Close</button>
    <div style="text-align:center;font-size:10px;color:var(--muted2);margin-top:12px">Lah We ${esc(APP_VERSION)}</div>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// Re-open Settings in place (after a change that alters what it shows), keeping the scroll position.
function refreshSettings(){
  if(!document.getElementById('set-ov'))return;
  const sc=document.querySelector('#set-ov .modal')?.scrollTop||0;
  showSettings();
  const m=document.querySelector('#set-ov .modal');if(m){m.style.animation='none';m.scrollTop=sc;}
}
function setGoal(id){S.goal=id;document.querySelectorAll('[id^="sg-"]').forEach(b=>{b.classList.toggle('btp',b.id===`sg-${id}`);b.classList.toggle('bts',b.id!==`sg-${id}`);});save();}
function setSex(g){S.aftGender=g==='female'?'female':'male';save();refreshSettings();}
function toggleSetting(k){
  S[k]=!S[k];save();
  if(k==='keepAwake')syncWakeLock();
  if(k==='restSound'&&S.restSound)playRestBeep(); // a sample, and it unlocks audio
  refreshSettings();
}
// Changing the unit must not silently turn 225 lb into 225 kg: ask what the stored numbers mean.
function setUnit(u){
  if(u!=='kg'&&u!=='lbs')return;
  if(u===S.unit)return;
  const hasNumbers=S.workouts.length||S.bodyweightLog.length||S.routines.some(r=>r.exercises.some(e=>parseFloat(e.w)>0))||!!S.activeWorkout;
  if(!hasNumbers){convertStoredWeights(u);saveNow();refreshSettings();render();return;} // nothing logged, but bodyweight, goal weight and carried records still convert
  const from=S.unit,ex=from==='lbs'?'225 lbs → 102 kg':'100 kg → 220 lbs';
  const ov=makeOv('unit-ov');
  ov.innerHTML=`<div class="modal" style="max-height:80vh"><div class="mh"></div>
    <div class="mt">Switch to ${u}</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:14px">Your logged weights are stored as plain numbers in ${from}. What should happen to them?</div>
    <button class="btn btp bfw" onclick="applyUnit(${jsq(u)},true)">Convert everything (${ex})</button>
    <div style="font-size:11px;color:var(--muted);margin:5px 2px 12px">Workouts, routines, bodyweight and records are converted and rounded to a loadable ${u==='kg'?'0.5 kg':'1 lb'}.</div>
    <button class="btn bts bfw" onclick="applyUnit(${jsq(u)},false)">Only change the label</button>
    <div style="font-size:11px;color:var(--muted);margin:5px 2px 12px">Use this if you were already entering ${u} and the label was wrong.</div>
    <button class="btn btg bfw" onclick="closeOv('unit-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function applyUnit(u,convert){
  if(convert)convertStoredWeights(u);
  else{S.unit=u;rebuildPRs();}
  saveNow();closeOv('unit-ov');refreshSettings();render();
  toast(convert?`Converted to ${u}`:`Now showing ${u}`,'green');
}
function saveSettings(){
  const n=document.getElementById('set-name')?.value?.trim();if(n)S.name=n.slice(0,40);
  const bw=parseFloat(document.getElementById('set-bw')?.value);
  if(bw>0&&bw!==parseFloat(S.bodyweight))logBodyweight(bw); // one entry per day, only when it actually changed
  const ht=parseFloat(document.getElementById('set-height')?.value);
  if(ht>0)S.height=isKg()?r1(ht/2.54):ht;
  const bm=document.getElementById('set-bmonth')?.value;const by=parseInt(document.getElementById('set-byear')?.value);
  S.birthMonth=bm?parseInt(bm):null;
  S.birthYear=(by>1900&&by<=new Date().getFullYear())?by:null;
  saveNow();closeOv('set-ov');toast('Saved','green');render();
}
function confirmReset(){
  customConfirm('Every workout, record, meal and setting on this device will be permanently deleted. Back up first if you might want any of it.','Erase everything',()=>{
    endSessionTimers();clearAllAiKeys();coachClear();clearUndoSnapshot();
    replaceState(null);
    closeOv('set-ov');
    document.getElementById('nav').style.display='none';
    render();
  });
}

// ─── Backup ───
// A backup is S and nothing else. API keys and the coach chat live outside S and are never in it.
function backupJSON(){
  const o=JSON.parse(JSON.stringify(S));
  o._app='lahwe';o._appVersion=APP_VERSION;o._exportedAt=new Date().toISOString();
  return JSON.stringify(o);
}
function downloadText(filename,text,mime){
  const blob=new Blob([text],{type:mime||'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=filename;a.style.display='none';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1500);
}
// On iPhone (especially from the Home Screen) a plain download link often goes nowhere, so the
// share sheet is tried first: "Save to Files" puts the backup in iCloud Drive or on the phone.
async function exportData(){
  let json;
  try{json=backupJSON();}catch(e){toast('Could not build the backup','red');logError(e,'export');return;}
  const name=`lahwe-backup-${today()}.json`;
  const done=()=>{S.lastExportAt=Date.now();save();toast('Backup saved','green');refreshSettings();if(S.tab==='workout'&&!document.querySelector('.ov'))render();};
  try{
    if(typeof File!=='undefined'&&navigator.canShare){
      const file=new File([json],name,{type:'application/json'});
      if(navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:'Lah We backup'});
        done();return;
      }
    }
  }catch(e){
    if(e&&e.name==='AbortError')return; // share sheet dismissed: nothing was saved
  }
  try{downloadText(name,json);done();}
  catch(e){toast('Backup failed','red');logError(e,'export');}
}

// ─── Restore ───
function snapshotCounts(o){
  const len=k=>Array.isArray(o&&o[k])?o[k].length:0;
  return{workouts:len('workouts'),routines:len('routines'),meals:len('meals'),weighIns:len('bodyweightLog')};
}
function countsText(c){return `${c.workouts} workout${c.workouts===1?'':'s'} · ${c.routines} routine${c.routines===1?'':'s'} · ${c.meals} meal${c.meals===1?'':'s'} · ${c.weighIns} weigh-in${c.weighIns===1?'':'s'}`;}
const UNDO_DAYS=14; // after this the snapshot is too old to be a safe thing to offer
function undoSnapshotAt(){return parseInt(Store.lsGet(UNDO_KEY+'_at'))||0;}
function hasUndoSnapshot(){const at=undoSnapshotAt();return at>0&&Date.now()-at<UNDO_DAYS*86400000;}
function clearUndoSnapshot(){Store.lsDel(UNDO_KEY);Store.lsDel(UNDO_KEY+'_at');if(Store.db)Store.idbSet(UNDO_KEY,null);}
async function writeUndoSnapshot(){
  let json;try{json=JSON.stringify(S);}catch(e){return false;}
  let ok=false;
  if(Store.db)ok=await Store.idbSet(UNDO_KEY,json);
  if(ok)Store.lsDel(UNDO_KEY);else ok=Store.lsSet(UNDO_KEY,json);
  if(ok)Store.lsSet(UNDO_KEY+'_at',String(Date.now()));
  return ok;
}
async function readUndoSnapshot(){
  let txt=Store.db?await Store.idbGet(UNDO_KEY):null;
  if(!txt)txt=Store.lsGet(UNDO_KEY);
  return Store.parse(txt);
}
function importData(){
  const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json,text/plain';
  inp.style.display='none';document.body.appendChild(inp); // must be in the document for iOS to deliver the change event
  inp.onchange=e=>{
    const file=e.target.files&&e.target.files[0];inp.remove();if(!file)return;
    if(file.size>60e6){toast('That file is too large to be a backup','red');return;}
    const reader=new FileReader();
    reader.onerror=()=>toast('Could not read that file','red');
    reader.onload=ev=>{
      const data=Store.parse(String(ev.target.result||''));
      if(!data){toast('That file is not a Lah We backup','red');return;}
      const isBackup=Array.isArray(data.workouts)||'_schema' in data||'onboarded' in data;
      if(!isBackup){
        toast(Array.isArray(data.routines)||Array.isArray(data.groups)?'That is a program file — use Library → Import':'That file is not a Lah We backup','red');return;
      }
      confirmRestore(data,file.name);
    };
    reader.readAsText(file);
  };
  inp.click();
}
function confirmRestore(data,fileName){
  window._restoreData=data;
  const inc=snapshotCounts(data),cur=snapshotCounts(S);
  const when=data._exportedAt?fmtDate(data._exportedAt):(data._savedAt?fmtDate(data._savedAt):'unknown date');
  const older=(inc.workouts<cur.workouts)||(data._savedAt&&S._savedAt&&data._savedAt<S._savedAt-86400000&&inc.workouts<=cur.workouts);
  const live=S.activeWorkout?'<br><b>The workout you have open right now will be discarded.</b>':'';
  customConfirm(`<b>${esc(fileName||'Backup')}</b> — saved ${esc(when)}<br>${countsText(inc)}<br><br>It replaces what is on this device now:<br>${countsText(cur)}${older?'<br><br><b style="color:var(--red)">This backup has less in it than this device does.</b>':''}${live}<br><br>You can undo this from Settings afterwards.`,
    'Replace my data',()=>{doRestore();},{title:'Restore this backup?'});
}
async function doRestore(){
  const data=window._restoreData;window._restoreData=null;if(!data)return;
  // Restoring over data that could not be read: keep the unreadable copy, don't snapshot the blank state.
  const wasCorrupt=!!Store.corrupt;
  if(wasCorrupt)Store.lsSet(STORE_KEY+'_corrupt_'+Date.now(),Store.corrupt);
  const snap=wasCorrupt?false:await writeUndoSnapshot();
  try{
    endSessionTimers();
    replaceState(data); // same normalising + migration path as a normal load
    coachClear();       // the chat referred to the data that was just replaced
  }catch(e){
    logError(e,'restore');toast('Restore failed — your data was not changed','red');
    const back=await readUndoSnapshot();if(back){try{replaceState(back);}catch(e2){}}
    return;
  }
  closeOv('set-ov');
  document.getElementById('nav').style.display=S.onboarded?'flex':'none';
  if(S.activeWorkout)startWtTimer();
  go('workout');
  toast('Backup restored','green',snap?{action:'Undo',onAction:()=>{undoRestore(true);},ms:9000}:undefined);
}
// Puts back the data from before the last restore. The data being replaced is kept in its place,
// so this can itself be reversed, and outside the moment right after a restore it always asks first.
async function undoRestore(immediate){
  const back=await readUndoSnapshot();
  if(!back){toast('Nothing to undo');clearUndoSnapshot();refreshSettings();return;}
  const apply=async()=>{
    const fresh=await readUndoSnapshot();if(!fresh)return;
    await writeUndoSnapshot(); // swap: what is on screen now becomes the thing "undo" would return to
    endSessionTimers();
    replaceState(fresh);coachClear();
    closeOv('set-ov');
    document.getElementById('nav').style.display=S.onboarded?'flex':'none';
    if(S.activeWorkout)startWtTimer();
    go(S.tab||'workout');toast('Previous data is back','green');
  };
  if(immediate){apply();return;}
  const cur=snapshotCounts(S),old=snapshotCounts(back);
  const fewer=old.workouts<cur.workouts||old.meals<cur.meals;
  customConfirm(`This brings back what was on this device before the restore on ${esc(fmtDate(undoSnapshotAt()))}:<br>${countsText(old)}<br><br>It replaces what you have now:<br>${countsText(cur)}${fewer?'<br><br><b style="color:var(--red)">Anything logged since then is not in it.</b>':''}<br><br>You can switch back again from Settings.`,
    'Bring back the earlier data',()=>{apply();},{title:'Undo the last restore?'});
}
