// ═══════════════════════════════════════════════════
// CUSTOM CHARTS — charts you build yourself, kept on the Progress board
// ═══════════════════════════════════════════════════
// A custom chart is a saved question put to the same flat tables the coach reads
// (65b-coach-data.js), so a number here means what it means everywhere else in the app:
//   a table · a measure (a column and how to sum it up, or a count) · filters on that table ·
//   how the rows are grouped (day, week, month, weekday, or a column such as exercise or muscle).
// A second series can be laid over the first. With two lines over time both start at 100 by
// default, so a percentage change in one can be read against the other whatever their units.
// The board's range (4 weeks … a year) applies. No AI, no network: all of it is worked out here.
//
// Saved in S.customCharts: [{id,name,a:{t,m,fn,w:[filter]},b:same|null,by,view,idx}]
//   m   'count' | 'sessions' (sets only) | 'strength' (sets only) | a numeric column
//   fn  'sum' | 'avg' | 'max' | 'min' (only for a column)
//   filter {c, in:[values]} or {c, op, v} for a number
//   by  'day' | 'week' | 'month' | 'weekday' | a column of the table
//   view 'line' | 'bars' | 'scatter' (scatter needs a second series)   idx: start both at 100
// On the board each chart is a tile with the key cc_<id>.

const CCH_MAX=12,CCH_MAX_FILTERS=3,CCH_CAT_ROWS=24;
const CCH_SOURCES=['sets','workouts','daily','meals','meal_items','activities','measurements','habit_days','supplements'];
const CCH_SRC={sets:{l:'Sets',n:'Sets done'},workouts:{l:'Workouts',n:'Workouts'},daily:{l:'Days',n:'Days'},meals:{l:'Meals',n:'Meals logged'},
  meal_items:{l:'Foods eaten',n:'Foods logged'},activities:{l:'Activities',n:'Activities'},measurements:{l:'Measurements',n:'Measurements'},
  habit_days:{l:'Habits',n:'Habit-days due'},supplements:{l:'Supplements',n:'Supplement-days'}};
// Numbers that can be summed up. True/false columns count as 1 and 0, so their average is a share.
const CCH_NUM=new Set(['sessions','working_sets','volume','workout_minutes','feel','cardio_minutes','miles','kcal','protein_g','carbs_g','fat_g','target_kcal','target_protein_g',
  'meals_logged','weight','sleep_h','mood','steps','habits_kept','habits_due','supplements_taken','minutes','exercises','reps','seconds','e1rm','rir','servings','value',
  'pace_min_per_mile','avg_hr','climb_ft','load','amount','target','items']);
const CCH_BOOL=new Set(['trained','paused','planned_training_day','failed','excluded','estimate','estimated','taken','archived']);
// Columns a chart can be grouped or filtered by.
const CCH_CAT=new Set(['workout','exercise','muscle','equipment','tag','name','routine','program','meal','food','type','shoe','part','habit','kind','status','supplement','day_kind','serving']);
const CCH_FNS=[{id:'sum',l:'Total'},{id:'avg',l:'Average'},{id:'max',l:'Highest'},{id:'min',l:'Lowest'}];
const CCH_TIME=[{id:'day',l:'Day'},{id:'week',l:'Week'},{id:'month',l:'Month'},{id:'weekday',l:'Weekday'}];
const CCH_LABEL={e1rm:'Estimated 1RM',rir:'Reps in reserve',protein_g:'Protein (g)',carbs_g:'Carbs (g)',fat_g:'Fat (g)',kcal:'Calories',target_kcal:'Calorie target',
  target_protein_g:'Protein target (g)',sleep_h:'Sleep (hours)',working_sets:'Working sets',workout_minutes:'Workout minutes',cardio_minutes:'Cardio minutes',
  pace_min_per_mile:'Pace (min a mile)',avg_hr:'Average heart rate',climb_ft:'Climb (ft)',meals_logged:'Meals logged',habits_kept:'Habits kept',habits_due:'Habits due',
  supplements_taken:'Supplements taken',planned_training_day:'Planned training day',day_kind:'Training or rest day',feel:'Workout rating',items:'Foods in the meal',
  trained:'Trained',paused:'Paused',estimate:'Estimate',estimated:'Estimated',failed:'Failed',excluded:'Left out of records',taken:'Taken',archived:'Archived',
  workout:'Workout',exercise:'Exercise',muscle:'Muscle',equipment:'Equipment',tag:'Set tag',routine:'Routine',program:'Program',meal:'Meal',food:'Food',type:'Kind',
  shoe:'Shoes',part:'Body part',habit:'Habit',kind:'Habit kind',status:'Status',supplement:'Supplement',serving:'Serving',value:'Measurement',amount:'Amount',target:'Target',
  servings:'Servings',minutes:'Minutes',miles:'Miles',steps:'Steps',mood:'Mood',weight:'Weight',volume:'Volume',reps:'Reps',seconds:'Seconds',exercises:'Exercises',load:'Training load'};
// Muscles come one at a time in the log; these are the groups people think in.
const CCH_MUSCLE_GROUPS=[{l:'Arms',m:['Biceps','Triceps','Forearms']},{l:'Shoulders',m:['Front Delts','Side Delts','Rear Delts']},
  {l:'Back',m:['Lats','Traps','Lower Back']},{l:'Legs',m:['Quads','Hamstrings','Glutes','Calves']},{l:'Core',m:['Abs','Obliques']}];

function cchColLabel(c){return CCH_LABEL[c]||(String(c).charAt(0).toUpperCase()+String(c).slice(1)).replace(/_/g,' ');}
function cchCols(t){const T=QD_TABLES[t];return T?Object.keys(T.cols):[];}
function cchNumCols(t){return cchCols(t).filter(c=>CCH_NUM.has(c)||CCH_BOOL.has(c));}
function cchCatCols(t){return cchCols(t).filter(c=>CCH_CAT.has(c));}
function cchFilterCols(t){return cchCols(t).filter(c=>CCH_CAT.has(c)||CCH_BOOL.has(c)||CCH_NUM.has(c));}
function cchIsTime(by){return by==='day'||by==='week'||by==='month';}
// The measures a table offers: [{m, l}]
function cchMeasures(t){
  const out=[{m:'count',l:(CCH_SRC[t]||{n:'Rows'}).n}];
  if(t==='sets'){out.push({m:'sessions',l:'Sessions'});out.push({m:'strength',l:'Strength change'});}
  cchNumCols(t).forEach(c=>out.push({m:c,l:cchColLabel(c)}));
  return out;
}
// What a column is usually summed up as.
function cchDefaultFn(c){
  if(['e1rm','weight','reps','seconds','avg_hr','climb_ft'].includes(c))return'max';
  if(['feel','mood','sleep_h','rir','pace_min_per_mile','value','target_kcal','target_protein_g'].includes(c)||CCH_BOOL.has(c))return'avg';
  return'sum';
}
function cchSeriesLabel(s){
  if(!s)return'';
  const ms=cchMeasures(s.t).find(x=>x.m===s.m);const base=ms?ms.l:cchColLabel(s.m);
  const fn=s.m==='count'||s.m==='sessions'||s.m==='strength'?'':((CCH_FNS.find(f=>f.id===s.fn)||CCH_FNS[0]).l+' ');
  const lower=fn&&!/^[A-Z0-9]{2}/.test(base)?base.charAt(0).toLowerCase()+base.slice(1):base;
  const f=(s.w||[]).map(cchFilterText).filter(Boolean);
  return(fn+lower)+(f.length?' · '+f.join(' · '):'');
}
function cchFilterText(f){
  if(!f||!f.c)return'';
  if(Array.isArray(f.in)){
    if(f.c==='muscle'){const g=CCH_MUSCLE_GROUPS.find(x=>x.m.length===f.in.length&&x.m.every(m=>f.in.includes(m)));if(g)return g.l;}
    if(CCH_BOOL.has(f.c))return(f.in[0]==='true'?'':'not ')+cchColLabel(f.c).toLowerCase();
    return f.in.length<=2?f.in.join(', '):`${f.in.slice(0,2).join(', ')} +${f.in.length-2}`;
  }
  return`${cchColLabel(f.c)} ${f.op} ${f.v}`;
}
function cchByLabel(by){const t=CCH_TIME.find(x=>x.id===by);return t?t.l:cchColLabel(by);}
function cchAutoName(c){
  const a=cchSeriesLabel(c.a);if(!c.b)return a.slice(0,60);
  return`${a.split(' · ')[0]} vs ${cchSeriesLabel(c.b).split(' · ')[0].replace(/^./,x=>x.toLowerCase())}`.slice(0,60);
}

