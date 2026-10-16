// ═══════════════════════════════════════════════════
// PAUSE — sick, travel, field duty: days when nothing is expected
// ═══════════════════════════════════════════════════
// A pause is a run of days (S.pauses: {id, from, to, why}; to null = until you end it). On a paused
// day nothing is due and nothing is missed:
//  - habits are not scheduled, so streaks hold and the day is not counted either way (58-habits.js);
//  - it is not a training day, so the training streak holds and nothing shows as missed (33-schedule.js);
//  - food days are left out of "on target" counts and the logging streak (37, 51, 55, 59);
//  - Patterns leaves those days out, so a week in the field does not read as a cause (39-patterns.js).
// Anything you do log on a paused day is still logged and still counts as done.
const PAUSE_WHY=[
  {id:'sick',label:'Sick or hurt',icon:'bandage'},
  {id:'travel',label:'Travel',icon:'briefcase'},
  {id:'field',label:'Field duty / AT',icon:'flag'},
  {id:'other',label:'Other',icon:'moon'},
];
const PAUSE_MAX_DAYS=60; // an open pause stops counting after this, so a forgotten one does not hide months

function pauseEnd(p){
  const cap=addDays(p.from,PAUSE_MAX_DAYS-1);
  const end=p.to||today();
  return end<cap?end:cap;
}
function pauseOn(ds){
  const ps=(typeof S!=='undefined'&&S&&S.pauses)||[];
  for(let i=0;i<ps.length;i++){const p=ps[i];if(ds>=p.from&&ds<=pauseEnd(p))return p;}
  return null;
}
function isPaused(ds){return !!pauseOn(ds);}
// The pause running today, or the next one booked, for the Settings row and Home.
function pauseNow(){return pauseOn(today());}
function pauseNext(){const td=today();return(S.pauses||[]).find(p=>p.from>td)||null;}
function pauseWhy(p){return PAUSE_WHY.find(w=>w.id===(p&&p.why))||PAUSE_WHY[3];}
function pauseRangeText(p){
  if(!p)return'';
  const td=today();
  if(!p.to)return p.from>td?`from ${fmtDay(p.from)}`:p.from===td?'from today':`since ${fmtDay(p.from)}`;
  return p.from===p.to?fmtDay(p.from):`${fmtDay(p.from)} – ${fmtDay(p.to)}`;
}
function pauseSummary(){
  const p=pauseNow();if(p)return`${pauseWhy(p).label} · ${pauseRangeText(p)}`;
  const n=pauseNext();return n?`Booked: ${pauseWhy(n).label} · ${pauseRangeText(n)}`:'Off';
}
// A signature of the pauses, for the caches that depend on which days are paused (Patterns, memo).
function pauseSig(){return(S.pauses||[]).map(p=>p.from+(p.to||'~'+today())).join(',');}

// ─── Changing them ───
function pauseAdd(why,from,to){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from||''))return{error:'Pick the first day'};
  if(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to))to=null;
  if(to&&to<from)return{error:'The last day is before the first'};
  const clash=(S.pauses||[]).find(p=>!(((to||'9999')<p.from)||(from>(p.to||'9999'))));
  if(clash)return{error:`That overlaps the ${pauseWhy(clash).label.toLowerCase()} pause (${pauseRangeText(clash)})`};
  const p={id:uid(),from,to:to||null,why:PAUSE_WHY.some(w=>w.id===why)?why:'other'};
  S.pauses.push(p);S.pauses.sort((a,b)=>a.from<b.from?-1:1);
  bumpMemo();save();
  return{ok:true,p};
}
// Ending a pause today keeps today paused (you are still off today); it simply stops tomorrow.
function pauseEndNow(id){
  const p=(S.pauses||[]).find(x=>x.id===id);if(!p)return;
  const td=today();
  if(p.from>td){pauseRemove(id);return;}
  p.to=td;bumpMemo();save();
}
function pauseRemove(id){S.pauses=(S.pauses||[]).filter(p=>p.id!==id);bumpMemo();save();}

