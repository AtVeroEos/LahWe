// ═══════════════════════════════════════════════════
// METRICS — every number on the Progress board, defined once
// ═══════════════════════════════════════════════════
// The board, its detail sheets and (later) the home screen all read from here, so a number
// cannot mean one thing on one screen and something else on another. Each metric says how it
// is worked out, which direction is good for the user's goal, and what it shows before there
// is enough data. Nothing here uses AI or the network.
//
// Two windows are used and always labelled:
//   · the board's range (4 weeks … a year) for trends and charts;
//   · "this week" always means Monday to Sunday, the same week the home screen uses.

const RANGES=[
  {id:'4w',label:'4 weeks',short:'4 wk',days:28},
  {id:'12w',label:'12 weeks',short:'12 wk',days:84},
  {id:'6m',label:'6 months',short:'6 mo',days:182},
  {id:'1y',label:'1 year',short:'1 yr',days:365},
];
function boardRange(){
  const r=RANGES.find(x=>x.id===(isObj(S.board)?S.board.range:null))||RANGES[1];
  return Object.assign({from:daysAgoStr(r.days),to:today()},r);
}
function fmtSigned(n,dec){const a=Math.abs(n);return(n<0?'−':'+')+(dec!=null?a.toFixed(dec):fmt1(a));}
function fmtPace(sec){sec=Math.round(sec);return Math.floor(sec/60)+':'+pad2(sec%60);}
// Mondays of every calendar week the range touches, oldest first; the last is the current week.
function rangeWeeks(range){
  const out=[];const end=mondayOf(today());
  for(let mon=mondayOf(range.from);mon<=end;mon=addDays(mon,7))out.push(mon);
  return out;
}
// Least-squares line through {t,v} points: slope per day and its value at the first and last point.
function fitLine(pts){
  const n=pts.length;if(n<2)return null;
  const mx=pts.reduce((a,p)=>a+p.t,0)/n,my=pts.reduce((a,p)=>a+p.v,0)/n;
  let num=0,den=0;pts.forEach(p=>{num+=(p.t-mx)*(p.v-my);den+=(p.t-mx)*(p.t-mx);});
  if(!den)return null;
  const perDay=num/den;const t0=pts[0].t,t1=pts[n-1].t;
  return{perDay,a:my+perDay*(t0-mx),b:my+perDay*(t1-mx),span:t1-t0,n};
}

// ─── Body weight ───
function weightPts(fromDs){
  return(S.bodyweightLog||[]).filter(b=>b.date>=fromDs&&b.date<=today()&&parseFloat(b.weight)>0)
    .map(b=>({t:dayNum(b.date),v:parseFloat(b.weight),ds:b.date})).sort((a,b)=>a.t-b.t);
}
// THE weight trend: a least-squares fit through every weigh-in of the period. It needs two
// weigh-ins at least three days apart; two readings a day apart are noise, not a trend.
function weightFit(fromDs){
  const pts=weightPts(fromDs);const f=fitLine(pts);
  if(!f||f.span<3)return null;
  return Object.assign(f,{perWeek:Math.round(f.perDay*7*100)/100,pts});
}
// Is a change in weight the way the user wants to go? '' when no direction was chosen.
function weightTone(perWeek){
  const dir=S.weightGoalDir;
  if(Math.abs(perWeek)<0.05)return dir==='maintain'?'good':'flat';
  if(dir==='lose')return perWeek<0?'good':'warn';
  if(dir==='gain')return perWeek>0?'good':'warn';
  if(dir==='maintain')return Math.abs(perWeek)<=0.25?'good':'warn';
  return'flat';
}