// ─── Saved charts ───
function normalizeCustomCharts(v){
  if(!Array.isArray(v))return[];
  const ser=s=>{
    if(!isObj(s)||!CCH_SOURCES.includes(s.t))return null;
    const ok=['count','sessions','strength'].includes(s.m)?(s.m==='count'||s.t==='sets'):cchNumCols(s.t).includes(s.m);
    if(!ok)return null;
    const o={t:s.t,m:s.m,fn:CCH_FNS.some(f=>f.id===s.fn)?s.fn:'sum',w:[]};
    (Array.isArray(s.w)?s.w:[]).forEach(f=>{
      if(!isObj(f)||!cchFilterCols(s.t).includes(f.c)||o.w.length>=CCH_MAX_FILTERS)return;
      if(Array.isArray(f.in)){const vals=[...new Set(f.in.map(x=>String(x).slice(0,80)))].slice(0,60);if(vals.length)o.w.push({c:f.c,in:vals});}
      else if(['=','!=','>','>=','<','<='].includes(f.op)&&isFinite(parseFloat(f.v)))o.w.push({c:f.c,op:f.op,v:parseFloat(f.v)});
    });
    return o;
  };
  const seen=new Set();
  return v.filter(isObj).map(c=>{
    const a=ser(c.a);if(!a)return null;
    const id=typeof c.id==='string'&&/^[a-z0-9]{1,14}$/.test(c.id)&&!seen.has(c.id)?c.id:uid().replace(/[^a-z0-9]/g,'').slice(-12);seen.add(id);
    const b=ser(c.b);
    let by=typeof c.by==='string'?c.by:'week';
    if(!CCH_TIME.some(x=>x.id===by)&&!(cchCatCols(a.t).includes(by)&&(!b||cchCatCols(b.t).includes(by))))by='week';
    let view=['line','bars','scatter'].includes(c.view)?c.view:'line';
    if(view==='scatter'&&!b)view='line';
    return{id,name:typeof c.name==='string'?c.name.trim().slice(0,60):'',a,b,by,view,idx:c.idx!==false};
  }).filter(Boolean).slice(0,CCH_MAX);
}
function cchById(id){return(S.customCharts||[]).find(c=>c.id===id)||null;}
function cchName(c){return c.name||cchAutoName(c);}
// Each saved chart is a metric on the board, with the key cc_<id>. Called before the board reads METRICS.
function ccSync(){
  const want=new Set((S.customCharts||[]).map(c=>'cc_'+c.id));
  Object.keys(METRICS).forEach(k=>{if(k.startsWith('cc_')&&!want.has(k))delete METRICS[k];});
  (S.customCharts||[]).forEach(c=>{
    const k='cc_'+c.id;
    METRICS[k]={title:cchName(c),group:'Custom charts',custom:true,param:'custom',
      paramText:()=>cchSeriesLabel(c.a)+(c.b?' · vs '+cchSeriesLabel(c.b):''),
      has:()=>true,tile:range=>cchTile(c,range)};
  });
}

