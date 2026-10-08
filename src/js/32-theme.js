// ═══════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════
const THEME_BG={light:'#f3f3f5',dark:'#060607'};
function applyDark(){
  document.documentElement.dataset.dark=S.darkMode?'true':'false';
  // Keep the iOS status-bar / browser chrome colour in step with the theme.
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',S.darkMode?THEME_BG.dark:THEME_BG.light);
}
// ─── Accent colours ───
// One accent on neutral surfaces. Each entry: id (stored in saves, so never renamed), label,
// light and dark fill. Both are picked to stay readable with white text on top and as coloured
// text on the page background. The ids date from the first palette; the labels say what you get.
const THEMES=[
  {id:'navy',    label:'Indigo', light:'#4553ee', dark:'#6672ff'},
  {id:'slate',   label:'Blue',   light:'#0b74d1', dark:'#2f8fff'},
  {id:'forest',  label:'Green',  light:'#0b8a5c', dark:'#16a674'},
  {id:'crimson', label:'Red',    light:'#d92d3a', dark:'#f0505a'},
  {id:'plum',    label:'Violet', light:'#7440e6', dark:'#9166ff'},
  {id:'amber',   label:'Orange', light:'#c75e00', dark:'#e87412'},
  {id:'rose',    label:'Rose',   light:'#d81b6a', dark:'#f0478c'},
  {id:'pink',    label:'Pink',   light:'#c9349a', dark:'#e559b6'},
];
function hexRgb(h){const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function applyTheme(){
  const t=THEMES.find(x=>x.id===(S.primaryColor||'navy'))||THEMES[0];
  const dark=!!S.darkMode;const c=dark?t.dark:t.light;const[r,g,b]=hexRgb(c);
  let el=document.getElementById('theme-vars');
  if(!el){el=document.createElement('style');el.id='theme-vars';document.head.appendChild(el);}
  // Only the accent and its two tints change. Surfaces stay neutral, so the colour reads as an accent.
  el.textContent=`${dark?'[data-dark="true"]':':root'}{--navy:${c};--ndim:rgba(${r},${g},${b},${dark?.16:.09});--nbright:rgba(${r},${g},${b},${dark?.34:.22});}`;
}
function toggleDark(){S.darkMode=!S.darkMode;save();applyDark();applyTheme();
  const tg=document.getElementById('dm-tog');if(tg){tg.classList.toggle('on',!!S.darkMode);tg.setAttribute('aria-checked',S.darkMode?'true':'false');}
  document.querySelectorAll('.color-swatch').forEach((el,i)=>{const t=THEMES[i];if(t)el.style.background=S.darkMode?t.dark:t.light;});}
function setPrimaryColor(id){
  S.primaryColor=id;save();applyTheme();
  // Update swatch selection live without closing modal
  document.querySelectorAll('.color-swatch').forEach(el=>{
    el.classList.toggle('on',el.getAttribute('onclick').includes(`'${id}'`));
  });
}

