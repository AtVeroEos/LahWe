// ═══════════════════════════════════════════════════
// PATTERNS — relationships in your own log, found with formulas (no AI, no network)
// ═══════════════════════════════════════════════════
// The rules every pattern follows (the plan is in the project docs):
//  1. An outcome is never the raw number. It is the gap from where your own trend said you would
//     be that day (a lift's best set against the sessions around it, weight against the days
//     around it, pace against efforts at the same distance). Raw numbers all drift together over
//     months, which makes anything correlate with anything.
//  2. You are compared with yourself: sessions after a rest day against sessions not after one.
//  3. A pattern is shown only when it clears four bars: enough cases on each side, an effect big
//     enough to matter, the same direction in both halves of the history, and a p-value that
//     survives a correction for how many patterns were tested (Benjamini–Hochberg).
//  4. Placebo checks: a few tests should find nothing (running should not move your bench). If one
//     of them "finds" something, the bar is too low and it is raised for everything.
//  5. Wording says "tends to" and gives the count. It never says "causes".
const PAT={Q:0.10,Q_STRICT:0.05,PERMS:600,MIN:8,MIN_W:10,MIN_DOSE:16,
  FLOOR_LIFT:1.5,   // % of a lift's expected best set
  FLOOR_W:0.4,      // lb (0.2 kg) on the scale
  FLOOR_PACE:1.0};  // % of pace: about 5 s a mile at 8:30
const PAT_FAM={recovery:'Recovery',cardio:'Cardio and lifting',fuel:'Fuel',scale:'The scale',session:'How the session is built',timing:'Timing',sleep:'Sleep',records:'Records'};

// ─── Small statistics ───
function patMean(a){let t=0;for(let i=0;i<a.length;i++)t+=a[i];return a.length?t/a.length:0;}
function patHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
// A seeded generator, so the same log always gives the same answer.
function patRng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function patRanks(a){
  const idx=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]);const r=new Array(a.length);
  for(let i=0;i<idx.length;){let j=i;while(j+1<idx.length&&idx[j+1][0]===idx[i][0])j++;const rk=(i+j)/2+1;for(let k=i;k<=j;k++)r[idx[k][1]]=rk;i=j+1;}
  return r;
}
function patCorr(x,y){
  const n=x.length;if(n<3)return 0;const mx=patMean(x),my=patMean(y);let sxy=0,sxx=0,syy=0;
  for(let i=0;i<n;i++){const dx=x[i]-mx,dy=y[i]-my;sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy;}
  return sxx>0&&syy>0?sxy/Math.sqrt(sxx*syy):0;
}
// Two-sided permutation p-values. Both stop early once the answer is plainly "no": most tests
// are, and that is where the time would go.
// Groups: draw which cases count as "A" at random and compare the difference in means.
function patPermGroup(x,y,seed){
  const n=y.length;let na=0,total=0,sa=0;for(let i=0;i<n;i++){total+=y[i];if(x[i]){na++;sa+=y[i];}}
  const nb=n-na;if(!na||!nb)return 1;
  const obs=Math.abs(sa/na-(total-sa)/nb);if(!(obs>0))return 1;
  const k=Math.min(na,nb),small=na<=nb;const idx=new Int32Array(n);for(let i=0;i<n;i++)idx[i]=i;
  const rnd=patRng(seed);let hit=0,b=0;
  for(;b<PAT.PERMS;b++){
    let sum=0;
    for(let i=0;i<k;i++){const j=i+Math.floor(rnd()*(n-i));const t=idx[i];idx[i]=idx[j];idx[j]=t;sum+=y[idx[i]];}
    const A=small?sum:total-sum;
    if(Math.abs(A/na-(total-A)/nb)>=obs-1e-12)hit++;
    if(b===99&&hit>=20){b++;break;}
  }
  return(hit+1)/(b+1);
}
// Dose: shuffle one set of ranks against the other and compare the correlation.
function patPermCorr(xr,yr,seed){
  const n=xr.length;const mx=patMean(xr),my=patMean(yr);const xc=new Float64Array(n),yc=new Float64Array(n);let sxx=0,syy=0,sxy=0;
  for(let i=0;i<n;i++){xc[i]=xr[i]-mx;yc[i]=yr[i]-my;sxx+=xc[i]*xc[i];syy+=yc[i]*yc[i];sxy+=xc[i]*yc[i];}
  if(!(sxx>0&&syy>0))return 1;const obs=Math.abs(sxy);if(!(obs>0))return 1;
  const rnd=patRng(seed);let hit=0,b=0;
  for(;b<PAT.PERMS;b++){
    for(let i=n-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=yc[i];yc[i]=yc[j];yc[j]=t;}
    let c=0;for(let i=0;i<n;i++)c+=xc[i]*yc[i];
    if(Math.abs(c)>=obs-1e-9)hit++;
    if(b===99&&hit>=20){b++;break;}
  }
  return(hit+1)/(b+1);
}
const patDiff=(x,y)=>{let sa=0,na=0,sb=0,nb=0;for(let i=0;i<x.length;i++){if(x[i]){sa+=y[i];na++;}else{sb+=y[i];nb++;}}return na&&nb?sa/na-sb/nb:0;};

