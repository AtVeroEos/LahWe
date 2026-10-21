// ═══════════════════════════════════════════════════
// COACH — the data sheet, and one tool that reads any of it as a table
// ═══════════════════════════════════════════════════
// Every table below is a flat, read-only view built from the app's own helpers, so the coach sees
// the numbers the screens show. The model picks a table, a date range and filters; grouping and
// sums are done here, in code — the model never adds up rows itself.
// The same definitions are the data sheet: describe:true returns them, and tools/data-sheet.js
// writes them to docs/coach-data-sheet.md (a test fails if that file falls behind this one).
// Not in any table, on purpose: API keys and sign-ins (never in S), coach notes (already in CONTEXT),
// progress photos, route GPS points, past coach chats.
const QD_DEFAULT_ROWS=50,QD_MAX_ROWS=200,QD_CHARS=11000,QD_TEXT=120;
const QD_OPS=['=','!=','>','>=','<','<=','contains','in'];
const QD_FNS=['count','distinct','sum','avg','min','max','first','last'];
const QD_DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── Formulas (the "how is this number made" half of the sheet) ───
const COACH_FORMULAS=[
  {name:'working_set',used_for:'sets, workouts, daily',how:'A set counts when it is ticked done and is not a warm-up. Failed sets count as work but never as a record.'},
  {name:'e1rm',used_for:'sets, records, Progress lift charts',how:'Estimated one-rep max, Epley: weight × (1 + reps ÷ 30); a single is the weight itself. Only working sets with a weight and reps; not timed, cardio, assisted, failed or excluded sets.'},
  {name:'volume',used_for:'workouts, daily, month_reports',how:'Weight × reps summed over working sets. Timed, distance and cardio exercises add nothing.'},
  {name:'hard_sets_per_muscle',used_for:'Progress hard-sets tile, get_training_summary',how:'Each working set counts 1 toward its exercise\'s primary muscle and 0.5 toward each secondary muscle. Weekly minimum and maximum per muscle come from the app\'s own table.'},
  {name:'weight_trend',used_for:'get_body, week_review',how:'A straight line fitted through the weigh-ins of the last 28 days; needs two or more readings at least three days apart. Reported as change per week.'},
  {name:'maintenance_from_logs',used_for:'get_body, get_profile, Nutrition → Weight and maintenance',how:'Average logged intake over the last 28 days, adjusted by the weight trend over the same days (about 3,500 kcal per lb). Needs 4+ weigh-ins over 14+ days and food logged on 70% of days (at least 10). Days under half the median are left out as partly logged. Comes with a 95% margin.'},
  {name:'maintenance_estimate',used_for:'get_profile, until maintenance_from_logs is available',how:'BMR (Mifflin-St Jeor) × 1.2, plus the calories of exercise logged over the last 7 days.'},
  {name:'calorie_floor',used_for:'propose_targets',how:'Targets are never set below 1,500 kcal a day for a man or 1,200 for a woman.'},
  {name:'recovery',used_for:'recovery',how:'Each working set adds fatigue to the muscles it works (1 per set, more with little in reserve or a Hard tag, less when Easy). Fatigue halves every 18 hours for small muscles and 26 for large ones. Fresh = 100 × (1 − fatigue ÷ the muscle\'s cap). Ready when it is back to 85%.'},
  {name:'training_load',used_for:'activities, Running page',how:'Minutes × effort (1-5). Effort comes from average heart rate against max, else pace against the usual 5K pace, else a typical value for the kind of activity. The last 7 days are compared with the 28-day weekly average.'},
  {name:'race_predictor',used_for:'run_bests',how:'Riegel: time₂ = time₁ × (distance₂ ÷ distance₁)^1.06, from runs in the last 12 weeks (26 if none), using efforts at least a fifth of the target distance; the fastest answer wins.'},
  {name:'habit_streak_and_strength',used_for:'habit_days, get_habits_and_mood',how:'A streak survives one missed scheduled day; two misses in a row end it. Strength is a weighted share of scheduled days kept, where a day\'s weight halves every 13 scheduled days.'},
  {name:'patterns',used_for:'patterns',how:'Each test compares the user\'s own results when something happened against when it did not, measured against their own trend. A finding needs about 10 cases on each side, must hold in both halves of the history and survive a correction for the number of tests. Wording is "tends to", never "causes".'},
  {name:'program_adherence',used_for:'programs, program_weeks',how:'Workouts done ÷ workouts planned, over finished weeks of the program. A week\'s rating is the average end-of-workout rating (1-5).'},
  {name:'next_session_target',used_for:'targets',how:'Add reps inside the range; add weight once every set reaches the top; repeat after missed reps or a session tagged hard; about 10% lighter after a pain tag or three stalled sessions. A coach-set target replaces the rule until that workout is done.'},
  {name:'strength_standards',used_for:'get_records',how:'Estimated max against multiples of body weight for each main lift: Beginner, Novice, Intermediate, Advanced, Elite.'},
];

// ─── Small helpers ───
function qdText(v){return v==null||v===''?null:String(v).replace(/\s+/g,' ').trim().slice(0,QD_TEXT);}
function qdN(v){const n=parseFloat(v);return isFinite(n)?n:null;}
function qdDays(from,to){const out=[];for(let ds=from;ds<=to&&out.length<1200;ds=addDays(ds,1))out.push(ds);return out;}
// 'today' | 'yesterday' | 'YYYY-MM-DD' | '90' (days back) | '+14' (days ahead) → a day key, or {error}
function qdDay(v,ahead){
  const s=String(v==null?'':v).trim().toLowerCase();
  let ds;
  if(s==='today')ds=today();
  else if(s==='yesterday')ds=daysAgoStr(1);
  else if(/^\+\d{1,3}d?$/.test(s))ds=addDays(today(),parseInt(s.slice(1)));
  else if(/^-?\d{1,4}d?$/.test(s))ds=daysAgoStr(Math.abs(parseInt(s)));
  else if(/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(dayDate(s).getTime())&&dstr(dayDate(s))===s)ds=s;
  else return{error:`"${String(v).slice(0,20)}" is not a date. Use YYYY-MM-DD, today, yesterday, or a number of days back such as 90.`};
  if(!ahead&&ds>today())ds=today();
  return{date:ds};
}
function qdWorkoutsIn(from,to){return S.workouts.filter(w=>{const d=dayOf(w.started);return d>=from&&d<=to;});}
function qdMuscle(exId){const e=getEx(exId);return e?normMuscle(e.muscle||'')||null:null;}

