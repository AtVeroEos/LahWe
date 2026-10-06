// ═══════════════════════════════════════════════════
// ENERGY — BMR, session and activity calories, daily balance
// ═══════════════════════════════════════════════════
const LIFT_MET=4.5;                    // gross METs for resistance training
const MAX_SESSION_MS=3*3600000;        // nothing longer than this is credited as training
const IDLE_TAIL_MS=5*60000;            // time credited after the last logged set

function heightCm(){return(parseFloat(S.height)||69)*2.54;}
function ageFromRange(){
  const r=S.aftAge||'22-26';const m=r.match(/^(\d+)/);const lo=m?parseInt(m[1]):24;
  if(r.includes('+'))return lo+3;
  const hi=(r.match(/-(\d+)/)||[])[1];
  return hi?Math.round((lo+parseInt(hi))/2):lo;
}
// Real age from birth month/year when set; otherwise the midpoint of the stored bracket.
function userAge(){
  if(S.birthYear){
    const now=new Date();let a=now.getFullYear()-parseInt(S.birthYear);
    if(S.birthMonth&&now.getMonth()<(parseInt(S.birthMonth)-1))a--;
    return Math.max(13,Math.min(100,a));
  }
  return ageFromRange();
}
function bmr(){ // Mifflin-St Jeor
  const s=(S.aftGender==='female')?-161:5;
  return Math.round(10*bwKg()+6.25*heightCm()-5*userAge()+s);
}
function baselineBurn(){return Math.round(bmr()*1.2);} // sedentary full-day burn; logged exercise is added on top

// Time actually spent training. A session left open keeps "running", so the clock stops a few
// minutes after the last set that was checked off, and never exceeds MAX_SESSION_MS.
function workoutActiveMs(wk){
  const end=wk.ended||Date.now();
  let last=0;
  (wk.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(s=>{if(s.done&&s.t>last)last=s.t;}));
  let ms=end-wk.started;
  if(last)ms=Math.min(ms,last-wk.started+IDLE_TAIL_MS);
  return Math.max(0,Math.min(ms,MAX_SESSION_MS));
}
function sessionCals(ms){return Math.round(LIFT_MET*bwKg()*(Math.min(Math.max(0,ms),MAX_SESSION_MS)/3600000));}

// Estimated comfortable speed (mph) for distance-capable activities; walk scales with height.
function estSpeedMph(type){
  if(type==='walk'){const h=parseFloat(S.height)||69;return Math.max(2.3,Math.min(3.7,3.0*(h/69)));}
  return({run:6,bike:12,hike:2.5}[type])||3;
}
function estDistanceMi(type,durMin){return +(estSpeedMph(type)*(durMin/60)).toFixed(2);}
function estDurationMin(type,distMi){const sp=estSpeedMph(type)||3;return Math.round((distMi/sp)*60);}
function activityMets(act){
  if(parseFloat(act.mets)>0)return parseFloat(act.mets); // recorded with the activity (interval sessions)
  const t=ACT_TYPES.find(a=>a.id===act.type)||{mets:5};
  const dist=parseFloat(act.dist)||0,dur=parseFloat(act.dur)||0;
  // Walking pace materially changes burn — derive METs from actual pace when both are present.
  if(act.type==='walk'&&dist&&dur&&!act.durEst&&!act.distEst){
    const sp=dist/(dur/60);
    return sp<2.5?2.8:sp<3?3.3:sp<3.5?3.8:sp<4?4.3:5.0;
  }
  return t.mets;
}
function activityCals(act){
  const t=ACT_TYPES.find(a=>a.id===act.type)||{mets:5};
  if(act.type==='ruck'){
    // ~0.30 kcal per lb of total load per mile (already net of resting burn), scaled for terrain.
    const tf={flat:1,hilly:1.3,trail:1.2,mixed:1.15}[act.terrain||'flat']||1;
    return Math.round(0.30*(bwLb()+toLb(act.ruckWeight))*(parseFloat(act.dist)||0)*tf);
  }
  let dur=parseFloat(act.dur)||0;const dist=parseFloat(act.dist)||0;
  // If only distance given, estimate the time so we can still produce a kcal figure.
  if(!dur&&dist&&(t.fields||[]).includes('dist'))dur=estDurationMin(act.type,dist);
  return Math.round(activityMets(act)*bwKg()*(dur/60));
}
// Calories ON TOP of baseline. Logged figures are gross (they include what you'd have burned
// resting for that time anyway), and baseline already counts that hour — so take one MET back out.
function netOfRest(cals,mets){return mets>1?cals*(mets-1)/mets:cals;}
function dayExerciseCals(ds){
  const w=S.workouts.filter(wk=>dayOf(wk.started)===ds).reduce((t,wk)=>t+netOfRest(wk.cals||0,LIFT_MET),0);
  const a=S.activities.filter(x=>x.date===ds).reduce((t,x)=>t+(x.type==='ruck'?(x.cals||0):netOfRest(x.cals||0,activityMets(x))),0);
  return Math.round(w+a);
}
// Share of the day that has elapsed: 1 for past days, the time-of-day fraction for today.
function dayFraction(ds){
  const td=today();
  if(ds<td)return 1;
  if(ds>td)return 0;
  const n=new Date();
  return Math.max(0.01,(n.getHours()*3600+n.getMinutes()*60+n.getSeconds())/86400);
}
// Intake vs burn for a day. For today the baseline is prorated to the time of day, so a logged
// breakfast at 10am isn't compared against a full day's burn. `partial` marks an unfinished day.
function energyBalance(ds){
  const intake=Math.round(getDayTotals(ds).cals||0);
  const exercise=dayExerciseCals(ds);
  const fullBase=baselineBurn();const frac=dayFraction(ds);
  const base=Math.round(fullBase*frac);
  const burn=base+exercise;
  return{intake,exercise,base,fullBase,burn,net:intake-burn,partial:frac<1};
}
// kcal per unit of bodyweight change, in the user's unit.
function kcalPerWeightUnit(){return isKg()?7700:3500;}
