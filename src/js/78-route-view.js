// ═══════════════════════════════════════════════════
// AN ACTIVITY'S ROUTE — the line, splits, hills, heart rate, and other times on the same route
// ═══════════════════════════════════════════════════
// Shown on the activity sheet when the activity has a route and Running is on. The route is read
// from the device database when the sheet opens; nothing here is kept in S.
const M_TO_FT=3.28084;
const FOOT_TYPES=['run','ruck','walk','hike'];
const _rtCache=new Map(); // decoded routes, by activity id (cleared when it grows)
async function routeLoad(id){
  if(_rtCache.has(id))return _rtCache.get(id);
  const rec=await Routes.get(id);if(!rec)return null;
  const rt=routeDecode(rec);if(!rt)return null;
  rt.timed=rec.sec>0;
  const out={rec,rt};
  if(_rtCache.size>400)_rtCache.clear();
  _rtCache.set(id,out);
  return out;
}
// The highest heart rate to measure zones against: the formula for your age (208 − 0.7 × age), or
// the second-highest you have recorded if that is higher (the single highest is often a glitch).
function runMaxHr(){
  const est=Math.round(208-0.7*userAge());
  const seen=(S.activities||[]).map(a=>a.rt&&a.rt.hrx||0).filter(v=>v>0).sort((a,b)=>b-a);
  const mine=seen.length>=3?seen[1]:0;
  return mine>est?{max:mine,own:true}:{max:est,own:false};
}

