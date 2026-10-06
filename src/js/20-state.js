// STATE
// ═══════════════════════════════════════════════════
let S={};let _charts={};
function initState(){
  S={tab:'workout',libTab:'exercises',histTab:'list',
    unit:'lbs',restDur:90,bodyweight:185,name:'',exRest:{},
    aftAge:'22-26',aftGender:'male',
    aftCurrent:{MDL:'',HRP:'',SDC:'',PLK:'','2MR':''},
    aftGoals:{MDL:'',HRP:'',SDC:'',PLK:'','2MR':''},
    aftHistory:[],activeWorkout:null,workouts:[],routines:[],
    supps:[],suppLogs:{},prs:{},custom:[],
    activities:[],stepsLog:{},exFilter:'All',exSearch:'',
    calYear:new Date().getFullYear(),calMonth:new Date().getMonth(),
    onboarded:false,goal:'general',darkMode:false,
    expandedCards:{},measurements:[],bodyweightLog:[],
    measureUnit:'in',progExId:null,height:69,progSeeded:{},measPart:null,birthMonth:null,birthYear:null,
    macroGoals:{protein:150,carbs:200,fat:60,cals:2000},
    macroLogs:{},
    schedule:{type:'weekly',weeklyDays:[1,2,4,5],cycleOn:2,cycleOff:1,
      cycleStart:new Date().toISOString().split('T')[0],overrides:{},routineOverrides:{}},
    equipPreset:'full',
    meals:[],
    activeCardDeck:null,activeSprintTimer:null,
  };
}
function save(){try{localStorage.setItem('lahwe_v2',JSON.stringify(S));}catch(e){}}
function load(){
  try{
    const raw=localStorage.getItem('lahwe_v2')||localStorage.getItem('lahwe_v1')||localStorage.getItem('ironlog_v5');
    if(raw)S=JSON.parse(raw);else initState();
  }catch(e){initState();}
  const def=(k,v)=>{if(S[k]==null)S[k]=v;};
  def('expandedCards',{});def('measurements',[]);def('bodyweightLog',[]);
  def('measureUnit','in');def('goal','general');def('custom',[]);
  def('height',69);def('progSeeded',{});def('measPart',null);
  def('birthMonth',null);def('birthYear',null);
  def('exRest',{});def('primaryColor','navy');
  def('aftCurrent',{MDL:'',HRP:'',SDC:'',PLK:'','2MR':''});
  def('aftGoals',{MDL:'',HRP:'',SDC:'',PLK:'','2MR':''});
  def('aftHistory',[]);def('activities',[]);def('stepsLog',{});
  def('histTab','list');def('equipPreset','full');
  def('macroGoals',{protein:150,carbs:200,fat:60,cals:2000});
  def('macroLogs',{});
  def('groups',[]);
  def('schedule',{type:'weekly',weeklyDays:[1,2,4,5],cycleOn:2,cycleOff:1,
    cycleStart:new Date().toISOString().split('T')[0],overrides:{}});
  if(!S.schedule.overrides)S.schedule.overrides={};
  if(!S.schedule.routineOverrides)S.schedule.routineOverrides={};
  if(!S.meals)S.meals=[];
  if(!S.foodCache)S.foodCache={};
  if(!S.customFoods)S.customFoods=[];
  if(!S.savedMeals)S.savedMeals=[];
  if(!S.starredFoods)S.starredFoods=[];
  if(!S.recentFoods)S.recentFoods=[];
  if(!S.recentSavedMeals)S.recentSavedMeals=[];
  if(S.weightGoal===undefined)S.weightGoal=null;
  if(S.weightGoalDir===undefined)S.weightGoalDir=null;
  if(S.program===undefined)S.program=null;
  resolveProgramGroup();
  if(S.activeCardDeck===undefined)S.activeCardDeck=null;
  if(S.activeSprintTimer===undefined)S.activeSprintTimer=null;
  if(S.calYear==null)S.calYear=new Date().getFullYear();
  if(S.calMonth==null)S.calMonth=new Date().getMonth();
  // Migrate old macro key names
  if(S.macroGoals.calories&&!S.macroGoals.cals){S.macroGoals.cals=S.macroGoals.calories;delete S.macroGoals.calories;}
  // Hydrate SEC_MUSCLE from custom exercises
  (S.custom||[]).forEach(ex=>{if(ex.sec&&ex.sec.length)SEC_MUSCLE[ex.id]=ex.sec;});
  applyDark();applyTheme();
}

// ═══════════════════════════════════════════════════
