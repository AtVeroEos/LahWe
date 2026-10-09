// ═══════════════════════════════════════════════════
// INSIGHTS — PRs, strength history, volume, standards, AFT scoring
// ═══════════════════════════════════════════════════

// ─── Personal records ───
// PRs are DERIVED from logged sets, never stored incrementally. Unchecking a set, discarding a
// workout or deleting one removes its PR automatically. A set marked `excl` (a typo, a bad
// entry) is ignored. S.prsManual holds records carried over from before this was the case.
function prCandidate(ex,s){
  if(!setCounts(s)||s.excl||s.fail||ex.timed)return null; // a failed set was real work but is no record
  const w=parseFloat(s.w),r=parseInt(s.r);
  if(!(w>0)||!(r>0))return null;
  return{w,r,est:e1rm(w,r)};
}
function betterPR(a,b){return !b||a.est>b.est||(a.est===b.est&&a.w>b.w);}
function computeHistoryPRs(workouts){
  const prs={};
  // Oldest first, and only a strictly better set replaces the record: matching a PR later does not move its date.
  (workouts||[]).slice().sort((a,b)=>a.started-b.started).forEach(wk=>(wk.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(s=>{
    const c=prCandidate(ex,s);if(!c)return;
    if(betterPR(c,prs[ex.exId]))prs[ex.exId]={w:c.w,r:c.r,est:c.est,date:dayOf(wk.started),wkId:wk.id};
  })));
  return prs;
}
function rebuildPRs(){
  const prs=computeHistoryPRs(S.workouts);
  const aw=S.activeWorkout;
  if(aw)(aw.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(s=>{
    const c=prCandidate(ex,s);if(!c)return;
    if(betterPR(c,prs[ex.exId]))prs[ex.exId]={w:c.w,r:c.r,est:c.est,date:dayOf(aw.started),wkId:aw.id,live:true};
  }));
  Object.keys(S.prsManual||{}).forEach(id=>{
    const p=S.prsManual[id];if(!p||!(p.est>0))return;
    if(betterPR(p,prs[id]))prs[id]={w:p.w,r:p.r,est:p.est,date:p.date||null,manual:true};
  });
  S.prs=prs;
  return prs;
}
// Best record for an exercise NOT counting the workout in progress — what a new set has to beat.
function priorBest(exId){
  const h=memo('histPRs',()=>computeHistoryPRs(S.workouts))[exId];
  const m=(S.prsManual||{})[exId];
  if(h&&m)return betterPR(m,h)?m:h;
  return h||m||null;
}

