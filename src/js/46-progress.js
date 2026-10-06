// PROGRESS
// ═══════════════════════════════════════════════════
function renderProgress(c){
  const gl=S.goal||'general';
  // Open this goal's key cards the first time it's viewed; respect manual changes thereafter.
  if(!S.progSeeded)S.progSeeded={};
  if(!S.progSeeded[gl]){(GOAL_OPEN[gl]||[]).forEach(id=>{S.expandedCards[id]=true;});S.progSeeded[gl]=true;save();}
  const order=GOAL_ORDER[gl]||GOAL_ORDER.general;
  const sorted=order.map(id=>DASH_CARDS.find(d=>d.id===id)).filter(Boolean);
  let html=`<div class="ph"><div class="page-title">Progress</div></div>`;
  sorted.forEach(card=>{
    const open=S.expandedCards[card.id];const sub=getDashSub(card.id);
    html+=`<div class="dash-card"><div class="dash-hdr" onclick="toggleCard('${card.id}')">
      <div class="dash-icon">${ICON(card.icon,18)}</div>
      <div class="dash-info"><div class="dash-title">${card.title}</div>${sub?`<div class="dash-sub">${sub}</div>`:''}</div>
      <div class="dash-chev${open?' open':''}">›</div>
    </div>${open?`<div class="dash-body" id="card-${card.id}">${getDashBody(card.id)}</div>`:''}</div>`;
  });
  c.innerHTML=html;if(Object.values(S.expandedCards).some(Boolean))setTimeout(()=>renderCharts(),60);
}
function toggleCard(id){S.expandedCards[id]=!S.expandedCards[id];renderProgress(document.getElementById('content'));}
function getDashSub(id){
  if(id==='energy'){const eb=energyBalance(today());const net=eb.net;return`${net<=0?'−':'+'}${Math.abs(Math.round(net)).toLocaleString()} kcal today`;}
  if(id==='weekly'){const n=S.workouts.filter(w=>w.started>=Date.now()-7*86400000).length;return`${n} session${n!==1?'s':''} this week`;}
  if(id==='strength'){const n=getExsWithHist().length;return n?`${n} exercises tracked`:'No history yet';}
  if(id==='prs'){const n=Object.keys(S.prs).length;return n?`${n} PR${n!==1?'s':''} recorded`:'None yet';}
  if(id==='volume'){const n=S.workouts.filter(w=>w.started>=Date.now()-7*86400000).reduce((t,wk)=>t+doneSetCnt(wk),0);return`${n} sets this week`;}
  if(id==='bodyweight'){const bwl=S.bodyweightLog||[];return bwl.length?`${bwl[0].weight}${S.unit} current`:'No logs yet';}
  if(id==='measurements'){const m=S.measurements||[];return m.length?`Last: ${fmtShort(m[0].date+'T12:00:00')}`:'No measurements yet';}
  if(id==='standards'){const lvs=getStdLevels();const p=lvs.filter(l=>l.level>0).length;return p?`${p}/${lvs.length} graded`:'No lift data yet';}
  if(id==='aft'){const sc=AFT_EVENTS.map(e=>aftScore(e.id,S.aftCurrent[e.id],aftAgeBracket(),S.aftGender)).filter(s=>s!==null);return sc.length?`Avg ${Math.round(sc.reduce((a,b)=>a+b,0)/sc.length)} pts`:'No scores entered';}
  if(id==='consistency')return`${getStreak()} day streak`;
  if(id==='recovery'){const{warnings}=getRecoveryData();return warnings.length?`⚠ ${warnings.length} muscle${warnings.length>1?'s':''} at risk`:'Fatigue normal';}
  if(id==='rucking'){const n=S.activities.filter(a=>['ruck','run','hike','bike','swim','walk'].includes(a.type)).length;return n?`${n} cardio sessions`:'None logged';}
  if(id==='wilks'){const w=getWilksData();return w?`Wilks ${w.wilks} · DOTS ${w.dots}`:'Need squat, bench, deadlift PRs';}
  return'';
}
function getDashBody(id){
  if(id==='energy')return renderEnergyBody();
  if(id==='weekly')return renderWeeklyBody();if(id==='strength')return renderStrengthBody();
  if(id==='prs')return renderPRsBody();if(id==='volume')return renderVolumeBody();
  if(id==='bodyweight')return renderBodyweightBody();if(id==='measurements')return renderMeasurementsBody();
  if(id==='standards')return renderStandardsBody();if(id==='aft')return renderAFTBody();
  if(id==='consistency')return renderConsistencyBody();if(id==='recovery')return renderRecoveryBody();
  if(id==='rucking')return renderRuckingBody();if(id==='wilks')return renderWilksBody();
  return'';
}
function renderCharts(){
  if(S.expandedCards.energy)renderEnergyChart();
  if(S.expandedCards.measurements)renderMeasurementsChart();
  if(S.expandedCards.weekly)renderWeeklyChart();if(S.expandedCards.strength)renderStrengthChart();
  if(S.expandedCards.bodyweight)renderBodyweightChart();if(S.expandedCards.consistency)renderConsistencyChart();
  if(S.expandedCards.rucking)renderRuckingChart();
}
function renderEnergyBody(){
  const td=today();const eb=energyBalance(td);
  const hasIntake=(getDayTotals(td).cals||0)>0;
  const days=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return d.toISOString().split('T')[0];});
  const logged=days.map(ds=>({...energyBalance(ds),logged:(getDayTotals(ds).cals||0)>0})).filter(n=>n.logged);
  const last7=logged.slice(-7);
  const avg7=last7.length?Math.round(last7.reduce((t,n)=>t+n.net,0)/last7.length):null;
  const wkLbs=avg7!=null?(avg7*7/3500):null;
  const netCol=eb.net<0?'var(--green)':eb.net>0?'var(--red)':'var(--muted)';
  let html=`<div class="sgrid">
    <div class="sc"><div class="sv">${eb.intake.toLocaleString()}</div><div class="slb">Intake kcal</div></div>
    <div class="sc"><div class="sv">${eb.burn.toLocaleString()}</div><div class="slb">Burned kcal</div></div>
    <div class="sc"><div class="sv" style="color:${netCol}">${eb.net<0?'−':eb.net>0?'+':''}${Math.abs(Math.round(eb.net)).toLocaleString()}</div><div class="slb">Net today</div></div>
    <div class="sc"><div class="sv" style="font-size:15px;color:${netCol}">${eb.net<0?'Deficit':eb.net>0?'Surplus':'Even'}</div><div class="slb">Status</div></div>
  </div>
  <div style="padding:9px 13px;font-size:11px;color:var(--muted);line-height:1.5;border-bottom:1px solid var(--border)">Burn = ${eb.base.toLocaleString()} baseline${eb.exercise?` + ${eb.exercise.toLocaleString()} exercise`:''}. Baseline estimated from ${S.height||69} in · ${S.bodyweight||185} ${S.unit} · age ${userAge()} (set details in Settings).</div>`;
  if(!hasIntake)html+=`<div style="padding:9px 13px;font-size:11px;color:var(--muted)">No intake logged today — add meals or Quick Log in Nutrition for an accurate balance.</div>`;
  html+=`<div class="chart-wrap"><canvas id="ch-energy"></canvas></div>`;
  if(avg7!=null)html+=`<div style="padding:8px 13px 10px;display:flex;justify-content:space-between;align-items:center;font-size:12px;border-top:1px solid var(--border)"><span style="color:var(--muted)">7-day avg net: <strong style="color:${avg7<0?'var(--green)':avg7>0?'var(--red)':'var(--text)'}">${avg7<0?'−':avg7>0?'+':''}${Math.abs(avg7).toLocaleString()}</strong></span><span style="color:var(--muted)">Est. ${wkLbs<0?'loss':wkLbs>0?'gain':'change'}: <strong style="color:var(--text)">${Math.abs(wkLbs).toFixed(1)} ${S.unit}/wk</strong></span></div>`;
  else html+=`<div style="padding:8px 13px 10px;font-size:11px;color:var(--muted)">Log a few days of intake to see your trend and projected weekly change.</div>`;
  return html;
}
function renderEnergyChart(){
  const days=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return d.toISOString().split('T')[0];});
  const data=days.map(ds=>{const lg=(getDayTotals(ds).cals||0)>0;return lg?Math.round(energyBalance(ds).net):null;});
  if(!data.some(v=>v!=null))return;
  mkChart('ch-energy',{type:'bar',data:{labels:days.map(ds=>fmtShort(ds+'T12:00:00')),datasets:[{data,backgroundColor:data.map(v=>v==null?'transparent':v<0?cv('--grbright'):cv('--rdim')),borderColor:data.map(v=>v==null?'transparent':v<0?cv('--green'):cv('--red')),borderWidth:1.5,borderRadius:4}]},options:{...baseOpts(),plugins:{legend:{display:false}},scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}}}}});
}
function renderWeeklyBody(){
  const ago7=Date.now()-7*86400000;const wks=S.workouts.filter(w=>w.started>=ago7);const acts=S.activities.filter(a=>new Date(a.date+'T12:00:00').getTime()>ago7);
  const vol=Math.round(wks.reduce((t,wk)=>t+totalVol(wk),0));const cals=Math.round(wks.reduce((t,wk)=>t+(wk.cals||0),0)+acts.reduce((t,a)=>t+(a.cals||0),0));
  const steps=S.stepsLog[today()]||0;
  return`<div class="sgrid"><div class="sc"><div class="sv">${wks.length}</div><div class="slb">Workouts</div></div><div class="sc"><div class="sv">${acts.length}</div><div class="slb">Activities</div></div><div class="sc"><div class="sv">${vol.toLocaleString()}</div><div class="slb">Volume ${S.unit}</div></div><div class="sc"><div class="sv">${cals.toLocaleString()}</div><div class="slb">~kcal</div></div></div>
  <div class="chart-wrap"><canvas id="ch-weekly"></canvas></div>
  <div style="padding:8px 13px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border)"><div style="font-size:12px;color:var(--muted)">Today's Steps: <strong style="color:var(--text)">${steps.toLocaleString()}</strong></div><button class="btn bts bsm" onclick="showRetroSteps()">Update</button></div>`;
}
function renderWeeklyChart(){const data=getWeeklyActivity(10);mkChart('ch-weekly',{type:'bar',data:{labels:Array.from({length:10},(_,i)=>`W-${9-i}`),datasets:[{data,backgroundColor:cv('--ndim'),borderColor:cv('--navy'),borderWidth:1.5,borderRadius:4}]},options:{...baseOpts(),plugins:{legend:{display:false}}}});}
function renderStrengthBody(){
  const exs=getExsWithHist();if(!exs.length)return`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('trendup',30)}</div><div class="etit" style="font-size:14px">No history yet</div></div>`;
  const sel=S.progExId||exs[0];
  return`<div style="padding:10px 13px"><select id="prog-ex-sel" onchange="S.progExId=this.value;renderProgress(document.getElementById('content'))" style="margin-bottom:10px">${exs.map(id=>`<option value="${id}"${id===sel?' selected':''}>${getEx(id)?.name||id}</option>`).join('')}</select></div><div class="chart-wrap"><canvas id="ch-str"></canvas></div>`;
}
function renderStrengthChart(){const exId=S.progExId||getExsWithHist()[0];if(!exId)return;const data=getExStrData(exId);if(!data.length)return;mkChart('ch-str',{type:'line',data:{labels:data.map(d=>d.label),datasets:[{data:data.map(d=>d.e1rm),borderColor:cv('--navy'),backgroundColor:'transparent',tension:0.3,pointRadius:4,pointBackgroundColor:cv('--navy')}]},options:{...baseOpts(),plugins:{legend:{display:false}},scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}}}}});}
function renderPRsBody(){const prs=Object.entries(S.prs).sort((a,b)=>parseFloat(b[1].w)-parseFloat(a[1].w));if(!prs.length)return`<div class="empty" style="padding:24px"><div style="font-size:28px;margin-bottom:8px">🏆</div><div class="etit" style="font-size:14px">No PRs yet</div></div>`;return`<div>${prs.map(([id,pr])=>{const ex=getEx(id);return`<div class="mvrow"><div class="mvname">${ex?.name||id}</div><div class="mono" style="font-size:13px;font-weight:600;color:var(--gold)">${pr.w}<span style="font-size:10px;opacity:.6"> ${S.unit}</span></div><div style="font-size:10px;color:var(--muted);margin-left:9px">×${pr.r}</div></div>`;}).join('')}</div>`;}
// Muscle-group figures (front + back, MuscleWiki-style SVG art). Each tracked region
// is tappable (opens its volume trend) and colored by this-week volume vs MEV/MAV.
// One tracked muscle can drive several SVG regions (delts split front/rear, traps incl. mid-trap, calves both views).
const BM_MAP={
  'Chest':['f-chest'],
  'Lats':['b-lats'],
  'Shoulders':['f-front-shoulders','b-rear-shoulders'],
  'Biceps':['f-biceps'],
  'Triceps':['b-triceps'],
  'Forearms':['f-forearms','b-forearms'],
  'Quads':['f-quads'],
  'Hamstrings':['b-hamstrings'],
  'Glutes':['b-glutes'],
  'Calves':['f-calves','b-calves'],
  'Abs':['f-abdominals'],
  'Obliques':['f-obliques'],
  'Lower Back':['b-lowerback'],
  'Traps':['f-traps','b-traps','b-traps-middle'],
};
const BM_UNTRACKED=['f-hands','b-hands'];
const BM_FILL={none:'var(--bm-muscle)',low:'var(--red)',ok:'var(--green)',high:'var(--purple)'};
function bmStatus(sbm,m){const mm=MEV_MAV[m];if(!mm)return'none';const s=sbm[m]||0;return s===0?'none':s<mm.mev?'low':s<=mm.mav?'ok':'high';}
// Inject per-group fill color + (for tracked muscles) a tap handler into the SVG markup.
function bmPaint(svg,groups){
  return svg.replace(/<g id="([^"]+)"/g,(full,id)=>{
    const g=groups[id];if(!g)return full;
    const click=g.m?` class="bm-mw-rg" onclick="showMuscleDetail('${g.m}')"`:'';
    return `<g id="${id}" style="color:${g.c}"${click}`;
  });
}
function bmFigure(view,sbm){
  const groups={};
  BM_UNTRACKED.forEach(id=>groups[id]={c:'var(--bm-muscle)',m:null});
  Object.entries(BM_MAP).forEach(([m,ids])=>{const c=BM_FILL[bmStatus(sbm,m)];ids.forEach(id=>groups[id]={c,m});});
  return bmPaint(view==='front'?BM_FRONT:BM_BACK,groups);
}
function renderBodyMap(sbm){
  return`<div style="padding:10px 12px 2px"><div style="display:flex;gap:8px;max-width:360px;margin:0 auto">
    <div style="flex:1">${bmFigure('front',sbm)}<div class="bm-cap2">Front</div></div>
    <div style="flex:1">${bmFigure('back',sbm)}<div class="bm-cap2">Back</div></div>
  </div>
  <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:6px;font-size:9px;color:var(--muted);font-weight:600">
    <span><span class="bm-dot" style="background:var(--red)"></span>Under</span>
    <span><span class="bm-dot" style="background:var(--green)"></span>On target</span>
    <span><span class="bm-dot" style="background:var(--purple)"></span>Over</span>
    <span><span class="bm-dot" style="background:var(--bm-muscle)"></span>None</span>
  </div>
  <div style="text-align:center;font-size:10px;color:var(--muted2);margin-top:3px">Tap a muscle for its trend</div></div>`;
}
function showMuscleDetail(m){
  const mm=MEV_MAV[m];if(!mm)return;
  const now=Date.now(),DAY=86400000;
  const weeks=[0,1,2,3,4,5].map(i=>muscleSetsInRange(now-(i+1)*7*DAY,now-i*7*DAY)[m]||0);
  const cur=weeks[0];
  const status=cur===0?'none':cur<mm.mev?'low':cur<=mm.mav?'ok':'high';
  const col={none:'var(--muted)',low:'var(--red)',ok:'var(--green)',high:'var(--purple)'}[status];
  const lbl={none:'No volume logged this week',low:'Below MEV — add work',ok:'In the productive range',high:'Above MAV — consider trimming'}[status];
  const maxv=Math.max(mm.mav,...weeks,1);
  const bars=weeks.map((v,i)=>{
    const h=Math.round((v/maxv)*100);
    const c=v===0?'var(--bm-muscle)':v<mm.mev?'var(--red)':v<=mm.mav?'var(--green)':'var(--purple)';
    return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="width:100%;height:78px;display:flex;align-items:flex-end"><div style="width:100%;height:${h}%;min-height:3px;background:${c};border-radius:4px 4px 0 0"></div></div>
      <div style="font-size:8px;color:var(--muted);font-family:'IBM Plex Mono',monospace">${fmtSets(v)}</div>
      <div style="font-size:8px;color:var(--muted2)">${i===0?'now':'-'+i+'w'}</div>
    </div>`;
  }).reverse().join('');
  const ov=makeOv('musc-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div class="mt" style="margin-bottom:1px">${mm.lbl}</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:13px">${m}</div>
    <div style="display:flex;gap:10px;margin-bottom:13px">
      <div style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:11px;text-align:center"><div style="font-size:24px;font-weight:600;font-family:'IBM Plex Mono',monospace;color:${col};line-height:1.1">${fmtSets(cur)}</div><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:3px">Sets this week</div></div>
      <div style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:11px;text-align:center"><div style="font-size:24px;font-weight:600;font-family:'IBM Plex Mono',monospace;line-height:1.1">${mm.mev}–${mm.mav}</div><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:3px">Target range</div></div>
    </div>
    <div style="font-size:12px;font-weight:600;color:${col};margin-bottom:12px">${lbl}</div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted2);font-weight:700;margin-bottom:7px">6-week trend</div>
    <div style="display:flex;gap:5px;align-items:flex-end;margin-bottom:14px">${bars}</div>
    <button class="btn btg bfw" onclick="dismissOv(document.getElementById('musc-ov'))">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function renderVolumeBody(){
  const ago7=Date.now()-7*86400000;const sbm=muscleSetsInRange(ago7,Date.now()+1);
  const muscles=Object.entries(MEV_MAV);
  let html=renderBodyMap(sbm)+`<div style="padding:8px 13px 5px;font-size:10px;color:var(--muted2);font-weight:500;letter-spacing:.04em;text-transform:uppercase">This week · target: MEV–MAV sets</div>`;
  html+=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border)">`;
  muscles.forEach(([m,mm])=>{
    const s=sbm[m]||0;
    const status=s===0?'none':s<mm.mev?'low':s<=mm.mav?'ok':'high';
    const bg={'none':'var(--card)','low':'var(--rdim)','ok':'var(--grdim)','high':'var(--pdim)'}[status];
    const col={'none':'var(--muted2)','low':'var(--red)','ok':'var(--green)','high':'var(--purple)'}[status];
    const lbl={'none':'–','low':'Below','ok':'On Track','high':'Above Max'}[status];
    const pct=Math.min(100,Math.round((s/mm.mav)*100));
    html+=`<div style="background:${bg};padding:10px 8px;text-align:center">
      <div style="font-size:8px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:3px">${mm.lbl}</div>
      <div style="font-size:22px;font-weight:600;font-family:'IBM Plex Mono',monospace;color:${col};line-height:1.1">${fmtSets(s)}</div>
      <div style="font-size:8px;color:${col};margin-top:2px;font-weight:600">${lbl}</div>
      <div style="height:3px;background:var(--border);border-radius:2px;margin-top:5px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${col};border-radius:2px"></div></div>
    </div>`;
  });
  html+=`</div><div style="padding:8px 13px;display:flex;gap:12px;font-size:10px;font-weight:600;border-top:1px solid var(--border)">
    <span style="color:var(--red)">■ Below MEV</span><span style="color:var(--green)">■ In Range</span><span style="color:var(--purple)">■ Above MAV</span>
  </div>`;
  return html;
}
function renderRecoveryBody(){
  const{ws,warnings}=getRecoveryData();
  const tot0=Object.values(ws[0]).reduce((a,b)=>a+b,0);const tot1=Object.values(ws[1]).reduce((a,b)=>a+b,0);
  const fatigue=warnings.length>=3?'High':warnings.length>=1?'Moderate':'Low';
  const fcol={High:'var(--red)',Moderate:'var(--gold)',Low:'var(--green)'}[fatigue];
  const femoji={High:'🔴',Moderate:'🟡',Low:'🟢'}[fatigue];
  let html=`<div style="background:var(--bg);border-bottom:1px solid var(--border)">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:13px">
      <div><div style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:3px">Accumulated Fatigue</div>
      <div style="font-size:26px;font-weight:700;color:${fcol};letter-spacing:-.5px">${fatigue}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:3px">${fmtSets(tot0)} sets this week · ${fmtSets(tot1)} last week</div></div>
      <div style="font-size:32px">${femoji}</div>
    </div>
    ${warnings.length?`<div style="padding:0 13px 12px;font-size:12px;color:var(--gold);font-weight:600">${ICON('💡',13)} Deload: ${warnings.map(w=>w.muscle).join(', ')}</div>`:''}
  </div>
  <div style="padding:0 13px">
    <div style="display:grid;grid-template-columns:1fr 52px 52px 58px;padding:8px 0;border-bottom:2px solid var(--border)">
      <div style="font-size:9px;font-weight:700;color:var(--muted2);text-transform:uppercase;letter-spacing:.06em">Muscle</div>
      <div style="font-size:9px;font-weight:700;color:var(--muted2);text-align:center;text-transform:uppercase;letter-spacing:.06em">W–2</div>
      <div style="font-size:9px;font-weight:700;color:var(--muted2);text-align:center;text-transform:uppercase;letter-spacing:.06em">W–1</div>
      <div style="font-size:9px;font-weight:700;color:var(--navy);text-align:center;text-transform:uppercase;letter-spacing:.06em">Now</div>
    </div>`;
  Object.entries(MEV_MAV).forEach(([m,mm])=>{
    const w2=ws[2]?.[m]||0,w1=ws[1]?.[m]||0,w0=ws[0]?.[m]||0;
    const col=w0>mm.mav?'var(--red)':w0>=mm.mev?'var(--green)':'var(--muted)';
    const trend=w0>w1?'↑':w0<w1?'↓':'→';const tc=w0>w1?'var(--red)':w0<w1?'var(--green)':'var(--muted2)';
    html+=`<div style="display:grid;grid-template-columns:1fr 52px 52px 58px;padding:7px 0;border-bottom:1px solid var(--border);align-items:center">
      <div style="font-size:12px;font-weight:500">${mm.lbl}</div>
      <div style="text-align:center;font-size:11px;color:var(--muted2);font-family:'IBM Plex Mono',monospace">${w2?fmtSets(w2):'–'}</div>
      <div style="text-align:center;font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace">${w1?fmtSets(w1):'–'}</div>
      <div style="text-align:center;display:flex;align-items:center;justify-content:center;gap:3px">
        <span style="font-size:13px;font-weight:700;color:${col};font-family:'IBM Plex Mono',monospace">${w0?fmtSets(w0):'–'}</span>
        ${w0>0?`<span style="font-size:10px;color:${tc}">${trend}</span>`:''}
      </div>
    </div>`;
  });
  html+=`</div><div style="padding:9px 13px;font-size:10px;color:var(--muted2)">MAV exceeded 2+ weeks = accumulated fatigue. Consider a deload.</div>`;
  return html;
}
function renderBodyweightBody(){
  const bwl=S.bodyweightLog||[];
  let statsHtml='';
  if(bwl.length>=2){
    const now=Date.now();
    const within=(a,b)=>bwl.filter(e=>{const t=new Date(e.date+'T12:00:00').getTime();return t>now-b*86400000&&t<=now-a*86400000;});
    const avg=arr=>arr.length?arr.reduce((t,e)=>t+e.weight,0)/arr.length:null;
    const recent=avg(within(0,7));const prior=avg(within(7,14));
    const cur7=recent!=null?recent:bwl[0].weight;
    const rate=(recent!=null&&prior!=null)?(recent-prior):null;
    statsHtml=`<div class="sgrid" style="border-top:1px solid var(--border)">
      <div class="sc"><div class="sv">${cur7.toFixed(1)}</div><div class="slb">7-day avg ${S.unit}</div></div>
      <div class="sc"><div class="sv" style="color:${rate==null?'var(--text)':rate<0?'var(--green)':rate>0?'var(--red)':'var(--text)'}">${rate==null?'—':(rate<0?'−':'+')+Math.abs(rate).toFixed(1)}</div><div class="slb">${S.unit}/week</div></div>
    </div>`;
  }
  return`<div style="padding:10px 13px">
    <div class="frow" style="margin-bottom:10px"><input type="number" inputmode="decimal" id="bw-inp" placeholder="${S.bodyweight||185}" style="flex:1;text-align:left"><button class="btn btp bsm" style="flex-shrink:0" onclick="logBW()">Log</button></div>
  </div><div class="chart-wrap"><canvas id="ch-bw"></canvas></div>
  ${statsHtml}
  ${bwl.length>=2?`<div style="padding:6px 13px 10px;display:flex;justify-content:space-between;font-size:11px;color:var(--muted)"><span>Low: ${Math.min(...bwl.map(b=>b.weight))} ${S.unit}</span><span>High: ${Math.max(...bwl.map(b=>b.weight))} ${S.unit}</span></div>`:''}`;
}
function logBW(){const v=parseFloat(document.getElementById('bw-inp')?.value);if(!v||isNaN(v)){toast('Enter a weight');return;}S.bodyweight=v;S.bodyweightLog=[{date:today(),weight:v},...(S.bodyweightLog||[])];save();renderProgress(document.getElementById('content'));}
function renderBodyweightChart(){const bwl=(S.bodyweightLog||[]).slice().reverse().slice(-20);if(bwl.length<2)return;mkChart('ch-bw',{type:'line',data:{labels:bwl.map(b=>fmtShort(b.date+'T12:00:00')),datasets:[{data:bwl.map(b=>b.weight),borderColor:cv('--navy'),backgroundColor:'transparent',tension:0.3,pointRadius:3,pointBackgroundColor:cv('--navy')}]},options:{...baseOpts(),plugins:{legend:{display:false}},scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}}}}});}
function renderMeasurementsBody(){
  const meas=S.measurements||[];const mUnit=S.measureUnit||'in';
  const tracked=MEAS_FIELDS.filter(f=>meas.some(m=>m.values&&m.values[f.id]!=null));
  let html=`<div style="padding:10px 13px">
    <div style="display:flex;gap:6px;align-items:center">
      <button class="btn btp bsm" style="flex:1" onclick="showLogMeasurements()">+ Log Measurements</button>
      <button class="btn bxs ${mUnit==='in'?'btp':'bts'}" onclick="setMeasUnit('in')">in</button>
      <button class="btn bxs ${mUnit==='cm'?'btp':'bts'}" onclick="setMeasUnit('cm')">cm</button>
    </div>
  </div>`;
  if(!tracked.length)return html+`<div class="empty" style="padding:16px 24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('ruler',30)}</div><div class="etit" style="font-size:14px">No measurements yet</div><p style="font-size:12px">Log your first set to start tracking progress over time.</p></div>`;
  const sel=(S.measPart&&tracked.find(f=>f.id===S.measPart))?S.measPart:tracked[0].id;
  const series=meas.filter(m=>m.values&&m.values[sel]!=null).map(m=>({date:m.date,val:m.values[sel]})).sort((a,b)=>a.date.localeCompare(b.date));
  const latest=series[series.length-1],first=series[0];
  const totalChg=series.length>=2?(latest.val-first.val):null;
  html+=`<div style="padding:10px 13px;border-top:1px solid var(--border)">
    <select onchange="S.measPart=this.value;save();renderProgress(document.getElementById('content'))">${tracked.map(f=>`<option value="${f.id}"${f.id===sel?' selected':''}>${f.label}</option>`).join('')}</select>
  </div>
  <div class="sgrid">
    <div class="sc"><div class="sv">${latest.val}<span style="font-size:10px;color:var(--muted2)"> ${mUnit}</span></div><div class="slb">Latest · ${fmtShort(latest.date+'T12:00:00')}</div></div>
    <div class="sc"><div class="sv"${totalChg!=null?` style="color:${totalChg<0?'var(--green)':totalChg>0?'var(--blue)':'var(--text)'}"`:''}>${totalChg==null?'—':(totalChg<0?'−':'+')+Math.abs(totalChg).toFixed(1)}</div><div class="slb">Since ${fmtShort(first.date+'T12:00:00')}</div></div>
  </div>`;
  if(series.length>=2)html+=`<div class="chart-wrap"><canvas id="ch-meas"></canvas></div>`;
  const histDesc=series.slice().reverse();
  html+=`<div style="border-top:1px solid var(--border)">${histDesc.map((pt,i)=>{const earlier=histDesc[i+1];const chg=earlier?(pt.val-earlier.val):null;return`<div class="mvrow"><div class="mvname" style="color:var(--muted)">${fmtShort(pt.date+'T12:00:00')}</div><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600;font-family:'IBM Plex Mono',monospace">${pt.val}<span style="font-size:9px;color:var(--muted2)"> ${mUnit}</span></span>${chg!=null&&chg!==0?`<span class="meas-chg" style="color:var(--muted)">${chg<0?'▾':'▴'} ${Math.abs(chg).toFixed(1)}</span>`:''}</div></div>`;}).join('')}</div>`;
  return html;
}
function setMeasUnit(u){S.measureUnit=u;save();renderProgress(document.getElementById('content'));}
function renderMeasurementsChart(){
  const meas=S.measurements||[];const tracked=MEAS_FIELDS.filter(f=>meas.some(m=>m.values&&m.values[f.id]!=null));if(!tracked.length)return;
  const sel=(S.measPart&&tracked.find(f=>f.id===S.measPart))?S.measPart:tracked[0].id;
  const series=meas.filter(m=>m.values&&m.values[sel]!=null).map(m=>({date:m.date,val:m.values[sel]})).sort((a,b)=>a.date.localeCompare(b.date));
  if(series.length<2)return;
  mkChart('ch-meas',{type:'line',data:{labels:series.map(s=>fmtShort(s.date+'T12:00:00')),datasets:[{data:series.map(s=>s.val),borderColor:cv('--gold'),backgroundColor:'transparent',tension:0.3,pointRadius:3,pointBackgroundColor:cv('--gold')}]},options:{...baseOpts(),plugins:{legend:{display:false}},scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}}}}});
}
function showLogMeasurements(){
  const meas=S.measurements||[];const cur=meas[0];const mUnit=S.measureUnit||'in';
  const ov=makeOv('meas-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div class="mt">Log Measurements (${mUnit})</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.5">Fill in any fields — blanks are skipped. Placeholders show your most recent value.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px">${MEAS_FIELDS.map(f=>`<div><label class="fl">${f.label}</label><input type="number" inputmode="decimal" id="m-${f.id}" placeholder="${cur&&cur.values&&cur.values[f.id]!=null?cur.values[f.id]:'–'}"></div>`).join('')}</div>
    <button class="btn btp bfw" onclick="saveMeasurements()">Save</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('meas-ov'))">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function saveMeasurements(){
  const vals={};MEAS_FIELDS.forEach(f=>{const el=document.getElementById(`m-${f.id}`);if(el&&el.value!=='')vals[f.id]=parseFloat(el.value);});
  if(!Object.keys(vals).length){toast('Enter at least one measurement');return;}
  S.measurements=[{date:today(),values:vals},...(S.measurements||[])];save();
  dismissOv(document.getElementById('meas-ov'));
  renderProgress(document.getElementById('content'));toast('Measurements saved','green');
}
function renderStandardsBody(){
  const levels=getStdLevels();
  return`<div>${levels.map(l=>{const lbl=l.level>0?STD_LABELS[l.level-1]:'No Data';const col=l.level>0?STD_COLORS[l.level-1]:'var(--muted2)';return`<div style="padding:10px 13px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><div style="font-size:13px;font-weight:600">${l.name}</div><div style="font-size:11px;font-weight:700;color:${col}">${lbl}</div></div><div style="display:flex;gap:2px;margin-bottom:4px">${STD_LABELS.map((_,i)=>`<div style="flex:1;height:5px;border-radius:2px;background:${i<l.level?STD_COLORS[i]:'var(--border)'}"></div>`).join('')}</div>${l.level>0?`<div style="font-size:10px;color:var(--muted)">${l.current}${S.unit} · Next: ${l.targets[l.level]?l.targets[l.level].toFixed(0)+S.unit:'Elite'}</div>`:''}</div>`;}).join('')}</div>`;
}
function renderWilksBody(){const w=getWilksData();if(!w)return`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('bolt',30)}</div><div class="etit" style="font-size:14px">Need squat, bench & deadlift PRs</div></div>`;return`<div class="sgrid"><div class="sc"><div class="sv">${w.wilks}</div><div class="slb">Wilks Score</div></div><div class="sc"><div class="sv">${w.dots}</div><div class="slb">DOTS Score</div></div><div class="sc"><div class="sv">${w.total.toFixed(0)}</div><div class="slb">Total ${S.unit}</div></div><div class="sc"><div class="sv">${S.bodyweight}</div><div class="slb">Bodyweight</div></div></div><div style="padding:11px 13px;font-size:10px;color:var(--muted)">Sq ${w.sq}${S.unit} · Bench ${w.bench}${S.unit} · DL ${w.dl}${S.unit}</div>`;}
function renderAFTBody(){
  const gn=S.aftGender||'male';const ag=aftAgeBracket();
  const scores=AFT_EVENTS.map(e=>({e,s:aftScore(e.id,S.aftCurrent[e.id],ag,gn)}));
  const validS=scores.filter(x=>x.s!==null);const total=validS.length===5?Math.round(validS.reduce((a,b)=>a+b.s,0)/5*100)/100:null;
  let html=`<div class="aft-total"><div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin-bottom:6px">Composite Score</div>
    <div style="font-size:40px;font-weight:500;font-family:'IBM Plex Mono',monospace;line-height:1">${total||'–'}</div>
    <div style="font-size:11px;opacity:.6;margin-top:4px">${validS.length}/5 events · ${gn==='male'?'Male':'Female'} · ${ag} (age ${userAge()})</div>
  </div>
  <div style="padding:8px 13px;display:flex;gap:7px;align-items:center;flex-wrap:wrap">
    <button class="btn ${gn==='male'?'btp':'bts'} bsm" onclick="S.aftGender='male';save();renderProgress(document.getElementById('content'))">Male</button>
    <button class="btn ${gn==='female'?'btp':'bts'} bsm" onclick="S.aftGender='female';save();renderProgress(document.getElementById('content'))">Female</button>
    <span style="font-size:10px;color:var(--muted);flex:1;min-width:120px">Bracket set from your birthday in Settings.</span>
  </div>`;
  AFT_EVENTS.forEach(e=>{
    const sc=aftScore(e.id,S.aftCurrent[e.id],ag,gn);const gsc=aftScore(e.id,S.aftGoals[e.id],ag,gn);
    const pct=sc?Math.min(100,Math.round((sc-55)/45*100)):0;
    html+=`<div class="aft-row"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><div style="font-size:13px;font-weight:600">${e.name}</div><div class="mono" style="font-size:13px;font-weight:600;color:var(--navy)">${sc||'–'} pts</div></div>
      <div class="aft-bar-track"><div class="aft-bar-fill" style="width:${pct}%;background:${sc>=90?'#fff':sc>=75?'rgba(255,255,255,.7)':'rgba(255,255,255,.4)'}"></div>${gsc?`<div class="aft-bar-goal" style="left:${Math.min(100,Math.round((gsc-55)/45*100))}%"></div>`:''}</div>
      <div style="display:flex;gap:8px;margin-top:5px">
        <input type="number" inputmode="decimal" value="${S.aftCurrent[e.id]||''}" placeholder="Current (${e.unit})" style="flex:1;font-size:12px;text-align:left;padding:5px 8px" onchange="S.aftCurrent['${e.id}']=this.value;save()">
        <input type="number" inputmode="decimal" value="${S.aftGoals[e.id]||''}" placeholder="Goal (${e.unit})" style="flex:1;font-size:12px;text-align:left;padding:5px 8px" onchange="S.aftGoals['${e.id}']=this.value;save()">
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:3px">${e.desc}</div>
    </div>`;
  });
  html+=`<div style="padding:10px 13px;display:flex;gap:8px"><button class="btn btp bsm" onclick="saveAFTHistory()">Save Snapshot</button>${S.aftHistory.length?`<button class="btn bts bsm" onclick="showAFTHistory()">History</button>`:''}</div>`;
  return html;
}
function saveAFTHistory(){const gn=S.aftGender||'male';const ag=aftAgeBracket();const valid=AFT_EVENTS.map(e=>aftScore(e.id,S.aftCurrent[e.id],ag,gn)).filter(s=>s!==null);if(!valid.length){toast('Enter at least one score');return;}const total=valid.length===5?Math.round(valid.reduce((a,b)=>a+b,0)/5*100)/100:null;S.aftHistory=[{date:today(),scores:JSON.parse(JSON.stringify(S.aftCurrent)),total},...(S.aftHistory||[])];save();toast('Snapshot saved!','green');}
function showAFTHistory(){const ov=makeOv('afth-ov');ov.innerHTML=`<div class="modal" style="max-height:75vh"><div class="mh"></div><div class="mt">AFT History</div>${S.aftHistory.map(h=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="display:flex;justify-content:space-between"><div style="font-size:13px;font-weight:600">${fmtShort(h.date+'T12:00:00')}</div><div class="mono" style="font-size:13px;font-weight:600;color:var(--navy)">${h.total||'–'}</div></div><div style="font-size:10px;color:var(--muted);margin-top:3px">${AFT_EVENTS.map(e=>`${e.id}: ${h.scores[e.id]||'–'}`).join(' · ')}</div></div>`).join('')}<button class="btn btg bfw" style="margin-top:12px" onclick="dismissOv(document.getElementById('afth-ov'))">Close</button></div>`;document.body.appendChild(ov);attachSwipeDown(ov);}
function renderConsistencyBody(){return`<div style="padding:10px 13px 4px"><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)"><span>12-Week Activity</span><span>Streak: ${getStreak()} days</span></div></div><div class="chart-wrap"><canvas id="ch-cons"></canvas></div>`;}
function renderConsistencyChart(){const data=getWeeklyActivity(12);mkChart('ch-cons',{type:'bar',data:{labels:Array.from({length:12},(_,i)=>`W-${11-i}`),datasets:[{data,backgroundColor:data.map(v=>v>0?cv('--ndim'):'transparent'),borderColor:data.map(v=>v>0?cv('--navy'):cv('--border')),borderWidth:1.5,borderRadius:4}]},options:{...baseOpts(),scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10},stepSize:1},grid:{color:cv('--border')},beginAtZero:true}}}});}
function renderRuckingBody(){const acts=S.activities.filter(a=>['ruck','run','hike','walk','bike','swim'].includes(a.type)).slice(0,10);if(!acts.length)return`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('backpack',30)}</div><div class="etit" style="font-size:14px">No cardio logged</div></div>`;const totalMi=acts.filter(a=>a.dist).reduce((t,a)=>t+(parseFloat(a.dist)||0),0);const totalCal=acts.reduce((t,a)=>t+(a.cals||0),0);return`<div class="sgrid"><div class="sc"><div class="sv">${acts.length}</div><div class="slb">Sessions</div></div><div class="sc"><div class="sv">${totalMi.toFixed(1)}</div><div class="slb">Miles</div></div><div class="sc"><div class="sv">${totalCal.toLocaleString()}</div><div class="slb">~kcal</div></div><div class="sc"><div class="sv">${acts.filter(a=>a.type==='ruck').length}</div><div class="slb">Rucks</div></div></div><div class="chart-wrap"><canvas id="ch-ruck"></canvas></div><div>${acts.map(a=>{const t=ACT_TYPES.find(x=>x.id===a.type)||{icon:'⚡',label:'Activity'};return`<div class="mvrow"><div class="act-icon" style="width:26px;height:26px;margin-right:9px;font-size:13px;color:var(--muted)">${ICON(t.icon,14)}</div><div class="mvname">${t.label}${a.dist?` · ${a.dist}mi`:''} · ${a.dur||'?'}min</div><div class="mono" style="font-size:11px;color:var(--muted)">${a.cals||0}kcal</div></div>`;}).join('')}</div>`;}
function renderRuckingChart(){const acts=S.activities.filter(a=>['ruck','run','hike','walk','bike','swim'].includes(a.type)).slice(0,8).reverse();if(acts.length<2)return;mkChart('ch-ruck',{type:'bar',data:{labels:acts.map(a=>fmtShort(a.date+'T12:00:00')),datasets:[{data:acts.map(a=>a.cals||0),backgroundColor:cv('--ndim'),borderColor:cv('--navy'),borderWidth:1.5,borderRadius:4}]},options:{...baseOpts(),plugins:{legend:{display:false}},scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')},beginAtZero:true}}}});}
function showRetroSteps(){const ov=makeOv('steps-ov');const cur=S.stepsLog[today()]||0;ov.innerHTML=`<div class="modal" style="max-height:250px"><div class="mh"></div><div class="mt">Log Steps</div><div class="fg"><label class="fl">Steps Today</label><input type="number" inputmode="numeric" id="step-inp" value="${cur||''}" placeholder="e.g. 8000"></div><button class="btn btp bfw" onclick="saveSteps()">Save</button><button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('steps-ov'))">Cancel</button></div>`;document.body.appendChild(ov);attachSwipeDown(ov);}
function saveSteps(){const v=parseInt(document.getElementById('step-inp')?.value);if(!isNaN(v)){S.stepsLog[today()]=v;save();dismissOv(document.getElementById('steps-ov'));render();}}
// ═══════════════════════════════════════════════════
