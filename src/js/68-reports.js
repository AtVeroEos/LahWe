// ═══════════════════════════════════════════════════
// REPORTS — a month, or a year, in review
// ═══════════════════════════════════════════════════
// Worked out on the device from what was logged, like the Week in review. A month compares with
// the month before; a year with the year before. The period still running is labelled "so far".
// Home offers the month that just ended for its first week, and the year from mid-December into
// January, once each, until opened.
function repKey(kind,d){d=d||new Date();return kind==='year'?String(d.getFullYear()):`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function repRange(kind,key){
  if(kind==='year'){const y=parseInt(key);return{from:`${y}-01-01`,to:`${y}-12-31`,prev:String(y-1),next:String(y+1)};}
  const[y,m]=key.split('-').map(Number);
  const last=new Date(y,m,0).getDate();
  const pm=m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,'0')}`,nm=m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,'0')}`;
  return{from:`${key}-01`,to:`${key}-${String(last).padStart(2,'0')}`,prev:pm,next:nm};
}
function repLabel(kind,key){
  if(kind==='year')return key;
  return new Date(key+'-15T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
}
function repShort(kind,key){return kind==='year'?key:new Date(key+'-15T12:00:00').toLocaleDateString('en-US',{month:'long'});}
// Records beaten inside the period: sessions that bettered every earlier session of the lift.
// A lift's first session is not counted; there was nothing to beat.
function repRecords(from,to){
  const out=[];const ids=new Set();S.workouts.forEach(w=>w.exercises.forEach(e=>ids.add(e.exId)));
  ids.forEach(id=>{
    const kind=exKind(id);if(kind==='cardio')return;const info=getEx(id);if(info&&info.load==='assisted')return;
    const pts=getExKindData(id).pts;let best=null;
    pts.forEach(p=>{const ds=dayOf(p.date);
      if(best!=null&&p.v>best&&ds>=from&&ds<=to)out.push({exId:id,name:exName(id),kind,v:p.v,was:best,ds,w:p.w,r:p.r});
      if(best==null||p.v>best)best=p.v;});
  });
  return out;
}
// Estimated max, first session of the period against the last (or the last before it, if there was one).
function repLiftGains(from,to){
  const out=[];const ids=new Set();
  S.workouts.forEach(w=>{const ds=dayOf(w.started);if(ds>=from&&ds<=to)w.exercises.forEach(e=>ids.add(e.exId));});
  ids.forEach(id=>{
    if(exKind(id)!=='e1rm')return;
    const h=getExStrData(id);const inP=h.filter(p=>{const ds=dayOf(p.date);return ds>=from&&ds<=to;});if(!inP.length)return;
    const before=h.filter(p=>dayOf(p.date)<from);const ref=before.length?before[before.length-1]:inP[0];
    const last=inP[inP.length-1];if(ref===last||!(ref.e1rm>0))return;
    out.push({exId:id,name:exName(id),then:ref.e1rm,now:last.e1rm,gain:last.e1rm-ref.e1rm,pct:Math.round((last.e1rm-ref.e1rm)/ref.e1rm*100),n:inP.length});
  });
  return out.sort((a,b)=>b.pct-a.pct);
}
function periodReport(kind,key){
  return memo(`report:${kind}:${key}`,()=>{
    const r=repRange(kind,key);const td=today();
    const to=r.to<td?r.to:td;const live=r.to>=td;
    const days=Math.max(1,dayDiff(to,r.from)+1);
    const cur=rangeStats(r.from,to);
    // A period still running is compared with the same number of days of the one before.
    const pr=repRange(kind,r.prev);const prev=rangeStats(pr.from,live?(()=>{const e=addDays(pr.from,days-1);return e<pr.to?e:pr.to;})():pr.to);
    const inR=ds=>ds>=r.from&&ds<=to;
    const wks=S.workouts.filter(w=>inR(dayOf(w.started)));
    const acts=(S.activities||[]).filter(a=>inR(a.date));
    const active=new Set([...wks.map(w=>dayOf(w.started)),...acts.map(a=>a.date)]);
    // Weeks with at least one session, and the longest run of them (years only).
    const weekSet=new Set(wks.map(w=>weekStartOf(dayOf(w.started))));
    let streak=0,run=0;
    if(kind==='year'){for(let m=weekStartOf(r.from);m<=to;m=addDays(m,7)){if(weekSet.has(m)){run++;streak=Math.max(streak,run);}else if(m<weekStartOf(to))run=0;}}
    // Per week counts from the first day anything was logged, for someone who started mid-period.
    const first=repFirstDay();const weeks=Math.max(1,(dayDiff(to,first>r.from?first:r.from)+1)/7);
    // Sets a week per muscle, the most trained first.
    const end=dayDate(to).getTime()+86400000;const sbm=muscleSetsInRange(dayDate(r.from).getTime(),end);
    const avg={};Object.keys(sbm).forEach(m=>{avg[m]=Math.round(sbm[m]/weeks*10)/10;});
    const muscles=Object.keys(MEV_MAV).map(m=>({m,v:avg[m]||0})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
    // Most done: lifts by sessions, workouts by name, the weekday most trained.
    const exN={};wks.forEach(w=>{const seen=new Set();w.exercises.forEach(e=>{if(!seen.has(e.exId)&&e.sets.some(setCounts)){seen.add(e.exId);exN[e.exId]=(exN[e.exId]||0)+1;}});});
    const favs=Object.keys(exN).sort((a,b)=>exN[b]-exN[a]).slice(0,3).map(id=>({exId:id,name:exName(id),n:exN[id]}));
    const dow=[0,0,0,0,0,0,0];wks.forEach(w=>{dow[(dayDate(dayOf(w.started)).getDay()+6)%7]++;});
    const topDow=Math.max(...dow)>0?['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][dow.indexOf(Math.max(...dow))]:null;
    const bw=(S.bodyweightLog||[]).filter(b=>inR(b.date));
    const bwChange=bw.length>=2?{from:bw[bw.length-1].weight,to:bw[0].weight,d:r1(bw[0].weight-bw[bw.length-1].weight)}:null;
    const progs=(S.programs||[]).filter(p=>p.finishedAt&&inR(dayOf(p.finishedAt)));
    const photos=(S.photos||[]).filter(p=>inR(p.date));
    const feel=wks.map(w=>w.feel).filter(f=>f>=1&&f<=5);
    const mood=moodAvg(r.from,to);
    return{kind,key,label:repLabel(kind,key),live,from:r.from,to,prevKey:r.prev,nextKey:r.next,days,cur,prev,
      activeDays:active.size,weeksTrained:weekSet.size,streak,perWeek:Math.round(wks.length/weeks*10)/10,
      records:repRecords(r.from,to),lifts:repLiftGains(r.from,to),muscles,favs,topDow,bwChange,progs,photos,
      feel:feel.length?feel.reduce((a,b)=>a+b,0)/feel.length:null,mood,cardioMin:Math.round(acts.reduce((t,a)=>t+(parseFloat(a.dur)||0),0)),
      empty:!wks.length&&!acts.length};
  });
}
// The earliest month with anything logged, so the arrows stop there.
function repFirstDay(){
  return memo('repFirst',()=>{
    let first=today();
    S.workouts.forEach(w=>{const ds=dayOf(w.started);if(ds<first)first=ds;});
    (S.activities||[]).forEach(a=>{if(a.date&&a.date<first)first=a.date;});
    return first;
  });
}
function repFirstKey(kind){const f=repFirstDay();return kind==='year'?f.slice(0,4):f.slice(0,7);}

// ─── The sheet ───
let _rep=null;
function showReport(kind,key){
  kind=kind==='year'?'year':'month';
  _rep={kind,key:key||repKey(kind)};
  if(kind==='month'&&key&&S.reportSeen!==key){S.reportSeen=key;save();}
  if(kind==='year'&&key&&S.yearSeen!==key){S.yearSeen=key;save();}
  const ov=makeOv('rep-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div id="rep-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);renderReport();
  if(S.tab==='workout'&&!S.activeWorkout&&typeof render==='function')render(); // Home's card for it goes
}
function repGo(dir){
  if(!_rep)return;const r=repRange(_rep.kind,_rep.key);const k=dir<0?r.prev:r.next;
  if(dir>0&&k>repKey(_rep.kind))return;if(dir<0&&k<repFirstKey(_rep.kind))return;
  _rep.key=k;renderReport();
}
function repKind(kind){if(!_rep)return;_rep.kind=kind;_rep.key=kind==='year'?_rep.key.slice(0,4):(_rep.key.length===4?(_rep.key===repKey('year')?repKey('month'):`${_rep.key}-12`):_rep.key);renderReport();}
function renderReport(){
  const el=document.getElementById('rep-body');if(!el||!_rep)return;
  const R=periodReport(_rep.kind,_rep.key);const u=S.unit;
  const canPrev=R.prevKey>=repFirstKey(_rep.kind),canNext=R.nextKey<=repKey(_rep.kind);
  const pl=repShort(_rep.kind,R.prevKey);
  const dl=(c,p)=>{const x=fmtDelta(c,p);return x?`<span class="dl dl-${x.dir==='flat'?'flat':x.dir==='up'?'good':'warn'}">${x.txt}</span>`:'';};
  const stat=(v,l,d)=>`<div class="st"><div class="st-v">${v}</div><div class="st-l">${l}</div>${d||''}</div>`;
  const head=`<div class="rep-nav"><button class="icon-btn" onclick="repGo(-1)" aria-label="Earlier"${canPrev?'':' disabled'}><span class="flip">${ICON('chev',17)}</span></button>
      <div class="rep-t"><div class="mt" style="margin:0">${esc(R.label)}</div><div class="sheet-sub" style="margin:0">${R.live?'So far':'In review'}${R.empty||!R.prev.sessions?'':` · against ${R.live?'the same days of ':''}${esc(pl)}`}</div></div>
      <button class="icon-btn" onclick="repGo(1)" aria-label="Later"${canNext?'':' disabled'}>${ICON('chev',17)}</button></div>
    <div class="seg seg-in" role="tablist"><button class="seg-b${_rep.kind==='month'?' on':''}" onclick="repKind('month')">Month</button><button class="seg-b${_rep.kind==='year'?' on':''}" onclick="repKind('year')">Year</button></div>`;
  if(R.empty){el.innerHTML=head+`<div class="ch-empty">Nothing was logged in ${esc(R.label)}.</div>`;return;}
  const recs=R.records;const recBy={};recs.forEach(x=>{(recBy[x.exId]=recBy[x.exId]||[]).push(x);});
  const recRows=Object.values(recBy).map(a=>a[a.length-1]).sort((a,b)=>b.ds<a.ds?-1:1).slice(0,6);
  const up=R.lifts.filter(l=>l.pct>0).slice(0,5);
  const big=R.cur.vol>0?(R.kind==='year'?repVolumeFact(R.cur.vol):''):'';
  el.innerHTML=head+`
    <div class="st-grid">
      ${stat(R.cur.sessions,'Sessions',dl(R.cur.sessions,R.prev.sessions))}
      ${stat(R.activeDays,`Active day${R.activeDays===1?'':'s'}`,'')}
      ${stat(fmt1(R.perWeek),'Sessions a week','')}
      ${stat(R.cur.sets.toLocaleString(),'Working sets',dl(R.cur.sets,R.prev.sets))}
      ${stat(fmtK(R.cur.vol),`Volume, ${u}`,dl(R.cur.vol,R.prev.vol))}
      ${stat(R.cur.mins?fmtDur(R.cur.mins*60000):'0m','Lifting time',dl(R.cur.mins,R.prev.mins))}
    </div>
    ${big?`<div class="rep-fact">${esc(big)}</div>`:''}
    ${R.kind==='year'&&R.streak>1?`<div class="rep-fact">${R.weeksTrained} weeks with a session; the longest run was ${R.streak} weeks in a row.</div>`:''}
    ${recs.length?`<div class="sec-h sec-h-act"><span>Records beaten</span><span class="sec-note">${recs.length} in all</span></div><div class="list">${recRows.map(x=>`<button class="row row-tap" onclick="showExDetail(${jsq(x.exId)})"><span class="row-main"><span class="row-t">${esc(x.name)}</span><span class="row-s">${esc(fmtDay(x.ds))}${x.kind==='e1rm'&&x.w?` · ${fmt1(x.w)} × ${x.r}`:''} · was ${esc(fmtKind(x.kind,x.was))}</span></span><span class="aim"><span class="aim-v">${esc(fmtKind(x.kind,x.v))}</span></span></button>`).join('')}</div>`:''}
    ${up.length?`<div class="sec-h">Strongest gains</div><div class="list">${up.map(l=>`<button class="row row-tap" onclick="showExDetail(${jsq(l.exId)})"><span class="row-main"><span class="row-t">${esc(l.name)}</span><span class="row-s">Estimated max ${Math.round(l.then)} → ${Math.round(l.now)} ${u}</span></span><span class="dl dl-good">+${l.pct}%</span></button>`).join('')}</div>`:''}
    ${R.muscles.length?`<div class="sec-h sec-h-act"><span>Sets per muscle</span><span class="sec-note">average a week</span></div>${renderBodyMap(Object.fromEntries(R.muscles.map(x=>[x.m,x.v])),{small:true})}
      <div class="mus-grid">${R.muscles.slice(0,9).map(x=>{const s=bmStatus({[x.m]:x.v},x.m);return`<button class="mus-c mus-${s}" onclick="showMuscleDetail(${jsq(x.m)})"><span>${esc(MEV_MAV[x.m].lbl)}</span><b>${fmtSets(x.v)}</b><i>${MEV_MAV[x.m].mev}–${MEV_MAV[x.m].mav}</i></button>`;}).join('')}</div>`:''}
    <div class="sec-h">The rest of it</div><div class="list">${[
      R.favs.length?['Most done',R.favs.map(f=>`${f.name} (${f.n})`).join(', ')]:null,
      R.topDow&&R.cur.sessions>=4?['Favourite day',R.topDow]:null,
      R.cur.acts?['Cardio',`${R.cur.acts} session${R.cur.acts===1?'':'s'}${R.cur.miles?` · ${fmt1(R.cur.miles)} mi`:''}${R.cardioMin?` · ${fmtDur(R.cardioMin*60000)}`:''}`]:null,
      R.bwChange?['Body weight',`${fmt1(R.bwChange.from)} → ${fmt1(R.bwChange.to)} ${u} (${fmtSigned(R.bwChange.d,1)})`]:null,
      R.cur.foodDays?['Food',`${R.cur.foodDays} day${R.cur.foodDays===1?'':'s'} logged${R.cur.protein!=null?` · ${R.cur.protein} g protein a day`:''}${R.cur.cals!=null?` · ${R.cur.cals.toLocaleString()} kcal`:''}`]:null,
      R.feel!=null?['How sessions felt',`${fmtMood(R.feel)} of 5 on average`]:null,
      R.mood?['Mood',`${fmtMood(R.mood.avg)} of 5 over ${R.mood.n} day${R.mood.n===1?'':'s'}`]:null,
      R.progs.length?['Programs finished',R.progs.map(p=>p.name).join(', ')]:null,
      R.photos.length?['Progress photos',`${R.photos.length} taken`]:null,
    ].filter(Boolean).map(([t,s])=>`<div class="row"><span class="row-main"><span class="row-t">${esc(t)}</span><span class="row-s">${esc(s)}</span></span></div>`).join('')}</div>
    <div class="fine">Worked out on this device from what you logged. Records count only sessions that beat an earlier best of the same lift.</div>`;
}
// A sense of scale for a year of volume.
function repVolumeFact(vol){
  const kg=S.unit==='kg'?vol:vol*0.4536;
  const things=[[150000,'blue whale','blue whales'],[6000,'African elephant','African elephants'],[1500,'car','cars']];
  const t=things.find(x=>kg/x[0]>=2)||things[things.length-1];const n=kg/t[0];
  return`${fmtK(vol)} ${S.unit} lifted in all: about ${n>=10?Math.round(n):fmt1(n)} ${n>=1.5?t[2]:t[1]}.`;
}
// Home: the month that just ended (first week of the next), or the year (Dec 15 to Jan 15), once.
function reportDue(){
  if(!S.workouts.length)return null;
  const d=new Date();const day=d.getDate(),mo=d.getMonth();
  if((mo===11&&day>=15)||(mo===0&&day<=15)){
    const y=mo===11?String(d.getFullYear()):String(d.getFullYear()-1);
    if(S.yearSeen!==y&&!periodReport('year',y).empty)return{kind:'year',key:y,label:`Your ${y} in review`};
  }
  if(day<=7){
    const pm=new Date(d.getFullYear(),mo-1,15);const k=repKey('month',pm);
    if(S.reportSeen!==k&&k>=repFirstKey('month')&&!periodReport('month',k).empty)return{kind:'month',key:k,label:`${repShort('month',k)} in review`};
  }
  return null;
}