// ─── The numbers ───
function cchKeep(r,f){
  const v=r[f.c];
  if(Array.isArray(f.in))return f.in.includes(v==null?'':String(v));
  const n=typeof v==='boolean'?(v?1:0):qdN(v);if(n==null)return false;const x=+f.v;
  return f.op==='>'?n>x:f.op==='>='?n>=x:f.op==='<'?n<x:f.op==='<='?n<=x:f.op==='!='?n!==x:n===x;
}
function cchRows(s,from,to){
  const T=QD_TABLES[s.t];if(!T)return[];
  let rows;try{rows=T.rows(from,to)||[];}catch(e){logError(e,'custom chart '+s.t);return[];}
  (s.w||[]).forEach(f=>{rows=rows.filter(r=>cchKeep(r,f));});
  return rows.filter(r=>r.date&&r.date<=to);
}
function cchKey(r,by){
  if(by==='day')return r.date;if(by==='week')return weekStartOf(r.date);if(by==='month')return r.date.slice(0,7);
  if(by==='weekday')return String(dayDate(r.date).getDay());
  const v=r[by];return v==null||v===''?null:String(v);
}
// Every bucket the range covers, oldest first, so a week with nothing logged is still a week.
function cchTimeKeys(by,from,to){
  const out=[];
  if(by==='day')for(let d=from;d<=to;d=addDays(d,1))out.push(d);
  else if(by==='week')for(let d=weekStartOf(from);d<=to;d=addDays(d,7))out.push(d);
  else if(by==='month'){let y=+from.slice(0,4),m=+from.slice(5,7);const end=to.slice(0,7);
    for(let k=from.slice(0,7);k<=end;){out.push(k);m++;if(m>12){m=1;y++;}k=y+'-'+pad2(m);}}
  return out;
}
function cchKeyLabel(k,by){
  if(by==='day')return fmtDay(k);if(by==='week')return'Week of '+fmtDay(k);
  if(by==='month')return CAL_MONTHS[+k.slice(5,7)-1].slice(0,3)+' '+k.slice(0,4);
  if(by==='weekday')return QD_DOW[+k];
  return k;
}
function cchKeyT(k,by){return by==='month'?dayNum(k+'-01'):dayNum(k);}
function cchNumOf(v){return typeof v==='boolean'?(v?1:0):qdN(v);}
function cchAgg(fn,rows,col){
  const n=rows.map(r=>cchNumOf(r[col])).filter(x=>x!=null);
  if(!n.length)return null;
  if(fn==='sum')return n.reduce((a,b)=>a+b,0);
  if(fn==='avg')return n.reduce((a,b)=>a+b,0)/n.length;
  if(fn==='max')return Math.max(...n);if(fn==='min')return Math.min(...n);
  return null;
}
// Strength change, in % of where each lift started. Averaging estimated maxes of different lifts
// would move with whichever lifts were done that week, so each lift is compared with itself first:
//  · over time  — a lift's best estimated max in each bucket ÷ its best in the first bucket it shows up in
//  · by weekday — a session's best ÷ that lift's average session over the range
//  · by a column (exercise, muscle) — a lift's last session ÷ its first session in the range
// and the lifts are then averaged. 100 = where you started; 108 = 8% stronger.
function cchStrength(groups,by){
  const sess=g=>{const m=new Map();g.rows.forEach(r=>{if(!(r.e1rm>0))return;const k=r.ex_id+'|'+r.workout_id;const o=m.get(k);if(!o||r.e1rm>o.v)m.set(k,{ex:r.ex_id,v:r.e1rm,d:r.date});});return[...m.values()];};
  if(cchIsTime(by)){
    const base={};
    groups.forEach(g=>{
      const best={};sess(g).forEach(s=>{if(!(best[s.ex]>=s.v))best[s.ex]=s.v;});
      const ratios=[];Object.keys(best).forEach(ex=>{if(base[ex]==null)base[ex]=best[ex];ratios.push(best[ex]/base[ex]*100);});
      g.v=ratios.length?patMean(ratios):null;g.n=ratios.length;
    });
    return;
  }
  if(by==='weekday'){
    const all=[];groups.forEach(g=>sess(g).forEach(s=>all.push(Object.assign({g},s))));
    const avg={};const cnt={};all.forEach(s=>{avg[s.ex]=(avg[s.ex]||0)+s.v;cnt[s.ex]=(cnt[s.ex]||0)+1;});
    Object.keys(avg).forEach(ex=>{avg[ex]/=cnt[ex];});
    groups.forEach(g=>{const rs=all.filter(s=>s.g===g&&cnt[s.ex]>=2).map(s=>s.v/avg[s.ex]*100);g.v=rs.length?patMean(rs):null;g.n=rs.length;});
    return;
  }
  groups.forEach(g=>{
    const by_ex={};sess(g).forEach(s=>{(by_ex[s.ex]=by_ex[s.ex]||[]).push(s);});
    const rs=[];Object.values(by_ex).forEach(l=>{if(l.length<2)return;l.sort((x,y)=>x.d<y.d?-1:x.d>y.d?1:0);rs.push(l[l.length-1].v/l[0].v*100);});
    g.v=rs.length?patMean(rs):null;g.n=rs.length;
  });
}
// One series → [{k,label,t,v,n}] in display order.
function cchSeries(s,by,range){
  const to=range.to||today();
  // The first bucket starts where its week or month starts, so it is a whole one like the others.
  const from=by==='week'?weekStartOf(range.from):by==='month'?range.from.slice(0,8)+'01':range.from;
  const rows=cchRows(s,from,to);
  const map=new Map();
  rows.forEach(r=>{const k=cchKey(r,by);if(k==null)return;if(!map.has(k))map.set(k,{k,rows:[]});map.get(k).rows.push(r);});
  let keys;
  if(cchIsTime(by))keys=cchTimeKeys(by,from,to);
  else if(by==='weekday')keys=weekOrder().map(String);
  else keys=[...map.keys()];
  const groups=keys.map(k=>map.get(k)||{k,rows:[]});
  if(s.m==='strength')cchStrength(groups,by);
  else groups.forEach(g=>{
    g.n=g.rows.length;
    if(s.m==='count')g.v=g.rows.length;
    else if(s.m==='sessions')g.v=new Set(g.rows.map(r=>r.workout_id)).size;
    else{g.v=cchAgg(s.fn,g.rows,s.m);if(g.v==null&&s.fn==='sum'&&cchIsTime(by))g.v=0;}
  });
  // A total for the week or month still under way is not comparable with whole ones: it is left out.
  const total=s.m==='count'||s.m==='sessions'||(s.m!=='strength'&&s.fn==='sum');
  const cur=by==='week'?weekStartOf(to):by==='month'?to.slice(0,7):null;
  if(total&&cur&&to===today())groups.forEach(g=>{if(g.k===cur){g.sofar=g.v;g.v=null;g.open=true;}});
  // Empty buckets before the first one with anything in it are before you started, not zeros.
  if(total&&cchIsTime(by))for(const g of groups){if(g.v||g.open)break;g.v=null;}
  const rnd=v=>v==null?null:Math.round(v*100)/100;
  return groups.map(g=>({k:g.k,label:cchKeyLabel(g.k,by),t:cchIsTime(by)?cchKeyT(g.k,by):null,v:rnd(g.v),n:g.n||0,open:!!g.open,sofar:g.open?rnd(g.sofar):null}));
}
// The whole chart, worked out: {a, b, keys, idx, r, n, pairs}
function cchCompute(c,range){
  const a=cchSeries(c.a,c.by,range);
  const b=c.b?cchSeries(c.b,c.by,range):null;
  const out={a,b,by:c.by,view:c.view};
  // By a column, the categories are the ones either series has, biggest first (by the first series).
  if(!cchIsTime(c.by)&&c.by!=='weekday'){
    const all=new Map();a.forEach(x=>all.set(x.k,{a:x,b:null}));(b||[]).forEach(x=>{const o=all.get(x.k)||{a:{k:x.k,label:x.label,v:null,n:0},b:null};o.b=x;all.set(x.k,o);});
    const list=[...all.values()].sort((p,q)=>((q.a.v==null?-Infinity:q.a.v)-(p.a.v==null?-Infinity:p.a.v))||String(p.a.k).localeCompare(String(q.a.k)));
    out.a=list.map(x=>x.a);if(b)out.b=list.map(x=>x.b||{k:x.a.k,label:x.a.label,v:null,n:0});
  }
  // Two series over time start at 100 together, so a % change in one reads against the other.
  out.idx=!!(b&&c.idx&&cchIsTime(c.by)&&c.view!=='scatter');
  if(out.idx){out.a=cchIndex(out.a,c.a);out.b=cchIndex(out.b,c.b);}
  if(b){
    const pairs=[];out.a.forEach((x,i)=>{const y=out.b[i];if(x.v!=null&&y&&y.v!=null)pairs.push({x:y.v,y:x.v,label:x.label,raw:[x.raw!=null?x.raw:x.v,y.raw!=null?y.raw:y.v]});});
    out.pairs=pairs;out.n=pairs.length;
    out.r=pairs.length>=3?Math.round(patCorr(pairs.map(p=>p.x),pairs.map(p=>p.y))*100)/100:null;
  }
  return out;
}
// Where a line starts: the average of its first three buckets with something in them. One short
// first week (you started logging on a Friday) would otherwise make every later week look huge.
function cchBase(list){
  const nz=list.filter(x=>x.v!=null&&x.v!==0).slice(0,3);
  return nz.length?nz.reduce((t,x)=>t+x.v,0)/nz.length:null;
}
// Strength change is already 100 at the start (each lift against itself), so it is left as it is.
function cchIndex(list,s){
  if(s&&s.m==='strength')return list.map(x=>Object.assign({},x,{raw:x.v}));
  const base=cchBase(list);
  return list.map(x=>Object.assign({},x,{raw:x.v,v:base&&x.v!=null?Math.round(x.v/base*1000)/10:null}));
}
// How a value is written: strength as a change, big numbers with commas, the rest to one decimal.
function cchFmt(s,v){
  if(v==null)return'–';
  if(s&&s.m==='strength')return(v>=100?'+':'−')+fmt1(Math.abs(v-100))+'%';
  if(s&&s.m==='pace_min_per_mile')return fmtPace(v*60);
  if(s&&CCH_BOOL.has(s.m)&&s.fn==='avg')return Math.round(v*100)+'%';
  const a=Math.abs(v);return a>=1000?Math.round(v).toLocaleString():fmt1(v);
}
// A series' change over the range: first and last points that have a value.
function cchChange(list,s,idx){
  const pts=list.filter(x=>x.v!=null);if(pts.length<2)return null;
  const l=pts[pts.length-1];
  if(s.m==='strength')return{text:`${l.v>=100?'+':'−'}${fmt1(Math.abs(l.v-100))}%`,d:l.v-100};
  const base=idx?100:cchBase(pts); // indexed lines already start at 100
  if(!base)return null;
  const pct=(l.v-base)/Math.abs(base)*100;
  return{text:`${pct>=0?'+':'−'}${fmt1(Math.abs(pct))}%`,d:pct};
}

