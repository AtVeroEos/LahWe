// ═══════════════════════════════════════════════════
// RECOVERY — an estimate of how fresh each muscle is
// ═══════════════════════════════════════════════════
// Every working set adds fatigue to the muscles it trains (the main one in full, helpers at half),
// weighted by how hard it was (reps in reserve, a failed set, the Hard and Easy tags). Fatigue halves
// every 18 hours for small muscles and every 26 for big ones, so a muscle trained hard is ready again
// in about two days if small and three if big: the usual 48 to 72 hours. Runs, rucks, rides and rows
// count toward the legs by their minutes. "Fresh" is 100% minus the fatigue against what a hard
// session leaves behind. It is an estimate from what you logged, not a measurement, and the app says so.
const RECOVERY_SMALL=new Set(['Biceps','Triceps','Forearms','Front Delts','Side Delts','Rear Delts','Calves','Abs','Obliques']);
const RECOVERY_HL={small:18,large:26}; // half-life, hours
const RECOVERY_HORIZON=7*24; // older sessions have faded to nothing that shows
// Hard sets that leave a muscle fully spent for the day.
const RECOVERY_CAP={Chest:10,Lats:10,Quads:10,Hamstrings:8,Glutes:8,Traps:8,'Lower Back':6};
// Set-equivalents per 10 minutes of each activity.
const RECOVERY_ACT={
  run:{Quads:0.8,Calves:1,Hamstrings:0.6,Glutes:0.6},
  ruck:{Quads:0.9,Glutes:0.7,Hamstrings:0.6,Calves:0.8,Traps:0.3,'Lower Back':0.3},
  hike:{Quads:0.5,Glutes:0.5,Calves:0.5,Hamstrings:0.3},
  walk:{Quads:0.2,Glutes:0.2,Calves:0.2},
  bike:{Quads:1,Glutes:0.4,Calves:0.3},
  row:{Lats:0.6,Quads:0.5,Hamstrings:0.3,Glutes:0.3,Biceps:0.2},
  sprint:{Quads:1,Hamstrings:1,Glutes:0.8,Calves:1},
};
function recoveryHalfLife(m){return RECOVERY_SMALL.has(m)?RECOVERY_HL.small:RECOVERY_HL.large;}
// Hours for a session that leaves the muscle spent to fade back to ready (85%).
function recoveryHours(m){return Math.round(recoveryHalfLife(m)*Math.log2(1/0.15));}
function recoveryCap(m){return RECOVERY_CAP[m]||8;}
// How hard one set was, relative to a set taken to about two reps in reserve.
function setStrain(s){
  if(s.rir!=null&&s.rir!=='')return 1+(2-Math.min(4,Math.max(0,parseInt(s.rir)||0)))*0.15;
  if(s.fail)return 1.3;
  if(s.tag==='Hard')return 1.15;
  if(s.tag==='Easy')return 0.8;
  return 1;
}
// {muscle:{fresh:0-100, fatigue, last:timestamp|null, readyAt:timestamp|null}}
function recoveryState(now){
  now=now||Date.now();
  return memo('recovery:'+Math.floor(now/600000),()=>{
    const out={};Object.keys(MEV_MAV).forEach(m=>{out[m]={fresh:100,fatigue:0,last:null,readyAt:null};});
    const horizon=now-RECOVERY_HORIZON*3600000;
    const add=(m,amount,at)=>{
      const o=out[m];if(!o)return;
      o.fatigue+=amount*Math.pow(0.5,(now-at)/(recoveryHalfLife(m)*3600000));
      if(!o.last||at>o.last)o.last=at;
    };
    S.workouts.forEach(wk=>{
      if(wk.started<horizon||wk.started>now)return;
      const at=wk.ended||wk.started;
      wk.exercises.forEach(ex=>{
        if(ex.cardio)return; // counted from the activity it saved
        const strain=ex.sets.filter(setCounts).reduce((t,s)=>t+setStrain(s),0);if(!strain)return;
        muscleContribs(ex.exId).forEach(c=>add(c.muscle,strain*c.w,at));
      });
    });
    (S.activities||[]).forEach(a=>{
      const per=RECOVERY_ACT[a.type];if(!per)return;
      const at=dayDate(a.date).getTime();if(at<horizon||at>now)return;
      const min=parseFloat(a.dur)||0;if(!min)return;
      Object.keys(per).forEach(m=>add(m,per[m]*min/10,at));
    });
    Object.keys(out).forEach(m=>{
      const o=out[m];const cap=recoveryCap(m);
      o.fresh=Math.round(100*(1-Math.min(1,o.fatigue/cap)));
      // Every session fades at the same rate, so the total does too: solve for when it is down to 15% of a spent muscle.
      if(o.fresh<85&&o.fatigue>0)o.readyAt=now+recoveryHalfLife(m)*3600000*Math.log2(o.fatigue/(0.15*cap));
    });
    return out;
  });
}
function freshStatus(f){return f<50?'tired':f<85?'mid':'ready';}
function fmtReady(ts){
  if(!ts)return'';const h=(ts-Date.now())/3600000;
  if(h<=0)return'now';
  const at=new Date(ts);const td=new Date();const days=Math.round((new Date(at.getFullYear(),at.getMonth(),at.getDate())-new Date(td.getFullYear(),td.getMonth(),td.getDate()))/86400000);
  if(days<=0)return h<=3?'in a few hours':'tonight';
  if(days===1)return'tomorrow';
  return`in ${days} days`;
}
// The muscles a workout trains that are still well short of fresh.
function routineFatigue(r){
  if(!r)return[];
  const rec=recoveryState();const seen={};
  (r.exercises||[]).forEach(e=>{muscleContribs(e.exId).forEach(c=>{if(c.w>=1)seen[c.muscle]=true;});});
  return Object.keys(seen).map(m=>({m,fresh:rec[m].fresh,readyAt:rec[m].readyAt})).filter(x=>x.fresh<60).sort((a,b)=>a.fresh-b.fresh);
}