// ─── Lifts ───
function liftPts(exId,fromDs){
  return getExStrData(exId).filter(d=>dayOf(d.date)>=fromDs).map(d=>({t:dayNum(d.date),v:d.e1rm,d}));
}
// The lifts shown when none were chosen: the most-trained lift of each main movement (squat,
// hinge, press, overhead press, then rows and pulls), barbell first.
function defaultLiftIds(){
  const have=getExsWithHist();if(!have.length)return[];
  const since=Date.now()-84*86400000;const cnt={};
  S.workouts.forEach(w=>{if(w.started<since)return;(w.exercises||[]).forEach(ex=>{if(ex.sets.some(s=>prCandidate(ex,s)))cnt[ex.exId]=(cnt[ex.exId]||0)+1;});});
  const info=have.map(id=>{const ex=getEx(id);const hist=getExStrData(id);
    return{id,pat:ex?exPattern(ex):'',bar:!!(ex&&/barbell|trap bar|hex/i.test(ex.eq+' '+ex.name)),n:cnt[id]||0,all:hist.length,est:hist.length?hist[hist.length-1].e1rm:0};});
  const better=(a,b)=>((b.bar?1:0)-(a.bar?1:0))||(b.n-a.n)||(b.est-a.est)||(b.all-a.all);
  const out=[];
  ['squat','hinge','h-push','v-push','h-pull','v-pull'].forEach(pat=>{
    const c=info.filter(x=>x.pat===pat).sort(better)[0];if(c&&out.length<4)out.push(c.id);
  });
  info.filter(x=>!out.includes(x.id)).sort(better).forEach(x=>{if(out.length<4)out.push(x.id);});
  return out;
}
function boardLiftIds(p){
  const have=getExsWithHist();
  const ids=(p&&Array.isArray(p.ids)?p.ids:[]).filter(id=>have.includes(id));
  return ids.length?ids.slice(0,6):defaultLiftIds();
}
// One lift over the range: where it is, how far it has moved, and whether it has stalled
// (three sessions in a row within one unit of each other).
function liftRow(exId,range){
  const all=getExStrData(exId);const pts=liftPts(exId,range.from);
  const latest=all.length?all[all.length-1]:null;
  const row={id:exId,name:exName(exId),pts,value:latest?latest.e1rm:null,delta:null,stalled:false,lastDs:latest?dayOf(latest.date):null,inRange:pts.length};
  if(pts.length>=2)row.delta=pts[pts.length-1].v-pts[0].v;
  if(pts.length>=3){const l3=pts.slice(-3).map(p=>p.v);row.stalled=Math.max(...l3)-Math.min(...l3)<=1;}
  return row;
}

// ─── Records ───
// Records with their dates, newest first, and how much each beat the best before it.
function recordRows(){
  return memo('recordRows',()=>Object.entries(S.prs||{}).map(([id,pr])=>{
    let prev=0;
    if(pr.date)getExStrData(id).forEach(d=>{if(dayOf(d.date)<pr.date&&d.e1rm>prev)prev=d.e1rm;});
    return{id,name:exName(id),w:pr.w,r:pr.r,est:pr.est,date:pr.date||null,manual:!!pr.manual,gain:prev>0?pr.est-prev:null};
  }).sort((a,b)=>(b.date||'')<(a.date||'')?-1:(b.date||'')>(a.date||'')?1:b.est-a.est));
}

// A NEW record beat an earlier best inside the period. The first set ever logged on a lift is a
// record too, but it is a starting point, not progress.
function newRecords(range){return recordRows().filter(r=>r.date&&r.date>=range.from&&r.gain>0);}

// ─── Sessions ───
function plannedPerWeek(){
  if(!hasFixedSchedule())return null;
  return[0,1,2,3,4,5,6].filter(d=>plannedRoutinesForDow(d).length).length;
}
// Days with a workout in each calendar week of the range.
function sessionWeeks(range){
  const days=new Set(S.workouts.map(w=>dayOf(w.started)));
  const cur=mondayOf(today());
  return rangeWeeks(range).map(mon=>{let n=0;for(let i=0;i<7;i++)if(days.has(addDays(mon,i)))n++;return{mon,n,current:mon===cur};});
}
function nextSessionLabel(){
  if(!hasFixedSchedule())return null;
  const td=today();const done=S.workouts.some(w=>dayOf(w.started)===td)||!!S.activeWorkout;
  for(let i=done?1:0;i<14;i++){const ds=addDays(td,i);if(isTrainingDay(ds))return i===0?'today':i===1?'tomorrow':dayDate(ds).toLocaleDateString('en-US',{weekday:'long'});}
  return null;
}

// ─── Food ───
// The last n finished days (today is still in progress), oldest first, each with its own target.
function foodDays(n){
  const out=[];
  for(let i=n;i>=1;i--){const ds=daysAgoStr(i);const t=getDayTotals(ds);const g=goalsFor(ds)||{cals:0,protein:0};
    out.push({ds,cals:t.cals||0,protein:t.protein||0,goalCals:g.cals||0,goalProtein:g.protein||0,logged:(t.cals||0)>0||(t.protein||0)>0});}
  return out;
}
// Average of what was eaten over the logged days, with the average of those days' targets.
function foodAvg(days,key){
  const d=days.filter(x=>x.logged);if(!d.length)return null;
  const gk=key==='cals'?'goalCals':'goalProtein';
  return{avg:Math.round(d.reduce((t,x)=>t+x[key],0)/d.length),goal:Math.round(d.reduce((t,x)=>t+x[gk],0)/d.length),n:d.length};
}
// Calories against target, judged by the weight goal: over is the problem when cutting, under when gaining.
function calorieTone(avg,goal){
  if(!goal)return'flat';const off=(avg-goal)/goal;
  if(Math.abs(off)<=0.05)return'good';
  const dir=S.weightGoalDir;
  if(dir==='lose')return off>0?'warn':'flat';
  if(dir==='gain')return off<0?'warn':'flat';
  return'flat';
}

