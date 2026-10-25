// ═══════════════════════════════════════════════════
// CUSTOM CHARTS — charts you build yourself, kept on the Progress board
// ═══════════════════════════════════════════════════
// A custom chart is a saved question put to the same flat tables the coach reads
// (65b-coach-data.js), so a number here means what it means everywhere else in the app:
//   a table · a measure (a column and how to sum it up, or a count) · filters on that table ·
//   how the rows are grouped (day, week, month, weekday, or a column such as exercise or muscle).
// Then one of: a second line laid over the first, or the first split by a category.
// The board's range (4 weeks … a year) applies. No AI, no network: all of it is worked out here.
// Anything that cannot work for the chart as it stands is not offered in the builder at all.
//
// Saved in S.customCharts: [{id,name,a,b,by,view,idx,split,cmp,lag,roll,tgt}]
//   a, b   {t, m, fn, w:[filter], tr}   b is null without a second line
//     m    'count' | 'sessions' | 'strength' | 'hardsets' (sets only) | a numeric column
//     fn   'sum' | 'avg' | 'max' | 'min' (only for a column)
//     w    {c, in:[values]} or {c, op, v} for a number
//     tr   'chg' = the change from the bucket before, instead of the level (over time only)
//   by     'day' | 'week' | 'month' | 'weekday' | a column of the table | 'muscle_group' (sets)
//   view   line | bars | scatter | radar | heat | hist | box | stack | area | share
//   idx    two lines over time start at 100 (forced when their units differ)
//   split  a column: the first series drawn once for each of its biggest five values
//   cmp    radar only: 'prev' (the period before) | 'target' (Hard sets: the useful range)
//   lag    0–3: the second line is taken from that many buckets earlier
//   roll   by day: a 7-day rolling average
//   tgt    a target line (calories, protein, body weight)
//   wide   the tile spans the board and draws the whole chart
// On the board each chart is a tile with the key cc_<id>. Drawing is in 46c-chart-kinds.js.

const CCH_BOX_MIN=5,CCH_MAX=12,CCH_MAX_FILTERS=3,CCH_CAT_ROWS=24,CCH_SPLIT_MAX=5,CCH_CLUSTER_MAX=8,CCH_RADAR_MIN=3,CCH_RADAR_MAX=8,CCH_LAG_MAX=3;
const CCH_SOURCES=['sets','workouts','daily','meals','meal_items','activities','measurements','habit_days','supplements'];
const CCH_SRC={sets:{l:'Sets',n:'Sets done',one:'set',many:'sets'},workouts:{l:'Workouts',n:'Workouts',one:'workout',many:'workouts'},daily:{l:'Days',n:'Days',one:'day',many:'days'},
  meals:{l:'Meals',n:'Meals logged',one:'meal',many:'meals'},meal_items:{l:'Foods eaten',n:'Foods logged',one:'food',many:'foods'},activities:{l:'Activities',n:'Activities',one:'activity',many:'activities'},
  measurements:{l:'Measurements',n:'Measurements',one:'measurement',many:'measurements'},habit_days:{l:'Habits',n:'Habit-days due',one:'habit-day',many:'habit-days'},
  supplements:{l:'Supplements',n:'Supplement-days',one:'supplement-day',many:'supplement-days'}};
const CCH_VIEWS=['line','bars','scatter','radar','heat','hist','box','stack','area','share'];
const CCH_VIEW_LABEL={line:'Line',bars:'Bars',scatter:'Scatter',radar:'Radar',heat:'Heat map',hist:'Spread',box:'Box plot',stack:'Stacked',area:'Area',share:'Share'};
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
  workout:'Workout',exercise:'Exercise',muscle:'Muscle',muscle_group:'Muscle group',equipment:'Equipment',tag:'Set tag',routine:'Routine',program:'Program',meal:'Meal',food:'Food',type:'Kind',
  shoe:'Shoes',part:'Body part',habit:'Habit',kind:'Habit kind',status:'Status',supplement:'Supplement',serving:'Serving',value:'Measurement',amount:'Amount',target:'Target',
  servings:'Servings',minutes:'Minutes',miles:'Miles',steps:'Steps',mood:'Mood',weight:'Weight',volume:'Volume',reps:'Reps',seconds:'Seconds',exercises:'Exercises',load:'Training load',
  hardsets:'Hard sets a week'};
// Muscles come one at a time in the log; these are the groups people think in. The order is the
// radar's: pushing muscles side by side, then pulling, then legs and core.
const CCH_MUSCLE_GROUPS=[{l:'Chest',m:['Chest']},{l:'Shoulders',m:['Front Delts','Side Delts','Rear Delts']},{l:'Arms',m:['Biceps','Triceps','Forearms']},
  {l:'Back',m:['Lats','Traps','Lower Back']},{l:'Legs',m:['Quads','Hamstrings','Glutes','Calves']},{l:'Core',m:['Abs','Obliques']}];
// A number that only means something one at a time: averaging a waist with a chest, or a run's pace
// with a walk's, gives a figure that describes nothing. Such a series is split or filtered by this column.
const CCH_ONE={measurements:{value:'part'},habit_days:{amount:'habit',target:'habit'},activities:{pace_min_per_mile:'type'}};
// Targets a line can be drawn against: the column that holds the day's own target, or the goal.
const CCH_TARGET={daily:{kcal:'target_kcal',protein_g:'target_protein_g',weight:'goal'}};

function cchColLabel(c){return CCH_LABEL[c]||(String(c).charAt(0).toUpperCase()+String(c).slice(1)).replace(/_/g,' ');}
function cchCols(t){const T=QD_TABLES[t];return T?Object.keys(T.cols):[];}
function cchNumCols(t){return cchCols(t).filter(c=>CCH_NUM.has(c)||CCH_BOOL.has(c));}
function cchCatCols(t){return cchCols(t).filter(c=>CCH_CAT.has(c)).concat(t==='sets'?['muscle_group']:[]);}
function cchFilterCols(t){return cchCols(t).filter(c=>CCH_CAT.has(c)||CCH_BOOL.has(c)||CCH_NUM.has(c));}
function cchIsTime(by){return by==='day'||by==='week'||by==='month';}
// Measures worked out from whole rows rather than read from one column. Days have a column called
// sessions (workouts that day), which is an ordinary number there.
function cchSpecial(m,t){return m==='count'||m==='strength'||m==='hardsets'||(m==='sessions'&&t==='sets');}
// A plain numeric column (not a count, not true/false): what a spread or a box plot can be drawn of.
function cchIsNumCol(s){return !!s&&!cchSpecial(s.m,s.t)&&CCH_NUM.has(s.m);}
// A total over a bucket (it grows with how much was done) as opposed to a level.
function cchIsTotal(s){return !!s&&(s.m==='count'||(s.m==='sessions'&&s.t==='sets')||(!cchSpecial(s.m,s.t)&&s.fn==='sum'));}
function cchMuscleGroup(m){const g=CCH_MUSCLE_GROUPS.find(x=>x.m.includes(m));return g?g.l:null;}
// The measures a table offers: [{m, l}]
function cchMeasures(t){
  const out=[{m:'count',l:(CCH_SRC[t]||{n:'Rows'}).n}];
  if(t==='sets'){out.push({m:'sessions',l:'Sessions'});out.push({m:'strength',l:'Strength change'});out.push({m:'hardsets',l:'Hard sets a week, by muscle'});}
  cchNumCols(t).forEach(c=>out.push({m:c,l:cchColLabel(c)}));
  return out;
}
// What a column is usually summed up as. A day's calories, steps or weigh-in is averaged across
// days (a week where four days were logged is not a diet week); a workout's sets add up.
const CCH_DAILY_SUMS=['sessions','working_sets','volume','workout_minutes','cardio_minutes','miles','meals_logged','habits_kept','habits_due','supplements_taken'];
function cchDefaultFn(c,t){
  if(t==='daily')return CCH_DAILY_SUMS.includes(c)?'sum':'avg';
  if(c==='weight')return t==='sets'?'max':'avg';
  if(['e1rm','reps','seconds','avg_hr','climb_ft'].includes(c))return'max';
  if(['feel','mood','sleep_h','rir','pace_min_per_mile','value','target_kcal','target_protein_g','amount','target'].includes(c)||CCH_BOOL.has(c))return'avg';
  return'sum';
}
function cchSeriesLabel(s){
  if(!s)return'';
  const ms=cchMeasures(s.t).find(x=>x.m===s.m);let base=ms?ms.l:cchColLabel(s.m);
  if(s.m==='hardsets')base='Hard sets a week';
  const fn=cchSpecial(s.m,s.t)?'':((CCH_FNS.find(f=>f.id===s.fn)||CCH_FNS[0]).l+' ');
  const lower=fn&&!/^[A-Z0-9]{2}/.test(base)?base.charAt(0).toLowerCase()+base.slice(1):base;
  let main=fn+lower;
  if(s.tr==='chg')main='Change in '+(/^[A-Z0-9]{2}/.test(main)?main:main.charAt(0).toLowerCase()+main.slice(1));
  const f=(s.w||[]).map(cchFilterText).filter(Boolean);
  return main+(f.length?' · '+f.join(' · '):'');
}
function cchShort(s){return cchSeriesLabel(s).split(' · ')[0];}
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
function cchUnitWord(by,n){const w=by==='day'?'day':by==='week'?'week':by==='month'?'month':by==='weekday'?'weekday':cchColLabel(by).toLowerCase();return n===1?w:w+'s';}
function cchAutoName(c){
  const a=cchShort(c.a);
  if(c.split)return`${a} by ${cchColLabel(c.split).toLowerCase()}`.slice(0,60);
  if(c.view==='hist')return`${a}, spread`.slice(0,60);
  if(c.view==='box')return`${a} by ${cchByLabel(c.by).toLowerCase()}`.slice(0,60);
  if(!c.b)return cchSeriesLabel(c.a).slice(0,60);
  return`${a} vs ${cchShort(c.b).replace(/^./,x=>x.toLowerCase())}`.slice(0,60);
}

