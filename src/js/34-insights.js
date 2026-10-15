// ═══════════════════════════════════════════════════
// INSIGHTS — PRs, strength history, volume, standards, AFT scoring
// ═══════════════════════════════════════════════════

// ─── Personal records ───
// PRs are DERIVED from logged sets, never stored incrementally. Unchecking a set, discarding a
// workout or deleting one removes its PR automatically. A set marked `excl` (a typo, a bad
// entry) is ignored. S.prsManual holds records carried over from before this was the case.
function prCandidate(ex,s){
  if(!setCounts(s)||s.excl||s.fail||ex.timed||ex.dist||ex.cardio)return null; // a failed set was real work but is no record
  const info=getEx(ex.exId);if(info&&(info.load==='assisted'||info.kind==='cardio'))return null; // the weight on an assisted lift is help, not load
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
// Built for every exercise in one pass over the log (once per change), not one pass per exercise.
function getExStrData(exId){return getExStrAll().get(exId)||[];}
function getExStrAll(){
  return memo('strAll',()=>{
    const all=new Map();
    for(let i=S.workouts.length-1;i>=0;i--){
      const wk=S.workouts[i];const per=new Map();
      wk.exercises.forEach(ex=>{
        let o=per.get(ex.exId);
        ex.sets.forEach(s=>{
          const c=prCandidate(ex,s);if(!c)return;
          if(!o){o={best:null,maxW:0,vol:0};per.set(ex.exId,o);}
          o.vol+=c.w*c.r;if(c.w>o.maxW)o.maxW=c.w;
          if(betterPR(c,o.best))o.best=c;
        });
      });
      if(!per.size)continue;
      const label=fmtShort(wk.started);
      per.forEach((o,id)=>{if(!o.best)return;let a=all.get(id);if(!a){a=[];all.set(id,a);}
        a.push({label,date:wk.started,maxW:o.maxW,vol:o.vol,e1rm:o.best.est,w:o.best.w,r:o.best.r});});
    }
    return all;
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
  const iso=['Biceps','Triceps','Front Delts','Side Delts','Rear Delts','Abs','Calves','Traps','Forearms','Obliques'];
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

// ─── Every kind of lift, judged by what it is ───
// Weighted lifts by estimated max; bodyweight lifts by reps in a set; holds by seconds; distance
// work by metres; cardio by minutes. (Before this, a lift with no weight on it showed nothing at all.)
const KIND_UNIT={e1rm:'',reps:'reps',hold:'s',dist:'m',cardio:'min'};
function exKind(exId){
  const info=getEx(exId);
  if(info&&info.kind==='cardio')return'cardio';
  const c=exKindCounts().get(exId)||{w:0,r:0,t:0,d:0,a:0};
  const w=info&&info.load==='assisted'?0:c.w,r=c.r+(info&&info.load==='assisted'?c.a:0);
  if(w&&w>=r)return'e1rm';if(c.t)return'hold';if(c.d)return'dist';if(r)return'reps';
  if(HOLD_EX.has(exId))return'hold';if(DIST_EX.has(exId))return'dist';
  return info&&(info.eq==='Bodyweight'||info.load==='assisted')?'reps':'e1rm';
}
// How each exercise's sets were logged (weighted, reps only, timed, distance), in one pass.
function exKindCounts(){
  return memo('exKindAll',()=>{
    const m=new Map();
    for(const wk of S.workouts)for(const ex of wk.exercises){
      let c=m.get(ex.exId);if(!c){c={w:0,r:0,t:0,d:0,a:0};m.set(ex.exId,c);}
      if(ex.cardio){c.t++;continue;}
      ex.sets.forEach(s=>{if(!setCounts(s))return;if(ex.timed)c.t++;else if(ex.dist)c.d++;else if(parseFloat(s.w)>0){c.w++;if(parseInt(s.r)>0)c.a++;}else if(parseInt(s.r)>0)c.r++;});
    }
    return m;
  });
}
// The best set of one exercise in one workout, for a kind.
function exSessionBest(ex,kind){
  let best=null;
  if(kind==='cardio'){
    let sec=0,mi=0;ex.sets.forEach(s=>{if(!setCounts(s))return;sec+=parseInt(s.r)||0;mi+=parseFloat(s.d)||0;});
    return sec>0?{v:Math.round(sec/60*10)/10,sec,mi}:null;
  }
  ex.sets.forEach(s=>{
    if(!setCounts(s)||s.excl||s.fail)return;
    const w=parseFloat(s.w)||0,r=parseInt(s.r)||0;let v=null;
    if(kind==='e1rm'){const c=prCandidate(ex,s);if(c)v=c.est;}
    else if(r>0)v=r;
    if(v!=null&&(!best||v>best.v||(v===best.v&&w>best.w)))best={v,w,r};
  });
  return best;
}
// One point per session, oldest first: {date, v, w, r, wkId}.
function getExKindData(exId){return getExKindAll().get(exId)||{kind:exKind(exId),pts:[]};}
function getExKindAll(){
  return memo('kdAll',()=>{
    const all=new Map();const kinds=new Map();
    const kindOf=id=>{let k=kinds.get(id);if(!k){k=exKind(id);kinds.set(id,k);}return k;};
    for(let i=S.workouts.length-1;i>=0;i--){
      const wk=S.workouts[i];const per=new Map();
      wk.exercises.forEach(ex=>{const x=exSessionBest(ex,kindOf(ex.exId));if(!x)return;const b=per.get(ex.exId);if(!b||x.v>b.v)per.set(ex.exId,x);});
      per.forEach((b,id)=>{let o=all.get(id);if(!o){o={kind:kindOf(id),pts:[]};all.set(id,o);}o.pts.push(Object.assign({date:wk.started,wkId:wk.id},b));});
    }
    return all;
  });
}
// Anything ever logged, weighted or not.
function getExsLogged(){
  return memo('exsLogged',()=>{
    const ids=new Set();
    S.workouts.forEach(wk=>wk.exercises.forEach(ex=>{if(ex.sets.some(setCounts))ids.add(ex.exId);}));
    return[...ids];
  });
}
// A value of a kind, in words: "225 lb", "42 reps", "1:45", "50 m", "24 min".
function fmtKind(kind,v){
  if(v==null)return'–';
  if(kind==='e1rm')return`${Math.round(v)} ${S.unit}`;
  if(kind==='reps')return`${Math.round(v)} rep${Math.round(v)===1?'':'s'}`;
  if(kind==='hold')return fmtSecs(v);
  if(kind==='dist')return`${Math.round(v)} m`;
  if(kind==='cardio')return`${fmt1(v)} min`;
  return String(v);
}
const KIND_HEAD={e1rm:'estimated max',reps:'most reps in a set',hold:'longest hold',dist:'longest distance',cardio:'minutes'};
// Every record an exercise holds: estimated max, heaviest, most reps, longest hold or distance,
// best set and best session by volume. Each with the date and workout it came from.
function exRecords(exId){
  return memo('exRec:'+exId,()=>{
    const out={};const info=getEx(exId);const assisted=info&&info.load==='assisted';
    const better=(k,v,o)=>{if(v>0&&(!out[k]||v>out[k].v))out[k]=Object.assign({v},o);};
    S.workouts.slice().sort((a,b)=>a.started-b.started).forEach(wk=>{
      const ds=dayOf(wk.started);let vol=0;let seen=false;
      wk.exercises.forEach(ex=>{
        if(ex.exId!==exId)return;
        ex.sets.forEach(s=>{
          if(!setCounts(s)||s.excl)return;seen=true;
          const w=parseFloat(s.w)||0,r=parseInt(s.r)||0;
          if(ex.cardio)return;
          if(ex.timed){if(!s.fail)better('hold',r,{date:ds,wkId:wk.id});return;}
          if(ex.dist){if(!s.fail)better('dist',r,{date:ds,wkId:wk.id,w});return;}
          if(s.fail)return;
          if(!assisted&&w>0){
            better('est',e1rm(w,r),{w,r,date:ds,wkId:wk.id});
            better('heavy',w,{w,r,date:ds,wkId:wk.id});
            better('setVol',w*r,{w,r,date:ds,wkId:wk.id});
            vol+=w*r;
          }
          better('reps',r,{w,r,date:ds,wkId:wk.id});
        });
      });
      if(seen&&vol>0)better('sessVol',vol,{date:ds,wkId:wk.id});
    });
    return out;
  });
}

// ─── Army Fitness events done inside a workout ───
// Hex-bar deadlift: the heaviest set of three or more. Hand-release push-ups and the plank: the best
// set. Sprint-drag-carry and the two-mile run: the fastest time.
function aftValueFromEx(code,ex){
  const done=(ex.sets||[]).filter(s=>setCounts(s)&&!s.excl&&!s.fail);if(!done.length)return null;
  const nums=k=>done.map(s=>parseFloat(s[k])||0);
  if(code==='MDL'){const ok=done.filter(s=>(parseInt(s.r)||0)>=3).map(s=>parseFloat(s.w)||0).filter(v=>v>0);return ok.length?Math.max(...ok):null;}
  if(code==='HRP'||code==='PLK'){const v=Math.max(...nums('r'));return v>0?v:null;}
  if(code==='SDC'||code==='2MR'){const v=nums('r').filter(x=>x>0);return v.length?Math.min(...v):null;}
  return null;
}
// Offered at Finish only when it looks like test practice: three or more events, or a workout
// named for the test. A normal leg day with a plank in it is not a test.
function aftFromWorkout(wk){
  const best={};
  wk.exercises.forEach(ex=>{
    const e=getEx(ex.exId);if(!e||!e.aft)return;const v=aftValueFromEx(e.aft,ex);if(v==null)return;
    const dir=aftEvent(e.aft).dir;if(best[e.aft]==null||(dir==='high'?v>best[e.aft]:v<best[e.aft]))best[e.aft]=v;
  });
  const rows=AFT_EVENTS.filter(e=>best[e.id]!=null).map(e=>({id:e.id,v:best[e.id]}));
  const named=/\b(aft|acft|test|mock)\b/i.test(String(wk.name||''));
  return{n:rows.length>=3||(named&&rows.length)?rows.length:0,rows};
}
function aftSaveFromWorkout(wk){
  const a=aftFromWorkout(wk);if(!a.rows.length)return;
  a.rows.forEach(x=>{S.aftCurrent[x.id]=String(x.v);});
  if(a.rows.length>=3){
    const col=aftColumn();const sm=aftSummary(S.aftCurrent,col);
    S.aftHistory=[{date:dayOf(wk.started),scores:Object.assign({},S.aftCurrent),pts:sm.scores,total:sm.total,complete:sm.complete,pass:sm.pass,std:aftIsCombat()?'combat':'general',col,wkId:wk.id},...(S.aftHistory||[])];
  }
}