// ─── Outcomes against your own trend ───
// For each point: a straight line through its neighbours (it is left out itself), read off at its
// own date. pts sorted by t. o: {n: neighbours each side, span: max days away, need: fewest
// neighbours, pct: gap as % of the expectation, clamp: largest gap kept}.
function patResiduals(pts,o){
  const out=[];
  for(let i=0;i<pts.length;i++){
    const nb=[];
    for(let j=Math.max(0,i-o.n);j<=Math.min(pts.length-1,i+o.n);j++){if(j!==i&&Math.abs(pts[j].t-pts[i].t)<=o.span)nb.push(pts[j]);}
    if(nb.length<o.need){out.push(null);continue;}
    const mx=patMean(nb.map(p=>p.t)),my=patMean(nb.map(p=>p.v));let num=0,den=0;
    nb.forEach(p=>{num+=(p.t-mx)*(p.v-my);den+=(p.t-mx)*(p.t-mx);});
    let exp=den>0?my+(num/den)*(pts[i].t-mx):my;
    // At either end of a series the line is a guess: keep it near what the neighbours actually did.
    const lo=Math.min(...nb.map(p=>p.v)),hi=Math.max(...nb.map(p=>p.v));const pad=(hi-lo)*0.5+Math.abs(my)*0.02;
    exp=Math.max(lo-pad,Math.min(hi+pad,exp));
    let r=o.pct?(exp>0?(pts[i].v-exp)/exp*100:0):pts[i].v-exp;
    if(!isFinite(r)){out.push(null);continue;}
    out.push(Math.abs(r)>o.clamp?null:r); // a gap that large is a typo or an injury, not a pattern
  }
  return out;
}

// ─── The data, laid out once ───
// A cheap signature of everything patterns read, so the work is redone only when that changes
// (ticking a supplement does not recompute them).
function patSig(){
  const w=S.workouts||[],a=S.activities||[],b=S.bodyweightLog||[],m=S.meals||[];
  return[w.length,w[0]?w[0].started:0,w[0]?w[0].ended||0:0,a.length,a[0]?a[0].id:'',b.length,b[0]?b[0].date+b[0].weight:'',m.length,m.length?m[m.length-1].id:'',
    Object.keys(S.macroLogs||{}).length,Object.keys(S.sleepLog||{}).length,S.unit,(S.macroGoals||{}).cals||0,today()].join('|');
}
let _pat={sig:'',data:null,res:null};
function patRegion(exId){const ex=getEx(exId);const c=ex?ex.cat:'';return c==='Legs'?'lower':(!c||c==='Core'||c==='Full Body')?'':'upper';}
const PAT_CARDIO=new Set(['run','ruck','bike','hike','swim','sprint']);
function patData(){
  const sig=patSig();if(_pat.sig===sig&&_pat.data)return _pat.data;
  _pat={sig,data:null,res:null};
  const td=today();
  // food by day, and which days were really logged (a day with one snack on it is not a low-calorie day)
  const food={};
  (S.meals||[]).forEach(m=>{if(!m||!m.date)return;const f=food[m.date]||(food[m.date]={cals:0,carbs:0,protein:0});f.cals+=+m.cals||0;f.carbs+=+m.carbs||0;f.protein+=+m.protein||0;});
  Object.keys(S.macroLogs||{}).forEach(ds=>{const l=S.macroLogs[ds];if(!isObj(l))return;const f=food[ds]||(food[ds]={cals:0,carbs:0,protein:0});f.cals+=+l.cals||0;f.carbs+=+l.carbs||0;f.protein+=+l.protein||0;});
  const kc=Object.keys(food).filter(ds=>ds<td&&food[ds].cals>0).map(ds=>food[ds].cals).sort((a,b)=>a-b);
  const medK=kc.length?kc[Math.floor(kc.length/2)]:0;
  const fed=ds=>{const f=food[ds];return f&&ds<td&&f.cals>=medK*0.6&&f.cals>0?f:null;};
  let maint=0;try{maint=(maintenanceBest()||{}).kcal||0;}catch(e){maint=0;}
  // cardio by day
  const cardio={};
  (S.activities||[]).forEach(a=>{if(!a||!a.date||!PAT_CARDIO.has(a.type))return;const c=cardio[a.date]||(cardio[a.date]={n:0,mi:0,run:false});c.n++;c.mi+=parseFloat(a.dist)||0;if(a.type==='run'||a.type==='sprint')c.run=true;});
  // each lift's gap from its own trend, per session
  const wk=(S.workouts||[]).filter(w=>w&&w.started&&Array.isArray(w.exercises)).slice().sort((a,b)=>a.started-b.started);
  const liftRes={};const liftN={};
  getExsWithHist().forEach(id=>{
    const ser=getExStrData(id);if(ser.length<6)return;
    const pts=ser.map(d=>({t:dayNum(dayOf(d.date)),v:d.e1rm,k:d.date}));
    const r=patResiduals(pts,{n:4,span:60,need:3,pct:true,clamp:20});
    const map={};let n=0;pts.forEach((p,i)=>{if(r[i]!=null){map[p.k]=r[i];n++;}});
    liftRes[id]=map;liftN[id]=n;
  });
  const trainDays=new Set(wk.map(w=>dayOf(w.started)));
  const legDays=new Set();
  const lastDone={};const sessions=[];let prevDs=null;
  wk.forEach(w=>{
    const ds=dayOf(w.started);const lifts=[];let order=0,setsBefore=0;
    w.exercises.forEach(ex=>{
      if(!ex||!Array.isArray(ex.sets))return;
      const done=ex.sets.filter(s=>s&&s.done&&!s.warmup).length;if(!done)return;
      const region=patRegion(ex.exId);if(region==='lower')legDays.add(ds);
      const r=liftRes[ex.exId]?liftRes[ex.exId][w.started]:null;
      const gap=lastDone[ex.exId]?daysBetween(lastDone[ex.exId],ds):null;
      if(r!=null)lifts.push({id:ex.exId,r,order,setsBefore,gap,region});
      lastDone[ex.exId]=ds;order++;setsBefore+=done;
    });
    const mean=f=>{const a=lifts.filter(f).map(l=>l.r);return a.length?patMean(a):null;};
    const y=addDays(ds,-1);const fy=fed(y);const gy=fy?(goalsFor(y)||{}):{};
    let defRun=null;
    if(maint>0){defRun=0;for(let i=1;i<=10;i++){const f=fed(addDays(ds,-i));if(!f){if(i===1)defRun=null;break;}if(f.cals<maint-200)defRun++;else break;}}
    sessions.push({id:w.id,ts:w.started,ds,t:dayNum(ds),lifts,all:mean(()=>true),lower:mean(l=>l.region==='lower'),upper:mean(l=>l.region==='upper'),
      gapTrain:prevDs&&prevDs!==ds?daysBetween(prevDs,ds):null,hour:new Date(w.started).getHours(),dow:dayDate(ds).getDay(),
      cardioY:!!cardio[y],cardioSame:!!cardio[ds],miY:cardio[y]?cardio[y].mi:0,
      kcalY:fy&&gy.cals>0?fy.cals/gy.cals:null,carbsY:fy?fy.carbs:null,protY:fy&&gy.protein>0?fy.protein/gy.protein:null,defRun,
      sleep:isObj(S.sleepLog)&&S.sleepLog[ds]>0?+S.sleepLog[ds]:null,feel:w.feel>0?+w.feel:null,name:w.name});
    if(prevDs!==ds)prevDs=ds;
  });
  // the scale against the days around it
  const bw=(S.bodyweightLog||[]).filter(b=>b&&b.date&&b.weight>0).map(b=>({ds:b.date,t:dayNum(b.date),v:+b.weight})).sort((a,b)=>a.t-b.t).filter((p,i,a)=>!i||a[i-1].t!==p.t);
  const wr=patResiduals(bw,{n:7,span:7,need:4,pct:false,clamp:S.unit==='kg'?3:6});
  const weights=[];
  bw.forEach((p,i)=>{if(wr[i]==null)return;const y=addDays(p.ds,-1);const fy=fed(y);
    weights.push({ds:p.ds,t:p.t,r:wr[i],trainY:trainDays.has(y),legY:legDays.has(y),cardioY:!!cardio[y],carbsY:fy?fy.carbs:null,kcalY:fy?fy.cals:null,dow:dayDate(p.ds).getDay(),
      sleep:isObj(S.sleepLog)&&S.sleepLog[p.ds]>0?+S.sleepLog[p.ds]:null});});
  // pace against efforts at the same distance (positive = slower)
  const runs=[];
  try{
    paceOptions().filter(o=>o.type==='run'&&o.n>=6).forEach(o=>{
      const ser=paceSeries(o);const r=patResiduals(ser.map(x=>({t:x.t,v:x.v})),{n:4,span:90,need:3,pct:true,clamp:20});
      ser.forEach((x,i)=>{if(r[i]==null)return;const y=addDays(x.ds,-1);const fy=fed(y);const gy=fy?(goalsFor(y)||{}):{};
        runs.push({ds:x.ds,t:x.t,r:r[i],sec:x.v,legY:legDays.has(y),legSame:legDays.has(x.ds),kcalY:fy&&gy.cals>0?fy.cals/gy.cals:null});});
    });
  }catch(e){}
  runs.sort((a,b)=>a.t-b.t);
  _pat.data={sessions,weights,runs,liftN,trainDays,legDays,wk};
  return _pat.data;
}

