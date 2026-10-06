// ═══════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════
function showLogActivity(ds){
  const ov=makeOv('act-ov');const def=ds||today();
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Log Activity</div>
    <div class="fg"><label class="fl">Date</label><input type="date" id="act-date" value="${def}" max="${today()}"></div>
    <div class="fg"><label class="fl">Type</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
        ${ACT_TYPES.filter(t=>!t.hidden).map((t,i)=>`<button class="btn ${i===0?'btp':'bts'}" id="atype-${t.id}" onclick="selActType('${t.id}')" style="font-size:12px;gap:4px">${ICON(t.icon,15)} ${t.label}</button>`).join('')}
      </div>
    </div>
    <div id="act-fields"></div>
    <div class="fg"><label class="fl">Notes</label><textarea id="act-notes" style="min-height:48px;font-size:13px" placeholder="How did it go?"></textarea></div>
    <div id="act-cal-prev" style="font-size:12px;color:var(--green);font-weight:500;margin-bottom:12px;font-family:var(--mono)"></div>
    <button class="btn btp bfw" onclick="saveActivity()">Save Activity</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('act-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);window._actType='run';selActType('run');
}
function selActType(tid){
  window._actType=tid;
  document.querySelectorAll('[id^="atype-"]').forEach(b=>b.className=`btn ${b.id===`atype-${tid}`?'btp':'bts'}`);
  const t=ACT_TYPES.find(a=>a.id===tid);const el=document.getElementById('act-fields');if(!el||!t)return;
  let html='';
  if(t.fields.includes('dist'))html+=`<div class="fg"><label class="fl">Distance (miles)</label><input type="number" inputmode="decimal" id="act-dist" placeholder="0" oninput="updActCal()"></div>`;
  if(t.fields.includes('dur'))html+=`<div class="fg"><label class="fl">Duration (min)</label><input type="number" inputmode="numeric" id="act-dur" placeholder="0" oninput="updActCal()"></div>`;
  if(t.fields.includes('ruckWeight'))html+=`<div class="fg"><label class="fl">Ruck Weight (${S.unit})</label><input type="number" inputmode="decimal" id="act-rw" placeholder="0" oninput="updActCal()"></div>`;
  if(t.fields.includes('terrain'))html+=`<div class="fg"><label class="fl">Terrain</label><select id="act-terrain" onchange="updActCal()"><option value="flat">Flat</option><option value="hilly">Hilly (×1.3)</option><option value="trail">Trail (×1.2)</option><option value="mixed">Mixed (×1.15)</option></select></div>`;
  if(t.fields.includes('dist')&&t.fields.includes('dur')&&tid!=='ruck')html+=`<div style="font-size:12px;color:var(--muted);margin:-4px 0 12px;line-height:1.45">Enter distance, time, or both — I'll estimate the rest and the calories.</div>`;
  el.innerHTML=html;
}
function updActCal(){
  const type=window._actType;
  const act={type,dist:document.getElementById('act-dist')?.value,dur:document.getElementById('act-dur')?.value,ruckWeight:document.getElementById('act-rw')?.value,terrain:document.getElementById('act-terrain')?.value};
  const cals=activityCals(act);const el=document.getElementById('act-cal-prev');if(!el)return;
  const t=ACT_TYPES.find(a=>a.id===type)||{};
  const distCapable=(t.fields||[]).includes('dist');
  const d=parseFloat(act.dist)||0,m=parseFloat(act.dur)||0;
  let parts=[];
  if(distCapable&&!d&&m)parts.push(`~${estDistanceMi(type,m)} mi est`);
  if(distCapable&&d&&!m)parts.push(`~${estDurationMin(type,d)} min est`);
  if(d||m)parts.push(`~${cals} kcal`);
  el.textContent=parts.join(' · ');
}
function saveActivity(){
  const date=document.getElementById('act-date')?.value||today();
  const t=ACT_TYPES.find(a=>a.id===window._actType);
  const act={id:uid(),type:window._actType,date,dist:document.getElementById('act-dist')?.value||'',dur:document.getElementById('act-dur')?.value||'',ruckWeight:document.getElementById('act-rw')?.value||'',terrain:document.getElementById('act-terrain')?.value||'flat',notes:document.getElementById('act-notes')?.value||''};
  const distCapable=(t?.fields||[]).includes('dist');
  const d=parseFloat(act.dist)||0,m=parseFloat(act.dur)||0;
  if(distCapable&&!d&&!m){toast('Enter distance, time, or both');return;}
  if(!distCapable&&!m){toast('Enter a duration');return;}
  act.cals=activityCals(act);
  // Backfill whichever field was left blank with an estimate, so history/totals stay complete.
  if(distCapable&&!d&&m){act.dist=String(estDistanceMi(act.type,m));act.distEst=true;}
  if(distCapable&&d&&!m){act.dur=String(estDurationMin(act.type,d));act.durEst=true;}
  S.activities.unshift(act);save();
  closeOv('act-ov');toast('Activity logged!','green');render();
}
