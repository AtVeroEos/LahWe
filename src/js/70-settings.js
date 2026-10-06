// SETTINGS
// ═══════════════════════════════════════════════════
function showSettings(){
  const ov=makeOv('set-ov');
  ov.innerHTML=`<div class="modal" style="max-height:95vh"><div class="mh"></div><div class="mt">Settings</div>
    <div class="fg"><label class="fl">Name</label><input id="set-name" value="${S.name||''}"></div>
    <div class="frow" style="gap:10px;margin-bottom:14px">
      <div style="flex:1"><label class="fl">Bodyweight (${S.unit})</label><input type="number" inputmode="decimal" id="set-bw" value="${S.bodyweight||''}"></div>
      <div style="flex:1"><label class="fl">Height (in)</label><input type="number" inputmode="decimal" id="set-height" value="${S.height||''}" placeholder="69"></div>
    </div>
    <div class="frow" style="gap:10px;margin-bottom:14px">
      <div style="flex:1.4"><label class="fl">Birth Month</label><select id="set-bmonth"><option value="">—</option>${MONTHS.map((m,i)=>`<option value="${i+1}"${S.birthMonth==i+1?' selected':''}>${m}</option>`).join('')}</select></div>
      <div style="flex:1"><label class="fl">Birth Year</label><input type="number" inputmode="numeric" id="set-byear" value="${S.birthYear||''}" placeholder="1990"></div>
    </div>
    <div class="fg"><label class="fl">Goal</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px" id="set-goals">
        ${GOALS.map(g=>`<button class="btn ${S.goal===g.id?'btp':'bts'}" id="sg-${g.id}" onclick="setGoal('${g.id}')" style="font-size:11px;text-align:left;justify-content:flex-start;gap:6px;padding:9px 10px">${ICON(g.icon,15)} ${g.label}</button>`).join('')}
      </div>
    </div>
    <div class="fg"><label class="fl">Weight Unit</label>
      <div class="frow">
        <button id="set-lbs" class="btn ${S.unit==='lbs'?'btp':'bts'} bfw" onclick="setUnit('lbs')">lbs</button>
        <button id="set-kg" class="btn ${S.unit==='kg'?'btp':'bts'} bfw" onclick="setUnit('kg')">kg</button>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:14px;margin-bottom:12px">
      <label class="fl" style="margin-bottom:6px">Training Schedule</label>
      <div style="font-size:12px;color:var(--muted);line-height:1.55">Your schedule now lives with your routine group. Open <strong style="color:var(--text)">Library → Groups</strong> and pick a Day Picker group to set training days, or a Rotating group to cycle A / B / C. The calendar follows your active group.</div>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:2px">
      <label class="fl">App</label>
      <div class="frow" style="margin-bottom:10px">
        <span style="font-size:13px;font-weight:500;flex:1">Dark Mode</span>
        <button class="tog${S.darkMode?' on':''}" id="dm-tog" onclick="toggleDark()"></button>
      </div>
      <div style="margin-bottom:4px"><span style="font-size:13px;font-weight:500">App Color</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;padding:6px 0 2px">
        ${THEMES.map(t=>`<div class="color-swatch${S.primaryColor===t.id?' on':''}" title="${t.label}"
          style="background:${t.light[0]}"
          onclick="setPrimaryColor('${t.id}')"></div>`).join('')}
      </div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:14px;margin-bottom:12px">
      <label class="fl" style="margin-bottom:10px">Data</label>
      <div class="frow">
        <button class="btn bts bfw" onclick="exportData()">⬇ Export</button>
        <button class="btn bts bfw" onclick="importData()">⬆ Import</button>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px;line-height:1.5">Export saves all your data as a JSON file. Import loads a backup — your current data will be replaced.</div>
    </div>
    <button class="btn btp bfw" onclick="saveSettings()">Save</button>
    <button class="btn btd bfw" style="margin-top:10px" onclick="confirmReset()">Reset All Data</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('set-ov'))">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function setGoal(id){S.goal=id;document.querySelectorAll('[id^="sg-"]').forEach(b=>{b.className=`btn ${b.id===`sg-${id}`?'btp':'bts'}`;b.style.cssText='font-size:11px;text-align:left;justify-content:flex-start;gap:6px;padding:9px 10px';});save();}
function setUnit(u){S.unit=u;['lbs','kg'].forEach(x=>{const el=document.getElementById(`set-${x}`);if(el)el.className=`btn ${x===u?'btp':'bts'} bfw`;});save();}
function saveSettings(){
  const n=document.getElementById('set-name')?.value?.trim();if(n)S.name=n;
  const bw=parseFloat(document.getElementById('set-bw')?.value);
  if(bw&&!isNaN(bw)){S.bodyweight=bw;S.bodyweightLog=[{date:today(),weight:bw},...(S.bodyweightLog||[])];}
  const ht=parseFloat(document.getElementById('set-height')?.value);
  if(ht&&!isNaN(ht))S.height=ht;
  const bm=document.getElementById('set-bmonth')?.value;const by=parseInt(document.getElementById('set-byear')?.value);
  S.birthMonth=bm?parseInt(bm):null;
  S.birthYear=(by&&by>1900&&by<new Date().getFullYear())?by:null;
  save();dismissOv(document.getElementById('set-ov'));toast('Saved!','green');render();
}
function confirmReset(){customConfirm('All workouts, PRs, and settings will be permanently deleted.','Reset everything',()=>{initState();save();document.getElementById('set-ov')?.remove();render();});}
function exportData(){
  const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=`lahwe-backup-${today()}.json`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  toast('Data exported!','green');
}
function importData(){
  const inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.onchange=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(typeof data!=='object'||(!data.workouts&&!data.routines))throw new Error('Invalid');
        S=data;
        if(!S.schedule)S.schedule={type:'weekly',weeklyDays:[1,2,4,5],cycleOn:2,cycleOff:1,cycleStart:today(),overrides:{},routineOverrides:{}};
        if(!S.schedule.routineOverrides)S.schedule.routineOverrides={};
        if(!S.meals)S.meals=[];
        if(!S.customFoods)S.customFoods=[];
        if(!S.savedMeals)S.savedMeals=[];
        if(!S.starredFoods)S.starredFoods=[];
        if(!S.recentFoods)S.recentFoods=[];
        if(!S.recentSavedMeals)S.recentSavedMeals=[];
        if(!S.foodCache)S.foodCache={};
        if(S.weightGoal===undefined)S.weightGoal=null;
        if(S.weightGoalDir===undefined)S.weightGoalDir=null;
        if(S.program===undefined)S.program=null;
        resolveProgramGroup();
        save();applyDark();
        document.getElementById('set-ov')?.remove();
        render();toast('Data imported!','green');
      }catch(err){toast('Invalid backup file');}
    };
    reader.readAsText(file);
  };
  inp.click();
}

// ═══════════════════════════════════════════════════