// ─── The catalog ───
// Each entry turns the data into one or more tests. A test is a list of observations {x, y, t}
// (x true/false for a comparison, a number for a dose), with what it is measured on and how to say it.
function patCatalog(D){
  const T=[];const u=S.unit||'lbs';
  const pct=v=>`${Math.abs(v)<10?Math.abs(v).toFixed(1):Math.round(Math.abs(v))}%`;
  const add=o=>{o.obs=o.obs.filter(q=>q&&q.y!=null&&isFinite(q.y)&&q.x!=null);T.push(o);};
  const sess=(key,fx)=>D.sessions.filter(s=>s[key]!=null).map(s=>{const x=fx(s);return x==null?null:{x,y:s[key],t:s.t};});
  const liftSay=(who,cond,other)=>{const f=e=>({t:`${who} ${/^Your .*s$/.test(who)?'are':'is'} ${pct(e.eff)} ${e.eff>0?'better':'lower'} ${cond}`,
    s:`${e.a.k} of ${e.a.n} sessions ${cond} were ${e.eff>0?'above':'below'} your trend, against ${e.eff>0?e.b.k:e.b.n-e.b.k} of ${e.b.n} ${other}.`});f.who=who;return f;};
  // ── Recovery ──
  add({id:'rest',fam:'recovery',kind:'group',out:'lift',obs:sess('all',s=>s.gapTrain==null||s.gapTrain>6?null:s.gapTrain>=2),
    a:'after a day off',b:'the day after training',say:liftSay('Your lifts','after a day off','the day after training'),
    rival:'The workouts you do after a day off may be different ones from those you do on back-to-back days.',lore:'“Stimulate, don’t annihilate”: recovery is part of training.',today:'rest'});
  add({id:'break',fam:'recovery',kind:'group',out:'lift',obs:sess('all',s=>s.gapTrain==null?null:s.gapTrain>=7?true:s.gapTrain<=4?false:null),
    a:'after a week or more away',b:'in a normal week',say:liftSay('Your lifts','after a week or more away','in a normal week'),
    rival:'A week away is often travel or illness, which hurt a session on their own.'});
  // ── Cardio and lifting ──
  add({id:'cardio-legs',fam:'cardio',kind:'group',out:'lift',obs:sess('lower',s=>s.cardioY),
    a:'the day after cardio',b:'with no cardio the day before',say:liftSay('Your lower-body lifts','the day after cardio','with no cardio the day before'),
    rival:'Your cardio days may fall before a particular leg workout.',lore:'“Cardio kills gains.” Research finds interference mostly from long sessions and mostly on explosive strength.'});
  add({id:'cardio-upper',fam:'cardio',kind:'group',out:'lift',placebo:true,obs:sess('upper',s=>s.cardioY),
    a:'the day after cardio',b:'with no cardio the day before',say:liftSay('Your upper-body lifts','the day after cardio','with no cardio the day before'),
    rival:'This one is a placebo check: running should not change your bench.'});
  add({id:'cardio-same',fam:'cardio',kind:'group',out:'lift',obs:sess('lower',s=>s.cardioSame),
    a:'on a day with cardio as well',b:'on a lifting-only day',say:liftSay('Your lower-body lifts','on days you also do cardio','on lifting-only days'),
    rival:'The log does not say which came first that day.'});
  // ── Fuel ──
  add({id:'kcal',fam:'fuel',kind:'group',out:'lift',obs:sess('all',s=>s.kcalY==null?null:s.kcalY>=0.95),
    a:'after hitting your calories',b:'after a day under target',say:liftSay('Your lifts','the day after you hit your calories','after a day under target'),
    rival:'Days you eat to target are often days with less going on.',lore:'“You can’t out-train a bad diet.”'});
  add({id:'carbs',fam:'fuel',kind:'dose',out:'lift',obs:sess('all',s=>s.carbsY),
    xName:'carbs the day before',say:e=>({t:`Your lifts are ${pct(e.eff)} ${e.eff>0?'better':'lower'} after your higher-carb days`,
      s:`Top third of days by carbs against the bottom third (${e.hi.n} and ${e.lo.n} sessions). Rank correlation ${e.rho.toFixed(2)}.`}),
    rival:'High-carb days are usually high-calorie days too.'});
  add({id:'deficit',fam:'fuel',kind:'group',out:'lift',obs:sess('all',s=>s.defRun==null?null:s.defRun>=3?true:s.defRun===0?false:null),
    a:'three or more days into a deficit',b:'after a day at maintenance or above',say:liftSay('Your lifts','three or more days into a deficit','after a day at maintenance or above'),
    rival:'Long deficits are also when body weight is lowest.'});
  add({id:'protein',fam:'fuel',kind:'group',out:'lift',obs:sess('all',s=>s.protY==null?null:s.protY>=1),
    a:'after hitting protein',b:'after missing it',say:liftSay('Your lifts','the day after you hit protein','after a day you missed it'),
    rival:'One day of protein should not move a session; a long stretch might.'});
  // ── Timing ──
  add({id:'am',fam:'timing',kind:'group',out:'lift',obs:sess('all',s=>s.hour<12),
    a:'in the morning',b:'later in the day',say:liftSay('Your lifts','in the morning','later in the day'),rival:'Morning sessions may be the rushed ones, or the weekend ones.'});
  const DN=['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'];
  for(let d=0;d<7;d++)add({id:'dow-'+d,fam:'timing',kind:'group',out:'lift',obs:sess('all',s=>s.dow===d),
    a:'on '+DN[d],b:'on other days',say:liftSay('Your lifts','on '+DN[d],'on other days'),rival:'A weekday always carries the same workout, so this may be about the workout and not the day.'});
  // ── Sleep ──
  add({id:'sleep',fam:'sleep',kind:'group',out:'lift',obs:sess('all',s=>s.sleep==null?null:s.sleep>=7),
    a:'after seven hours or more',b:'after less than seven',say:liftSay('Your lifts','after seven hours of sleep or more','after less than seven'),
    rival:'Short nights often come with stress or travel.',lore:'Haney: seven to eight hours, and a nap if you can.'});
  // ── Per lift: order, spacing, rest, cardio ──
  Object.keys(D.liftN).filter(id=>D.liftN[id]>=PAT.MIN*2).forEach(id=>{
    const nm=exName(id);const mine=[];D.sessions.forEach(s=>s.lifts.forEach(l=>{if(l.id===id)mine.push({s,l});}));
    const lo=f=>mine.map(({s,l})=>{const x=f(s,l);return x==null?null:{x,y:l.r,t:s.t};});
    add({id:'first:'+id,lift:id,fam:'session',kind:'group',out:'lift',obs:lo((s,l)=>l.order===0),a:'done first',b:'done later in the session',
      say:liftSay(nm,'when it is the first lift of the session','when it comes later'),rival:'It may come first only in one workout and later in another.',lore:'Weider’s priority principle: train what matters most first.'});
    add({id:'gap:'+id,lift:id,fam:'recovery',kind:'group',out:'lift',obs:lo((s,l)=>l.gap==null||l.gap>14?null:l.gap>=5),a:'five or more days after the last time',b:'within four days',
      say:liftSay(nm,'five or more days after you last did it','within four days'),rival:'A longer gap may mean a missed session and a harder week.'});
    add({id:'rest:'+id,lift:id,fam:'recovery',kind:'group',out:'lift',obs:lo(s=>s.gapTrain==null||s.gapTrain>6?null:s.gapTrain>=2),a:'after a day off',b:'the day after training',
      say:liftSay(nm,'after a day off','the day after training'),rival:'It may sit in a workout that always follows a rest day.',today:'rest'});
    if(patRegion(id)==='lower')add({id:'cardio:'+id,lift:id,fam:'cardio',kind:'group',out:'lift',obs:lo(s=>s.cardioY),a:'the day after cardio',b:'with no cardio the day before',
      say:liftSay(nm,'the day after cardio','with no cardio the day before'),rival:'Your cardio days may fall before one particular leg workout.'});
  });
  // ── The scale ──
  const wsay=(cond,other)=>e=>({t:`You weigh ${Math.abs(e.eff).toFixed(1)} ${u} ${e.eff>0?'more':'less'} ${cond}`,
    s:`${e.a.k} of ${e.a.n} mornings ${cond} were ${e.eff>0?'above':'below'} your trend, against ${e.eff>0?e.b.k:e.b.n-e.b.k} of ${e.b.n} ${other}. This is water and food in transit, not fat.`});
  const wo=fx=>D.weights.map(w=>{const x=fx(w);return x==null?null:{x,y:w.r,t:w.t};});
  add({id:'w-rest',fam:'scale',kind:'group',out:'weight',obs:wo(w=>!w.trainY),a:'the morning after a rest day',b:'the morning after training',say:wsay('the morning after a rest day','after training days'),
    rival:'Rest days are often the days you eat differently.'});
  add({id:'w-leg',fam:'scale',kind:'group',out:'weight',obs:wo(w=>w.trainY?w.legY:null),a:'the morning after leg day',b:'after other training days',say:wsay('the morning after leg day','after other training days'),
    rival:'Sore muscle holds water for a day or two.'});
  add({id:'w-cardio',fam:'scale',kind:'group',out:'weight',obs:wo(w=>w.cardioY),a:'the morning after cardio',b:'with no cardio the day before',say:wsay('the morning after cardio','otherwise'),
    rival:'A long run costs water that comes back within a day.'});
  add({id:'w-carbs',fam:'scale',kind:'dose',out:'weight',obs:wo(w=>w.carbsY),xName:'carbs the day before',
    say:e=>({t:`You weigh ${Math.abs(e.eff).toFixed(1)} ${u} ${e.eff>0?'more':'less'} the morning after your higher-carb days`,
      s:`Top third of days by carbs against the bottom third (${e.hi.n} and ${e.lo.n} mornings). Each gram of stored carbohydrate holds about three of water.`}),
    rival:'Higher-carb days are usually higher in everything, salt included.'});
  for(let d=0;d<7;d++)add({id:'w-dow-'+d,fam:'scale',kind:'group',out:'weight',obs:wo(w=>w.dow===d),a:'on '+DN[d],b:'on other days',say:wsay('on '+DN[d],'on other days'),
    rival:'Whatever you do the day before, every week.'});
  add({id:'w-sleep',fam:'sleep',kind:'group',out:'weight',obs:wo(w=>w.sleep==null?null:w.sleep<7),a:'after a short night',b:'after seven hours or more',say:wsay('after a short night','after seven hours or more'),
    rival:'Late nights often mean late meals.'});
  // ── Running ──
  const psay=(cond,other)=>e=>({t:`You run ${pct(e.eff)} ${e.eff>0?'slower':'faster'} ${cond}`,
    s:`${e.a.k} of ${e.a.n} runs ${cond} were ${e.eff>0?'slower':'faster'} than your trend, against ${e.eff>0?e.b.k:e.b.n-e.b.k} of ${e.b.n} ${other}.`});
  const ro=fx=>D.runs.map(r=>{const x=fx(r);return x==null?null:{x,y:r.r,t:r.t};});
  add({id:'p-leg',fam:'cardio',kind:'group',out:'pace',obs:ro(r=>r.legY),a:'the day after leg day',b:'otherwise',say:psay('the day after leg day','other runs'),rival:'The run after leg day may always be the same route or distance.'});
  add({id:'p-kcal',fam:'fuel',kind:'group',out:'pace',obs:ro(r=>r.kcalY==null?null:r.kcalY>=0.95),a:'after hitting your calories',b:'after a day under target',say:psay('the day after you hit your calories','after a day under target'),
    rival:'Days you eat to target are often days with less going on.'});
  return T;
}