// ─── Cardio pace ───
// Only efforts with a real distance and a real time: an estimated one is not a pace.
function paceActs(){
  return(S.activities||[]).filter(a=>parseFloat(a.dist)>0&&actSec(a)>0&&!a.distEst&&!a.durEst)
    .map(a=>({a,type:a.type,dist:parseFloat(a.dist),sec:actSec(a)/parseFloat(a.dist),ds:a.date,t:dayNum(a.date)}));
}
// Runs are compared inside distance bands. GPS never measures the same loop the same twice (3.04,
// 3.11 and 3.2 are one route), so each band is wide enough to hold a distance and its noise, and
// leans long: a track reads long more often than short, and "a bit past the mark" is common where
// "stopped short" is a different run. The bands do not touch. A 5-mile run is not a slow 4-miler
// or a fast 10K, so it sits in no band and shows only in "All runs".
const RUN_BANDS=[
  {dist:1,label:'1 mi',lo:0.93,hi:1.15},     // 1500 m up to a mile and a bit
  {dist:2,label:'2 mi',lo:1.86,hi:2.25},     // 3K up to two and a quarter
  {dist:3.1,label:'5K',lo:2.95,hi:3.35},
  {dist:4,label:'4 mi',lo:3.75,hi:4.3},
  {dist:6.2,label:'10K',lo:5.9,hi:6.6},
  {dist:13.1,label:'Half',lo:12.6,hi:13.6},
  {dist:99,label:'Longer',lo:13.6,hi:1e9},   // every distance past a half, together
];
const RUN_ALL_MIN=0.93;   // shorter than this is a sprint, which Riegel's formula does not cover
const RIEGEL=1.06;
// What a time over one distance is worth over another: T2 = T1 × (D2 ÷ D1)^1.06 (Riegel, 1981).
function riegel(sec,fromM,toM){return sec*Math.pow(toM/fromM,RIEGEL);}
// The band an effort belongs to: {dist,label}, or null for a run between bands. Rucks, walks,
// hikes and rides are grouped to the nearest mile (the nearest five beyond ten): their pace hardly
// moves with distance.
function paceBand(type,dist){
  if(!(dist>0))return null;
  if(type==='run'){const b=RUN_BANDS.find(x=>dist>=x.lo&&dist<x.hi);return b?{dist:b.dist,label:b.label}:null;}
  if(dist<0.5)return null;
  const n=dist<10.5?Math.max(1,Math.round(dist)):Math.round(dist/5)*5;
  return{dist:n,label:n+' mi'};
}
// A run as a pace over 5K, so runs of every length sit on one scale.
function paceAs5k(x){const m=x.dist*MILE_M;return riegel(x.sec*x.dist,m,5000)/(5000/MILE_M);}
function paceIn(x,o){
  if(x.type!==o.type)return false;
  if(o.all)return x.dist>=RUN_ALL_MIN;
  const b=paceBand(x.type,x.dist);return !!b&&b.dist===o.dist;
}
// What there is to compare: each kind of activity in each band it has been done in, runs first,
// and for runs the series that holds all of them.
function paceOptions(){
  {
    const opts=[];const acts=paceActs();
    const label=t=>(ACT_TYPES.find(a=>a.id===t)||{label:'Activity'}).label.replace(' March','');
    const note=(o,x)=>{o.n++;if(x.ds>o.last)o.last=x.ds;};
    acts.forEach(x=>{
      const b=paceBand(x.type,x.dist);if(!b)return;
      let o=opts.find(q=>q.type===x.type&&q.dist===b.dist);
      if(!o){o={type:x.type,dist:b.dist,short:b.label,n:0,last:''};opts.push(o);}
      note(o,x);
    });
    const all={type:'run',dist:0,all:true,short:'all runs',n:0,last:''};
    acts.forEach(x=>{if(paceIn(x,all))note(all,x);});
    // "All runs" is offered once it adds something: runs in more than one band, or between bands.
    const runBands=opts.filter(o=>o.type==='run');
    if(all.n&&(runBands.length!==1||runBands[0].n<all.n))opts.push(all);
    opts.forEach(o=>{o.kind=label(o.type);o.label=`${o.kind} · ${o.short}`;});
    // Runs first; among runs the series holding the most (all runs, when it holds more than any band).
    return opts.sort((a,b)=>((b.type==='run')-(a.type==='run'))||(b.n-a.n)||((b.all?0:1)-(a.all?0:1))||(a.last<b.last?1:-1));
  }
}
function pacePick(p){
  const opts=paceOptions();if(!opts.length)return null;
  if(p&&p.type){
    const d=parseFloat(p.dist);
    if(p.type==='run'&&d===0){const all=opts.find(o=>o.all);if(all)return all;}
    // A tile saved before bands existed holds a plain distance ("3.1"): it becomes the band that distance is in.
    const b=d>0?(opts.find(o=>o.type===p.type&&!o.all&&o.dist===d)?{dist:d}:paceBand(p.type,d)):null;
    const hit=b&&opts.find(o=>o.type===p.type&&!o.all&&o.dist===b.dist);
    if(hit)return hit;
  }
  return opts[0];
}
// "All runs" mixes easy days and hard ones, so first-against-last says nothing: its direction is
// the slope of a line fitted through every run of the period (it needs four, over two weeks).
function paceTrend(opt,pts){
  if(!opt||!opt.all||pts.length<4)return null;
  const f=fitLine(pts);if(!f||f.span<14)return null;
  const d=Math.round(f.b-f.a);
  return{fit:{a:f.a,b:f.b},d,tone:d<=-2?'good':d>=2?'warn':'flat',text:Math.abs(d)<2?'Level across these runs':`Trend: ${Math.abs(d)} s a mile ${d<0?'faster':'slower'}`};
}
// v is seconds a mile: the run's own pace in a band, its 5K-equivalent pace in "all runs".
function paceSeries(opt,fromDs){
  if(!opt)return[];
  return paceActs().filter(x=>paceIn(x,opt)&&(!fromDs||x.ds>=fromDs)).sort((a,b)=>a.t-b.t).map(x=>Object.assign({},x,{v:opt.all?paceAs5k(x):x.sec}));
}