// ─── The line ───
// North is up. No map underneath: the shape, where it started (ring) and finished (dot), and a
// marker at each mile.
function routeSvg(rt,o){
  o=o||{};const W=326,H=o.h||220,pad=18;
  let a0=Infinity,a1=-Infinity,o0=Infinity,o1=-Infinity;
  for(let i=0;i<rt.n;i++){const a=rt.lat[i],b=rt.lon[i];if(a<a0)a0=a;if(a>a1)a1=a;if(b<o0)o0=b;if(b>o1)o1=b;}
  const k=Math.cos((a0+a1)/2*Math.PI/180);
  const dx=(o1-o0)*k||1e-9,dy=(a1-a0)||1e-9;
  const sc=Math.min((W-2*pad)/dx,(H-2*pad)/dy);
  const X=lon=>chN(W/2+((lon-(o0+o1)/2)*k)*sc),Y=lat=>chN(H/2-(lat-(a0+a1)/2)*sc);
  const line=[];for(let i=0;i<rt.n;i++)line.push(X(rt.lon[i])+','+Y(rt.lat[i]));
  const total=rt.d[rt.n-1];
  // o.hl: [from, to] in metres along the route, drawn heavy with an arrowhead dot at its end (a marked stretch).
  let hl='';
  if(o.hl&&o.hl[1]>o.hl[0]){
    const a=routePointAt(rt,o.hl[0]),b=routePointAt(rt,o.hl[1]);const pts=[X(a[1])+','+Y(a[0])];
    for(let i=0;i<rt.n;i++)if(rt.d[i]>o.hl[0]&&rt.d[i]<o.hl[1])pts.push(X(rt.lon[i])+','+Y(rt.lat[i]));
    pts.push(X(b[1])+','+Y(b[0]));
    hl=`<polyline class="rt-hl" points="${pts.join(' ')}"/><circle class="rt-hl-a" cx="${X(a[1])}" cy="${Y(a[0])}" r="4.5"/><circle class="rt-hl-b" cx="${X(b[1])}" cy="${Y(b[0])}" r="4.5"/>`;
  }const miles=Math.floor(total/MILE_M);const step=Math.max(1,Math.ceil(miles/12));
  let marks='';
  for(let m=step;m<=miles;m+=step){const p=routePointAt(rt,m*MILE_M);
    marks+=`<circle class="rt-mile" cx="${X(p[1])}" cy="${Y(p[0])}" r="7"/><text class="rt-mile-t" x="${X(p[1])}" y="${chN(+Y(p[0])+2.9)}" text-anchor="middle">${m}</text>`;}
  const e=rt.n-1;
  return`<div class="ch-box rt-box"><svg class="chart rt-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'The route, north up')}">
    <polyline class="rt-line${hl?' rt-dim':''}" points="${line.join(' ')}"/>${hl?'':marks}${hl}
    <circle class="rt-end" cx="${X(rt.lon[e])}" cy="${Y(rt.lat[e])}" r="5"/><circle class="rt-start" cx="${X(rt.lon[0])}" cy="${Y(rt.lat[0])}" r="5"/>
    <text class="ch-ax" x="${W-4}" y="12" text-anchor="end">N ↑</text></svg>
    ${o.noKey?'':`<div class="rt-key"><span><i class="rt-k-start"></i>Start</span><span><i class="rt-k-end"></i>Finish</span>${miles&&!hl?'<span><i class="rt-k-mile"></i>Each mile</span>':''}</div>`}</div>`;
}
// ─── Splits ───
// First half against second half, by time at the halfway distance. diff > 0: the second half was faster.
function routeHalves(rt){
  const total=rt.d[rt.n-1];
  if(!(rt.timed&&total>=MILE_M))return null;
  const half=_timeAt(rt,total/2,0).t,all=rt.t[rt.n-1],diff=half-(all-half);
  return{diff,even:Math.abs(diff)<Math.max(2,all*0.005)};
}
function routeSplitsHTML(rec,rt){
  const sp=rec.sp||[];if(!sp.length)return'';
  const rows=sp.map((s,i)=>({n:String(i+1),sec:s,pace:s}));
  if(rec.lp&&rec.lp[0]>0)rows.push({n:fmt1(rec.lp[0]/MILE_M),sec:rec.lp[1],pace:rec.lp[1]/(rec.lp[0]/MILE_M),part:true});
  const full=rows.filter(r=>!r.part).map(r=>r.pace);const lo=Math.min(...full),hi=Math.max(...full);
  const best=full.length>1?full.indexOf(lo):-1;
  const h=routeHalves(rt);
  const note=!h?'':h.even?'Even: the two halves were within a few seconds.'
    :h.diff>0?`Negative split: the second half was ${fmtClock(h.diff)} faster.`:`The second half was ${fmtClock(-h.diff)} slower.`;
  return`<div class="sec-h">Splits</div><div class="splits" id="ad-splits">${rows.map((r,i)=>{
    const w=r.part?null:hi>lo?Math.round(38+62*(hi-r.pace)/(hi-lo)):100;
    return`<div class="sp-row${i===best?' sp-best':''}"><span class="sp-n">${r.part?esc(r.n)+' mi':'Mile '+r.n}</span><span class="sp-bar">${w==null?'':`<i style="width:${w}%"></i>`}</span><span class="sp-t">${fmtClock(r.sec)}${r.part?`<small> ${fmtPace(r.pace)}/mi</small>`:''}</span></div>`;}).join('')}</div>
    ${note?`<div class="fine" id="ad-split-note" style="margin-top:6px">${esc(note)}</div>`:''}`;
}
// ─── Hills ───
function routeElevHTML(rec,rt,a){
  if(!rt.ele)return`<div class="sec-h">Hills</div><div class="fine" id="ad-elev-note">This file has no elevation in it.</div>`;
  const sm=trackSmoothEle(rt,60);const W=326,H=96,top=8,bot=18;
  const min=Math.min(...sm),max=Math.max(...sm);
  let lo=min,hi=max;if(hi-lo<10){const m=(hi+lo)/2;lo=m-5;hi=m+5;} // the drawing never stretches a ripple into a mountain
  const total=rt.d[rt.n-1]||1;
  const X=d=>chN(d/total*W),Y=v=>chN(top+(1-(v-lo)/(hi-lo))*(H-top-bot));
  let path=`M0,${H-bot}`;for(let i=0;i<rt.n;i++)path+=`L${X(rt.d[i])},${Y(sm[i])}`;path+=`L${W},${H-bot}Z`;
  const line=sm.map((v,i)=>X(rt.d[i])+','+Y(v)).join(' ');
  const ft=v=>Math.round(v*M_TO_FT).toLocaleString();
  const flat=rec.eq===2&&rec.up<3&&max-min<3;
  const foot=FOOT_TYPES.includes(a.type);
  const gap=!flat&&foot&&rec.eq===2&&rec.ge>0&&rec.sec>0?rec.sec/(rec.ge/MILE_M):null;
  const pace=rec.sec>0&&rec.m>0?rec.sec/(rec.m/MILE_M):null;
  const note=rec.eq===1?'The elevation in this file jumps about too much to trust, so the climb is rough and there is no grade-adjusted pace.'
    :flat?'Flat all the way.'
    :gap?(pace&&Math.abs(gap-pace)<2?'The ups and downs cancel out: the pace is what it would have been on the flat.'
      :`On flat ground this effort is worth ${fmtPace(gap)} a mile${pace?` (it was ${fmtPace(pace)} on the day)`:''}.`):'';
  return`<div class="sec-h">Hills</div>
    <div class="ch-box"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Elevation along the route"><path class="el-area" d="${path}"/><polyline class="el-line" points="${line}"/>
      <text class="ch-ax" x="0" y="${H-5}">start</text><text class="ch-ax" x="${W}" y="${H-5}" text-anchor="end">${fmt1(total/MILE_M)} mi</text></svg></div>
    <div class="st-grid${gap?'':' st-2'}" style="margin-top:8px"><div class="st"><div class="st-v">${rec.eq===1?'~':''}${ft(rec.up)} ft</div><div class="st-l">Climbed</div></div>
      <div class="st"><div class="st-v${ft(min).length+ft(max).length>8?' st-long':''}">${ft(min)===ft(max)?ft(min):`${ft(min)}–${ft(max)}`}</div><div class="st-l">${ft(min)===ft(max)?'Feet above sea level':'Low to high, ft'}</div></div>
      ${gap?`<div class="st"><div class="st-v" id="ad-gap">${fmtPace(gap)}</div><div class="st-l">Grade-adjusted pace</div></div>`:''}</div>
    ${note?`<div class="fine" id="ad-elev-note" style="margin-top:6px">${esc(note)}</div>`:''}`;
}
// ─── Heart rate ───
const HR_ZONES=[['Very easy','under 60%'],['Easy','60–70%'],['Steady','70–80%'],['Hard','80–90%'],['Very hard','90% and up']];
function routeHeartHTML(rec,rt){
  if(!rt.hr||!(rec.hr>0))return'';
  const mx=runMaxHr();const z=routeZones(rt,mx.max);const tot=z.reduce((a,b)=>a+b,0)||1;
  return`<div class="sec-h">Heart rate</div>
    <div class="st-grid st-2"><div class="st"><div class="st-v">${rec.hr}</div><div class="st-l">Average</div></div><div class="st"><div class="st-v">${rec.hrx}</div><div class="st-l">Highest</div></div></div>
    <div class="zones" id="ad-zones">${HR_ZONES.map((n,i)=>`<div class="zn-row"><span class="zn-n">${n[0]}<small>${n[1]}</small></span><span class="zn-bar"><i class="zn-${i+1}" style="width:${Math.round(100*z[i]/tot)}%"></i></span><span class="zn-t">${z[i]>=1?fmtClock(z[i]):'–'}</span></div>`).join('')}</div>
    <div class="fine" style="margin-top:6px">Zones are shares of a top heart rate of ${mx.max}, ${mx.own?'the highest you have recorded (the single highest reading is ignored, as it is often a glitch)':`the usual estimate for your age (208 − 0.7 × age). It can be 10 beats out for any one person`}.</div>`;
}
// ─── The same route, other days ───
async function routeTwins(a,rt){
  const d=parseFloat(a.dist)||0;if(!(d>0))return[];
  const cands=(S.activities||[]).filter(x=>x.id!==a.id&&x.type===a.type&&x.rt&&Math.abs((parseFloat(x.dist)||0)-d)<=0.06*d);
  const out=[];
  for(const x of cands){
    let other=null;try{other=await routeLoad(x.id);}catch(e){}
    if(other&&sameRoute(rt,other.rt))out.push(x);
  }
  return out;
}
function routeTwinsHTML(a,twins){
  if(!twins.length)return`<div class="sec-h">This route</div><div class="fine" id="ad-twins">The only time on this route so far. Other efforts that start within 150 m, cover the same distance within 5% and follow the same line will be listed here.</div>`;
  const all=twins.concat([a]).filter(x=>actSec(x)>0).sort((x,y)=>(x.date<y.date?-1:x.date>y.date?1:(x.at||0)-(y.at||0)));
  const best=all.reduce((x,y)=>actSec(y)<actSec(x)?y:x,all[0]);const last=all[all.length-1];
  const f=all.length>=3?fitLine(all.map(x=>({t:dayNum(x.date),v:actSec(x)}))):null;
  const perMonth=f&&f.span>=14?f.perDay*30:null;
  const rows=all.slice().reverse().slice(0,8).map(x=>({t:fmtDate(x.date+'T12:00:00').replace(/, \d{4}$/,'')+(x.id===a.id?' · this one':''),s:`${x.dist} mi${x.id===best.id?' · fastest':''}`,v:fmtClock(actSec(x)),js:x.id===a.id?'':`showActivityDetail(${JSON.stringify(x.id)})`}));
  return`<div class="sec-h">This route · ${all.length} time${all.length===1?'':'s'}</div>
    <div class="st-grid" id="ad-twins"><div class="st"><div class="st-v">${fmtClock(actSec(best))}</div><div class="st-l">Fastest, ${fmtDay(best.date)}</div></div>
      <div class="st"><div class="st-v">${fmtClock(actSec(last))}</div><div class="st-l">Latest, ${fmtDay(last.date)}</div></div>
      <div class="st"><div class="st-v">${perMonth==null?'–':Math.abs(perMonth)<1?'Level':`${Math.round(Math.abs(perMonth))} s`}</div><div class="st-l">${perMonth==null||Math.abs(perMonth)<1?'Trend':perMonth<0?'Faster a month':'Slower a month'}</div></div></div>
    ${mRowsHTML(rows)}`;
}

