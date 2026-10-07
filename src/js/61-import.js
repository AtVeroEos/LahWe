// ═══════════════════════════════════════════════════
// IMPORT PROGRAM — JSON in, routines/groups out
// ═══════════════════════════════════════════════════
// parseImport() is PURE: it reads the catalog and returns a plan. Nothing is written to S until the
// user taps Import and commitImport() runs. (Previewing used to create custom exercises on every
// keystroke.) The coach's routine proposals go through the same two functions.

// ─── Exercise matching ───
// An import may only land on an existing exercise when we are sure it is the same movement:
//   1. its id            2. the same name (ignoring case, punctuation, plurals, DB/BB/KB shorthand)
//   3. a known alias     4. the same words once the equipment word is set aside, with matching equipment
// Anything else becomes a new custom exercise. "Seated Leg Curl" never collapses into "Leg Curl".
const EQ_WORD={barbell:'Barbell',dumbbell:'Dumbbell',kettlebell:'Kettlebell',machine:'Machine',cable:'Cable',bodyweight:'Bodyweight',medball:'Medicine Ball',smith:'Machine'};
const EX_ALIASES={
  'bench press':'bb-bench','flat bench press':'bb-bench','flat barbell bench press':'bb-bench','bench':'bb-bench',
  'incline barbell press':'inc-bench','incline press':'inc-bench','decline barbell bench press':'dec-bench',
  'dumbbell press':'db-bench','flat dumbbell press':'db-bench','flat dumbbell bench press':'db-bench',
  'incline dumbbell press':'inc-db-bench','dumbbell flye':'db-fly','dumbbell chest fly':'db-fly',
  'cable crossover':'cable-fly','cable flye':'cable-fly','cable chest fly':'cable-fly','pushup':'pushup','dip chest':'chest-dip',
  'conventional deadlift':'deadlift','trap bar deadlift':'hex-dl','hex deadlift':'hex-dl',
  'bent over row':'bb-row','bent over barbell row':'bb-row','bentover row':'bb-row','barbell bent over row':'bb-row',
  'lat pull down':'lat-pd','pulldown':'lat-pd','cable lat pulldown':'lat-pd','wide grip lat pulldown':'lat-pd',
  'seated row':'cable-row','cable row':'cable-row','cable seated row':'cable-row','low row':'cable-row',
  'one arm dumbbell row':'db-row','single arm dumbbell row':'db-row','one arm row':'db-row',
  'military press':'ohp','barbell overhead press':'ohp','standing overhead press':'ohp','standing barbell press':'ohp','shoulder press':'ohp','barbell shoulder press':'ohp',
  'dumbbell overhead press':'db-ohp','seated dumbbell press':'db-ohp','seated dumbbell shoulder press':'db-ohp',
  'side lateral raise':'lat-raise','dumbbell side raise':'lat-raise','side raise':'lat-raise','dumbbell front raise':'front-raise',
  'cable face pull':'face-pull','rope face pull':'face-pull','shrug':'shrug','kettlebell overhead press':'kb-press',
  'bicep curl':'db-curl','dumbbell bicep curl':'db-curl','barbell bicep curl':'bb-curl','dumbbell hammer curl':'hammer-curl',
  'cable bicep curl':'cable-curl','machine preacher curl':'preacher-curl',
  'tricep rope pushdown':'tri-pd','rope pushdown':'tri-pd','cable pushdown':'tri-pd','cable tricep pushdown':'tri-pd','tricep pressdown':'tri-pd','pushdown':'tri-pd',
  'skullcrusher':'skull','lying tricep extension':'skull','barbell skull crusher':'skull','close grip bench':'cgbp',
  'overhead dumbbell tricep extension':'oh-ext','dumbbell overhead tricep extension':'oh-ext','overhead extension':'oh-ext',
  'bench dip':'tri-dip','dip tricep':'tri-dip',
  'squat':'squat','back squat':'squat','barbell squat':'squat','high bar squat':'squat','low bar squat':'squat',
  'barbell front squat':'front-squat','machine leg press':'leg-press','rdl':'rdl','barbell romanian deadlift':'rdl','barbell rdl':'rdl',
  'hamstring curl':'leg-curl','machine leg curl':'leg-curl','quad extension':'leg-ext','machine leg extension':'leg-ext',
  'machine calf raise':'calf-raise','machine hack squat':'hack-squat','dumbbell walking lunge':'lunge',
  'split squat bulgarian':'bss','dumbbell bulgarian split squat':'bss','rear foot elevated split squat':'bss',
  'dumbbell stepup':'db-step','stepup':'db-step','barbell hip thrust':'hip-thrust','barbell sumo deadlift':'sumo-dl',
  'dumbbell goblet squat':'goblet','cable glute kickback':'glute-kick','cable kickback':'glute-kick',
  'front plank':'plank','ab crunch':'crunch','hanging knee raise':'leg-raise','ab wheel':'ab-rollout','ab rollout':'ab-rollout','ab wheel rollout':'ab-rollout',
  'rope crunch':'cable-crunch','kneeling cable crunch':'cable-crunch','lying leg raise':'leg-raises','leg raise':'leg-raises',
  'farmer walk':'farmers','farmer carry':'farmers','farmers carry':'farmers','farmers walk':'farmers',
  'russian kettlebell swing':'kb-swing','medball slam':'med-slam','slam ball':'med-slam','air squat':'bw-squat',
  'bodyweight calf raise':'bw-calf','situp':'situp','mountain climbers':'mountain-climber',
};
function singular(t){
  if(t.length<=3)return t;
  if(/(ch|sh|ss|x)es$/.test(t))return t.slice(0,-2);
  if(t.endsWith('s')&&!t.endsWith('ss'))return t.slice(0,-1);
  return t;
}
function exNameTokens(name){
  let s=String(name||'').toLowerCase().replace(/[’']/g,'').replace(/&/g,' and ');
  s=s.replace(/\b(push|pull|chin|sit|step|v)[\s\-]?(ups?)\b/g,'$1up').replace(/\bt[\s\-]bar\b/g,'tbar')
     .replace(/\bmed(icine)?[\s\-]?ball\b/g,'medball').replace(/\bbody[\s\-]weight\b/g,'bodyweight')
     .replace(/\bskull[\s\-]?crushers?\b/g,'skull crusher').replace(/\bbent[\s\-]?over\b/g,'bent over')
     .replace(/\bclose[\s\-]grip\b/g,'close grip').replace(/\bpull[\s\-]?downs?\b/g,'pulldown').replace(/\bpush[\s\-]?downs?\b/g,'pushdown')
     .replace(/\bstep[\s\-]?ups?\b/g,'stepup').replace(/\bsingle[\s\-]arm\b/g,'one arm').replace(/\b(1|one)[\s\-]arm\b/g,'one arm');
  const map={db:'dumbbell',dbs:'dumbbell',bb:'barbell',kb:'kettlebell',kbs:'kettlebell',bw:'bodyweight',ohp:'overhead press',triceps:'tricep',biceps:'bicep',flyes:'fly',flye:'fly',flies:'fly'};
  const stop=new Set(['the','a','an','with','on','of','and','w']);
  const out=[];
  s.split(/[^a-z0-9]+/).forEach(t=>{
    if(!t||stop.has(t))return;
    t=map[t]||t;
    t.split(' ').forEach(x=>{x=map[x]||singular(x);if(x&&!stop.has(x))out.push(x);});
  });
  return out;
}
function exNameKey(name){return exNameTokens(name).join(' ');}
function normEquipment(eq){
  const k=String(eq||'').trim().toLowerCase();if(!k)return'';
  const direct=EQUIPMENT_TYPES.find(e=>e.toLowerCase()===k);if(direct)return direct;
  const map={db:'Dumbbell',dumbbells:'Dumbbell',bb:'Barbell',barbells:'Barbell',kb:'Kettlebell',kettlebells:'Kettlebell',bw:'Bodyweight','body weight':'Bodyweight',none:'Bodyweight',
    machines:'Machine',smith:'Machine','smith machine':'Machine',cables:'Cable','med ball':'Medicine Ball',medball:'Medicine Ball',band:'Other',bands:'Other','ez bar':'Barbell','ez-bar':'Barbell','trap bar':'Barbell','hex bar':'Barbell'};
  return map[k]||'';
}
let _matchIdx=null;
function matchIndex(){
  const all=exIndex().all;
  if(_matchIdx&&_matchIdx.src===all)return _matchIdx;
  const byKey=new Map(),byCore=new Map(),byId=new Map(),alias=new Map();
  Object.keys(EX_ALIASES).forEach(k=>alias.set(exNameKey(k),EX_ALIASES[k]));
  all.forEach(e=>{
    byId.set(String(e.id).toLowerCase(),e);
    const toks=exNameTokens(e.name);const key=toks.join(' ');
    if(!byKey.has(key))byKey.set(key,e);
    const core=toks.filter(t=>!EQ_WORD[t]).sort().join(' ');
    if(core){if(!byCore.has(core))byCore.set(core,[]);byCore.get(core).push(e);}
  });
  _matchIdx={src:all,byKey,byCore,byId,alias};
  return _matchIdx;
}
// Returns {ex, how, note?} or null. `eqHint` is the import's "equipment" field.
function matchExercise(name,eqHint){
  const raw=String(name||'').trim();if(!raw)return null;
  const ix=matchIndex();
  let m;
  const toks=exNameTokens(raw);if(!toks.length)return null;
  const key=toks.join(' ');
  const hint=normEquipment(eqHint);
  const eqInName=(toks.map(t=>EQ_WORD[t]).find(Boolean))||'';
  const core=toks.filter(t=>!EQ_WORD[t]).sort().join(' ');
  const sameCore=ix.byCore.get(core)||[];
  m=ix.byKey.get(key);
  if(m){
    // The name is the catalog's own. If the import insists on different equipment and the catalog has
    // that variant under the same words, take the variant; otherwise trust the name and say so.
    if(hint&&hint!==m.eq&&!eqInName){
      const alt=sameCore.filter(e=>e.eq===hint);
      if(alt.length===1)return{ex:alt[0],how:'equipment'};
      if(hint!=='Other')return{ex:m,how:'name',note:`"${raw}" matched ${m.name} (${m.eq}); the import said ${hint}`};
    }
    return{ex:m,how:'name'};
  }
  const aliasId=ix.alias.get(key);
  if(aliasId){
    const a=ix.byId.get(aliasId);
    if(a){
      if(hint&&hint!==a.eq&&!eqInName){
        const alt=sameCore.filter(e=>e.eq===hint);
        if(alt.length===1)return{ex:alt[0],how:'equipment'};
        if(hint!=='Other')return null; // "Bench Press" on a Machine is not the barbell bench: make it its own exercise
      }
      return{ex:a,how:'alias'};
    }
  }
  if(core&&sameCore.length){
    const want=eqInName||hint;
    if(want){const c=sameCore.filter(e=>e.eq===want);if(c.length===1)return{ex:c[0],how:'equipment'};}
    else if(sameCore.length===1&&exNameTokens(sameCore[0].name).length===toks.length)return{ex:sameCore[0],how:'name'}; // same words, different order
  }
  return null; // ids are matched from the exId/id field only: a NAME that happens to equal an id ("Lunge") is not one
}

// ─── Guessing, only when the import didn't say ───
function guessMuscle(name){
  const n=' '+String(name||'').toLowerCase()+' ';
  const direct=[[/\blat(eral)? raise|reverse (pec|fly)|rear/,'Shoulders'],[/pull-?\s?through/,'Glutes'],[/chest|pec/,'Chest'],[/tricep/,'Triceps'],[/bicep/,'Biceps'],[/forearm|wrist|grip/,'Forearms'],[/hamstring/,'Hamstrings'],[/quad/,'Quads'],
    [/glute|hip thrust|hip abduct/,'Glutes'],[/calf|calves/,'Calves'],[/oblique/,'Obliques'],[/lower back|back ext|hyperext|erector/,'Lower Back'],[/\btrap|shrug/,'Traps'],
    [/delt|shoulder/,'Shoulders'],[/\blats?\b|pulldown|pull-?down/,'Lats']];
  for(const[re,m]of direct)if(re.test(n))return m;
  const moves=[[/(incline|decline).*press/,'Chest'],[/leg curl|rdl|romanian|good morning|nordic|stiff/,'Hamstrings'],[/leg ext|leg press|squat|lunge|step-?\s?up/,'Quads'],[/bridge|kickback/,'Glutes'],[/deadlift|clean|swing/,'Hamstrings'],
    [/upright row|farmer|carry/,'Traps'],[/skull|push-?\s?down|\bdips?\b|close-?\s?grip|kickback/,'Triceps'],[/curl|chin-?\s?up/,'Biceps'],
    [/lateral|overhead|\bohp\b|arnold|face pull|front raise|military|pike|press/,'Shoulders'],[/\brows?\b|pull-?\s?up|pull/,'Lats'],[/superman/,'Lower Back'],
    [/bench|fly|push-?\s?up/,'Chest'],[/twist|side bend|woodchop|windshield/,'Obliques'],[/crunch|plank|\babs?\b|sit-?\s?up|leg raise|core|hollow|rollout|dead bug|flutter|v-?up/,'Abs']];
  // "bench press" must reach Chest before the generic "press" → Shoulders rule
  if(/bench|push-?\s?up|\bfly|flye/.test(n)&&!/tricep|close/.test(n))return'Chest';
  for(const[re,m]of moves)if(re.test(n))return m;
  return'';
}
function guessEq(name){
  const t=exNameTokens(name);const hit=t.map(x=>EQ_WORD[x]).find(Boolean);
  if(hit)return hit;
  if(/push-?\s?up|pull-?\s?up|chin-?\s?up|plank|crunch|sit-?\s?up|burpee|\bdips?\b/i.test(name))return'Bodyweight';
  return'Other';
}

// ─── Field parsing ───
const _DOW={sun:0,sunday:0,mon:1,monday:1,tue:2,tues:2,tuesday:2,wed:3,weds:3,wednesday:3,thu:4,thur:4,thurs:4,thursday:4,fri:5,friday:5,sat:6,saturday:6};
function parseDays(v){
  const arr=Array.isArray(v)?v:(typeof v==='string'?v.split(/[\s,\/]+/):[]);
  const out=[];
  arr.forEach(d=>{
    let n=null;
    if(typeof d==='number'&&d>=0&&d<=6)n=Math.round(d);
    else if(typeof d==='string'){const k=d.trim().toLowerCase();if(k in _DOW)n=_DOW[k];else if(/^[0-6]$/.test(k))n=parseInt(k);}
    if(n!=null&&!out.includes(n))out.push(n);
  });
  return out.sort();
}
// Understands 10 · "8-12" · "AMRAP" · "10+" · "30s" · "1:30" · "45 sec" · "8-12 each side",
// plus the explicit fields repsMin / repsMax / amrap / timed / seconds.
function parseReps(e){
  const out={r:'',rMax:'',amrap:false,timed:false,extra:''};
  const pos=v=>{const n=parseInt(v);return n>0?Math.min(n,9999):0;};
  let v=e.reps;
  if(e.seconds!=null&&pos(e.seconds)){out.timed=true;out.r=String(pos(e.seconds));}
  else if(typeof v==='number'){if(v>0)out.r=String(Math.min(Math.round(v),9999));else out.amrap=true;}
  else if(typeof v==='string'&&v.trim()){
    let s=v.trim().toLowerCase().replace(/[–—]/g,'-').replace(/(\d)\s*to\s*(\d)/g,'$1-$2'); // 'to' is a range only between numbers
    // Bracketed text is commentary ("5 (3s pause)"), never the target.
    const aside=[];s=s.replace(/\(([^)]*)\)|\[([^\]]*)\]/g,(_,a,b)=>{aside.push((a||b||'').trim());return' ';}).trim();
    const SEC='(?:s|sec|secs|seconds?)',MIN='(?:min|mins|minutes?)',DIST='(?:m|meters?|metres?|yd|yds|yards?|ft|feet)';
    let m;
    if((m=s.match(/^(\d+)\s*:\s*(\d{2})\b/))){out.timed=true;out.r=String(parseInt(m[1])*60+parseInt(m[2]));s=s.slice(m[0].length);}
    else if((m=s.match(new RegExp('^(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)\\s*'+MIN+'\\b')))){out.timed=true;out.r=String(Math.round(parseFloat(m[1])*60));out.rMax=String(Math.round(parseFloat(m[2])*60));s=s.slice(m[0].length);}
    else if((m=s.match(new RegExp('^(\\d+(?:\\.\\d+)?)\\s*'+MIN+'\\b')))){out.timed=true;out.r=String(Math.round(parseFloat(m[1])*60));s=s.slice(m[0].length);}
    else if((m=s.match(new RegExp('^(\\d+)\\s*-\\s*(\\d+)\\s*'+SEC+'\\b')))){out.timed=true;out.r=m[1];out.rMax=m[2];s=s.slice(m[0].length);}
    else if((m=s.match(new RegExp('^(\\d+)\\s*'+SEC+'\\b')))){out.timed=true;out.r=m[1];s=s.slice(m[0].length);}
    else if(new RegExp('^\\d+(?:\\s*-\\s*\\d+)?\\s*'+DIST+'\\b').test(s)){/* a distance ("40m"): there is no rep target; the text is kept as the note */}
    else if((m=s.match(/^(\d+)\s*-\s*(\d+)/))){out.r=m[1];out.rMax=m[2];s=s.slice(m[0].length);}
    else if((m=s.match(/^(\d+)\s*\+/))){out.r=m[1];out.amrap=true;s=s.slice(m[0].length);}
    else if((m=s.match(/^(\d+)/))){out.r=m[1];s=s.slice(m[0].length);}
    if(/amrap|max|failure|as many/.test(s)){out.amrap=true;s=s.replace(/amrap|to failure|failure|max(?:imum)?(?: reps)?|as many(?: reps)? as possible/g,'');}
    out.extra=[s.replace(/\breps?\b|\bx\b/g,'').replace(/[,;]+/g,' ').replace(/\s+/g,' ').replace(/^[\s\-·]+|[\s\-·]+$/g,'')].concat(aside).filter(Boolean).join(' · ');
  }else if(v===0)out.amrap=true;
  if(pos(e.repsMin)){out.r=String(pos(e.repsMin));}
  if(pos(e.repsMax))out.rMax=String(pos(e.repsMax));
  if(e.amrap===true)out.amrap=true;
  if(e.timed===true)out.timed=true;
  if(out.rMax&&(!out.r||parseInt(out.rMax)<=parseInt(out.r))){if(!out.r)out.r=out.rMax;out.rMax='';}
  if(out.timed)out.amrap=false;
  return out;
}
// Pull the JSON object out of whatever was pasted (models like to wrap it in ```json fences or prose).
function extractJson(text){
  const s=String(text||'').trim();if(!s)return{error:'empty'};
  const tryParse=t=>{try{return{value:JSON.parse(t)};}catch(e){return{error:e.message};}};
  let r=tryParse(s);if(r.value!==undefined)return r;
  const fence=s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fence){const f=tryParse(fence[1].trim());if(f.value!==undefined)return f;}
  const a=s.indexOf('{'),b=s.lastIndexOf('}');
  if(a>=0&&b>a){const f=tryParse(s.slice(a,b+1));if(f.value!==undefined)return f;}
  return r;
}