// ─── Volume ───
function setsStatus(){
  const sbm=muscleSetsInRange(Date.now()-7*86400000,Date.now()+1);
  let low=0,high=0,ok=0;
  Object.entries(MEV_MAV).forEach(([m,mm])=>{const s=sbm[m]||0;if(!s)return;if(s<mm.mev)low++;else if(s>mm.mav)high++;else ok++;});
  // The headline is sets actually done. (Per muscle a set counts more than once: a bench press set is chest, shoulders and triceps.)
  const from=daysAgoStr(6);
  const total=S.workouts.filter(w=>dayOf(w.started)>=from).reduce((t,w)=>t+doneSetCnt(w),0);
  return{sbm,total,low,high,ok};
}
function setsWeeks(range){
  return rangeWeeks(range).map(mon=>{
    const end=addDays(mon,6);
    const n=S.workouts.filter(w=>{const d=dayOf(w.started);return d>=mon&&d<=end;}).reduce((t,w)=>t+doneSetCnt(w),0);
    return{mon,n,current:mon===mondayOf(today())};
  });
}

// ─── Measurements ───
function measureTracked(){const meas=S.measurements||[];return MEAS_FIELDS.filter(f=>meas.some(m=>m.values&&m.values[f.id]!=null));}
function measurePart(){const tr=measureTracked();if(!tr.length)return null;return tr.find(f=>f.id===S.measPart)||tr[0];}
function measurePts(partId,fromDs){
  return(S.measurements||[]).filter(m=>m.values&&m.values[partId]!=null&&(!fromDs||m.date>=fromDs))
    .map(m=>({t:dayNum(m.date),v:parseFloat(m.values[partId]),ds:m.date})).filter(p=>isFinite(p.v)).sort((a,b)=>a.t-b.t);
}