// ─── Strength history ───
// One point per session, oldest first: the best estimated 1RM among working sets.
function getExStrData(exId){
  return memo('str:'+exId,()=>{
    const out=[];
    for(let i=S.workouts.length-1;i>=0;i--){
      const wk=S.workouts[i];
      let best=null,maxW=0,vol=0;
      wk.exercises.forEach(ex=>{
        if(ex.exId!==exId)return;
        ex.sets.forEach(s=>{
          const c=prCandidate(ex,s);if(!c)return;
          vol+=c.w*c.r;if(c.w>maxW)maxW=c.w;
          if(betterPR(c,best))best=c;
        });
      });
      if(best)out.push({label:fmtShort(wk.started),date:wk.started,maxW,vol,e1rm:best.est,w:best.w,r:best.r});
    }
    return out;
  });
}
function getExsWithHist(){
  return memo('exsHist',()=>{
    const ids=new Set();
    S.workouts.forEach(wk=>wk.exercises.forEach(ex=>{if(ex.sets.some(s=>prCandidate(ex,s)))ids.add(ex.exId);}));
    return[...ids];
  });
}
function getProgressWins(exIds){
  const wins=[];
  (exIds||getExsWithHist()).forEach(exId=>{
    const hist=getExStrData(exId);
    if(hist.length<3)return;
    const newest=hist[hist.length-1].e1rm;
    const oldest=hist[0].e1rm;
    const pct=oldest>0?Math.round((newest-oldest)/oldest*100):0;
    if(pct>=5)wins.push({exId,name:exName(exId),pct,sessions:hist.length});
  });
  return wins.sort((a,b)=>b.pct-a.pct).slice(0,2);
}
function getPRProximity(){
  const results=[];
  Object.entries(S.prs).forEach(([exId,pr])=>{
    const hist=getExStrData(exId);if(!hist.length)return;
    const recent=hist[hist.length-1];
    const gap=Math.round(pr.est-recent.e1rm);
    if(gap>0&&gap<=pr.est*0.08)results.push({exId,name:exName(exId),gap,prEst:pr.est});
  });
  return results.slice(0,1);
}
// Muscles whose weekly volume has risen for 2–3 weeks running. Uses the same weighted,
// warmup-excluding set count as the Volume and Fatigue cards.
function getVolumeMomentum(){
  const now=Date.now(),WK=7*86400000;
  const w=[0,1,2].map(i=>muscleSetsInRange(now-(i+1)*WK,now-i*WK));
  const results=[];
  Object.keys(MEV_MAV).forEach(m=>{
    const a=w[0][m]||0,b=w[1][m]||0,c=w[2][m]||0;
    if(a>0&&a>b&&b>c&&c>0)results.push({muscle:MEV_MAV[m].lbl,weeks:3,val:a});
    else if(a>0&&a>b&&b>0)results.push({muscle:MEV_MAV[m].lbl,weeks:2,val:a});
  });
  return results.sort((x,y)=>y.weeks-x.weeks||y.val-x.val).slice(0,1);
}
function getStagnantExercises(exIds){
  const stag=[];
  (exIds||[]).forEach(exId=>{
    const hist=getExStrData(exId);if(hist.length<3)return;
    const last3=hist.slice(-3).map(h=>h.e1rm);
    const mx=Math.max(...last3),mn=Math.min(...last3);
    if(mx-mn<=1)stag.push({exId,name:exName(exId),sessions:3});
  });
  return stag.slice(0,2);
}
function exSessions(exId,n){
  const out=[];
  for(const wk of S.workouts){if(wk.exercises.some(e=>e.exId===exId)){out.push(wk);if(out.length>=n)break;}}
  return out;
}
function getExPainLevel(exId){
  return exSessions(exId,3).filter(wk=>wk.exercises.some(e=>e.exId===exId&&e.sets.some(s=>s.done&&s.tag==='Pain'))).length;
}
function getPainWarnings(){
  const w=[];
  const ids=new Set(S.workouts.slice(0,10).flatMap(wk=>wk.exercises.map(e=>e.exId)));
  ids.forEach(exId=>{const pc=getExPainLevel(exId);if(pc>=2)w.push({exId,name:exName(exId),sessions:pc});});
  return w;
}
function checkProgressiveOverload(exId){
  const sessions=exSessions(exId,2);
  if(sessions.length<2)return null;
  const allComplete=sessions.every(wk=>{
    const ex=wk.exercises.find(e=>e.exId===exId);
    return ex&&ex.sets.length>0&&ex.sets.every(s=>s.done);
  });
  if(!allComplete)return null;
  const ex=getEx(exId);if(!ex)return null;
  if(ex.eq==='Bodyweight')return{type:'reps',amount:1};
  const iso=['Biceps','Triceps','Shoulders','Abs','Calves','Traps','Forearms','Obliques'];
  const isIso=iso.includes(normMuscle(ex.muscle))&&ex.cat!=='Full Body';
  return{type:'weight',amount:isKg()?(isIso?1.25:2.5):(isIso?2.5:5),unit:S.unit};
}
function getRecentExIds(n=8){
  const ids=[];
  for(const wk of S.workouts){for(const ex of wk.exercises){if(!ids.includes(ex.exId))ids.push(ex.exId);}if(ids.length>=n)break;}
  return ids.slice(0,n);
}
function getWeeklyActivity(nw=12){
  return Array.from({length:nw},(_,i)=>{
    const end=new Date();end.setDate(end.getDate()-(nw-1-i)*7);
    const start=new Date(end);start.setDate(start.getDate()-7);
    // Each bar is seven calendar days ending on `end` (the last bar ends today, inclusive).
    const hi=dstr(end),lo=dstr(start);
    return S.workouts.filter(w=>{const d=dayOf(w.started);return d>lo&&d<=hi;}).length+
      S.activities.filter(a=>a.date>lo&&a.date<=hi).length;
  });
}
function getRecoveryData(){
  const now=Date.now(),WK=7*86400000;
  const ws=[0,1,2].map(i=>muscleSetsInRange(now-(i+1)*WK,now-i*WK+(i===0?1:0)));
  const warnings=[];
  Object.entries(MEV_MAV).forEach(([m,mm])=>{if(ws.filter(w=>(w[m]||0)>mm.mav).length>=2)warnings.push({muscle:mm.lbl});});
  return{ws,warnings};
}
// Wilks / DOTS from ESTIMATED 1RMs (a 225×10 PR is not a 225 squat). Front squat may stand in
// for the back squat and sumo for the deadlift; a hex-bar pull is not a squat and is not used.
function getWilksData(){
  const pr=S.prs;
  const pick=ids=>{for(const id of ids){if(pr[id])return{id,est:pr[id].est,sub:id!==ids[0]};}return null;};
  const sq=pick(['squat','front-squat']),bench=pick(['bb-bench']),dl=pick(['deadlift','sumo-dl']);
  if(!sq||!bench||!dl)return null;
  const total=sq.est+bench.est+dl.est;
  const gn=S.aftGender||'male';
  const bwK=bwKg(),totK=toKg(total);
  const aw=gn==='female'?[594.31747775582,-27.23842536447,0.82112226871,-0.00930733913,4.731582e-5,-9.054e-8]:[-216.0475144,16.2606339,-0.002388645,-0.00113732,7.01863e-6,-1.291e-8];
  const dw=aw[0]+aw[1]*bwK+aw[2]*bwK**2+aw[3]*bwK**3+aw[4]*bwK**4+aw[5]*bwK**5;
  const wilks=Math.round(500/dw*totK*10)/10;
  const ad=gn==='female'?-57.96288+13.6175032*bwK-0.1126655495*bwK**2+0.0005158568*bwK**3-1.0706e-6*bwK**4:-307.75076+24.0900756*bwK-0.1918759221*bwK**2+0.0007391293*bwK**3-1.093e-6*bwK**4;
  const dots=Math.round(500/ad*totK*10)/10;
  return{total,wilks,dots,sq:sq.est,bench:bench.est,dl:dl.est,sqSub:sq.sub,dlSub:dl.sub};
}
// Strength standards compare an estimated 1RM against bodyweight multiples.
function getStdLevels(){
  const bw=bwUser();const gn=S.aftGender||'male';
  return Object.entries(STR_STANDARDS).map(([id,std])=>{
    const pr=S.prs[id];if(!pr)return{id,name:std.name,level:0,current:0,targets:[]};
    const w=pr.est;
    const mults=(gn==='female'?std.f:std.m).map(m=>m*bw);
    let level=0;for(let i=0;i<mults.length;i++){if(w>=mults[i])level=i+1;}
    return{id,name:std.name,level,current:w,targets:mults};
  });
}

