// ═══════════════════════════════════════════════════
// GEAR — the bar, the plates and dumbbells you own, and weight steps
// ═══════════════════════════════════════════════════
// Settings → Workout → Plates & dumbbells. With "Only what I own" the plate calculator loads from
// the pairs listed, and the swipe-card steppers and next-session targets move between weights that
// can actually be loaded. Dumbbells, when listed, work the same way for dumbbell lifts. With nothing
// set up everything behaves as before: any weight, the built-in steps.
// Stored in the weight unit in use; switching the unit resets them (a 45 lb plate is not 20.4 kg).
const STEP_EQ=['Barbell','Dumbbell','Machine','Cable'];
function stepOptions(){return isKg()?[1,1.25,2.5,5]:[2.5,5,10];}
function barOptions(){return isKg()?[20,15,10]:[45,35,25,15];}
function plateSizes(){return isKg()?[25,20,15,10,5,2.5,1.25,0.5]:[45,35,25,10,5,2.5,1.25];}
function defaultPlates(){
  return isKg()?{'25':2,'20':2,'15':1,'10':2,'5':2,'2.5':2,'1.25':1,'0.5':0}
    :{'45':3,'35':1,'25':1,'10':2,'5':1,'2.5':1,'1.25':0};
}
// Weights exactly as owned: 1.25 stays 1.25 (fmt1 would round it to 1.3).
function fmtW(v){const n=Math.round((parseFloat(v)||0)*100)/100;return String(n);}
function gearBar(){const b=S.gear&&parseFloat(S.gear.bar);return b>0?b:barOptions()[0];}
function gearFixed(){return !!(S.gear&&S.gear.mode==='fixed');}
// Pairs of each plate size owned ({'45':3,…}), filled in for sizes never touched.
function gearPlates(){
  const d=defaultPlates();const p=(S.gear&&S.gear.plates)||{};
  const out={};plateSizes().forEach(w=>{const k=String(w);out[k]=p[k]!=null?Math.max(0,Math.min(20,parseInt(p[k])||0)):d[k];});
  return out;
}
function gearResetForUnit(){S.gear={mode:S.gear&&S.gear.mode==='fixed'?'fixed':'standard',bar:null,plates:null,dbs:''};S.steps={};_loadMemo=null;}