// ─── Running the tests ───
function patRun(test){
  const obs=test.obs.slice().sort((a,b)=>a.t-b.t);const out={test,n:obs.length,ok:false};
  const floor=patFloor(test.out);
  const y=obs.map(o=>o.y);
  if(test.kind==='group'){
    const A=obs.filter(o=>o.x),B=obs.filter(o=>!o.x);const min=test.out==='weight'?PAT.MIN_W:PAT.MIN;
    out.na=A.length;out.nb=B.length;out.min=min;out.have=Math.min(A.length,B.length);
    if(A.length<min||B.length<min)return out;
    const x=obs.map(o=>o.x?1:0);const eff=patDiff(x,y);
    const pos=arr=>arr.filter(o=>eff>0?o.y>0:o.y<0).length;
    out.e={eff,a:{n:A.length,mean:patMean(A.map(o=>o.y)),k:pos(A)},b:{n:B.length,mean:patMean(B.map(o=>o.y)),k:B.filter(o=>o.y>0).length}};
    out.p=patPermGroup(x,y,patHash(test.id));
    // the same direction in the first and the second half of the history
    const half=Math.floor(obs.length/2);const h=[obs.slice(0,half),obs.slice(half)].map(part=>{const a=part.filter(o=>o.x),b=part.filter(o=>!o.x);return a.length>=3&&b.length>=3?patMean(a.map(o=>o.y))-patMean(b.map(o=>o.y)):null;});
    out.stable=h[0]!=null&&h[1]!=null&&Math.sign(h[0])===Math.sign(eff)&&Math.sign(h[1])===Math.sign(eff);
    out.big=Math.abs(eff)>=floor;out.strong=A.length>=min*2&&B.length>=min*2;out.A=A;out.B=B;
  }else{
    out.min=PAT.MIN_DOSE;out.have=obs.length;
    if(obs.length<PAT.MIN_DOSE)return out;
    const xr=patRanks(obs.map(o=>o.x)),yr=patRanks(y);const rho=patCorr(xr,yr);
    const byX=obs.slice().sort((a,b)=>a.x-b.x);const third=Math.floor(obs.length/3);
    const lo=byX.slice(0,third),hi=byX.slice(-third);const eff=patMean(hi.map(o=>o.y))-patMean(lo.map(o=>o.y));
    out.e={eff,rho,lo:{n:lo.length,mean:patMean(lo.map(o=>o.y))},hi:{n:hi.length,mean:patMean(hi.map(o=>o.y))}};
    out.p=patPermCorr(xr,yr,patHash(test.id));
    const half=Math.floor(obs.length/2);const hr=[obs.slice(0,half),obs.slice(half)].map(part=>part.length>=6?patCorr(patRanks(part.map(o=>o.x)),patRanks(part.map(o=>o.y))):null);
    out.stable=hr[0]!=null&&hr[1]!=null&&Math.sign(hr[0])===Math.sign(rho)&&Math.sign(hr[1])===Math.sign(rho)&&Math.sign(eff)===Math.sign(rho);
    out.big=Math.abs(eff)>=floor;out.strong=obs.length>=PAT.MIN_DOSE*2;out.A=hi;out.B=lo;out.all=obs;
  }
  out.ok=true;return out;
}
// Benjamini–Hochberg: the largest k with p(k) ≤ k/m × q passes, and everything below it.
function patBH(results,q){
  const t=results.filter(r=>r.ok).sort((a,b)=>a.p-b.p);const m=t.length;let cut=-1;
  t.forEach((r,i)=>{if(r.p<=(i+1)/m*q)cut=i;});
  t.forEach((r,i)=>{r.bh=i<=cut;});
}
function patTiers(results,q){
  patBH(results,q);
  results.forEach(r=>{
    if(!r.ok){r.tier='more';return;}
    r.tier=r.bh&&r.stable&&r.big?(r.strong&&r.p<0.01?'solid':'likely'):(r.p<0.05&&r.big?'early':'none');
  });
}
// The same thing seen twice. If Saturday is always a rest day, "after a rest day" and "on Sundays"
// are one finding, not two. Working down from the surest pattern, each later one is checked
// against those already kept: if its condition mostly falls on the same cases, or if nothing is
// left of it once the kept pattern's effect is taken out, it is listed under that one instead.
function patFloor(out){return out==='weight'?(S.unit==='kg'?PAT.FLOOR_W/2:PAT.FLOOR_W):out==='pace'?PAT.FLOOR_PACE:PAT.FLOOR_LIFT;}
function patExplains(k,r){
  if(k.test.out!==r.test.out)return false;
  if(k.test.lift&&r.test.lift&&k.test.lift!==r.test.lift)return false;
  const mk=k._x||(k._x=new Map(k.test.obs.map(o=>[o.t,k.test.kind==='dose'?o.x:(o.x?1:0)])));
  const shared=r.test.obs.filter(o=>mk.has(o.t));if(shared.length<PAT.MIN)return false;
  const rx=shared.map(o=>r.test.kind==='dose'?o.x:(o.x?1:0)),kx=shared.map(o=>mk.get(o.t));
  if(Math.abs(patCorr(rx,kx))>=0.5)return true;
  if(k.test.kind!=='group'||r.test.kind!=='group'||shared.length<r.test.obs.length*0.8)return false;
  const y=shared.map(o=>o.y-(mk.get(o.t)?k.e.a.mean:k.e.b.mean));
  if(Math.abs(patDiff(rx,y))<patFloor(r.test.out))return true;
  return patPermGroup(rx,y,patHash(r.test.id+'|'+k.test.id))>0.05;
}
function patDedupe(found){
  const keep=[];
  found.forEach(r=>{const by=keep.find(k=>patExplains(k,r));if(by)(by.also=by.also||[]).push(r);else keep.push(r);});
  keep.forEach(k=>{delete k._x;});
  return keep;
}
// Everything, tested and sorted. → {found, early, none, more, strict, tested}
function patterns(){
  const D=patData();if(_pat.res)return _pat.res;
  const results=patCatalog(D).map(patRun);
  patTiers(results,PAT.Q);
  // A placebo check that "found" something means the bar is too low: raise it for everything.
  let strict=false;
  if(results.some(r=>r.test.placebo&&(r.tier==='solid'||r.tier==='likely'))){strict=true;patTiers(results,PAT.Q_STRICT);}
  results.forEach(r=>{if(r.ok&&r.tier!=='none'&&r.tier!=='more')Object.assign(r,r.test.say(r.e));});
  const rank=r=>(r.tier==='solid'?0:10)+(r.test.lift?1:0)+r.p;
  const pick=t=>results.filter(r=>r.tier===t);
  _pat.res={found:patDedupe(results.filter(r=>(r.tier==='solid'||r.tier==='likely')&&!r.test.placebo).sort((a,b)=>rank(a)-rank(b))),
    early:pick('early').filter(r=>!r.test.placebo).sort((a,b)=>a.p-b.p),none:pick('none'),more:pick('more').sort((a,b)=>b.have/b.min-a.have/a.min),
    strict,tested:results.filter(r=>r.ok).length,all:results};
  return _pat.res;
}
// Screens that draw often (Home, the board) ask for the answer only if it is already worked out,
// and otherwise get it a moment later, so nothing waits on the arithmetic.
function patCached(then){
  if(_pat.res&&_pat.sig===patSig())return _pat.res;
  if(then&&!_pat.wait){_pat.wait=true;setTimeout(()=>{_pat.wait=false;try{patterns();then();}catch(e){logError(e,'patterns');}},80);}
  return null;
}
function patById(id){return patterns().all.find(r=>r.test.id===id)||null;}
// The patterns about one lift, surest first.
// (Taken from everything that cleared the bar, including those folded under a broader finding.)
function patForLift(id){return patterns().all.filter(r=>r.test.lift===id&&(r.tier==='solid'||r.tier==='likely'));}