// ─── Army Fitness Test ───
function aftAgeIdx(age){const hi=[21,26,31,36,41,46,51,56,61];for(let i=0;i<hi.length;i++)if(age<=hi[i])return i;return 9;}
function aftAgeBracket(){return AFT_AGE_GROUPS[aftAgeIdx(userAge())];}
function aftIsCombat(){return S.aftStandard==='combat';}
// Column in the score tables: age group, then male-or-combat (0) / female (1).
// The combat standard is sex-neutral and scored on the male column.
function aftColumn(){return aftAgeIdx(userAge())*2+((S.aftGender==='female'&&!aftIsCombat())?1:0);}
function aftEvent(id){return AFT_EVENTS.find(e=>e.id===id);}
// Points (0–100) for a raw result, or null when nothing is entered. Results that fall between
// two rows earn the lower row; a result below the lowest row on the table earns 0.
function aftScore(evId,val,col){
  const t=AFT_TABLES[evId];if(!t||val===''||val==null)return null;
  const v=parseFloat(val);if(isNaN(v))return null;
  if(col==null)col=aftColumn();
  const high=aftEvent(evId).dir==='high';
  for(let p=100;p>=0;p--){
    const row=t[p];if(!row)continue;
    const req=row[col];if(req==null)continue;
    if(high?v>=req:v<=req)return p;
  }
  return 0;
}
// Raw result needed for a given number of points (nearest row at or above it).
function aftNeed(evId,points,col){
  const t=AFT_TABLES[evId];if(col==null)col=aftColumn();
  for(let p=points;p<=100;p++){const row=t[p];if(row&&row[col]!=null)return row[col];}
  return null;
}
function aftFmtRaw(evId,v){
  if(v==null||v==='')return'–';
  const e=aftEvent(evId);
  return e.unit==='time'?fmtMS(v):`${v} ${e.unit}`;
}
// Totals and pass/fail for a set of raw results {MDL:…, HRP:…}.
function aftSummary(raw,col){
  const scores={};let n=0,total=0,minEv=100;
  AFT_EVENTS.forEach(e=>{const s=aftScore(e.id,raw[e.id],col);scores[e.id]=s;if(s!==null){n++;total+=s;if(s<minEv)minEv=s;}});
  const need=aftIsCombat()?350:300;
  const complete=n===AFT_EVENTS.length;
  return{scores,n,total,complete,need,pass:complete?(minEv>=60&&total>=need):null,minEv:n?minEv:null};
}
