// ═══════════════════════════════════════════════════
// THEME + CHART HELPERS
// ═══════════════════════════════════════════════════
// Read a CSS custom property (charts need real colour values, not var() references).
function cv(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}
function applyDark(){
  document.documentElement.dataset.dark=S.darkMode?'true':'false';
  // Keep the iOS status-bar / browser chrome colour in step with the theme.
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',S.darkMode?'#100f0d':'#f4f1ec');
}
// ─── Theme palette ───
// Each entry: id, label, light [navy,ndim,nbright,bg-tint], dark [navy,ndim,nbright]
const THEMES=[
  {id:'navy',    label:'Navy',   light:['#373f8f','rgba(55,63,143,.07)','rgba(55,63,143,.16)','rgba(55,63,143,.055)'],  dark:['#4d56c4','rgba(125,134,240,.15)','rgba(125,134,240,.32)']},
  {id:'slate',   label:'Slate',  light:['#2d5f7a','rgba(45,95,122,.07)','rgba(45,95,122,.16)','rgba(45,95,122,.055)'],  dark:['#4a8faf','rgba(74,143,175,.15)','rgba(74,143,175,.32)']},
  {id:'forest',  label:'Forest', light:['#2a5c3f','rgba(42,92,63,.07)','rgba(42,92,63,.16)','rgba(42,92,63,.055)'],    dark:['#4a9968','rgba(74,153,104,.15)','rgba(74,153,104,.32)']},
  {id:'crimson', label:'Crimson',light:['#8f2a2a','rgba(143,42,42,.07)','rgba(143,42,42,.16)','rgba(143,42,42,.055)'], dark:['#c45555','rgba(196,85,85,.15)','rgba(196,85,85,.32)']},
  {id:'plum',    label:'Plum',   light:['#5e2d7a','rgba(94,45,122,.07)','rgba(94,45,122,.16)','rgba(94,45,122,.055)'], dark:['#9a5cc4','rgba(154,92,196,.15)','rgba(154,92,196,.32)']},
  {id:'amber',   label:'Amber',  light:['#7a4d10','rgba(122,77,16,.07)','rgba(122,77,16,.16)','rgba(122,77,16,.055)'], dark:['#c48830','rgba(196,136,48,.15)','rgba(196,136,48,.32)']},
  {id:'rose',    label:'Rose',   light:['#9b3060','rgba(155,48,96,.07)','rgba(155,48,96,.16)','rgba(155,48,96,.055)'], dark:['#d46090','rgba(212,96,144,.15)','rgba(212,96,144,.32)']},
  {id:'pink',    label:'Pink',   light:['#b0347a','rgba(176,52,122,.07)','rgba(176,52,122,.16)','rgba(176,52,122,.055)'],dark:['#e070b0','rgba(224,112,176,.15)','rgba(224,112,176,.32)']},
];
function applyTheme(){
  const id=S.primaryColor||'navy';
  const t=THEMES.find(x=>x.id===id)||THEMES[0];
  const dark=S.darkMode;
  const [navy,ndim,nbright]=dark?t.dark:t.light;
  // Inject overrides into a dedicated style element
  let el=document.getElementById('theme-vars');
  if(!el){el=document.createElement('style');el.id='theme-vars';document.head.appendChild(el);}
  const mix=(pct,baseHex)=>`color-mix(in srgb,${navy} ${pct}%,${baseHex})`;
  if(dark){
    // Dark mode: background is a DARK tint of the chosen accent (not flat neutral).
    el.textContent=`[data-dark="true"]{
      --navy:${navy};--ndim:${ndim};--nbright:${nbright};
      --bg:${mix(10,'#100f0d')};
      --bg2:${mix(14,'#1a1916')};
      --card:${mix(8,'#1b1a16')};
      --border:${mix(16,'#2d2a25')};
      --hair:${mix(10,'#242220')};
    }`;
  }else{
    // Light mode: wash the whole surface palette with the chosen accent so the
    // app visibly takes on the color. Cards stay near-white so content pops.
    el.textContent=`:root{
      --navy:${navy};--ndim:${ndim};--nbright:${nbright};
      --bg:${mix(16,'#f5f1ec')};
      --bg2:${mix(23,'#ece7df')};
      --card:${mix(5,'#fffefb')};
      --border:${mix(19,'#e8e3d9')};
      --hair:${mix(11,'#efeae1')};
    }`;
  }
}
function toggleDark(){S.darkMode=!S.darkMode;save();applyDark();applyTheme();}
function setPrimaryColor(id){
  S.primaryColor=id;save();applyTheme();
  // Update swatch selection live without closing modal
  document.querySelectorAll('.color-swatch').forEach(el=>{
    el.classList.toggle('on',el.getAttribute('onclick').includes(`'${id}'`));
  });
}
function killCharts(){Object.values(_charts).forEach(c=>{try{c.destroy();}catch(e){}});_charts={};}
function mkChart(id,cfg){if(_charts[id]){try{_charts[id].destroy();}catch(e){}}const el=document.getElementById(id);if(!el)return null;_charts[id]=new Chart(el,cfg);return _charts[id];}
function baseOpts(){return{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}}}};}

