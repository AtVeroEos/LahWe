// ═══════════════════════════════════════════════════
// TIMED SETS — holds, cardio and intervals, in every view
// ═══════════════════════════════════════════════════
// A set measured in time can be done two ways, and what you do is the choice (no setting):
//  - tick it, or swipe it right: logged as planned
//  - ▶ Start: the clock does it
// Holds count 3-2-1, count down and log themselves at zero; Stop before that logs what you held, as a
// miss. Cardio counts up, rings at the planned time and keeps going until Stop, which logs the real
// time (a run rarely ends exactly at 15:00). Interval Run alternates hard and easy (1:00 / 2:00 unless
// changed), with a cue at every change, and logs itself when the planned time is up.
// The clock lives on the workout (wk._tm) and runs from timestamps, so a reload, another tab or a locked
// phone does not lose it. A locked iPhone cannot play a cue; the time is still right when you look.
// One clock at a time: a second Start says so instead of replacing the first.
const TM_LEAD_MS=3000;
const TM_IV_DEF={w:60,r:120};
const TM_MAX_MI=300; // the same ceiling as an activity typed in by hand
let _tmInt=null;
let _sessShown=false; // the workout is what is on screen: set as it is drawn, cleared by render() for any other page
function tmKind(ex){return ex&&ex.cardio?(ex.exId==='interval-run'?'iv':'up'):'hold';}
function tmTimedEx(ex){return !!(ex&&(ex.timed||ex.cardio));}
// Seconds planned for this set: what is on it, else the target (the top of a range).
function tmPlan(ex,s){return parseInt(s&&s.r)||parseInt(ex&&ex.target&&(ex.target.rMax||ex.target.r))||0;}
// ▶ is offered on a timed set still to do. A hold or an interval needs a planned time; cardio can run open.
function tmCanStart(ex,s){
  if(!tmTimedEx(ex)||!s||s.done||s.skip)return false;
  return tmKind(ex)==='up'||tmPlan(ex,s)>0;
}
function tmOn(ei,si){const t=S.activeWorkout&&S.activeWorkout._tm;return !!t&&t.ei===ei&&(si==null||t.si===si);}
function tmIvCfg(ex){const v=isObj(ex&&ex.iv)?ex.iv:{};return{w:Math.min(900,Math.max(5,parseInt(v.w)||TM_IV_DEF.w)),r:Math.min(900,Math.max(5,parseInt(v.r)||TM_IV_DEF.r))};}
// Where the clock stands now. el is seconds since the start (negative during the 3-2-1).
function tmState(t,now){
  const el=((now||Date.now())-t.go)/1000;const e=Math.max(0,el);
  const o={el,lead:el<0,leadN:el<0?Math.ceil(-el):0};
  if(t.k==='hold'){o.rem=Math.max(0,t.total-e);o.frac=t.total>0?Math.min(1,e/t.total):0;o.end=el>=t.total;}
  else if(t.k==='up'){o.frac=t.total>0?Math.min(1,e/t.total):0;o.over=t.total>0&&el>=t.total;}
  else{
    const cyc=t.w+t.r;const inC=e%cyc;
    o.hard=inC<t.w;o.round=Math.floor(e/cyc)+1;o.rounds=t.total>0?Math.max(1,Math.ceil(t.total/cyc)):0;
    o.phRem=o.hard?t.w-inC:cyc-inC;o.frac=t.total>0?Math.min(1,e/t.total):0;o.end=t.total>0&&el>=t.total;
  }
  return o;
}
// What the clock says: a label, the big number, and the line under it.
function tmTexts(t,st){
  if(st.lead)return{k:'Get set',t:String(st.leadN),of:t.k==='iv'?`${fmtSecs(t.w)} hard · ${fmtSecs(t.r)} easy`:t.total?`of ${fmtMS(t.total)}`:'Open time'};
  if(t.k==='hold')return{k:'Hold',t:fmtMS(Math.ceil(st.rem)),of:`of ${fmtMS(t.total)}`};
  if(t.k==='up')return{k:st.over?'Past your time':'Going',t:fmtMS(Math.floor(st.el)),of:t.total?(st.over?`target ${fmtMS(t.total)} · Stop when you are done`:`of ${fmtMS(t.total)}`):'Open time · Stop when you are done'};
  return{k:`${st.hard?'Hard':'Easy'} · round ${st.round}${st.rounds?` of ${st.rounds}`:''}`,t:fmtMS(Math.ceil(st.phRem)),of:`${fmtMS(Math.floor(st.el))}${t.total?` of ${fmtMS(t.total)}`:''}`};
}
// The running clock. 'list' sits inside the open lift; 'card' fills a swipe card. One clock at a time,
// so the ids are shared.
function tmHTML(variant){
  const t=S.activeWorkout&&S.activeWorkout._tm;if(!t)return'';
  const st=tmState(t);const x=tmTexts(t,st);
  const hardCls=t.k==='iv'&&!st.lead?(st.hard?' tm-hard':' tm-easy'):'';
  return`<div class="tm tm-${variant}${hardCls}${st.over?' tm-over':''}" id="tm-box" role="timer" aria-live="off">
    <div class="tm-k" id="tm-k">${esc(x.k)}</div><div class="tm-t mono" id="tm-t">${esc(x.t)}</div><div class="tm-of" id="tm-of">${esc(x.of)}</div>
    <div class="tm-bar"><i id="tm-bar" style="width:${Math.round((st.frac||0)*100)}%"></i></div>
    <div class="tm-acts"><button class="btn bts" onclick="tmCancel()">Cancel</button><button class="btn btp" onclick="tmFinish('stop')">Stop · log it</button></div>
  </div>`;
}
function tmStart(ei,si){
  const wk=S.activeWorkout;const ex=wk&&wk.exercises[ei];const s=ex&&ex.sets[si];
  if(!s||!tmCanStart(ex,s))return;
  if(wk._tm){toast('A timer is already running. Stop it first.');return;}
  getAudioCtx(); // unlock sound inside the tap
  if(S.restTimer)skipRest(); // starting the set ends the rest
  const k=tmKind(ex);
  const t={ei,si,exId:ex.exId,k,go:Date.now()+TM_LEAD_MS,total:tmPlan(ex,s),cue:'lead3'};
  if(k==='iv'){const c=tmIvCfg(ex);t.w=c.w;t.r=c.r;}
  wk._tm=t;if(wk._swipe)_sw.ask=null;
  playCue('tick');saveLive();
  tmRedraw();tmLoop();
}
function tmLoop(){if(_tmInt)return;_tmInt=setInterval(tmTick,200);tmTick();}
function tmHalt(){if(_tmInt){clearInterval(_tmInt);_tmInt=null;}}
// Redraw whichever workout view is showing; on another tab the thin bar shows the clock instead.
function tmRedraw(){
  if(S.activeWorkout&&_sessShown)renderSession(document.getElementById('content')); // the workout (list or card) is what is on screen
  try{liveBarSync();}catch(e){}
}
function tmTick(){
  const wk=S.activeWorkout;const t=wk&&wk._tm;
  if(!t){tmHalt();return;}
  const ex=wk.exercises[t.ei];const s=ex&&ex.sets[t.si];
  if(!ex||ex.exId!==t.exId||!s||s.done){delete wk._tm;tmHalt();saveLive();tmRedraw();return;} // the set was moved, removed or logged another way
  const st=tmState(t);
  if(st.end&&(t.k==='hold'||t.k==='iv')){tmFinish('auto');return;}
  // A cue when the state changes: 3-2-1, go, the last three seconds of a hold, the target time, each interval.
  let key,snd;
  if(st.lead){key='lead'+st.leadN;snd='tick';}
  else if(t.k==='hold'){if(st.rem<=3){key='end'+Math.ceil(st.rem);snd='tick';}else{key='go';snd='sprint';}}
  else if(t.k==='up'){key=st.over?'target':'go';snd=st.over?'hold':'sprint';}
  else{key='p'+st.round+(st.hard?'h':'e');snd=st.hard?'sprint':'walk';}
  if(key!==t.cue){
    t.cue=key;playCue(snd);saveLive();
    try{if(navigator.vibrate)navigator.vibrate(snd==='tick'?15:snd==='walk'?[300]:[150,80,150]);}catch(e){}
    if(key==='target'&&_sessShown)toast(`${fmtMS(t.total)} done. Keep going, or Stop.`,'green');
  }
  tmPaint(t,st);
}
function tmPaint(t,st){
  const box=document.getElementById('tm-box');if(!box)return;
  const x=tmTexts(t,st);const g=id=>document.getElementById(id);
  if(g('tm-k'))g('tm-k').textContent=x.k;
  if(g('tm-t'))g('tm-t').textContent=x.t;
  if(g('tm-of'))g('tm-of').textContent=x.of;
  if(g('tm-bar'))g('tm-bar').style.width=Math.round((st.frac||0)*100)+'%';
  box.classList.toggle('tm-over',!!st.over);
  box.classList.toggle('tm-hard',t.k==='iv'&&!st.lead&&!!st.hard);
  box.classList.toggle('tm-easy',t.k==='iv'&&!st.lead&&!st.hard);
}
// The clock ends: by itself (a hold or the intervals reaching their time) or by Stop.
function tmFinish(how){
  const wk=S.activeWorkout;const t=wk&&wk._tm;if(!t)return;
  const ex=wk.exercises[t.ei];const s=ex&&ex.sets[t.si];
  delete wk._tm;tmHalt();
  if(!ex||!s||ex.exId!==t.exId||s.done){saveLive();tmRedraw();return;}
  const el=Math.round((Date.now()-t.go)/1000);
  if(how==='stop'&&el<=0){saveLive();tmRedraw();toast('Not started yet, nothing logged');return;}
  let secs=el,fail=false;
  if(t.k==='hold'){secs=how==='auto'?t.total:Math.min(el,t.total*3);fail=secs<t.total;}
  else if(t.k==='iv'&&how==='auto')secs=t.total;
  secs=Math.max(1,Math.min(secs,SANE.secs*24)); // an activity can be up to a day
  if(how==='auto')playCue('hold');
  s.r=String(secs);s.clock=true;
  tmLogSet(t.ei,t.si,fail);
  if(how==='stop'){
    if(t.k==='hold')toast(fail?`${fmtSecs(secs)} of ${fmtSecs(t.total)}, logged as missed`:`${fmtSecs(secs)} logged`,fail?'':'green');
    else toast(`${fmtMS(secs)} logged`,'green');
  }
}
function tmCancel(){
  const wk=S.activeWorkout;if(!wk||!wk._tm)return;
  delete wk._tm;tmHalt();saveLive();tmRedraw();
}
// Log a set the clock (or a check-off) finished, in whichever view is showing. In a swipe view it goes
// on the undo list like a swipe does, and the card moves on.
function tmLogSet(ei,si,fail){
  const wk=S.activeWorkout;const ex=wk&&wk.exercises[ei];const s=ex&&ex.sets[si];if(!s)return;
  if(wk._swipe){swipePushUndo(wk,ei,si);_sw.ask=null;_sw.flip=true;}
  if(fail)s.fail=true;else delete s.fail;
  togSet(ei,si,true,true);
  if(s.done&&ex.cardio)setTimeout(()=>cardioDistAsk(ei,si),wk._swipe?260:0);
  tmRedraw();
}
// ─── Distance, after a run or a walk ───
// The list view has a distance box on the row. The swipe views ask once the set is logged, with last
// time's distance filled in (a treadmill shows it on the console). Skipping is fine: time alone is a run.
function cardioDistCapable(exId){
  const info=getEx(exId);const t=info&&ACT_TYPES.find(a=>a.id===info.act);
  return !!(t&&(t.fields||[]).includes('dist'));
}
function cardioDistAsk(ei,si){
  const wk=S.activeWorkout;const ex=wk&&wk.exercises[ei];const s=ex&&ex.sets[si];
  if(!s||!s.done||!ex.cardio||!wk._swipe||!cardioDistCapable(ex.exId))return;
  if(document.getElementById('dist-ov'))return;
  const ov=makeOv('dist-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">${esc(exName(ex.exId))} · ${esc(fmtMS(parseInt(s.r)||0))}</div>
    <div class="sheet-sub">How far? Optional: the time is logged either way.</div>
    <div class="fg"><label class="fl" for="dist-in">Miles</label><input id="dist-in" type="number" inputmode="decimal" min="0" step="0.01" placeholder="–" value="${esc(s.d||'')}"></div>
    <button class="btn btp bfw" onclick="cardioDistSave(${ei},${si})">Save distance</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="cardioDistSkip(${ei},${si})">No distance</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function cardioDistSave(ei,si){
  const s=S.activeWorkout&&S.activeWorkout.exercises[ei]&&S.activeWorkout.exercises[ei].sets[si];
  const v=parseFloat(document.getElementById('dist-in')&&document.getElementById('dist-in').value);
  closeOv('dist-ov');if(!s)return;
  if(v>TM_MAX_MI){toast('That is further than one session can be. Not saved.');return;}
  if(v>0)s.d=String(Math.round(v*100)/100);else delete s.d;
  saveLive();if(v>0)toast(`${fmt1(v)} mi`,'green');
}
function cardioDistSkip(ei,si){
  const s=S.activeWorkout&&S.activeWorkout.exercises[ei]&&S.activeWorkout.exercises[ei].sets[si];
  closeOv('dist-ov');if(s){delete s.d;saveLive();}
}
// ─── Interval Run: how long the hard and easy parts are ───
function showIvCfg(ei){
  const ex=S.activeWorkout&&S.activeWorkout.exercises[ei];if(!ex)return;
  const c=tmIvCfg(ex);const ov=makeOv('iv-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Intervals</div>
    <div class="sheet-sub">Hard, then easy, over and over until the planned time is up. A cue sounds at every change.</div>
    <div class="frow" style="gap:10px;margin-bottom:14px">
      <div style="flex:1"><label class="fl" for="iv-w">Hard (sec)</label><input id="iv-w" type="number" inputmode="numeric" min="5" max="900" value="${c.w}"></div>
      <div style="flex:1"><label class="fl" for="iv-r">Easy (sec)</label><input id="iv-r" type="number" inputmode="numeric" min="5" max="900" value="${c.r}"></div>
    </div>
    <button class="btn btp bfw" onclick="saveIvCfg(${ei})">Save</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function saveIvCfg(ei){
  const wk=S.activeWorkout;const ex=wk&&wk.exercises[ei];if(!ex)return;
  const w=parseInt(document.getElementById('iv-w')&&document.getElementById('iv-w').value);
  const r=parseInt(document.getElementById('iv-r')&&document.getElementById('iv-r').value);
  ex.iv=tmIvCfg({iv:{w,r}});
  // Remembered with the workout, like the rest time.
  const rt=wk.routineId?S.routines.find(x=>x.id===wk.routineId):null;
  if(rt)rt.exercises.forEach(e=>{if(e.exId===ex.exId)e.iv=Object.assign({},ex.iv);});
  closeOv('iv-ov');save();renderSession(document.getElementById('content'));
}
function fmtIv(ex){const c=tmIvCfg(ex);return`${fmtSecs(c.w)} hard · ${fmtSecs(c.r)} easy`;}