// ─── Drawing ───
// Two lines on one time axis. a is drawn in the accent colour, b in a quiet neutral.
function cchLineChart(r,c,o){
  o=o||{};
  const A=r.a.filter(x=>x.v!=null),B=r.b?r.b.filter(x=>x.v!=null):[];
  if(A.length+B.length<2)return`<div class="ch-empty">Not enough in this period to draw. Log more, widen the range, or loosen a filter.</div>`;
  const W=326,H=o.h||186,top=12,bot=26;const id='ch'+(++_chartSeq);
  const vs=A.concat(B).map(x=>x.v);let lo=Math.min(...vs),hi=Math.max(...vs);
  if(r.idx){lo=Math.min(lo,100);hi=Math.max(hi,100);}
  const pad=(hi-lo||Math.abs(hi)||1)*0.12;lo-=pad;hi+=pad;
  const ts=r.a.map(x=>x.t);const t0=Math.min(...ts),t1=Math.max(...ts)||t0+1;
  const X=t=>4+(t-t0)/((t1-t0)||1)*(W-10);const Y=v=>top+(1-(v-lo)/(hi-lo))*(H-top-bot);
  const fmt=r.idx?(v=>String(Math.round(v))):(v=>cchFmt(c.a,v));
  let g='';
  niceTicks(lo,hi,3).forEach(v=>{const y=chN(Y(v));g+=`<line class="ch-grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/><text class="ch-ax" x="0" y="${chN(y-5)}">${fmt(v)}</text>`;});
  if(r.idx)g+=`<line class="sp-fit" x1="0" y1="${chN(Y(100))}" x2="${W}" y2="${chN(Y(100))}"/>`;
  const poly=(list,cls)=>{const segs=[];let cur=[];list.forEach(x=>{if(x.v==null){if(cur.length)segs.push(cur);cur=[];}else cur.push(chN(X(x.t))+','+chN(Y(x.v)));});if(cur.length)segs.push(cur);
    return segs.map(s=>s.length===1?`<circle class="${cls}-pt" cx="${s[0].split(',')[0]}" cy="${s[0].split(',')[1]}" r="2.6"/>`:`<polyline class="${cls}" points="${s.join(' ')}"/>`).join('');};
  let marks='',hits='';
  const many=r.a.length>45;
  r.a.forEach((x,i)=>{
    const px=X(x.t);
    if(!many&&x.v!=null)marks+=`<circle class="ch-dot" id="${id}-d${i}" cx="${chN(px)}" cy="${chN(Y(x.v))}" r="2.8"/>`;
    const y=r.b&&r.b[i];
    if(!many&&y&&y.v!=null)marks+=`<circle class="xc-dot2" cx="${chN(px)}" cy="${chN(Y(y.v))}" r="2.4"/>`;
    const x0=i?(X(r.a[i-1].t)+px)/2:0,x1=i===r.a.length-1?W:(px+X(r.a[i+1].t))/2;
    hits+=`<rect class="ch-hit" x="${chN(x0)}" y="0" width="${chN(Math.max(1,x1-x0))}" height="${H-bot}" onclick="chartPick(${jsq(id)},${i},${jsq(cchRead(r,c,i))})"/>`;
  });
  const last=r.a.length-1;
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">${esc(cchRead(r,c,last))}</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cchName(c))}">${g}${r.b?poly(r.b,'xc-line2'):''}${poly(r.a,'ch-line')}${marks}${chAxisDates(t0,t1,W,0,0,H-6)}${hits}</svg>
    ${cchLegend(c,r)}</div>`;
}
// Bars on a time axis: one bar a bucket, or a pair when there are two series.
function cchBarChart(r,c){
  if(!r.a.some(x=>x.v)&&!(r.b&&r.b.some(x=>x.v)))return`<div class="ch-empty">Nothing in this period yet.</div>`;
  if(!r.b)return chartBars(r.a.map(x=>({t:x.t,v:x.v||0,read:cchRead(r,c,r.a.indexOf(x))})),{fmt:v=>cchFmt(c.a,v),label:cchName(c)});
  const W=326,H=186,top=12,bot=26;const id='ch'+(++_chartSeq);const n=r.a.length;
  const vs=r.a.concat(r.b).map(x=>x.v||0);const hi=Math.max(...vs,r.idx?100:0)*1.12||1;
  const Y=v=>top+(1-v/hi)*(H-top-bot);
  const gap=n>20?2:n>10?4:8;const bw=(W-gap*(n-1))/n;const half=Math.max(1,bw/2-0.5);
  let g='',bars='',hits='';
  niceTicks(0,hi,3).filter(v=>v>0).forEach(v=>{const y=chN(Y(v));g+=`<line class="ch-grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/><text class="ch-ax" x="0" y="${chN(y-5)}">${r.idx?Math.round(v):cchFmt(c.a,v)}</text>`;});
  r.a.forEach((x,i)=>{
    const bx=i*(bw+gap);const y2=r.b[i];
    const bar=(v,xx,cls)=>{const yy=v>0?Math.min(Y(v),H-bot-2):H-bot-1.5;return`<rect class="${v>0?cls:'sp-nil'}" x="${chN(xx)}" y="${chN(yy)}" width="${chN(half)}" height="${chN(H-bot-yy)}" rx="${chN(Math.min(3,half/2.2))}"/>`;};
    bars+=bar(x.v||0,bx,'sp-bar')+bar(y2&&y2.v||0,bx+half+1,'xc-bar2');
    hits+=`<rect class="ch-hit" x="${chN(bx-gap/2)}" y="0" width="${chN(bw+gap)}" height="${H-bot}" onclick="chartPick(${jsq(id)},${i},${jsq(cchRead(r,c,i))})"/>`;
  });
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">${esc(cchRead(r,c,n-1))}</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cchName(c))}">${g}${bars}${chAxisDates(r.a[0].t,r.a[n-1].t,W,0,0,H-6)}${hits}</svg>${cchLegend(c,r)}</div>`;
}
// By weekday or by a column: a row per category, the bar's length is the value. Reads on a phone
// where 30 exercise names under a chart would not.
function cchCatChart(r,c){
  const rows=r.a.map((x,i)=>({x,y:r.b?r.b[i]:null})).filter(p=>p.x.v!=null||(p.y&&p.y.v!=null));
  if(!rows.length)return`<div class="ch-empty">Nothing in this period yet.</div>`;
  const shown=rows.slice(0,CCH_CAT_ROWS);
  const maxA=Math.max(...rows.map(p=>Math.abs(p.x.v||0)),1e-9),maxB=r.b?Math.max(...rows.map(p=>Math.abs(p.y&&p.y.v||0)),1e-9):1;
  const bar=(v,max,cls)=>`<span class="xc-track"><span class="${cls}" style="width:${v>0?Math.max(2,Math.round(v/max*100)):0}%"></span></span>`;
  return`<div class="ch-box xc-cats">${shown.map(p=>`<div class="xc-cat">
      <span class="xc-cl">${esc(p.x.label)}</span>
      <span class="xc-cb">${bar(p.x.v,maxA,'xc-fill')}${r.b?bar(p.y&&p.y.v,maxB,'xc-fill2'):''}</span>
      <span class="xc-cv">${esc(cchFmt(c.a,p.x.v))}${r.b?`<i>${esc(cchFmt(c.b,p.y&&p.y.v))}</i>`:''}</span></div>`).join('')}
    ${rows.length>shown.length?`<div class="fine" style="margin:6px 0 2px">And ${rows.length-shown.length} more in the table below.</div>`:''}${cchLegend(c,r)}</div>`;
}
// One series against the other: a dot per bucket, with the straight line through them and r.
function cchScatter(r,c){
  const P=r.pairs||[];
  if(P.length<3)return`<div class="ch-empty">A comparison needs at least three ${cchByLabel(c.by).toLowerCase()}s that have both numbers. ${P.length?`There ${P.length===1?'is':'are'} ${P.length}.`:''}</div>`;
  const W=326,H=210,padL=4,top=12,bot=30;const id='ch'+(++_chartSeq);
  const xs=P.map(p=>p.x),ys=P.map(p=>p.y);
  let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const px=(x1-x0||Math.abs(x1)||1)*0.08,py=(y1-y0||Math.abs(y1)||1)*0.12;x0-=px;x1+=px;y0-=py;y1+=py;
  const X=v=>padL+(v-x0)/(x1-x0)*(W-padL-8),Y=v=>top+(1-(v-y0)/(y1-y0))*(H-top-bot);
  let g='';
  niceTicks(y0,y1,3).forEach(v=>{const y=chN(Y(v));g+=`<line class="ch-grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/><text class="ch-ax" x="0" y="${chN(y-5)}">${cchFmt(c.a,v)}</text>`;});
  niceTicks(x0,x1,3).forEach(v=>{const x=chN(X(v));g+=`<text class="ch-ax" x="${x}" y="${H-12}" text-anchor="middle">${cchFmt(c.b,v)}</text>`;});
  const f=fitLine(P.map(p=>({t:p.x,v:p.y})));
  const fit=f?`<line class="sp-fit" x1="${chN(X(P.reduce((m,p)=>Math.min(m,p.x),Infinity)))}" y1="${chN(Y(f.a+(Math.min(...xs)-P[0].x)*f.perDay))}" x2="${chN(X(Math.max(...xs)))}" y2="${chN(Y(f.a+(Math.max(...xs)-P[0].x)*f.perDay))}"/>`:'';
  const dots=P.map((p,i)=>`<circle class="ch-dot" id="${id}-d${i}" cx="${chN(X(p.x))}" cy="${chN(Y(p.y))}" r="4"/><circle class="ch-hit" cx="${chN(X(p.x))}" cy="${chN(Y(p.y))}" r="13" onclick="chartPick(${jsq(id)},${i},${jsq(`${p.label} · ${cchFmt(c.a,p.raw[0])} · ${cchFmt(c.b,p.raw[1])}`)})"/>`).join('');
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">Each dot is a ${cchByLabel(c.by).toLowerCase()}. Tap one.</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cchName(c))}">${g}${fit}${dots}<text class="ch-ax" x="${W}" y="${H}" text-anchor="end">${esc(cchSeriesLabel(c.b).split(' · ')[0])} →</text></svg>
    <div class="xc-leg"><span><b class="xc-k1"></b>Up: ${esc(cchSeriesLabel(c.a))}</span><span><b class="xc-k0"></b>Across: ${esc(cchSeriesLabel(c.b))}</span></div></div>`;
}
function cchLegend(c,r){
  if(!c.b)return'';
  return`<div class="xc-leg"><span><b class="xc-k1"></b>${esc(cchSeriesLabel(c.a))}</span><span><b class="xc-k2"></b>${esc(cchSeriesLabel(c.b))}</span>${r.idx?'<span class="xc-legn">Both start at 100</span>':''}</div>`;
}
function cchRead(r,c,i){
  const x=r.a[i];if(!x)return'';
  const val=(s,p)=>p==null?'–':p.open&&p.sofar!=null?`${cchFmt(s,p.sofar)} so far`:p.v==null?'–':r.idx&&s.m!=='strength'?`${cchFmt(s,p.raw)} (${Math.round(p.v)})`:cchFmt(s,p.v);
  const head=x.label;
  const short=s=>cchSeriesLabel(s).split(' · ')[0];
  return r.b?`${head} · ${short(c.a)} ${val(c.a,x)} · ${short(c.b)} ${val(c.b,r.b[i])}`:`${head} · ${val(c.a,x)}`;
}
function cchChart(c,r){
  if(r.view==='scatter')return cchScatter(r,c);
  if(!cchIsTime(c.by))return cchCatChart(r,c);
  return c.view==='bars'?cchBarChart(r,c):cchLineChart(r,c);
}
// The tile: two little lines, or one.
function cchSpark(r){
  const w=141,h=36;const all=r.a.concat(r.b||[]).filter(x=>x.v!=null&&x.t!=null);
  if(all.length<2)return svgSpark([],{w,h});
  const sc=chScale(all,w,h,3);
  const line=(list,cls)=>{const p=list.filter(x=>x.v!=null).map(x=>chN(sc.X(x.t))+','+chN(sc.Y(x.v)));return p.length>1?`<polyline class="${cls}" points="${p.join(' ')}"/>`:'';};
  return`<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true">${r.b?line(r.b,'xc-line2'):''}${line(r.a,'sp-line')}</svg>`;
}
// The biggest few categories as bars, and a small scatter: a tile is never just a number in space.
function cchCatSpark(r){
  const top=r.a.filter(x=>x.v!=null&&x.v>0).slice(0,8);
  return top.length?svgBars(top.map(x=>({v:x.v}))):'';
}
function cchScatterSpark(r){
  const P=r.pairs||[];if(P.length<2)return'';
  const w=141,h=36;const xs=P.map(p=>p.x),ys=P.map(p=>p.y);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const X=v=>4+(v-x0)/((x1-x0)||1)*(w-8),Y=v=>h-4-(v-y0)/((y1-y0)||1)*(h-8);
  return`<svg class="spark xc-scs" viewBox="0 0 ${w} ${h}" aria-hidden="true">${P.map(p=>`<circle class="sp-dot" cx="${chN(X(p.x))}" cy="${chN(Y(p.y))}" r="2.4"/>`).join('')}</svg>`;
}
function cchTile(c,range){
  const title=cchName(c);
  const r=cchCompute(c,range);
  if(r.view==='scatter'){
    if(r.r==null)return{title,empty:`Needs three ${cchByLabel(c.by).toLowerCase()}s with both numbers.`};
    return{title,value:r.r.toFixed(2),unit:' r',sub:`${cchStrengthWord(r.r,r.n)} · ${r.n} ${cchByLabel(c.by).toLowerCase()}s`,tone:'flat',spark:cchScatterSpark(r)};
  }
  if(!r.a.some(x=>x.v!=null)&&!(r.b&&r.b.some(x=>x.v!=null)))return{title,empty:'Nothing in this period yet.'};
  if(!cchIsTime(c.by)){
    const top=r.a.find(x=>x.v!=null);
    return{title,value:top?cchFmt(c.a,top.v):'–',unit:'',sub:top?`Top: ${top.label}`:'',tone:'flat',spark:cchCatSpark(r)};
  }
  const last=[...r.a].reverse().find(x=>x.v!=null);
  const ca=cchChange(r.a,c.a,r.idx),cb=r.b?cchChange(r.b,c.b,r.idx):null;
  const value=r.idx?(ca?ca.text:'–'):last?cchFmt(c.a,last.v):'–';
  const sub=r.b?`vs ${cb?cb.text:'–'} ${cchSeriesLabel(c.b).split(' · ')[0].toLowerCase()}`:ca&&c.a.m!=='strength'?`${ca.text} over ${range.short}`:last?last.label:'';
  return{title,value,unit:r.idx||c.a.m==='strength'?'':'',sub,tone:'flat',spark:cchSpark(r)};
}
// With a handful of points r swings wildly, so it is not called anything until there are eight.
const CCH_MIN_PAIRS=8;
function cchStrengthWord(r,n){if(n!=null&&n<CCH_MIN_PAIRS)return'Too few to judge';const a=Math.abs(r);return a<0.2?'No real link':a<0.4?(r>0?'Weak, together':'Weak, opposite'):a<0.7?(r>0?'Moderate, together':'Moderate, opposite'):(r>0?'Strong, together':'Strong, opposite');}