// ═══ The catalog ═══
// Each metric:  title · group (for the Add list) · wide (a list tile across both columns)
//   has()            is there anything at all to show (decides the default board)
//   tile(range,p)    what the tile shows: {title,value,unit,sub,tone,spark} or {empty} or, when
//                    wide, {title,note,rows,foot}
//   open(p)          what a tap does, when it is not the standard detail sheet
//   param            'lifts' | 'pace': the tile can be pointed at something (set in Edit board)
// On a tile "Barbell Back Squat" reads as "Back Squat" — unless that would make two rows look the same.
function shortLiftNames(names){
  const short=names.map(n=>String(n).replace(/^Barbell /,''));
  return short.some((n,i)=>short.indexOf(n)!==i)?names.slice():short;
}
const METRIC_GROUPS=['Strength','Body','Food','Training','Conditioning'];
const METRICS={
  lifts:{title:'Lifts',group:'Strength',wide:true,param:'lifts',
    has:()=>getExsWithHist().length>0,
    open:()=>showAllLifts(),
    paramText:p=>{const n=boardLiftIds(p).length;return n?`${n} chosen`:'Choose';},
    tile(range,p){
      const ids=boardLiftIds(p);
      if(!ids.length)return{title:'Lifts',empty:'Log a workout and your main lifts appear here with their trend.'};
      const all=getExsWithHist().length;
      const labels=shortLiftNames(ids.map(id=>exName(id)));
      return{title:'Lifts',note:`estimated 1RM, ${S.unit}`,
        rows:ids.map((id,i)=>{const r=liftRow(id,range);
          return{label:labels[i],js:`showMetric('lift',{id:${JSON.stringify(id)}})`,spark:svgSpark(r.pts,{w:72,h:24,cls:'spark-sm'}),
            value:r.value!=null?String(Math.round(r.value)):'–',
            delta:r.stalled?'flat':r.delta!=null?fmtSigned(Math.round(r.delta)):r.inRange?'':'–',
            tone:r.stalled?'warn':r.delta==null?'flat':r.delta>0?'good':r.delta<0?'warn':'flat'};}),
        foot:all>ids.length?{label:`All ${all} lifts`,js:'showAllLifts()'}:null};
    }},
  records:{title:'New records',group:'Strength',wide:true,
    has:()=>Object.keys(S.prs||{}).length>0,
    tile(range){
      const all=recordRows();if(!all.length)return{title:'New records',empty:'Records come from the sets you log.'};
      const fresh=newRecords(range);
      const show=(fresh.length?fresh:all.filter(r=>r.date)).slice(0,3);
      const labels=shortLiftNames(show.map(r=>r.name));
      return{title:fresh.length?'New records':'Records',note:fresh.length?`${fresh.length} in the last ${range.label}`:`none in the last ${range.label}`,
        rows:show.map((r,i)=>({label:labels[i],sub:(r.date?fmtDay(r.date):'')+(r.gain>0?` · ${fmtSigned(r.gain)} ${S.unit} on your best`:''),js:`showPRDetail(${JSON.stringify(r.id)})`,
          value:String(r.w),valueSub:` × ${r.r}`})),
        foot:all.length>show.length?{label:`All ${all.length} records`,js:`showMetric('records')`}:null};
    }},
  sets:{title:'Hard sets',group:'Strength',
    has:()=>S.workouts.some(w=>w.started>=Date.now()-28*86400000),
    tile(range){
      const st=setsStatus();if(!st.total)return{title:'Hard sets',empty:'No sets logged in the last 7 days.'};
      const wk=setsWeeks(range);
      return{title:'Hard sets · 7 days',value:fmtSets(Math.round(st.total)),unit:' sets',
        sub:st.high?`${st.high} muscle${st.high===1?'':'s'} over range`:st.low?`${st.low} under range`:'All in range',tone:st.high?'warn':st.low?'flat':'good',
        spark:svgBars(wk.map(w=>({v:w.n,hollow:w.current})))};
    }},
  standards:{title:'Strength standards',group:'Strength',
    has:()=>getStdLevels().some(l=>l.current>0),
    tile(){
      const lv=getStdLevels();if(!lv.some(l=>l.current>0))return{title:'Strength standards',empty:'Log a squat, press or pull to be graded.'};
      const n=lv.filter(l=>l.level>=3).length;
      return{title:'Strength standards',value:String(n),unit:` of ${lv.length} lifts`,sub:'Intermediate or better',tone:'flat',
        spark:svgBars(lv.map(l=>({v:l.level||0.15,tone:l.level>=3?'good':''})),{target:null})};
    }},
  weight:{title:'Body weight',group:'Body',
    has:()=>(S.bodyweightLog||[]).length>0,
    tile(range){
      const log=S.bodyweightLog||[];if(!log.length)return{title:'Body weight',empty:'Weigh in to start a trend.'};
      const pts=weightPts(range.from);const f=weightFit(range.from);const u=S.unit||'lbs';
      return{title:'Body weight',value:fmt1(log[0].weight),unit:' '+u,
        sub:f?(Math.abs(f.perWeek)<0.05?'Steady':`${fmtSigned(f.perWeek,1)} ${u} a week`):pts.length<2?'One weigh-in so far':'Weigh in over a few days',
        tone:f?weightTone(f.perWeek):'flat',spark:svgSpark(pts,{fit:f?{a:f.a,b:f.b}:null})};
    }},
  maintenance:{title:'Maintenance',group:'Body',
    has:()=>(S.bodyweightLog||[]).length>0||foodDays(28).some(d=>d.logged),
    open:()=>showMaintenance(),
    tile(){
      const m=maintenanceBest();const v=maintenanceVerdict(m);
      return{title:'Maintenance',value:m.kcal.toLocaleString(),unit:' kcal',
        sub:m.src==='logs'?`From your log, ± ${m.obs.margin}`:'Formula estimate',tone:'flat',
        // The bar is your average target; the tick is maintenance.
        spark:v&&v.target?svgMeter(v.target/(m.kcal*1.25),0.8):''};
    }},
  measure:{title:'Measurement',group:'Body',
    has:()=>measureTracked().length>0,
    tile(range){
      const part=measurePart();if(!part)return{title:'Measurement',empty:'Log a measurement to track it.'};
      const all=measurePts(part.id);const pts=measurePts(part.id,range.from);const u=S.measureUnit||'in';
      const last=all[all.length-1];const d=pts.length>=2?pts[pts.length-1].v-pts[0].v:null;
      return{title:part.label,value:fmt1(last.v),unit:' '+u,sub:d==null?`Last on ${fmtDay(last.ds)}`:Math.abs(d)<0.05?'No change':`${fmtSigned(d,1)} ${u} since ${fmtDay(pts[0].ds)}`,tone:'flat',spark:svgSpark(pts)};
    }},
  calories:{title:'Calories',group:'Food',
    has:()=>foodDays(28).some(d=>d.logged),
    tile(){
      const days=foodDays(7);const a=foodAvg(days,'cals');
      if(!a)return{title:'Calories · 7 days',empty:'Log food to see your average against target.'};
      const diff=a.avg-a.goal;const near=a.goal&&Math.abs(diff)<=a.goal*0.05;
      return{title:'Calories · 7 days',value:a.avg.toLocaleString(),unit:' a day',
        sub:!a.goal?`${a.n} day${a.n===1?'':'s'} logged`:near?'On target':`${Math.abs(Math.round(diff/10)*10).toLocaleString()} ${diff<0?'under':'over'} target`,tone:calorieTone(a.avg,a.goal),
        spark:svgBars(days.map(d=>({v:d.logged&&d.goalCals?d.cals/d.goalCals:d.logged?1:null,tone:d.logged&&d.goalCals&&Math.abs(d.cals-d.goalCals)<=d.goalCals*0.05?'good':''})),{target:1})};
    }},
  protein:{title:'Protein',group:'Food',
    has:()=>foodDays(28).some(d=>d.logged),
    tile(){
      const days=foodDays(7);const a=foodAvg(days,'protein');
      if(!a)return{title:'Protein · 7 days',empty:'Log food to see your average against target.'};
      const diff=a.avg-a.goal;const short=a.goal&&diff<-a.goal*0.05;
      return{title:'Protein · 7 days',value:String(a.avg),unit:' g a day',
        sub:!a.goal?`${a.n} day${a.n===1?'':'s'} logged`:short?`${Math.abs(diff)} g short of ${a.goal}`:diff>a.goal*0.05?`${diff} g over ${a.goal}`:'On target',tone:!a.goal?'flat':short?'warn':'good',
        spark:svgBars(days.map(d=>({v:d.logged&&d.goalProtein?d.protein/d.goalProtein:d.logged?1:null,tone:d.logged&&d.goalProtein&&d.protein>=d.goalProtein*0.95?'good':''})),{target:1})};
    }},
  sessions:{title:'Sessions',group:'Training',
    has:()=>S.workouts.length>0||hasFixedSchedule(),
    tile(range){
      const wd=weekDays();const done=wd.filter(d=>d.state==='done').length;const plan=hasFixedSchedule()?wd.filter(d=>d.planned).length:null;
      const next=nextSessionLabel();const streak=getStreak();
      return{title:'Sessions',value:String(done),unit:plan?` of ${plan} this week`:' this week',
        sub:next?`Next: ${next}`:streak?`${streak}-day streak`:'Monday to Sunday',tone:plan&&done>=plan?'good':'flat',
        spark:svgBars(sessionWeeks(range).map(w=>({v:w.n,hollow:w.current})),{plan:plannedPerWeek()})};
    }},
  patterns:{title:'Patterns',group:'Training',wide:false,
    has:()=>S.workouts.length>=PAT.MIN*2,
    open:()=>showPatterns(),
    tile(){
      const res=patCached(()=>{if(S.tab==='progress'&&S.progView==='progress')boardRefresh();});
      if(!res)return{title:'Patterns',value:'…',unit:'',sub:'Working it out',tone:'flat',spark:''};
      const top=res.found[0];
      if(!res.tested)return{title:'Patterns',empty:'Keep logging: each pattern needs about eight sessions on each side.'};
      return{title:'Patterns',value:String(res.found.length),unit:` found of ${res.tested} tested`,
        sub:top?top.t:res.early.length?`${res.early.length} early sign${res.early.length===1?'':'s'}`:'Nothing clears the bar yet',tone:top?'good':'flat',spark:''};
    }},
  steps:{title:'Steps',group:'Training',
    has:()=>Object.keys(S.stepsLog||{}).some(k=>S.stepsLog[k]>0),
    tile(){
      const days=[];for(let i=6;i>=0;i--){const ds=daysAgoStr(i);days.push({ds,v:parseInt((S.stepsLog||{})[ds])||0,today:i===0});}
      const logged=days.filter(d=>d.v>0);
      if(!logged.length)return{title:'Steps · 7 days',empty:'Log your steps to see the week.'};
      const avg=Math.round(logged.reduce((t,d)=>t+d.v,0)/logged.length);
      return{title:'Steps · 7 days',value:avg.toLocaleString(),unit:' a day',sub:days[6].v?`Today: ${days[6].v.toLocaleString()}`:'Nothing logged today',tone:'flat',
        spark:svgBars(days.map(d=>({v:d.v||null,hollow:d.today})))};
    }},
  runpace:{title:'Pace',group:'Conditioning',param:'pace',
    has:()=>paceOptions().length>0,
    paramText:p=>{const o=pacePick(p);return o?o.label:'Choose';},
    tile(range,p){
      const opt=pacePick(p);if(!opt)return{title:'Pace',empty:'Log a run with its distance and time.'};
      const all=paceSeries(opt);const pts=paceSeries(opt,range.from);const last=all[all.length-1];
      const tr=paceTrend(opt,pts);
      let sub=opt.all?'One run so far':'One so far at this distance',tone='flat';
      if(tr){sub=tr.text;tone=tr.tone;}
      else if(pts.length>=2){const d=Math.round(pts[pts.length-1].v-pts[0].v);
        sub=Math.abs(d)<1?`Same as ${fmtDay(pts[0].ds)}`:`${Math.abs(d)} s ${d<0?'faster':'slower'} than ${fmtDay(pts[0].ds)}`;tone=d<0?'good':d>0?'warn':'flat';}
      else if(all.length>=2)sub=`Last on ${fmtDay(last.ds)}`;
      return{title:opt.all?'5K pace · all runs':`${opt.kind} pace · ${opt.short}`,value:fmtPace(last.v),unit:' a mile',sub,tone,spark:svgSpark(pts,{invert:true,fit:tr?tr.fit:null})};
    }},
  // The running tiles (running:true) show only while Running is on in Settings.
  runmiles:{title:'Weekly miles',group:'Conditioning',running:true,
    has:()=>runList().length>0,
    open:()=>showRunning(),
    tile:range=>runMilesTile(range)},
  runbest:{title:'Best efforts',group:'Conditioning',wide:true,running:true,
    has:()=>Object.keys(runBests()).length>0,
    open:()=>showRunning(),
    tile:()=>runBestTile()},
  runpred:{title:'Race predictor',group:'Conditioning',running:true,
    has:()=>!!runPredict(5000),
    open:()=>showRunning(),
    tile:()=>runPredTile()},
  runroutes:{title:'Routes',group:'Conditioning',wide:true,running:true,
    has:()=>(S.activities||[]).some(a=>a.rt),
    open:()=>showRoutes(),
    tile:()=>rvTileData()},
  runload:{title:'Training load',group:'Conditioning',running:true,
    has:()=>loadNow().total>0,
    open:()=>showRunning(),
    tile:()=>loadTile()},
  aft:{title:'Fitness test',group:'Conditioning',
    has:()=>!!S.testPlan||Object.values(S.aftCurrent||{}).some(v=>v!==''&&v!=null),
    tile(){
      const a=aftSummary(S.aftCurrent,aftColumn());
      const days=S.testPlan&&S.testPlan.date?daysBetween(today(),S.testPlan.date):null;
      const when=days!=null&&days>=0?(days===0?'test today':`test in ${days} day${days===1?'':'s'}`):'';
      // The countdown goes in the heading: beside "Passing" it wrapped the line on a half-width tile.
      const title='Fitness test'+(days!=null&&days>=0?(days===0?' · today':` · ${days} day${days===1?'':'s'}`):'');
      if(!a.n)return{title:'Fitness test',empty:when?`Enter your results. Your ${when}.`:'Enter your results to see your score.'};
      return{title,value:String(a.total),unit:' of 500',
        sub:a.complete?(a.pass?'Passing':'Below standard'):`${a.n} of 5 events`,tone:!a.complete?'flat':a.pass?'good':'bad',
        spark:svgMeter(a.total/500,(a.need||300)/500)};
    }},
};

