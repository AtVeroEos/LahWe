// ═══════════════════════════════════════════════════
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
  c.innerHTML=html;if(Object.values(S.expandedCards).some(Boolean))setTimeout(()=>{try{renderCharts();}catch(e){logError(e,'charts');}},60);
}
function toggleCard(id){S.expandedCards[id]=!S.expandedCards[id];renderProgress(document.getElementById('content'));}
function getDashSub(id){
  if(id==='energy'){const eb=energyBalance(today());const net=eb.net;return`${net<=0?'−':'+'}${Math.abs(Math.round(net)).toLocaleString()} kcal so far today`;}
  if(id==='weekly'){const n=S.workouts.filter(w=>w.started>=Date.now()-7*86400000).length;return`${n} session${n!==1?'s':''} this week`;}
  if(id==='strength'){const n=getExsWithHist().length;return n?`${n} exercise${n===1?'':'s'} tracked`:'No history yet';}
  if(id==='prs'){const n=Object.keys(S.prs).length;return n?`${n} PR${n!==1?'s':''} recorded`:'None yet';}
  if(id==='volume'){const n=S.workouts.filter(w=>w.started>=Date.now()-7*86400000).reduce((t,wk)=>t+doneSetCnt(wk),0);return`${n} sets this week`;}
  if(id==='bodyweight'){const bwl=S.bodyweightLog||[];return bwl.length?`${bwl[0].weight}${S.unit} current`:'No logs yet';}
  if(id==='measurements'){const m=S.measurements||[];return m.length?`Last: ${fmtDay(m[0].date)}`:'No measurements yet';}
  if(id==='standards'){const lvs=getStdLevels();const p=lvs.filter(l=>l.level>0).length;return p?`${p}/${lvs.length} graded`:'No lift data yet';}
  if(id==='aft'){const a=aftSummary(S.aftCurrent);if(!a.n)return'No scores entered';return a.complete?`${a.total} / 500 · ${a.pass?'pass':'below standard'}`:`${a.total} pts from ${a.n}/5 events`;}
  if(id==='consistency'){const n=getStreak();return`${n}-session streak`;}
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
function energyDays(n){return Array.from({length:n},(_,i)=>daysAgoStr(n-1-i));}
function renderEnergyBody(){
  const td=today();const eb=energyBalance(td);
  const hasIntake=(getDayTotals(td).cals||0)>0;
  // Trend uses completed days only; today's balance is still moving.
  const logged=energyDays(15).filter(ds=>ds<td&&(getDayTotals(ds).cals||0)>0).map(ds=>energyBalance(ds));
  const last7=logged.slice(-7);
  const avg7=last7.length?Math.round(last7.reduce((t,n)=>t+n.net,0)/last7.length):null;
  const wkChg=avg7!=null?(avg7*7/kcalPerWeightUnit()):null;
  const netCol=eb.net<0?'var(--green)':eb.net>0?'var(--red)':'var(--muted)';
  let html=`<div class="sgrid">
    <div class="sc"><div class="sv">${eb.intake.toLocaleString()}</div><div class="slb">Intake kcal</div></div>
    <div class="sc"><div class="sv">${eb.burn.toLocaleString()}</div><div class="slb">Burned so far</div></div>
    <div class="sc"><div class="sv" style="color:${netCol}">${eb.net<0?'−':eb.net>0?'+':''}${Math.abs(Math.round(eb.net)).toLocaleString()}</div><div class="slb">Net so far</div></div>
    <div class="sc"><div class="sv" style="font-size:15px;color:${netCol}">${eb.net<0?'Deficit':eb.net>0?'Surplus':'Even'}</div><div class="slb">So far today</div></div>
  </div>
  <div style="padding:9px 13px;font-size:11px;color:var(--muted);line-height:1.5;border-bottom:1px solid var(--border)">Burned so far = ${eb.base.toLocaleString()} of your ${eb.fullBase.toLocaleString()} kcal daily baseline (the share of the day that has passed)${eb.exercise?` + ${eb.exercise.toLocaleString()} from exercise, counted above resting burn`:''}. Baseline from ${esc(S.height||69)} in · ${esc(S.bodyweight)} ${S.unit} · age ${userAge()} (Settings).</div>`;
  if(!hasIntake)html+=`<div style="padding:9px 13px;font-size:11px;color:var(--muted)">No intake logged today — add meals or Quick Log in Nutrition for an accurate balance.</div>`;
  html+=`<div class="chart-wrap"><canvas id="ch-energy"></canvas></div>`;
  if(avg7!=null)html+=`<div style="padding:8px 13px 10px;display:flex;justify-content:space-between;align-items:center;font-size:12px;border-top:1px solid var(--border)"><span style="color:var(--muted)">${last7.length}-day avg net: <strong style="color:${avg7<0?'var(--green)':avg7>0?'var(--red)':'var(--text)'}">${avg7<0?'−':avg7>0?'+':''}${Math.abs(avg7).toLocaleString()}</strong></span><span style="color:var(--muted)">Est. ${wkChg<0?'loss':wkChg>0?'gain':'change'}: <strong style="color:var(--text)">${Math.abs(wkChg).toFixed(1)} ${S.unit}/wk</strong></span></div>`;
  else html+=`<div style="padding:8px 13px 10px;font-size:11px;color:var(--muted)">Log a few full days of intake to see your trend and projected weekly change.</div>`;
  return html;
}
function renderEnergyChart(){
  const td=today();const days=energyDays(14);
  const data=days.map(ds=>{const lg=(getDayTotals(ds).cals||0)>0;return lg?Math.round(energyBalance(ds).net):null;});
  if(!data.some(v=>v!=null))return;
  // Today's bar is hollow: it is a running figure, not a finished day.
  const fill=(v,i)=>v==null?'transparent':days[i]===td?'transparent':v<0?cv('--grbright'):cv('--rdim');
  mkChart('ch-energy',{type:'bar',data:{labels:days.map(fmtDay),datasets:[{data,backgroundColor:data.map(fill),borderColor:data.map(v=>v==null?'transparent':v<0?cv('--green'):cv('--red')),borderWidth:1.5,borderRadius:4}]},options:{...baseOpts(),plugins:{legend:{display:false}},scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}}}}});
}
function renderWeeklyBody(){
  const ago7=Date.now()-7*86400000;const wks=S.workouts.filter(w=>w.started>=ago7);const acts=S.activities.filter(a=>dayDate(a.date).getTime()>ago7);
  const vol=Math.round(wks.reduce((t,wk)=>t+totalVol(wk),0));const cals=Math.round(wks.reduce((t,wk)=>t+(wk.cals||0),0)+acts.reduce((t,a)=>t+(a.cals||0),0));
  const steps=S.stepsLog[today()]||0;
  return`<div class="sgrid"><div class="sc"><div class="sv">${wks.length}</div><div class="slb">Workouts</div></div><div class="sc"><div class="sv">${acts.length}</div><div class="slb">Activities</div></div><div class="sc"><div class="sv">${vol.toLocaleString()}</div><div class="slb">Volume ${S.unit}</div></div><div class="sc"><div class="sv">${cals.toLocaleString()}</div><div class="slb">~kcal</div></div></div>
  <div class="chart-wrap"><canvas id="ch-weekly"></canvas></div>
  <div style="padding:8px 13px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border)"><div style="font-size:12px;color:var(--muted)">Today's Steps: <strong style="color:var(--text)">${steps.toLocaleString()}</strong></div><button class="btn bts bsm" onclick="showRetroSteps()">Update</button></div>`;
}
function renderWeeklyChart(){const data=getWeeklyActivity(10);mkChart('ch-weekly',{type:'bar',data:{labels:Array.from({length:10},(_,i)=>`W-${9-i}`),datasets:[{data,backgroundColor:cv('--ndim'),borderColor:cv('--navy'),borderWidth:1.5,borderRadius:4}]},options:{...baseOpts(),plugins:{legend:{display:false}}}});}
function renderStrengthBody(){
  const exs=getExsWithHist();if(!exs.length)return`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('trendup',30)}</div><div class="etit" style="font-size:14px">No history yet</div></div>`;
  const sel=exs.includes(S.progExId)?S.progExId:exs[0];
  const sorted=exs.slice().sort((a,b)=>exName(a).localeCompare(exName(b)));
  return`<div style="padding:10px 13px 0"><select id="prog-ex-sel" onchange="S.progExId=this.value;save();renderProgress(document.getElementById('content'))">${sorted.map(id=>`<option value="${esc(id)}"${id===sel?' selected':''}>${esc(exName(id))}</option>`).join('')}</select>
    <div style="font-size:10px;color:var(--muted2);margin-top:6px">Best estimated 1RM per session (${S.unit}). Warmups and excluded sets are ignored.</div></div><div class="chart-wrap"><canvas id="ch-str"></canvas></div>`;
}
function renderStrengthChart(){
  const exs=getExsWithHist();const exId=exs.includes(S.progExId)?S.progExId:exs[0];if(!exId)return;
  const data=getExStrData(exId);if(!data.length)return;
  mkChart('ch-str',{type:'line',data:{labels:data.map(d=>d.label),datasets:[{data:data.map(d=>d.e1rm),borderColor:cv('--navy'),backgroundColor:'transparent',tension:0.3,pointRadius:4,pointBackgroundColor:cv('--navy')}]},options:{...baseOpts(),plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>{const d=data[c.dataIndex];return`${d.e1rm} ${S.unit} e1RM (${d.w}×${d.r})`;}}}},scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}}}}});
}
function renderPRsBody(){
  const prs=Object.entries(S.prs).sort((a,b)=>b[1].est-a[1].est);
  if(!prs.length)return`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('trophy',30)}</div><div class="etit" style="font-size:14px">No PRs yet</div><p style="font-size:12px">Records come from the sets you log.</p></div>`;
  return`<div>${prs.map(([id,pr])=>`<div class="mvrow" style="cursor:pointer" onclick="showPRDetail(${jsq(id)})"><div class="mvname">${esc(exName(id))}${pr.manual?` <span class="badge ba" style="margin-left:4px">carried over</span>`:''}</div><div class="mono" style="font-size:13px;font-weight:600;color:var(--gold)">${pr.w}<span style="font-size:10px;opacity:.6"> ${S.unit}</span></div><div style="font-size:10px;color:var(--muted);margin-left:7px;min-width:26px">×${pr.r}</div><div class="mono" style="font-size:10px;color:var(--muted);margin-left:7px;min-width:48px;text-align:right">e1RM ${pr.est}</div></div>`).join('')}</div>
  <div style="padding:8px 13px;font-size:10px;color:var(--muted2);line-height:1.45">Ranked by estimated 1RM. Tap a record to see where it came from.</div>`;
}
function showPRDetail(exId){
  const pr=S.prs[exId];if(!pr)return;
  const wk=pr.wkId?S.workouts.find(w=>w.id===pr.wkId):null;
  const ov=makeOv('pr-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">${esc(exName(exId))}</div>
    <div style="background:var(--gdim);border:1px solid rgba(184,124,42,.22);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--gold)">Personal Record</div>
      <div style="font-size:22px;font-weight:700;letter-spacing:-.5px;color:var(--gold);margin-top:3px">${pr.w}${S.unit} × ${pr.r}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">Estimated 1RM ${pr.est}${S.unit}${pr.date?` · ${fmtDay(pr.date)}`:''}</div>
    </div>
    ${pr.manual?`<div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px">This record was carried over from an earlier version of the app and no logged workout accounts for it. If it came from a typo or a discarded session, remove it.</div>
      <button class="btn btd bfw" style="margin-bottom:8px" onclick="removeCarriedPR(${jsq(exId)})">Remove this record</button>`
    :wk?`<div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px">Set in <strong style="color:var(--text)">${esc(wk.name)}</strong> on ${fmtDate(wk.started)}. If the set was a typo, open the workout and tap the set to exclude it.</div>
      <button class="btn bts bfw" style="margin-bottom:8px" onclick="closeOv('pr-ov');setTimeout(()=>showWkDetail(${jsq(wk.id)}),240)">Open that workout</button>`
    :`<div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px">Set in the workout you are doing now.</div>`}
    <button class="btn btg bfw" onclick="closeOv('pr-ov')">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function removeCarriedPR(exId){
  delete S.prsManual[exId];rebuildPRs();save();closeOv('pr-ov');
  if(S.tab==='progress')renderProgress(document.getElementById('content'));
  toast('Record removed','green');
}
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
      <div style="font-size:8px;color:var(--muted);font-family:var(--mono)">${fmtSets(v)}</div>
      <div style="font-size:8px;color:var(--muted2)">${i===0?'now':'-'+i+'w'}</div>
    </div>`;
  }).reverse().join('');
  const ov=makeOv('musc-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div class="mt" style="margin-bottom:1px">${mm.lbl}</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:13px">${m}</div>
    <div style="display:flex;gap:10px;margin-bottom:13px">
      <div style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:11px;text-align:center"><div style="font-size:24px;font-weight:600;font-family:var(--mono);color:${col};line-height:1.1">${fmtSets(cur)}</div><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:3px">Sets this week</div></div>
      <div style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:11px;text-align:center"><div style="font-size:24px;font-weight:600;font-family:var(--mono);line-height:1.1">${mm.mev}–${mm.mav}</div><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:3px">Target range</div></div>
    </div>
    <div style="font-size:12px;font-weight:600;color:${col};margin-bottom:12px">${lbl}</div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted2);font-weight:700;margin-bottom:7px">6-week trend</div>
    <div style="display:flex;gap:5px;align-items:flex-end;margin-bottom:14px">${bars}</div>
    <button class="btn btg bfw" onclick="closeOv('musc-ov')">Close</button>
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
      <div style="font-size:22px;font-weight:600;font-family:var(--mono);color:${col};line-height:1.1">${fmtSets(s)}</div>
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
      <div style="text-align:center;font-size:11px;color:var(--muted2);font-family:var(--mono)">${w2?fmtSets(w2):'–'}</div>
      <div style="text-align:center;font-size:11px;color:var(--muted);font-family:var(--mono)">${w1?fmtSets(w1):'–'}</div>
      <div style="text-align:center;display:flex;align-items:center;justify-content:center;gap:3px">
        <span style="font-size:13px;font-weight:700;color:${col};font-family:var(--mono)">${w0?fmtSets(w0):'–'}</span>
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
    const within=(a,b)=>bwl.filter(e=>e.date>daysAgoStr(b)&&e.date<=daysAgoStr(a)); // whole calendar days, today included
    const avg=arr=>arr.length?arr.reduce((t,e)=>t+e.weight,0)/arr.length:null;
    const recent=avg(within(0,7));const prior=avg(within(7,14));
    const cur7=recent!=null?recent:bwl[0].weight;
    const rate=(recent!=null&&prior!=null)?(recent-prior):null;
    // Green means "moving the way you want": down when cutting, up when gaining. No goal set → no judgement.
    const want=S.weightGoalDir==='gain'?1:S.weightGoalDir==='lose'?-1:0;
    const rateCol=(rate==null||!want||Math.abs(rate)<0.05)?'var(--text)':(Math.sign(rate)===want?'var(--green)':'var(--red)');
    statsHtml=`<div class="sgrid" style="border-top:1px solid var(--border)">
      <div class="sc"><div class="sv">${cur7.toFixed(1)}</div><div class="slb">7-day avg ${S.unit}</div></div>
      <div class="sc"><div class="sv" style="color:${rateCol}">${rate==null?'—':(rate<0?'−':'+')+Math.abs(rate).toFixed(1)}</div><div class="slb">${S.unit}/week</div></div>
    </div>`;
  }
  return`<div style="padding:10px 13px">
    <div class="frow" style="margin-bottom:10px"><input type="number" inputmode="decimal" id="bw-inp" placeholder="${esc(S.bodyweight)}" style="flex:1;text-align:left"><button class="btn btp bsm" style="flex-shrink:0" onclick="logBW()">Log</button></div>
  </div>${bwl.length>=2?`<div class="chart-wrap"><canvas id="ch-bw"></canvas></div>`:`<div style="padding:0 13px 14px;font-size:12px;color:var(--muted)">Log your weight on two different days to see the trend.</div>`}
  ${statsHtml}
  ${bwl.length>=2?`<div style="padding:6px 13px 10px;display:flex;justify-content:space-between;font-size:11px;color:var(--muted)"><span>Low: ${Math.min(...bwl.map(b=>b.weight))} ${S.unit}</span><span>High: ${Math.max(...bwl.map(b=>b.weight))} ${S.unit}</span></div>`:''}`;
}
// One bodyweight entry per day (a second weigh-in replaces the first), kept newest-first.
function logBodyweight(v,ds){
  v=parseFloat(v);if(!(v>0))return false;
  ds=ds||today();
  const i=S.bodyweightLog.findIndex(b=>b.date===ds);
  if(i>=0)S.bodyweightLog[i].weight=v;else S.bodyweightLog.push({date:ds,weight:v});
  S.bodyweightLog.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  S.bodyweight=S.bodyweightLog[0].weight;
  return true;
}
function logBW(){const v=parseFloat(document.getElementById('bw-inp')?.value);if(!logBodyweight(v)){toast('Enter a weight');return;}save();renderProgress(document.getElementById('content'));}
function renderBodyweightChart(){const bwl=(S.bodyweightLog||[]).slice().reverse().slice(-20);if(bwl.length<2)return;mkChart('ch-bw',{type:'line',data:{labels:bwl.map(b=>fmtDay(b.date)),datasets:[{data:bwl.map(b=>b.weight),borderColor:cv('--navy'),backgroundColor:'transparent',tension:0.3,pointRadius:3,pointBackgroundColor:cv('--navy')}]},options:{...baseOpts(),plugins:{legend:{display:false}},scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}}}}});}
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
    <div class="sc"><div class="sv">${latest.val}<span style="font-size:10px;color:var(--muted2)"> ${mUnit}</span></div><div class="slb">Latest · ${fmtDay(latest.date)}</div></div>
    <div class="sc"><div class="sv"${totalChg!=null?` style="color:${totalChg<0?'var(--green)':totalChg>0?'var(--blue)':'var(--text)'}"`:''}>${totalChg==null?'—':(totalChg<0?'−':'+')+Math.abs(totalChg).toFixed(1)}</div><div class="slb">Since ${fmtDay(first.date)}</div></div>
  </div>`;
  if(series.length>=2)html+=`<div class="chart-wrap"><canvas id="ch-meas"></canvas></div>`;
  const histDesc=series.slice().reverse();
  html+=`<div style="border-top:1px solid var(--border)">${histDesc.map((pt,i)=>{const earlier=histDesc[i+1];const chg=earlier?(pt.val-earlier.val):null;return`<div class="mvrow"><div class="mvname" style="color:var(--muted)">${fmtDay(pt.date)}</div><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600;font-family:var(--mono)">${pt.val}<span style="font-size:9px;color:var(--muted2)"> ${mUnit}</span></span>${chg!=null&&chg!==0?`<span class="meas-chg" style="color:var(--muted)">${chg<0?'▾':'▴'} ${Math.abs(chg).toFixed(1)}</span>`:''}</div></div>`;}).join('')}</div>`;
  return html;
}
function setMeasUnit(u){S.measureUnit=u;save();renderProgress(document.getElementById('content'));}
function renderMeasurementsChart(){
  const meas=S.measurements||[];const tracked=MEAS_FIELDS.filter(f=>meas.some(m=>m.values&&m.values[f.id]!=null));if(!tracked.length)return;
  const sel=(S.measPart&&tracked.find(f=>f.id===S.measPart))?S.measPart:tracked[0].id;
  const series=meas.filter(m=>m.values&&m.values[sel]!=null).map(m=>({date:m.date,val:m.values[sel]})).sort((a,b)=>a.date.localeCompare(b.date));
  if(series.length<2)return;
  mkChart('ch-meas',{type:'line',data:{labels:series.map(s=>fmtDay(s.date)),datasets:[{data:series.map(s=>s.val),borderColor:cv('--gold'),backgroundColor:'transparent',tension:0.3,pointRadius:3,pointBackgroundColor:cv('--gold')}]},options:{...baseOpts(),plugins:{legend:{display:false}},scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}}}}});
}
function showLogMeasurements(){
  const meas=S.measurements||[];const cur=meas[0];const mUnit=S.measureUnit||'in';
  const ov=makeOv('meas-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div class="mt">Log Measurements (${mUnit})</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.5">Fill in any fields — blanks are skipped. Placeholders show your most recent value.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px">${MEAS_FIELDS.map(f=>`<div><label class="fl">${f.label}</label><input type="number" inputmode="decimal" id="m-${f.id}" placeholder="${cur&&cur.values&&cur.values[f.id]!=null?cur.values[f.id]:'–'}"></div>`).join('')}</div>
    <button class="btn btp bfw" onclick="saveMeasurements()">Save</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('meas-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function saveMeasurements(){
  const vals={};MEAS_FIELDS.forEach(f=>{const el=document.getElementById(`m-${f.id}`);if(el&&el.value!=='')vals[f.id]=parseFloat(el.value);});
  if(!Object.keys(vals).length){toast('Enter at least one measurement');return;}
  S.measurements=[{date:today(),values:vals},...(S.measurements||[])];save();
  closeOv('meas-ov');
  renderProgress(document.getElementById('content'));toast('Measurements saved','green');
}
function renderStandardsBody(){
  const levels=getStdLevels();
  return`<div>${levels.map(l=>{const lbl=l.level>0?STD_LABELS[l.level-1]:(l.current?'Untrained':'No Data');const col=l.level>0?STD_COLORS[l.level-1]:'var(--muted2)';return`<div style="padding:10px 13px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><div style="font-size:13px;font-weight:600">${l.name}</div><div style="font-size:11px;font-weight:700;color:${col}">${lbl}</div></div><div style="display:flex;gap:2px;margin-bottom:4px">${STD_LABELS.map((_,i)=>`<div style="flex:1;height:5px;border-radius:2px;background:${i<l.level?STD_COLORS[i]:'var(--border)'}"></div>`).join('')}</div>${l.current?`<div style="font-size:10px;color:var(--muted)">est. 1RM ${l.current}${S.unit} · Next: ${l.targets[l.level]?Math.ceil(l.targets[l.level])+S.unit:'top tier reached'}</div>`:''}</div>`;}).join('')}</div>
  <div style="padding:8px 13px;font-size:10px;color:var(--muted2);line-height:1.45">Graded on estimated 1RM against multiples of your bodyweight (${esc(S.bodyweight)} ${S.unit}).</div>`;
}
function renderWilksBody(){
  const w=getWilksData();
  if(!w)return`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('bolt',30)}</div><div class="etit" style="font-size:14px">Need a squat, bench &amp; deadlift on record</div><p style="font-size:12px">Barbell back squat (or front squat), barbell bench press, and deadlift (or sumo).</p></div>`;
  return`<div class="sgrid"><div class="sc"><div class="sv">${w.wilks}</div><div class="slb">Wilks Score</div></div><div class="sc"><div class="sv">${w.dots}</div><div class="slb">DOTS Score</div></div><div class="sc"><div class="sv">${Math.round(w.total)}</div><div class="slb">Est. total ${S.unit}</div></div><div class="sc"><div class="sv">${esc(S.bodyweight)}</div><div class="slb">Bodyweight</div></div></div>
  <div style="padding:11px 13px;font-size:10px;color:var(--muted);line-height:1.5">Estimated 1RMs — ${w.sqSub?'Front squat':'Squat'} ${w.sq}${S.unit} · Bench ${w.bench}${S.unit} · ${w.dlSub?'Sumo deadlift':'Deadlift'} ${w.dl}${S.unit}.${w.sqSub?' A front squat is standing in for the back squat, so this total runs low.':''} These are estimates from rep PRs, not competition lifts.</div>`;
}
// Time events are entered as minutes + seconds and stored as seconds.
function aftTimeInputs(kind,ev,val){
  const v=parseFloat(val);const has=!isNaN(v)&&val!=='';
  const m=has?Math.floor(v/60):'';const s=has?Math.round(v%60):'';
  return`<div class="aft-time"><input type="number" inputmode="numeric" id="aft-${kind}-${ev}-m" value="${m}" placeholder="min" onchange="setAftTime('${kind}','${ev}')"><span>:</span><input type="number" inputmode="numeric" id="aft-${kind}-${ev}-s" value="${has?pad2(s):''}" placeholder="sec" onchange="setAftTime('${kind}','${ev}')"></div>`;
}
function aftEventMeta(e,col){
  const lo=aftNeed(e.id,60,col),hi=aftNeed(e.id,100,col);
  return`${e.desc} · 60 pts: ${aftFmtRaw(e.id,lo)} · 100 pts: ${aftFmtRaw(e.id,hi)}`;
}
function aftVerdictHTML(a){
  if(!a.n)return'Enter your results below';
  if(!a.complete)return`${a.n}/5 events entered`;
  if(a.pass)return`<strong>PASS</strong> · needs ${a.need} total and 60 in every event`;
  const why=a.minEv<60?'an event is under 60':`total is under ${a.need}`;
  return`<strong>BELOW STANDARD</strong> · ${why}`;
}
function renderAFTBody(){
  const gn=S.aftGender||'male';const combat=aftIsCombat();const col=aftColumn();
  const a=aftSummary(S.aftCurrent,col);
  const tog=(on,label,js)=>`<button class="btn ${on?'btp':'bts'} bsm" onclick="${js}">${label}</button>`;
  let html=`<div class="aft-total"><div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin-bottom:6px">Total Score</div>
    <div style="font-size:40px;font-weight:500;font-family:var(--mono);line-height:1"><span id="aft-total">${a.n?a.total:'–'}</span><span style="font-size:15px;opacity:.55"> / 500</span></div>
    <div id="aft-verdict" style="font-size:12px;opacity:.85;margin-top:6px">${aftVerdictHTML(a)}</div>
    <div style="font-size:11px;opacity:.6;margin-top:4px">${combat?'Combat standard (sex-neutral)':(gn==='male'?'Male':'Female')} · age group ${aftAgeBracket()} (age ${userAge()})</div>
  </div>
  <div style="padding:8px 13px 4px;display:grid;grid-template-columns:1fr 1fr;gap:7px">
    ${tog(!combat,'General · 300',"setAftStandard('general')")}${tog(combat,'Combat · 350',"setAftStandard('combat')")}
    ${combat?'':tog(gn==='male','Male',"setAftGender('male')")+tog(gn==='female','Female',"setAftGender('female')")}
  </div>
  <div style="padding:2px 13px 8px;font-size:10px;color:var(--muted);line-height:1.45">${combat?'The combat standard applies to the designated combat MOSs. It is scored on one table for everyone and needs 350 total with 60 in each event.':'The general standard is scored by age and sex and needs 300 total with 60 in each event.'} Age group comes from your birthday in Settings.</div>`;
  AFT_EVENTS.forEach(e=>{
    const sc=a.scores[e.id];const gsc=aftScore(e.id,S.aftGoals[e.id],col);
    const time=e.unit==='time';
    html+=`<div class="aft-row"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><div style="font-size:13px;font-weight:600">${e.name}</div><div class="mono" style="font-size:13px;font-weight:600;color:var(--navy)"><span id="aft-pts-${e.id}">${sc==null?'–':sc}</span> pts</div></div>
      <div class="aft-bar-track"><div class="aft-bar-fill" id="aft-bar-${e.id}" style="width:${sc||0}%;background:${sc==null?'transparent':sc>=60?'var(--green)':'var(--red)'}"></div><div class="aft-bar-min"></div>${gsc?`<div class="aft-bar-goal" style="left:${gsc}%"></div>`:''}</div>
      <div style="display:flex;gap:10px;margin-top:7px">
        <div style="flex:1"><div class="rtn-lbl" style="margin-bottom:3px">Current${time?'':` (${e.unit})`}</div>${time?aftTimeInputs('cur',e.id,S.aftCurrent[e.id]):`<input type="number" inputmode="decimal" value="${esc(S.aftCurrent[e.id]||'')}" placeholder="–" class="aft-inp" onchange="setAftVal('cur','${e.id}',this.value)">`}</div>
        <div style="flex:1"><div class="rtn-lbl" style="margin-bottom:3px">Goal${time?'':` (${e.unit})`}</div>${time?aftTimeInputs('goal',e.id,S.aftGoals[e.id]):`<input type="number" inputmode="decimal" value="${esc(S.aftGoals[e.id]||'')}" placeholder="–" class="aft-inp" onchange="setAftVal('goal','${e.id}',this.value)">`}</div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:5px">${aftEventMeta(e,col)}</div>
    </div>`;
  });
  html+=`<div style="padding:10px 13px;display:flex;gap:8px"><button class="btn btp bsm" onclick="saveAFTHistory()">Save Snapshot</button>${S.aftHistory.length?`<button class="btn bts bsm" onclick="showAFTHistory()">History</button>`:''}</div>
  <div style="padding:0 13px 10px;font-size:10px;color:var(--muted2);line-height:1.45">Scored from the Army's AFT score tables (effective 1 June 2025). A result between two rows earns the lower row.</div>`;
  return html;
}
function setAftStandard(v){S.aftStandard=v;save();renderProgress(document.getElementById('content'));}
function setAftGender(v){S.aftGender=v;save();renderProgress(document.getElementById('content'));}
function setAftVal(kind,ev,v){(kind==='goal'?S.aftGoals:S.aftCurrent)[ev]=v;save();refreshAft();}
function setAftTime(kind,ev){
  const m=document.getElementById(`aft-${kind}-${ev}-m`)?.value,s=document.getElementById(`aft-${kind}-${ev}-s`)?.value;
  const blank=(m===''||m==null)&&(s===''||s==null);
  setAftVal(kind,ev,blank?'':String((parseInt(m)||0)*60+(parseInt(s)||0)));
}
// Update the scores in place so typing in the next field isn't interrupted by a redraw.
function refreshAft(){
  const a=aftSummary(S.aftCurrent);
  AFT_EVENTS.forEach(e=>{
    const sc=a.scores[e.id];
    const p=document.getElementById('aft-pts-'+e.id);if(p)p.textContent=sc==null?'–':sc;
    const b=document.getElementById('aft-bar-'+e.id);if(b){b.style.width=(sc||0)+'%';b.style.background=sc==null?'transparent':sc>=60?'var(--green)':'var(--red)';}
  });
  const t=document.getElementById('aft-total');if(t)t.textContent=a.n?a.total:'–';
  const v=document.getElementById('aft-verdict');if(v)v.innerHTML=aftVerdictHTML(a);
}
function saveAFTHistory(){
  const col=aftColumn();const a=aftSummary(S.aftCurrent,col);
  if(!a.n){toast('Enter at least one result');return;}
  S.aftHistory=[{date:today(),scores:Object.assign({},S.aftCurrent),pts:a.scores,total:a.total,complete:a.complete,pass:a.pass,std:aftIsCombat()?'combat':'general',col},...(S.aftHistory||[])];
  save();toast('Snapshot saved!','green');renderProgress(document.getElementById('content'));
}
function showAFTHistory(){
  const ov=makeOv('afth-ov');
  ov.innerHTML=`<div class="modal" style="max-height:75vh"><div class="mh"></div><div class="mt">AFT History</div>${S.aftHistory.map(h=>{
    // Snapshots saved before the official tables were added are re-scored from their raw results.
    const a=h.pts?{total:h.total,complete:h.complete,pass:h.pass,scores:h.pts}:aftSummary(h.scores||{});
    return`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="display:flex;justify-content:space-between"><div style="font-size:13px;font-weight:600">${fmtDay(h.date)}${h.std==='combat'?' · combat':''}</div><div class="mono" style="font-size:13px;font-weight:600;color:${a.complete?(a.pass?'var(--green)':'var(--red)'):'var(--navy)'}">${a.total}${a.complete?' / 500':' pts'}</div></div><div style="font-size:10px;color:var(--muted);margin-top:3px">${AFT_EVENTS.map(e=>`${e.id} ${aftFmtRaw(e.id,(h.scores||{})[e.id])}${a.scores&&a.scores[e.id]!=null?` (${a.scores[e.id]})`:''}`).join(' · ')}</div></div>`;}).join('')}<button class="btn btg bfw" style="margin-top:12px" onclick="closeOv('afth-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function renderConsistencyBody(){return`<div style="padding:10px 13px 4px"><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)"><span>12-Week Activity</span><span>Streak: ${getStreak()} session${getStreak()===1?'':'s'}</span></div><div style="font-size:10px;color:var(--muted2);margin-top:4px">${hasFixedSchedule()?'Counts training days in a row without missing a planned one. Rest days don’t break it.':'Counts training days with no more than two idle days between them.'}</div></div><div class="chart-wrap"><canvas id="ch-cons"></canvas></div>`;}
function renderConsistencyChart(){const data=getWeeklyActivity(12);mkChart('ch-cons',{type:'bar',data:{labels:Array.from({length:12},(_,i)=>`W-${11-i}`),datasets:[{data,backgroundColor:data.map(v=>v>0?cv('--ndim'):'transparent'),borderColor:data.map(v=>v>0?cv('--navy'):cv('--border')),borderWidth:1.5,borderRadius:4}]},options:{...baseOpts(),scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10},stepSize:1},grid:{color:cv('--border')},beginAtZero:true}}}});}
function renderRuckingBody(){const acts=S.activities.filter(a=>['ruck','run','hike','walk','bike','swim'].includes(a.type)).slice(0,10);if(!acts.length)return`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('backpack',30)}</div><div class="etit" style="font-size:14px">No cardio logged</div></div>`;const totalMi=acts.filter(a=>a.dist).reduce((t,a)=>t+(parseFloat(a.dist)||0),0);const totalCal=acts.reduce((t,a)=>t+(a.cals||0),0);return`<div class="sgrid"><div class="sc"><div class="sv">${acts.length}</div><div class="slb">Sessions</div></div><div class="sc"><div class="sv">${totalMi.toFixed(1)}</div><div class="slb">Miles</div></div><div class="sc"><div class="sv">${totalCal.toLocaleString()}</div><div class="slb">~kcal</div></div><div class="sc"><div class="sv">${acts.filter(a=>a.type==='ruck').length}</div><div class="slb">Rucks</div></div></div><div class="chart-wrap"><canvas id="ch-ruck"></canvas></div><div>${acts.map(a=>{const t=ACT_TYPES.find(x=>x.id===a.type)||{icon:'⚡',label:'Activity'};return`<div class="mvrow"><div class="act-icon" style="width:26px;height:26px;margin-right:9px;font-size:13px;color:var(--muted)">${ICON(t.icon,14)}</div><div class="mvname">${t.label}${a.dist?` · ${a.dist}mi`:''} · ${a.dur||'?'}min</div><div class="mono" style="font-size:11px;color:var(--muted)">${a.cals||0}kcal</div></div>`;}).join('')}</div>`;}
function renderRuckingChart(){const acts=S.activities.filter(a=>['ruck','run','hike','walk','bike','swim'].includes(a.type)).slice(0,8).reverse();if(acts.length<2)return;mkChart('ch-ruck',{type:'bar',data:{labels:acts.map(a=>fmtDay(a.date)),datasets:[{data:acts.map(a=>a.cals||0),backgroundColor:cv('--ndim'),borderColor:cv('--navy'),borderWidth:1.5,borderRadius:4}]},options:{...baseOpts(),plugins:{legend:{display:false}},scales:{x:{ticks:{color:cv('--muted'),font:{size:9}},grid:{display:false}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')},beginAtZero:true}}}});}
function showRetroSteps(){const ov=makeOv('steps-ov');const cur=S.stepsLog[today()]||0;ov.innerHTML=`<div class="modal" style="max-height:250px"><div class="mh"></div><div class="mt">Log Steps</div><div class="fg"><label class="fl">Steps Today</label><input type="number" inputmode="numeric" id="step-inp" value="${cur||''}" placeholder="e.g. 8000"></div><button class="btn btp bfw" onclick="saveSteps()">Save</button><button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('steps-ov')">Cancel</button></div>`;document.body.appendChild(ov);attachSwipeDown(ov);}
function saveSteps(){const v=parseInt(document.getElementById('step-inp')?.value);if(!isNaN(v)){S.stepsLog[today()]=v;save();closeOv('steps-ov');render();}}