// ─── The rules: what goes with what ───
// Same units, so the two can share an axis without starting at 100.
function cchSameUnit(a,b){
  if(!a||!b)return true;
  const cnt=s=>s.m==='count'||(s.m==='sessions'&&s.t==='sets');
  return((a.m===b.m&&a.t===b.t)||(cnt(a)&&cnt(b))||(a.m==='strength'&&b.m==='strength'))&&(a.tr||'')===(b.tr||'');
}
// Two lines over time start at 100: on when asked, and always when their units differ.
function cchIdxOn(c){return !!(c.b&&cchIsTime(c.by)&&c.view!=='scatter'&&!c.a.tr&&!c.b.tr&&(c.idx||!cchSameUnit(c.a,c.b)));}
// Is a series measured one thing at a time (a single body part, habit, kind of activity)?
function cchOneCol(s){return(CCH_ONE[s.t]||{})[s.m]||null;}
function cchOneOk(c,key){
  const s=c[key];const col=s&&cchOneCol(s);if(!col)return true;
  if((s.w||[]).some(f=>f.c===col&&Array.isArray(f.in)&&f.in.length===1))return true;
  return c.by===col||(key==='a'&&c.split===col)||(key==='a'&&c.view==='box'&&c.by===col);
}
// The target a series can be drawn against, or null: {col} (that day's own target) or {v} (a goal).
function cchTargetOf(c){
  const a=c.a;if(!a||a.tr||c.split||c.view==='scatter'||!cchIsTime(c.by)||cchIdxOn(c))return null;
  if(!['line','bars'].includes(c.view))return null;
  const col=(CCH_TARGET[a.t]||{})[a.m];if(!col)return null;
  if(col==='goal')return S.weightGoal>0&&a.fn!=='sum'?{v:+S.weightGoal,l:'Goal'}:null;
  if(!['avg','sum'].includes(a.fn))return null;
  return{col,l:'Target'};
}
// The views the chart as built can be drawn as, before looking at the data. First is the default.
function cchViewList(c){
  const a=c.a,time=cchIsTime(c.by);
  if(a.m==='hardsets')return['radar','bars'];
  if(c.split){
    const tot=cchIsTotal(a)&&a.m!=='strength';
    if(time)return['line','bars'].concat(tot?['stack','area','share']:[]);
    return['bars'].concat(tot?['stack','share']:[]);
  }
  if(c.b){
    // A level and a change, or two units that cannot be started at 100, only meet on a scatter.
    const together=cchSameUnit(a,c.b)||(!a.tr&&!c.b.tr);
    if(time)return(together?['line','bars']:[]).concat(['scatter']);
    return['bars','scatter'];
  }
  const num=cchIsNumCol(a);
  if(time)return['line','bars'].concat(c.by==='day'&&!a.tr?['heat']:[]).concat(num&&!a.tr?['hist']:[]);
  return['bars'].concat(a.m!=='strength'&&!a.tr?['radar']:[]).concat(num?['box','hist']:[]);
}
// Put a chart right after any change: nothing left that cannot work. Pure: no data needed.
function cchValidate(c){
  const a=c.a;
  if(a.m==='hardsets'){c.b=null;c.split=null;a.w=[];a.tr=null;if(!['muscle_group','muscle'].includes(c.by))c.by='muscle_group';if(c.by==='muscle')c.view='bars';} // 16 muscles are too many spokes
  else if(c.by==='muscle_group'&&a.t!=='sets')c.by='week';
  if(c.b){c.split=null;if(c.b.m==='hardsets')c.b=null;}
  const cats=x=>cchCatCols(x.t);
  if(!cchIsTime(c.by)&&c.by!=='weekday'&&!(cats(a).includes(c.by)&&(!c.b||cats(c.b).includes(c.by))))c.by='week';
  if(c.split&&!(cats(a).includes(c.split))||c.split===c.by)c.split=null;
  if(c.split&&!(cchIsTime(c.by)||c.by==='weekday'))c.split=null;
  const time=cchIsTime(c.by);
  if(!time){a.tr=null;if(c.b)c.b.tr=null;}
  // A number that only means something one at a time: split by that column when the chart allows, else
  // the builder asks for one (cchFix picks the most logged).
  if(!cchOneOk(c,'a')&&!c.b&&(time||c.by==='weekday')&&!['hist','box','radar','heat'].includes(c.view))c.split=cchOneCol(a);
  if(c.split){a.tr=null;}
  const views=cchViewList(c);
  if(!views.includes(c.view))c.view=views[0];
  if(['heat','hist','box','radar'].includes(c.view)){a.tr=null;}
  if(c.view==='heat'&&c.by!=='day')c.view=views[0];
  c.lag=c.b&&time?Math.max(0,Math.min(CCH_LAG_MAX,parseInt(c.lag)||0)):0;
  c.roll=!!(c.roll&&c.by==='day'&&!c.split&&['line','bars','scatter'].includes(c.view)&&a.m!=='strength');
  c.cmp=c.view==='radar'&&(c.cmp==='prev'||(c.cmp==='target'&&a.m==='hardsets'))?c.cmp:null;
  c.tgt=!!(c.tgt&&cchTargetOf(c));
  return c;
}

// ─── Saved charts ───
function normalizeCustomCharts(v){
  if(!Array.isArray(v))return[];
  const ser=s=>{
    if(!isObj(s)||!CCH_SOURCES.includes(s.t))return null;
    const ok=cchSpecial(s.m,s.t)?(s.m==='count'||s.t==='sets'):cchNumCols(s.t).includes(s.m);
    if(!ok)return null;
    const o={t:s.t,m:s.m,fn:CCH_FNS.some(f=>f.id===s.fn)?s.fn:'sum',w:[]};
    if(s.tr==='chg')o.tr='chg';
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
    const o={id,name:typeof c.name==='string'?c.name.trim().slice(0,60):'',a,b,by:typeof c.by==='string'?c.by:'week',
      view:CCH_VIEWS.includes(c.view)?c.view:'line',idx:c.idx!==false,split:typeof c.split==='string'?c.split:null,
      cmp:c.cmp||null,lag:c.lag||0,roll:!!c.roll,tgt:!!c.tgt,wide:!!c.wide};
    cchValidate(o);
    const out={id:o.id,name:o.name,a:o.a,b:o.b,by:o.by,view:o.view,idx:o.idx};
    ['split','cmp'].forEach(k=>{if(o[k])out[k]=o[k];});
    if(o.lag)out.lag=o.lag;if(o.roll)out.roll=true;if(o.tgt)out.tgt=true;if(o.wide)out.wide=true;
    [out.a,out.b].forEach(x=>{if(x&&!x.tr)delete x.tr;});
    return out;
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
    METRICS[k]={title:cchName(c),group:'Custom charts',custom:true,param:'custom',wide:!!c.wide,
      paramText:()=>cchSeriesLabel(c.a)+(c.b?' · vs '+cchSeriesLabel(c.b):c.split?' · by '+cchColLabel(c.split).toLowerCase():''),
      has:()=>true,tile:range=>Object.assign(cchTile(c,range),c.wide?{cls:'tile-cc'}:{})};
  });
}

