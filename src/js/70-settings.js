// ═══════════════════════════════════════════════════
// SETTINGS · BACKUP / RESTORE
// ═══════════════════════════════════════════════════
// Settings is a short list of groups, each row showing what is set now; a row opens its page, and a
// swipe down goes back. Everything saves the moment it is changed: there is no Save button to forget.
const SET_GROUPS=[
  {id:'units',label:'Units & calendar',icon:'ruler'},
  {id:'goals',label:'Goals & targets',icon:'target'},
  {id:'workout',label:'Workout',icon:'dumbbell'},
  {id:'tracking',label:'Check-in & tracking',icon:'check'},
  {id:'look',label:'Appearance',icon:'sliders'},
  {id:'connect',label:'Connections',icon:'link'},
  {id:'data',label:'Your data',icon:'folder'},
];
const setTog=(on,fn,label,id)=>`<button${id?` id="${id}"`:''} class="tog${on?' on':''}" onclick="${fn}" role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(label)}"></button>`;
const setSeg=(label,opts,cur,fn)=>`<div class="seg seg-in set-seg" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v,l])=>`<button class="seg-b${v===cur?' on':''}" role="radio" aria-checked="${v===cur}" onclick="${fn}(${typeof v==='string'?jsq(v):v})">${l}</button>`).join('')}</div>`;
const setRow=(t,sub,js,icon,extra)=>`<button class="row row-tap" onclick="${js}">${icon?`<span class="row-ic">${ICON(icon,17)}</span>`:''}<span class="row-main"><span class="row-t">${esc(t)}</span>${sub?`<span class="row-s">${sub}</span>`:''}</span>${extra||''}<span class="row-chev">${ICON('chev',16)}</span></button>`;
const setLine=(t,sub,ctrl)=>`<div class="frow set-row"><span class="set-lbl">${t}${sub?`<small>${sub}</small>`:''}</span>${ctrl}</div>`;