// ═══ The board ═══
// Which tiles, in which order. Until it is edited, the board is the layout for the user's goal
// (so changing the goal changes the board); after that it is theirs.
const BOARD_DEFAULTS={
  strength:['lifts','weight','sessions','calories','protein','aft','runpace','runmiles','runroutes','records','patterns'],
  recomp:['weight','calories','protein','lifts','sessions','sets','measure','runmiles','runroutes','records','patterns'],
  weightloss:['weight','calories','maintenance','sessions','steps','protein','runpace','runmiles','runroutes','lifts','patterns'],
  general:['sessions','weight','lifts','calories','steps','runpace','runmiles','runroutes','records','patterns'],
};
const BOARD_MAX=20;
function defaultTiles(){
  const list=BOARD_DEFAULTS[S.goal]||BOARD_DEFAULTS.general;
  // A tile with nothing to show yet is left off the default board; the first three always show,
  // so a new user sees what the board is for.
  const have=list.filter(k=>METRICS[k].has());
  return(have.length>=3?have:list.filter((k,i)=>i<3||have.includes(k))).map(k=>({k}));
}
function boardCustom(){return isObj(S.board)&&Array.isArray(S.board.tiles);}
// A running tile is on the board only while Running is on. (Arranging the board while it is off
// saves the board without them; they can be added back from Edit once it is on again.)
function tileAllowed(k){const m=METRICS[k];return !!m&&(!m.running||runningOn());}
function boardTiles(){return(boardCustom()?S.board.tiles:defaultTiles()).filter(t=>tileAllowed(t.k));}
function cleanTile(t){
  if(!isObj(t)||!METRICS[t.k])return null;
  const o={k:t.k};
  if(t.k==='lifts'&&Array.isArray(t.ids))o.ids=[...new Set(t.ids.filter(x=>typeof x==='string'&&x).map(x=>x.slice(0,80)))].slice(0,6);
  if(t.k==='runpace'&&typeof t.type==='string'&&parseFloat(t.dist)>=0){o.type=t.type.slice(0,20);o.dist=Math.round(parseFloat(t.dist)*10)/10;} // dist 0 is "all runs"
  return o;
}
function normalizeBoard(v){
  const out={range:'12w',tiles:null};
  if(!isObj(v))return out;
  if(Array.isArray(v.offered))out.offered=v.offered.filter(k=>BOARD_OFFER.includes(k)).filter((k,i,a)=>a.indexOf(k)===i);
  if(RANGES.some(r=>r.id===v.range))out.range=v.range;
  if(Array.isArray(v.tiles)){
    const seen=new Set();
    out.tiles=v.tiles.map(cleanTile).filter(t=>t&&!seen.has(t.k)&&seen.add(t.k)).slice(0,BOARD_MAX);
  }
  return out;
}
// A board arranged by hand never changes by itself, so a widget that did not exist when it was
// arranged would stay hidden in Edit. For a board arranged before these existed, each is offered
// once: the first time there is something to show on it, it is added to the end. Taken off
// again, it stays off. A board arranged from now on already had them on offer and is left alone.
const BOARD_OFFER=['runmiles','runroutes'];
function boardAdopt(){
  if(!boardCustom()||!runningOn())return false;
  const seen=Array.isArray(S.board.offered)?S.board.offered:[];let changed=false;
  BOARD_OFFER.forEach(k=>{
    if(seen.includes(k)||!METRICS[k]||!METRICS[k].has())return;
    seen.push(k);changed=true;
    if(!S.board.tiles.some(t=>t.k===k)&&S.board.tiles.length<BOARD_MAX)S.board.tiles.push({k});
  });
  if(changed){S.board.offered=seen;save();}
  return changed;
}
function boardSet(tiles){
  S.board.tiles=tiles?tiles.map(cleanTile).filter(Boolean).slice(0,BOARD_MAX):null;
  if(tiles)S.board.offered=BOARD_OFFER.slice(); // arranged with these widgets already on offer: none is added behind the user's back
  save();
}
function boardMove(from,to){
  const t=boardTiles().slice();if(from<0||from>=t.length)return;
  to=Math.max(0,Math.min(t.length-1,to));if(to===from)return;
  const[x]=t.splice(from,1);t.splice(to,0,x);boardSet(t);
}
function boardRemove(k){boardSet(boardTiles().filter(t=>t.k!==k));}
function boardAdd(k){
  if(!METRICS[k])return;const t=boardTiles().slice();
  if(t.some(x=>x.k===k)||t.length>=BOARD_MAX)return;
  t.push({k});boardSet(t);
}
function boardTileParams(k,params){
  boardSet(boardTiles().map(t=>t.k===k?Object.assign({k},params):t));
}