// ─── The numbers ───
function cchKeep(r,f){
  const v=r[f.c];
  if(Array.isArray(f.in))return f.in.includes(v==null?'':String(v));
  if(Array.isArray(f.nin))return v!=null&&v!==''&&!f.nin.includes(String(v));
  const n=typeof v==='boolean'?(v?1:0):qdN(v);if(n==null)return false;const x=+f.v;
  return f.op==='>'?n>x:f.op==='>='?n>=x:f.op==='<'?n<x:f.op==='<='?n<=x:f.op==='!='?n!==x:n===x;
}
function cchRows(s,from,to){
  const T=QD_TABLES[s.t];if(!T)return[];
  let rows;try{rows=T.rows(from,to)||[];}catch(e){logError(e,'custom chart '+s.t);return[];}
  if(s.t==='sets')rows.forEach(r=>{r.muscle_group=cchMuscleGroup(r.muscle);});
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
function cchBucketCount(by,range){
  if(by==='weekday')return 7;
  if(!cchIsTime(by))return 0;
  const from=by==='week'?weekStartOf(range.from):by==='month'?range.from.slice(0,8)+'01':range.from;
  return cchTimeKeys(by,from,range.to||today()).length;
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
// Strength change, as an index that starts at 100. Averaging estimated maxes of different lifts
// would move with whichever lifts were done, so each lift is only ever compared with itself:
//  · over time — chained, the way a price index is: each bucket's step is the average change of the
//    lifts done in it since each one was last done, and the steps multiply up. A lift skipped this week
//    does not pull the line down; a lift started mid-range joins without dragging it towards 100.
//    The average of the changes is geometric, so up 10% then down 10% lands where it began.
//  · by weekday — a session's best against that lift's average session over the range
//  · by a column (exercise, muscle) — a lift's last session against its first in the range
function cchStrength(groups,by){
  const sess=g=>{const m=new Map();g.rows.forEach(r=>{if(!(r.e1rm>0))return;const k=r.ex_id+'|'+r.workout_id;const o=m.get(k);if(!o||r.e1rm>o.v)m.set(k,{ex:r.ex_id,v:r.e1rm,d:r.date});});return[...m.values()];};
  const geo=rs=>Math.exp(patMean(rs.map(x=>Math.log(x))));
  if(cchIsTime(by)){
    const last={};let level=null;
    groups.forEach(g=>{
      const best={};sess(g).forEach(s=>{if(!(best[s.ex]>=s.v))best[s.ex]=s.v;});
      const ex=Object.keys(best);
      if(!ex.length){g.v=null;g.n=0;return;}
      const steps=[];ex.forEach(e=>{if(last[e]>0)steps.push(best[e]/last[e]);last[e]=best[e];});
      if(level==null)level=100;else if(steps.length)level*=geo(steps);
      g.v=level;g.n=ex.length;
    });
    return;
  }
  if(by==='weekday'){
    const all=[];groups.forEach(g=>sess(g).forEach(s=>all.push(Object.assign({g},s))));
    const avg={};const cnt={};all.forEach(s=>{avg[s.ex]=(avg[s.ex]||0)+s.v;cnt[s.ex]=(cnt[s.ex]||0)+1;});
    Object.keys(avg).forEach(ex=>{avg[ex]/=cnt[ex];});
    groups.forEach(g=>{const rs=all.filter(s=>s.g===g&&cnt[s.ex]>=2).map(s=>s.v/avg[s.ex]);g.v=rs.length?geo(rs)*100:null;g.n=rs.length;});
    return;
  }
  groups.forEach(g=>{
    const by_ex={};sess(g).forEach(s=>{(by_ex[s.ex]=by_ex[s.ex]||[]).push(s);});
    const rs=[];Object.values(by_ex).forEach(l=>{if(l.length<2)return;l.sort((x,y)=>x.d<y.d?-1:x.d>y.d?1:0);rs.push(l[l.length-1].v/l[0].v);});
    g.v=rs.length?geo(rs)*100:null;g.n=rs.length;
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
  else if(by==='muscle_group')keys=CCH_MUSCLE_GROUPS.map(g=>g.l).filter(k=>map.has(k));
  else keys=[...map.keys()];
  const groups=keys.map(k=>map.get(k)||{k,rows:[]});
  if(s.m==='strength')cchStrength(groups,by);
  else groups.forEach(g=>{
    g.n=g.rows.length;
    if(s.m==='count')g.v=g.rows.length;
    else if(s.m==='sessions'&&s.t==='sets')g.v=new Set(g.rows.map(r=>r.workout_id)).size;
    else{g.v=cchAgg(s.fn,g.rows,s.m);if(g.v==null&&s.fn==='sum'&&cchIsTime(by))g.v=0;}
  });
  // A total for the week or month still under way is not comparable with whole ones: it is left out.
  const total=cchIsTotal(s);
  const cur=by==='week'?weekStartOf(to):by==='month'?to.slice(0,7):null;
  if(total&&cur&&to===today())groups.forEach(g=>{if(g.k===cur){g.sofar=g.v;g.v=null;g.open=true;}});
  // Empty buckets before the first one with anything in it are before you started, not zeros.
  if(total&&cchIsTime(by))for(const g of groups){if(g.v||g.open)break;g.v=null;}
  const rnd=v=>v==null?null:Math.round(v*100)/100;
  return groups.map(g=>({k:g.k,label:cchKeyLabel(g.k,by),t:cchIsTime(by)?cchKeyT(g.k,by):null,v:rnd(g.v),n:g.n||0,open:!!g.open,sofar:g.open?rnd(g.sofar):null}));
}
// Hard sets a week for each muscle (helper muscles count half, as on the Muscles tile), averaged over
// the weeks of the range since the first workout in it.
function cchHardSets(by,range){
  const from=range.from,to=range.to||today();
  const ws=(S.workouts||[]).filter(w=>dayOf(w.started)>=from&&dayOf(w.started)<=to);
  const start=ws.length?ws.reduce((m,w)=>Math.min(m,w.started),Infinity):null;
  const m=start?muscleSetsInRange(dayDate(from).getTime()-12*3600000,dayDate(to).getTime()+12*3600000):{};
  const weeks=start?Math.max(1,(daysBetween(dayOf(start),to)+1)/7):1;
  const out=by==='muscle'?Object.keys(MEV_MAV).map(k=>({k,v:m[k]||0,lo:MEV_MAV[k].mev,hi:MEV_MAV[k].mav}))
    :CCH_MUSCLE_GROUPS.map(g=>({k:g.l,v:g.m.reduce((t,x)=>t+(m[x]||0),0),lo:g.m.reduce((t,x)=>t+MEV_MAV[x].mev,0),hi:g.m.reduce((t,x)=>t+MEV_MAV[x].mav,0)}));
  return out.map(x=>({k:x.k,label:x.k,t:null,v:start?Math.round(x.v/weeks*10)/10:null,n:start?1:0,lo:x.lo,hi:x.hi}));
}
// A 7-day rolling average: each day the mean of it and the six before with a value (at least three).
function cchRoll(list){
  return list.map((x,i)=>{const w=list.slice(Math.max(0,i-6),i+1).map(y=>y.v).filter(v=>v!=null);
    return Object.assign({},x,{v:w.length>=3?Math.round(patMean(w)*100)/100:null,day:x.v});});
}
// The change from the bucket before, in the series' own units (strength: index points).
function cchChg(list){
  return list.map((x,i)=>{const p=i?list[i-1]:null;
    return Object.assign({},x,{lvl:x.v,v:p&&p.v!=null&&x.v!=null?Math.round((x.v-p.v)*100)/100:null,sofar:null,open:x.open});});
}
// The second line taken from n buckets earlier, so this week's line sits against last week's cause.
function cchLag(list,n){
  if(!n)return list;
  return list.map((x,i)=>{const p=list[i-n];return Object.assign({},x,{v:p?p.v:null,raw:p?(p.raw!=null?p.raw:p.v):null,lvl:p?p.lvl:null,from:p?p.label:null,open:false,sofar:null});});
}
function cchPrevRange(range){
  const days=range.days||daysBetween(range.from,range.to||today());
  return Object.assign({},range,{from:addDays(range.from,-days),to:addDays(range.from,-1)});
}
// The whole chart, worked out. Each kind returns what its drawing needs; kind is one of
// 'series' (lines, bars, scatter), 'split', 'radar', 'heat', 'hist', 'box'.
function cchCompute(c,range){
  if(c.view==='hist')return cchHist(c,range);
  if(c.view==='box')return cchBox(c,range);
  if(c.split)return cchSplit(c,range);
  if(c.view==='radar')return cchRadar(c,range);
  if(c.a.m==='hardsets')return{kind:'series',a:cchHardSets(c.by,range).sort((p,q)=>(q.v||0)-(p.v||0)),b:null,by:c.by,view:'bars',idx:false};
  if(c.view==='heat')return{kind:'heat',a:cchSeries(c.a,'day',range),by:'day',view:'heat'};
  let a=cchSeries(c.a,c.by,range);
  let b=c.b?cchSeries(c.b,c.by,range):null;
  const out={kind:'series',by:c.by,view:c.view,lag:c.lag||0};
  // By a column, the categories are the ones either series has, biggest first (by the first series).
  if(!cchIsTime(c.by)&&c.by!=='weekday'){
    const all=new Map();a.forEach(x=>all.set(x.k,{a:x,b:null}));(b||[]).forEach(x=>{const o=all.get(x.k)||{a:{k:x.k,label:x.label,v:null,n:0},b:null};o.b=x;all.set(x.k,o);});
    const list=[...all.values()].sort((p,q)=>((q.a.v==null?-Infinity:q.a.v)-(p.a.v==null?-Infinity:p.a.v))||String(p.a.k).localeCompare(String(q.a.k)));
    a=list.map(x=>x.a);if(b)b=list.map(x=>x.b||{k:x.a.k,label:x.a.label,v:null,n:0});
  }
  // Target: the same sum-up of that day's own target over the days the measure was logged.
  const tg=c.tgt?cchTargetOf(c):null;
  let tgt=null;
  if(tg&&tg.col)tgt=cchSeries({t:c.a.t,m:tg.col,fn:c.a.fn,w:(c.a.w||[]).concat([{c:c.a.m,op:'>=',v:0}])},c.by,range);
  if(tg&&tg.v!=null)tgt=a.map(x=>({k:x.k,t:x.t,v:tg.v}));
  if(c.roll){a=cchRoll(a);if(b)b=cchRoll(b);if(tgt&&tg.col)tgt=cchRoll(tgt);}
  if(c.a.tr==='chg')a=cchChg(a);
  if(b&&c.b.tr==='chg')b=cchChg(b);
  if(b&&c.lag)b=cchLag(b,c.lag);
  out.idx=cchIdxOn(c);
  if(out.idx){a=cchIndex(a,c.a);b=cchIndex(b,c.b);}
  out.a=a;out.b=b;out.tgt=tgt;out.tgtLabel=tg?tg.l:null;
  if(b){
    const pairs=[];a.forEach((x,i)=>{const y=b[i];if(x.v!=null&&y&&y.v!=null)pairs.push({x:y.v,y:x.v,label:x.label,raw:[x.raw!=null?x.raw:x.v,y.raw!=null?y.raw:y.v]});});
    out.pairs=pairs;out.n=pairs.length;
    out.r=pairs.length>=3?Math.round(patCorr(pairs.map(p=>p.x),pairs.map(p=>p.y))*100)/100:null;
    // Two lines that both drift over the range correlate whatever they are; the note says so.
    if(cchIsTime(c.by)&&!c.a.tr&&!c.b.tr&&pairs.length>=CCH_MIN_PAIRS){
      const tr=list=>{const p=list.filter(x=>x.v!=null&&x.t!=null);return p.length>=4?Math.abs(patCorr(p.map(x=>x.t),p.map(x=>x.v))):0;};
      out.trending=tr(a)>=0.5&&tr(b)>=0.5;
    }
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
  if(!list)return list;
  if(s&&s.m==='strength')return list.map(x=>Object.assign({},x,{raw:x.v}));
  const base=cchBase(list);
  return list.map(x=>Object.assign({},x,{raw:x.v,v:base&&x.v!=null?Math.round(x.v/base*1000)/10:null}));
}
// The first series once for each of the split column's biggest values. Totals keep everything else
// together as Other, so the stack still adds up to the whole; for averages the rest is left out.
function cchSplit(c,range){
  const a=c.a,col=c.split,by=c.by;
  const rows=cchRows(a,range.from,range.to||today());
  const size=new Map();
  rows.forEach(r=>{const k=r[col];if(k==null||k==='')return;const v=cchSpecial(a.m,a.t)?1:cchNumOf(r[a.m]);size.set(String(k),(size.get(String(k))||0)+(v==null?0:Math.abs(v)));});
  let names=[...size.entries()].sort((p,q)=>q[1]-p[1]||p[0].localeCompare(q[0])).map(x=>x[0]);
  if(col==='muscle_group')names=CCH_MUSCLE_GROUPS.map(g=>g.l).filter(n=>size.has(n)).sort((p,q)=>size.get(q)-size.get(p));
  const top=names.slice(0,CCH_SPLIT_MAX),rest=names.slice(CCH_SPLIT_MAX);
  const total=cchIsTotal(a)&&a.m!=='strength';
  const groups=top.map((n,i)=>({name:n,slot:i+1,list:cchSeries(Object.assign({},a,{w:(a.w||[]).concat([{c:col,in:[n]}])}),by,range)}));
  if(total&&rest.length)groups.push({name:'Other',slot:0,other:rest.length,list:cchSeries(Object.assign({},a,{w:(a.w||[]).concat([{c:col,nin:top}])}),by,range)});
  const keys=groups.length?groups[0].list.map(x=>({k:x.k,label:x.label,t:x.t,open:x.open})):[];
  let view=c.view;
  // Side by side only reads with a few buckets; with more, the same totals stack, and levels draw as lines.
  if(view==='bars'&&keys.length>CCH_CLUSTER_MAX)view=total?'stack':(cchIsTime(by)?'line':'bars');
  if(view==='line'&&!cchIsTime(by))view='bars';
  return{kind:'split',by,col,groups,keys,total,view,asked:c.view,left:total?0:rest.length};
}
// Radar: one value on each spoke. The spokes keep a fixed order (weekdays, muscle groups, else A to Z),
// never sorted by size, so this period's shape can be laid on the last one's.
function cchRadar(c,range){
  const one=rg=>{
    if(c.a.m==='hardsets')return cchHardSets(c.by,rg);
    const l=cchSeries(c.a,c.by,rg);
    if(c.by==='weekday'||c.by==='muscle_group')return l;
    return l.slice().sort((p,q)=>String(p.k).localeCompare(String(q.k)));
  };
  let axes=one(range);
  if(c.a.m!=='hardsets'&&c.by!=='weekday'&&c.by!=='muscle_group')axes=axes.filter(x=>x.v!=null);
  const out={kind:'radar',by:c.by,axes,cmp:c.cmp||null,view:'radar'};
  if(axes.length<CCH_RADAR_MIN||axes.length>CCH_RADAR_MAX){out.bad=true;return out;}
  if(c.cmp==='prev'){const p=one(cchPrevRange(range));out.prev=axes.map(x=>{const y=p.find(z=>z.k===x.k);return y?y.v:null;});}
  if(c.cmp==='target')out.band=axes.map(x=>({lo:x.lo,hi:x.hi}));
  return out;
}
// A spread: how often each size of the number comes up, one row of the table at a time.
function cchQuant(sorted,p){if(!sorted.length)return null;const i=(sorted.length-1)*p;const lo=Math.floor(i),hi=Math.ceil(i);return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo);}
function cchStats(vals){
  const s=vals.slice().sort((x,y)=>x-y);
  return{n:s.length,min:s[0],max:s[s.length-1],q1:cchQuant(s,0.25),med:cchQuant(s,0.5),q3:cchQuant(s,0.75),mean:s.length?patMean(s):null};
}
function cchHist(c,range){
  const vals=cchRows(c.a,range.from,range.to||today()).map(r=>cchNumOf(r[c.a.m])).filter(v=>v!=null);
  const out={kind:'hist',view:'hist',vals:vals.length};
  if(vals.length<3){out.bins=[];return out;}
  const st=cchStats(vals);Object.assign(out,st);
  const ints=vals.every(v=>Number.isInteger(v));
  const span=st.max-st.min;
  let step;
  if(!(span>0))step=ints?1:Math.max(Math.abs(st.max)*0.1,0.1);
  else{const raw=span/10;const mag=Math.pow(10,Math.floor(Math.log10(raw)));step=[1,2,2.5,5,10].map(m=>m*mag).find(s=>span/s<=12)||10*mag;if(ints)step=Math.max(1,Math.round(step));}
  const lo=Math.floor(st.min/step)*step;
  const n=Math.max(1,Math.floor((st.max-lo)/step)+1);
  const bins=Array.from({length:n},(x,i)=>({lo:Math.round((lo+i*step)*1e6)/1e6,hi:Math.round((lo+(i+1)*step)*1e6)/1e6,n:0}));
  vals.forEach(v=>{const i=Math.min(n-1,Math.floor((v-lo)/step+1e-9));bins[i].n++;});
  out.bins=bins;out.step=step;out.ints=ints;
  return out;
}
// A box for each category: the middle half of the rows, the median, and how far the rest reach.
function cchBox(c,range){
  const by=c.by;
  const rows=cchRows(c.a,range.from,range.to||today());
  const map=new Map();
  rows.forEach(r=>{const k=cchKey(r,by);const v=cchNumOf(r[c.a.m]);if(k==null||v==null)return;if(!map.has(k))map.set(k,[]);map.get(k).push(v);});
  let keys;
  if(by==='weekday')keys=weekOrder().map(String).filter(k=>map.has(k));
  else if(by==='muscle_group')keys=CCH_MUSCLE_GROUPS.map(g=>g.l).filter(k=>map.has(k));
  else keys=[...map.keys()].sort((p,q)=>map.get(q).length-map.get(p).length||p.localeCompare(q)).slice(0,10);
  const boxes=keys.map(k=>{const v=map.get(k);const st=cchStats(v);const iqr=st.q3-st.q1;const lo=st.q1-1.5*iqr,hi=st.q3+1.5*iqr;
    const inside=v.filter(x=>x>=lo&&x<=hi);
    return Object.assign({k,label:cchKeyLabel(k,by),wlo:Math.min(...inside),whi:Math.max(...inside),out:v.filter(x=>x<lo||x>hi).slice(0,12),vals:v.slice().sort((x,y)=>x-y).slice(0,CCH_BOX_MIN)},st);});
  return{kind:'box',view:'box',by,boxes,left:Math.max(0,map.size-keys.length)};
}

// How a value is written: strength as a change, big numbers with commas, the rest to one decimal.
function cchFmt(s,v){
  if(v==null)return'–';
  if(s&&s.tr==='chg'){const a=Math.abs(v);const sign=v>0?'+':v<0?'−':'';
    if(s.m==='strength')return sign+fmt1(a)+' pts';
    if(s.m==='pace_min_per_mile')return sign+fmtPace(a*60);
    if(CCH_BOOL.has(s.m)&&s.fn==='avg')return sign+Math.round(a*100)+' pts';
    return sign+(a>=1000?Math.round(a).toLocaleString():fmt1(a));}
  if(s&&s.m==='strength')return(v>=100?'+':'−')+fmt1(Math.abs(v-100))+'%';
  if(s&&s.m==='pace_min_per_mile')return fmtPace(v*60);
  if(s&&CCH_BOOL.has(s.m)&&s.fn==='avg')return Math.round(v*100)+'%';
  const a=Math.abs(v);return a>=1000?Math.round(v).toLocaleString():fmt1(v);
}
// A series' change over the range: first and last points that have a value.
function cchChange(list,s,idx){
  if(s.tr==='chg')return null;
  const pts=list.filter(x=>x.v!=null);if(pts.length<2)return null;
  const l=pts[pts.length-1];
  if(s.m==='strength')return{text:`${l.v>=100?'+':'−'}${fmt1(Math.abs(l.v-100))}%`,d:l.v-100};
  const base=idx?100:cchBase(pts); // indexed lines already start at 100
  if(!base)return null;
  const pct=(l.v-base)/Math.abs(base)*100;
  return{text:`${pct>=0?'+':'−'}${fmt1(Math.abs(pct))}%`,d:pct};
}
// With a handful of points r swings wildly, so it is not called anything until there are eight.
const CCH_MIN_PAIRS=8;
function cchStrengthWord(r,n){if(n!=null&&n<CCH_MIN_PAIRS)return'Too few to judge';const a=Math.abs(r);return a<0.2?'No real link':a<0.4?(r>0?'Weak, together':'Weak, opposite'):a<0.7?(r>0?'Moderate, together':'Moderate, opposite'):(r>0?'Strong, together':'Strong, opposite');}

// ─── The tile ───
function cchTile(c,range){
  const r=cchCompute(c,range);
  const t=cchTileOf(c,r,range);
  if(t.empty){const w=cchEmptyWhy(c,r);if(w)t.empty=cchEmptyShort(c,r,range,w);return t;}
  if(c.wide)t.html=cchWideHTML(c,r,t,range);
  return t;
}
// A wide tile: the tile's own line on top (opens the sheet), the whole chart under it.
function cchWideHTML(c,r,t,range){
  let chart;try{chart=cchChart(c,r,range);}catch(e){logError(e,'wide tile');chart='';}
  return`<button class="xc-wt" onclick="openTile(${jsq('cc_'+c.id)})"><span class="tile-l">${esc(t.title)}</span><span class="xc-wtv">${esc(t.value==null?'':String(t.value))}<small>${esc(t.unit||'')}</small></span>${ICON('chev',15)}</button>
    ${t.sub?`<div class="xc-wts dl-${t.tone||'flat'}">${esc(t.sub)}</div>`:''}${chart}`;
}
function cchTileOf(c,r,range){
  const title=cchName(c);
  const k=r.kind;
  if(k==='hist'){
    if(!r.bins.length)return{title,empty:'Needs at least three to show a spread.'};
    return{title,value:cchFmt(c.a,r.med),unit:'',sub:`Middle half ${cchFmt(c.a,r.q1)}–${cchFmt(c.a,r.q3)}`,tone:'flat',spark:svgBars(r.bins.map(b=>({v:b.n})))};
  }
  if(k==='box'){
    if(!r.boxes.length)return{title,empty:'Nothing in this period yet.'};
    const top=r.boxes.slice().sort((p,q)=>q.med-p.med)[0];
    return{title,value:cchFmt(c.a,top.med),unit:'',sub:`Highest median: ${top.label}${top.n<CCH_BOX_MIN?` (${top.n})`:''}`,tone:'flat',spark:cchBoxSpark(r,c)};
  }
  if(k==='radar'){
    if(r.bad)return{title,empty:`A radar needs ${CCH_RADAR_MIN} to ${CCH_RADAR_MAX} ${cchUnitWord(c.by)} with something logged. There ${r.axes.length===1?'is':'are'} ${r.axes.length}.`};
    if(!r.axes.some(x=>x.v))return{title,empty:'Nothing in this period yet.'};
    const s=r.axes.filter(x=>x.v!=null).sort((p,q)=>q.v-p.v);
    if(r.band){const ok=r.axes.filter((x,i)=>x.v>=r.band[i].lo&&x.v<=r.band[i].hi).length;
      return{title,value:String(ok),unit:` of ${r.axes.length}`,sub:'In the useful range',tone:ok===r.axes.length?'good':'flat',spark:cchRadarSpark(r)};}
    return{title,value:cchFmt(c.a,s[0].v),unit:'',sub:`Most: ${s[0].label} · least: ${s[s.length-1].label}`,tone:'flat',spark:cchRadarSpark(r)};
  }
  if(k==='heat'){
    const has=r.a.filter(x=>x.v!=null);if(!has.length)return{title,empty:'Nothing in this period yet.'};
    const tot=cchIsTotal(c.a);const on=tot?has.filter(x=>x.v>0).length:has.length;
    const wd=cchWeekdayMeans(r.a);const best=wd.filter(x=>x.v!=null).sort((p,q)=>q.v-p.v)[0];
    return{title,value:String(on),unit:` of ${r.a.length} days`,sub:best?`${tot?'Most':'Highest'} on ${CCH_DAY_NAMES[best.d]}s`:'',tone:'flat',spark:cchHeatSpark(r)};
  }
  if(k==='split'){
    const g=r.groups;if(!g.length||!g.some(x=>x.list.some(y=>y.v!=null)))return{title,empty:'Nothing in this period yet.'};
    if(r.total){
      const sums=g.map(x=>x.list.reduce((t,y)=>t+(y.v||0),0));const all=sums.reduce((t,v)=>t+v,0);
      const i=sums.indexOf(Math.max(...sums));
      return{title,value:all?Math.round(sums[i]/all*100)+'%':'–',unit:'',sub:`${g[i].name}, the biggest share`,tone:'flat',spark:cchSplitSpark(r)};
    }
    const last=g[0].list.filter(y=>y.v!=null).pop();
    return{title,value:last?cchFmt(c.a,last.v):'–',unit:'',sub:`${g[0].name}${g.length>1?` and ${g.length-1} more`:''}`,tone:'flat',spark:cchSplitSpark(r)};
  }
  if(r.view==='scatter'){
    if(r.r==null)return{title,empty:`Needs three ${cchUnitWord(c.by)} with both numbers.`};
    return{title,value:r.r.toFixed(2),unit:' r',sub:`${cchStrengthWord(r.r,r.n)} · ${r.n} ${cchUnitWord(c.by,r.n)}`,tone:'flat',spark:cchScatterSpark(r)};
  }
  if(!r.a.some(x=>x.v!=null)&&!(r.b&&r.b.some(x=>x.v!=null)))return{title,empty:'Nothing in this period yet.'};
  if(!cchIsTime(c.by)){
    const top=r.a.find(x=>x.v!=null);
    return{title,value:top?cchFmt(c.a,top.v):'–',unit:'',sub:top?`Top: ${top.label}`:'',tone:'flat',spark:cchCatSpark(r)};
  }
  const last=[...r.a].reverse().find(x=>x.v!=null);
  const ca=cchChange(r.a,c.a,r.idx),cb=r.b?cchChange(r.b,c.b,r.idx):null;
  const value=r.idx?(ca?ca.text:'–'):last?cchFmt(c.a,last.v):'–';
  const sub=r.b?(cb?`vs ${cb.text} ${cchShort(c.b).toLowerCase()}`:`vs ${cchShort(c.b).toLowerCase()}`)
    :ca&&c.a.m!=='strength'?`${ca.text} over ${range.short}`:last?last.label:'';
  return{title,value,unit:'',sub,tone:'flat',spark:cchSpark(r)};
}
const CCH_DAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function cchWeekdayMeans(list){
  return weekOrder().map(d=>{const v=list.filter(x=>x.v!=null&&dayDate(x.k).getDay()===d).map(x=>x.v);return{d,label:QD_DOW[d],v:v.length?patMean(v):null,n:v.length};});
}

// ─── The sheet a tile opens ───
// The numbers behind any chart: one table for the sheet and the CSV. Cells are raw numbers or text.
function cchTable(c,r){
  const k=r.kind;const sa=cchShort(c.a);
  if(k==='hist')return{head:[cchColLabel(c.a.m),CCH_SRC[c.a.t].many.replace(/^./,x=>x.toUpperCase())],
    rows:(r.bins||[]).map(b=>[r.ints&&r.step===1?String(b.lo):`${cchFmt(c.a,b.lo)} to ${cchFmt(c.a,b.hi)}`,b.n]),fmt:[null,v=>String(v)]};
  if(k==='box')return{head:[cchByLabel(c.by),'Median','Middle half','Lowest','Highest','How many'],
    rows:r.boxes.map(b=>[b.label,b.med,b.n<CCH_BOX_MIN?'–':`${cchFmt(c.a,b.q1)}–${cchFmt(c.a,b.q3)}`,b.min,b.max,b.n]),fmt:[null,v=>cchFmt(c.a,v),null,v=>cchFmt(c.a,v),v=>cchFmt(c.a,v),v=>String(v)]};
  if(k==='radar'){
    const head=[cchByLabel(c.by),sa].concat(r.prev?['Period before']:[]).concat(r.band?['Useful range']:[]);
    const f=v=>cchFmt(c.a,v);
    return{head,rows:(r.axes||[]).map((x,i)=>[x.label,x.v].concat(r.prev?[r.prev[i]]:[]).concat(r.band?[`${r.band[i].lo}–${r.band[i].hi}`]:[])),
      fmt:[null,f].concat(r.prev?[f]:[]).concat(r.band?[null]:[])};
  }
  if(k==='heat'){
    return{head:['Day',sa],rows:r.a.filter(x=>x.v!=null).reverse().map(x=>[x.k,x.v]),fmt:[v=>fmtDay(v),v=>cchFmt(c.a,v)]};
  }
  if(k==='split'){
    const head=[cchByLabel(c.by)].concat(r.groups.map(g=>g.other?`Other (${g.other})`:g.name));
    const order=cchIsTime(c.by)?r.keys.map((x,i)=>i).reverse():r.keys.map((x,i)=>i);
    const rows=order.map(i=>{const open=r.groups.some(g=>g.list[i].open);
      return[r.keys[i].label.replace(/^Week of /,'')+(open?' · so far':'')].concat(r.groups.map(g=>{const p=g.list[i];return p.open?p.sofar:p.v;}));})
      .filter(row=>row.slice(1).some(v=>v!=null&&v!==0));
    return{head,rows,fmt:[null].concat(r.groups.map(()=>v=>cchFmt(c.a,v)))};
  }
  // lines, bars, scatter
  const head=[cchByLabel(c.by),sa+(c.roll?' (7-day average)':'')].concat(c.b?[cchShort(c.b)+(r.lag?` (${r.lag} ${cchUnitWord(c.by,r.lag)} earlier)`:'')]:[]).concat(r.tgt?[r.tgtLabel]:[]);
  const order=cchIsTime(c.by)?r.a.map((x,i)=>i).reverse():r.a.map((x,i)=>i);
  const val=p=>p==null?null:p.open&&p.sofar!=null?{so:p.sofar}:(r.idx?p.raw:p.v);
  const rows=order.map(i=>{const x=r.a[i],y=r.b&&r.b[i];return[x.label.replace(/^Week of /,''),val(x)].concat(c.b?[val(y)]:[]).concat(r.tgt?[r.tgt[i]&&r.tgt[i].v]:[]);})
    .filter(row=>row.slice(1).some(v=>v!=null));
  const f=s=>v=>v&&v.so!=null?cchFmt(s,v.so)+' so far':cchFmt(s,v);
  return{head,rows,fmt:[null,f(c.a)].concat(c.b?[f(c.b)]:[]).concat(r.tgt?[v=>cchFmt(Object.assign({},c.a,{tr:null}),v)]:[])};
}
function cchTableHTML(t){
  if(!t.rows.length)return'';
  const cell=(v,j)=>esc(t.fmt&&t.fmt[j]?t.fmt[j](v):v==null?'–':String(v));
  return`<div class="sec-h">The numbers</div><div class="xc-tbl-wrap"><table class="xc-tbl${t.head.length>4?' xc-wide':''}"><thead><tr>${t.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    t.rows.slice(0,60).map(row=>`<tr>${row.map((v,j)=>`<td>${cell(v,j)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function cchDetail(id,range){
  const c=cchById(id);if(!c)return null;
  const r=cchCompute(c,range);const k=r.kind;
  const stats=[];const how=[];
  if(k==='hist'&&r.bins.length){
    stats.push({v:cchFmt(c.a,r.med),l:'Median'},{v:`${cchFmt(c.a,r.q1)}–${cchFmt(c.a,r.q3)}`,l:'Middle half'},{v:cchFmt(c.a,r.mean),l:'Average'},{v:r.n,l:CCH_SRC[c.a.t].many.replace(/^./,x=>x.toUpperCase())});
    how.push(`Each bar counts the ${CCH_SRC[c.a.t].many} whose ${cchColLabel(c.a.m).toLowerCase()} falls in that band. The middle half is where the central 50% sit; the median splits them in two.`);
  }else if(k==='box'&&r.boxes.length){
    how.push('Each box is the middle half of the values, the line in it the median. The whiskers reach the furthest values within one and a half box-lengths; anything beyond is a dot.');
    if(r.boxes.some(b=>b.n<CCH_BOX_MIN))how.push(`A row with fewer than ${CCH_BOX_MIN} values shows the values themselves: a box drawn from so few would look like a spread that is not there. The small number under each median is how many there are.`);
    if(r.left)how.push(`The ${r.left} smallest ${cchUnitWord(c.by,r.left)} are left out.`);
  }else if(k==='radar'&&!r.bad){
    how.push('Each spoke starts at zero. The area of a shape grows faster than its values, so read the numbers, not the size.');
    if(c.a.m==='hardsets')how.push('Hard sets a week count every working set, with the helper muscles counting half, as on the Muscles tile, averaged over the weeks since your first workout in the range.');
    if(r.band)how.push('The shaded ring is the useful range: enough sets to grow (the low edge) without more than you can recover from (the high edge).');
    if(r.prev)how.push('The outline is the same measure over the period before.');
  }else if(k==='radar'&&r.bad){
    how.push(`This needs ${CCH_RADAR_MIN} to ${CCH_RADAR_MAX} ${cchUnitWord(c.by)}. Change the range or the grouping.`);
  }else if(k==='heat'){
    how.push('Darker is more. With only a few different values (trained or not, a 1–5 rating) each gets its own shade; with many, the shades split the days into five even groups, so one huge day does not wash out the rest. Grey is zero; an outline is a day with nothing logged.');
  }else if(k==='split'){
    if(r.total&&r.groups.some(g=>g.other))how.push(`Other is everything outside the biggest ${CCH_SPLIT_MAX}, so the stack adds up to the whole.`);
    if(r.left)how.push(`Only the ${CCH_SPLIT_MAX} with the most logged are shown; ${r.left} more are left out.`);
    if(r.asked==='bars'&&r.view!=='bars')how.push(`Side by side only reads with up to ${CCH_CLUSTER_MAX} ${cchUnitWord(c.by)}: over this range it is drawn ${r.view==='stack'?'stacked':'as lines'}.`);
  }else{
    const ca=cchIsTime(c.by)?cchChange(r.a,c.a,r.idx):null,cb=r.b&&cchIsTime(c.by)?cchChange(r.b,c.b,r.idx):null;
    if(r.view==='scatter')stats.push({v:r.r==null?'–':r.r.toFixed(2),l:r.r==null?'r, how they move together':cchStrengthWord(r.r,r.n)},{v:r.n,l:`${cchByLabel(c.by)}s with both`});
    else if(cchIsTime(c.by)){
      const lab=x=>`${cchShort(x)}, over ${range.short}`;
      if(!c.a.tr)stats.push({v:ca?ca.text:'–',l:lab(c.a)});
      if(r.b&&!c.b.tr)stats.push({v:cb?cb.text:'–',l:lab(c.b)});
      if(r.b&&r.r!=null)stats.push({v:r.r.toFixed(2),l:r.n<CCH_MIN_PAIRS?'r · too few to judge':'r, how they move together'});
      else stats.push({v:r.a.filter(x=>x.v!=null).length,l:`${cchByLabel(c.by)}s with data`});
    }
    if(c.a.m==='hardsets')how.push('Hard sets a week count every working set, with the helper muscles counting half, as on the Muscles tile.');
    if(cchIsTime(c.by)&&c.by!=='day'&&[c.a,c.b].some(s=>s&&cchIsTotal(s)&&!s.tr))how.push(`The ${c.by} under way shows as "so far" and is not drawn until it ends.`);
    if(r.idx)how.push(`Both lines start at 100 (110 = 10% above the start). The start is the average of the first three ${c.by}s with data. The table has the real numbers.`+(c.b&&!cchSameUnit(c.a,c.b)?' Their units differ, so they always start at 100.':''));
    if(!r.idx&&cchIsTime(c.by)&&!c.a.tr)how.push(`Change is the last ${c.by} against the average of the first three with data.`);
    if([c.a,c.b].some(s=>s&&s.tr==='chg'))how.push(`A change is each ${c.by} minus the one before, in the measure's own units.`);
    if(c.roll)how.push('Each day is the average of it and the six days before (at least three with a value).');
    if(r.lag)how.push(`The second line is taken ${r.lag} ${cchUnitWord(c.by,r.lag)} earlier, so each ${c.by} is set against what came before it.`);
    if(r.tgt)how.push(r.tgtLabel==='Goal'?'The dashed line is your goal weight.':'The dashed line is the same sum-up of each day\'s own target, over the days you logged.');
    if(r.b&&r.r!=null)how.push(`r runs from −1 (opposite) to 1 (in step). It shows they move together, not that one causes the other, and needs ${CCH_MIN_PAIRS}+ ${c.by==='weekday'?'points':c.by+'s'} to mean much. Patterns tests that properly.`);
    if(r.trending)how.push('Both lines drift over the range, and two drifting lines show a high r whatever they are. To test whether they really move together, show each as a change from the week before.');
  }
  if(c.a.m==='strength'||(c.b&&c.b.m==='strength'))how.push('Strength change compares each lift only with itself: over time each step is the average change of the lifts you did since you last did them, so skipping or adding a lift does not move it. Lifts without a weight are left out.');
  if(c.by==='weekday'&&[c.a,c.b].some(s=>s&&s.m==='strength'))how.push('By weekday, each session is compared with that lift\'s average session, so it only says something when a lift is done on more than one weekday.');
  if([c.a,c.b].some(s=>s&&(s.w||[]).some(f=>f.c==='muscle'))||c.split==='muscle'||c.split==='muscle_group'||(c.a.m!=='hardsets'&&['muscle','muscle_group'].includes(c.by)))how.push('A set counts toward its exercise\'s main muscle only.');
  ['a','b'].forEach(key=>{const s=c[key];if(s&&!cchOneOk(c,key))how.push(`${cchColLabel(s.m)} means one ${cchColLabel(cchOneCol(s)).toLowerCase()} at a time: filter to one, or group by it.`);});
  if(cchEmptyWhy(c,r))stats.length=0; // the empty state already says what there is
  const t=cchTable(c,r);
  const sub=c.split?`${cchSeriesLabel(c.a)} · by ${cchColLabel(c.split).toLowerCase()}, per ${cchByLabel(c.by).toLowerCase()}`
    :c.view==='hist'?cchSeriesLabel(c.a):cchSeriesLabel(c.a)+(c.b?'  vs  '+cchSeriesLabel(c.b):'')+` · by ${cchByLabel(c.by).toLowerCase()}`;
  const kinds=`<div class="xc-vals xc-views xc-sv">${CCH_VIEWS.map(v=>`<button class="chip${c.view===v?' on':''}" onclick="cchSheetView(${jsq(c.id)},'${v}')">${CCH_VIEW_LABEL[v]}</button>`).join('')}</div>`;
  return{title:cchName(c),sub,plain:true,chart:kinds+cchChart(c,r,range),stats,body:cchTableHTML(t),how:how.join(' '),
    acts:`<button class="btn bts" onclick="closeOv('metric-ov');setTimeout(()=>showChartBuilder(${jsq(c.id)}),220)">Edit</button><button class="btn bts" onclick="cchExport(${jsq(c.id)})">Export CSV</button>`};
}
function cchExport(id){
  const c=cchById(id);if(!c)return;
  const range=boardRange();const r=cchCompute(c,range);const t=cchTable(c,r);
  const cell=v=>v&&v.so!=null?v.so:v==null?'':v;
  const rows=[t.head].concat(t.rows.map(row=>row.map(cell)));
  const name=`Lah We ${cchName(c).replace(/[\\/:*?"<>|]/g,'').slice(0,40)} ${today()}.csv`;
  shareFile(new Blob(['﻿'+csvText(rows)],{type:'text/csv'}),name,cchName(c)).then(x=>{if(x==='saved')toast('Export saved','green');});
}

// ─── Building one ───
// A few starting points, so the first chart is one tap.
const CCH_IDEAS=[
  {l:'Muscle balance',c:{a:{t:'sets',m:'hardsets',fn:'sum',w:[]},b:null,by:'muscle_group',view:'radar',cmp:'target',idx:true}},
  {l:'Arm strength vs arm sets',c:{a:{t:'sets',m:'strength',fn:'sum',w:[{c:'muscle',in:['Biceps','Triceps','Forearms']}]},b:{t:'sets',m:'count',fn:'sum',w:[{c:'muscle',in:['Biceps','Triceps','Forearms']}]},by:'week',view:'line',idx:true}},
  {l:'Calories vs weight change',c:{a:{t:'daily',m:'weight',fn:'avg',w:[],tr:'chg'},b:{t:'daily',m:'kcal',fn:'avg',w:[]},by:'week',view:'scatter',idx:true}},
  {l:'Calories vs body weight',c:{a:{t:'daily',m:'weight',fn:'avg',w:[]},b:{t:'daily',m:'kcal',fn:'avg',w:[]},by:'week',view:'line',idx:true}},
  {l:'Training days',c:{a:{t:'daily',m:'sessions',fn:'sum',w:[]},b:null,by:'day',view:'heat',idx:true}},
  {l:'Sets by muscle group',c:{a:{t:'sets',m:'count',fn:'sum',w:[]},b:null,by:'week',view:'stack',split:'muscle_group',idx:true}},
  {l:'Reps per set',c:{a:{t:'sets',m:'reps',fn:'avg',w:[]},b:null,by:'week',view:'hist',idx:true}},
  {l:'Calories by weekday',c:{a:{t:'daily',m:'kcal',fn:'avg',w:[]},b:null,by:'weekday',view:'box',idx:true}},
  {l:'Sleep vs workout rating',c:{a:{t:'daily',m:'feel',fn:'avg',w:[]},b:{t:'daily',m:'sleep_h',fn:'avg',w:[]},by:'week',view:'scatter',idx:true}},
  {l:'Weight, 7-day average',c:{a:{t:'daily',m:'weight',fn:'avg',w:[]},b:null,by:'day',view:'line',roll:true,tgt:true,idx:true}},
  {l:'Protein vs target',c:{a:{t:'daily',m:'protein_g',fn:'avg',w:[]},b:null,by:'week',view:'bars',tgt:true,idx:true}},
  {l:'Workout rating by weekday',c:{a:{t:'workouts',m:'feel',fn:'avg',w:[]},b:null,by:'weekday',view:'bars',idx:true}},
];
let _cch=null;
function cchBlank(){return{id:null,name:'',a:{t:'sets',m:'strength',fn:'sum',w:[]},b:null,by:'week',view:'line',idx:true,split:null,cmp:null,lag:0,roll:false,tgt:false,wide:false};}
function showChartBuilder(id){
  const c=id?cchById(id):null;
  if(!c&&(S.customCharts||[]).length>=CCH_MAX){toast(`You have ${CCH_MAX} custom charts. Delete one to make another.`,'red');return;}
  _cch={id:c?c.id:null,c:Object.assign(cchBlank(),JSON.parse(JSON.stringify(c||{}))),fresh:!c};
  cchFix();
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
function cchSeg(opts,cur,on){
  return`<div class="seg seg-in xc-seg">${opts.map(o=>`<button class="seg-b${String(cur)===String(o.v)?' on':''}" onclick="${on(o.v)}">${esc(o.l)}</button>`).join('')}</div>`;
}
// Views that work for the chart as it stands and for the data in the board's range.
function cchViewsNow(c,range){
  return cchViewList(c).filter(v=>{
    if(v==='radar'&&c.a.m!=='hardsets'&&c.by!=='weekday'&&c.by!=='muscle_group'){
      const n=cchSeries(c.a,c.by,range).filter(x=>x.v!=null).length;return n>=CCH_RADAR_MIN&&n<=CCH_RADAR_MAX;}
    if(v==='radar'&&c.by==='muscle')return false;
    if(v==='bars'&&c.split)return cchBucketCount(c.by,range)<=CCH_CLUSTER_MAX;
    return true;
  });
}
function cchSeriesHTML(key){
  const c=_cch.c;const s=c[key];const isB=key==='b';
  const meas=cchMeasures(s.t).filter(x=>x.m!=='hardsets'||(!isB&&!c.b&&!c.split)||s.m==='hardsets');
  const colM=!cchSpecial(s.m,s.t);
  const filters=(s.w||[]).map((f,i)=>`<span class="xc-chip">${esc(cchColLabel(f.c))}: <b>${esc(cchFilterText(f))}</b><button aria-label="Remove filter" onclick="cchDropFilter('${key}',${i})">${ICON('x',13)}</button></span>`).join('');
  const canChg=cchIsTime(c.by)&&!c.split&&!['heat','hist','box','radar'].includes(c.view)&&s.m!=='hardsets';
  const one=!cchOneOk(c,key)?`<div class="xc-note">${esc(cchColLabel(s.m))} means one ${esc(cchColLabel(cchOneCol(s)).toLowerCase())} at a time.</div>`:'';
  return`<div class="xc-ser${isB?' xc-ser-b':''}">
    <div class="xc-sh"><b class="${isB?'xc-k2':'xc-k1'}"></b><span>${isB?'Compared with':'Measure'}</span>${isB?`<button class="btn btg bsm" onclick="cchSetB(false)">Remove</button>`:''}</div>
    <div class="xc-row">${cchSelect('cchb-t-'+key,s.t,CCH_SOURCES.map(t=>({v:t,l:CCH_SRC[t].l})),`cchSet('${key}','t',this.value)`)}
      ${cchSelect('cchb-m-'+key,s.m,meas.map(x=>({v:x.m,l:x.l})),`cchSet('${key}','m',this.value)`)}</div>
    ${colM&&c.view!=='hist'&&c.view!=='box'?cchSeg(CCH_FNS.map(f=>({v:f.id,l:f.l})),s.fn,v=>`cchSet('${key}','fn','${v}')`):''}
    ${canChg?cchSeg([{v:'',l:'Level'},{v:'chg',l:`Change from last ${c.by}`}],s.tr||'',v=>`cchSet('${key}','tr','${v}')`):''}
    ${s.m==='hardsets'?'':`<div class="xc-filters">${filters}${(s.w||[]).length<CCH_MAX_FILTERS?`<button class="xc-add" onclick="showCchFilter('${key}')">${ICON('plus',13)} Filter</button>`:''}</div>`}
    ${one}
  </div>`;
}
function renderChartBuilder(){
  const el=document.getElementById('cchb-body');if(!el||!_cch)return;
  const c=_cch.c;const range=boardRange();
  const time=cchIsTime(c.by);
  let preview;try{preview=cchChart(c,cchCompute(c,range),range);}catch(e){logError(e,'custom chart preview');preview=`<div class="ch-empty">This chart could not be worked out.</div>`;}
  // a column to group by has to be in both tables
  const cats=cchCatCols(c.a.t).filter(x=>!c.b||cchCatCols(c.b.t).includes(x));
  const hard=c.a.m==='hardsets';
  const solo=['heat','hist','box','radar'].includes(c.view)||hard;
  const canB=!c.split&&!solo;
  const splitCols=cchCatCols(c.a.t).filter(x=>x!==c.by);
  const canSplit=!c.b&&!solo&&(time||c.by==='weekday')&&splitCols.length>0&&c.a.m!=='strength';
  const opts=[];
  if(c.b&&time&&c.view!=='scatter'&&!c.a.tr&&!c.b.tr){
    if(cchSameUnit(c.a,c.b))opts.push(`<button class="row row-tap xc-tog" onclick="cchSetTop('idx',${!c.idx})"><span class="row-main"><span class="row-t">Start both at 100</span><span class="row-s">Read a % change in one against the other</span></span><span class="tog${c.idx?' on':''}" role="switch" aria-checked="${c.idx}"></span></button>`);
    else opts.push(`<div class="xc-note">Different units, so both lines start at 100: 110 is 10% above where each began.</div>`);
  }
  if(c.b&&time)opts.push(`<div class="xc-lbl">Second line taken from how many ${cchUnitWord(c.by,2)} earlier</div>${cchSeg([0,1,2,3].map(n=>({v:n,l:n?String(n):`Same ${c.by}`})),c.lag||0,v=>`cchSetTop('lag',${v})`)}`);
  if(c.by==='day'&&!c.split&&['line','bars','scatter'].includes(c.view)&&c.a.m!=='strength')opts.push(cchTog('7-day average','Smooth out day-to-day noise',c.roll,'roll'));
  if(cchTargetOf(c))opts.push(cchTog(cchTargetOf(c).l==='Goal'?'Goal line':'Target line',cchTargetOf(c).l==='Goal'?'Your goal weight':'Each day\'s own target, summed up the same way',c.tgt,'tgt'));
  opts.push(cchTog('Wide tile','Draw the whole chart on the board, across both columns',c.wide,'wide'));
  if(c.view==='radar')opts.push(`<div class="xc-lbl">Lay over it</div>${cchSeg([{v:'',l:'Nothing'},{v:'prev',l:'Period before'}].concat(hard?[{v:'target',l:'Useful range'}]:[]),c.cmp||'',v=>`cchSetTop('cmp',${v?`'${v}'`:'null'})`)}`);
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">${_cch.fresh?'New chart':'Edit chart'}</div>
    <div class="sheet-sub" style="margin-bottom:6px">Any number you log, by time or by category. Uses the board's range: ${esc(range.label)}.</div>
    ${_cch.fresh?`<div class="xc-ideas">${CCH_IDEAS.map((x,i)=>`<button class="chip" onclick="cchIdea(${i})">${esc(x.l)}</button>`).join('')}</div>`:''}
    ${preview}
    <div class="sec-h">Show as</div>
    <div class="xc-vals xc-views">${CCH_VIEWS.map(v=>`<button class="chip${c.view===v?' on':''}" onclick="cchPickView('${v}')">${CCH_VIEW_LABEL[v]}</button>`).join('')}</div>
    ${_cch.undo?`<div class="xc-adapt"><span>${esc(_cch.undo.text)}</span><button class="btn btg bsm" onclick="cchUndoView()">Undo</button></div>`:''}
    ${cchSeriesHTML('a')}
    ${c.b?cchSeriesHTML('b'):''}
    ${c.split?`<div class="xc-ser"><div class="xc-sh"><b class="xc-k1"></b><span>Split by</span><button class="btn btg bsm" onclick="cchSetTop('split',null)">Remove</button></div>
      <div class="xc-row">${cchSelect('cchb-split',c.split,splitCols.map(x=>({v:x,l:cchColLabel(x)})),`cchSetTop('split',this.value)`)}</div></div>`:''}
    ${canB&&!c.b||canSplit&&!c.split?`<div class="xc-adds">${canB&&!c.b?`<button class="xc-add xc-add-b" onclick="cchSetB(true)">${ICON('plus',14)} Second line</button>`:''}${canSplit&&!c.split?`<button class="xc-add xc-add-b" onclick="cchSetTop('split',${jsq(c.a.t==='sets'?'muscle_group':splitCols[0])})">${ICON('plus',14)} Split by</button>`:''}</div>`:''}
    ${c.view==='hist'?'':`<div class="sec-h">Group by</div>
    ${hard?cchSeg([{v:'muscle_group',l:'Muscle group'},{v:'muscle',l:'Muscle'}],c.by,v=>`cchSetTop('by','${v}')`)
      :`<div class="xc-row"><div class="seg seg-in xc-seg" style="flex:1;margin:0">${CCH_TIME.map(t=>`<button class="seg-b${c.by===t.id?' on':''}" onclick="cchSetTop('by','${t.id}')">${t.l}</button>`).join('')}</div></div>
      ${cats.length&&!c.split?`<div class="xc-row" style="margin-top:8px">${cchSelect('cchb-by',time||c.by==='weekday'?'':c.by,[{v:'',l:'Or by a category…'}].concat(cats.map(x=>({v:x,l:cchColLabel(x)}))),`if(this.value)cchSetTop('by',this.value)`)}</div>`:''}`}`}
    ${opts.length?`<div class="sec-h">Options</div>${opts.join('')}`:''}
    <div class="sec-h">Name</div>
    <input id="cchb-name" maxlength="60" value="${esc(c.name)}" placeholder="${esc(cchAutoName(c))}" oninput="_cch.c.name=this.value">
    <div class="sheet-acts">
      <button class="btn btp" onclick="cchSave()">${_cch.fresh?'Add to board':'Save'}</button>
      ${_cch.fresh?'':`<button class="btn btg" onclick="cchDelete()">Delete</button>`}
    </div>`;
}
function cchTog(t,s,on,key){
  return`<button class="row row-tap xc-tog" onclick="cchSetTop('${key}',${!on})"><span class="row-main"><span class="row-t">${esc(t)}</span><span class="row-s">${esc(s)}</span></span><span class="tog${on?' on':''}" role="switch" aria-checked="${!!on}"></span></button>`;
}
function cchIdea(i){
  const x=CCH_IDEAS[i];if(!x||!_cch)return;
  _cch.c=Object.assign(cchBlank(),JSON.parse(JSON.stringify(x.c)),{id:null,name:x.l});cchChanged();
}
function cchChanged(){if(!_cch)return;_cch.undo=null;cchFix();renderChartBuilder();}
// Keep the chart sensible after a change: the rules (cchValidate), then what depends on the data: a
// number that means one thing at a time is filtered to the one logged most, and a view the data in the
// range cannot fill gives way to the first one that can.
function cchFix(){if(_cch)cchFixC(_cch.c,boardRange());}
function cchFixC(c,range){
  ['a','b'].forEach(k=>{const s=c[k];if(!s)return;
    if(!cchMeasures(s.t).some(x=>x.m===s.m))s.m='count';
    s.w=(s.w||[]).filter(f=>cchFilterCols(s.t).includes(f.c));});
  cchValidate(c);
  ['a','b'].forEach(k=>{const s=c[k];if(!s||cchOneOk(c,k))return;
    const col=cchOneCol(s);const top=cchValues(s.t,col)[0];
    if(top){s.w=s.w.filter(f=>f.c!==col).slice(0,CCH_MAX_FILTERS-1);s.w.push({c:col,in:[top.v]});}});
  const views=cchViewsNow(c,range);
  if(views.length&&!views.includes(c.view)){c.view=views[0];cchValidate(c);}
}

// ─── Picking a chart type ───
// Every type is always offered. Picking one keeps everything that still fits and changes only what it
// must, in a fixed order of small steps; each step is kept only once the type can be drawn. What
// changed is said in one line, with Undo.
const CCH_NUM_DEFAULT={sets:'reps',workouts:'minutes',daily:'kcal',meals:'kcal',meal_items:'kcal',activities:'miles',measurements:'value',habit_days:'amount'};
const CCH_SPLIT_DEFAULT={sets:'muscle_group',workouts:'routine',daily:'day_kind',meals:'meal',meal_items:'meal',activities:'type',measurements:'part',habit_days:'habit',supplements:'supplement'};
const CCH_STEPS={
  noB:c=>{c.b=null;c.lag=0;},
  noSplit:c=>{c.split=null;},
  level:c=>{c.a.tr=null;if(c.b)c.b.tr=null;},
  notHard:c=>{if(c.a.m==='hardsets'){c.a.m='count';c.by='week';}},
  time:c=>{if(!cchIsTime(c.by))c.by='week';},
  month:c=>{if(cchIsTime(c.by))c.by='month';},
  cat:c=>{if(cchIsTime(c.by)||(c.by==='muscle_group'&&c.a.t!=='sets'))c.by=c.a.t==='sets'?'muscle_group':'weekday';},
  weekday:c=>{c.by='weekday';},
  day:c=>{c.by='day';},
  num:c=>{const a=c.a;if(cchIsNumCol(a))return;
    if(!CCH_NUM_DEFAULT[a.t]){a.t='daily';a.w=[];a.m='supplements_taken';}else a.m=CCH_NUM_DEFAULT[a.t];
    a.fn=cchDefaultFn(a.m,a.t);a.tr=null;},
  total:c=>{if(!cchIsTotal(c.a)||c.a.m==='strength'){c.a.m='count';c.a.fn='sum';c.a.tr=null;}},
  split:c=>{if(!c.split)c.split=CCH_SPLIT_DEFAULT[c.a.t]||null;},
  addB:c=>{if(c.b)return;const a=c.a;c.b={t:a.t,m:a.m==='count'?(cchNumCols(a.t).find(x=>CCH_NUM.has(x))||'count'):'count',fn:'sum',w:JSON.parse(JSON.stringify(a.w||[]))};
    if(c.b.m!=='count')c.b.fn=cchDefaultFn(c.b.m,c.b.t);},
  radarMeasure:c=>{if(c.a.m==='strength'||c.a.tr){if(c.a.t==='sets'){c.a.m='hardsets';c.a.w=[];c.by='muscle_group';}else{c.a.m='count';c.a.fn='sum';}c.a.tr=null;}},
};
const CCH_ADAPT={
  line:['notHard','time','level','noSplit','noB'],
  bars:['month','noSplit','level'],
  scatter:['notHard','noSplit','addB','time'],
  radar:['noB','noSplit','level','cat','radarMeasure','weekday'],
  heat:['noB','noSplit','level','notHard','day'],
  hist:['noB','noSplit','num','level'],
  box:['noB','noSplit','num','cat','weekday'],
  stack:['noB','notHard','total','split','time'],
  area:['noB','notHard','total','split','time'],
  share:['noB','notHard','total','split','time'],
};
// → {c, text} with c ready to use, or null when the type cannot be drawn from this range at all.
function cchAdapt(c0,view,range){
  const work=JSON.parse(JSON.stringify(c0));work.view=view;
  const steps=[null].concat(CCH_ADAPT[view]||[]);
  for(const st of steps){
    if(st)CCH_STEPS[st](work);
    const t=JSON.parse(JSON.stringify(work));t.view=view;
    cchFixC(t,range);
    if(t.view===view){
      // A name picked for one measure would now describe another.
      if(t.name&&(t.a.t!==c0.a.t||t.a.m!==c0.a.m))t.name='';
      return{c:t,text:cchAdaptText(c0,t,view)};
    }
  }
  return null;
}
function cchLow(x){return/^[A-Z0-9]{2}/.test(x)?x:x.charAt(0).toLowerCase()+x.slice(1);}
function cchAdaptText(o,n,view){
  const out=[];
  if(o.a.t!==n.a.t||o.a.m!==n.a.m||(o.a.fn!==n.a.fn&&!cchSpecial(n.a.m,n.a.t)))out.push('measuring '+cchLow(cchShort(n.a)));
  if(o.by!==n.by)out.push('by '+cchLow(cchByLabel(n.by)));
  if(o.b&&!n.b)out.push('second line removed');
  if(!o.b&&n.b)out.push('against '+cchLow(cchShort(n.b)));
  if((o.split||null)!==(n.split||null))out.push(n.split?'split by '+cchLow(cchColLabel(n.split)):'split removed');
  if((o.a.tr||'')!==(n.a.tr||'')&&o.a.tr)out.push('levels, not changes');
  if(JSON.stringify(o.a.w||[])!==JSON.stringify(n.a.w||[])&&o.a.t===n.a.t)out.push('filters changed');
  if(o.roll&&!n.roll)out.push('7-day average off');
  if(o.tgt&&!n.tgt)out.push('target line off');
  return out.length?`${CCH_VIEW_LABEL[view]}: ${out.join(', ')}.`:'';
}
function cchPickView(v){
  if(!_cch||_cch.c.view===v)return;
  const before=JSON.parse(JSON.stringify(_cch.c));
  const res=cchAdapt(_cch.c,v,boardRange());
  if(!res){toast(`Nothing logged in this range can be drawn as a ${CCH_VIEW_LABEL[v].toLowerCase()}`);return;}
  _cch.c=res.c;_cch.undo=res.text?{c:before,text:res.text}:null;
  renderChartBuilder();
}
function cchUndoView(){if(!_cch||!_cch.undo)return;_cch.c=_cch.undo.c;_cch.undo=null;renderChartBuilder();}
// The same from a chart's own sheet: saved at once, with Undo on the toast.
function cchSheetView(id,v){
  const c=cchById(id);if(!c||c.view===v)return;
  const before=JSON.parse(JSON.stringify(c));
  const res=cchAdapt(Object.assign(cchBlank(),JSON.parse(JSON.stringify(c))),v,boardRange());
  if(!res){toast(`Nothing logged in this range can be drawn as a ${CCH_VIEW_LABEL[v].toLowerCase()}`);return;}
  const clean=normalizeCustomCharts([Object.assign({},res.c,{id})])[0];if(!clean)return;
  S.customCharts=S.customCharts.map(x=>x.id===id?clean:x);ccSync();save();progRefresh();
  toast(res.text||CCH_VIEW_LABEL[v],'',{action:'Undo',onAction:()=>{S.customCharts=S.customCharts.map(x=>x.id===id?before:x);ccSync();save();progRefresh();}});
}
function cchSet(key,f,v){
  const s=_cch&&_cch.c[key];if(!s)return;
  if(f==='t'){if(s.t===v)return;s.t=v;s.m=v==='sets'?'strength':'count';s.tr=null;}
  else if(f==='m'){s.m=v;if(!cchSpecial(v,s.t))s.fn=cchDefaultFn(v,s.t);if(v==='hardsets')_cch.c.view='radar';}
  else if(f==='tr')s.tr=v||null;
  else s[f]=v;
  cchChanged();
}
function cchSetTop(f,v){
  if(!_cch)return;const c=_cch.c;c[f]=v;
  if(f==='by'&&!cchIsTime(v)&&v!=='weekday'&&c.view==='line')c.view='bars';
  if(f==='split'&&v){const tot=cchIsTotal(c.a);c.view=cchIsTime(c.by)?(tot?'stack':'line'):'bars';}
  cchChanged();
}
// The second line starts as a count of the same rows, filtered the same way: "how much of it"
// against "how it went" is the comparison most people are after.
function cchSetB(on){
  if(!_cch)return;const c=_cch.c;
  c.b=on?{t:c.a.t,m:c.a.m==='count'?(cchNumCols(c.a.t)[0]||'count'):'count',fn:'sum',w:JSON.parse(JSON.stringify(c.a.w||[]))}:null;
  if(on&&c.b.m!=='count')c.b.fn=cchDefaultFn(c.b.m,c.b.t);
  if(on){c.split=null;if(!['line','bars','scatter'].includes(c.view))c.view=cchIsTime(c.by)?'line':'bars';}
  cchChanged();
}
function cchDropFilter(key,i){const s=_cch&&_cch.c[key];if(!s)return;s.w.splice(i,1);cchChanged();}
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
  closeOv('cchf-ov');cchChanged();
}