// ─── The tables ───
// cols: name → meaning (the sheet). rows(from,to) → [{…}]. dated: has a date column the range
// applies to. logs: hidden when "Read my logs" is off. ahead: the range may run into the future.
const QD_TABLES={
  daily:{dated:true,logs:true,about:'One row per day, with everything logged that day side by side.',where:'Home check-in, Nutrition, Progress → Calendar',
    cols:{date:'YYYY-MM-DD',trained:'true if a workout was finished',sessions:'workouts finished',working_sets:'working sets done',volume:'weight × reps',workout_minutes:'active minutes of workouts',
      feel:'average end-of-workout rating, 1-5',cardio_minutes:'minutes of activities',miles:'miles of activities',kcal:'calories eaten (null when nothing logged)',protein_g:'protein eaten',carbs_g:'carbs eaten',fat_g:'fat eaten',
      target_kcal:'that day\'s calorie target',target_protein_g:'that day\'s protein target',day_kind:'training or rest (picks the targets)',meals_logged:'meals logged',
      weight:'weigh-in (null when none)',sleep_h:'hours slept the night before',mood:'mood rating 1-5',steps:'steps',habits_kept:'habits kept',habits_due:'habits due (kept + missed)',
      supplements_taken:'supplements ticked',paused:'true on a paused day (sick, travel, field duty)',planned_training_day:'true/false with a fixed weekly schedule, null with a rotation'},
    rows(from,to){
      const byW={},byA={};
      qdWorkoutsIn(from,to).forEach(w=>{(byW[dayOf(w.started)]=byW[dayOf(w.started)]||[]).push(w);});
      (S.activities||[]).forEach(a=>{if(a.date>=from&&a.date<=to)(byA[a.date]=byA[a.date]||[]).push(a);});
      const bw={};(S.bodyweightLog||[]).forEach(b=>{if(b.date>=from&&b.date<=to&&bw[b.date]==null)bw[b.date]=b.weight;});
      const fixed=hasFixedSchedule();const hs=S.habits||[];
      return qdDays(from,to).map(ds=>{
        const ws=byW[ds]||[],as=byA[ds]||[];const t=getDayTotals(ds);const eaten=t.cals>0||t.protein>0;const g=goalsFor(ds);
        const feels=ws.map(w=>w.feel).filter(f=>f>=1&&f<=5);
        let kept=0,due=0;hs.forEach(h=>{const x=habitDay(h,ds);if(x.st==='done'){kept++;due++;}else if(x.st==='miss')due++;});
        const sl=(S.suppLogs||{})[ds]||{};
        return{date:ds,trained:ws.length>0,sessions:ws.length,working_sets:ws.reduce((n,w)=>n+doneSetCnt(w),0),volume:Math.round(ws.reduce((n,w)=>n+totalVol(w),0)),
          workout_minutes:Math.round(ws.reduce((n,w)=>n+workoutActiveMs(w),0)/60000),feel:feels.length?r1(feels.reduce((a,b)=>a+b,0)/feels.length):null,
          cardio_minutes:Math.round(as.reduce((n,a)=>n+actSec(a)/60,0)),miles:r1(as.reduce((n,a)=>n+(parseFloat(a.dist)||0),0)),
          kcal:eaten?t.cals:null,protein_g:eaten?t.protein:null,carbs_g:eaten?t.carbs:null,fat_g:eaten?t.fat:null,
          target_kcal:g.cals,target_protein_g:g.protein,day_kind:dayKind(ds)==='rest'?'rest':'training',meals_logged:t.mealCount,
          weight:bw[ds]!=null?bw[ds]:null,sleep_h:(S.sleepLog||{})[ds]!=null?S.sleepLog[ds]:null,mood:(S.moodLog||{})[ds]||null,
          steps:(S.stepsLog||{})[ds]!=null?qdN(S.stepsLog[ds]):null,habits_kept:hs.length?kept:null,habits_due:hs.length?due:null,
          supplements_taken:(S.supps||[]).length?S.supps.filter(s=>sl[s.id]).length:null,paused:isPaused(ds),planned_training_day:fixed?isTrainingDay(ds):null};
      });
    }},
  workouts:{dated:true,logs:true,about:'One row per finished workout.',where:'Progress → History',
    cols:{id:'workout id',date:'YYYY-MM-DD',name:'workout name',routine:'the routine it came from, if any',program:'the program it counted toward, if any',minutes:'start to finish',
      working_sets:'working sets',volume:'weight × reps',exercises:'exercises done',kcal:'estimated calories',feel:'end-of-workout rating, 1-5',notes:'the user\'s note'},
    rows(from,to){
      return qdWorkoutsIn(from,to).map(w=>{const r=w.routineId?S.routines.find(x=>x.id===w.routineId):null;const p=w.prog?programById(w.prog.id):null;
        return{id:w.id,date:dayOf(w.started),name:w.name,routine:r?r.name:null,program:p?p.name:null,minutes:w.ended?Math.round((w.ended-w.started)/60000):null,
          working_sets:doneSetCnt(w),volume:Math.round(totalVol(w)),exercises:w.exercises.filter(e=>e.sets.some(setCounts)).length,kcal:w.cals||0,feel:w.feel||null,notes:qdText(w.notes)};});
    }},
  sets:{dated:true,logs:true,about:'One row per working set (warm-ups left out).',where:'Progress → History → a workout',
    cols:{date:'YYYY-MM-DD',workout:'workout name',workout_id:'workout id',exercise:'exercise name',ex_id:'exercise id',muscle:'primary muscle',equipment:'equipment',set:'set number within the exercise',
      weight:'weight in the user\'s unit (0 = bodyweight)',reps:'reps',seconds:'held for, on timed sets',e1rm:'estimated max from this set (see formulas)',rir:'reps left in reserve, when logged',
      tag:'Easy, Hard, Pain or Form Issue, when tagged',failed:'true if the set was failed',excluded:'true if left out of records'},
    rows(from,to){
      const out=[];
      qdWorkoutsIn(from,to).forEach(w=>{const ds=dayOf(w.started);
        w.exercises.forEach(ex=>{const info=getEx(ex.exId);let n=0;
          ex.sets.forEach(s=>{if(!setCounts(s))return;n++;const c=prCandidate(ex,s);
            out.push({date:ds,workout:w.name,workout_id:w.id,exercise:info?info.name:'Unknown exercise',ex_id:ex.exId,muscle:qdMuscle(ex.exId),equipment:info?info.eq:null,set:n,
              weight:ex.timed||ex.cardio?null:(qdN(s.w)||0),reps:ex.timed?null:qdN(s.r),seconds:ex.timed?qdN(s.r):null,e1rm:c?c.est:null,
              rir:s.rir==null||s.rir===''?null:qdN(s.rir),tag:s.tag||null,failed:!!s.fail,excluded:!!s.excl});});});});
      return out;
    }},
  records:{dated:false,logs:true,about:'One row per exercise with a personal record.',where:'Progress → New records tile',
    cols:{exercise:'exercise name',ex_id:'exercise id',muscle:'primary muscle',weight:'weight of the record set',reps:'reps of the record set',e1rm:'estimated max',date:'when it was set',carried_over:'true if typed in by hand rather than logged'},
    rows(){return Object.keys(S.prs||{}).filter(id=>S.prs[id]&&getEx(id)).map(id=>{const p=S.prs[id];return{exercise:exName(id),ex_id:id,muscle:qdMuscle(id),weight:qdN(p.w),reps:qdN(p.r),e1rm:qdN(p.est),date:p.date||null,carried_over:!!p.manual};});}},
  meals:{dated:true,logs:true,about:'One row per logged meal.',where:'Nutrition',
    cols:{id:'meal id',date:'YYYY-MM-DD',meal:'Breakfast, Lunch, Dinner, Snack…',name:'saved-meal name, if any',kcal:'calories',protein_g:'protein',carbs_g:'carbs',fat_g:'fat',items:'foods in it',estimate:'true if any part is an estimate'},
    rows(from,to){return(S.meals||[]).filter(m=>m.date>=from&&m.date<=to).map(m=>({id:m.id,date:m.date,meal:m.type,name:m.savedMealName||null,kcal:Math.round(m.cals||0),protein_g:r1(m.protein||0),carbs_g:r1(m.carbs||0),fat_g:r1(m.fat||0),items:(m.items||[]).length,estimate:!!m.est||(m.items||[]).some(i=>i.est)}));}},
  meal_items:{dated:true,logs:true,about:'One row per food inside a logged meal.',where:'Nutrition → a meal',
    cols:{date:'YYYY-MM-DD',meal:'meal slot',meal_id:'meal id',food:'food name',food_id:'food id (null for a typed-in food)',servings:'servings eaten',serving:'serving size',kcal:'calories for the amount eaten',protein_g:'protein for the amount eaten',carbs_g:'carbs',fat_g:'fat',estimate:'true if an estimate'},
    rows(from,to){const out=[];(S.meals||[]).filter(m=>m.date>=from&&m.date<=to).forEach(m=>(m.items||[]).forEach(i=>out.push({date:m.date,meal:m.type,meal_id:m.id,food:i.name,food_id:i.foodId||null,servings:qdN(i.qty),serving:i.serving||null,kcal:Math.round(i.cals||0),protein_g:r1(i.protein||0),carbs_g:r1(i.carbs||0),fat_g:r1(i.fat||0),estimate:!!i.est})));return out;}},
  measurements:{dated:true,logs:true,about:'One row per body measurement taken.',where:'Progress → measurement tile',
    cols:{date:'YYYY-MM-DD',part:'what was measured (waist, chest…)',value:'the measurement',unit:'in or cm'},
    rows(from,to){const out=[];(S.measurements||[]).filter(m=>m.date>=from&&m.date<=to).forEach(m=>Object.keys(m.values||{}).forEach(k=>{const v=qdN(m.values[k]);if(v!=null)out.push({date:m.date,part:k,value:v,unit:S.measureUnit});}));return out;}},
  activities:{dated:true,logs:true,about:'One row per activity (run, ruck, bike, hike, swim, walk…).',where:'Progress → History; Running page',
    cols:{id:'activity id',date:'YYYY-MM-DD',type:'kind of activity',minutes:'duration',miles:'distance',pace_min_per_mile:'minutes per mile (runs, rucks, walks, hikes)',kcal:'estimated calories',
      avg_hr:'average heart rate, from a recording',climb_ft:'feet climbed, from a recording',shoe:'shoes, from Strava',load:'training load (see formulas)',estimated:'true if the distance or time was estimated',notes:'the user\'s note'},
    rows(from,to){
      const ctx=loadContext();
      return(S.activities||[]).filter(a=>a.date>=from&&a.date<=to).map(a=>{const min=actSec(a)/60,mi=parseFloat(a.dist)||0;const l=actLoad(a,ctx);
        return{id:a.id,date:a.date,type:a.type,minutes:min?r1(min):null,miles:mi?r1(mi):null,pace_min_per_mile:mi&&min&&SHOE_TYPES.includes(a.type)?Math.round(min/mi*100)/100:null,kcal:a.cals||0,
          avg_hr:a.rt&&a.rt.hr||null,climb_ft:a.rt&&a.rt.up?Math.round(a.rt.up*M_TO_FT):null,shoe:a.gear||null,load:l?Math.round(l.load):null,estimated:!!(a.distEst||a.durEst),notes:qdText(a.notes)};});
    }},
  habit_days:{dated:true,logs:true,about:'One row per habit per day it was due.',where:'Home → Habits',
    cols:{date:'YYYY-MM-DD',habit:'habit name',kind:'done, amount, avoid or auto',status:'done, miss (due and not kept), blank (nothing logged that day) or open (today, still to do)',amount:'amount reached (amount habits)',target:'daily target (amount habits)',archived:'true if the habit is archived'},
    rows(from,to){const out=[];(S.habits||[]).forEach(h=>{const name=h.type==='auto'?habitAutoName(h):h.name;qdDays(from<h.from?h.from:from,to).forEach(ds=>{const d=habitDay(h,ds);if(d.st==='off')return;
      out.push({date:ds,habit:name,kind:h.type,status:d.st,amount:d.v!=null?d.v:null,target:h.target||null,archived:!!h.archived});});});return out;}},
  supplements:{dated:true,logs:true,about:'One row per supplement per day.',where:'Nutrition → Supplements',
    cols:{date:'YYYY-MM-DD',supplement:'name',dose:'dose as typed',taken:'true if ticked that day'},
    rows(from,to){const out=[];const sp=S.supps||[];if(!sp.length)return out;qdDays(from,to).forEach(ds=>{const l=(S.suppLogs||{})[ds]||{};sp.forEach(s=>out.push({date:ds,supplement:s.name,dose:s.dose||null,taken:!!l[s.id]}));});return out;}},
  patterns:{dated:false,logs:true,about:'One row per relationship the Patterns engine tested in the user\'s own log. The only source for "X goes with Y".',where:'Progress → Patterns',
    cols:{finding:'what was found, in the app\'s words (null when nothing was found)',test:'what was tested',family:'area (Recovery, Fuel, Sleep, Habits…)',tier:'solid, likely, early (a lead, not a finding), none (tested, nothing found) or more (needs more days)',cases:'cases it rests on',lift:'the lift it is about, if any',have:'cases so far (tier more)',need:'cases needed on each side (tier more)'},
    rows(){
      let res;try{res=patterns();}catch(e){return[];}
      const tname=r=>{const t=r.test;const o={lift:'lifts',weight:'scale weight',mood:'mood',pace:'run pace'}[t.out]||t.out||'';
        return t.a?`${o} ${t.a}${t.b?' vs '+t.b:''}`.trim():t.id;};
      const row=(r,tier)=>({finding:r.t||null,test:tname(r),family:PAT_FAM[r.test.fam]||r.test.fam||null,tier,cases:r.n!=null?r.n:null,lift:r.test.lift?exName(r.test.lift):null,
        have:tier==='more'?Math.min(r.na||0,r.nb||0):null,need:tier==='more'?r.min||null:null});
      return[...res.found.map(r=>row(r,r.tier)),...res.early.map(r=>row(r,'early')),...res.none.map(r=>row(r,'none')),...res.more.map(r=>row(r,'more'))];
    }},
  programs:{dated:false,logs:true,about:'One row per saved program.',where:'Library → Splits',
    cols:{name:'program name',status:'saved, running, paused, finished or archived',week:'current program week',of_weeks:'weeks in the program',sessions:'workouts counted toward it',adherence_pct:'workouts done ÷ planned over finished weeks',avg_feel:'average end-of-workout rating',first:'first workout date',last:'last workout date',finish_by:'expected last day if it keeps running'},
    rows(){return(S.programs||[]).map(p=>{const st=progState(p);return{name:p.name,status:p.status,week:p.status==='saved'?null:st.week,of_weeks:st.total,sessions:st.sessions,adherence_pct:st.adherence!=null?Math.round(st.adherence*100):null,
      avg_feel:st.feel!=null?r1(st.feel):null,first:st.first?dayOf(st.first.started):null,last:st.last?dayOf(st.last.started):null,finish_by:st.finish||null};});}},
  program_weeks:{dated:false,logs:true,about:'One row per trained week of each program.',where:'Library → Splits → a program',
    cols:{program:'program name',week:'program week',week_of:'first day of that calendar week',split:'the split in use that week',planned:'workouts planned',done:'workouts done',avg_feel:'average end-of-workout rating',deload:'true on a deload week',current:'true for this week'},
    rows(){const out=[];(S.programs||[]).forEach(p=>{const st=progState(p);st.weeks.forEach(w=>{const ph=(p.phases||[])[w.phase];const g=ph?progGroup(ph):null;
      out.push({program:p.name,week:w.n,week_of:w.mon,split:g?g.name:null,planned:w.planned,done:w.done,avg_feel:w.feel!=null?r1(w.feel):null,deload:w.deload,current:w.current});});});return out;}},
  recovery:{dated:false,logs:true,about:'One row per muscle: how recovered it is right now.',where:'Progress → hard sets tile → recovery map',
    cols:{muscle:'muscle',fresh_pct:'0-100 (see formulas)',status:'ready, mid or tired',last_trained:'last day it was worked',ready_at:'when it should be back to 85%'},
    rows(){const st=recoveryState();return Object.keys(st).map(m=>{const o=st[m];return{muscle:m,fresh_pct:o.fresh,status:freshStatus(o.fresh),last_trained:o.last?dayOf(o.last):null,ready_at:o.readyAt?new Date(o.readyAt).toISOString().slice(0,16).replace('T',' '):null};});}},
  run_weeks:{dated:true,logs:true,about:'One row per calendar week from the first run: miles run.',where:'Running page',
    cols:{date:'first day of the week',miles:'miles run',runs:'runs',longest_mi:'longest run',jump_pct:'% over the four weeks before, when the app flags a sudden jump'},
    rows(from,to){const ws=runWeeksAll();return ws.map((w,i)=>{const j=runJumpAt(ws,i);return{date:w.mon,miles:r1(w.mi),runs:w.n,longest_mi:r1(w.long),jump_pct:j?j.pct:null};}).filter(r=>r.date>=weekStartOf(from)&&r.date<=to);}},
  run_bests:{dated:false,logs:true,about:'One row per standard distance: best effort and predicted time.',where:'Running page; Progress → Best efforts, Race predictor',
    cols:{distance:'Mile, 2 mi, 5K, 10K, Half',best:'best time (h:mm:ss)',best_seconds:'best time in seconds',best_date:'when',whole_run:'true if the whole run was that distance (not a stretch of a longer one)',predicted:'predicted time on current form',predicted_from:'which run the prediction comes from'},
    rows(){const b=runBests();return RUN_DISTS.map(d=>{const x=b[d.id];const p=runPredict(d.m);return{distance:d.short,best:x?fmtClock(x.sec):null,best_seconds:x?x.sec:null,best_date:x?x.ds:null,whole_run:x?x.whole:null,
      predicted:p?fmtClock(p.sec):null,predicted_from:p?`${runDistName(p.m)} in ${fmtClock(p.src)} on ${p.ds}`:null};});}},
  shoes:{dated:false,logs:true,about:'One row per pair of shoes named on imported activities.',where:'Running page → Shoes',
    cols:{name:'shoe name',miles:'miles on them',runs:'activities',first:'first used',last:'last used',retired:'true if retired',worn:'true once past the replace-soon mileage'},
    rows(){return shoeList().map(s=>({name:s.name,miles:r1(s.mi),runs:s.n,first:s.first,last:s.last,retired:s.retired,worn:s.worn}));}},
  schedule:{dated:true,ahead:true,logs:false,about:'One row per day: what is planned and what was done. The range may run ahead; the default is the next 14 days.',where:'Home → Schedule',
    cols:{date:'YYYY-MM-DD',planned_training:'true/false with a fixed weekly schedule or an override, null with a rotation',planned:'routines pinned to that day or set for it',override:'rest or active when the day was changed by hand',paused:'true on a paused day',done:'workouts finished that day'},
    rows(from,to){
      const sch=S.schedule||{};const fixed=hasFixedSchedule();const td=today();
      return qdDays(from,to).map(ds=>{const ov=(sch.overrides||{})[ds]||null;const rov=(sch.routineOverrides||{})[ds]||null;
        const rr=rov&&rov!=='rest'?S.routines.find(r=>r.id===rov):null;
        const planned=rr?[rr.name]:rov==='rest'||isPaused(ds)?[]:plannedRoutinesForDow(dayDate(ds).getDay());
        return{date:ds,planned_training:fixed||ov||rov?isTrainingDay(ds):null,planned:planned.join(', ')||null,override:ov||(rov==='rest'?'rest':null),paused:isPaused(ds),
          done:ds<=td?S.workouts.filter(w=>dayOf(w.started)===ds).map(w=>w.name).join(', ')||null:null};});
    }},
  pauses:{dated:false,logs:false,about:'One row per pause (days when nothing is expected).',where:'Settings → Pause',
    cols:{from:'first day',to:'last day (null = still on)',why:'sick, travel, field or other'},
    rows(){return(S.pauses||[]).map(p=>({from:p.from,to:p.to||null,why:p.why}));}},
  targets:{dated:false,logs:true,about:'One row per lift in each active routine: what to aim for next session.',where:'Home → Targets; during a workout',
    cols:{routine:'routine name',exercise:'exercise',aim_weight:'weight to aim for (0 = bodyweight)',aim_reps:'reps (or seconds) to aim for',sets:'working sets',change:'up, down, hold or reps',by:'rule or coach',why:'the reason given',last_time:'top set last time'},
    rows(){const out=[];(S.routines||[]).filter(r=>r.active!==false).forEach(r=>routineTargets(r.id).forEach(t=>{const a=t.aim;if(!a)return;
      out.push({routine:r.name,exercise:t.name,aim_weight:qdN(a.w),aim_reps:qdN(a.r),sets:a.sets||null,change:a.kind||null,by:a.by||'rule',why:qdText(a.why),last_time:a.from?(a.from.w>0?`${a.from.w} x ${a.from.r}`:`${a.from.r}`):null});}));return out;}},
  test_plan:{dated:false,logs:true,about:'One row per Army Fitness Test event in the test-date plan (empty with no plan).',where:'Progress → Army Fitness Test tile → test-date plan',
    cols:{test_date:'the test day',week:'plan week now',of_weeks:'weeks in the plan',phase:'current phase',event:'event',start:'result when the plan began',now:'latest result',aim_this_week:'checkpoint for this week',goal:'goal',status:'on, behind, met, untested, nostart or nogoal'},
    rows(){const pc=testPlanCalc();if(!pc)return[];return pc.events.map(e=>({test_date:pc.date,week:pc.week,of_weeks:pc.weeks,phase:pc.phase?pc.phase.label||pc.phase.id:null,event:e.name,
      start:e.from!=null?aftFmtRaw(e.id,e.from):null,now:e.now!=null?aftFmtRaw(e.id,e.now):null,aim_this_week:e.aim!=null?aftFmtRaw(e.id,e.aim):null,goal:e.goal!=null?aftFmtRaw(e.id,e.goal):null,status:e.status}));}},
  month_reports:{dated:true,logs:true,about:'One row per calendar month: the monthly report\'s numbers. Group nothing; the range picks the months.',where:'Progress → monthly report',
    cols:{date:'first day of the month',month:'YYYY-MM',sessions:'workouts',per_week:'workouts a week',active_days:'days with a workout or activity',working_sets:'working sets',volume:'weight × reps',
      avg_kcal:'average calories on logged days',avg_protein_g:'average protein on logged days',food_days:'days with food logged',weight_change:'first to last weigh-in of the month',
      avg_feel:'average end-of-workout rating',avg_mood:'average mood',cardio_minutes:'activity minutes',records:'new records',top_lifts:'most-done lifts'},
    rows(from,to){const out=[];const first=repFirstDay();
      for(let m=from.slice(0,7);m<=to.slice(0,7)&&out.length<60;m=addDays(m+'-28',7).slice(0,7)){
        if(first&&m<first.slice(0,7))continue;const r=periodReport('month',m);
        out.push({date:m+'-01',month:m,sessions:r.cur.sessions,per_week:r.perWeek,active_days:r.activeDays,working_sets:r.cur.sets,volume:Math.round(r.cur.vol),avg_kcal:r.cur.cals,avg_protein_g:r.cur.protein,food_days:r.cur.foodDays,
          weight_change:r.bwChange?r.bwChange.d:null,avg_feel:r.feel!=null?r1(r.feel):null,avg_mood:r.mood?r1(r.mood.avg):null,cardio_minutes:r.cardioMin,records:(r.records||[]).length,top_lifts:r.favs.map(f=>f.name).join(', ')||null});}
      return out;}},
  week_review:{dated:false,logs:true,about:'Week in review as it stands now: the headline and each point (the last 7 full days against the 7 before).',where:'Home → week card',
    cols:{kind:'headline or point',tone:'good, warn, bad or info',title:'the line',detail:'the detail under it'},
    rows(){const r=weekReview();return[{kind:'headline',tone:'info',title:r.headline,detail:null},...r.points.map(p=>({kind:'point',tone:p.tone,title:p.title,detail:p.sub||null}))];}},
  settings:{dated:false,logs:false,about:'How the app is set up, one row per setting (read-only).',where:'Settings',
    cols:{setting:'name',value:'current value',meaning:'what it does'},
    rows(){
      const L=(setting,value,meaning)=>({setting,value:value==null||value===''?null:String(value),meaning});
      const g=S.gear||{};const pl=g.plates?Object.keys(g.plates).map(k=>`${k}×${g.plates[k]}`).join(', '):null;
      return[L('unit',S.unit,'weight unit'),L('measure_unit',S.measureUnit,'body measurement unit'),L('goal',(GOALS.find(x=>x.id===S.goal)||{}).label,'training goal'),
        L('equipment',(EQUIPMENT_PRESETS.find(p=>p.id===S.equipPreset)||{}).label,'equipment preset; exercises outside it are hidden'),
        L('week_start',S.weekStart===0?'Sunday':'Monday','first day of the week for weekly numbers'),L('day_ends_at',`${S.dayEnd||0}:00`,'before this hour the clock still counts as the day before'),
        L('rest_default_s',S.restDur,'default rest between sets, seconds'),L('auto_warmups',S.autoWarm,'off, first lift only, or every barbell lift'),L('last_time_from',S.lastFrom,'"last time" numbers come from the same routine first, or any'),
        L('plates_mode',g.mode,'standard = any weight; fixed = only the plates owned'),L('bar',g.bar,'usual bar weight'),L('plates_owned',pl,'plate weight × pairs owned'),L('dumbbells_owned',g.dbs,'dumbbells owned, as typed'),
        L('weight_steps',Object.keys(S.steps||{}).map(k=>`${k} ${S.steps[k]}`).join(', ')||null,'smallest jump per kind of equipment where changed'),
        L('separate_rest_day_targets',hasRestGoals(),'different calorie and macro targets on rest days'),L('ask_mood',moodAsked(),'mood asked in the daily check-in'),L('ask_sleep',S.trackSleep!==false,'sleep asked in the daily check-in'),
        L('ask_feel',S.trackFeel!==false,'rating asked at the end of a workout'),L('running_features',runningOn(),'running tiles and page shown'),L('run_goal_miles',S.runGoal?S.runGoal.miles:null,'yearly distance goal'),
        L('home_layout',S.homeLayout,'Home screen layout'),L('rest_timer_style',S.restStyle,'how the rest timer shows'),L('cue_sound',S.cueSound,'sound for cues'),L('cue_volume',S.cueVol,'1-4'),
        L('swipe_rest',S.swipeRest,'Simple card turns into the rest countdown'),L('swipe_hold',S.swipeHold,'timed sets on the Simple card count themselves down'),
        L('theme',S.themeMode,'system, light or dark'),L('coach_log_access',S.ai.logAccess,'coach may read logs'),L('coach_instant_changes',S.ai.instant,'small coach changes apply at once with Undo')];
    }},
  formulas:{dated:false,logs:false,about:'How the app\'s own numbers are worked out.',where:'—',
    cols:{name:'formula',used_for:'where the number appears',how:'how it is calculated'},
    rows(){return COACH_FORMULAS.map(f=>Object.assign({},f));}},
};
function qdTablesOn(){const logs=!!S.ai.logAccess;return Object.keys(QD_TABLES).filter(k=>logs||!QD_TABLES[k].logs);}

