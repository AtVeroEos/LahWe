// ═══════════════════════════════════════════════════
// REMINDERS (calendar alerts) · INSTALLING THE APP
// ═══════════════════════════════════════════════════
// A web app on an iPhone cannot schedule its own notifications: the only kind Apple allows is a
// push sent from a server, and this app has no server. So reminders are handed to the phone's own
// Calendar as repeating events with alerts. They fire on time whether or not the app is open.
const REM_DAY_CODES=['SU','MO','TU','WE','TH','FR','SA'];
const REM_KINDS=[
  {id:'workout',label:'Workout',title:'Workout — Lah We',alarm:'Time to train',minutes:60,days:true},
  {id:'weigh',label:'Weigh-in',title:'Weigh in — Lah We',alarm:'Step on the scale and log it',minutes:5,days:true},
  {id:'food',label:'Log food',title:'Log your food — Lah We',alarm:'Log today\'s meals',minutes:5,days:false},
];
function defaultReminders(){
  return{workout:{on:false,time:'17:30',days:[1,2,4,5]},weigh:{on:false,time:'07:00',days:[0,1,2,3,4,5,6]},food:{on:false,time:'20:00',days:[0,1,2,3,4,5,6]}};
}
function normalizeReminders(r){
  const d=defaultReminders();if(!isObj(r))return d;
  REM_KINDS.forEach(k=>{
    const v=isObj(r[k.id])?r[k.id]:{};
    d[k.id].on=v.on===true;
    if(typeof v.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time))d[k.id].time=v.time;
    if(Array.isArray(v.days)){const days=[...new Set(v.days.map(Number))].filter(n=>n>=0&&n<=6).sort();if(days.length)d[k.id].days=days;}
  });
  return d;
}
// The weekdays training actually happens on, when the active group pins routines to days.
function plannedTrainingDays(){
  const g=getActiveGroup();
  if(g&&g.mode==='daypicker'){
    const days=[...new Set((g.routineIds||[]).flatMap(id=>(g.dayMap||{})[id]||[]))].sort();
    if(days.length)return days;
  }
  return null;
}
function icsEscape(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');}
function icsLocal(d){return`${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;}
function icsUtc(d){return`${d.getUTCFullYear()}${pad2(d.getUTCMonth()+1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;}
// The calendar file for whichever reminders are switched on. Times are "floating" (no time zone),
// so 07:00 means 07:00 wherever the phone is.
function remindersICS(){
  const now=new Date();const R=S.reminders;
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Lah We//Reminders//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Lah We'];
  let n=0;
  REM_KINDS.forEach(k=>{
    const r=R[k.id];if(!r||!r.on)return;
    const days=k.days?r.days:[0,1,2,3,4,5,6];if(!days.length)return;
    const [hh,mm]=r.time.split(':').map(Number);
    // First occurrence: today or the next chosen weekday, so the start date agrees with the rule.
    const start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),hh,mm,0);
    for(let i=0;i<7&&!days.includes(start.getDay());i++)start.setDate(start.getDate()+1);
    lines.push('BEGIN:VEVENT',`UID:lahwe-${k.id}@lahwe.app`,`DTSTAMP:${icsUtc(now)}`,`SEQUENCE:${Math.floor(now.getTime()/1000)}`,
      `DTSTART:${icsLocal(start)}`,`DURATION:PT${k.minutes}M`,
      days.length===7?'RRULE:FREQ=DAILY':`RRULE:FREQ=WEEKLY;BYDAY=${days.map(d=>REM_DAY_CODES[d]).join(',')}`,
      `SUMMARY:${icsEscape(k.title)}`,'TRANSP:TRANSPARENT',
      'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(k.alarm)}`,'TRIGGER:PT0M','END:VALARM','END:VEVENT');
    n++;
  });
  lines.push('END:VCALENDAR');
  return n?lines.join('\r\n')+'\r\n':'';
}
function showReminders(){
  const ov=makeOv('rem-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt">Reminders</div><div id="rem-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderReminders();
}
function renderReminders(){
  const el=document.getElementById('rem-body');if(!el)return;
  const modal=el.closest('.modal');const sc=modal?modal.scrollTop:0;
  const R=S.reminders;const planned=plannedTrainingDays();
  const tog=(on,fn,label)=>`<button class="tog${on?' on':''}" onclick="${fn}" role="switch" aria-checked="${on?'true':'false'}" aria-label="${label}"></button>`;
  const anyOn=REM_KINDS.some(k=>R[k.id].on);
  el.innerHTML=`
    <div style="font-size:12px;color:var(--muted);line-height:1.5;margin:-6px 0 12px">These are added to your phone's Calendar as repeating events with alerts, so they go off on time even when Lah We is closed. (A web app on iPhone cannot send its own notifications without a server, and this one has none.)</div>
    ${REM_KINDS.map(k=>{const r=R[k.id];return`<div class="rem-row">
      <div class="frow"><span class="set-lbl">${k.label}</span>
        <input type="time" value="${esc(r.time)}" onchange="setReminder('${k.id}','time',this.value)" style="width:auto;padding:7px 9px;font-size:14px"${r.on?'':' disabled'}>${tog(r.on,`setReminder('${k.id}','on',${!r.on})`,k.label+' reminder')}</div>
      ${k.days&&r.on?`<div class="rem-days">${[1,2,3,4,5,6,0].map(d=>`<button class="chip${r.days.includes(d)?' on':''}" onclick="toggleReminderDay('${k.id}',${d})">${PLAN_SHORT[d][0]}${PLAN_SHORT[d][1]}</button>`).join('')}</div>
        ${k.id==='workout'&&planned&&planned.join()!==r.days.join()?`<button class="btn btg bxs" style="margin-top:4px" onclick="setReminder('workout','days',[${planned.join(',')}])">Use my group's days (${planned.map(d=>PLAN_SHORT[d]).join(', ')})</button>`:''}`:''}
    </div>`;}).join('')}
    <button class="btn btp bfw" style="margin-top:14px" onclick="addRemindersToCalendar()"${anyOn?'':' disabled'}>Add to my calendar</button>
    <button class="btn bts bfw" style="margin-top:8px" onclick="shareRemindersFile()"${anyOn?'':' disabled'}>Share the calendar file…</button>
    <div style="font-size:12px;color:var(--muted);line-height:1.55;margin-top:10px">Your phone asks before adding anything. To change a time, change it here and add again — the events are replaced, not doubled, in most calendars. To stop a reminder, delete its “… — Lah We” event in Calendar and choose <i>all future events</i>.</div>
    <button class="btn btg bfw" style="margin-top:8px" onclick="closeOv('rem-ov')">Done</button>`;
  if(modal){modal.style.animation='none';modal.scrollTop=sc;}
}
function setReminder(id,field,value){
  const r=S.reminders[id];if(!r)return;
  if(field==='on')r.on=!!value;
  else if(field==='time'){if(/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)))r.time=value;}
  else if(field==='days'&&Array.isArray(value)&&value.length)r.days=value.slice().sort();
  save();renderReminders();
}
function toggleReminderDay(id,d){
  const r=S.reminders[id];if(!r)return;
  const i=r.days.indexOf(d);
  if(i>=0){if(r.days.length===1){toast('Keep at least one day');return;}r.days.splice(i,1);}else r.days.push(d);
  r.days.sort();save();renderReminders();
}
function addRemindersToCalendar(){
  const ics=remindersICS();if(!ics){toast('Switch a reminder on first');return;}
  try{downloadText('lahwe-reminders.ics',ics,'text/calendar');toast('Open the file to add the reminders to Calendar','green',{ms:4500});}
  catch(e){toast('Could not create the calendar file','red');logError(e,'reminders');}
}
async function shareRemindersFile(){
  const ics=remindersICS();if(!ics){toast('Switch a reminder on first');return;}
  try{
    if(typeof File!=='undefined'&&navigator.canShare){
      const file=new File([ics],'lahwe-reminders.ics',{type:'text/calendar'});
      if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'Lah We reminders'});return;}
    }
  }catch(e){if(e&&e.name==='AbortError')return;}
  addRemindersToCalendar();
}