// ─── The sheet ───
let _pz={why:'sick',from:'',to:'',open:true,err:''};
function showPause(){
  _pz={why:'sick',from:today(),to:'',open:true,err:''};
  const ov=makeOv('pause-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:2px">Pause</div><div id="pause-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderPause();
}
function renderPause(){
  const el=document.getElementById('pause-body');if(!el)return;
  const now=pauseNow();const td=today();
  const list=(S.pauses||[]).slice().reverse().slice(0,8);
  let h=`<div class="sheet-sub">Days when nothing is expected. Habit and training streaks hold, missed days are not counted, and Patterns leaves these days out. Anything you log still counts.</div>`;
  if(now){
    h+=`<div class="note-box pz-now" style="margin:0 0 14px"><b>${esc(pauseWhy(now).label)}</b> · ${esc(pauseRangeText(now))}${now.to?'':`<br><small>Ends by itself after ${PAUSE_MAX_DAYS} days if you forget.</small>`}
      <div class="frow" style="margin-top:10px"><button class="btn btp bsm" onclick="pauseEndTap(${jsq(now.id)})">${now.to&&now.to<=td?'Ends today':'End it today'}</button></div></div>`;
  }
  h+=`<div class="sec-h">${now?'Book another':'Start one'}</div>
    <div class="pz-why" role="radiogroup" aria-label="Why">${PAUSE_WHY.map(w=>`<button class="chip${_pz.why===w.id?' on':''}" role="radio" aria-checked="${_pz.why===w.id}" onclick="pzSet('why','${w.id}')">${ICON(w.icon,14)} ${esc(w.label)}</button>`).join('')}</div>
    <div class="frow" style="gap:10px;margin:12px 0 4px">
      <div style="flex:1"><label class="fl">First day</label><input type="date" id="pz-from" value="${esc(_pz.from)}" onchange="pzSet('from',this.value)"></div>
      <div style="flex:1"><label class="fl">Last day</label>${_pz.open?`<button class="btn bts bfw pz-open" onclick="pzSet('open',false)">Until I end it</button>`:`<input type="date" id="pz-to" value="${esc(_pz.to)}" min="${esc(_pz.from)}" onchange="pzSet('to',this.value)">`}</div>
    </div>
    ${_pz.open?'':`<button class="sw-link" style="margin:2px 0 6px" onclick="pzSet('open',true)">No end date</button>`}
    ${_pz.err?`<div class="fine" style="color:var(--red)">${esc(_pz.err)}</div>`:''}
    <button class="btn btp bfw" style="margin-top:8px" onclick="pzSave()">${_pz.from>td?'Book the pause':'Pause'}</button>`;
  if(list.length){
    h+=`<div class="sec-h">Pauses</div><div class="list">${list.map(p=>{const live=p===now;const fut=p.from>td;
      return`<div class="row"><span class="row-ic">${ICON(pauseWhy(p).icon,16)}</span><span class="row-main"><span class="row-t">${esc(pauseWhy(p).label)}</span><span class="row-s">${esc(pauseRangeText(p))}${live?' · now':fut?' · booked':''}</span></span><button class="btn btg bxs" onclick="pauseRemoveTap(${jsq(p.id)})" aria-label="Remove this pause">Remove</button></div>`;}).join('')}</div>`;
  }
  el.innerHTML=h;
}
function pzSet(k,v){
  if(k==='why'&&PAUSE_WHY.some(w=>w.id===v))_pz.why=v;
  if(k==='from')_pz.from=v;
  if(k==='to')_pz.to=v;
  if(k==='open'){_pz.open=!!v;if(!v&&!_pz.to)_pz.to=addDays(_pz.from||today(),6);}
  _pz.err='';renderPause();
}
function pzSave(){
  const r=pauseAdd(_pz.why,_pz.from,_pz.open?null:_pz.to);
  if(r.error){_pz.err=r.error;renderPause();return;}
  toast(r.p.from>today()?'Pause booked':'Paused','green');
  pauseChanged();
}
function pauseEndTap(id){pauseEndNow(id);toast('The pause ends today','green');pauseChanged();}
function pauseRemoveTap(id){
  const p=(S.pauses||[]).find(x=>x.id===id);if(!p)return;
  const copy=Object.assign({},p);pauseRemove(id);pauseChanged();
  toast('Pause removed','',{action:'Undo',onAction:()=>{S.pauses.push(copy);S.pauses.sort((a,b)=>a.from<b.from?-1:1);bumpMemo();save();pauseChanged();}});
}
function pauseChanged(){
  renderPause();
  if(typeof refreshSettings==='function')refreshSettings();
  render(); // the page behind (Home's banner, streaks); the sheets on top stay as they are
}
// Home: one quiet line while a pause runs, so it is never forgotten.
function pauseBannerHTML(){
  const p=pauseNow();if(!p)return'';
  return`<button class="pz-banner" onclick="showPause()">${ICON(pauseWhy(p).icon,15)}<span><b>Paused</b> · ${esc(pauseWhy(p).label)} · ${esc(pauseRangeText(p))}</span>${ICON('chev',14)}</button>`;
}
