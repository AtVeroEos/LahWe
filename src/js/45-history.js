// ═══════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════
// History is a view inside the Progress tab (see renderProgress); Schedule is a page of Home
// (renderHomeSchedule). renderHistory keeps the older call sites working: it redraws whichever of the two is showing.
function renderHistory(c){
  c=c||document.getElementById('content');
  if(document.getElementById('calr-body')){calRefresh();if(document.getElementById('calday-ov')&&_calDay)renderCalDay();}
  if(S.tab==='progress')renderProgress(c);
  else if(S.tab==='workout'&&S.homeView==='schedule')renderHomeSchedule(c);
}
function setHistTab(t){if(t==='cal')go('schedule');else setProgView('history');}
function setProgView(v){
  if(!PROG_VIEWS.includes(v))v='progress';
  S.progView=v;
  save();
  if(S.tab!=='progress'){go(v==='history'?'history':'progress');return;}
  const c=document.getElementById('content');c.scrollTop=0;renderProgress(c);
}
// ─── History: by month, with a search and a filter (35b-listbar.js) ───
// Every workout and activity ever logged can run to hundreds of rows (an import brings years),
// so the months are drawn a few at a time and each says what is in it.
const HIST_FIRST=40; // rows drawn before "Show earlier"
let _histMore=0;
function histItems(){
  const items=[];
  S.workouts.forEach(w=>items.push({type:'workout',date:w.started,ds:dayOf(w.started),data:w}));
  if(modOn('cardio'))S.activities.forEach(a=>items.push({type:'activity',date:a.at&&dayOf(a.at)===a.date?a.at:dayDate(a.date).getTime(),ds:a.date,data:a}));
  return items.sort((a,b)=>b.date-a.date);
}
function histActLabel(a){const t=ACT_TYPES.find(x=>x.id===a.type)||{icon:'⚡',label:'Activity'};return{t,label:a.src==='strava'&&a.notes?String(a.notes).split('\n')[0].slice(0,48):t.label};}
function histText(item){
  if(item.type==='workout'){const w=item.data;const r=w.routineId?(S.routines||[]).find(x=>x.id===w.routineId):null;const p=w.prog?programById(w.prog.id):null;
    return[w.name,r&&r.name,p&&p.name,...(w.exercises||[]).map(e=>exName(e.exId)),w.notes].filter(Boolean).join(' ');}
  const a=item.data;return[histActLabel(a).label,histActLabel(a).t.label,a.notes].filter(Boolean).join(' ');
}
function histRowHTML(item){
  if(item.type==='workout'){const wk=item.data;return`<div class="hi" onclick="showWkDetail(${jsq(wk.id)})"><div style="flex:1"><div class="hn">${esc(wk.name)}</div><div class="hm">${fmtDate(wk.started)} · ${wk.ended?fmtDur(wk.ended-wk.started):'–'} · ${doneSetCnt(wk)} set${doneSetCnt(wk)===1?'':'s'}</div></div><div style="text-align:right;flex-shrink:0"><div class="mono" style="font-size:12px">${Math.round(totalVol(wk)).toLocaleString()}</div><div style="font-size:12px;color:var(--muted);">${S.unit}</div></div></div>`;}
  const a=item.data;const t=ACT_TYPES.find(x=>x.id===a.type)||{icon:'⚡',label:'Activity'};
  return`<div class="hi" onclick="showActivityDetail(${jsq(a.id)})"><div class="act-icon">${ICON(t.icon,18)}</div><div style="flex:1"><div class="hn">${a.src==='strava'&&a.notes?esc(String(a.notes).split('\n')[0].slice(0,48)):t.label}${a.dist?` · ${esc(a.dist)}mi`:''}</div><div class="hm">${fmtDate(a.date+'T12:00:00')} · ${a.dur?esc(a.dur)+'min':''}${a.cals?` · ~${a.cals} kcal`:''}${a.src==='strava'?' · Strava':''}</div></div></div>`;
}
lbDef('history',{
  search:'Search workouts, exercises, notes',
  chips(){
    const it=histItems();const w=it.filter(x=>x.type==='workout').length,a=it.length-w;
    // The programs you trained, newest first: four at most, so the row stays one swipe.
    const progs=[];const seen=new Set();
    it.forEach(x=>{const p=x.type==='workout'&&x.data.prog?programById(x.data.prog.id):null;if(p&&!seen.has(p.id)&&progs.length<4){seen.add(p.id);progs.push(p);}});
    const pn=id=>it.filter(x=>x.type==='workout'&&x.data.prog&&x.data.prog.id===id).length;
    return[{id:'all',l:'All'},{id:'workouts',l:'Workouts',n:w}].concat(modOn('cardio')?[{id:'activities',l:'Activities',n:a}]:[],progs.map(p=>({id:'p:'+p.id,l:p.name,n:pn(p.id)})));
  },
  body(st){
    const all=histItems();
    if(!all.length)return`<div class="empty"><div style="margin-bottom:12px;color:var(--muted2)">${ICON('clipboard',34)}</div><div class="etit">Nothing logged yet</div><p style="font-size:12px">Workouts and activities appear here</p></div>`;
    let items=all;
    if(st.chip==='workouts')items=items.filter(x=>x.type==='workout');
    else if(st.chip==='activities')items=items.filter(x=>x.type==='activity');
    else if(st.chip.startsWith('p:'))items=items.filter(x=>x.type==='workout'&&x.data.prog&&x.data.prog.id===st.chip.slice(2));
    if(st.q)items=items.filter(x=>lbMatch(st.q,histText(x)));
    if(!items.length)return`<div class="ch-empty lb-none">Nothing matches${st.q?` “${esc(st.q)}”`:''}.</div>`;
    // Whole months only: a month is never cut in half by "Show earlier".
    const limit=st.q||st.chip!=='all'?Infinity:HIST_FIRST+_histMore;
    const months=[];items.forEach(x=>{const k=x.ds.slice(0,7);let m=months[months.length-1];if(!m||m.k!==k){m={k,items:[]};months.push(m);}m.items.push(x);});
    let shown=0,html='',cut=0;
    for(const m of months){
      if(shown>=limit){cut+=m.items.length;continue;}
      const w=m.items.filter(x=>x.type==='workout').length,a=m.items.length-w;
      const mo=CAL_MONTHS[+m.k.slice(5,7)-1]+(m.k.slice(0,4)===today().slice(0,4)?'':' '+m.k.slice(0,4));
      html+=`<div class="sec-h lb-mh"><span>${esc(mo)}</span><i>${[w?`${w} workout${w===1?'':'s'}`:'',a?`${a} activit${a===1?'y':'ies'}`:''].filter(Boolean).join(' · ')}</i></div>
        <div class="card">${m.items.map(histRowHTML).join('')}</div>`;
      shown+=m.items.length;
    }
    if(cut)html+=`<button class="btn bts lb-more" onclick="_histMore+=80;lbPaint('history')">Show earlier · ${cut.toLocaleString()} more</button>`;
    return html;
  }});