// ─── Parse (pure) ───
function parseImport(d){
  const warnings=[];const newEx=new Map(); // key → definition of a custom exercise to create
  if(Array.isArray(d))d={routines:d};
  if(!isObj(d))return{error:'That is not a program. Expected an object with "routines" or "groups".'};
  const str=(v,max)=>String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,max);
  const warn=w=>{if(warnings.length<40&&!warnings.includes(w))warnings.push(w);};

  const parseExercise=(e,rName)=>{
    if(typeof e==='string')e={name:e};
    if(!isObj(e))return null;
    const name=str(e.name||e.exercise||'',80);
    const idHint=str(e.exId||e.id||'',60);
    let match=null;
    if(idHint&&idHint.toUpperCase()!=='NEW'){const byId=matchIndex().byId.get(idHint.toLowerCase());if(byId)match={ex:byId,how:'id'};}
    if(!match&&name)match=matchExercise(name,e.equipment||e.eq);
    if(!match&&!name){warn(`${rName}: skipped an exercise with no name`);return null;}
    const reps=parseReps(e);
    const sets=Math.min(20,Math.max(1,parseInt(e.sets)||3));
    const type=['flat','ascend','descend'].includes(String(e.type||'').toLowerCase())?String(e.type).toLowerCase():'flat';
    let rest=e.rest==null||e.rest===''?null:parseInt(e.rest);
    if(rest!=null&&!(rest>=0))rest=null;if(rest!=null)rest=Math.min(900,rest);
    const wNum=parseFloat(e.weight!=null?e.weight:e.w);
    const noteBits=[str(e.note||e.notes||'',160),reps.extra].filter(Boolean);
    const out={sets,w:wNum>0?String(wNum):'',r:reps.r,rMax:reps.rMax,amrap:reps.amrap,timed:reps.timed,type,rest,
      link:e.link?str(e.link,24):null,note:noteBits.join(' · ').slice(0,200)};
    if(match){
      out.exId=match.ex.id;out._name=match.ex.name;out._given=name;out._how=match.how;
      if(match.ex.archived)out._revive=true;
      if(match.note)warn(match.note);
    }else{
      const key=exNameKey(name)||name.toLowerCase();
      if(!newEx.has(key)){
        let muscle=normMuscle(str(e.muscle||'',40));
        if(!MEV_MAV[muscle]){
          const g=guessMuscle(name);
          if(e.muscle)warn(`"${name}": "${str(e.muscle,40)}" is not a tracked muscle${g?` — using ${g}`:''}`);
          else warn(`"${name}": no muscle given${g?` — guessed ${g}`:' — it will not count toward any muscle'}`);
          muscle=g;
        }
        const eq=normEquipment(e.equipment||e.eq)||guessEq(name);
        const sec=[...new Set((Array.isArray(e.secondaryMuscles)?e.secondaryMuscles:[]).map(normMuscle))].filter(m=>MEV_MAV[m]&&m!==muscle);
        newEx.set(key,{key,name,cat:MUSCLE_CAT[muscle]||'Full Body',eq,muscle,sec});
      }
      out._newKey=key;out._name=newEx.get(key).name;out._given=name;out._how='new';
    }
    return out;
  };
  const parseRoutine=(r,i)=>{
    if(!isObj(r))return null;
    const name=str(r.name,80)||`Imported Routine ${i+1}`;
    const exercises=(Array.isArray(r.exercises)?r.exercises:[]).map(e=>parseExercise(e,name)).filter(Boolean);
    if(!exercises.length){warn(`"${name}" has no exercises and was skipped`);return null;}
    // A superset only works if its members sit next to each other; drop links that don't.
    const seen={};
    exercises.forEach((e,k)=>{if(!e.link)return;(seen[e.link]=seen[e.link]||[]).push(k);});
    Object.keys(seen).forEach(l=>{
      const ks=seen[l];const contiguous=ks.every((k,j)=>j===0||k===ks[j-1]+1);
      if(ks.length<2||!contiguous){ks.forEach(k=>{exercises[k].link=null;});if(ks.length>=2)warn(`"${name}": superset ${l} was not consecutive, so it was unlinked`);}
    });
    return{name,notes:str(r.notes,400),days:parseDays(r.days),exercises};
  };

  const routines=[];const groups=[];
  const addGroup=(g,list)=>{
    const start=routines.length;
    (Array.isArray(list)?list:[]).forEach((r,i)=>{const pr=parseRoutine(r,routines.length);if(pr)routines.push(pr);});
    const count=routines.length-start;
    if(!count){warn(`Group "${str(g&&g.name,60)||'?'}" has no usable routines and was skipped`);return;}
    let mode=String((g&&g.mode)||'rotation').toLowerCase()==='daypicker'?'daypicker':'rotation';
    const mine=routines.slice(start);
    if(mode==='daypicker'&&!mine.some(r=>r.days.length)){mode='rotation';warn(`Group "${str(g.name,60)}" asked for fixed weekdays but no routine lists "days" — imported as a rotation`);}
    const weeks=Math.min(52,Math.max(0,parseInt(g&&g.weeks)||0));
    const dpw=parseInt(g&&g.daysPerWeek);
    groups.push({name:str(g&&g.name,60)||'Imported split',mode,weeks,daysPerWeek:dpw>=1&&dpw<=7?dpw:0,_start:start,_count:count});
  };
  if(Array.isArray(d.groups)&&d.groups.length){
    d.groups.forEach(g=>{if(isObj(g))addGroup(g,g.routines);});
  }else if(Array.isArray(d.routines)){
    if(isObj(d.group))addGroup(d.group,d.routines);
    else d.routines.forEach((r,i)=>{const pr=parseRoutine(r,i);if(pr)routines.push(pr);});
  }else return{error:'Nothing to import: expected a "routines" or "groups" list.'};
  if(!routines.length)return{error:'No workouts with exercises were found.'+(warnings.length?' '+warnings[0]:'')};

  // Only keep the custom exercises that a surviving routine actually uses.
  const used=new Set();routines.forEach(r=>r.exercises.forEach(e=>{if(e._newKey)used.add(e._newKey);}));
  const newExercises=[...newEx.values()].filter(x=>used.has(x.key));
  const existing=new Set(S.routines.map(r=>String(r.name).toLowerCase()));
  const dupes=routines.filter(r=>existing.has(r.name.toLowerCase())).map(r=>r.name);
  const timed=groups.length>=2&&groups.every(g=>g.weeks>0);
  return{routines,groups,newExercises,warnings,dupes,timed};
}