// ─── The query ───
function qdCompare(a,op,b){
  if(op==='contains')return a!=null&&String(a).toLowerCase().includes(String(b).toLowerCase());
  if(op==='in')return String(b).split(',').map(x=>x.trim().toLowerCase()).includes(String(a).toLowerCase());
  if(a==null)return op==='='?b==null||String(b)===''||String(b)==='null':op==='!='?!(b==null||String(b)===''||String(b)==='null'):false;
  const na=typeof a==='boolean'?null:qdN(a),nb=qdN(b);
  let x=a,y=b;
  if(typeof a==='boolean')y=String(b).toLowerCase()==='true';
  else if(na!=null&&nb!=null&&String(b).trim()!==''){x=na;y=nb;}
  else{x=String(a).toLowerCase();y=String(b).toLowerCase();}
  if(op==='=')return x===y;if(op==='!=')return x!==y;if(op==='>')return x>y;if(op==='>=')return x>=y;if(op==='<')return x<y;if(op==='<=')return x<=y;
  return false;
}
function qdDerived(row,col){
  if(col==='week')return row.date?weekStartOf(row.date):null;
  if(col==='month')return row.date?row.date.slice(0,7):null;
  if(col==='weekday')return row.date?QD_DOW[dayDate(row.date).getDay()]:null;
  return row[col];
}
function qdAgg(fn,vals){
  if(fn==='count')return vals.length;
  const v=vals.filter(x=>x!=null&&x!=='');
  if(fn==='distinct')return new Set(v.map(String)).size;
  if(fn==='first')return v.length?v[0]:null;if(fn==='last')return v.length?v[v.length-1]:null;
  const n=v.map(x=>typeof x==='boolean'?(x?1:0):qdN(x)).filter(x=>x!=null);
  if(!n.length)return null;
  if(fn==='sum')return Math.round(n.reduce((a,b)=>a+b,0)*100)/100;
  if(fn==='avg')return Math.round(n.reduce((a,b)=>a+b,0)/n.length*100)/100;
  if(fn==='min')return Math.min(...n);if(fn==='max')return Math.max(...n);
  return null;
}
function qdDescribe(name){
  const on=qdTablesOn();
  if(!name)return{tables:on.map(k=>({table:k,about:QD_TABLES[k].about})),
    how:'Pick a table; from/to set the dates on tables with a date; where filters; group_by with aggregate sums them up. Columns week, month and weekday can be grouped on any table with a date.',
    hidden:Object.keys(QD_TABLES).length>on.length?'Log access is off, so the tables built from the user\'s logs are hidden.':undefined};
  const t=QD_TABLES[name];
  return{table:name,about:t.about,in_the_app:t.where,has_dates:!!t.dated,columns:t.cols,
    formulas:COACH_FORMULAS.filter(f=>f.used_for.split(/,\s*/).some(u=>u===name||u.startsWith(name+' '))).map(f=>({name:f.name,how:f.how}))};
}
// → {out} | {out:{error}, isError:true}
function coachQuery(a){
  a=isObj(a)?a:{};
  const name=a.table==null?'':String(a.table);
  const t=QD_TABLES[name];
  if(name&&!t)return{out:{error:`There is no table "${name.slice(0,40)}". Tables: ${qdTablesOn().join(', ')}`},isError:true};
  if(t&&t.logs&&!S.ai.logAccess)return{out:{error:'Log access is turned off in Settings, so this table is unavailable. Work from what the user tells you.'},isError:true};
  if(a.describe||!t)return{out:qdDescribe(t?name:'')};
  const cols=Object.keys(t.cols);const derived=t.dated?['week','month','weekday']:[];
  const known=c=>cols.includes(c)||derived.includes(c);
  const bad=c=>({out:{error:`"${String(c).slice(0,40)}" is not a column of ${name}. Columns: ${cols.join(', ')}${derived.length?' (and week, month, weekday for grouping)':''}`},isError:true});
  // Dates
  let from=null,to=null;
  if(t.dated){
    const f=qdDay(a.from==null||a.from===''?(t.ahead?'today':'29'):a.from,t.ahead);if(f.error)return{out:{error:f.error},isError:true};
    const e=qdDay(a.to==null||a.to===''?(t.ahead?'+13':'today'):a.to,t.ahead);if(e.error)return{out:{error:e.error},isError:true};
    from=f.date;to=e.date;if(from>to)[from,to]=[to,from];
    if(daysBetween(from,to)>1100)from=addDays(to,-1100);
  }
  let rows;try{rows=t.rows(from,to)||[];}catch(err){logError(err,'coach query '+name);return{out:{error:'The app could not build that table: '+errText(err).slice(0,120)},isError:true};}
  // Filters
  const where=Array.isArray(a.where)?a.where.filter(isObj):[];
  for(const w of where){
    if(!known(w.col))return bad(w.col);
    const op=QD_OPS.includes(w.op)?w.op:'=';
    rows=rows.filter(r=>qdCompare(qdDerived(r,w.col),op,w.value));
  }
  const matched=rows.length;
  // Oldest first while working, so first/last mean what they say.
  if(t.dated)rows.sort((x,y)=>x.date<y.date?-1:x.date>y.date?1:0);
  const groups=Array.isArray(a.group_by)?a.group_by.map(String).filter(Boolean).slice(0,3):[];
  const aggs=Array.isArray(a.aggregate)?a.aggregate.filter(isObj).slice(0,8):[];
  for(const g of groups)if(!known(g))return bad(g);
  for(const x of aggs){if(!QD_FNS.includes(x.fn))return{out:{error:`aggregate fn must be one of: ${QD_FNS.join(', ')}`},isError:true};if(x.fn!=='count'&&!known(x.col))return bad(x.col);}
  let header,out;
  if(groups.length||aggs.length){
    const list=aggs.length?aggs:[{fn:'count'}];
    const by=new Map();
    rows.forEach(r=>{const key=groups.map(g=>qdDerived(r,g));const k=JSON.stringify(key);if(!by.has(k))by.set(k,{key,rows:[]});by.get(k).rows.push(r);});
    if(!groups.length&&!by.size)by.set('[]',{key:[],rows:[]});
    const names=list.map(x=>x.fn==='count'&&!x.col?'count':`${x.fn}_${x.col}`);
    header=[...groups,...names];
    out=[...by.values()].map(b=>[...b.key,...list.map(x=>qdAgg(x.fn,x.fn==='count'&&!x.col?b.rows:b.rows.map(r=>qdDerived(r,x.col))))]);
  }else{
    const pick=Array.isArray(a.columns)&&a.columns.length?a.columns.map(String):cols;
    for(const c of pick)if(!known(c))return bad(c);
    header=pick;out=rows.map(r=>pick.map(c=>{const v=qdDerived(r,c);return v===undefined?null:v;}));
  }
  // Sort: newest (or last group) first unless told otherwise.
  let sort=String(a.sort||'').trim();
  if(sort){const desc=sort.startsWith('-');const c=desc?sort.slice(1):sort;const i=header.indexOf(c);
    if(i<0)return{out:{error:`sort must be one of the result's columns: ${header.join(', ')}`},isError:true};
    out.sort((x,y)=>{const p=x[i],q=y[i];if(p==null)return 1;if(q==null)return -1;const r=typeof p==='number'&&typeof q==='number'?p-q:String(p)<String(q)?-1:String(p)>String(q)?1:0;return desc?-r:r;});}
  else if(t.dated||groups.length)out.reverse();
  const limit=coachClamp(a.limit,1,QD_MAX_ROWS,QD_DEFAULT_ROWS);
  const total=out.length;let shown=out.slice(0,limit);
  const res=()=>{const o={table:name,from:from||undefined,to:to||undefined,rows_matched:matched,columns:header,rows:shown};
    if(groups.length||aggs.length)o.groups=total;
    if(shown.length<total)o.more=`${total-shown.length} more not shown. Narrow the dates, filter, group, or raise limit.`;
    if(!matched)o.note=t.dated?'Nothing in this range.':'Nothing yet.';
    return o;};
  let o=res();
  while(shown.length>1&&JSON.stringify(o).length>QD_CHARS){shown=shown.slice(0,Math.max(1,Math.floor(shown.length*0.7)));o=res();}
  return{out:o};
}
function coachQueryTool(){
  const tables=qdTablesOn();
  return{name:'query_data',kind:'read',
    description:'Any of the user\'s data as a table, filtered and summed by the app: for what the other read tools do not cover, or per week, month or exercise. Results name their columns; describe:true explains a table. Tables: '+
      tables.map(k=>k+(QD_TABLE_HINT[k]?` (${QD_TABLE_HINT[k]})`:'')).join(', ')+'.',
    parameters:_P.obj({
      table:_P.en(tables,'Which table.'),
      describe:_P.bool('Columns, meanings and formulas instead of rows.'),
      from:_P.str('YYYY-MM-DD, today, yesterday or days back ("90"). Default "29".'),
      to:_P.str('Same forms; schedule also takes "+14". Default today.'),
      where:_P.arr(_P.obj({col:_P.str('Column.'),op:_P.en(QD_OPS,'Default =; in takes a comma list.'),value:_P.str('Value.')},['col','value']),'All must hold.'),
      columns:_P.arr({type:'string'},'Default all.'),
      group_by:_P.arr({type:'string'},'Columns, or week, month, weekday.'),
      aggregate:_P.arr(_P.obj({fn:_P.en(QD_FNS,'Function.'),col:_P.str('Column; not for count.')},['fn']),'Per group, or overall. Output fn_col.'),
      sort:_P.str('A result column; "-" first for highest. Default newest first.'),
      limit:_P.int('1-200, default 50.'),
    }),
    run(a){const r=coachQuery(a);return{out:r.out,isError:!!r.isError,label:a&&a.table&&QD_TABLES[a.table]?`Data: ${a.table.replace(/_/g,' ')}${a.describe?' (layout)':''}`:'Data tables'};}};
}
// A few words on what a row is, where the name alone does not say.
const QD_TABLE_HINT={daily:'a row a day: training, food, weight, sleep, mood, steps, habits',sets:'each working set',patterns:'tested links',schedule:'can look ahead',targets:'next-session aims'};