// ─── Records: counted, not tested ───
// A record day is a session where a lift beat every earlier session of it (the first is a start, not a record).
function patRecords(){
  const D=patData();const days={};
  getExsWithHist().forEach(id=>{let best=0;getExStrData(id).forEach((d,i)=>{if(i>0&&d.e1rm>best)(days[d.date]=days[d.date]||[]).push(id);if(d.e1rm>best)best=d.e1rm;});});
  const rec=D.sessions.filter(s=>days[s.ts]);
  const out=[];
  const share=(arr,f)=>{const a=arr.filter(s=>f(s)!=null);return a.length?{k:a.filter(f).length,n:a.length}:null;};
  const last=rec.slice(-12);
  [{f:s=>s.gapTrain==null||s.gapTrain>6?null:s.gapTrain>=2,say:'came after a day off'},
   {f:s=>s.kcalY==null?null:s.kcalY>=0.95,say:'came the day after you hit your calories'},
   {f:s=>s.hour<12,say:'came in the morning'},
   {f:s=>s.sleep==null?null:s.sleep>=7,say:'came after seven hours of sleep or more'}].forEach(c=>{
    const a=share(last,c.f),b=share(D.sessions,c.f);
    if(a&&b&&a.n>=6&&a.k/a.n>=0.6&&a.k/a.n-b.k/b.n>=0.2)out.push({t:`${a.k} of your last ${a.n} record days ${c.say}`,s:`Across all your sessions that is true of ${Math.round(b.k/b.n*100)}%. Counted, not tested: read it as a lead.`});
  });
  return{days:rec.length,notes:out};
}