// ─── Installing ───
function isInstalledApp(){
  try{return !!(navigator.standalone||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches));}catch(e){return false;}
}
function showInstallHelp(){
  const hosted=/^https?:$/.test(location.protocol);const installed=isInstalledApp();
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent||'');
  const ov=makeOv('install-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt">Install Lah We</div>
    ${installed?`<div class="ai-ok" style="margin:0 0 12px">Installed: this is running as an app from your Home Screen.</div>`:''}
    <div style="font-size:13px;line-height:1.55;color:var(--muted);margin-bottom:12px">Lah We does not come from the App Store and does not need to. Adding it to the Home Screen gives you a real app icon, a full screen with no browser bars, and it opens with no signal.</div>
    ${window._installEvt&&!installed?`<button class="btn btp bfw" style="margin-bottom:12px" onclick="runInstallPrompt()">Install now</button>`:''}
    <div class="rule" style="padding-top:10px"><div class="rule-t">iPhone or iPad</div><div class="rule-u">Open this page in <b>Safari</b> → tap <b>Share</b> → <b>Add to Home Screen</b> → Add. Then always open it from the icon: the icon and Safari keep separate data.</div></div>
    <div class="rule"><div class="rule-t">Android</div><div class="rule-u">Open this page in Chrome → menu <b>⋮</b> → <b>Install app</b> (or Add to Home screen).</div></div>
    <div class="rule"><div class="rule-t">Mac or PC</div><div class="rule-u">In Chrome or Edge, use the install icon at the right of the address bar. In Safari on a Mac: File → Add to Dock.</div></div>
    <div class="rule"><div class="rule-t">As a single file</div><div class="rule-u">The whole app is one HTML file that runs with no internet on a computer. ${ios?'On an iPhone a saved file cannot keep your data, so use Add to Home Screen instead.':'Keep it anywhere and open it in a browser. Data stays with the copy you open, so pick one and stick with it.'}</div>
      ${hosted?`<button class="btn bts bsm" style="margin-top:6px" onclick="downloadAppFile()">Download lahwe.html</button>`:''}</div>
    <div style="font-size:12px;color:var(--muted);line-height:1.5;margin:10px 0">Whichever way you install it, back up now and then (Settings → Back up). Removing the icon or clearing browser data erases what is stored on the device.</div>
    <button class="btn btg bfw" onclick="closeOv('install-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
async function runInstallPrompt(){
  const e=window._installEvt;if(!e)return;
  try{e.prompt();await e.userChoice;}catch(x){}
  window._installEvt=null;closeOv('install-ov');
}
async function downloadAppFile(){
  try{
    const res=await fetch('lahwe.html',{cache:'no-store'});
    if(!res.ok)throw new Error('not found');
    downloadText('lahwe.html',await res.text(),'text/html');
    toast('Saved lahwe.html','green');
  }catch(e){toast('Could not fetch the file — try again when you are online','red');}
}