// ─── Commit ───
// opts: {replace: overwrite same-named routines/groups in place, program: start the phases as a timed program}
function commitImport(parsed,opts){
  opts=opts||{};
  const idByKey={};
  parsed.newExercises.forEach(n=>{
    const id=`custom-${uid()}`;idByKey[n.key]=id;
    S.custom.push({id,name:n.name,cat:n.cat,eq:n.eq,muscle:n.muscle,sec:n.sec});
    if(n.sec.length)SEC_MUSCLE[id]=n.sec;
  });
  _exIdx=null;
  const rids=parsed.routines.map(r=>{
    const exercises=r.exercises.map(e=>{
      const exId=e.exId||idByKey[e._newKey];
      if(e._revive){const ex=getEx(exId);if(ex)ex.archived=false;}
      const o={exId,sets:e.sets,w:e.w,r:e.r,type:e.type,rest:e.rest,link:e.link};
      if(e.rMax)o.rMax=e.rMax;if(e.amrap)o.amrap=true;if(e.timed)o.timed=true;if(e.note)o.note=e.note;
      return o;
    });
    const old=opts.replace?S.routines.find(x=>String(x.name).toLowerCase()===r.name.toLowerCase()):null;
    if(old){old.exercises=exercises;old.notes=r.notes;old.active=true;return old.id;}
    const rid=uid();S.routines.push({id:rid,name:r.name,notes:r.notes,exercises,days:[]});return rid;
  });
  _exIdx=null;
  const gids=parsed.groups.map(g=>{
    const routineIds=[...new Set(rids.slice(g._start,g._start+g._count))];
    const dayMap={};
    if(g.mode==='daypicker')parsed.routines.slice(g._start,g._start+g._count).forEach((r,i)=>{if(r.days.length)dayMap[rids[g._start+i]]=r.days.slice();});
    const dpw=g.daysPerWeek||Math.min(6,Math.max(1,routineIds.length));
    const old=opts.replace?S.groups.find(x=>String(x.name).toLowerCase()===g.name.toLowerCase()):null;
    if(old){old.mode=g.mode;old.routineIds=routineIds;old.dayMap=dayMap;old.cursor=0;old.daysPerWeek=dpw;return old.id;}
    const gid=uid();S.groups.push({id:gid,name:g.name,mode:g.mode,routineIds,cursor:0,dayMap,daysPerWeek:dpw,active:false});return gid;
  });
  let programStarted=false;
  if(opts.program&&parsed.timed&&gids.length>=2){
    S.program={active:true,startDate:today(),phases:parsed.groups.map((g,i)=>({groupId:gids[i],mode:'weeks',weeks:g.weeks,untilDate:''}))};
    resolveProgramGroup();programStarted=true;
  }else if(gids.length&&(!getActiveGroup()||opts.activate)){
    S.groups.forEach(g=>{g.active=g.id===gids[0];});
    if(opts.activate&&S.program&&S.program.active)S.program.active=false;
  }
  rebuildPRs();saveNow();
  return{rids,gids,programStarted};
}

