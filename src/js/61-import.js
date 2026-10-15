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
  'hand release pushup':'hrpu','hrp':'hrpu','hrpu':'hrpu','sprint drag carry':'sdc','sdc':'sdc','2 mile run':'two-mile','two mile run':'two-mile','2mr':'two-mile',
  'butterfly':'pec-deck','pec fly':'pec-deck','machine fly':'pec-deck','chest fly machine':'pec-deck','machine press':'mach-chest','chest press':'mach-chest',
  'rear delt fly':'rev-fly','reverse fly':'rev-fly','rear delt raise':'rev-fly','bent over reverse fly':'rev-fly','rear delt machine':'rev-pec-deck','reverse machine fly':'rev-pec-deck',
  'seated hamstring curl':'seated-leg-curl','lying hamstring curl':'lying-leg-curl','prone leg curl':'lying-leg-curl','nordic hamstring curl':'nordic','nordic':'nordic',
  'hyperextension':'back-ext','45 degree back extension':'back-ext','single leg rdl':'sl-rdl','one leg rdl':'sl-rdl','single leg romanian deadlift':'sl-rdl',
  'ez curl':'ez-curl','ez bar curl':'ez-curl','dumbbell skullcrusher':'db-skull','rope overhead extension':'cable-oh-ext','overhead cable extension':'cable-oh-ext',
  'kickback':'tri-kickback','dumbbell kickback':'tri-kickback','machine shoulder press':'mach-ohp','seated machine press':'mach-ohp',
  'seated calf':'seated-calf','abductor machine':'hip-abduct','hip abductor':'hip-abduct','pull through':'pull-through','woodchopper':'woodchop',
  'jog':'easy-run','easy jog':'easy-run','run':'easy-run','recovery run':'easy-run','intervals':'interval-run','tempo':'tempo-run','rowing':'rower','row erg':'rower','erg':'rower','exercise bike':'bike-erg','spin bike':'bike-erg','skipping':'jump-rope',
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

