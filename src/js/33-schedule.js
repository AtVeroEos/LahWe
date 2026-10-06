// ═══════════════════════════════════════════════════
// SCHEDULE — training days, streak, timed programs, next routine
// ═══════════════════════════════════════════════════
// Training/rest days are derived from the active group's schedule (single source of truth).
// Per-day overrides set from the calendar still take precedence.
// Day-picker group: a day is "training" if any routine is assigned to that weekday.
// Rotation group / no group: no fixed weekday pattern exists, so every day is trainable
// (the calendar simply won't shade rest days in that case).
function isTrainingDay(ds){
  const sch=S.schedule;
  const ov=sch&&sch.overrides&&sch.overrides[ds];
  if(ov)return ov==='active';
  const rovRid=sch&&sch.routineOverrides&&sch.routineOverrides[ds];
  if(rovRid==='rest')return false;
  if(rovRid)return true;
  const g=getActiveGroup();
  if(g&&g.mode==='daypicker'){
    const dow=dayDate(ds).getDay();
    return(g.routineIds||[]).some(id=>((g.dayMap||{})[id]||[]).includes(dow));
  }
  return true;
}
function hasFixedSchedule(){
  const g=getActiveGroup();
  return !!(g&&g.mode==='daypicker'&&(g.routineIds||[]).some(id=>((g.dayMap||{})[id]||[]).length));
}
// Planned routine names for a given weekday, from the active day-picker group.
function plannedRoutinesForDow(dow){
  const g=getActiveGroup();if(!g||g.mode!=='daypicker')return[];
  return(g.routineIds||[]).filter(id=>((g.dayMap||{})[id]||[]).includes(dow))
    .map(id=>(S.routines||[]).find(r=>r.id===id)?.name).filter(Boolean);
}
function activeDaySet(){
  return new Set([...S.workouts.map(w=>dayOf(w.started)),...S.activities.map(a=>a.date)]);
}
// Number of training days in the current unbroken run. Rest days never break it:
//  - with a weekday schedule, the run ends only when a planned training day was missed;
//  - with a rotation (no fixed days), it ends after three idle days in a row.
// Today can't break a streak — the day isn't over yet.
function getStreak(){
  const act=activeDaySet();
  const fixed=hasFixedSchedule();
  const d=new Date();
  if(!act.has(dstr(d)))d.setDate(d.getDate()-1);
  let n=0,gap=0;
  for(let i=0;i<730;i++){
    const ds=dstr(d);
    if(act.has(ds)){n++;gap=0;}
    else if(fixed){if(isTrainingDay(ds))break;if(++gap>14)break;}
    else if(++gap>2)break;
    d.setDate(d.getDate()-1);
  }
  return n;
}

// ─── Today's routines ───
function wasRoutineDoneToday(rid){
  const td=today();
  return S.workouts.some(w=>w.routineId===rid&&dayOf(w.started)===td);
}
function getActiveGroup(){return(S.groups||[]).find(g=>g.active)||null;}
// ─── Timed programs: ordered phases, each a group running for N weeks or until a date ───
// Compute each phase's [start,end] date window. End is exclusive (next phase's start).
function programPhaseWindows(prog){
  const p=prog||S.program;if(!p||!p.phases||!p.phases.length||!p.startDate)return[];
  const out=[];let cursor=p.startDate;
  p.phases.forEach(ph=>{
    let end;
    if(ph.mode==='until'&&ph.untilDate){
      end=addDays(ph.untilDate,1); // inclusive of untilDate
      if(daysBetween(cursor,end)<1)end=addDays(cursor,1); // guard against past dates
    }else{
      const wks=Math.max(1,ph.weeks||1);
      end=addDays(cursor,wks*7);
    }
    out.push({groupId:ph.groupId,start:cursor,end,mode:ph.mode,weeks:ph.weeks,untilDate:ph.untilDate});
    cursor=end;
  });
  return out;
}
function currentProgramPhase(ds){
  ds=ds||today();
  const wins=programPhaseWindows();
  for(const w of wins){if(ds>=w.start&&ds<w.end)return w;}
  return null;
}
// Auto-activate the group the program says should be active today.
function resolveProgramGroup(){
  const p=S.program;if(!p||!p.active)return;
  const phase=currentProgramPhase(today());
  if(phase&&phase.groupId){
    const target=(S.groups||[]).find(g=>g.id===phase.groupId);
    if(target&&!target.active){
      (S.groups||[]).forEach(g=>g.active=(g.id===phase.groupId));
    }
  }
}
function getNextRoutine(){
  const ovRid=S.schedule&&S.schedule.routineOverrides&&S.schedule.routineOverrides[today()];
  if(ovRid==='rest')return null;
  if(ovRid){const r=(S.routines||[]).find(x=>x.id===ovRid);if(r)return r;}
  const g=getActiveGroup();if(!g||!(g.routineIds||[]).length)return null;
  if(g.mode==='rotation'){
    const ids=g.routineIds;const rid=ids[(g.cursor||0)%ids.length];
    return(S.routines||[]).find(r=>r.id===rid)||null;
  }
  const dow=new Date().getDay();
  const rid=(g.routineIds||[]).find(id=>((g.dayMap||{})[id]||[]).includes(dow));
  return rid?((S.routines||[]).find(r=>r.id===rid)||null):null;
}