// ─── Preview (shared with the coach's review sheet) ───
function importPreviewHTML(parsed){
  const exRow=e=>{
    const tgt=fmtTarget(e);
    const renamed=e._how!=='new'&&e._given&&exNameKey(e._given)!==exNameKey(e._name);
    return`<div class="ip-ex"><div style="flex:1;min-width:0">
        <div class="ip-exn">${esc(e._name)}${e._how==='new'?' <span class="badge ba">New</span>':''}${e.link?` <span class="badge bp">${esc(e.link)}</span>`:''}</div>
        ${renamed?`<div class="ip-exs">from “${esc(e._given)}”</div>`:''}${e.note?`<div class="ip-exs">${esc(e.note)}</div>`:''}
      </div><div class="ip-tgt">${esc(tgt)}${e.rest!=null?`<span> · ${e.rest}s</span>`:''}</div></div>`;
  };
  const DOW=['Su','Mo','Tu','We','Th','Fr','Sa'];
  const rtn=r=>{
    const nNew=r.exercises.filter(e=>e._how==='new').length;
    const ss=new Set(r.exercises.filter(e=>e.link).map(e=>e.link)).size;
    return`<details class="ip-r"><summary><div style="flex:1;min-width:0"><div class="ir-name">${esc(r.name)}</div>
      <div class="ir-meta">${r.exercises.length} exercise${r.exercises.length===1?'':'s'}${nNew?` · ${nNew} new`:''}${ss?` · ${ss} superset${ss>1?'s':''}`:''}${r.days.length?' · '+r.days.map(x=>DOW[x]).join(' '):''}</div></div><span class="ip-chev">›</span></summary>
      ${r.notes?`<div class="ip-exs" style="padding:0 0 6px">${esc(r.notes)}</div>`:''}${r.exercises.map(exRow).join('')}</details>`;
  };
  let html='';const grouped=new Set();
  parsed.groups.forEach(g=>{
    html+=`<div class="ip-g">📁 ${esc(g.name)} <span>${g.mode==='daypicker'?'fixed weekdays':'rotation'}${g.weeks?` · ${g.weeks} wk`:''}</span></div>`;
    for(let i=g._start;i<g._start+g._count;i++){grouped.add(i);html+=rtn(parsed.routines[i]);}
  });
  parsed.routines.forEach((r,i)=>{if(!grouped.has(i))html+=rtn(r);});
  if(parsed.newExercises.length){
    html+=`<div class="ip-g">New custom exercises <span>${parsed.newExercises.length}</span></div>`+
      parsed.newExercises.map(n=>`<div class="ip-ex"><div style="flex:1;min-width:0"><div class="ip-exn">${esc(n.name)}</div><div class="ip-exs">${esc(n.cat)} · ${esc(n.eq)} · ${n.muscle?esc(n.muscle):'no muscle'}${n.sec.length?' (+'+esc(n.sec.join(', '))+')':''}</div></div></div>`).join('');
  }
  let opts='';
  if(parsed.dupes.length)opts+=`<label class="ip-opt"><input type="checkbox" id="imp-replace"><span>Replace my existing <b>${esc(parsed.dupes.slice(0,3).join(', '))}${parsed.dupes.length>3?'…':''}</b> instead of adding duplicates (history is kept)</span></label>`;
  if(parsed.timed)opts+=`<label class="ip-opt"><input type="checkbox" id="imp-program"${S.program&&S.program.active?'':' checked'}><span>Run these ${parsed.groups.length} phases as a timed program starting today (${parsed.groups.map(g=>g.weeks+' wk').join(' → ')})${S.program&&S.program.active?' — replaces your current program':''}</span></label>`;
  else if(parsed.groups.length&&getActiveGroup())opts+=`<label class="ip-opt"><input type="checkbox" id="imp-activate"><span>Make <b>${esc(parsed.groups[0].name)}</b> the split in use now</span></label>`;
  const warn=parsed.warnings.length?`<div class="import-warn">${parsed.warnings.map(esc).join('<br>')}</div>`:'';
  return`<div class="import-preview">${html}</div>${warn}${opts}`;
}
function importOptsFromDOM(){
  const on=id=>!!document.getElementById(id)?.checked;
  return{replace:on('imp-replace'),program:on('imp-program'),activate:on('imp-activate')};
}
function finishImport(parsed,ovId){
  const res=commitImport(parsed,importOptsFromDOM());
  closeOv(ovId);
  const n=parsed.routines.length,g=parsed.groups.length;
  toast(`Imported ${n} routine${n>1?'s':''}${g?` + ${g} group${g>1?'s':''}`:''}${res.programStarted?' · program started':''}`,'green');
  S.libTab=g?'groups':'routines';
  if(S.tab==='library')renderLibrary(document.getElementById('content'));else go('library');
}

