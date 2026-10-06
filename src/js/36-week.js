// ═══════════════════════════════════════════════════
// WEEK — the numbers behind the home screen and the weekly check-in
// ═══════════════════════════════════════════════════
// Everything here is worked out on the device from what you logged. No AI, no network.
// Two windows are used and always labelled: the calendar week (Monday to Sunday) for "did I do
// what I planned", and the last 7 days against the 7 before for trends, so a Tuesday is not
// compared with a full week. Trends leave today out until it is over.

function mondayOf(ds){const d=dayDate(ds);return addDays(ds,-((d.getDay()+6)%7));}
// Monday → Sunday of the current week, each with what was planned and what happened.
function weekDays(){
  const td=today();const mon=mondayOf(td);
  const lifted=new Set(S.workouts.map(w=>dayOf(w.started)));
  const moved=new Set(S.activities.map(a=>a.date));
  const fixed=hasFixedSchedule();
  return[0,1,2,3,4,5,6].map(i=>{
    const ds=addDays(mon,i);const planned=fixed&&isTrainingDay(ds);
    let state;
    if(lifted.has(ds))state='done';
    else if(moved.has(ds))state='active';
    else if(ds<td)state=planned?'missed':'off';
    else if(ds===td)state=planned?'due':'off';
    else state=planned?'planned':'off';
    return{ds,letter:'MTWTFSS'[i],today:ds===td,planned,state};
  });
}
// Totals for a run of whole days, both ends included.
function rangeStats(fromDs,toDs){
  const inR=ds=>ds>=fromDs&&ds<=toDs;
  const wks=S.workouts.filter(w=>inR(dayOf(w.started)));
  const acts=S.activities.filter(a=>inR(a.date));
  let foodDays=0,p=0,k=0;
  for(let ds=fromDs;ds<=toDs;ds=addDays(ds,1)){
    const t=getDayTotals(ds);
    if(t.cals>0||t.protein>0){foodDays++;p+=t.protein;k+=t.cals;}
  }
  const bw=(S.bodyweightLog||[]).filter(e=>inR(e.date));
  return{
    sessions:wks.length,
    sets:wks.reduce((t,w)=>t+doneSetCnt(w),0),
    vol:wks.reduce((t,w)=>t+totalVol(w),0),
    mins:Math.round(wks.reduce((t,w)=>t+workoutActiveMs(w),0)/60000),
    kcal:wks.reduce((t,w)=>t+(w.cals||0),0)+acts.reduce((t,a)=>t+(a.cals||0),0),
    acts:acts.length,miles:r1(acts.reduce((t,a)=>t+(parseFloat(a.dist)||0),0)),
    foodDays,protein:foodDays?Math.round(p/foodDays):null,cals:foodDays?Math.round(k/foodDays):null,
    bw:bw.length?r1(bw.reduce((t,e)=>t+e.weight,0)/bw.length):null,
  };
}
// Change between two numbers as a short label. Null when there is nothing to compare against.
function fmtDelta(cur,prev){
  if(cur==null||prev==null||!(prev>0))return null;
  const pct=Math.round((cur-prev)/prev*100);
  if(Math.abs(pct)<1)return{txt:'no change',dir:'flat',pct:0};
  return{txt:(pct>0?'+':'−')+Math.abs(pct)+'%',dir:pct>0?'up':'down',pct};
}
function fmtK(v){v=Math.round(v||0);return v>=10000?(v/1000).toFixed(v>=100000?0:1)+'k':v.toLocaleString();}
// Sets per muscle over the last 7 days against the weekly minimum and maximum for your goal.
// Only muscles you train, or that your current program is meant to train, are listed.
function weekMuscles(){
  const end=dayDate(today()).setHours(0,0,0,0);const sets=muscleSetsInRange(end-7*86400000,end);
  const scale=goalVolScale();
  const g=getActiveGroup();const proj=g?groupProjection(g).proj:{};
  return Object.keys(MEV_MAV).map(m=>{
    const n=r1(sets[m]||0);const lo=Math.round(MEV_MAV[m].mev*scale),hi=Math.round(MEV_MAV[m].mav*scale);
    const inPlan=(proj[m]||0)>0;
    return{m,label:MEV_MAV[m].lbl,sets:n,lo,hi,inPlan,status:n>hi?'high':n<lo?'low':'ok'};
  }).filter(x=>x.sets>0||x.inPlan).sort((a,b)=>b.sets-a.sets);
}
// Lifts trained in the last 14 days: estimated 1RM now against about four weeks ago.
function weekLifts(){
  const cut=Date.now()-14*86400000;const ids=new Set();
  S.workouts.forEach(w=>{if(w.started>=cut)w.exercises.forEach(e=>ids.add(e.exId));});
  const out=[];
  ids.forEach(id=>{
    const h=getExStrData(id);if(h.length<2)return;
    const last=h[h.length-1];if(last.date<cut)return;
    const ref=h.slice().reverse().find(p=>last.date-p.date>=21*86400000)||h[0];
    if(ref===last||!(ref.e1rm>0))return;
    const pct=Math.round((last.e1rm-ref.e1rm)/ref.e1rm*100);
    out.push({exId:id,name:exName(id),now:last.e1rm,then:ref.e1rm,pct,w:last.w,r:last.r,weeks:Math.max(1,Math.round((last.date-ref.date)/(7*86400000)))});
  });
  return out.sort((a,b)=>b.pct-a.pct);
}
// Everything the weekly check-in shows, in one object (also what the tests check).
function weekReview(){
  const td=today();
  // Trends use finished days only (yesterday back): before you train today, a window that
  // included today would always look like a drop.
  const cur=rangeStats(daysAgoStr(7),daysAgoStr(1)),prev=rangeStats(daysAgoStr(14),daysAgoStr(8));
  const food=cur,foodPrev=prev;
  const days=weekDays();
  const planned=days.filter(d=>d.planned).length;
  const done=days.filter(d=>d.state==='done').length;
  const missed=days.filter(d=>d.state==='missed').length;
  const left=days.filter(d=>d.state==='due'||d.state==='planned').length;
  const muscles=weekMuscles();const lifts=weekLifts();const bw=bwRateInfo();
  const since=daysAgoStr(7);
  const prs=Object.keys(S.prs||{}).filter(id=>S.prs[id]&&S.prs[id].date&&S.prs[id].date>=since&&!S.prs[id].manual).map(id=>({exId:id,name:exName(id),w:S.prs[id].w,r:S.prs[id].r}));
  const g=avgGoals(daysAgoStr(7),daysAgoStr(1)); // each logged day against its own target (training or rest)
  const points=[];
  const add=(tone,icon,title,sub)=>points.push({tone,icon,title,sub});
  if(prs.length)add('good','trophy',`${prs.length} new record${prs.length===1?'':'s'}`,prs.slice(0,3).map(p=>`${p.name} ${fmt1(p.w)} × ${p.r}`).join(' · '));
  if(missed)add('warn','calendar',`${missed} planned session${missed===1?'':'s'} missed this week`,left?`${left} still to come. Move one to a free day in Progress → Schedule.`:'Move one to a free day in Progress → Schedule.');
  const low=muscles.filter(m=>m.status==='low'&&m.inPlan);
  if(low.length)add('warn','barchart',`Below the weekly minimum: ${low.slice(0,3).map(m=>m.label).join(', ')}`,low.slice(0,3).map(m=>`${m.label} ${fmtSets(m.sets)} of ${m.lo}+ sets`).join(' · '));
  const high=muscles.filter(m=>m.status==='high');
  if(high.length)add('warn','battery',`A lot of volume: ${high.slice(0,2).map(m=>m.label).join(', ')}`,high.slice(0,2).map(m=>`${m.label} ${fmtSets(m.sets)} sets, ceiling about ${m.hi}`).join(' · '));
  if(food.protein!=null&&g.protein>0){
    const pct=Math.round(food.protein/g.protein*100);
    if(pct<85)add('warn','meat',`Protein averaged ${food.protein} g of ${g.protein} g`,`${pct}% of target over ${food.foodDays} logged day${food.foodDays===1?'':'s'}.`);
    else add('good','meat',`Protein on target: ${food.protein} g a day`,`${pct}% of ${g.protein} g over ${food.foodDays} logged day${food.foodDays===1?'':'s'}.`);
  }
  const up=lifts.filter(l=>l.pct>=3).slice(0,2),down=lifts.filter(l=>l.pct<=-3).slice(-2);
  up.forEach(l=>add('good','trendup',`${l.name} up ${l.pct}%`,`Estimated max ${l.then} → ${l.now} ${S.unit} over ${l.weeks} week${l.weeks===1?'':'s'}.`));
  down.forEach(l=>add('warn','trenddown',`${l.name} down ${Math.abs(l.pct)}%`,`Estimated max ${l.then} → ${l.now} ${S.unit} over ${l.weeks} week${l.weeks===1?'':'s'}.`));
  getPainWarnings().slice(0,2).forEach(p=>add('bad','bandage',`Pain flagged on ${p.name}`,`In ${p.sessions} of the last 3 sessions. Swap it or go lighter.`));
  if(bw&&bw.rate!=null&&Math.abs(bw.rate)>=0.1){
    const dir=S.weightGoalDir;const want=dir==='lose'?bw.rate<0:dir==='gain'?bw.rate>0:null;
    add(want==null?'info':want?'good':'warn','scale',`Weight ${bw.rate<0?'down':'up'} ${Math.abs(bw.rate).toFixed(1)} ${S.unit} a week`,`7-day average ${bw.cur.toFixed(1)} ${S.unit}.`);
  }
  let headline;
  if(planned)headline=`${done} of ${planned} planned session${planned===1?'':'s'} done${left?`, ${left} to go`:missed?`, ${missed} missed`:''}`;
  else headline=cur.sessions?`${cur.sessions} session${cur.sessions===1?'':'s'} in the last 7 days`:'No sessions in the last 7 days';
  return{cur,prev,food,foodPrev,goal:g,days,planned,done,missed,left,muscles,lifts,prs,bw,points,headline};
}
// Four numbers for the home screen, chosen by goal. Each: {val,lbl,delta?,good?}
function homeStats(rv){
  const g=S.goal||'general';const mg=rv.goal||S.macroGoals||{};const td=today();
  const d=(c,p,upGood)=>{const x=fmtDelta(c,p);if(!x)return{};return{delta:x.txt,tone:x.dir==='flat'?'flat':(x.dir==='up')===(upGood!==false)?'good':'warn'};};
  const sets=Object.assign({val:rv.cur.sets,lbl:'Sets'},d(rv.cur.sets,rv.prev.sets));
  const vol=Object.assign({val:fmtK(rv.cur.vol),lbl:`Volume (${S.unit})`},d(rv.cur.vol,rv.prev.vol));
  const prot={val:rv.food.protein!=null?rv.food.protein+' g':'–',lbl:'Protein/day'};
  if(rv.food.protein!=null&&mg.protein>0){const pct=Math.round(rv.food.protein/mg.protein*100);prot.delta=pct+'% of goal';prot.tone=pct>=85?'good':'warn';}
  const kc={val:rv.food.cals!=null?rv.food.cals.toLocaleString():'–',lbl:'Calories/day'};
  if(rv.food.cals!=null&&mg.cals>0){const diff=rv.food.cals-mg.cals;kc.delta=(diff>=0?'+':'−')+Math.abs(diff).toLocaleString()+' to goal';kc.tone=Math.abs(diff)<=mg.cals*0.1?'good':'warn';}
  const curW=(rv.bw&&rv.bw.cur)||(S.bodyweightLog&&S.bodyweightLog[0]&&S.bodyweightLog[0].weight)||0;
  const wt={val:curW?curW.toFixed(1):'–',lbl:`Weight (${S.unit})`};
  if(rv.bw&&rv.bw.rate!=null){const r=rv.bw.rate;wt.delta=(r<0?'−':'+')+Math.abs(r).toFixed(1)+' a week';const dir=S.weightGoalDir;wt.tone=dir==='lose'?(r<0?'good':'warn'):dir==='gain'?(r>0?'good':'warn'):'flat';}
  if(g==='weightloss'){
    const eb=energyBalance(td);const steps=S.stepsLog[td]||0;
    return[{val:(eb.net<0?'−':'+')+fmtK(Math.abs(eb.net)),lbl:'Net kcal today',tone:eb.net<0?'good':'warn',delta:eb.net<0?'deficit':'surplus'},{val:steps?fmtK(steps):'0',lbl:'Steps today'},kc,wt];
  }
  if(g==='recomp')return[sets,prot,kc,wt];
  return[sets,vol,prot,wt];
}