// ─── The sheet as Markdown (tools/data-sheet.js writes it to docs/) ───
function coachDataSheetMd(){
  const L=[];
  L.push('# Lah We — data sheet','',
    'Generated from `src/js/65b-coach-data.js` by `npm run sheet`. Do not edit by hand: change the code and regenerate (a unit test fails while this file is behind).','',
    'The coach reads these tables through one tool, `query_data`. Every table is read-only and built from the app\'s own helpers, so its numbers match the screens. Filtering, grouping and sums happen in the app; the model never adds up rows itself. Tables marked *logs* are hidden when "Read my logs" is off.','',
    'Not readable by the coach, on purpose: API keys and sign-ins (never stored with the data), progress photos, route GPS points, past coach chats.','',
    '## Query','',
    '| Parameter | Meaning |','| --- | --- |',
    '| `table` | Which table. |','| `describe` | `true` returns the layout instead of rows; with no table, the list of tables. |',
    '| `from`, `to` | `YYYY-MM-DD`, `today`, `yesterday`, or days back (`90`). Default: the last 30 days. `schedule` defaults to the next 14 days and accepts `+14`. |',
    '| `where` | `[{col, op, value}]`, all must hold. `op`: '+QD_OPS.map(o=>'`'+o+'`').join(', ')+'. |',
    '| `columns` | Which columns to return. |','| `group_by` | Up to three columns; `week`, `month` and `weekday` work on any table with a date. |',
    '| `aggregate` | `[{fn, col}]`, `fn`: '+QD_FNS.map(o=>'`'+o+'`').join(', ')+'. Output column `fn_col`. |',
    '| `sort` | A result column, `-` in front for highest first. Default newest first. |','| `limit` | 1-'+QD_MAX_ROWS+', default '+QD_DEFAULT_ROWS+'. Results are also trimmed to about '+QD_CHARS.toLocaleString('en-US')+' characters. |','',
    'Example: average protein per week over 12 weeks, `{"table":"daily","from":"84","group_by":["week"],"aggregate":[{"fn":"avg","col":"protein_g"},{"fn":"sum","col":"sessions"}]}`.','');
  L.push('## Tables','');
  Object.keys(QD_TABLES).forEach(k=>{const t=QD_TABLES[k];
    L.push(`### ${k}`,'',`${t.about}${t.logs?' *logs*':''}`,'',`In the app: ${t.where}${t.dated?' · has dates':''}`,'','| Column | Meaning |','| --- | --- |');
    Object.keys(t.cols).forEach(c=>L.push(`| \`${c}\` | ${t.cols[c].replace(/\|/g,'\\|')} |`));
    L.push('');});
  L.push('## Formulas','','| Name | Used for | How |','| --- | --- | --- |');
  COACH_FORMULAS.forEach(f=>L.push(`| \`${f.name}\` | ${f.used_for} | ${f.how.replace(/\|/g,'\\|')} |`));
  L.push('');
  return L.join('\n');
}