// ─── One line for Home: true, encouraging, about today ───
function patHomeLine(){
  const res=patCached(()=>{if(S.tab==='workout'&&!S.activeWorkout&&!document.querySelector('.ov'))rerender();});if(!res)return null;
  const td=today();const trainedY=patData().trainDays.has(addDays(td,-1));const trainsToday=typeof isTrainingDay==='function'&&hasFixedSchedule()?isTrainingDay(td):null;
  const rest=res.found.find(r=>r.test.id==='rest'&&r.e.eff>0);
  if(rest){
    if(trainsToday===false)return{icon:'moon',t:'Rest day, and it counts',s:`Your lifts are ${Math.abs(rest.e.eff).toFixed(1)}% better after a day off (${rest.e.a.k} of ${rest.e.a.n} sessions).`,id:'rest'};
    if(!trainedY&&trainsToday!==false)return{icon:'bolt',t:'You are rested',s:`Your lifts are ${Math.abs(rest.e.eff).toFixed(1)}% better after a day off (${rest.e.a.k} of ${rest.e.a.n} sessions).`,id:'rest'};
  }
  return null;
}

// ─── The page ───
function patRowHTML(r){
  const tierLbl={solid:'Solid',likely:'Likely',early:'Early'}[r.tier]||'';
  return`<button class="row row-tap pat-row" onclick="showPattern(${jsq(r.test.id)})"><span class="row-main"><span class="row-t">${esc(r.t)}</span><span class="row-s">${esc(PAT_FAM[r.test.fam]||'')} · ${r.n} cases</span></span>
    <span class="pill ${r.tier==='solid'?'pill-good':r.tier==='likely'?'pill-acc':''}">${tierLbl}</span><span class="row-chev">${ICON('chev',16)}</span></button>`;
}
function patternsHTML(){
  let res;try{res=patterns();}catch(e){logError(e,'patterns');return`<div class="ch-empty">Patterns could not be worked out.</div>`;}
  const rec=patRecords();
  const name=r=>`${r.test.say.who||({lift:'Your lifts',weight:'Your weight',pace:'Your run pace'})[r.test.out]}, ${r.test.kind==='dose'?'against '+r.test.xName:r.test.a}${r.test.placebo?' (placebo check)':''}`;
  let h=`<div class="sheet-sub" style="margin-bottom:12px">What your own log shows, measured against your trend and counted. A pattern is shown only when it has enough cases, is big enough to matter, holds in both halves of your history and survives a correction for the ${res.tested} that were tested. It says what tends to happen, not why.</div>`;
  if(res.found.length)h+=`<div class="sec-h">Found · ${res.found.length}</div><div class="list">${res.found.map(patRowHTML).join('')}</div>`;
  else h+=`<div class="ch-empty">${res.tested?`Nothing clears the bar yet out of ${res.tested} tested. That is the honest answer for now; the list below shows what is closest.`:'Not enough logged yet to test anything. Each pattern needs about eight sessions on each side of a comparison.'}</div>`;
  if(rec.notes.length)h+=`<div class="sec-h">Your record days · ${rec.days}</div><div class="list">${rec.notes.map(n=>`<div class="row"><span class="row-main"><span class="row-t">${esc(n.t)}</span><span class="row-s">${esc(n.s)}</span></span></div>`).join('')}</div>`;
  if(res.early.length)h+=`<details class="fold"><summary>Early signs · ${res.early.length}</summary><div class="fine" style="margin:0 2px 8px">These cleared a simple test but not the full set of bars. With this many tested, some of them are chance.</div><div class="list">${res.early.map(patRowHTML).join('')}</div></details>`;
  if(res.none.length)h+=`<details class="fold"><summary>Tested, nothing found · ${res.none.length}</summary><div class="list">${res.none.map(r=>`<div class="row"><span class="row-main"><span class="row-t">${esc(name(r))}</span><span class="row-s">No clear difference in ${r.n} cases</span></span></div>`).join('')}</div></details>`;
  if(res.more.length)h+=`<details class="fold"><summary>Needs more data · ${res.more.length}</summary><div class="list">${res.more.slice(0,40).map(r=>`<div class="row"><span class="row-main"><span class="row-t">${esc(name(r))}</span><span class="row-s">${r.test.kind==='dose'?`${r.have} of ${r.min} cases`:`${r.na||0} and ${r.nb||0} cases; needs ${r.min} on each side`}</span></span>
    <span class="pat-prog" aria-hidden="true"><i style="width:${Math.round(Math.min(1,(r.have||0)/r.min)*100)}%"></i></span></div>`).join('')}</div></details>`;
  if(res.strict)h+=`<div class="fine">A placebo check came up positive on this log, so the bar was raised for everything (false-discovery rate 5% in place of 10%).</div>`;
  return h;
}
function showPatterns(){
  const ov=makeOv('pat-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Patterns</div><div id="pat-body">${patternsHTML()}</div>
    <button class="btn btg bfw" style="margin-top:12px" onclick="closeOv('pat-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// The cases behind one pattern: every case as a dot against your trend, the two groups one above the other.
function patStripSVG(r){
  const W=326,H=112;const A=r.A||[],B=r.B||[];const ys=A.concat(B).map(o=>o.y);if(!ys.length)return'';
  const m=Math.max(1e-9,...ys.map(Math.abs));const X=v=>Math.round((W/2+v/m*(W/2-10))*10)/10;
  const row=(arr,cy,cls)=>arr.map((o,i)=>`<circle class="${cls}" cx="${X(o.y)}" cy="${cy+((i*7)%13-6)}" r="3.4"/>`).join('');
  const tick=(v,cy)=>`<line class="pat-mean" x1="${X(v)}" y1="${cy-13}" x2="${X(v)}" y2="${cy+13}"/>`;
  return`<svg class="pat-strip" viewBox="0 0 ${W} ${H}" role="img" aria-label="Each case against your trend"><line class="pat-zero" x1="${W/2}" y1="6" x2="${W/2}" y2="${H-18}"/>
    ${row(A,30,'pat-a')}${tick(patMean(A.map(o=>o.y)),30)}${row(B,72,'pat-b')}${tick(patMean(B.map(o=>o.y)),72)}
    <text class="ch-lab" x="2" y="${H-3}">below your trend</text><text class="ch-lab" x="${W-2}" y="${H-3}" text-anchor="end">above your trend</text></svg>`;
}
function showPattern(id){
  const r=patById(id);if(!r||!r.ok)return;
  const t=r.test;const unit=t.out==='weight'?' '+(S.unit||'lbs'):'%';
  const fm=v=>`${v>=0?'+':'−'}${Math.abs(v).toFixed(t.out==='weight'?1:1)}${unit}`;
  const said=r.t?{t:r.t,s:r.s}:t.say(r.e);
  const tierTxt={solid:'Solid: it clears every bar with room to spare.',likely:'Likely: it clears every bar.',early:'Early: it passed a simple test but not all the bars. Treat it as a lead.',none:'No clear difference.'}[r.tier];
  const ov=makeOv('pat1-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div>
    <div class="mt" style="margin-bottom:4px">${esc(said.t)}</div>
    <div class="sheet-sub">${esc(said.s)}</div>
    <div class="pat-chart">${patStripSVG(r)}
      <div class="pat-key"><span><i class="pat-a"></i>${esc(t.kind==='dose'?'Top third by '+t.xName:t.a[0].toUpperCase()+t.a.slice(1))} · ${(r.A||[]).length}, average ${fm(t.kind==='dose'?r.e.hi.mean:r.e.a.mean)}</span>
      <span><i class="pat-b"></i>${esc(t.kind==='dose'?'Bottom third':t.b[0].toUpperCase()+t.b.slice(1))} · ${(r.B||[]).length}, average ${fm(t.kind==='dose'?r.e.lo.mean:r.e.b.mean)}</span></div></div>
    <div class="st-grid st-22" style="margin-top:10px">
      <div class="st"><div class="st-v">${fm(r.e.eff)}</div><div class="st-l">Difference</div></div>
      <div class="st"><div class="st-v">${r.n}</div><div class="st-l">Cases</div></div>
      <div class="st"><div class="st-v">${r.p<0.01?'under 1 in 100':'1 in '+Math.max(2,Math.round(1/r.p))}</div><div class="st-l">Odds of this by chance alone</div></div>
      <div class="st"><div class="st-v">${r.stable?'Yes':'No'}</div><div class="st-l">Holds in both halves</div></div>
    </div>
    <div class="note-box"><b>${esc(tierTxt)}</b> ${t.rival?'What else could explain it: '+esc(t.rival[0].toLowerCase()+t.rival.slice(1)):''}</div>
    ${r.also&&r.also.length?`<div class="fine">The same thing also shows up as: ${r.also.map(x=>esc(x.t)).join('; ')}. Those conditions mostly fall on the same days, so they are counted as one finding.</div>`:''}
    ${t.lore?`<div class="fine">The saying: ${esc(t.lore)}</div>`:''}
    <div class="fine">Each dot is one ${t.out==='weight'?'weigh-in':t.out==='pace'?'run':'session'}, placed by how far it was from your own trend that day (${t.out==='weight'?'the weigh-ins a week either side':t.out==='pace'?'the efforts at that distance around it':'the sessions of each lift around it'}). The bars mark each group’s average.</div>
    <button class="btn btg bfw" style="margin-top:12px" onclick="closeOv('pat1-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