// ─── The sheet a tile opens ───
function cchDetail(id,range){
  const c=cchById(id);if(!c)return null;
  const r=cchCompute(c,range);
  const ca=cchIsTime(c.by)?cchChange(r.a,c.a,r.idx):null,cb=r.b&&cchIsTime(c.by)?cchChange(r.b,c.b,r.idx):null;
  const stats=[];
  if(r.view==='scatter'){
    stats.push({v:r.r==null?'–':r.r.toFixed(2),l:r.r==null?'r, how they move together':cchStrengthWord(r.r,r.n)},{v:r.n,l:`${cchByLabel(c.by)}s with both`});
  }else if(cchIsTime(c.by)){
    const lab=x=>`${cchSeriesLabel(x).split(' · ')[0].replace(/ \(%\)$/,'')}, over ${range.short}`;
    stats.push({v:ca?ca.text:'–',l:lab(c.a)});
    if(r.b)stats.push({v:cb?cb.text:'–',l:lab(c.b)});
    if(r.b&&r.r!=null)stats.push({v:r.r.toFixed(2),l:r.n<CCH_MIN_PAIRS?'r · too few to judge':'r, how they move together'});
    else stats.push({v:r.a.filter(x=>x.v!=null).length,l:`${cchByLabel(c.by)}s with data`});
  }
  const head=[cchByLabel(c.by),cchSeriesLabel(c.a).split(' · ')[0]].concat(c.b?[cchSeriesLabel(c.b).split(' · ')[0]]:[]);
  const order=cchIsTime(c.by)?r.a.map((x,i)=>i).reverse():r.a.map((x,i)=>i);
  const has=p=>p&&(p.v!=null||p.sofar!=null);
  const rowsHTML=order.filter(i=>has(r.a[i])||(r.b&&has(r.b[i]))).slice(0,60).map(i=>{const x=r.a[i],y=r.b&&r.b[i];
    const v=(s,p)=>p==null?'–':p.open&&p.sofar!=null?`${cchFmt(s,p.sofar)} so far`:p.v==null?'–':cchFmt(s,r.idx?p.raw:p.v);
    return`<tr><td>${esc(x.label.replace(/^Week of /,''))}</td><td>${esc(v(c.a,x))}</td>${c.b?`<td>${esc(v(c.b,y))}</td>`:''}</tr>`;}).join('');
  const how=[
    c.a.m==='strength'||(c.b&&c.b.m==='strength')?'Strength change compares each lift with itself, then averages the lifts, so swapping exercises does not move it. Lifts without a weight are left out.':'',
    cchIsTime(c.by)&&c.by!=='day'&&[c.a,c.b].some(s=>s&&(s.m==='count'||s.m==='sessions'||(s.m!=='strength'&&s.fn==='sum')))?`The ${c.by} under way shows as "so far" and is not drawn until it ends.`:'',
    c.by==='weekday'&&[c.a,c.b].some(s=>s&&s.m==='strength')?'By weekday, each session is compared with that lift\'s average session, so it only says something when a lift is done on more than one weekday.':'',
    r.idx?`Both lines start at 100 (110 = 10% above the start). The start is the average of the first three ${c.by}s with data. The table has the real numbers.`:'',
    !r.idx&&cchIsTime(c.by)?`Change is the last ${c.by} against the average of the first three with data.`:'',
    r.b&&r.r!=null?`r runs from −1 (opposite) to 1 (in step). It shows they move together, not that one causes the other, and needs ${CCH_MIN_PAIRS}+ ${c.by==='weekday'?'points':c.by+'s'} to mean much. Patterns tests that properly.`:'',
    (c.a.w||[]).some(f=>f.c==='muscle')||(c.b&&(c.b.w||[]).some(f=>f.c==='muscle'))?'A set counts toward its exercise\'s main muscle only.':'',
  ].filter(Boolean).join(' ');
  return{title:cchName(c),sub:cchSeriesLabel(c.a)+(c.b?'  vs  '+cchSeriesLabel(c.b):'')+` · by ${cchByLabel(c.by).toLowerCase()}`,plain:true,
    chart:cchChart(c,r),stats,
    body:rowsHTML?`<div class="sec-h">The numbers</div><div class="xc-tbl-wrap"><table class="xc-tbl"><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rowsHTML}</tbody></table></div>`:'',
    how,
    acts:`<button class="btn bts" onclick="closeOv('metric-ov');setTimeout(()=>showChartBuilder(${jsq(c.id)}),220)">Edit</button><button class="btn bts" onclick="cchExport(${jsq(c.id)})">Export CSV</button>`};
}
function cchExport(id){
  const c=cchById(id);if(!c)return;
  const range=boardRange();const r=cchCompute(c,range);
  const head=[cchByLabel(c.by),cchSeriesLabel(c.a)].concat(c.b?[cchSeriesLabel(c.b)]:[]).concat(r.idx?[`${cchSeriesLabel(c.a)} (start = 100)`,`${cchSeriesLabel(c.b)} (start = 100)`]:[]);
  const rows=[head];
  const raw=p=>p==null?'':p.open&&p.sofar!=null?p.sofar:(r.idx?p.raw:p.v)??'';
  r.a.forEach((x,i)=>{const y=r.b&&r.b[i];
    const row=[cchIsTime(c.by)&&c.by!=='month'?x.k:x.label,raw(x),...(c.b?[raw(y)]:[]),...(r.idx?[x.v??'',y&&y.v!=null?y.v:'']:[])];
    if(row.slice(1).some(v=>v!==''&&v!=null))rows.push(row);}); // the weeks before you started are not rows
  const name=`Lah We ${cchName(c).replace(/[\\/:*?"<>|]/g,'').slice(0,40)} ${today()}.csv`;
  shareFile(new Blob(['﻿'+csvText(rows)],{type:'text/csv'}),name,cchName(c)).then(x=>{if(x==='saved')toast('Export saved','green');});
}

