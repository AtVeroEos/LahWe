// ═══════════════════════════════════════════════════
// FOOD DATABASE
// ═══════════════════════════════════════════════════
const QUICK_FOODS=[
// ── EGGS & DAIRY ──
{id:'qf_egg',name:'Egg (large)',serving:'1 egg',protein:6,carbs:0.6,fat:5,cals:72},
{id:'qf_egg_white',name:'Egg White',serving:'1 white',protein:3.6,carbs:0.2,fat:0,cals:17},
{id:'qf_milk_whole',name:'Milk (whole)',serving:'1 cup',protein:8,carbs:12,fat:8,cals:150},
{id:'qf_milk_2',name:'Milk (2%)',serving:'1 cup',protein:8,carbs:12,fat:5,cals:125},
{id:'qf_milk_skim',name:'Milk (skim)',serving:'1 cup',protein:8,carbs:12,fat:0,cals:83},
{id:'qf_almond_milk',name:'Almond Milk (unsw)',serving:'1 cup',protein:1,carbs:1,fat:3,cals:30},
{id:'qf_oat_milk',name:'Oat Milk',serving:'1 cup',protein:3,carbs:16,fat:5,cals:120},
{id:'qf_greek_yogurt',name:'Greek Yogurt (plain, nonfat)',serving:'1 cup',protein:25,carbs:9,fat:1,cals:145},
{id:'qf_yogurt_whole',name:'Yogurt (whole milk)',serving:'1 cup',protein:9,carbs:11,fat:8,cals:150},
{id:'qf_cottage_cheese',name:'Cottage Cheese',serving:'1 cup',protein:24,carbs:7,fat:5,cals:183},
{id:'qf_cream_cheese',name:'Cream Cheese',serving:'2 tbsp',protein:2,carbs:1,fat:10,cals:100},
{id:'qf_cheese',name:'Cheddar Cheese',serving:'1 oz',protein:7,carbs:0.4,fat:9,cals:113},
{id:'qf_mozzarella',name:'Mozzarella',serving:'1 oz',protein:7,carbs:1,fat:6,cals:85},
{id:'qf_parmesan',name:'Parmesan',serving:'1 oz',protein:10,carbs:1,fat:7,cals:110},
{id:'qf_swiss',name:'Swiss Cheese',serving:'1 oz',protein:8,carbs:0.4,fat:8,cals:106},
{id:'qf_feta',name:'Feta Cheese',serving:'1 oz',protein:4,carbs:1,fat:6,cals:75},
{id:'qf_ricotta',name:'Ricotta (part-skim)',serving:'¼ cup',protein:7,carbs:3,fat:5,cals:86},
{id:'qf_butter',name:'Butter',serving:'1 tbsp',protein:0,carbs:0,fat:12,cals:102},
{id:'qf_heavy_cream',name:'Heavy Cream',serving:'1 tbsp',protein:0,carbs:0,fat:6,cals:52},
{id:'qf_sour_cream',name:'Sour Cream',serving:'2 tbsp',protein:1,carbs:1,fat:5,cals:52},
// ── POULTRY ──
{id:'qf_chicken_breast',name:'Chicken Breast',serving:'4 oz',protein:26,carbs:0,fat:3,cals:130},
{id:'qf_chicken_thigh',name:'Chicken Thigh (skin)',serving:'4 oz',protein:20,carbs:0,fat:10,cals:174},
{id:'qf_chicken_thigh_sk',name:'Chicken Thigh (skinless)',serving:'4 oz',protein:22,carbs:0,fat:6,cals:140},
{id:'qf_chicken_wing',name:'Chicken Wing',serving:'4 wings',protein:20,carbs:0,fat:16,cals:224},
{id:'qf_chicken_drum',name:'Chicken Drumstick',serving:'1 drumstick',protein:14,carbs:0,fat:6,cals:110},
{id:'qf_turkey_breast',name:'Turkey Breast',serving:'4 oz',protein:26,carbs:0,fat:1,cals:120},
{id:'qf_turkey_deli',name:'Turkey Deli Slices',serving:'4 slices',protein:12,carbs:2,fat:1,cals:60},
{id:'qf_ground_turkey',name:'Ground Turkey (93/7)',serving:'4 oz',protein:22,carbs:0,fat:8,cals:160},
// ── BEEF ──
{id:'qf_ground_beef',name:'Ground Beef (90/10)',serving:'4 oz',protein:22,carbs:0,fat:10,cals:184},
{id:'qf_ground_beef_80',name:'Ground Beef (80/20)',serving:'4 oz',protein:20,carbs:0,fat:17,cals:230},
{id:'qf_sirloin',name:'Sirloin Steak',serving:'4 oz',protein:26,carbs:0,fat:8,cals:180},
{id:'qf_ribeye',name:'Ribeye Steak',serving:'4 oz',protein:24,carbs:0,fat:16,cals:240},
{id:'qf_filet',name:'Filet Mignon',serving:'4 oz',protein:28,carbs:0,fat:10,cals:200},
{id:'qf_flank',name:'Flank Steak',serving:'4 oz',protein:26,carbs:0,fat:6,cals:162},
{id:'qf_beef_stew',name:'Stew Meat (chuck)',serving:'4 oz',protein:22,carbs:0,fat:12,cals:198},
{id:'qf_roast_beef_deli',name:'Roast Beef Deli',serving:'4 slices',protein:12,carbs:1,fat:3,cals:80},
{id:'qf_beef_jerky',name:'Beef Jerky',serving:'1 oz',protein:10,carbs:3,fat:4,cals:82},
// ── PORK ──
{id:'qf_pork_chop',name:'Pork Chop',serving:'4 oz',protein:24,carbs:0,fat:8,cals:170},
{id:'qf_pork_tenderloin',name:'Pork Tenderloin',serving:'4 oz',protein:26,carbs:0,fat:4,cals:136},
{id:'qf_pork_loin',name:'Pork Loin',serving:'4 oz',protein:24,carbs:0,fat:7,cals:163},
{id:'qf_bacon',name:'Bacon',serving:'3 slices',protein:9,carbs:0,fat:12,cals:140},
{id:'qf_ham',name:'Ham (deli)',serving:'4 slices',protein:10,carbs:2,fat:2,cals:65},
{id:'qf_sausage_link',name:'Pork Sausage Link',serving:'2 links',protein:10,carbs:1,fat:16,cals:190},
{id:'qf_hot_dog',name:'Hot Dog',serving:'1 frank',protein:5,carbs:2,fat:11,cals:130},
// ── FISH & SEAFOOD ──
{id:'qf_salmon',name:'Salmon',serving:'4 oz',protein:23,carbs:0,fat:7,cals:160},
{id:'qf_tuna',name:'Tuna (canned)',serving:'1 can (5 oz)',protein:30,carbs:0,fat:1,cals:130},
{id:'qf_tuna_fresh',name:'Tuna Steak',serving:'4 oz',protein:28,carbs:0,fat:1,cals:120},
{id:'qf_shrimp',name:'Shrimp',serving:'4 oz',protein:23,carbs:0,fat:1,cals:100},
{id:'qf_cod',name:'Cod',serving:'4 oz',protein:20,carbs:0,fat:1,cals:93},
{id:'qf_tilapia',name:'Tilapia',serving:'4 oz',protein:23,carbs:0,fat:2,cals:110},
{id:'qf_halibut',name:'Halibut',serving:'4 oz',protein:24,carbs:0,fat:3,cals:120},
{id:'qf_mahi',name:'Mahi-Mahi',serving:'4 oz',protein:21,carbs:0,fat:1,cals:93},
{id:'qf_catfish',name:'Catfish',serving:'4 oz',protein:18,carbs:0,fat:6,cals:130},
{id:'qf_sardines',name:'Sardines (canned)',serving:'1 can (3.75 oz)',protein:23,carbs:0,fat:11,cals:191},
{id:'qf_crab',name:'Crab Meat',serving:'4 oz',protein:21,carbs:0,fat:1,cals:98},
{id:'qf_scallops',name:'Scallops',serving:'4 oz',protein:20,carbs:3,fat:1,cals:100},
{id:'qf_lobster',name:'Lobster',serving:'4 oz',protein:22,carbs:0,fat:1,cals:98},
// ── OTHER PROTEINS ──
{id:'qf_tofu_firm',name:'Tofu (firm)',serving:'½ block',protein:20,carbs:3,fat:11,cals:183},
{id:'qf_tempeh',name:'Tempeh',serving:'4 oz',protein:21,carbs:9,fat:11,cals:222},
{id:'qf_bison',name:'Bison',serving:'4 oz',protein:24,carbs:0,fat:6,cals:150},
{id:'qf_lamb',name:'Lamb (loin)',serving:'4 oz',protein:24,carbs:0,fat:10,cals:190},
{id:'qf_venison',name:'Venison',serving:'4 oz',protein:26,carbs:0,fat:3,cals:134},
{id:'qf_whey',name:'Whey Protein Scoop',serving:'1 scoop',protein:24,carbs:3,fat:1.5,cals:120},
{id:'qf_casein',name:'Casein Protein Scoop',serving:'1 scoop',protein:24,carbs:3,fat:1,cals:120},
{id:'qf_protein_bar',name:'Protein Bar',serving:'1 bar',protein:20,carbs:25,fat:8,cals:250},
// ── GRAINS & STARCHES ──
{id:'qf_white_rice',name:'White Rice (cooked)',serving:'1 cup',protein:4,carbs:45,fat:0.4,cals:206},
{id:'qf_brown_rice',name:'Brown Rice (cooked)',serving:'1 cup',protein:5,carbs:45,fat:1.8,cals:216},
{id:'qf_jasmine_rice',name:'Jasmine Rice (cooked)',serving:'1 cup',protein:4,carbs:45,fat:0.4,cals:205},
{id:'qf_basmati',name:'Basmati Rice (cooked)',serving:'1 cup',protein:4,carbs:45,fat:0.5,cals:210},
{id:'qf_quinoa',name:'Quinoa (cooked)',serving:'1 cup',protein:8,carbs:39,fat:4,cals:222},
{id:'qf_couscous',name:'Couscous (cooked)',serving:'1 cup',protein:6,carbs:37,fat:0.3,cals:176},
{id:'qf_barley',name:'Barley (cooked)',serving:'1 cup',protein:4,carbs:44,fat:1,cals:193},
{id:'qf_oatmeal',name:'Oatmeal',serving:'½ cup dry',protein:5,carbs:27,fat:3,cals:150},
{id:'qf_grits',name:'Grits (cooked)',serving:'1 cup',protein:4,carbs:38,fat:1,cals:182},
{id:'qf_pasta',name:'Pasta (cooked)',serving:'1 cup',protein:7,carbs:43,fat:1.3,cals:220},
{id:'qf_pasta_ww',name:'Whole Wheat Pasta',serving:'1 cup',protein:7,carbs:37,fat:1,cals:174},
{id:'qf_bread_white',name:'Bread (white)',serving:'1 slice',protein:2.7,carbs:13,fat:1,cals:67},
{id:'qf_bread_wheat',name:'Bread (wheat)',serving:'1 slice',protein:4,carbs:12,fat:1,cals:70},
{id:'qf_bread_sour',name:'Sourdough Bread',serving:'1 slice',protein:4,carbs:18,fat:1,cals:100},
{id:'qf_bread_rye',name:'Rye Bread',serving:'1 slice',protein:3,carbs:15,fat:1,cals:82},
{id:'qf_bagel',name:'Bagel',serving:'1 medium',protein:10,carbs:56,fat:2,cals:270},
{id:'qf_eng_muffin',name:'English Muffin',serving:'1 muffin',protein:5,carbs:26,fat:1,cals:132},
{id:'qf_tortilla',name:'Flour Tortilla (large)',serving:'1 tortilla',protein:4,carbs:36,fat:6,cals:210},
{id:'qf_tortilla_corn',name:'Corn Tortilla',serving:'2 tortillas',protein:3,carbs:22,fat:1,cals:110},
{id:'qf_pita',name:'Pita Bread',serving:'1 pita',protein:5,carbs:33,fat:1,cals:165},
{id:'qf_naan',name:'Naan',serving:'1 piece',protein:8,carbs:45,fat:5,cals:260},
{id:'qf_biscuit',name:'Biscuit',serving:'1 biscuit',protein:4,carbs:27,fat:8,cals:200},
{id:'qf_cornbread',name:'Cornbread',serving:'1 piece',protein:4,carbs:28,fat:6,cals:180},
{id:'qf_pancake',name:'Pancake',serving:'1 large',protein:4,carbs:22,fat:4,cals:137},
{id:'qf_waffle',name:'Waffle',serving:'1 waffle',protein:4,carbs:25,fat:6,cals:170},
{id:'qf_crackers',name:'Crackers (saltine)',serving:'10 crackers',protein:2,carbs:22,fat:2,cals:118},
{id:'qf_rice_cake',name:'Rice Cake',serving:'1 cake',protein:1,carbs:7,fat:0,cals:35},
{id:'qf_cereal_oat',name:'Cheerios',serving:'1 cup',protein:4,carbs:20,fat:2,cals:110},
{id:'qf_granola',name:'Granola',serving:'½ cup',protein:5,carbs:32,fat:7,cals:210},
// ── POTATOES ──
{id:'qf_potato_baked',name:'Baked Potato',serving:'1 medium',protein:4,carbs:37,fat:0,cals:161},
{id:'qf_sweet_potato',name:'Sweet Potato',serving:'1 medium',protein:2,carbs:26,fat:0,cals:103},
{id:'qf_mashed_potato',name:'Mashed Potatoes',serving:'1 cup',protein:4,carbs:35,fat:7,cals:210},
{id:'qf_fries',name:'French Fries',serving:'medium (117g)',protein:4,carbs:44,fat:16,cals:340},
{id:'qf_hash_brown',name:'Hash Browns',serving:'1 patty',protein:2,carbs:15,fat:7,cals:130},
// ── LEGUMES ──
{id:'qf_black_beans',name:'Black Beans',serving:'½ cup',protein:8,carbs:20,fat:0.5,cals:114},
{id:'qf_kidney_beans',name:'Kidney Beans',serving:'½ cup',protein:8,carbs:20,fat:0.4,cals:110},
{id:'qf_chickpeas',name:'Chickpeas',serving:'½ cup',protein:7,carbs:23,fat:2,cals:134},
{id:'qf_lentils',name:'Lentils (cooked)',serving:'½ cup',protein:9,carbs:20,fat:0.4,cals:115},
{id:'qf_pinto_beans',name:'Pinto Beans',serving:'½ cup',protein:8,carbs:22,fat:0.6,cals:122},
{id:'qf_navy_beans',name:'Navy Beans',serving:'½ cup',protein:8,carbs:24,fat:0.5,cals:127},
{id:'qf_edamame',name:'Edamame',serving:'1 cup',protein:17,carbs:8,fat:8,cals:188},
{id:'qf_hummus',name:'Hummus',serving:'2 tbsp',protein:2,carbs:4,fat:3,cals:50},
// ── NUTS & SEEDS ──
{id:'qf_almonds',name:'Almonds',serving:'1 oz',protein:6,carbs:6,fat:14,cals:164},
{id:'qf_peanut_butter',name:'Peanut Butter',serving:'2 tbsp',protein:7,carbs:6,fat:16,cals:190},
{id:'qf_peanuts',name:'Peanuts',serving:'1 oz',protein:7,carbs:5,fat:14,cals:161},
{id:'qf_walnuts',name:'Walnuts',serving:'1 oz',protein:4,carbs:4,fat:18,cals:185},
{id:'qf_cashews',name:'Cashews',serving:'1 oz',protein:5,carbs:9,fat:12,cals:157},
{id:'qf_pecans',name:'Pecans',serving:'1 oz',protein:3,carbs:4,fat:20,cals:196},
{id:'qf_pistachios',name:'Pistachios',serving:'1 oz (49 nuts)',protein:6,carbs:8,fat:13,cals:160},
{id:'qf_macadamia',name:'Macadamia Nuts',serving:'1 oz',protein:2,carbs:4,fat:21,cals:204},
{id:'qf_sunflower',name:'Sunflower Seeds',serving:'1 oz',protein:6,carbs:6,fat:14,cals:165},
{id:'qf_pumpkin_seeds',name:'Pumpkin Seeds',serving:'1 oz',protein:9,carbs:3,fat:14,cals:163},
{id:'qf_chia',name:'Chia Seeds',serving:'2 tbsp',protein:4,carbs:12,fat:9,cals:137},
{id:'qf_flax',name:'Flaxseed (ground)',serving:'2 tbsp',protein:3,carbs:4,fat:6,cals:74},
{id:'qf_hemp_seeds',name:'Hemp Seeds',serving:'3 tbsp',protein:10,carbs:1,fat:15,cals:170},
{id:'qf_almond_butter',name:'Almond Butter',serving:'2 tbsp',protein:7,carbs:6,fat:18,cals:196},
{id:'qf_trail_mix',name:'Trail Mix',serving:'¼ cup',protein:4,carbs:16,fat:10,cals:173},
// ── FRUITS ──
{id:'qf_banana',name:'Banana',serving:'1 medium',protein:1.3,carbs:27,fat:0.4,cals:105},
{id:'qf_apple',name:'Apple',serving:'1 medium',protein:0.5,carbs:25,fat:0.3,cals:95},
{id:'qf_orange',name:'Orange',serving:'1 medium',protein:1,carbs:15,fat:0.2,cals:62},
{id:'qf_strawberries',name:'Strawberries',serving:'1 cup',protein:1,carbs:12,fat:0.5,cals:49},
{id:'qf_blueberries',name:'Blueberries',serving:'1 cup',protein:1,carbs:21,fat:0.3,cals:84},
{id:'qf_raspberries',name:'Raspberries',serving:'1 cup',protein:1.5,carbs:15,fat:0.8,cals:64},
{id:'qf_blackberries',name:'Blackberries',serving:'1 cup',protein:2,carbs:14,fat:0.7,cals:62},
{id:'qf_grapes',name:'Grapes',serving:'1 cup',protein:1,carbs:27,fat:0.2,cals:104},
{id:'qf_watermelon',name:'Watermelon',serving:'1 cup diced',protein:1,carbs:12,fat:0.2,cals:46},
{id:'qf_cantaloupe',name:'Cantaloupe',serving:'1 cup diced',protein:1,carbs:13,fat:0.3,cals:54},
{id:'qf_pineapple',name:'Pineapple',serving:'1 cup chunks',protein:1,carbs:22,fat:0.2,cals:82},
{id:'qf_mango',name:'Mango',serving:'1 cup sliced',protein:1,carbs:25,fat:0.6,cals:99},
{id:'qf_peach',name:'Peach',serving:'1 medium',protein:1,carbs:14,fat:0.3,cals:58},
{id:'qf_pear',name:'Pear',serving:'1 medium',protein:0.6,carbs:27,fat:0.2,cals:101},
{id:'qf_plum',name:'Plum',serving:'1 plum',protein:0.5,carbs:8,fat:0.2,cals:30},
{id:'qf_cherries',name:'Cherries',serving:'1 cup',protein:2,carbs:22,fat:0.3,cals:87},
{id:'qf_kiwi',name:'Kiwi',serving:'1 kiwi',protein:1,carbs:10,fat:0.4,cals:42},
{id:'qf_grapefruit',name:'Grapefruit',serving:'½ fruit',protein:1,carbs:13,fat:0.2,cals:52},
{id:'qf_avocado',name:'Avocado',serving:'½ fruit',protein:1.5,carbs:6,fat:11,cals:120},
{id:'qf_coconut',name:'Coconut (shredded)',serving:'¼ cup',protein:2,carbs:5,fat:13,cals:133},
{id:'qf_pomegranate',name:'Pomegranate Seeds',serving:'½ cup',protein:1,carbs:16,fat:1,cals:72},
{id:'qf_dates',name:'Dates (medjool)',serving:'2 dates',protein:1,carbs:36,fat:0,cals:133},
{id:'qf_raisins',name:'Raisins',serving:'¼ cup',protein:1,carbs:32,fat:0,cals:123},
{id:'qf_dried_cranberries',name:'Dried Cranberries',serving:'¼ cup',protein:0,carbs:33,fat:0.5,cals:130},
{id:'qf_applesauce',name:'Applesauce (unsw)',serving:'1 cup',protein:0,carbs:28,fat:0,cals:100},
{id:'qf_frozen_berries',name:'Frozen Mixed Berries',serving:'1 cup',protein:1,carbs:17,fat:0.5,cals:70},
// ── VEGETABLES ──
{id:'qf_broccoli',name:'Broccoli',serving:'1 cup',protein:3,carbs:6,fat:0.3,cals:31},
{id:'qf_spinach_raw',name:'Spinach (raw)',serving:'2 cups',protein:2,carbs:2,fat:0.2,cals:14},
{id:'qf_spinach_cooked',name:'Spinach (cooked)',serving:'1 cup',protein:5,carbs:7,fat:0.5,cals:41},
{id:'qf_kale',name:'Kale',serving:'1 cup chopped',protein:2,carbs:6,fat:0.5,cals:33},
{id:'qf_lettuce',name:'Lettuce (romaine)',serving:'2 cups',protein:1,carbs:3,fat:0.2,cals:16},
{id:'qf_tomato',name:'Tomato',serving:'1 medium',protein:1,carbs:5,fat:0.2,cals:22},
{id:'qf_cherry_tomato',name:'Cherry Tomatoes',serving:'1 cup',protein:1,carbs:6,fat:0.3,cals:27},
{id:'qf_cucumber',name:'Cucumber',serving:'1 cup sliced',protein:1,carbs:4,fat:0.1,cals:16},
{id:'qf_bell_pepper',name:'Bell Pepper',serving:'1 medium',protein:1,carbs:6,fat:0.3,cals:30},
{id:'qf_carrot',name:'Carrot',serving:'1 medium',protein:1,carbs:6,fat:0.1,cals:25},
{id:'qf_celery',name:'Celery',serving:'2 stalks',protein:0.5,carbs:2,fat:0.1,cals:12},
{id:'qf_onion',name:'Onion',serving:'1 medium',protein:1,carbs:11,fat:0.1,cals:44},
{id:'qf_garlic',name:'Garlic',serving:'3 cloves',protein:1,carbs:3,fat:0,cals:13},
{id:'qf_mushroom',name:'Mushrooms',serving:'1 cup sliced',protein:2.2,carbs:2.3,fat:0.2,cals:15},
{id:'qf_zucchini',name:'Zucchini',serving:'1 medium',protein:2,carbs:6,fat:0.4,cals:33},
{id:'qf_asparagus',name:'Asparagus',serving:'6 spears',protein:2,carbs:4,fat:0.2,cals:20},
{id:'qf_green_beans',name:'Green Beans',serving:'1 cup',protein:2,carbs:7,fat:0.1,cals:31},
{id:'qf_peas',name:'Peas',serving:'1 cup',protein:8,carbs:21,fat:0.4,cals:118},
{id:'qf_corn',name:'Corn',serving:'1 ear',protein:3,carbs:17,fat:1,cals:77},
{id:'qf_corn_canned',name:'Corn (canned)',serving:'½ cup',protein:2,carbs:15,fat:1,cals:66},
{id:'qf_cauliflower',name:'Cauliflower',serving:'1 cup',protein:2,carbs:5,fat:0.3,cals:25},
{id:'qf_brussels',name:'Brussels Sprouts',serving:'1 cup',protein:3,carbs:8,fat:0.4,cals:38},
{id:'qf_cabbage',name:'Cabbage',serving:'1 cup chopped',protein:1,carbs:5,fat:0.1,cals:22},
{id:'qf_eggplant',name:'Eggplant',serving:'1 cup diced',protein:1,carbs:5,fat:0.2,cals:20},
{id:'qf_artichoke',name:'Artichoke',serving:'1 medium',protein:4,carbs:14,fat:0.2,cals:60},
{id:'qf_beet',name:'Beet',serving:'1 medium',protein:2,carbs:10,fat:0.2,cals:44},
{id:'qf_snap_peas',name:'Sugar Snap Peas',serving:'1 cup',protein:3,carbs:8,fat:0.2,cals:41},
{id:'qf_radish',name:'Radishes',serving:'1 cup',protein:1,carbs:4,fat:0.1,cals:19},
{id:'qf_turnip',name:'Turnip',serving:'1 medium',protein:1,carbs:8,fat:0.1,cals:34},
{id:'qf_bok_choy',name:'Bok Choy',serving:'1 cup',protein:1,carbs:2,fat:0.2,cals:9},
{id:'qf_arugula',name:'Arugula',serving:'2 cups',protein:1,carbs:1,fat:0.3,cals:10},
{id:'qf_jalapeno',name:'Jalapeño',serving:'1 pepper',protein:0,carbs:1,fat:0,cals:4},
{id:'qf_okra',name:'Okra',serving:'1 cup',protein:2,carbs:7,fat:0.2,cals:33},
{id:'qf_squash_butter',name:'Butternut Squash',serving:'1 cup diced',protein:2,carbs:22,fat:0.2,cals:82},
{id:'qf_squash_acorn',name:'Acorn Squash',serving:'1 cup',protein:2,carbs:30,fat:0.2,cals:115},
{id:'qf_spaghetti_sq',name:'Spaghetti Squash',serving:'1 cup',protein:1,carbs:7,fat:0.6,cals:31},
// ── OILS & FATS ──
{id:'qf_olive_oil',name:'Olive Oil',serving:'1 tbsp',protein:0,carbs:0,fat:14,cals:120},
{id:'qf_coconut_oil',name:'Coconut Oil',serving:'1 tbsp',protein:0,carbs:0,fat:14,cals:121},
{id:'qf_avocado_oil',name:'Avocado Oil',serving:'1 tbsp',protein:0,carbs:0,fat:14,cals:124},
{id:'qf_ghee',name:'Ghee',serving:'1 tbsp',protein:0,carbs:0,fat:14,cals:120},
{id:'qf_mayo',name:'Mayonnaise',serving:'1 tbsp',protein:0,carbs:0,fat:10,cals:94},
// ── CONDIMENTS & SAUCES ──
{id:'qf_ketchup',name:'Ketchup',serving:'1 tbsp',protein:0,carbs:5,fat:0,cals:20},
{id:'qf_mustard',name:'Mustard',serving:'1 tbsp',protein:0.6,carbs:0.9,fat:0.5,cals:9},
{id:'qf_soy_sauce',name:'Soy Sauce',serving:'1 tbsp',protein:1,carbs:1,fat:0,cals:9},
{id:'qf_hot_sauce',name:'Hot Sauce',serving:'1 tsp',protein:0,carbs:0,fat:0,cals:0},
{id:'qf_salsa',name:'Salsa',serving:'2 tbsp',protein:0,carbs:2,fat:0,cals:10},
{id:'qf_guacamole',name:'Guacamole',serving:'2 tbsp',protein:0,carbs:2,fat:4,cals:45},
{id:'qf_bbq_sauce',name:'BBQ Sauce',serving:'2 tbsp',protein:0,carbs:13,fat:0,cals:52},
{id:'qf_ranch',name:'Ranch Dressing',serving:'2 tbsp',protein:0,carbs:2,fat:14,cals:130},
{id:'qf_vinaigrette',name:'Vinaigrette',serving:'2 tbsp',protein:0,carbs:3,fat:8,cals:80},
{id:'qf_teriyaki',name:'Teriyaki Sauce',serving:'2 tbsp',protein:1,carbs:7,fat:0,cals:30},
{id:'qf_marinara',name:'Marinara Sauce',serving:'½ cup',protein:2,carbs:10,fat:2,cals:60},
{id:'qf_pesto',name:'Pesto',serving:'2 tbsp',protein:2,carbs:1,fat:12,cals:120},
// ── SWEETENERS & BAKING ──
{id:'qf_honey',name:'Honey',serving:'1 tbsp',protein:0,carbs:17,fat:0,cals:64},
{id:'qf_maple_syrup',name:'Maple Syrup',serving:'1 tbsp',protein:0,carbs:13,fat:0,cals:52},
{id:'qf_sugar',name:'Sugar',serving:'1 tbsp',protein:0,carbs:12,fat:0,cals:48},
{id:'qf_brown_sugar',name:'Brown Sugar',serving:'1 tbsp',protein:0,carbs:13,fat:0,cals:52},
{id:'qf_jam',name:'Jam / Jelly',serving:'1 tbsp',protein:0,carbs:13,fat:0,cals:50},
{id:'qf_chocolate_dark',name:'Dark Chocolate (70%)',serving:'1 oz',protein:2,carbs:13,fat:12,cals:170},
{id:'qf_choc_chips',name:'Chocolate Chips',serving:'1 tbsp',protein:1,carbs:10,fat:4,cals:70},
{id:'qf_cocoa_powder',name:'Cocoa Powder',serving:'1 tbsp',protein:1,carbs:3,fat:1,cals:12},
// ── SNACKS & MISC ──
{id:'qf_popcorn',name:'Popcorn (air-popped)',serving:'3 cups',protein:3,carbs:19,fat:1,cals:93},
{id:'qf_chips',name:'Potato Chips',serving:'1 oz',protein:2,carbs:15,fat:10,cals:152},
{id:'qf_tortilla_chips',name:'Tortilla Chips',serving:'1 oz',protein:2,carbs:18,fat:7,cals:140},
{id:'qf_pretzels',name:'Pretzels',serving:'1 oz',protein:3,carbs:23,fat:1,cals:108},
{id:'qf_granola_bar',name:'Granola Bar',serving:'1 bar',protein:3,carbs:25,fat:5,cals:150},
{id:'qf_energy_bar',name:'Energy Bar (Cliff)',serving:'1 bar',protein:10,carbs:44,fat:6,cals:250},
{id:'qf_ice_cream',name:'Ice Cream (vanilla)',serving:'½ cup',protein:3,carbs:17,fat:7,cals:137}
];
// ─── Weight of one serving ───
// Grams in one serving, for the built-in foods whose serving is a cup, a spoon or a piece and has
// a standard household weight (USDA measures). It is what lets a food be logged by weight.
// Foods that vary too much by brand or recipe (a protein bar, a biscuit, deli slices) are left
// out on purpose: they are logged by the serving. test/unit/foods.test.js checks every entry here
// against the food's own calories.
const FOOD_GRAMS={
  qf_egg:50,qf_egg_white:33,qf_greek_yogurt:245,qf_milk_whole:244,qf_milk_2:244,qf_milk_skim:245,qf_almond_milk:240,qf_oat_milk:240,qf_yogurt_whole:245,
  qf_cottage_cheese:226,qf_cream_cheese:29,qf_ricotta:62,qf_butter:14.2,qf_heavy_cream:15,qf_sour_cream:24,
  qf_white_rice:158,qf_brown_rice:195,qf_jasmine_rice:158,qf_basmati:160,qf_quinoa:185,qf_couscous:157,qf_barley:157,qf_oatmeal:40,qf_grits:257,
  qf_pasta:140,qf_pasta_ww:140,qf_bread_white:25,qf_bread_wheat:28,qf_bread_rye:32,qf_bagel:105,qf_eng_muffin:57,qf_tortilla:70,qf_tortilla_corn:52,
  qf_pita:60,qf_crackers:30,qf_rice_cake:9,qf_cereal_oat:28,
  qf_potato_baked:173,qf_sweet_potato:114,qf_mashed_potato:210,
  qf_black_beans:86,qf_kidney_beans:89,qf_chickpeas:82,qf_lentils:99,qf_pinto_beans:86,qf_navy_beans:91,qf_edamame:155,qf_hummus:30,
  qf_peanut_butter:32,qf_chia:28,qf_flax:14,qf_hemp_seeds:30,qf_almond_butter:32,qf_trail_mix:38,
  qf_banana:118,qf_apple:182,qf_orange:131,qf_strawberries:152,qf_blueberries:148,qf_raspberries:123,qf_blackberries:144,qf_grapes:151,
  qf_watermelon:152,qf_cantaloupe:156,qf_pineapple:165,qf_mango:165,qf_peach:150,qf_pear:178,qf_plum:66,qf_cherries:138,qf_kiwi:69,qf_grapefruit:123,
  qf_coconut:20,qf_pomegranate:87,qf_dates:48,qf_raisins:41,qf_dried_cranberries:40,qf_applesauce:244,qf_frozen_berries:140,
  qf_broccoli:91,qf_spinach_raw:60,qf_spinach_cooked:180,qf_kale:67,qf_lettuce:94,qf_tomato:123,qf_cherry_tomato:149,qf_cucumber:104,qf_bell_pepper:119,
  qf_carrot:61,qf_celery:80,qf_onion:110,qf_garlic:9,qf_zucchini:196,qf_asparagus:96,qf_green_beans:100,qf_peas:145,qf_corn:90,qf_corn_canned:82,
  qf_cauliflower:100,qf_brussels:88,qf_eggplant:82,qf_artichoke:128,qf_snap_peas:98,qf_radish:116,qf_turnip:122,qf_bok_choy:70,qf_arugula:40,qf_jalapeno:14,
  qf_okra:100,qf_mushroom:70,qf_cabbage:89,qf_beet:100,qf_avocado:68,qf_ketchup:17,qf_mustard:15,qf_squash_butter:205,qf_squash_acorn:205,qf_spaghetti_sq:101,
  qf_olive_oil:13.5,qf_coconut_oil:13.6,qf_avocado_oil:14,qf_ghee:14,qf_mayo:14,
  qf_soy_sauce:16,qf_salsa:36,qf_guacamole:30,qf_ranch:30,qf_teriyaki:36,qf_marinara:128,
  qf_honey:21,qf_maple_syrup:20,qf_sugar:12.5,qf_brown_sugar:13.8,qf_jam:20,qf_choc_chips:15,qf_cocoa_powder:5.4,qf_popcorn:24,qf_ice_cream:66,
};
const GRAMS_PER_OZ=28.3495;
// Grams in one serving of a food, or 0 when it is not known. In order: a weight stored on the food
// (a scanned label, or one you typed), the table above, then a weight written in the serving
// itself ("4 oz", "100g", "1 bar (50 g)"). Fluid ounces are a volume and are not converted.
function servingGrams(f){
  if(!f)return 0;
  const own=parseFloat(f.servingG);if(own>0)return own;
  if(FOOD_GRAMS[f.id])return FOOD_GRAMS[f.id];
  return gramsInText(f.serving);
}
// A weight read out of serving text. Understands "4 oz", "100g", "1/4 lb", "1 1/2 oz", "½ lb",
// "0,5 kg" and "1,000 g". Anything it cannot read for certain ("2 x 100 g", "8 fl oz") is 0:
// a food that cannot be weighed is safe, a food with the wrong weight logs wrong numbers.
function gramsInText(text){
  const txt=String(text||'');
  if(/fl\.?\s*oz/i.test(txt)||/\d\s*[x×*]\s*\d/i.test(txt))return 0;
  const m=txt.match(/(^|[^\d\/.,])((?:\d+\s+)?\d+\s*\/\s*\d+|\d+\s*[½¼¾]|[½¼¾]|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)\s*(kg|g|oz|lbs?)\b/i);
  if(!m)return 0;
  const frac={'½':0.5,'¼':0.25,'¾':0.75};let raw=m[2],n;
  if(raw.includes('/')){const p=raw.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);n=p&&+p[3]?(+(p[1]||0))+(+p[2])/(+p[3]):0;}
  else if(/[½¼¾]/.test(raw)){n=(parseFloat(raw)||0)+frac[raw.slice(-1)];}
  else if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw))n=parseFloat(raw.replace(/,/g,''));
  else n=parseFloat(raw.replace(',','.'));
  const u=m[3].toLowerCase();
  const g=u==='g'?n:u==='kg'?n*1000:u==='oz'?n*GRAMS_PER_OZ:n*453.592;
  return g>0&&g<=20000?Math.round(g*10)/10:0;
}
// ─── Amounts: servings, grams or ounces ───
// A meal item always holds numbers for ONE serving plus how many servings (qty). Logging by weight
// is the same thing seen through the serving's gram weight (sg): 150 g of a 113 g serving is
// 1.327 servings. The item remembers the unit it was entered in, so it reads back as "150 g".
const AMT_STEP={serv:0.5,g:10,oz:0.5};
function amtUnit(u,sg){return(u==='g'||u==='oz')&&parseFloat(sg)>0?u:'serv';}
function amtToQty(v,u,sg){
  v=parseFloat(v);if(!(v>0)||!isFinite(v))return 0;
  u=amtUnit(u,sg);sg=parseFloat(sg);
  const q=u==='g'?v/sg:u==='oz'?v*GRAMS_PER_OZ/sg:v;
  return Math.round(q*10000)/10000;
}
function qtyToAmt(q,u,sg){
  q=parseFloat(q)||0;u=amtUnit(u,sg);sg=parseFloat(sg);
  const v=u==='g'?q*sg:u==='oz'?q*sg/GRAMS_PER_OZ:q;
  // Whole grams from 100 g up; a decimal below that, so 12.5 g of oil stays 12.5.
  return u==='g'?(v>=100?Math.round(v):Math.round(v*10)/10):Math.round(v*100)/100;
}
function fmtAmt(v){return String(Math.round((parseFloat(v)||0)*100)/100);}
// "150 g", "5.5 oz", "1.5 ×"; nothing for exactly one serving.
function itemAmt(it){
  const u=amtUnit(it.unit,it.sg);
  if(u!=='serv')return fmtAmt(qtyToAmt(it.qty,u,it.sg))+' '+u;
  return parseFloat(it.qty)!==1?fmtAmt(it.qty)+' ×':'';
}
function itemLabel(it){const a=itemAmt(it);return(a?a+' ':'')+it.name;}
// "1 cup (158 g)": the serving, with the weight it is taken to be when that is not already in the text.
function servingText(f){
  const sg=servingGrams(f);const txt=String(f.serving||'1 serving');
  return sg>0&&!/\d\s*(kg|g|oz|lbs?)\b/i.test(txt)?`${txt} (${fmtAmt(sg)} g)`:txt;
}
// The unit a food was last weighed in, if it can be weighed at all.
function foodUnit(f){const u=f&&isObj(S.foodUnits)?S.foodUnits[f.id]:null;return amtUnit(u,servingGrams(f));}
function rememberFoodUnit(id,u){
  if(!id)return;if(!isObj(S.foodUnits))S.foodUnits={};
  if(u==='g'||u==='oz'){delete S.foodUnits[id];S.foodUnits[id]=u;}else delete S.foodUnits[id];
}
function normalizeFoodUnits(v){
  const out={};if(!isObj(v))return out;
  Object.keys(v).slice(-400).forEach(k=>{if(v[k]==='g'||v[k]==='oz')out[String(k).slice(0,80)]=v[k];});
  return out;
}
// A fresh builder item for a food: one serving, in the unit that food was last logged in.
function foodItem(f,qty){
  const sg=servingGrams(f);const it={foodId:f.id,name:f.name,qty:qty>0?qty:1,serving:f.serving,protein:f.protein,carbs:f.carbs,fat:f.fat,cals:f.cals};
  if(sg>0){it.sg=sg;const u=foodUnit(f);if(u!=='serv')it.unit=u;}
  return it;
}
function findFood(id){
  return QUICK_FOODS.find(f=>f.id===id)||(S.customFoods||[]).find(f=>f.id===id)||null;
}
function allFoods(){return[...QUICK_FOODS,...(S.customFoods||[])];}
// Every word typed must appear in the name ("chicken grilled" finds "Grilled Chicken Breast").
// Names that START with the query rank first.
function searchFoods(q){
  const words=String(q||'').toLowerCase().split(/\s+/).filter(Boolean);
  if(!words.length)return[];
  const lc=words.join(' ');
  return allFoods().map(f=>({f,n:String(f.name||'').toLowerCase()}))
    .filter(x=>words.every(w=>x.n.includes(w)))
    .sort((a,b)=>(b.n.startsWith(lc)-a.n.startsWith(lc))||(a.n.length-b.n.length))
    .slice(0,25).map(x=>x.f);
}
function getStarredFoods(){return(S.starredFoods||[]).map(findFood).filter(Boolean);}
function getRecentFoods(){return(S.recentFoods||[]).map(findFood).filter(Boolean).slice(0,20);}
function toggleStar(id){
  if(!S.starredFoods)S.starredFoods=[];
  const idx=S.starredFoods.indexOf(id);
  if(idx>=0)S.starredFoods.splice(idx,1);else S.starredFoods.push(id);
  save();
}
function isStarred(id){return(S.starredFoods||[]).includes(id);}
function trackRecent(id){
  if(!S.recentFoods)S.recentFoods=[];
  S.recentFoods=S.recentFoods.filter(x=>x!==id);
  S.recentFoods.unshift(id);
  if(S.recentFoods.length>30)S.recentFoods.length=30;
}
function trackRecentMeal(savedMealId){
  if(!S.recentSavedMeals)S.recentSavedMeals=[];
  S.recentSavedMeals=S.recentSavedMeals.filter(x=>x!==savedMealId);
  S.recentSavedMeals.unshift(savedMealId);
  if(S.recentSavedMeals.length>15)S.recentSavedMeals.length=15;
}