// ─── The glance line and the tabs ───
let _adTab='splits'; // the tab last used, so the next run opens where you were
function runStripHead(html){return String(html||'').replace(/^\s*<div class="sec-h"[^>]*>[\s\S]*?<\/div>/,'');}
function routeGlanceHTML(rec,rt,a,foot){
  const bits=[];
  const h=foot?routeHalves(rt):null;
  if(h)bits.push(h.even?'Even pacing':h.diff>0?`Negative split by ${fmtClock(h.diff)}`:`Second half ${fmtClock(-h.diff)} slower`);
  if(rt.ele&&rec.up>=10)bits.push(`${rec.eq===1?'~':''}${Math.round(rec.up*M_TO_FT).toLocaleString()} ft climbed`);
  if(rec.hr>0)bits.push(`${rec.hr} bpm average`);
  return bits.length?`<div class="ad-glance" id="ad-glance">${bits.map(esc).join(' · ')}</div>`:'';
}
function adTab(p){
  _adTab=p;
  document.querySelectorAll('#ad-tabs .seg-b').forEach(b=>{const on=b.dataset.p===p;b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false');});
  document.querySelectorAll('#ad-run .ad-pane').forEach(x=>{x.hidden=x.dataset.p!==p;});
}

// ─── Filling the sheet ───
// Called by showActivityDetail once the sheet is up. Each part is drawn as soon as it can be.
async function actRouteFill(a){
  const el=document.getElementById('ad-run');if(!el)return;
  el.dataset.id=a.id;
  el.innerHTML=`<div class="fine"><span class="ai-spin" style="display:inline-block;vertical-align:-3px;margin-right:6px"></span>Reading the route…</div>`;
  let got=null;try{got=await routeLoad(a.id);}catch(e){logError(e,'route');}
  const here=()=>{const x=document.getElementById('ad-run');return x&&x.dataset.id===String(a.id)?x:null;};
  if(!here())return;
  if(!got){
    here().innerHTML=`<div class="note-box" id="ad-noroute">This activity had a route, but it is not on this device${Routes.durable()?'':' (this browser is not keeping routes between visits)'}. Import the same Strava file again to bring it back; nothing will be added twice.</div>`;
    return;
  }
  const{rec,rt}=got;const foot=FOOT_TYPES.includes(a.type);
  // One line first: how the run went in a few words. The detail is a tab away, one at a time.
  const panes=[];
  if(foot&&(rec.sp||[]).length)panes.push(['splits','Splits',routeSplitsHTML(rec,rt)]);
  panes.push(['hills','Hills',routeElevHTML(rec,rt,a)]);
  const heart=routeHeartHTML(rec,rt);if(heart)panes.push(['heart','Heart',heart]);
  const seg=segOnActivityHTML(a);
  panes.push(['same','Route',`<div id="ad-twin-slot"><div class="sec-h">This route</div><div class="fine">Looking for other times on it…</div></div>
    ${seg}
    ${rt.timed?`<button class="btn bts bfw" id="ad-mark" style="margin-top:12px" onclick="showSegMark(${jsq(a.id)})">Mark a stretch of this route</button>`:''}`]);
  if(!panes.some(p=>p[0]===_adTab))_adTab=panes[0][0];
  here().innerHTML=`${routeSvg(rt)}
    ${routeGlanceHTML(rec,rt,a,foot)}
    <div class="seg seg-in ad-tabs" id="ad-tabs" role="tablist">${panes.map(p=>`<button class="seg-b${p[0]===_adTab?' on':''}" role="tab" aria-selected="${p[0]===_adTab}" data-p="${p[0]}" onclick="adTab('${p[0]}')">${p[1]}</button>`).join('')}</div>
    ${panes.map(p=>`<div class="ad-pane" id="ad-pane-${p[0]}" data-p="${p[0]}" role="tabpanel"${p[0]===_adTab?'':' hidden'}>${p[0]==='same'?p[2]:runStripHead(p[2])}</div>`).join('')}
    ${a.gear&&SHOE_TYPES.includes(a.type)?`<div class="fine" id="ad-gear" style="margin-top:10px">Shoes: ${esc(a.gear)}</div>`:''}
    <div class="fine" style="margin-top:10px">Times leave out standing still${rec.el>rec.sec+30?` (${fmtClock(rec.el-rec.sec)} here)`:''}. The line is drawn from ${rec.n.toLocaleString()} points kept from the recording.</div>`;
  let twins=[];try{twins=await routeTwins(a,rt);}catch(e){logError(e,'same route');}
  const slot=here()&&document.getElementById('ad-twin-slot');
  if(slot)slot.innerHTML=routeTwinsHTML(a,twins);
}
