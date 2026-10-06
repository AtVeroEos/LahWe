// ONBOARDING
// ═══════════════════════════════════════════════════
function renderOnboarding(c){
  document.getElementById('nav').style.display='none';
  c.style.paddingBottom='0';
  c.innerHTML=`<div style="min-height:100vh;display:flex;flex-direction:column;padding:40px 20px 32px;background:var(--bg)">
    <div style="margin-bottom:34px">
      <div style="font-size:36px;font-weight:700;letter-spacing:-.8px;color:var(--navy)">Lah We</div>
      <div style="font-size:14px;color:var(--muted);margin-top:6px">Built for athletes who take data seriously.</div>
    </div>
    <div class="fg"><label class="fl">Your Name</label><input type="text" id="ob-name" placeholder="First name" autocomplete="given-name" style="font-size:18px"></div>
    <div class="fg"><label class="fl">Primary Goal</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px" id="ob-goals">
        ${GOALS.map(g=>`<div class="eq-preset" id="gc-${g.id}" onclick="obGoal('${g.id}')"><div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:11px;background:var(--bg2);color:var(--navy);flex-shrink:0">${ICON(g.icon,19)}</div><div><div style="font-size:12px;font-weight:600">${g.label}</div><div style="font-size:10px;color:var(--muted);margin-top:2px">${g.sub}</div></div></div>`).join('')}
      </div>
    </div>
    <div class="fg"><label class="fl">Weight Unit</label>
      <div class="frow">
        <button id="ob-lbs" class="btn btp bfw" onclick="obUnit('lbs')">lbs</button>
        <button id="ob-kg" class="btn bts bfw" onclick="obUnit('kg')">kg</button>
      </div>
    </div>
    <div class="frow" style="gap:10px;margin-bottom:14px">
      <div style="flex:1"><label class="fl">Bodyweight (<span id="ob-ul">lbs</span>)</label><input type="number" inputmode="decimal" id="ob-bw" placeholder="185"></div>
      <div style="flex:1"><label class="fl">Height (in)</label><input type="number" inputmode="decimal" id="ob-height" placeholder="69"></div>
    </div>
    <div class="frow" style="gap:10px;margin-bottom:14px">
      <div style="flex:1.4"><label class="fl">Birth Month</label><select id="ob-bmonth"><option value="">—</option>${MONTHS.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select></div>
      <div style="flex:1"><label class="fl">Birth Year</label><input type="number" inputmode="numeric" id="ob-byear" placeholder="1990"></div>
    </div>
    <div class="fg"><label class="fl">App Color</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;padding:4px 0 2px">
        ${THEMES.map(t=>`<div class="color-swatch${(S.primaryColor||'navy')===t.id?' on':''}" title="${t.label}" style="background:${t.light[0]}" onclick="setPrimaryColor('${t.id}')"></div>`).join('')}
      </div>
    </div>
    <div style="margin-top:auto;padding-top:16px">
      <button class="btn btp bfw" style="padding:15px;font-size:16px;border-radius:12px" onclick="finishOb()">Get Started →</button>
    </div>
  </div>`;
  window._obGoal='general';window._obUnit='lbs';obGoal('general');
}
function obGoal(id){window._obGoal=id;document.querySelectorAll('.eq-preset[id^="gc-"]').forEach(el=>el.classList.toggle('on',el.id===`gc-${id}`));}
function obUnit(u){
  window._obUnit=u;
  ['lbs','kg'].forEach(x=>{const el=document.getElementById(`ob-${x}`);if(el)el.className=`btn ${x===u?'btp':'bts'} bfw`;});
  const ul=document.getElementById('ob-ul');if(ul)ul.textContent=u;
}
function finishOb(){
  const name=document.getElementById('ob-name')?.value?.trim();
  if(!name){toast('Enter your name');return;}
  S.name=name;S.goal=window._obGoal||'general';S.unit=window._obUnit||'lbs';
  const bw=parseFloat(document.getElementById('ob-bw')?.value);
  if(bw&&!isNaN(bw)){S.bodyweight=bw;S.bodyweightLog=[{date:today(),weight:bw}];}
  const ht=parseFloat(document.getElementById('ob-height')?.value);
  if(ht&&!isNaN(ht))S.height=ht;
  const bm=document.getElementById('ob-bmonth')?.value;const by=parseInt(document.getElementById('ob-byear')?.value);
  if(bm)S.birthMonth=parseInt(bm);
  if(by&&by>1900&&by<new Date().getFullYear())S.birthYear=by;
  S.onboarded=true;save();
  document.getElementById('nav').style.display='flex';
  document.getElementById('content').style.paddingBottom='';
  render();
}
// ═══════════════════════════════════════════════════