// A run, ruck, row or ride: logged as cardio (time and distance) and saved as an activity.
function isCardioName(name){return/\b(run|running|jog|jogging|ruck|rucking|march|rowing|rower|erg|bike|biking|cycling|cycle|spin|swim|swimming|walk|hike|jump rope|skipping|elliptical|stair ?master|treadmill)\b/i.test(String(name||''))&&!/\b(sprint drag|walking lunge|farmer|carry|lunge)\b/i.test(String(name||''));}
function cardioAct(name){
  const n=String(name||'').toLowerCase();
  if(/ruck|march/.test(n))return'ruck';if(/row|erg/.test(n))return'row';if(/bike|cycl|spin/.test(n))return'bike';
  if(/swim/.test(n))return'swim';if(/hike/.test(n))return'hike';if(/walk/.test(n))return'walk';if(/run|jog|treadmill/.test(n))return'run';
  return'other';
}
// A program's name from its phases' names: "AFT Mass 1 - Foundation", "AFT Mass 2 - Build" → "AFT Mass".
function importProgramName(names){
  names=(names||[]).map(n=>String(n||'').trim()).filter(Boolean);
  if(!names.length)return'Program';
  if(names.length===1)return names[0].replace(/\s*[-–:·|]\s*(phase|block|week|wk)?\s*\d+.*$/i,'').trim()||names[0];
  let pre=names[0];names.forEach(n=>{while(pre&&!n.toLowerCase().startsWith(pre.toLowerCase()))pre=pre.slice(0,-1);});
  pre=pre.replace(/[\s\d\-–:·|]+$/,'').trim();
  const bare=pre.replace(/\b(phase|block|week|wk)$/i,'').replace(/[\s\-–:·|]+$/,'').trim();
  return bare.length>=3?bare:pre.length>=3?pre:names[0];
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
  const out={r:'',rMax:'',amrap:false,timed:false,dist:false,extra:''};
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
    else if((m=s.match(new RegExp('^(\\d+(?:\\.\\d+)?)(?:\\s*-\\s*(\\d+(?:\\.\\d+)?))?\\s*('+DIST+')\\b')))){
      // A distance ("50m", "40 yd"): the target is metres.
      const f=/^(yd|yds|yard)/.test(m[3])?0.9144:/^(ft|feet)/.test(m[3])?0.3048:1;
      out.dist=true;out.r=String(Math.round(parseFloat(m[1])*f));if(m[2])out.rMax=String(Math.round(parseFloat(m[2])*f));s=s.slice(m[0].length);
    }
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
  if(out.timed||out.dist)out.amrap=false;
  if(e.distance!=null&&parseFloat(e.distance)>0&&!out.r){out.dist=true;out.r=String(Math.round(parseFloat(e.distance)));}
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
  if(!isObj(d))return{error:'That is not a split or program file. Expected an object with "routines" or "groups".'};
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
    if(reps.dist)out.dist=true;
    const rir=e.rir!=null&&e.rir!==''?parseInt(e.rir):NaN;
    if(rir>=0&&rir<=10)out.rir=Math.min(4,rir);
    else{const m=String(e.note||e.notes||'').match(/\bRIR\s*(\d)/i);if(m)out.rir=Math.min(4,parseInt(m[1]));}
    if(match){
      if(match.ex.kind==='cardio'&&!out.timed&&!out.dist){out.timed=true;if(!out.r)out.r='';}
      out.exId=match.ex.id;out._name=match.ex.name;out._given=name;out._how=match.how;
      if(match.ex.archived)out._revive=true;
      if(match.note)warn(match.note);
    }else{
      const key=exNameKey(name)||name.toLowerCase();
      if(!newEx.has(key)){
        const given=str(e.muscle||'',40);
        let muscle=normMuscle(given);
        if(/^(shoulders?|delts?|deltoids?)$/i.test(given.trim()))muscle=shoulderHead(name);
        const cardio=isCardioName(name)&&!MEV_MAV[muscle];
        if(cardio)muscle='';
        else if(!MEV_MAV[muscle]){
          const g=guessMuscle(name);
          if(e.muscle)warn(`"${name}": "${given}" is not a tracked muscle${g?` — using ${g}`:''}`);
          else warn(`"${name}": no muscle given${g?` — guessed ${g}`:' — it will not count toward any muscle'}`);
          muscle=g;
        }
        const eq=normEquipment(e.equipment||e.eq)||guessEq(name);
        const sec=[...new Set((Array.isArray(e.secondaryMuscles)?e.secondaryMuscles:[]).map(normMuscle))].filter(m=>MEV_MAV[m]&&m!==muscle);
        const n={key,name,cat:cardio?'Cardio':(MUSCLE_CAT[muscle]||'Full Body'),eq,muscle,sec};
        if(cardio){n.kind='cardio';n.act=cardioAct(name);n.sec=[];}
        newEx.set(key,n);
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
      else if(ks.length>=4)warn(`"${name}": ${ks.length} exercises share superset ${l}. Two neighbouring supersets need different labels, or they become one group`);
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
    const deload=!!(g&&(g.deloadLastWeek===true||g.deload===true||g.deload_last_week===true));
    groups.push({name:str(g&&g.name,60)||'Imported split',mode,weeks,deload,daysPerWeek:dpw>=1&&dpw<=7?dpw:0,_start:start,_count:count});
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
  // Groups that all have a length make a program (one phase or several).
  const phased=groups.length>=1&&groups.every(g=>g.weeks>0);
  const pin=isObj(d.program)?d.program:{};
  const program=phased?{name:str(pin.name||d.programName||importProgramName(groups.map(g=>g.name)),60),notes:str(pin.notes||'',600)}:null;
  return{routines,groups,newExercises,warnings,dupes,phased,timed:phased,program};
}

// ─── Commit ───
// opts: {replace: overwrite same-named routines/groups in place, program: start the phases as a program}
function commitImport(parsed,opts){
  opts=opts||{};
  const idByKey={};
  parsed.newExercises.forEach(n=>{
    const id=`custom-${uid()}`;idByKey[n.key]=id;
    const c={id,name:n.name,cat:n.cat,eq:n.eq,muscle:n.muscle,sec:n.sec};if(n.kind){c.kind=n.kind;c.act=n.act;}
    S.custom.push(c);
    if(n.sec.length)SEC_MUSCLE[id]=n.sec;
  });
  _exIdx=null;
  const rids=parsed.routines.map(r=>{
    const exercises=r.exercises.map(e=>{
      const exId=e.exId||idByKey[e._newKey];
      if(e._revive){const ex=getEx(exId);if(ex)ex.archived=false;}
      const o={exId,sets:e.sets,w:e.w,r:e.r,type:e.type,rest:e.rest,link:e.link};
      if(e.rMax)o.rMax=e.rMax;if(e.amrap)o.amrap=true;if(e.timed)o.timed=true;if(e.dist)o.dist=true;if(e.rir!=null)o.rir=e.rir;if(e.note)o.note=e.note;
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
  let programStarted=false,programId=null;
  if(opts.program&&parsed.phased&&gids.length){
    const name=String(opts.programName||(parsed.program&&parsed.program.name)||'Program').replace(/\s+/g,' ').trim().slice(0,60)||'Program';
    const p={id:uid(),name,notes:(parsed.program&&parsed.program.notes)||'',phases:parsed.groups.map((g,i)=>({groupId:gids[i],weeks:g.weeks,deload:!!g.deload})),status:'saved',createdAt:Date.now()};
    S.programs.push(p);programId=p.id;bumpMemo();
    if(opts.start){
      const cur=runningProgram();if(cur){cur.status='paused';cur.pausedAt=Date.now();}
      p.status='running';p.startedAt=Date.now();resolveProgramGroup();programStarted=true;
    }
  }else if(gids.length&&(!getActiveGroup()||opts.activate)){
    S.groups.forEach(g=>{g.active=g.id===gids[0];});
    const rp=runningProgram();if(opts.activate&&rp){rp.status='paused';rp.pausedAt=Date.now();}
  }
  rebuildPRs();saveNow();
  return{rids,gids,programStarted,programId};
}

// ─── Preview (shared with the coach's review sheet) ───
// opts.fix: rows can be tapped to change what an exercise matched (the paste importer).
function importPreviewHTML(parsed,o){
  o=o||{};
  const exRow=e=>{
    const tgt=fmtTarget(e);
    const renamed=e._how!=='new'&&e._given&&exNameKey(e._given)!==exNameKey(e._name);
    const inner=`<div style="flex:1;min-width:0">
        <div class="ip-exn">${esc(e._name)}${e._how==='new'?' <span class="badge ba">New</span>':''}${e._how==='manual'?' <span class="badge bp">Picked</span>':''}${e.link?` <span class="badge bp">${esc(e.link)}</span>`:''}</div>
        ${renamed?`<div class="ip-exs">from “${esc(e._given)}”</div>`:''}${e.note?`<div class="ip-exs">${esc(e.note)}</div>`:''}
      </div><div class="ip-tgt">${esc(tgt)}${e.rir!=null?`<span> · ${fmtRir(e.rir)} in reserve</span>`:''}${e.rest!=null?`<span> · ${e.rest}s</span>`:''}</div>`;
    return o.fix&&e._given?`<button class="ip-ex ip-fix" onclick="impFixSheet(${jsq(e._given)})">${inner}</button>`:`<div class="ip-ex">${inner}</div>`;
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
    html+=`<div class="ip-g">📁 ${esc(g.name)} <span>${g.mode==='daypicker'?'fixed weekdays':'rotation'}${g.weeks?` · ${g.weeks} wk`:''}${g.deload?' · deload last week':''}</span></div>`;
    for(let i=g._start;i<g._start+g._count;i++){grouped.add(i);html+=rtn(parsed.routines[i]);}
  });
  parsed.routines.forEach((r,i)=>{if(!grouped.has(i))html+=rtn(r);});
  if(parsed.newExercises.length){
    html+=`<div class="ip-g">New custom exercises <span>${parsed.newExercises.length}</span></div>`+
      parsed.newExercises.map(n=>{const inner=`<div style="flex:1;min-width:0"><div class="ip-exn">${esc(n.name)}</div><div class="ip-exs">${esc(n.cat)} · ${esc(n.eq)} · ${n.kind==='cardio'?'cardio, saved as an activity':n.muscle?esc(n.muscle):'no muscle'}${n.sec.length?' (+'+esc(n.sec.join(', '))+')':''}</div></div>`;
        return o.fix?`<button class="ip-ex ip-fix" onclick="impFixSheet(${jsq(n.name)})">${inner}</button>`:`<div class="ip-ex">${inner}</div>`;}).join('');
  }
  let opts='';
  if(parsed.dupes.length)opts+=`<label class="ip-opt"><input type="checkbox" id="imp-replace"><span>Replace my existing <b>${esc(parsed.dupes.slice(0,3).join(', '))}${parsed.dupes.length>3?'…':''}</b> instead of adding duplicates (history is kept)</span></label>`;
  const rp=runningProgram();
  if(parsed.phased){
    const total=parsed.groups.reduce((t,g)=>t+g.weeks,0);
    opts+=`<label class="ip-opt"><input type="checkbox" id="imp-program" checked onchange="document.getElementById('imp-pbox').style.display=this.checked?'':'none'"><span>Save as a program: ${parsed.groups.length} phase${parsed.groups.length===1?'':'s'}, ${total} weeks (${parsed.groups.map(g=>g.weeks+' wk').join(' → ')})</span></label>
      <div id="imp-pbox"><div class="fg" style="margin:6px 0 4px 28px"><input type="text" id="imp-pname" maxlength="60" value="${esc(parsed.program&&parsed.program.name||'')}" placeholder="Program name" aria-label="Program name"></div>
      <label class="ip-opt"><input type="checkbox" id="imp-start"${rp?'':' checked'}><span>Start it now${rp?` (pauses ${esc(rp.name)}, which keeps its place)`:''}</span></label></div>`;
  }
  else if(parsed.groups.length&&getActiveGroup())opts+=`<label class="ip-opt"><input type="checkbox" id="imp-activate"><span>Make <b>${esc(parsed.groups[0].name)}</b> the split in use now</span></label>`;
  const warn=parsed.warnings.length?`<div class="import-warn">${parsed.warnings.map(esc).join('<br>')}</div>`:'';
  return`${o.fix?'<div class="fine" style="margin:8px 0 2px">Tap an exercise to change what it matched.</div>':''}<div class="import-preview">${html}</div>${warn}${opts}`;
}
function importOptsFromDOM(){
  const on=id=>!!document.getElementById(id)?.checked;
  return{replace:on('imp-replace'),program:on('imp-program'),start:on('imp-start'),activate:on('imp-activate'),
    programName:(document.getElementById('imp-pname')?.value||'').trim()};
}
function finishImport(parsed,ovId){
  const res=commitImport(parsed,importOptsFromDOM());
  closeOv(ovId);
  const n=parsed.routines.length,g=parsed.groups.length;
  const p=res.programId?programById(res.programId):null;
  toast(p?`${p.name} saved${res.programStarted?' and started':''} · ${n} workout${n>1?'s':''}`:`Imported ${n} routine${n>1?'s':''}${g?` + ${g} group${g>1?'s':''}`:''}`,'green');
  S.libTab=g?'groups':'routines';
  if(S.tab==='library')renderLibrary(document.getElementById('content'));else go('library');
  if(p)setTimeout(()=>showProgram(p.id),300);
}

// ─── Fixing a match in the preview ───
function impRows(key){const P=window._importParsed;if(!P)return[];const out=[];P.routines.forEach(r=>r.exercises.forEach(e=>{if(e._given&&exNameKey(e._given)===key)out.push(e);}));return out;}
function impRefresh(){
  const P=window._importParsed;const area=document.getElementById('import-preview-area');if(!P||!area)return;
  const keep=importOptsFromDOM();
  const used=new Set();P.routines.forEach(r=>r.exercises.forEach(e=>{if(e._newKey)used.add(e._newKey);}));
  P.newExercises=P.newExercises.filter(n=>used.has(n.key));
  area.innerHTML=importPreviewHTML(P,{fix:true});
  [['imp-replace','replace'],['imp-program','program'],['imp-start','start'],['imp-activate','activate']].forEach(([id,k])=>{const el=document.getElementById(id);if(el)el.checked=!!keep[k];});
  const pn=document.getElementById('imp-pname');if(pn&&keep.programName)pn.value=keep.programName;
  const box=document.getElementById('imp-pbox');if(box&&!keep.program&&document.getElementById('imp-program'))box.style.display='none';
}
function impFixSheet(given){
  const P=window._importParsed;if(!P)return;
  const key=exNameKey(given)||String(given).toLowerCase();const rows=impRows(key);
  const n=P.newExercises.find(x=>x.key===key);
  const cur=rows[0];const isNew=!!(cur&&cur._how==='new')||(!cur&&n);
  const ov=makeOv('impfix-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div>
    <div class="mt" style="margin-bottom:2px">“${esc(given)}”</div>
    <div class="sheet-sub">${isNew?'Will be created as a new exercise':`Matched to ${esc(cur?cur._name:'')}`}${rows.length>1?` · used ${rows.length} times`:''}</div>
    ${isNew&&n?`<div class="fg"><label class="fl">Counts toward</label><select onchange="impSetMuscle(${jsq(key)},this.value)">${['',...Object.keys(MEV_MAV)].map(m=>`<option value="${esc(m)}"${n.muscle===m?' selected':''}>${m?esc(m):'No muscle (cardio or other)'}</option>`).join('')}</select></div>`
      :`<button class="btn bts bfw" style="margin-bottom:10px" onclick="impSetNew(${jsq(given)})">Make it a new exercise instead</button>`}
    <div class="sec-h">Or use one from the catalog</div>
    <div class="lib-search"><span class="lib-search-ic">${ICON('search',17)}</span><input id="impfix-q" type="search" placeholder="Search exercises" value="${esc(given)}" oninput="impFixList(${jsq(key)})" autocomplete="off"></div>
    <div id="impfix-list"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);impFixList(key);
}
function impFixList(key){
  const el=document.getElementById('impfix-list');if(!el)return;
  const q=(document.getElementById('impfix-q')?.value||'').trim();
  const words=q.toLowerCase().split(/\s+/).filter(Boolean);const al=libAliasIds(q);
  let list=allEx().filter(e=>!words.length||words.some(w=>e.name.toLowerCase().includes(w))||al.has(e.id));
  // Closest first: every word present, then the alias, then any word.
  const score=e=>{const n=e.name.toLowerCase();return(words.every(w=>n.includes(w))?2:0)+(al.has(e.id)?1:0);};
  list=list.sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name)).slice(0,30);
  el.innerHTML=list.length?`<div class="list">${list.map(e=>`<button class="row row-tap" onclick="impSetMatch(${jsq(key)},${jsq(e.id)})"><span class="row-main"><span class="row-t">${esc(e.name)}</span><span class="row-s">${esc(e.cat)} · ${esc(e.eq)}</span></span></button>`).join('')}</div>`:'<div class="ch-empty">Nothing matches. Try fewer words.</div>';
}
function impSetMatch(key,exId){
  const ex=getEx(exId);if(!ex)return;
  impRows(key).forEach(e=>{e.exId=exId;e._name=ex.name;e._how='manual';delete e._newKey;if(ex.archived)e._revive=true;else delete e._revive;if(ex.kind==='cardio'&&!e.timed&&!e.dist)e.timed=true;});
  closeOv('impfix-ov');impRefresh();
}
function impSetNew(given){
  const P=window._importParsed;if(!P)return;
  const key=exNameKey(given)||String(given).toLowerCase();
  if(!P.newExercises.some(n=>n.key===key)){
    const cardio=isCardioName(given);let muscle=cardio?'':guessMuscle(given);
    const n={key,name:given,cat:cardio?'Cardio':(MUSCLE_CAT[muscle]||'Full Body'),eq:guessEq(given),muscle,sec:[]};if(cardio){n.kind='cardio';n.act=cardioAct(given);}
    P.newExercises.push(n);
  }
  impRows(key).forEach(e=>{delete e.exId;delete e._revive;e._newKey=key;e._how='new';e._name=given;});
  closeOv('impfix-ov');impRefresh();
}
function impSetMuscle(key,m){
  const P=window._importParsed;const n=P&&P.newExercises.find(x=>x.key===key);if(!n)return;
  n.muscle=MEV_MAV[m]?m:'';n.cat=n.muscle?(MUSCLE_CAT[n.muscle]||n.cat):n.cat;n.sec=n.sec.filter(x=>x!==n.muscle);
  impRefresh();
}

// ─── Plain text, no AI ───
// "Upper A" on a line, then "Bench Press 4x8-10 90s" lines: day headings and exercise lines with
// sets x reps, optional rest and a note. "3 sets of 10", "4×5", "3x45s", "2x10 each side", "AMRAP" all work.
const _PT_DAY=/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day|nesday|sday|urday)?\b/gi;
function parsePlainProgram(text){
  const lines=String(text||'').split(/\r?\n/).map(l=>l.replace(/^\s*(?:[-•*·▪︎◦]|\d+[.)])\s*/,'').replace(/\s+/g,' ').trim()).filter(Boolean);
  const routines=[];let cur=null;let anyDays=false;
  const exRe=/^(.+?)[\s:,–-]+(\d{1,2})\s*(?:[x×*]|sets?\s*(?:of|x)?)\s*(\d+(?:\s*[-–]\s*\d+)?\s*(?:s|sec|secs|seconds|min|mins|minutes|m|yd)?\+?|\d+:\d{2}|amrap|max)\b(.*)$/i;
  const exRe2=/^(.+?)[\s:,–-]+(\d+(?:\s*[-–]\s*\d+)?)\s*reps?\b(.*)$/i;
  lines.forEach(l=>{
    let m=l.match(exRe),name,sets,reps,rest='';
    if(m){name=m[1];sets=m[2];reps=m[3];rest=m[4]||'';}
    else if((m=l.match(exRe2))){name=m[1];sets=3;reps=m[2];rest=m[3]||'';}
    if(name&&/[a-z]/i.test(name)){
      if(!cur){cur={name:`Workout ${routines.length+1}`,exercises:[],days:[]};routines.push(cur);}
      const e={name:name.replace(/[\s:,–-]+$/,'').trim(),sets:parseInt(sets)||3,reps:String(reps).replace(/\s+/g,'')};
      const rr=rest.match(/(?:rest\s*)?(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds|min|mins|minutes|')\b(?:\s*rest)?/i);
      if(rr){e.rest=Math.round(parseFloat(rr[1])*(/^m|'/.test(rr[2])?60:1));rest=rest.replace(rr[0],'');}
      const note=rest.replace(/^[\s,;–-]+|[\s,;–-]+$/g,'');if(note)e.note=note;
      cur.exercises.push(e);
    }else if(l.length<=60){
      const days=[];(l.match(_PT_DAY)||[]).forEach(d=>days.push(d));if(days.length)anyDays=true;
      cur={name:l.replace(/[:\-–]+$/,'').trim(),exercises:[],days};routines.push(cur);
    }
  });
  const rs=routines.filter(r=>r.exercises.length);
  if(!rs.length)return null;
  return anyDays&&rs.some(r=>r.days.length)?{groups:[{name:'Imported split',mode:'daypicker',routines:rs}]}:{routines:rs};
}

// ─── The prompt for another assistant ───
function importPromptText(){
  const cats=CATS.filter(c=>c!=='All');
  const cat=cats.map(c=>`${c}: `+EXERCISES.filter(e=>e.cat===c).map(e=>e.name).join(', ')).join('\n');
  return`Convert the workout program I give you into JSON for the "Lah We" app. Return ONLY the JSON object.

{"program":{"name":"<program name>","notes":"<one line>"},
 "groups":[{"name":"<phase name>","mode":"daypicker" or "rotation","weeks":<length, 0 if not phased>,"deloadLastWeek":false,
   "routines":[{"name":"<day name>","notes":"","days":["Mon"],"exercises":[<exercise>, ...]}]}]}

One group per phase with genuinely different exercises, in order, each with "weeks". One routine per training day; "days" only for fixed weekdays.

EXERCISE: {"name":"Barbell Bench Press","sets":4,"reps":"6-8","rest":150,"rir":2,"type":"flat","link":null,"note":""}
- reps: 10 · "8-12" · "AMRAP" · "10+" · "45s" · "1:30" · "20 min" · "50m" (a distance)
- sets are WORKING sets; the app adds warm-ups. rir = reps to leave in reserve (0-4), if the program says.
- type: "flat", "ascend" (weight up each set) or "descend" (drop sets). link: the same letter on consecutive exercises makes a superset.
- Use the catalog name below when it is the same movement and equipment; then nothing else is needed.
- For anything not in the catalog keep the program's name and add "equipment" (Barbell, Dumbbell, Kettlebell, Machine, Cable, Bodyweight, Medicine Ball, Other), "muscle" and "secondaryMuscles" from: ${Object.keys(MEV_MAV).join(', ')}.
- Runs, rucks, rows and rides: use "reps":"20 min" and no muscle; they are logged as cardio.
- Do not include weights. Do not invent, drop or swap exercises.

CATALOG
${cat}

Here is the program:
`;
}
async function copyImportPrompt(){
  const t=importPromptText();
  try{await navigator.clipboard.writeText(t);toast('Prompt copied. Paste it into any chat assistant with your program.','green',{ms:4000});return;}catch(e){}
  const ov=makeOv('prompt-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt">The prompt</div><div class="sheet-sub">Select all and copy it, then paste it into a chat assistant with your program.</div><textarea class="import-ta" readonly style="min-height:50vh">${esc(t)}</textarea></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  setTimeout(()=>{const ta=ov.querySelector('textarea');if(ta){ta.focus();ta.select();}},250);
}

// ─── Paste import sheet ───
function showImportUI(prefill){
  const ov=makeOv('import-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt">Import</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.5">Paste a program: plain lines like <b>Bench Press 4x8-10 90s</b> under day headings, or JSON from a chat assistant. Nothing is saved until you tap Import.</div>
    <textarea id="import-json" class="import-ta" placeholder="Upper A&#10;Bench Press 4x6-8 150s&#10;Barbell Row 4x8-10&#10;&#10;Lower A&#10;Back Squat 4x5" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      <button class="btn bts bsm" onclick="pasteImportFromClipboard()">Paste</button>
      <button class="btn bts bsm" onclick="document.getElementById('import-file').click()">Choose file…</button>
      <button class="btn bts bsm" onclick="copyImportPrompt()">${ICON('clip',13)} Copy the prompt</button>
      <input type="file" id="import-file" accept=".json,.txt,application/json,text/plain" style="display:none" onchange="loadImportFile(this)">
    </div>
    <div class="fine" style="margin-top:6px">Have a PDF or screenshot? Copy the prompt, give it and the program to any chat assistant, and paste back what it returns.</div>
    <div id="import-preview-area"></div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn btp bfw" id="import-go-btn" onclick="doImport()" disabled style="display:none">Import</button>
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
  if(f.size>2e6){toast('That file is too large to be a split or program');return;}
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
  window._importParsed=null;if(btn){btn.disabled=true;btn.style.display='none';}
  if(!raw){area.innerHTML='';return;}
  const j=extractJson(raw);
  let data=j.value;
  if(data===undefined){
    // Not JSON: read it as plain lines. Text that looks like broken JSON says so instead.
    if(/^\s*[\[{]/.test(raw)){area.innerHTML=`<div class="import-warn">Not valid JSON yet: ${esc(j.error)}</div>`;return;}
    data=parsePlainProgram(raw);
    if(!data){area.innerHTML=`<div class="import-warn">No exercises found yet. Write one per line with sets and reps, like “Bench Press 4x8”.</div>`;return;}
  }
  if(isObj(data)&&Array.isArray(data.workouts)&&!data.routines&&!data.groups||(isObj(data)&&'_schema' in data)){
    area.innerHTML=`<div class="import-warn">This looks like a full Lah We backup, not a split or program. Restore backups from Settings → Restore.</div>`;return;
  }
  let parsed;
  try{parsed=parseImport(data);}catch(e){area.innerHTML=`<div class="import-warn">Could not read this file: ${esc(e.message)}</div>`;return;}
  if(parsed.error){area.innerHTML=`<div class="import-warn">${esc(parsed.error)}</div>`;return;}
  window._importParsed=parsed;
  area.innerHTML=importPreviewHTML(parsed,{fix:true});
  if(btn){btn.disabled=false;btn.style.display='';}
}
function doImport(){
  const parsed=window._importParsed;if(!parsed)return;
  window._importParsed=null;
  finishImport(parsed,'import-ov');
}