function showSettings(){
  const ov=makeOv('set-ov');ov.dataset.unit=S.unit;
  ov.innerHTML=`<div class="modal set-hub" style="max-height:95vh"><div class="mh"></div><div class="mt">Settings</div><div id="set-hub-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderSetHub();
}
function renderSetHub(){
  const el=document.getElementById('set-hub-body');if(!el)return;
  el.innerHTML=setHubHTML();
}
function setHubHTML(){
  const sum=setSummaries();
  const init=(S.name||'?').trim().charAt(0).toUpperCase()||'?';
  return`<button class="set-me row-tap" onclick="showSetPage('profile')"><span class="set-av">${esc(init)}</span><span class="row-main"><span class="row-t">${esc(S.name||'Your name')}</span><span class="row-s">${esc(profileSummary())}</span></span><span class="row-chev">${ICON('chev',16)}</span></button>
    <div class="list">${setRow('Pause',esc(pauseSummary()),'showPause()','moon',pauseNow()?'<span class="set-dot" aria-label="On"></span>':'')}</div>
    <div class="list">${SET_GROUPS.map(g=>setRow(g.label,esc(sum[g.id]||''),`showSetPage('${g.id}')`,g.icon)).join('')}</div>
    <div class="set-ver">Lah We ${esc(APP_VERSION)}</div>`;
}
function profileSummary(){
  const kg=isKg();const bits=[];
  if(S.profileSet.sex)bits.push(S.aftGender==='female'?'Female':'Male');
  if(S.birthYear)bits.push(`age ${userAge()}`);
  if(S.profileSet.height&&S.height)bits.push(kg?`${Math.round(S.height*2.54)} cm`:`${Math.floor(S.height/12)}′${Math.round(S.height%12)}″`);
  const bw=(S.bodyweightLog||[])[0];if(bw)bits.push(`${fmt1(bw.weight)} ${S.unit}`);
  return bits.length?bits.join(' · '):'Sex, age and height make the estimates yours';
}
// One line per group: what is set now, so most changes need no tap to check.
function setSummaries(){
  const goal=(GOALS.find(g=>g.id===S.goal)||{}).label||'General';
  const kcal=(S.macroGoals||{}).cals;
  const rs={pill:'header',float:'floating',full:'full screen'}[S.restStyle||'pill'];
  const track=[S.trackFeel&&'feel',S.trackSleep&&'sleep',S.trackMood&&'mood',runningOn()&&'running',`${S.photoSet} photo${S.photoSet===1?'':'s'}`].filter(Boolean);
  const accent=(THEMES.find(t=>t.id===S.primaryColor)||THEMES[0]).label;
  const lay=(HOME_LAYOUTS.find(l=>l.id===S.homeLayout)||{}).label||'Balanced';
  const aiP=aiProvider();const rem=REM_KINDS.filter(k=>S.reminders[k.id].on).length;
  const bytes=(()=>{try{return JSON.stringify(S).length;}catch(e){return 0;}})();
  return{
    units:`${S.unit} · ${S.measureUnit||'in'} · week from ${S.weekStart===0?'Sun':'Mon'}${S.dayEnd?` · day ends ${S.dayEnd} AM`:''}`,
    goals:`${goal}${kcal?` · ${Number(kcal).toLocaleString()} kcal`:''}${S.weightGoal?` · ${fmt1(S.weightGoal)} ${S.unit}`:''}`,
    workout:`Rest ${fmtMS(S.restDur||90)} ${rs} · ${cueSummary()}`,
    tracking:track.join(' · '),
    look:`${(THEME_MODES.find(m=>m.id===S.themeMode)||THEME_MODES[0]).label} · ${accent} · ${lay}`,
    connect:[aiReady(aiP)?AI_PROVIDERS[aiP].label:'Coach not set up',musicOn()?'Spotify':null,rem?`${rem} reminder${rem===1?'':'s'}`:null].filter(Boolean).join(' · '),
    data:`${S.lastExportAt?`Backed up ${fmtAgo(S.lastExportAt)}`:'Never backed up'} · ${Math.max(1,Math.round(bytes/1024))} KB`,
  };
}
function fmtAgo(ts){const d=Math.max(0,daysBetween(dayOf(ts),today()));return d===0?'today':d===1?'yesterday':`${d} days ago`;}

// ─── The pages ───
function showSetPage(id){
  const pg=SET_PAGES[id];if(!pg)return;
  const ov=makeOv('set-pg');ov.dataset.pg=id;ov.dataset.unit=S.unit;
  ov.innerHTML=`<div class="modal" style="max-height:95vh"><div class="mh"></div><div class="mt" style="margin-bottom:${pg.sub?2:12}px">${esc(pg.title)}</div>${pg.sub?`<div class="sheet-sub">${pg.sub}</div>`:''}<div id="set-pg-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  ov._onDismiss=()=>{if(id==='profile')commitProfile();renderSetHub();};
  setPageRefresh();
}
// Redraw the open page and the list behind it, keeping the page's scroll.
function setPageRefresh(){
  renderSetHub();
  const ov=document.getElementById('set-pg');if(!ov)return;
  const pg=SET_PAGES[ov.dataset.pg];const el=document.getElementById('set-pg-body');if(!pg||!el)return;
  const m=ov.querySelector('.modal');const sc=m?m.scrollTop:0;
  el.innerHTML=pg.html();
  if(m)m.scrollTop=sc;
}
// Other parts of the app call this after changing something Settings shows.
function refreshSettings(){
  if(!document.getElementById('set-ov')&&!document.getElementById('set-pg'))return;
  const ov=document.getElementById('set-pg');
  if(ov&&ov.dataset.pg==='profile'){commitProfile();}
  setPageRefresh();
}
const SET_PAGES={
  profile:{title:'Profile',sub:'Used for calorie estimates, strength standards and fitness-test scoring.',html:()=>{
    const kg=isKg();const htVal=S.height&&S.profileSet.height?(kg?Math.round(S.height*2.54):S.height):'';
    const bw=(S.bodyweightLog||[])[0];
    return`<div class="fg"><label class="fl">Name</label><input id="set-name" maxlength="40" value="${esc(S.name||'')}" onchange="commitProfile()" autocomplete="given-name"></div>
      <div class="fg"><label class="fl">Sex${S.profileSet.sex?'':' <span class="fl-note">not chosen yet</span>'}</label>${setSeg('Sex',[['male','Male'],['female','Female']],S.profileSet.sex?S.aftGender:'','setSex')}</div>
      <div class="frow" style="gap:10px;margin-bottom:14px">
        <div style="flex:1.4"><label class="fl">Birth month</label><select id="set-bmonth" onchange="commitProfile()"><option value="">—</option>${MONTHS.map((m,i)=>`<option value="${i+1}"${S.birthMonth==i+1?' selected':''}>${m}</option>`).join('')}</select></div>
        <div style="flex:1"><label class="fl">Birth year</label><input type="number" inputmode="numeric" id="set-byear" value="${S.birthYear||''}" placeholder="1990" onchange="commitProfile()"></div>
        <div style="flex:1"><label class="fl">Height (${kg?'cm':'in'})</label><input type="number" inputmode="decimal" id="set-height" value="${htVal}" placeholder="${kg?'175':'69'}" onchange="commitProfile()"></div>
      </div>
      <div class="list">${setRow('Bodyweight',bw?`${fmt1(bw.weight)} ${S.unit} · weighed ${fmtAgo(dayDate(bw.date).getTime())}`:'Not weighed yet','setJump(()=>showWeighIn(),\'profile\')','scale')}</div>
      <div class="fine">Bodyweight is a log, not a setting: it is entered with the weigh-in, so every reading is kept and dated.</div>`;
  }},
  units:{title:'Units & calendar',html:()=>`
    <div class="set-lbl">Weights</div>${setSeg('Weight unit',[['lbs','lbs'],['kg','kg']],S.unit,'setUnit')}
    <div class="set-lbl">Body measurements</div>${setSeg('Body measurements',[['in','in'],['cm','cm']],S.measureUnit||'in','setMeasureUnit')}
    <div class="set-lbl">Week starts on</div>${setSeg('Week starts on',[[1,'Monday'],[0,'Sunday']],S.weekStart===0?0:1,'setWeekStart')}
    <div class="set-lbl">Day ends at<small>${S.dayEnd?`Until ${S.dayEnd} AM it is still the day before: late meals and lifts land on the day you are living in.`:'Midnight, like the clock. Set it later if you log after midnight.'}</small></div>
    ${setSeg('Day ends at',[[0,'12 AM'],[1,'1'],[2,'2'],[3,'3'],[4,'4 AM']],S.dayEnd||0,'setDayEnd')}
    <div class="fine">Distances are in miles.</div>`},
  goals:{title:'Goals & targets',html:()=>{
    const g=S.macroGoals||{};const rg=hasRestGoals()?S.restGoals:null;
    const dir={lose:'lose',gain:'gain',maintain:'hold'}[S.weightGoalDir]||'';
    return`<div class="set-lbl" style="margin-bottom:6px">Goal</div>
      <div class="set-goals">${GOALS.map(x=>`<button class="btn ${S.goal===x.id?'btp':'bts'}" id="sg-${x.id}" onclick="setGoal('${x.id}')">${ICON(x.icon,15)} ${x.label}</button>`).join('')}</div>
      <div class="list" style="margin-top:14px">
        ${setRow('Food targets',`${Number(g.cals||0).toLocaleString()} kcal · ${g.protein||0} g protein${rg?` · rest days ${Number(rg.cals||0).toLocaleString()}`:''}`,'setJump(()=>showMacroGoals(),\'goals\')','utensils')}
        ${setRow('Weight goal',S.weightGoal?`${dir?dir[0].toUpperCase()+dir.slice(1)+' to ':''}${fmt1(S.weightGoal)} ${S.unit}`:'None set','setJump(()=>showWeightGoal(),\'goals\')','scale')}
        ${runningOn()?setRow('Running this year',S.runGoal?`${Number(S.runGoal.miles).toLocaleString()} miles`:'No goal','setJump(()=>showRunning(),\'goals\')','run'):''}
      </div>
      <div class="set-lbl">Fitness test scoring</div>${setSeg('Fitness test standard',[['general','General'],['combat','Combat']],S.aftStandard==='combat'?'combat':'general','setAftStandardSet')}`;
  }},
  workout:{title:'Workout',html:()=>{
    const restSel=`<select id="set-rest" style="width:auto;padding:7px 10px" onchange="S.restDur=parseInt(this.value)||90;save();renderSetHub()">${[30,45,60,75,90,120,150,180,240,300].map(v=>`<option value="${v}"${(S.restDur||90)===v?' selected':''}>${fmtMS(v)}</option>`).join('')}</select>`;
    const st=S.restStyle||'pill';
    const steps=STEP_EQ.map(e=>`<div class="frow set-row set-step"><span class="set-lbl">${e}</span>${`<div class="seg seg-mini" role="radiogroup" aria-label="${e} step">${[[0,'Auto']].concat(stepOptions().map(v=>[v,fmt1(v)])).map(([v,l])=>{const on=(stepFor(e)||0)===v;return`<button class="seg-b${on?' on':''}" role="radio" aria-checked="${on}" onclick="setStep('${e}',${v})">${l}</button>`;}).join('')}</div>`}</div>`).join('');
    const eqp=(EQUIPMENT_PRESETS.find(x=>x.id===(S.equipPreset||'full'))||EQUIPMENT_PRESETS[0]).label;
    return`<div class="sec-h">Rest</div>
      ${setLine('Default rest','Each exercise can have its own',restSel)}
      <div class="set-lbl">Rest timer shows as</div>${setSeg('Rest timer display',[['pill','Header'],['float','Floating'],['full','Full screen']],st,'setRestStyle')}
      <div class="fine" style="margin-top:-6px">${({pill:'A small timer in the top bar. Tap it to skip.',float:'A bar floats over the screen with −15, +15 and Skip.',full:'A big countdown covers the screen, with −15, +15 and Skip.'})[st]}</div>
      <div class="sec-h">Sounds</div>
      ${setLine('Ring when rest ends','Vibrates too, on phones that allow it',setTog(S.restSound,"toggleSetting('restSound')",'Ring when rest ends'))}
      <div class="set-lbl">Sound</div>${setSeg('Sound',CUE_SOUNDS.map(c=>[c.id,c.label]),cueSoundId(),"setCue.bind(null,'sound')")}
      <div class="set-lbl">Volume<small>For rest, sprint intervals and timed sets. The phone's own volume still sets the most it can be.</small></div>${setSeg('Volume',CUE_VOLS.map(c=>[c.v,c.label]),cueVolume().v,"setCue.bind(null,'vol')")}
      ${cueSessionSupported()?setLine('Play on silent',S.cueSilent?'Sounds play with the iPhone on silent. iPhone pauses Spotify while one plays, and it may not start again by itself.':'Off: with the iPhone on silent (switch or Action button) you hear nothing. Sounds mix with your music.',setTog(S.cueSilent,"toggleSetting('cueSilent')",'Play on silent')):''}
      <button class="btn bts bfw" onclick="testCue()">${ICON('bell',15)} Test the sound</button>
      <div class="sec-h">Swipe mode · Simple</div>
      ${setLine('Rest card','After a set the card counts down your rest, then rings and flips to the next set',setTog(S.swipeRest,"toggleSetting('swipeRest')",'Rest card'))}
      ${setLine('Timed sets run themselves','Planks and holds: Start counts 3-2-1, times the set and logs it',setTog(S.swipeHold,"toggleSetting('swipeHold')",'Timed sets run themselves'))}
      <div class="sec-h">Sets &amp; weights</div>
      <div class="set-lbl">Warm-up sets<small>Added when a workout starts, ramped from your first working weight</small></div>${setSeg('Warm-up sets',[['off','Off'],['first','First lift'],['barbell','Barbell lifts']],S.autoWarm,'setAutoWarm')}
      <div class="set-lbl">"Last time" comes from<small>${S.lastFrom==='any'?'The latest session with that lift, whichever workout it was in':'The same workout when it has the lift, otherwise the latest session'}</small></div>${setSeg('Last time from',[['routine','Same workout'],['any','Any workout']],S.lastFrom,'setLastFrom')}
      <div class="set-lbl">Weight steps (${S.unit})<small>How far + and − and the next-session targets move</small></div>${steps}
      <div class="list" style="margin-top:12px">
        ${setRow('Plates & dumbbells',esc(gearSummary()),'showGear()','grid')}
        ${setRow('Equipment',esc(eqp)+' · limits the exercise lists','showEquipFilter()','dumbbell')}
        ${setRow('Training days','From the split in use · Library → Splits','closeSetAll();S.libTab=\'groups\';go(\'library\')','calendar')}
      </div>
      ${setLine('Keep the screen on during a workout','',setTog(S.keepAwake,"toggleSetting('keepAwake')",'Keep screen on'))}`;
  }},
  tracking:{title:'Check-in & tracking',sub:'One tap each, and optional every time. Patterns uses them. Turning one off stops the question; what you logged is kept.',html:()=>`
    ${setLine('Ask how a workout went','At Finish',setTog(S.trackFeel,"toggleSetting('trackFeel')",'Ask how a workout went'))}
    ${setLine('Ask for last night’s sleep','With the weigh-in',setTog(S.trackSleep,"toggleSetting('trackSleep')",'Ask for sleep'))}
    ${setLine('Ask how yesterday went','Mood, in the daily check-in',setTog(S.trackMood,"toggleSetting('trackMood')",'Ask for mood'))}
    ${setLine('Running',S.running==null?(runningOn()?'On by itself: you have logged runs':`Turns on by itself after ${RUN_AUTO_MIN} runs or rucks with a distance (${runAutoCount()} so far)`):runningOn()?'Weekly miles, best efforts, race times and routes':'Off: no running tiles, page or routes',setTog(runningOn(),'toggleRunning()','Running'))}
    <div class="sec-h">Progress photos</div>
    <div class="set-lbl">Photos each time<small>${esc(photoSetPoses().map(photoPose).join(', '))}</small></div>
    ${setSeg('Photos each time',[[1,'1'],[2,'2'],[3,'3'],[4,'4']],S.photoSet,"setPhotoSetting.bind(null,'photoSet')")}
    <div class="set-lbl">Self-timer<small>${S.photoTimer?'Hands-free: one tap takes the whole set, each photo kept after 3 seconds':'Off: tap the shutter, then Keep, for each photo'}</small></div>
    ${setSeg('Self-timer',PHOTO_TIMERS.map(t=>[t,t?t+' s':'Off']),S.photoTimer,"setPhotoSetting.bind(null,'photoTimer')")}
    ${setLine('Hide pictures until I tap Show','The Photos list shows each pose as a blank tile until you tap Show',setTog(S.photoHide,"toggleSetting('photoHide')",'Hide pictures'))}
    ${setLine('Show the last photo to line up with','Faint, over the camera',setTog(S.photoGhost,"toggleSetting('photoGhost')",'Line-up guide'))}`},
  look:{title:'Appearance',html:()=>`
    <div class="set-lbl">Theme<small>${S.themeMode==='system'?`Follows the phone: ${S.darkMode?'dark':'light'} now`:'Stays this way whatever the phone does'}</small></div>
    ${setSeg('Theme',THEME_MODES.map(m=>[m.id,m.label]),S.themeMode,'setThemeMode')}
    <div class="set-lbl">Accent colour</div>
    <div class="set-sw">${THEMES.map(t=>`<div class="color-swatch${S.primaryColor===t.id?' on':''}" title="${t.label}" style="background:${S.darkMode?t.dark:t.light}" onclick="setPrimaryColor('${t.id}')" role="button" aria-label="${t.label}"></div>`).join('')}</div>
    <div class="set-lbl" style="margin-top:14px">Home layout</div>
    <div id="set-layouts">${homeLayoutPickerHTML()}</div>`},
  connect:{title:'Connections',html:()=>{
    const aiP=aiProvider();const aiKey=getAiKey(aiP);
    return`<div class="list">
      ${setRow('AI coach',`${esc(AI_PROVIDERS[aiP].label)}${aiReady(aiP)?` · ${esc(aiModelFor(aiP))}`:''} · ${aiP==='custom'?(getCustomUrl()?esc(aiWhere(aiP)):'no server address yet'):(aiKey?`key ${esc(maskKey(aiKey))}, on this device only`:'no API key yet')}`,'showAiSettings()','spark')}
      ${setRow('Music',musicOn()?'Spotify connected: controls show in a workout':'Spotify controls and a YouTube player','showMusicSetup()','music')}
      ${setRow('Reminders',esc(REM_KINDS.filter(k=>S.reminders[k.id].on).map(k=>`${k.label} ${S.reminders[k.id].time}`).join(' · ')||'Workout, weigh-in and food alerts through your Calendar'),'showReminders()','bell')}
    </div>
    <div class="fine">Your own API key, your own accounts. Keys stay on this device and are never written into backups.</div>`;
  }},
  data:{title:'Your data',html:()=>{
    const bytes=(()=>{try{return JSON.stringify(S).length;}catch(e){return 0;}})();
    const places=[Store.lsOk?'app storage':null,Store.db&&Store.idbOk?'device database':null].filter(Boolean);
    const lastBk=S.lastExportAt?`${fmtDay(dayOf(S.lastExportAt))} (${fmtAgo(S.lastExportAt)})`:'never';
    const routes=S.activities.filter(a=>a.rt).length;
    const strava=S.activities.filter(a=>a.src==='strava').length;
    return`<div class="frow"><button class="btn btp bfw" onclick="exportData()">Back up</button><button class="btn bts bfw" onclick="importData()">Restore</button></div>
      <div class="bk-note">${ICON('folder',15)}<span><b>Where backups go:</b> Back up opens your iPhone’s <b>Save to Files</b>, and that is where you pick the folder. Make one called <b>Lah We</b> the first time and save into it; next time Save to Files opens at the last folder you used. iPhone does not let an app choose a folder for you, so it cannot be set here.</span></div>
      ${hasUndoSnapshot()?`<button class="btn bts bfw" style="margin-top:8px" onclick="undoRestore()">Undo last restore</button>`:''}
      <div class="fine">Last backup: <b>${lastBk}</b>. Everything lives on this device only${places.length?` (${places.join(' + ')})`:''}, ${Math.max(1,Math.round(bytes/1024))} KB${routes?`, plus ${routes} route${routes===1?'':'s'}${Routes.durable()?'':' that this browser will not keep after you close it'}`:''}. Deleting the app from the Home Screen or clearing Safari data erases it, so keep a backup file somewhere else.</div>
      <div class="list" style="margin-top:12px">
        ${setRow('Import from another app',`Strava, Strong, Hevy, JEFIT, Fitbod, Alpha Progression, StrongLifts${strava?` · ${strava} activit${strava===1?'y':'ies'} from Strava so far`:''}`,'setJump(()=>showAppImport(),\'data\')','arrowdown')}
        ${ixImportedApps().length?setRow('Imported data',esc(ixImportedApps().map(ixAppName).join(', '))+' · link exercises or remove an import','setJump(()=>showImportedData(),\'data\')','link'):''}
        ${setRow('Prompts for an assistant','Copy a prompt for a workout plan, meal plan, targets or habits, then paste the answer back','setJump(()=>showAiPrompts(),\'data\')','clip')}
        ${setRow('Daily copies',dailyRowSub(),'showDailyCopies()','repeat')}
        ${setRow('Export for a spreadsheet','Pick what: a daily summary, workouts, sets, meals, foods, activities and more, as CSV','exportCSV()','grid')}
        ${setRow('Install as an app',isInstalledApp()?'Running from your Home Screen':'No App Store needed — add it to your Home Screen','showInstallHelp()','arrowdown')}
      </div>
      <button class="btn btd bfw set-erase" onclick="confirmReset()">Erase everything</button>`;
  }},
};
function closeSetAll(){closeOv('set-pg');closeOv('set-ov');}
// A Settings row that opens a sheet of its own (the check-in, food targets, the weight goal): Settings
// steps aside, and when that sheet is closed you are back on the Settings page you came from.
function setJump(open,page){
  closeSetAll();open();
  const ovs=document.querySelectorAll('.ov');const ov=ovs[ovs.length-1];
  if(!ov||ov.id==='set-ov'||ov.id==='set-pg')return;
  const prev=ov._onDismiss;
  ov._onDismiss=()=>{try{if(prev)prev();}finally{setTimeout(()=>{showSettings();if(page&&SET_PAGES[page])showSetPage(page);},260);}};
}
// ─── Changing things ───
// Profile fields save as you leave each one (and when the page is closed).
function commitProfile(){
  const g=id=>{const el=document.getElementById(id);return el&&el.closest&&el.closest('#set-pg')?el:null;};
  const n=g('set-name');if(n){const v=String(n.value||'').trim();if(v)S.name=v.slice(0,40);}
  const h=g('set-height');if(h){const ht=parseFloat(h.value);const hr=SANE.height[isKg()?'cm':'in'];
    if(ht>0&&ht>=hr[0]&&ht<=hr[1]){S.height=isKg()?r1(ht/2.54):ht;S.profileSet.height=true;}
    else if(ht>0)toast(`Height should be between ${hr[0]} and ${hr[1]} ${isKg()?'cm':'in'}`);}
  const bm=g('set-bmonth');if(bm)S.birthMonth=bm.value?parseInt(bm.value):null;
  const by=g('set-byear');if(by){const y=parseInt(by.value);const yr=new Date().getFullYear();
    if(!y)S.birthYear=null;else if(y>=yr-100&&y<=yr-13)S.birthYear=y;else toast(`Birth year should be between ${yr-100} and ${yr-13}`);}
  save();renderSetHub();
}
// The old Save button's name: some links still call it. Saves the profile fields, nothing else.
function saveSettings(){
  // (fields outside the Profile page — from before Settings had pages — are read too)
  const n=document.getElementById('set-name')?.value?.trim();if(n)S.name=n.slice(0,40);
  const ht=parseFloat(document.getElementById('set-height')?.value);
  if(ht>0){S.height=isKg()?r1(ht/2.54):ht;S.profileSet.height=true;}
  const bm=document.getElementById('set-bmonth')?.value;const by=parseInt(document.getElementById('set-byear')?.value);
  if(bm!==undefined)S.birthMonth=bm?parseInt(bm):null;
  if(!isNaN(by)||document.getElementById('set-byear'))S.birthYear=(by>1900&&by<=new Date().getFullYear())?by:null;
  saveNow();renderSetHub();
}
function setGoal(id){S.goal=id;document.querySelectorAll('[id^="sg-"]').forEach(b=>{b.classList.toggle('btp',b.id===`sg-${id}`);b.classList.toggle('bts',b.id!==`sg-${id}`);});save();renderSetHub();}
function setSex(g){commitProfile();S.aftGender=g==='female'?'female':'male';S.profileSet.sex=true;save();refreshSettings();}
function setPhotoSetting(k,v){
  if(k==='photoSet'&&[1,2,3,4].includes(v))S.photoSet=v;
  if(k==='photoTimer'&&PHOTO_TIMERS.includes(v))S.photoTimer=v;
  save();refreshSettings();
}
function toggleSetting(k){
  S[k]=!S[k];save();
  if(k==='keepAwake')syncWakeLock();
  if(k==='restSound'&&S.restSound)playRestBeep(); // a sample, and it unlocks audio
  if(k==='cueSilent'&&!S.cueSilent){cueSession('auto');}else if(k==='cueSilent')playCue('rest');
  refreshSettings();
}
function setMeasureUnit(u){if(u!=='in'&&u!=='cm')return;S.measureUnit=u;save();refreshSettings();if(S.tab==='progress')progRefresh();}
function setWeekStart(v){S.weekStart=v===0?0:1;bumpMemo();save();refreshSettings();render();}
function setDayEnd(v){if(![0,1,2,3,4].includes(v))return;S.dayEnd=v;bumpMemo();save();refreshSettings();render();}
function setAftStandardSet(v){S.aftStandard=v==='combat'?'combat':'general';save();refreshSettings();if(S.tab==='progress')progRefresh();}
function setAutoWarm(v){if(!['off','first','barbell'].includes(v))return;S.autoWarm=v;save();refreshSettings();}
function setLastFrom(v){S.lastFrom=v==='any'?'any':'routine';bumpMemo();save();refreshSettings();}
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
    <div style="font-size:12px;color:var(--muted);margin:5px 2px 12px">Workouts, routines, bodyweight and records are converted and rounded to a loadable ${u==='kg'?'0.5 kg':'1 lb'}.</div>
    <button class="btn bts bfw" onclick="applyUnit(${jsq(u)},false)">Only change the label</button>
    <div style="font-size:12px;color:var(--muted);margin:5px 2px 12px">Use this if you were already entering ${u} and the label was wrong.</div>
    <div class="fine">Plates, dumbbells and weight steps go back to the ${u} defaults either way. Converting rounds, so converting back can change numbers slightly: use Undo on the message right after if you change your mind.</div>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// Converting rounds every weight to something loadable, so converting back does not give the same