// ─── Paste-JSON import sheet ───
function showImportUI(prefill){
  const ov=makeOv('import-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt">Import Program</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.5">Paste program JSON (see the import guide in the repo), or pick a file. Nothing is saved until you tap Import.</div>
    <textarea id="import-json" class="import-ta" placeholder="Paste JSON here…" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn bts bsm" onclick="pasteImportFromClipboard()">Paste</button>
      <button class="btn bts bsm" onclick="document.getElementById('import-file').click()">Choose file…</button>
      <input type="file" id="import-file" accept=".json,application/json,text/plain" style="display:none" onchange="loadImportFile(this)">
    </div>
    <div id="import-preview-area"></div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn btp bfw" id="import-go-btn" onclick="doImport()" disabled>Import</button>
      <button class="btn btg" style="padding:11px 16px" onclick="closeOv('import-ov')">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  window._importParsed=null;
  const ta=document.getElementById('import-json');
  ta.addEventListener('input',previewImport);
  if(prefill){ta.value=prefill;previewImport();}
}
async function pasteImportFromClipboard(){
  try{
    const t=await navigator.clipboard.readText();
    if(!t){toast('Clipboard is empty');return;}
    document.getElementById('import-json').value=t;previewImport();
  }catch(e){toast('Could not read the clipboard — long-press the box and choose Paste');}
}
function loadImportFile(inp){
  const f=inp.files&&inp.files[0];if(!f)return;
  if(f.size>2e6){toast('That file is too large to be a program');return;}
  const rd=new FileReader();
  rd.onload=()=>{document.getElementById('import-json').value=String(rd.result||'');previewImport();};
  rd.onerror=()=>toast('Could not read that file','red');
  rd.readAsText(f);inp.value='';
}
function previewImport(){
  const raw=document.getElementById('import-json')?.value?.trim();
  const area=document.getElementById('import-preview-area');
  const btn=document.getElementById('import-go-btn');
  if(!area)return;
  window._importParsed=null;if(btn)btn.disabled=true;
  if(!raw){area.innerHTML='';return;}
  const j=extractJson(raw);
  if(j.value===undefined){area.innerHTML=`<div class="import-warn">Not valid JSON yet: ${esc(j.error)}</div>`;return;}
  if(isObj(j.value)&&Array.isArray(j.value.workouts)&&!j.value.routines&&!j.value.groups||(isObj(j.value)&&'_schema' in j.value)){
    area.innerHTML=`<div class="import-warn">This looks like a full Lah We backup, not a program. Restore backups from Settings → Restore.</div>`;return;
  }
  let parsed;
  try{parsed=parseImport(j.value);}catch(e){area.innerHTML=`<div class="import-warn">Could not read this program: ${esc(e.message)}</div>`;return;}
  if(parsed.error){area.innerHTML=`<div class="import-warn">${esc(parsed.error)}</div>`;return;}
  area.innerHTML=importPreviewHTML(parsed);
  window._importParsed=parsed;if(btn)btn.disabled=false;
}
function doImport(){
  const parsed=window._importParsed;if(!parsed)return;
  window._importParsed=null;
  finishImport(parsed,'import-ov');
}