// ─── What can be loaded ───
// Plate maths in hundredths, so 1.25 and 2.5 add up exactly.
const _c=v=>Math.round(v*100);
// Every per-side load reachable with the pairs owned → the fewest plates that make it. Each entry
// points back at the one it was built from, so nothing is copied (a full kg set has thousands).
function plateCombos(counts){
  let reach=new Map([[0,{n:0,w:0,k:0,prev:null}]]);
  plateSizes().forEach(w=>{
    const n=counts[String(w)]||0;if(!n)return;
    const next=new Map(reach);
    reach.forEach((e,sum)=>{
      for(let k=1;k<=n;k++){
        const s=sum+_c(w)*k;const old=next.get(s);
        if(!old||old.n>e.n+k)next.set(s,{n:e.n+k,w,k,prev:e});
      }
    });
    reach=next;
  });
  return reach;
}
// The plates of one entry, biggest first.
function comboPlates(e){const out=[];while(e&&e.k){for(let i=0;i<e.k;i++)out.push(e.w);e=e.prev;}return out.sort((a,b)=>b-a);}
let _loadMemo=null;
function barbellLoads(){
  const key=[S.unit,gearBar(),JSON.stringify(gearPlates())].join('|');
  if(_loadMemo&&_loadMemo.key===key)return _loadMemo;
  const combos=plateCombos(gearPlates());const bar=gearBar();
  const totals=[...combos.keys()].map(s=>Math.round((bar+2*s/100)*100)/100).sort((a,b)=>a-b);
  _loadMemo={key,combos,totals};
  return _loadMemo;
}
// "5-50, 55, 60/2.5" → [5,10,…,50,55,60]. A range steps by 5 lb (2 kg) unless "/step" says otherwise.
function parseDumbbells(txt){
  const out=new Set();const def=isKg()?2:5;
  String(txt||'').split(/[,;\s]+/).forEach(part=>{
    const m=part.match(/^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?(?:\/(\d+(?:\.\d+)?))?$/);if(!m)return;
    const a=parseFloat(m[1]);const b=m[2]!=null?parseFloat(m[2]):null;const st=m[3]!=null?parseFloat(m[3]):def;
    if(b==null){if(a>0&&a<=300)out.add(a);return;}
    if(!(b>=a&&st>0))return;
    for(let v=a,i=0;v<=b+1e-9&&i<200;v+=st,i++)if(v>0&&v<=300)out.add(Math.round(v*100)/100);
  });
  return [...out].sort((x,y)=>x-y);
}
function gearDumbbells(){return parseDumbbells(S.gear&&S.gear.dbs);}
// The weights a lift can be loaded to, or null when any weight goes (no limits set for it).
function loadOptions(eq){
  if(eq==='Barbell'&&gearFixed())return barbellLoads().totals;
  if(eq==='Dumbbell'){const d=gearDumbbells();return d.length?d:null;}
  return null;
}
// The next weight up (dir 1) or down (dir -1) from w that can be loaded. Without limits: the step.
function nextLoad(eq,w,dir){
  w=parseFloat(w)||0;const opts=loadOptions(eq);
  if(!opts){const v=w+dir*loadInc(eq,w);return Math.max(0,Math.round(v*100)/100);}
  if(dir>0){const v=opts.find(x=>x>w+1e-9);return v!=null?v:opts[opts.length-1];}
  for(let i=opts.length-1;i>=0;i--)if(opts[i]<w-1e-9)return opts[i];
  return w>0&&w<=opts[0]?0:opts[0];
}
// The loadable weight at or past w in the direction given (0 = nearest), or w itself without limits.
function snapLoad(eq,w,dir){
  const opts=loadOptions(eq);w=parseFloat(w)||0;if(!opts||!opts.length)return w;
  if(dir>0){const v=opts.find(x=>x>=w-1e-9);return v!=null?v:opts[opts.length-1];}
  if(dir<0){for(let i=opts.length-1;i>=0;i--)if(opts[i]<=w+1e-9)return opts[i];return opts[0];}
  return opts.reduce((b,x)=>Math.abs(x-w)<Math.abs(b-w)?x:b,opts[0]);
}
// Plates for one side of the bar. Fixed: exactly from the pairs owned, or the closest below.
// Standard: as many of each size as it takes, biggest first.
function platesFor(target,bar){
  const side=(target-bar)/2;
  if(side<0)return{under:true};
  if(gearFixed()){
    const{combos}=barbellLoads();const want=_c(side);
    if(combos.has(want))return{plates:comboPlates(combos.get(want)),rem:0,exact:true};
    let best=0;combos.forEach((p,s)=>{if(s<=want&&s>best)best=s;});
    let up=null;combos.forEach((p,s)=>{if(s>want&&(up==null||s<up))up=s;});
    return{plates:comboPlates(combos.get(best)),rem:(want-best)/100,exact:false,
      below:Math.round((bar+2*best/100)*100)/100,above:up==null?null:Math.round((bar+2*up/100)*100)/100};
  }
  let rem=side;const plates=[];
  plateSizes().filter(p=>p>=1.25).forEach(p=>{const n=Math.floor(rem/p+0.001);for(let i=0;i<n;i++)plates.push(p);rem-=p*n;});
  return{plates,rem:rem>0.01?rem:0,exact:rem<=0.01};
}
function gearSummary(){
  const parts=[`${fmtW(gearBar())} ${S.unit} bar`];
  if(gearFixed()){const t=barbellLoads().totals;parts.push(t.length>1?`loads ${fmtW(t[0])}–${fmtW(t[t.length-1])}`:'no plates');}
  else parts.push('any weight');
  const d=gearDumbbells();if(d.length)parts.push(`${d.length} dumbbell${d.length===1?'':'s'}`);
  return parts.join(' · ');
}

