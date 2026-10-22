// ═══════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════
const THEME_BG={light:'#f3f3f5',dark:'#060607'};
// Settings → Appearance → Theme: System follows the phone (and changes when it does), or Light / Dark.
// S.darkMode is what is showing; everything that draws reads that.
const THEME_MODES=[{id:'system',label:'System'},{id:'light',label:'Light'},{id:'dark',label:'Dark'}];
function themeIsDark(){const m=S.themeMode;return m==='dark'?true:m==='light'?false:systemPrefersDark();}
function applyDark(){
  S.darkMode=themeIsDark();
  document.documentElement.dataset.dark=S.darkMode?'true':'false';
  // Keep the iOS status-bar / browser chrome colour in step with the theme.
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',S.darkMode?THEME_BG.dark:THEME_BG.light);
}
// ─── Accent colours ───
// One accent on neutral surfaces. Each entry: id (stored in saves, so never renamed), label,
// light and dark ink. light is at least 4.5:1 as text on the page and the card, and with white text on it;
// dark is the brighter ink for dark surfaces. Solid fills with white on them (buttons, chips) use the light
// value in both modes (--navy-fill), because white on the bright dark ink does not reach 4.5:1.
// test/unit/contrast.test.js checks all of it. The ids date from the first palette; the labels say what you get.
const THEMES=[
  {id:'navy',    label:'Indigo', light:'#4553ee', dark:'#6672ff'},
  {id:'slate',   label:'Blue',   light:'#0a6fc7', dark:'#2f8fff'},
  {id:'forest',  label:'Green',  light:'#0a7d53', dark:'#16a674'},
  {id:'crimson', label:'Red',    light:'#d32633', dark:'#f0505a'},
  {id:'plum',    label:'Violet', light:'#7440e6', dark:'#9166ff'},
  {id:'amber',   label:'Orange', light:'#b15300', dark:'#e87412'},
  {id:'rose',    label:'Rose',   light:'#d31a68', dark:'#f0478c'},
  {id:'pink',    label:'Pink',   light:'#c03293', dark:'#e559b6'},
];
function hexRgb(h){const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function applyTheme(){
  const t=THEMES.find(x=>x.id===(S.primaryColor||'navy'))||THEMES[0];
  const dark=!!S.darkMode;const c=dark?t.dark:t.light;const[r,g,b]=hexRgb(c);
  let el=document.getElementById('theme-vars');
  if(!el){el=document.createElement('style');el.id='theme-vars';document.head.appendChild(el);}
  // Only the accent and its two tints change. Surfaces stay neutral, so the colour reads as an accent.
  el.textContent=`${dark?'[data-dark="true"]':':root'}{--navy:${c};--ndim:rgba(${r},${g},${b},${dark?.16:.09});--nbright:rgba(${r},${g},${b},${dark?.34:.22});--navy-fill:${t.light};}`;
}
function setThemeMode(m){
  if(!THEME_MODES.some(x=>x.id===m))return;
  S.themeMode=m;save();applyDark();applyTheme();
  document.querySelectorAll('.color-swatch').forEach((el,i)=>{const t=THEMES[i];if(t)el.style.background=S.darkMode?t.dark:t.light;});
  if(typeof setPageRefresh==='function')setPageRefresh();
}
// The phone switching between light and dark (at sunset, say) is followed live in System.
try{if(typeof window!=='undefined'&&window.matchMedia){const mq=window.matchMedia('(prefers-color-scheme: dark)');const f=()=>{if(typeof S!=='undefined'&&S&&S.themeMode==='system'){applyDark();applyTheme();}};if(mq.addEventListener)mq.addEventListener('change',f);else if(mq.addListener)mq.addListener(f);}}catch(e){}
function toggleDark(){S.themeMode=S.darkMode?'light':'dark';save();applyDark();applyTheme();
  const tg=document.getElementById('dm-tog');if(tg){tg.classList.toggle('on',!!S.darkMode);tg.setAttribute('aria-checked',S.darkMode?'true':'false');}
  document.querySelectorAll('.color-swatch').forEach((el,i)=>{const t=THEMES[i];if(t)el.style.background=S.darkMode?t.dark:t.light;});}
function setPrimaryColor(id){
  S.primaryColor=id;save();applyTheme();
  // Update swatch selection live without closing modal
  document.querySelectorAll('.color-swatch').forEach(el=>{
    el.classList.toggle('on',el.getAttribute('onclick').includes(`'${id}'`));
  });
}