// ─── Weekly check-in sheet ───
function showWeekReview(){
  const rv=weekReview();
  const ov=makeOv('week-ov');
  const dl=(c,p,upGood)=>{const x=fmtDelta(c,p);if(!x)return'';const tone=x.dir==='flat'?'flat':(x.dir==='up')===(upGood!==false)?'good':'warn';return`<span class="dl dl-${tone}">${x.txt}</span>`;};
  const stat=(v,l,d)=>`<div class="st"><div class="st-v">${v}</div><div class="st-l">${l}</div>${d||''}</div>`;
  const mus=rv.muscles.slice(0,10);const top=Math.max(1,...mus.map(m=>Math.max(m.sets,m.hi)));
  ov.innerHTML=`<div class="modal" style="max-height:93vh"><div class="mh"></div>
    <div class="mt" style="margin-bottom:4px">Weekly check-in</div>
    <div class="sheet-sub">${esc(rv.headline)}. Trends compare the last 7 full days with the 7 before; today counts from tomorrow.</div>
    ${weekDotsHTML(rv.days)}
    <div class="st-grid">
      ${stat(rv.cur.sessions,'Sessions',dl(rv.cur.sessions,rv.prev.sessions))}
      ${stat(rv.cur.sets,'Working sets',dl(rv.cur.sets,rv.prev.sets))}
      ${stat(fmtK(rv.cur.vol),`Volume, ${S.unit}`,dl(rv.cur.vol,rv.prev.vol))}
      ${stat(rv.cur.mins?fmtDur(rv.cur.mins*60000):'0m','Lifting time',dl(rv.cur.mins,rv.prev.mins))}
      ${stat(rv.food.protein!=null?rv.food.protein+' g':'–','Protein a day',dl(rv.food.protein,rv.foodPrev.protein))}
      ${stat(rv.food.cals!=null?rv.food.cals.toLocaleString():'–','Calories a day',dl(rv.food.cals,rv.foodPrev.cals,null))}
    </div>
    ${rv.points.length?`<div class="sec-h">What stands out</div><div class="list">${rv.points.map(pointRowHTML).join('')}</div>`:''}
    ${mus.length?`<div class="sec-h">Sets per muscle, last 7 full days</div><div class="mus">${mus.map(m=>`<div class="mus-r"><span class="mus-n">${esc(m.label)}</span>
      <span class="mus-t"><span class="mus-band" style="left:${Math.round(m.lo/top*100)}%;width:${Math.max(2,Math.round((m.hi-m.lo)/top*100))}%"></span><span class="mus-f mus-${m.status}" style="width:${Math.min(100,Math.round(m.sets/top*100))}%"></span></span>
      <span class="mus-v">${fmtSets(m.sets)}</span></div>`).join('')}<div class="mus-key">The shaded band is the useful weekly range for your goal (${esc((GOALS.find(x=>x.id===S.goal)||GOALS[3]).label)}).</div></div>`:''}
    ${rv.lifts.length?`<div class="sec-h">Lifts, now against about four weeks ago</div><div class="list">${rv.lifts.slice(0,8).map(l=>`<div class="row"><span class="row-main"><span class="row-t">${esc(l.name)}</span><span class="row-s">Estimated max ${l.then} → ${l.now} ${S.unit}</span></span><span class="dl dl-${l.pct>0?'good':l.pct<0?'warn':'flat'}">${l.pct>0?'+':l.pct<0?'−':''}${Math.abs(l.pct)}%</span></div>`).join('')}</div>`:''}
    <div class="sheet-acts">
      <button class="btn bts" onclick="closeOv('week-ov');coachStart('review')">${ICON('spark',15)} Ask the coach about this week</button>
    </div>
    <div class="fine">Everything above is worked out on this device. The coach is only used if you tap the button.</div>
    <button class="btn btg bfw" style="margin-top:4px" onclick="closeOv('week-ov')">Done</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function weekDotsHTML(days){
  return`<div class="wk-days">${days.map(d=>`<div class="wk-d is-${d.state}${d.today?' is-today':''}"><span class="wk-l">${d.letter}</span><span class="wk-dot">${d.state==='done'?ICON('tick',13):d.state==='active'?'<i></i>':''}</span></div>`).join('')}</div>`;
}
function pointRowHTML(p){
  return`<div class="row"><span class="row-ic tone-${p.tone}">${ICON(p.icon,17)}</span><span class="row-main"><span class="row-t">${esc(p.title)}</span>${p.sub?`<span class="row-s">${esc(p.sub)}</span>`:''}</span></div>`;
}