// numbers (67.5 lbs → 30.5 kg → 67 lbs). The data from before is kept until the toast goes, and Undo
// puts it back exactly.
function applyUnit(u,convert){
  const before=JSON.stringify(S);
  if(convert)convertStoredWeights(u);
  else{S.unit=u;gearResetForUnit();rebuildPRs();}
  saveNow();closeOv('unit-ov');refreshSettings();render();
  toast(convert?`Converted to ${u}`:`Now showing ${u}`,'green',{action:'Undo',ms:10000,onAction:()=>{
    try{replaceState(JSON.parse(before));saveNow();refreshSettings();render();toast(`Back to ${JSON.parse(before).unit||'lbs'}, as it was`,'green');}
    catch(e){logError(e,'unit undo');toast('Could not undo the change','red');}
  }});
}
// Erasing asks about a backup first. "Back up now" saves one and then offers the erase; "No backup"
// goes straight to it. Either way the erase itself is still its own, last confirmation.
function confirmReset(){
  const c=snapshotCounts(S);const has=c.workouts+c.routines+c.meals+c.weighIns+(S.activities||[]).length+(S.habits||[]).length>0;
  if(!has){resetFinal();return;} // nothing to lose: no backup question
  const ov=makeOv('reset-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Back up before erasing?</div>
    <div class="sheet-sub">Erasing deletes everything on this device: ${esc(countsText(c))}. ${S.lastExportAt?`Your last backup was ${esc(fmtShort(S.lastExportAt))}.`:'You have no backup.'} A backup file is the only way to get it back.</div>
    <button class="btn btp bfw" onclick="resetBackupThen()">${ICON('folder',15)} Back up now</button>
    <button class="btn bts bfw" style="margin-top:8px" onclick="closeOv('reset-ov');setTimeout(resetFinal,240)">No, erase without a backup</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
async function resetBackupThen(){
  const before=S.lastExportAt||0;
  await exportData();
  if((S.lastExportAt||0)>before){closeOv('reset-ov');setTimeout(resetFinal,240);} // saved: now the erase
  // not saved (share sheet dismissed, or it failed): stay on the question
}
function resetFinal(){
  customConfirm('Every workout, record, meal and setting on this device will be permanently deleted.','Erase everything',()=>{
    endSessionTimers();clearAllAiKeys();coachClearAll();musicClear();clearUndoSnapshot();
    Routes.clear().catch(e=>logError(e,'routes'));
    photosClearAll().catch(e=>logError(e,'photos'));
    dailyClear().catch(e=>logError(e,'daily copy'));
    replaceState(null);
    closeSetAll();
    document.getElementById('nav').style.display='none';
    render();
  },{title:'Erase everything?'});
}

// ─── Backup ───
// A backup is S plus the routes (which live beside S, see 21-routes.js). API keys and the coach
// chat live outside S and are never in it.
function backupJSON(routes){
  const o=JSON.parse(JSON.stringify(S));
  o._app='lahwe';o._appVersion=APP_VERSION;o._exportedAt=new Date().toISOString();
  if(routes&&Object.keys(routes).length)o._routes=routes;
  return JSON.stringify(o);
}
// The routes to put in a backup, without waiting when they are already in memory (they are loaded
// at launch). On an iPhone the share sheet only opens from inside the tap that asked for it; a
// wait on the device database in between can make it refuse.
function routesForBackupNow(){
  if(Store.db&&!Routes.all_)return null;
  const keep=routeIdsInUse();const out={};
  Routes.mem.forEach((rec,id)=>{if(keep.has(id))out[id]=rec;});
  return out;
}
function downloadBlob(filename,blob){
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=filename;a.style.display='none';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1500);
}
function downloadText(filename,text,mime){downloadBlob(filename,new Blob([text],{type:mime||'application/json'}));}
// On iPhone (especially from the Home Screen) a plain download link often goes nowhere, so the
// share sheet is tried first: "Save to Files" puts the file in the folder you choose there, and
// iPhone offers the same folder next time. Returns 'saved' or 'cancel'.
async function shareFile(blob,name,title){
  try{
    if(typeof File!=='undefined'&&navigator.canShare){
      const file=new File([blob],name,{type:blob.type||'application/octet-stream'});
      if(navigator.canShare({files:[file]})){await appShare({files:[file],title});return'saved';}
    }
  }catch(e){if(e&&e.name==='AbortError')return'cancel';} // share sheet dismissed: nothing was saved
  downloadBlob(name,blob);return'saved';
}
// One name a day, sorted by date in Files: "Lah We backup 2026-10-15.json" and, with photos,
// "Lah We backup 2026-10-15 with photos.zip".
function backupName(withPhotos){return`Lah We backup ${today()}${withPhotos?' with photos.zip':'.json'}`;}
function fmtMB(bytes){const mb=bytes/1048576;return mb<1?'under 1 MB':`${mb<10?mb.toFixed(1):Math.round(mb)} MB`;}
function backupDone(withPhotos){
  S.lastExportAt=Date.now();save();closeOv('bk-ov');
  toast(withPhotos?'Backup with photos saved':'Backup saved','green');refreshSettings();
  if(S.tab==='workout'&&!document.querySelector('.ov'))render();
}
// With progress photos on the phone, Back up asks whether to include them. Both files are built
// while the question is on screen, so the tap on the answer is the one that opens the share sheet
// (iOS refuses one opened after a wait).
let _bkAsk=null;
async function exportData(){
  if((S.photos||[]).length){showBackupAsk();return;}
  let json;
  try{json=backupJSON(routesForBackupNow()||await routesForBackup());}catch(e){toast('Could not build the backup','red');logError(e,'export');return;}
  if(await shareFile(new Blob([json],{type:'application/json'}),backupName(false),'Lah We backup')==='saved')backupDone(false);
}
function showBackupAsk(){
  const n=S.photos.length;const my=_bkAsk={json:null,zip:null,failed:false};
  const ov=makeOv('bk-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:2px">Back up</div>
    <div class="sheet-sub">Include your ${n} progress photo${n===1?'':'s'}?</div>
    <button class="btn btp bfw" id="bk-yes" disabled onclick="backupWithPhotos(true)">Getting photos ready…</button>
    <button class="btn bts bfw" id="bk-no" style="margin-top:8px" disabled onclick="backupWithPhotos(false)">No, just my data</button>
    <div class="bk-note">${ICON('folder',15)}<span>Your iPhone asks where to save: tap <b>Save to Files</b> and choose your <b>Lah We</b> folder (make one the first time). It remembers the last folder you used.</span></div>
    <div class="fine" id="bk-miss" hidden></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  ov._onDismiss=()=>{if(_bkAsk===my)_bkAsk=null;};
  (async()=>{
    try{
      my.json=backupJSON(routesForBackupNow()||await routesForBackup());
      const no=document.getElementById('bk-no');if(no&&_bkAsk===my)no.disabled=false;
      my.zip=await photosBackupBuild(my.json);
    }catch(e){my.failed=true;logError(e,'backup photos');}
    if(_bkAsk!==my)return;
    const yes=document.getElementById('bk-yes');if(!yes)return;
    if(!my.zip){yes.textContent='The photos could not be read';return;}
    yes.disabled=false;yes.textContent=`Yes, with photos · ${fmtMB(my.zip.blob.size)}`;
    if(my.zip.missing){const m=document.getElementById('bk-miss');if(m){m.hidden=false;m.textContent=`${my.zip.missing} photo${my.zip.missing===1?' is':'s are'} listed without a picture on this phone and will be left out.`;}}
  })();
}
async function backupWithPhotos(withPhotos){
  const b=_bkAsk;if(!b)return;
  const blob=withPhotos?(b.zip&&b.zip.blob):(b.json&&new Blob([b.json],{type:'application/json'}));if(!blob)return;
  if(await shareFile(blob,backupName(withPhotos),'Lah We backup')==='saved')backupDone(withPhotos);
}

// ─── Export for a spreadsheet ───
// Plain CSV that opens in Numbers, Excel or Google Sheets. You pick what goes in and how far back;
// one pick is one .csv, several are a .zip of them. Not a backup: it cannot be restored.
// Most files are the same flat tables the coach and the custom charts read (65b-coach-data.js),
// so a column means the same thing everywhere; sets, meals and weigh-ins are the full logs.
// A spreadsheet runs a cell that starts with = + - @ (or a tab or return before one) as a formula, so text
// that does gets a leading ' to keep it text. Numbers are left alone: -2.5 has to stay a number you can add up.
function csvCell(v){
  if(v==null)return'';
  if(typeof v==='number')return isFinite(v)?String(v):'';
  const s=String(v);
  const num=/^-?\d+(\.\d+)?$/.test(s),formula=!num&&/^[=+\-@\t\r]/.test(s);
  return formula||/[",\n\r]/.test(s)?'"'+(formula?"'":'')+s.replace(/"/g,'""')+'"':s;
}
function csvText(rows){return rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';}
const inRange=(ds,from,to)=>(!from||ds>=from)&&(!to||ds<=to);
// Every set, warm-ups marked: what you did, not only what counts.
function csvSetsRows(from,to){
  const u=S.unit;
  const rows=[['date','time','workout','exercise','muscle','equipment','set','warm-up','weight ('+u+')','reps or seconds','done','missed','reps in reserve','tag','estimated 1RM ('+u+')']];
  S.workouts.slice().sort((a,b)=>a.started-b.started).forEach(w=>{
    const ds=dayOf(w.started);if(!inRange(ds,from,to))return;
    const d=new Date(w.started);const tm=pad2(d.getHours())+':'+pad2(d.getMinutes());
    (w.exercises||[]).forEach(ex=>{const info=getEx(ex.exId);let n=0,wu=0;(ex.sets||[]).forEach(s=>{const warm=!!s.warmup;const k=warm?++wu:++n;
      rows.push([ds,tm,w.name||'',exName(ex.exId),qdMuscle(ex.exId)||'',info&&info.eq||'',warm?'W'+k:k,warm?'yes':'',s.w||'',s.r||'',s.done?'yes':'',s.fail?'yes':'',s.rir!=null?s.rir:'',s.tag||'',s.done&&!warm?e1rm(s.w,s.r)||'':'']);});});
  });
  return rows;
}
function csvMealsRows(from,to){
  const rows=[['date','meal','foods','kcal','protein (g)','carbs (g)','fat (g)']];
  S.meals.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0).forEach(m=>{if(inRange(m.date,from,to))rows.push([m.date,m.type||m.name||'',(m.items||[]).map(i=>i.name).filter(Boolean).join('; '),Math.round(+m.cals||0),r1(+m.protein||0),r1(+m.carbs||0),r1(+m.fat||0)]);});
  Object.keys(S.macroLogs||{}).sort().forEach(ds=>{const l=S.macroLogs[ds];if(inRange(ds,from,to)&&isObj(l)&&!l.parked&&(+l.cals||+l.protein))rows.push([ds,'Quick log','',Math.round(+l.cals||0),r1(+l.protein||0),r1(+l.carbs||0),r1(+l.fat||0)]);});
  return rows;
}
function csvWeighRows(from,to){
  const rows=[['date','weight ('+S.unit+')']];
  S.bodyweightLog.slice().sort((a,b)=>a.date<b.date?-1:1).forEach(b=>{if(inRange(b.date,from,to))rows.push([b.date,b.weight]);});
  return rows;
}
// The four files the export has always had (kept for anything that reads them).
function csvFiles(){
  const acts=[['date','type','minutes','miles','kcal','notes']];
  S.activities.slice().sort((a,b)=>a.date<b.date?-1:1).forEach(a=>acts.push([a.date,a.type,a.dur||'',a.dist||'',a.cals||'',a.notes||'']));
  const sets=csvSetsRows().map(r=>r.slice(0,4).concat(r.slice(6))); // the old layout had no muscle or equipment
  return[{name:'Workouts (sets).csv',rows:sets},{name:'Meals.csv',rows:csvMealsRows()},{name:'Weigh-ins.csv',rows:csvWeighRows()},{name:'Activities.csv',rows:acts}];
}
// A flat table as rows: headers in words with units, true/false as yes/no, ids left out.
function csvFromTable(name,from,to){
  const T=QD_TABLES[name];if(!T)return[[]];
  const u=S.unit;
  const cols=Object.keys(T.cols).filter(c=>!/(^|_)id$/.test(c));
  const unitOf={weight:u,e1rm:u,aim_weight:u};
  const head=cols.map(c=>{const l=c==='date'?'Date':cchColLabel(c);return unitOf[c]?`${l} (${unitOf[c]})`:l;});
  const prev=_qdTextMax;_qdTextMax=4000; // the coach gets a short note; the file gets all of it
  let rows;try{rows=T.rows(from,to)||[];}finally{_qdTextMax=prev;}
  if(T.dated)rows=rows.filter(r=>!r.date||inRange(r.date,from,to)).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  return[head].concat(rows.map(r=>cols.map(c=>{const v=r[c];return v===true?'yes':v===false?'no':v==null?'':v;})));
}
// What can be exported. dated:false files are a snapshot of now; the range does not apply.
const EXPORT_SETS=[
  {id:'daily',l:'Daily summary',s:'A row a day: training, food, weight, sleep, mood, steps, habits',rows:(f,t)=>csvFromTable('daily',f,t)},
  {id:'workouts',l:'Workouts',s:'A row a workout: length, sets, volume, rating, notes',rows:(f,t)=>csvFromTable('workouts',f,t)},
  {id:'sets',l:'Sets',s:'Every set, warm-ups marked',rows:csvSetsRows},
  {id:'records',l:'Records',s:'Your best set on each exercise',dated:false,rows:()=>csvFromTable('records')},
  {id:'meals',l:'Meals',s:'A row a meal, with its foods and macros',rows:csvMealsRows},
  {id:'foods',l:'Foods eaten',s:'A row for each food in each meal',rows:(f,t)=>csvFromTable('meal_items',f,t)},
  {id:'weighins',l:'Weigh-ins',s:'Every weigh-in',rows:csvWeighRows},
  {id:'measurements',l:'Measurements',s:'Waist, chest, arms…',rows:(f,t)=>csvFromTable('measurements',f,t)},
  {id:'activities',l:'Activities',s:'Runs, rucks, rides: time, distance, pace, heart rate',rows:(f,t)=>csvFromTable('activities',f,t)},
  {id:'habits',l:'Habits',s:'A row per habit per day it was due',rows:(f,t)=>csvFromTable('habit_days',f,t)},
  {id:'supplements',l:'Supplements',s:'A row per supplement per day',rows:(f,t)=>csvFromTable('supplements',f,t)},
  {id:'months',l:'Monthly summary',s:'The monthly report\'s numbers, a row a month',rows:(f,t)=>csvFromTable('month_reports',f,t)},
  {id:'programs',l:'Programs',s:'Each program: weeks, sessions, adherence',dated:false,rows:()=>csvFromTable('programs')},
];
const EXPORT_DEFAULT=['workouts','sets','meals','weighins','activities'];
const EXPORT_RANGES=[{id:'all',l:'All time'},{id:'1y',l:'1 yr',days:365},{id:'6m',l:'6 mo',days:182},{id:'12w',l:'12 wk',days:84},{id:'4w',l:'4 wk',days:28}];
// The first day anything was logged.
function exportFirstDay(){
  let d=today();const see=x=>{if(x&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&x<d)d=x;};
  S.workouts.forEach(w=>see(dayOf(w.started)));(S.meals||[]).forEach(m=>see(m.date));(S.bodyweightLog||[]).forEach(b=>see(b.date));
  (S.activities||[]).forEach(a=>see(a.date));(S.measurements||[]).forEach(m=>see(m.date));
  Object.keys(S.macroLogs||{}).forEach(see);Object.keys(S.habitLog||{}).forEach(see);Object.keys(S.moodLog||{}).forEach(see);Object.keys(S.sleepLog||{}).forEach(see);Object.keys(S.stepsLog||{}).forEach(see);
  return d;
}
function exportSpan(id){const r=EXPORT_RANGES.find(x=>x.id===id)||EXPORT_RANGES[0];return{from:r.days?daysAgoStr(r.days-1):exportFirstDay(),to:today(),r};}
let _xp=null;
function exportPicked(){const ok=EXPORT_SETS.map(x=>x.id);const p=Array.isArray(S.exportPick)?S.exportPick.filter(x=>ok.includes(x)):null;return p&&p.length?p:EXPORT_DEFAULT.slice();}
// Settings → Export for a spreadsheet
function exportCSV(){
  _xp={range:'all',pick:exportPicked()};
  const ov=makeOv('xp-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div id="xp-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);ov._onDismiss=()=>{_xp=null;};
  renderExport();
}
function exportCounts(span){
  const out={};
  EXPORT_SETS.forEach(x=>{try{out[x.id]=Math.max(0,x.rows(span.from,span.to).length-1);}catch(e){logError(e,'export count '+x.id);out[x.id]=0;}});
  return out;
}
function renderExport(){
  const el=document.getElementById('xp-body');if(!el||!_xp)return;
  const span=exportSpan(_xp.range);const n=exportCounts(span);_xp.n=n;
  const picked=_xp.pick.filter(id=>n[id]>0);
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">Export for a spreadsheet</div>
    <div class="sheet-sub">CSV files for Numbers, Excel or Google Sheets. Pick what goes in. It is not a backup and cannot be restored.</div>
    <div class="seg seg-in" role="tablist" style="margin:0 0 12px">${EXPORT_RANGES.map(r=>`<button class="seg-b${r.id===_xp.range?' on':''}" onclick="_xp.range='${r.id}';renderExport()">${r.l}</button>`).join('')}</div>
    ${EXPORT_SETS.some(x=>n[x.id])?`<div class="list xp-list">${EXPORT_SETS.filter(x=>n[x.id]).map(x=>{const on=_xp.pick.includes(x.id);
      return`<button class="row row-tap${on?' xp-on':''}" role="checkbox" aria-checked="${on}" onclick="exportToggle('${x.id}')"><span class="xp-ck">${ICON('tick',14)}</span>
        <span class="row-main"><span class="row-t">${esc(x.l)}</span><span class="row-s">${esc(x.s)}${x.dated===false?' · as of today':''}</span></span>
        <span class="xp-n">${n[x.id].toLocaleString()}</span></button>`;}).join('')}</div>`:'<div class="ch-empty">Nothing logged in this period.</div>'}
    <div class="fine">${_xp.range==='all'?`From ${fmtDay(span.from)}, your first entry.`:`From ${fmtDay(span.from)} to today.`} Numbers are rows.${picked.length>1?' Several files come as one .zip.':''}${EXPORT_SETS.some(x=>!n[x.id])?` Nothing to export yet: ${EXPORT_SETS.filter(x=>!n[x.id]).map(x=>x.l.toLowerCase()).join(', ')}.`:''}</div>
    <div class="sheet-acts">${picked.length?`<button class="btn btp" onclick="exportRun()">${picked.length===1?'Export 1 file':`Export ${picked.length} files`}</button>`:'<span class="be-note">Pick something with entries to export.</span>'}</div>`;
}
function exportToggle(id){
  if(!_xp)return;const i=_xp.pick.indexOf(id);if(i>=0)_xp.pick.splice(i,1);else _xp.pick.push(id);
  _xp.pick=EXPORT_SETS.map(x=>x.id).filter(x=>_xp.pick.includes(x));
  S.exportPick=_xp.pick.slice();save();renderExport();
}
// → [{name, rows}] for what is picked and has rows. Built in the tap, so iPhone's share sheet opens.
function exportFiles(pick,rangeId){
  const span=exportSpan(rangeId);
  return EXPORT_SETS.filter(x=>pick.includes(x.id)).map(x=>({name:x.l+'.csv',rows:x.rows(span.from,span.to)})).filter(f=>f.rows.length>1);
}
async function exportRun(){
  if(!_xp)return;let blob,name;
  try{
    const files=exportFiles(_xp.pick,_xp.range);if(!files.length)return;
    const enc=new TextEncoder();const tag=_xp.range==='all'?today():`${(EXPORT_RANGES.find(r=>r.id===_xp.range)||{}).l} to ${today()}`.replace(/\s+/g,' ');
    if(files.length===1){blob=new Blob(['﻿'+csvText(files[0].rows)],{type:'text/csv'});name=`Lah We ${files[0].name.replace(/\.csv$/,'')} ${tag}.csv`;}
    else{blob=zipStore(files.map(f=>({name:`Lah We ${today()}/${f.name}`,data:enc.encode('﻿'+csvText(f.rows))})));name=`Lah We export ${tag}.zip`;} // the BOM tells Excel it is UTF-8
  }catch(e){logError(e,'csv');toast('Could not build the export','red');return;}
  if(await shareFile(blob,name,'Lah We export')==='saved'){closeOv('xp-ov');toast('Export saved','green');}
}

// ─── Restore ───
function snapshotCounts(o){
  const len=k=>Array.isArray(o&&o[k])?o[k].length:0;
  return{workouts:len('workouts'),routines:len('routines'),meals:len('meals'),weighIns:len('bodyweightLog'),
    routes:(Array.isArray(o&&o.activities)?o.activities:[]).filter(a=>a&&a.rt).length,photos:len('photos')};
}
function countsText(c){return `${c.workouts} workout${c.workouts===1?'':'s'} · ${c.routines} routine${c.routines===1?'':'s'} · ${c.meals} meal${c.meals===1?'':'s'} · ${c.weighIns} weigh-in${c.weighIns===1?'':'s'}${c.routes?` · ${c.routes} route${c.routes===1?'':'s'}`:''}${c.photos?` · ${c.photos} photo${c.photos===1?'':'s'}`:''}`;}
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
  const inp=document.createElement('input');inp.type='file';inp.accept='.json,.zip,application/json,application/zip,text/plain';
  inp.style.display='none';document.body.appendChild(inp); // must be in the document for iOS to deliver the change event
  inp.onchange=e=>{
    const file=e.target.files&&e.target.files[0];inp.remove();if(!file)return;
    window._restoreZip=null;
    if(/\.zip$/i.test(file.name)||/zip/.test(file.type)){restoreZipFile(file);return;}
    if(file.size>60e6){toast('That file is too large to be a backup','red');return;}
    const reader=new FileReader();
    reader.onerror=()=>toast('Could not read that file','red');
    reader.onload=ev=>{
      const data=Store.parse(String(ev.target.result||''));
      if(!data){toast('That file is not a Lah We backup','red');return;}
      if(data._app==='lahwe-photos'){photosImport(data);return;} // a photos file adds to what is here
      const isBackup=Array.isArray(data.workouts)||'_schema' in data||'onboarded' in data;
      if(!isBackup){
        toast(Array.isArray(data.routines)||Array.isArray(data.groups)?'That is a split or program file — use Library → Splits → +  → Import':'That file is not a Lah We backup','red');return;
      }
      confirmRestore(data,file.name);
    };
    reader.readAsText(file);
  };
  inp.click();
}
// A backup made with photos: data.json is read from the zip now; the photos only once it is restored.
async function restoreZipFile(file){
  let entries,data;
  try{
    entries=await zipIndex(file);
    const ent=entries.filter(e=>/(^|\/)data\.json$/i.test(e.name)).sort((a,b)=>a.name.length-b.name.length)[0];
    if(!ent){toast('That zip is not a Lah We backup','red');return;}
    data=Store.parse(new TextDecoder().decode(await zipExtract(file,ent,80e6,'The backup')));
  }catch(e){toast((e&&e.message)||'That zip could not be read','red');return;}
  if(!data||!(Array.isArray(data.workouts)||'_schema' in data)){toast('That zip is not a Lah We backup','red');return;}
  window._restoreZip={file,entries};
  confirmRestore(data,file.name);
}
function confirmRestore(data,fileName){
  window._restoreData=data;
  const inc=snapshotCounts(data),cur=snapshotCounts(S);
  const when=data._exportedAt?fmtDate(data._exportedAt):(data._savedAt?fmtDate(data._savedAt):'unknown date');
  const older=(inc.workouts<cur.workouts)||(data._savedAt&&S._savedAt&&data._savedAt<S._savedAt-86400000&&inc.workouts<=cur.workouts);
  const live=S.activeWorkout?'<br><b>The workout you have open right now will be discarded.</b>':'';
  // A backup without photos lists them but has no pictures: those still on this phone show again.
  const noPics=inc.photos&&!window._restoreZip?'<br><small>The photo pictures are not in this file; any still on this phone show up again.</small>':'';
  customConfirm(`<b>${esc(fileName||'Backup')}</b> — saved ${esc(when)}<br>${countsText(inc)}${noPics}<br><br>It replaces what is on this device now:<br>${countsText(cur)}${older?'<br><br><b style="color:var(--red)">This backup has less in it than this device does.</b>':''}${live}<br><br>You can undo this from Settings afterwards.`,
    'Replace my data',()=>{doRestore();},{title:'Restore this backup?'});
}
async function doRestore(){
  const data=window._restoreData;window._restoreData=null;if(!data)return;
  // Restoring over data that could not be read: keep the unreadable copy, don't snapshot the blank state.
  const wasCorrupt=!!Store.corrupt;
  if(wasCorrupt)Store.lsSet(STORE_KEY+'_corrupt_'+Date.now(),Store.corrupt);
  const snap=wasCorrupt?false:await writeUndoSnapshot();
  // The routes are taken out of the file before anything else sees it: they belong in the device
  // database, not in S. An older backup has none, and restores as it always did.
  const routes=routesFromBackup(data);
  const ph=photoFilesFromBackup(data);const zip=window._restoreZip;window._restoreZip=null;
  try{
    endSessionTimers();
    replaceState(data); // same normalising + migration path as a normal load
    coachClear();       // the chat referred to the data that was just replaced
    await routesRestore(routes);
    if(zip&&ph){toast('Restoring photos…');await photosRestoreZip(zip.file,zip.entries,ph);}
  }catch(e){
    logError(e,'restore');toast('Restore failed — your data was not changed','red');
    const back=await readUndoSnapshot();if(back){try{replaceState(back);}catch(e2){}}
    return;
  }
  closeSetAll();
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
    closeSetAll();
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