// ─── The sheet ───
function showGear(){
  const ov=makeOv('gear-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:2px">Plates &amp; dumbbells</div><div id="gear-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  ov._onDismiss=()=>{gearSaveDbs();if(typeof refreshSettings==='function')refreshSettings();};
  renderGear();
}
function renderGear(){
  const el=document.getElementById('gear-body');if(!el)return;
  const u=S.unit;const bar=gearBar();const fixed=gearFixed();const pl=gearPlates();
  let h=`<div class="sheet-sub">The plate calculator, the swipe-card steppers and next-session targets only use weights you can load.</div>
    <div class="set-lbl" style="margin:4px 0 6px">Bar</div>
    <div class="seg seg-in" style="margin-top:0" role="radiogroup" aria-label="Bar">${barOptions().map(b=>`<button class="seg-b${b===bar?' on':''}" role="radio" aria-checked="${b===bar}" onclick="gearSet('bar',${b})">${b} ${u}</button>`).join('')}</div>
    <div class="set-lbl" style="margin:16px 0 6px">Plates</div>
    <div class="seg seg-in" style="margin-top:0" role="radiogroup" aria-label="Plates">
      <button class="seg-b${fixed?'':' on'}" role="radio" aria-checked="${!fixed}" onclick="gearSet('mode','standard')">Any weight</button>
      <button class="seg-b${fixed?' on':''}" role="radio" aria-checked="${fixed}" onclick="gearSet('mode','fixed')">Only what I own</button></div>`;
  if(fixed){
    const t=barbellLoads().totals;
    h+=`<div class="fine" style="margin:12px 2px 6px">Pairs you own of each plate</div><div class="gear-plates">${plateSizes().map(w=>{const k=String(w);const n=pl[k];
      return`<div class="gear-pl${n?'':' none'}"><span class="gear-w">${k}<small>${u}</small></span>
        <span class="gear-st"><button class="sw-st" onclick="gearPlate(${jsq(k)},-1)" aria-label="One pair fewer of ${k} ${u}"${n?'':' style="visibility:hidden"'}>−</button><b aria-label="${n} pairs">${n}</b><button class="sw-st" onclick="gearPlate(${jsq(k)},1)" aria-label="One more pair of ${k} ${u}">+</button></span></div>`;}).join('')}</div>
      <div class="fine">${t.length>1?`Loads <b>${fmtW(t[0])}–${fmtW(t[t.length-1])} ${u}</b> on the ${fmtW(bar)} ${u} bar, ${t.length} different weights.`:'Add some plates to load the bar.'}</div>`;
  }
  const d=gearDumbbells();
  h+=`<div class="set-lbl" style="margin:16px 0 6px">Dumbbells<small>${d.length?`${d.length} weight${d.length===1?'':'s'}: ${esc(dbRangeText(d))}`:'Any weight. List yours to step between them'}</small></div>
    <input id="gear-dbs" value="${esc((S.gear&&S.gear.dbs)||'')}" placeholder="${isKg()?'2-30, 32.5, 35':'5-50, 55, 60'}" onchange="gearSaveDbs(true)" autocomplete="off" autocapitalize="off">
    <div class="fine">Ranges step by ${isKg()?'2 kg':'5 lb'}; add /2.5 for another step (${isKg()?'2-20/1':'5-25/2.5'}).</div>`;
  el.innerHTML=h;
}
function dbRangeText(d){
  if(d.length<=6)return d.map(fmt1).join(', ');
  return`${fmtW(d[0])} – ${fmtW(d[d.length-1])}`;
}
function gearSet(k,v){
  if(!isObj(S.gear))S.gear={mode:'standard',bar:null,plates:null,dbs:''};
  if(k==='bar'&&barOptions().includes(v))S.gear.bar=v;
  if(k==='mode'){S.gear.mode=v==='fixed'?'fixed':'standard';if(S.gear.mode==='fixed'&&!S.gear.plates)S.gear.plates=defaultPlates();}
  _loadMemo=null;save();renderGear();
}
function gearPlate(k,d){
  const pl=gearPlates();pl[k]=Math.max(0,Math.min(20,(pl[k]||0)+d));
  S.gear.plates=pl;_loadMemo=null;save();renderGear();
}
function gearSaveDbs(redraw){
  const el=document.getElementById('gear-dbs');if(!el)return;
  const v=String(el.value||'').trim().slice(0,200);
  if(v===(S.gear.dbs||''))return;
  S.gear.dbs=v;save();if(redraw)renderGear();
}

// ─── Steps ───
function stepFor(eq){const v=S.steps&&parseFloat(S.steps[eq]);return v>0?v:null;}
function stepsSummary(){
  const set=STEP_EQ.filter(e=>stepFor(e));
  return set.length?set.map(e=>`${e.toLowerCase()} ${fmtW(stepFor(e))}`).join(' · '):'Built-in';
}
function setStep(eq,v){
  if(!STEP_EQ.includes(eq))return;
  if(!isObj(S.steps))S.steps={};
  if(v&&stepOptions().includes(v))S.steps[eq]=v;else delete S.steps[eq];
  save();if(typeof setPageRefresh==='function')setPageRefresh();
}
