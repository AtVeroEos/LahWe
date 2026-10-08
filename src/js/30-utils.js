// ═══════════════════════════════════════════════════
// UTILS — ids, escaping, dates, units, exercise lookup
// ═══════════════════════════════════════════════════
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}

// ─── Escaping ───
// Every user-, file- or network-supplied string goes through esc() before it is put in markup.
const _ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(s){return s==null?'':String(s).replace(/[&<>"']/g,c=>_ESC[c]);}
// A JavaScript string literal that is safe inside an HTML attribute: onclick="fn(${jsq(value)})".
function jsq(s){return esc(JSON.stringify(String(s==null?'':s)));}

// ─── Dates ───
// All day keys are LOCAL calendar days ("YYYY-MM-DD"). Never derive one from toISOString():
// that is UTC, and in US time zones it rolls over to tomorrow in the evening.
function pad2(n){return String(n).padStart(2,'0');}
function dstr(d){d=d||new Date();return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());}
function today(){return dstr(new Date());}
function dayOf(ts){return dstr(new Date(ts));}
function dayDate(ds){return new Date(ds+'T12:00:00');}
function daysAgoStr(n){const d=new Date();d.setDate(d.getDate()-n);return dstr(d);}
function daysBetween(a,b){return Math.round((dayDate(b)-dayDate(a))/86400000);}
function addDays(ds,n){const d=dayDate(ds);d.setDate(d.getDate()+n);return dstr(d);}
function fmtDate(iso){if(!iso)return'';return new Date(iso).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});}
function fmtShort(iso){if(!iso)return'';return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric'});}
function fmtDay(ds){return ds?fmtShort(ds+'T12:00:00'):'';}
function fmtDur(ms){const m=Math.floor(ms/60000),h=Math.floor(m/60);return h>0?`${h}h ${m%60}m`:`${m}m`;}
function fmtTimer(s){s=Math.max(0,Math.round(s));const m=Math.floor(s/60),sec=s%60;return`${pad2(m)}:${pad2(sec)}`;}
function fmtMS(s){s=Math.max(0,Math.round(s));return`${Math.floor(s/60)}:${pad2(s%60)}`;}
// A length of time to the second: 27:14, or 1:02:09 past the hour.
function fmtClock(s){s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}:${pad2(m)}:${pad2(s%60)}`:`${m}:${pad2(s%60)}`;}
function r1(v){return Math.round(v*10)/10;}
function fmt1(v){const n=Math.round((parseFloat(v)||0)*10)/10;return n%1===0?String(n):n.toFixed(1);}
function greet(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}

// ─── Units ───
// Weights are stored in the unit the user chose (S.unit). Anything physiological is computed in kg.
const LB_PER_KG=2.20462;
function isKg(){return S.unit==='kg';}
function toKg(v){v=parseFloat(v)||0;return isKg()?v:v/LB_PER_KG;}
function toLb(v){v=parseFloat(v)||0;return isKg()?v*LB_PER_KG:v;}
function bwUser(){return parseFloat(S.bodyweight)||(isKg()?84:185);}
function bwKg(){return toKg(bwUser());}
function bwLb(){return toLb(bwUser());}
// Convert every stored weight when the unit setting changes, so "225" never silently becomes 225 kg.
function convertStoredWeights(to){
  if(to!=='kg'&&to!=='lbs')return;
  const f=to==='kg'?1/LB_PER_KG:LB_PER_KG;
  const step=to==='kg'?0.5:1;
  const cw=v=>{const n=parseFloat(v);if(!(n>0))return v;const out=Math.round(n*f/step)*step;return typeof v==='number'?out:String(out);};
  const cb=v=>{const n=parseFloat(v);return n>0?r1(n*f):v;};
  const eachWk=wk=>(wk.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(s=>{if(s.w!==''&&s.w!=null)s.w=cw(s.w);}));
  S.workouts.forEach(eachWk);if(S.activeWorkout)eachWk(S.activeWorkout);
  S.routines.forEach(r=>(r.exercises||[]).forEach(e=>{if(e.w!==''&&e.w!=null)e.w=cw(e.w);}));
  Object.values(S.prsManual||{}).forEach(p=>{p.w=parseFloat(cw(p.w));p.est=e1rm(p.w,p.r);});
  S.bodyweight=cb(S.bodyweight);
  S.bodyweightLog.forEach(b=>{b.weight=cb(b.weight);});
  if(S.weightGoal)S.weightGoal=cb(S.weightGoal);
  S.activities.forEach(a=>{if(parseFloat(a.ruckWeight)>0)a.ruckWeight=String(cb(a.ruckWeight));});
  S.unit=to;
  rebuildPRs();
}

// ─── Exercise lookup ───
// allEx()/getEx() are called inside nested loops over the whole history; index them once
// and rebuild only when the custom list changes.
let _exIdx=null;
function exIndex(){
  const c=S.custom||[];
  if(!_exIdx||_exIdx.src!==c||_exIdx.n!==c.length){
    const all=EXERCISES.concat(c);const map=new Map();
    all.forEach(e=>{if(!map.has(e.id))map.set(e.id,e);});
    _exIdx={src:c,n:c.length,all,map};
  }
  return _exIdx;
}
// Deleted custom exercises that still have history are kept (archived) so old workouts keep their
// names; they just stop appearing in lists and pickers.
function allEx(){return exIndex().all.filter(e=>!e.archived);}
function getEx(id){return exIndex().map.get(id);}
function exName(id){const e=getEx(id);return e?e.name:'Unknown exercise';}

// ─── Per-save memo for expensive history scans ───
const _memo=new Map();
function memo(key,fn){if(_memo.has(key))return _memo.get(key);const v=fn();_memo.set(key,v);return v;}
function bumpMemo(){_memo.clear();}

// ─── Strength maths ───
// Epley estimate. Accepts strings; returns 0 for anything that isn't a real set.
function e1rm(w,r){
  w=parseFloat(w);r=parseInt(r);
  if(!(w>0)||!(r>0))return 0;
  return r===1?w:Math.round(w*(1+r/30));
}
function setCounts(s){return !!s&&s.done&&!s.warmup;}
function totalVol(wk){
  return (wk.exercises||[]).reduce((t,ex)=>ex.timed?t:t+ex.sets.filter(setCounts).reduce((a,s)=>a+((parseFloat(s.w)||0)*(parseInt(s.r)||0)),0),0);
}
function doneSetCnt(wk){return (wk.exercises||[]).reduce((t,ex)=>t+ex.sets.filter(setCounts).length,0);}

// ─── Targets (rep ranges, AMRAP, timed sets) ───
// A routine exercise carries: r (target reps, or seconds when timed), rMax (top of a range),
// amrap (as many reps as possible), timed (r is seconds), note (free text: tempo, RPE, cues).
function fmtRepTarget(e){
  if(!e)return'';
  if(e.timed)return e.r?`${e.r}s`:'time';
  const base=e.rMax&&parseInt(e.rMax)>parseInt(e.r||0)?`${e.r||'?'}–${e.rMax}`:(e.r?String(e.r):'');
  if(e.amrap)return base?`${base}+ AMRAP`:'AMRAP';
  return base;
}
function fmtTarget(e){
  const reps=fmtRepTarget(e);const sets=parseInt(e&&e.sets)||0;
  if(!sets&&!reps)return'';
  return `${sets||'–'} × ${reps||'–'}`;
}