function renderHistList(){return`<div class="lb-wrap">${lbHTML('history')}</div>`;}
function wkDetailExHTML(wk){
  const groups=ssGroups(wk.exercises);const ssM={};groups.forEach(g=>{for(let k=g.start;k<=g.end;k++)ssM[k]=g;});
  let html='';
  wk.exercises.forEach((ex,exi)=>{
    const done=ex.sets.map((s,si)=>({s,si})).filter(x=>x.s.done);
    const work=done.filter(x=>!x.s.warmup).length;
    const inSS=ssM[exi];const isStart=inSS&&inSS.start===exi;const isEnd=inSS&&inSS.end===exi;
    if(isStart){const cnt=inSS.end-inSS.start+1;html+=`<div style="border-left:3px solid var(--navy);padding-left:8px;margin:4px 0"><div style="font-size:12px;font-weight:600;color:var(--navy);margin-bottom:2px">${ssLabel(cnt)}</div>`;}
    html+=`<div class="wsr"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">${esc(exName(ex.exId))}</div>
      <div class="set-chips">${done.map(({s,si})=>{
        const label=ex.timed?`${esc(s.r||0)}s`:`${s.w?esc(s.w)+'×':''}${esc(s.r||0)}`;
        const cls='set-chip'+(s.warmup?' warm':'')+(s.excl?' excl':'');
        const tap=` onclick="showSetEdit(${jsq(wk.id)},${exi},${si})" role="button" tabindex="0" aria-label="Edit this set"`;
        return`<span class="${cls}"${tap}>${s.warmup?'W ':''}${label}${s.fail?' · failed':''}${s.tag?` · ${esc(s.tag)}`:''}</span>`;
      }).join('')||'<span style="font-size:12px;color:var(--muted2)">no completed sets</span>'}</div>
    </div><div class="mono" style="font-size:12px;color:var(--muted);flex-shrink:0;margin-left:8px">${work} set${work===1?'':'s'}</div></div>`;
    if(isEnd)html+=`</div>`;
  });
  return html;
}
function showWkDetail(id){
  const wk=S.workouts.find(w=>w.id===id);if(!wk)return;
  const exHtml=wkDetailExHTML(wk);
  const hasWeighted=wk.exercises.some(ex=>!ex.timed&&ex.sets.some(s=>s.done&&!s.warmup));
  const ov=makeOv('wk-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt"${wk.src&&wk.src!=='strava'?' style="margin-bottom:2px"':''}>${esc(wk.name)}</div>
    ${wk.src&&wk.src!=='strava'?`<div class="sheet-sub ix-tag">${ICON('arrowdown',13)} Imported · ${esc(ixAppName(wk.src))}${wk.noTime?' · no time of day in the file':''}</div>`:''}
    <div class="sgrid" style="border-radius:10px;overflow:hidden;border:1px solid var(--border);margin-bottom:13px">
      <div class="sc"><div class="sv" style="font-size:12px">${fmtDate(wk.started)}</div><div class="slb">Date</div></div>
      <div class="sc"><div class="sv">${wk.ended?fmtDur(wk.ended-wk.started):'–'}</div><div class="slb">Duration</div></div>
      <div class="sc"><div class="sv">${Math.round(totalVol(wk)).toLocaleString()}</div><div class="slb">Vol (${S.unit})</div></div>
      <div class="sc"><div class="sv">${wk.cals||'–'}</div><div class="slb">~kcal${wk.calsCapped?' (capped)':''}</div></div>
    </div>
    ${wk.notes?`<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:9px 12px;margin-bottom:12px;font-size:12px;color:var(--muted);line-height:1.5;white-space:pre-wrap">${esc(wk.notes)}</div>`:''}
    <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:7px">Exercises</div>
    <div id="wk-ex-list" style="border:1px solid var(--border);border-radius:10px;padding:0 12px;margin-bottom:${hasWeighted?'6':'13'}px">${exHtml||'<div style="padding:10px;color:var(--muted);font-size:12px">No exercises</div>'}</div>
    ${hasWeighted?`<div style="font-size:12px;color:var(--muted2);margin-bottom:13px;line-height:1.45">Logged a typo? Tap a set to fix it, or to leave it out of records.</div>`:''}
    <button class="btn btd bfw" onclick="confirmDeleteWk(${jsq(id)})">Delete Workout</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// Leave a logged set out of PRs and strength history (or put it back). The set stays in the
// workout; this is how a mistyped weight stops being a "record".
function toggleSetExcluded(wkId,exi,si){
  const wk=S.workouts.find(w=>w.id===wkId);const s=wk&&wk.exercises[exi]&&wk.exercises[exi].sets[si];if(!s)return;
  if(s.excl)delete s.excl;else s.excl=true;
  rebuildPRs();save();
  const list=document.getElementById('wk-ex-list');if(list)list.innerHTML=wkDetailExHTML(wk);
  toast(s.excl?'Set excluded from PRs and charts':'Set counts again',s.excl?'gold':'green');
}
// Fix a set in a saved workout: its weight and reps (or seconds), and whether it counts toward records.
// The same checks as ticking a set apply; Undo on the toast puts the old numbers back.
function showSetEdit(wkId,exi,si){
  const wk=S.workouts.find(w=>w.id===wkId);const ex=wk&&wk.exercises[exi];const s=ex&&ex.sets[si];if(!s)return;
  const load=!ex.timed&&!ex.cardio&&(parseFloat(s.w)>0||(getEx(ex.exId)||{}).eq!=='Bodyweight');
  const n=ex.sets.slice(0,si+1).filter(x=>!!x.warmup===!!s.warmup).length;
  const ov=makeOv('setedit-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:2px">${esc(exName(ex.exId))}</div>
    <div class="sheet-sub">${s.warmup?'Warm-up':'Set'} ${n} · ${esc(fmtDate(wk.started))}</div>
    <div class="frow" style="gap:10px">
      ${load?`<div class="fg" style="flex:1"><label class="fl">Weight (${S.unit})</label><input type="number" inputmode="decimal" min="0" id="se-w" value="${esc(s.w||'')}"></div>`:''}
      <div class="fg" style="flex:1"><label class="fl">${ex.timed?'Seconds':ex.cardio?'Seconds':'Reps'}</label><input type="number" inputmode="numeric" min="0" id="se-r" value="${esc(s.r||'')}"></div>
    </div>
    ${s.warmup||ex.timed||ex.cardio?'':`<div class="frow set-row" style="margin:2px 0 14px"><span class="set-lbl">Count toward records<small style="display:block;font-weight:500;color:var(--muted);font-size:12px">Off leaves it in the workout but out of PRs and strength charts</small></span>
      <button class="tog${s.excl?'':' on'}" id="se-count" role="switch" aria-checked="${s.excl?'false':'true'}" aria-label="Count toward records" onclick="this.classList.toggle('on');this.setAttribute('aria-checked',this.classList.contains('on'))"></button></div>`}
    <button class="btn btp bfw" onclick="saveSetEdit(${jsq(wkId)},${exi},${si})">Save</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function saveSetEdit(wkId,exi,si,sure){
  const wk=S.workouts.find(w=>w.id===wkId);const ex=wk&&wk.exercises[exi];const s=ex&&ex.sets[si];if(!s)return;
  const wi=document.getElementById('se-w'),ri=document.getElementById('se-r'),ci=document.getElementById('se-count');
  const nw=wi?String(wi.value).trim():s.w,nr=ri?String(ri.value).trim():s.r;
  if(!(parseFloat(nr)>0)){toast(ex.timed?'Enter the seconds':'Enter the reps');return;}
  const next=Object.assign({},s,{w:nw,r:nr});
  if(!sure){
    const chk=togSetCheck(ex,next);
    if(chk&&chk.block){toast(chk.block,'red',{ms:3600});return;}
    if(chk&&chk.ask){customConfirm(esc(chk.ask),'Save it',()=>saveSetEdit(wkId,exi,si,true),{title:'Far above your best',safe:true});return;}
  }
  const old={w:s.w,r:s.r,excl:!!s.excl};
  s.w=nw;s.r=nr;
  if(ci){if(ci.classList.contains('on'))delete s.excl;else s.excl=true;}
  rebuildPRs();save();closeOv('setedit-ov');
  const list=document.getElementById('wk-ex-list');if(list)list.innerHTML=wkDetailExHTML(wk);
  toast('Set updated','green',{action:'Undo',onAction:()=>{
    s.w=old.w;s.r=old.r;if(old.excl)s.excl=true;else delete s.excl;rebuildPRs();save();
    const l=document.getElementById('wk-ex-list');if(l)l.innerHTML=wkDetailExHTML(wk);}});
  rerender();
}
function confirmDeleteWk(id){customConfirm('Permanently delete this workout? Any PRs set in it are removed too.','Delete workout',()=>{S.workouts=S.workouts.filter(w=>w.id!==id);rebuildPRs();saveNow();closeOv('wk-ov');closeOv('pr-ov');render();});}
function showActivityDetail(id){
  const a=S.activities.find(x=>x.id===id);if(!a)return;
  const t=ACT_TYPES.find(x=>x.id===a.type)||{icon:'⚡',label:'Activity'};
  const mi=parseFloat(a.dist)||0;const sec=actSec(a);
  // An imported activity knows its time to the second; one typed in here is in whole minutes.
  const exact=a.sec>0;const pace=mi>0&&sec>0&&!a.distEst&&!a.durEst&&(t.fields||[]).includes('dist')&&a.type!=='bike'?sec/mi:null;
  const withRoute=!!a.rt&&runningOn();
  const title=a.src==='strava'&&a.notes?String(a.notes).split('\n')[0].slice(0,60):t.label;
  const ov=makeOv('ad-ov');
  ov.innerHTML=`<div class="modal"${withRoute?' style="max-height:94vh"':''}><div class="mh"></div>
    <div style="margin-bottom:6px;color:var(--navy)">${ICON(t.icon,30)}</div><div class="mt">${esc(title)}</div>${a.src==='strava'?`<div class="sheet-sub">${title===t.label?'':esc(t.label)+' · '}From Strava${a.at?` · started ${new Date(a.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:''}</div>`:''}
    <div class="sgrid" style="border-radius:10px;overflow:hidden;border:1px solid var(--border);margin-bottom:13px">
      <div class="sc"><div class="sv" style="font-size:12px">${fmtDate(a.date+'T12:00:00')}</div><div class="slb">Date</div></div>
      ${a.dist?`<div class="sc"><div class="sv">${esc(a.dist)}${a.distEst?'*':''}</div><div class="slb">Miles</div></div>`:''}
      ${a.dur?`<div class="sc"><div class="sv">${exact?fmtClock(a.sec):esc(a.dur)}${a.durEst?'*':''}</div><div class="slb">${exact?'Time':'Min'}</div></div>`:''}
      ${pace?`<div class="sc"><div class="sv" id="ad-pace">${fmtPace(pace)}</div><div class="slb">A mile</div></div>`:''}
      ${a.cals?`<div class="sc"><div class="sv">${a.cals}</div><div class="slb">~kcal</div></div>`:''}
    </div>
    ${a.notes&&!(a.src==='strava'&&!String(a.notes).includes('\n'))?`<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:9px 12px;margin-bottom:12px;font-size:12px;color:var(--muted);white-space:pre-wrap">${esc(a.notes)}</div>`:''}
    ${a.distEst||a.durEst?`<div style="font-size:12px;color:var(--muted2);margin-bottom:10px">* estimated from the value you entered</div>`:''}
    ${withRoute?`<div id="ad-run"></div>`:''}
    <button class="btn btd bfw" style="margin-top:12px" onclick="deleteActivity(${jsq(id)})">Delete Activity</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  if(withRoute)actRouteFill(a).catch(e=>logError(e,'route'));
}
function deleteActivity(id){
  const a=S.activities.find(x=>x.id===id);
  customConfirm(a&&a.rt?'Remove this activity and its route?':'Remove this activity?','Delete',()=>{
    S.activities=S.activities.filter(x=>x.id!==id);save();
    Routes.del(id).catch(e=>logError(e,'routes')); // the route goes with it, now rather than at the next launch
    document.getElementById('ad-ov')?.remove();closeOv('run-ov');
    renderHistory(document.getElementById('content'));
  });
}

// ─── Calendar ───
function groupName(gid){return esc(((S.groups||[]).find(g=>g.id===gid)||{}).name||'(deleted split)');} // returns escaped text
function programBanner(){
  const p=runningProgram();
  if(!p){
    const paused=(S.programs||[]).find(x=>x.status==='paused');
    return`<div class="prog-banner"><div style="font-size:12px;color:var(--muted)">${paused?`${esc(paused.name)} is paused`:'No program running'}</div>
      <button class="btn bts bxs" onclick="${paused?`showProgram(${jsq(paused.id)})`:'showLibAddProgram()'}">${paused?'Open':'Set one up'}</button></div>`;
  }
  const st=progState(p);
  const pct=Math.round(Math.min(1,(st.doneWeeks+(st.trainedNow?0.5:0))/Math.max(1,st.total))*100);
  return`<button class="prog-banner prog-banner-on" onclick="showProgram(${jsq(p.id)})">
    <div style="flex:1;min-width:0;text-align:left">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px">
        <div style="font-size:13px;font-weight:600">${esc(p.name)} · week ${st.week} of ${st.total}</div>
        <div style="font-size:12px;color:var(--muted)">${st.finish?'ends '+fmtDay(st.finish):''}</div>
      </div>
      <div class="pb-track"><div style="width:${pct}%"></div></div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">${st.phase?esc(shortSplitName((progGroup(st.phase.ph)||{}).name,p)):''}${st.deload?' · deload week':''}</div>
    </div></button>`;
}
// The month grid itself is in 59-calendar.js.
function calDayTap(ds){
  const isRest=!isTrainingDay(ds);
  const ovRid=S.schedule.routineOverrides&&S.schedule.routineOverrides[ds];
  const ovLabel=ovRid==='rest'?'Rest (override)':ovRid?(S.routines||[]).find(r=>r.id===ovRid)?.name||'Custom':null;
  const ov=makeOv('cal-tap-ov');
  ov.innerHTML=`<div class="modal" style="max-height:380px"><div class="mh"></div>
    <div style="font-size:14px;font-weight:600;margin-bottom:5px">${fmtDate(ds+'T12:00:00')}</div>
    <div style="font-size:12px;color:${isRest?'var(--muted)':'var(--green)'};font-weight:600;margin-bottom:4px">${isRest?'Rest Day':'Training Day'}</div>
    ${ovLabel?`<div style="font-size:12px;color:var(--blue);font-weight:500;margin-bottom:12px">Override active: ${esc(ovLabel)}</div>`:'<div style="margin-bottom:12px"></div>'}
    <button class="btn bts bfw" style="margin-bottom:9px" onclick="closeOv('cal-tap-ov');showRoutineOverridePicker('${ds}')">Set the workout for this day</button>
    <button class="btn bts bfw" style="margin-bottom:9px" onclick="closeOv('cal-tap-ov');toggleDayOverride('${ds}')">${isRest?'Mark as Active':'Mark as Rest'}</button>
    ${ds<=today()?`<button class="btn btp bfw" style="margin-bottom:9px" onclick="closeOv('cal-tap-ov');showLogActivity('${ds}')">+ Log Activity</button>`:''}
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function showRoutineOverridePicker(ds){
  const ov=makeOv('rov-ov');
  const current=S.schedule.routineOverrides&&S.schedule.routineOverrides[ds];
  const hid=hiddenRoutineIds();const activeRoutines=(S.routines||[]).filter(r=>r.active!==false&&(!hid.has(r.id)||r.id===current));
  ov.innerHTML=`<div class="modal" style="max-height:75vh"><div class="mh"></div>
    <div class="mt">Routine for ${fmtDay(ds)}</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">Changes the workout for this date only. Your usual schedule stays as it is.</div>
    <button class="btn ${!current?'btp':'bts'} bfw" style="margin-bottom:8px" onclick="setRoutineOverride('${ds}',null)">Use Default Schedule</button>
    <button class="btn ${current==='rest'?'btd':'bts'} bfw" style="margin-bottom:8px" onclick="setRoutineOverride('${ds}','rest')">Rest Day</button>
    ${activeRoutines.map(r=>`<button class="btn ${current===r.id?'btp':'bts'} bfw" style="margin-bottom:8px" onclick="setRoutineOverride('${ds}',${jsq(r.id)})">${esc(r.name)}</button>`).join('')}
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function setRoutineOverride(ds,rid){
  if(!S.schedule.routineOverrides)S.schedule.routineOverrides={};
  if(rid===null)delete S.schedule.routineOverrides[ds];
  else S.schedule.routineOverrides[ds]=rid;
  save();
  document.getElementById('rov-ov')?.remove();
  renderHistory(document.getElementById('content'));
  if(ds===today())render();
  toast('Schedule updated','green');
}
function toggleDayOverride(ds){
  const isTrain=isTrainingDay(ds);
  S.schedule.overrides[ds]=isTrain?'rest':'active';
  save();renderHistory(document.getElementById('content'));
}