// ─── Building one ───
// A few starting points, so the first chart is one tap.
const CCH_IDEAS=[
  {l:'Arm strength vs arm sets',c:{a:{t:'sets',m:'strength',fn:'sum',w:[{c:'muscle',in:['Biceps','Triceps','Forearms']}]},b:{t:'sets',m:'count',fn:'sum',w:[{c:'muscle',in:['Biceps','Triceps','Forearms']}]},by:'week',view:'line',idx:true}},
  {l:'Calories vs body weight',c:{a:{t:'daily',m:'weight',fn:'avg',w:[]},b:{t:'daily',m:'kcal',fn:'avg',w:[]},by:'week',view:'line',idx:true}},
  {l:'Sleep vs workout rating',c:{a:{t:'daily',m:'feel',fn:'avg',w:[]},b:{t:'daily',m:'sleep_h',fn:'avg',w:[]},by:'week',view:'scatter',idx:true}},
  {l:'Sets by muscle',c:{a:{t:'sets',m:'count',fn:'sum',w:[]},b:null,by:'muscle',view:'bars',idx:true}},
  {l:'Workout rating by weekday',c:{a:{t:'workouts',m:'feel',fn:'avg',w:[]},b:null,by:'weekday',view:'bars',idx:true}},
  {l:'Protein, week by week',c:{a:{t:'daily',m:'protein_g',fn:'avg',w:[]},b:null,by:'week',view:'bars',idx:true}},
];
let _cch=null;
function cchBlank(){return{id:null,name:'',a:{t:'sets',m:'strength',fn:'sum',w:[]},b:null,by:'week',view:'line',idx:true};}
function showChartBuilder(id){
  const c=id?cchById(id):null;
  if(!c&&(S.customCharts||[]).length>=CCH_MAX){toast(`You have ${CCH_MAX} custom charts. Delete one to make another.`,'red');return;}
  _cch={id:c?c.id:null,c:JSON.parse(JSON.stringify(c||cchBlank())),fresh:!c};
  closeOv('bedit-ov');
  const ov=makeOv('cchb-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div id="cchb-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  ov._onDismiss=()=>{_cch=null;};
  renderChartBuilder();
}
function cchSelect(id,val,opts,on){
  return`<span class="range-pick xc-sel"><select id="${id}" onchange="${on}">${opts.map(o=>`<option value="${esc(o.v)}"${String(o.v)===String(val)?' selected':''}>${esc(o.l)}</option>`).join('')}</select>${ICON('chev',13)}</span>`;
}
function cchSeriesHTML(key){
  const s=_cch.c[key];const isB=key==='b';
  const meas=cchMeasures(s.t);
  const colM=!['count','sessions','strength'].includes(s.m);
  const filters=(s.w||[]).map((f,i)=>`<span class="xc-chip">${esc(cchColLabel(f.c))}: <b>${esc(cchFilterText(f))}</b><button aria-label="Remove filter" onclick="cchDropFilter('${key}',${i})">${ICON('x',13)}</button></span>`).join('');
  return`<div class="xc-ser${isB?' xc-ser-b':''}">
    <div class="xc-sh"><b class="${isB?'xc-k2':'xc-k1'}"></b><span>${isB?'Compared with':'Measure'}</span>${isB?`<button class="btn btg bsm" onclick="cchSetB(false)">Remove</button>`:''}</div>
    <div class="xc-row">${cchSelect('cchb-t-'+key,s.t,CCH_SOURCES.map(t=>({v:t,l:CCH_SRC[t].l})),`cchSet('${key}','t',this.value)`)}
      ${cchSelect('cchb-m-'+key,s.m,meas.map(x=>({v:x.m,l:x.l})),`cchSet('${key}','m',this.value)`)}</div>
    ${colM?`<div class="seg seg-in xc-seg">${CCH_FNS.map(f=>`<button class="seg-b${s.fn===f.id?' on':''}" onclick="cchSet('${key}','fn','${f.id}')">${f.l}</button>`).join('')}</div>`:''}
    <div class="xc-filters">${filters}${(s.w||[]).length<CCH_MAX_FILTERS?`<button class="xc-add" onclick="showCchFilter('${key}')">${ICON('plus',13)} Filter</button>`:''}</div>
  </div>`;
}
function renderChartBuilder(){
  const el=document.getElementById('cchb-body');if(!el||!_cch)return;
  const c=_cch.c;const range=boardRange();
  // a column to group by has to be in both tables
  const cats=cchCatCols(c.a.t).filter(x=>!c.b||cchCatCols(c.b.t).includes(x));
  let preview;try{preview=cchChart(c,cchCompute(c,range));}catch(e){logError(e,'custom chart preview');preview=`<div class="ch-empty">This chart could not be worked out.</div>`;}
  const views=[{id:'line',l:'Line'},{id:'bars',l:'Bars'}].concat(c.b?[{id:'scatter',l:'Scatter'}]:[]);
  const timeBy=cchIsTime(c.by);
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">${_cch.fresh?'New chart':'Edit chart'}</div>
    <div class="sheet-sub" style="margin-bottom:6px">Any number you log, by time or by category. Uses the board's range: ${esc(range.label)}.</div>
    ${_cch.fresh?`<div class="xc-ideas">${CCH_IDEAS.map((x,i)=>`<button class="chip" onclick="cchIdea(${i})">${esc(x.l)}</button>`).join('')}</div>`:''}
    ${preview}
    ${cchSeriesHTML('a')}
    ${c.b?cchSeriesHTML('b'):`<button class="xc-add xc-add-b" onclick="cchSetB(true)">${ICON('plus',14)} Compare with a second line</button>`}
    <div class="sec-h">Group by</div>
    <div class="xc-row">
      <div class="seg seg-in xc-seg" style="flex:1;margin:0">${CCH_TIME.map(t=>`<button class="seg-b${c.by===t.id?' on':''}" onclick="cchSetTop('by','${t.id}')">${t.l}</button>`).join('')}</div>
    </div>
    ${cats.length?`<div class="xc-row" style="margin-top:8px">${cchSelect('cchb-by',timeBy||c.by==='weekday'?'':c.by,[{v:'',l:'Or by a category…'}].concat(cats.map(x=>({v:x,l:cchColLabel(x)}))),`if(this.value)cchSetTop('by',this.value)`)}</div>`:''}
    ${timeBy||c.b?`<div class="sec-h">Show as</div>
    <div class="seg seg-in xc-seg">${views.filter(v=>timeBy||v.id==='scatter'||v.id==='bars').map(v=>`<button class="seg-b${(c.view===v.id||(!timeBy&&v.id==='bars'&&c.view!=='scatter'))?' on':''}" onclick="cchSetTop('view','${v.id}')">${v.l}</button>`).join('')}</div>`:''}
    ${c.b&&timeBy&&c.view!=='scatter'?`<button class="row row-tap xc-tog" onclick="cchSetTop('idx',${!c.idx})"><span class="row-main"><span class="row-t">Start both at 100</span><span class="row-s">Read a % change in one against the other, whatever their units</span></span><span class="tog${c.idx?' on':''}" role="switch" aria-checked="${c.idx}"></span></button>`:''}
    <div class="sec-h">Name</div>
    <input id="cchb-name" maxlength="60" value="${esc(c.name)}" placeholder="${esc(cchAutoName(c))}" oninput="_cch.c.name=this.value">
    <div class="sheet-acts">
      <button class="btn btp" onclick="cchSave()">${_cch.fresh?'Add to board':'Save'}</button>
      ${_cch.fresh?'':`<button class="btn btg" onclick="cchDelete()">Delete</button>`}
    </div>`;
}
function cchIdea(i){
  const x=CCH_IDEAS[i];if(!x||!_cch)return;
  _cch.c=Object.assign(JSON.parse(JSON.stringify(x.c)),{id:null,name:x.l});renderChartBuilder();
}
// Keep the chart sensible when a piece changes: a measure the table does not have, a filter on a
// column it does not have, a grouping one of the two tables cannot do.
function cchFix(){
  const c=_cch.c;
  ['a','b'].forEach(k=>{const s=c[k];if(!s)return;
    if(!cchMeasures(s.t).some(x=>x.m===s.m))s.m='count';
    s.w=(s.w||[]).filter(f=>cchFilterCols(s.t).includes(f.c));});
  if(!cchIsTime(c.by)&&c.by!=='weekday'&&!(cchCatCols(c.a.t).includes(c.by)&&(!c.b||cchCatCols(c.b.t).includes(c.by))))c.by='week';
  if(c.view==='scatter'&&!c.b)c.view='line';
}
function cchSet(key,f,v){
  const s=_cch&&_cch.c[key];if(!s)return;
  if(f==='t'){if(s.t===v)return;s.t=v;s.m=v==='sets'?'strength':'count';}
  else if(f==='m'){s.m=v;if(!['count','sessions','strength'].includes(v))s.fn=cchDefaultFn(v);}
  else s[f]=v;
  cchFix();renderChartBuilder();
}
function cchSetTop(f,v){if(!_cch)return;_cch.c[f]=v;if(f==='by'&&!cchIsTime(v)&&_cch.c.view==='line')_cch.c.view='bars';cchFix();renderChartBuilder();}
// The second line starts as a count of the same rows, filtered the same way: "how much of it"
// against "how it went" is the comparison most people are after.
function cchSetB(on){
  if(!_cch)return;const c=_cch.c;
  c.b=on?{t:c.a.t,m:c.a.m==='count'?(cchNumCols(c.a.t)[0]||'count'):'count',fn:'sum',w:JSON.parse(JSON.stringify(c.a.w||[]))}:null;
  if(on&&c.b.m!=='count')c.b.fn=cchDefaultFn(c.b.m);
  cchFix();renderChartBuilder();
}
function cchDropFilter(key,i){const s=_cch&&_cch.c[key];if(!s)return;s.w.splice(i,1);renderChartBuilder();}
function cchSave(){
  if(!_cch)return;
  const n=document.getElementById('cchb-name');if(n)_cch.c.name=n.value;
  const list=(S.customCharts||[]).slice();
  const clean=normalizeCustomCharts([Object.assign({},_cch.c,{id:_cch.id||uid().replace(/[^a-z0-9]/g,'').slice(-12)})])[0];
  if(!clean){toast('That chart is missing a measure','red');return;}
  const i=list.findIndex(x=>x.id===clean.id);
  if(i>=0)list[i]=clean;else list.push(clean);
  S.customCharts=list;ccSync();
  if(i<0)boardAdd('cc_'+clean.id);else save();
  closeOv('cchb-ov');progRefresh();
  toast(i<0?'Added to your board':'Chart saved','green');
}
function cchDelete(){
  if(!_cch||!_cch.id)return;const id=_cch.id;
  const was=S.customCharts.find(x=>x.id===id);const pos=boardTiles().findIndex(t=>t.k==='cc_'+id);
  S.customCharts=S.customCharts.filter(x=>x.id!==id);
  boardSet(boardTiles().filter(t=>t.k!=='cc_'+id));ccSync();
  closeOv('cchb-ov');progRefresh();
  toast('Chart deleted','',{action:'Undo',onAction:()=>{S.customCharts=S.customCharts.concat([was]);ccSync();
    const t=boardTiles().slice();t.splice(pos<0?t.length:pos,0,{k:'cc_'+id});boardSet(t);progRefresh();}});
}

// ─── A filter ───
let _cchf=null;
function showCchFilter(key){
  if(!_cch)return;_cchf={key,c:null,in:[],op:'>=',v:''};
  const ov=makeOv('cchf-ov');
  ov.innerHTML=`<div class="modal" style="max-height:88vh"><div class="mh"></div><div id="cchf-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);ov._onDismiss=()=>{_cchf=null;};
  renderCchFilter();
}
// The values a column takes in your log (the last year), most common first.
function cchValues(t,col){
  const rows=cchRows({t,w:[]},daysAgoStr(365),today());const n=new Map();
  rows.forEach(r=>{const v=r[col];if(v==null||v==='')return;const k=String(v);n.set(k,(n.get(k)||0)+1);});
  if(col==='muscle')Object.keys(MEV_MAV).forEach(m=>{if(!n.has(m))n.set(m,0);});
  return[...n.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,80).map(x=>({v:x[0],n:x[1]}));
}
function renderCchFilter(){
  const el=document.getElementById('cchf-body');if(!el||!_cchf||!_cch)return;
  const s=_cch.c[_cchf.key];const f=_cchf;
  if(!f.c){
    el.innerHTML=`<div class="mt" style="margin-bottom:10px">Filter ${esc(CCH_SRC[s.t].l.toLowerCase())} by</div>
      <div class="list">${cchFilterCols(s.t).map(c=>`<button class="row row-tap" onclick="_cchf.c=${jsq(c)};renderCchFilter()"><span class="row-main"><span class="row-t">${esc(cchColLabel(c))}</span></span><span class="row-chev">${ICON('chev',16)}</span></button>`).join('')}</div>`;
    return;
  }
  const num=CCH_NUM.has(f.c);
  let inner;
  if(CCH_BOOL.has(f.c)){
    inner=`<div class="xc-vals">${[['true','Yes'],['false','No']].map(([v,l])=>`<button class="chip${f.in.includes(v)?' on':''}" onclick="_cchf.in=['${v}'];renderCchFilter()">${l}</button>`).join('')}</div>`;
  }else if(num){
    inner=`<div class="xc-row">${cchSelect('cchf-op',f.op,['>=','>','<=','<','=','!='].map(o=>({v:o,l:{'>=':'At least','>':'More than','<=':'At most','<':'Less than','=':'Exactly','!=':'Not'}[o]})),'_cchf.op=this.value')}
      <input id="cchf-v" type="number" inputmode="decimal" value="${esc(f.v)}" oninput="_cchf.v=this.value" style="flex:1"></div>`;
  }else{
    const vals=cchValues(s.t,f.c);
    inner=`${f.c==='muscle'?`<div class="xc-lbl">Groups</div><div class="xc-vals" style="margin-bottom:12px">${CCH_MUSCLE_GROUPS.map((g,i)=>`<button class="chip${g.m.every(m=>f.in.includes(m))?' on':''}" onclick="cchToggleGroup(${i})">${g.l}</button>`).join('')}</div>`:''}
      ${vals.length?`${f.c==='muscle'?'<div class="xc-lbl">Muscles · sets in the last year</div>':''}<div class="xc-vals">${vals.map(x=>`<button class="chip${f.in.includes(x.v)?' on':''}" onclick="cchToggleVal(${jsq(x.v)})">${esc(x.v)}${x.n?`<small>${x.n}</small>`:''}</button>`).join('')}</div>`:'<div class="ch-empty">Nothing logged in the last year to pick from.</div>'}`;
  }
  const ok=num||f.in.length>0;
  el.innerHTML=`<div class="mt" style="margin-bottom:10px">${esc(cchColLabel(f.c))}</div>${inner}
    <div class="sheet-acts">${ok?`<button class="btn btp" onclick="cchAddFilter()">${num?'Add filter':`Add filter · ${f.in.length}`}</button>`:''}<button class="btn btg" onclick="_cchf.c=null;_cchf.in=[];renderCchFilter()">Back</button></div>`;
}
function cchToggleVal(v){const f=_cchf;if(!f)return;const i=f.in.indexOf(v);if(i>=0)f.in.splice(i,1);else f.in.push(v);renderCchFilter();}
function cchToggleGroup(i){const f=_cchf;const g=CCH_MUSCLE_GROUPS[i];if(!f||!g)return;const all=g.m.every(m=>f.in.includes(m));f.in=all?f.in.filter(m=>!g.m.includes(m)):[...new Set(f.in.concat(g.m))];renderCchFilter();}
function cchAddFilter(){
  const f=_cchf;if(!f||!_cch)return;const s=_cch.c[f.key];if(!s)return;
  if(CCH_NUM.has(f.c)){const v=parseFloat((document.getElementById('cchf-v')||{}).value);if(!isFinite(v)){toast('Type a number','red');return;}s.w.push({c:f.c,op:f.op,v});}
  else{if(!f.in.length)return;s.w=s.w.filter(x=>x.c!==f.c);s.w.push({c:f.c,in:f.in.slice()});}
  s.w=s.w.slice(0,CCH_MAX_FILTERS);
  closeOv('cchf-ov');renderChartBuilder();
}
