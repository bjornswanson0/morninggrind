/* Morning Grind — programming data (mirrors the daily newsletter routine) */

// Assumed starting 1RMs (lb). Editable in Settings; loads recompute from these.
const DEFAULT_1RM = { squat:285, deadlift:365, bench:215, incline:185, ohp:130, row:185, pullupAdd:70 };
function getMaxes(){ try { return Object.assign({}, DEFAULT_1RM, JSON.parse(localStorage.getItem('mg_maxes')||'{}')); } catch { return {...DEFAULT_1RM}; } }
const PCT = { 6:0.80, 8:0.75, 10:0.72, 12:0.68, 15:0.65 };
const rm = (lift, reps) => Math.round((getMaxes()[lift] * (PCT[reps] || 0.7)) / 5) * 5;

// ex(name, sets, reps, load, rpe, group) — group ties it to a swap pool in ALTS
const ex = (name, sets, reps, load, rpe, g) => ({ name, sets, reps, load: String(load), rpe, g });

const PL = (name) => ({ name, url: 'https://open.spotify.com/search/' + encodeURIComponent(name) + '/playlists' });

// Weekly split keyed by JS day index (0=Sun … 6=Sat)
const SPLIT = {
  1: { title:'Upper Push — Strength & Hypertrophy', tag:'push', outdoor:false, playlist:PL('Beast Mode'), ex:[
      ex('Incline Barbell Press', 4, 8, rm('incline',8), 8, 'pressH'),
      ex('Overhead Press', 4, 6, rm('ohp',6), 8, 'pressV'),
      ex('Cable Fly', 3, 12, '30/side', 9, 'chestIso'),
      ex('Cable Lateral Raise', 3, 15, 20, 9, 'latRaise'),
      ex('Weighted Dip', 3, 10, '+25', 8, 'pressH'),
      ex('Rope Pushdown', 3, 15, 50, 9, 'tricepsIso'),
      ex('Hanging Leg Raise', 3, 12, 'BW', 8, 'core'),
  ]},
  2: { title:'Lower Strength + Intervals', tag:'legs', outdoor:false, playlist:PL('Power Workout'), ex:[
      ex('Back Squat', 4, 6, rm('squat',6), 8, 'squat'),
      ex('Romanian Deadlift', 3, 10, 185, 8, 'hinge'),
      ex('Hack Squat', 3, 12, 180, 9, 'squat'),
      ex('Walking Lunge', 3, 12, 40, 8, 'lunge'),
      ex('Leg Curl', 3, 15, 90, 9, 'hamIso'),
      ex('Standing Calf Raise', 4, 15, 180, 9, 'calf'),
      ex('Treadmill Intervals', 1, '12 min', '6×30s hard / 90s easy', '-', 'condition'),
  ]},
  3: { title:'Upper Pull — Width & Thickness', tag:'pull', outdoor:false, playlist:PL('Gym Flow'), ex:[
      ex('Weighted Pull-up', 4, 6, '+35', 8, 'pullV'),
      ex('Barbell Row', 4, 8, rm('row',8), 8, 'rowH'),
      ex('Lat Pulldown', 3, 12, 120, 9, 'pullV'),
      ex('Chest-Supported Row', 3, 12, 90, 9, 'rowH'),
      ex('Face Pull', 3, 15, 40, 9, 'rearDelt'),
      ex('Incline DB Curl', 3, 12, 30, 9, 'bicepIso'),
      ex('Easy Pool Swim (optional)', 1, '10–15 min', 'easy', '-', 'condition'),
  ]},
  4: { title:'Athletic / Power + Tempo Run', tag:'power', outdoor:true, playlist:PL('Adrenaline Workout'), ex:[
      ex('Trap-Bar Jump', 5, 3, 155, 7, 'plyo'),
      ex('Box Jump', 4, 4, 'BW', 7, 'plyo'),
      ex('Push Press', 4, 5, 115, 7, 'pressV'),
      ex('Walking Lunge', 3, 10, 40, 8, 'lunge'),
      ex('Hanging Knee Raise', 3, 15, 'BW', 8, 'core'),
      ex('Outdoor Tempo Run', 1, '15–20 min', 'steady, ~80%', '-', 'condition'),
  ]},
  5: { title:'Upper Hypertrophy — Delts & Arms', tag:'pump', outdoor:false, playlist:PL('Pumping Iron'), ex:[
      ex('Incline DB Press', 4, 10, 60, 9, 'pressH'),
      ex('Cable Lateral Raise', 4, 15, 20, 9, 'latRaise'),
      ex('Cable Fly', 3, 15, 25, 9, 'chestIso'),
      ex('EZ-Bar Curl', 4, 12, 60, 9, 'bicepIso'),
      ex('Overhead Triceps Ext', 4, 12, 70, 9, 'tricepsIso'),
      ex('Rear Delt Fly', 3, 15, 20, 9, 'rearDelt'),
  ]},
  6: { title:'Long Conditioning + Posterior Chain', tag:'conditioning', outdoor:true, playlist:PL('Cardio Workout'), ex:[
      ex('Run or Swim', 1, '30–40 min run / 1500–2000 m', 'steady', '-', 'condition'),
      ex('Romanian Deadlift', 3, 10, 205, 8, 'hinge'),
      ex('Hip Thrust', 3, 12, 185, 8, 'glute'),
      ex('Back Extension', 3, 15, 'BW', 8, 'glute'),
  ]},
  0: { title:'Active Recovery', tag:'recovery', outdoor:false, playlist:PL('Stretching & Recovery'), ex:[
      ex('Easy Pool Swim', 1, '15–20 min', 'easy', '-', 'condition'),
      ex('Mobility Flow', 1, '10 min', 'full body', '-', 'mobility'),
      ex('Core Circuit', 3, 'rounds', 'plank / deadbug / bird-dog', '-', 'core'),
      ex('Breathing', 1, '5 min', 'box breathing', '-', 'mobility'),
  ]},
};

// Swap pools — "mystery box" of similar movements. {name, load}; sets/reps/rpe inherit from the slot.
const A = (name, load) => ({ name, load: String(load) });
const ALTS = {
  pressH: [A('Flat Barbell Bench',175),A('Flat DB Press',70),A('Incline DB Press',60),A('Machine Chest Press',140),A('Weighted Dip','+25'),A('Push-up','BW')],
  pressV: [A('Seated DB Shoulder Press',55),A('Machine Shoulder Press',100),A('Arnold Press',45),A('Push Press',115),A('Landmine Press',70)],
  chestIso: [A('Pec-Deck Machine',100),A('Incline Cable Fly',25),A('Dumbbell Fly',30),A('Low-to-High Cable Fly',20)],
  latRaise: [A('DB Lateral Raise',20),A('Machine Lateral Raise',60),A('Cable Y-Raise',15),A('Leaning Cable Lateral',15)],
  tricepsIso: [A('Overhead Cable Ext',60),A('Skull Crushers',60),A('Triceps Dip Machine',120),A('DB Kickback',20),A('Close-Grip Bench',135)],
  core: [A('Cable Crunch',90),A('Hanging Knee Raise','BW'),A('Ab-Wheel Rollout','BW'),A('Plank','60s'),A('Weighted Decline Sit-up','+25')],
  squat: [A('Front Squat',185),A('Hack Squat',180),A('Leg Press',360),A('Bulgarian Split Squat',40),A('Pendulum Squat',160),A('Goblet Squat',70)],
  hinge: [A('Romanian Deadlift',185),A('Trap-Bar Deadlift',275),A('Conventional Deadlift',255),A('Good Morning',95),A('Cable Pull-Through',90),A('Back Extension','BW')],
  lunge: [A('Walking Lunge',40),A('Reverse Lunge',40),A('Bulgarian Split Squat',40),A('Step-Up',35),A('Split Squat',45)],
  hamIso: [A('Lying Leg Curl',90),A('Seated Leg Curl',100),A('Nordic Curl','BW'),A('Glute-Ham Raise','BW')],
  calf: [A('Standing Calf Raise',180),A('Seated Calf Raise',90),A('Leg-Press Calf Raise',200),A('Single-Leg Calf Raise',30)],
  pullV: [A('Lat Pulldown',120),A('Weighted Pull-up','+35'),A('Neutral-Grip Pulldown',120),A('Assisted Pull-up','-30'),A('Straight-Arm Pulldown',50)],
  rowH: [A('Chest-Supported Row',90),A('Seated Cable Row',130),A('One-Arm DB Row',75),A('T-Bar Row',115),A('Pendlay Row',135)],
  rearDelt: [A('Face Pull',40),A('Rear Delt Fly',20),A('Reverse Pec-Deck',90),A('Cable Rear Delt',15)],
  bicepIso: [A('Incline DB Curl',30),A('EZ-Bar Curl',60),A('Hammer Curl',35),A('Cable Curl',70),A('Preacher Curl',55),A('Spider Curl',30)],
  condition: [A('Outdoor Run','steady'),A('Treadmill Run','steady'),A('Pool Swim','easy'),A('Rowing Machine','moderate'),A('Assault Bike','hard'),A('Stair Climber','steady'),A('Incline Treadmill Walk','brisk'),A('Elliptical','steady'),A('Jump Rope','intervals')],
  plyo: [A('Box Jump','BW'),A('Trap-Bar Jump',155),A('Broad Jump','BW'),A('Med-Ball Slam',20),A('Kettlebell Swing',55),A('Depth Jump','BW')],
  glute: [A('Hip Thrust',185),A('Glute Bridge',135),A('Cable Kickback',30),A('Back Extension','BW'),A('Bulgarian Split Squat',40)],
  mobility: [A('Mobility Flow','10 min'),A('Yoga Flow','15 min'),A('Foam Rolling','10 min'),A('Dynamic Stretch','8 min'),A('Cat-Cow + Hips','8 min')],
};
// Full option list for a slot: the original first, then its pool (deduped by name)
function optionsFor(e){
  const out=[{name:e.name, load:e.load}]; const seen=new Set([e.name]);
  ((e.g && ALTS[e.g]) || []).forEach(a=>{ if(!seen.has(a.name)){ seen.add(a.name); out.push(a); } });
  return out;
}

// Full-session registry — the 7 split days (by tag) + extra "pick a different workout" options
const SESSIONS = {};
Object.values(SPLIT).forEach(s => { SESSIONS[s.tag] = s; });
SESSIONS.fullbody = { title:'Full Body', tag:'fullbody', outdoor:false, playlist:PL('Beast Mode'), ex:[
  ex('Back Squat',3,6,rm('squat',6),8,'squat'),
  ex('Incline Barbell Press',3,8,rm('incline',8),8,'pressH'),
  ex('Barbell Row',3,8,rm('row',8),8,'rowH'),
  ex('Romanian Deadlift',3,10,185,8,'hinge'),
  ex('Cable Lateral Raise',3,15,20,9,'latRaise'),
  ex('Hanging Leg Raise',3,12,'BW',8,'core'),
]};
SESSIONS.bodyweight = { title:'Bodyweight / Travel', tag:'bodyweight', outdoor:false, playlist:PL('Workout'), ex:[
  ex('Push-up',4,15,'BW',8,'pressH'),
  ex('Pull-up',4,8,'BW',8,'pullV'),
  ex('Bodyweight Squat',4,20,'BW',8,'squat'),
  ex('Walking Lunge',3,12,'BW',8,'lunge'),
  ex('Pike Push-up',3,10,'BW',8,'pressV'),
  ex('Plank',3,'60s','BW','-','core'),
]};
SESSIONS.core = { title:'Core & Abs', tag:'core', outdoor:false, playlist:PL('Workout'), ex:[
  ex('Hanging Leg Raise',4,12,'BW',9,'core'),
  ex('Cable Crunch',4,15,90,9,'core'),
  ex('Ab-Wheel Rollout',3,10,'BW',9,'core'),
  ex('Russian Twist',3,20,25,8,'core'),
  ex('Plank',3,'60s','BW','-','core'),
]};
SESSIONS.cardio = { title:'Cardio Session', tag:'cardio', outdoor:true, playlist:PL('Cardio Workout'), ex:[
  ex('Warm-up Jog',1,'5 min','easy','-','condition'),
  ex('Intervals',1,'8 rounds','30s hard / 90s easy','-','condition'),
  ex('Steady Cardio',1,'15 min','moderate','-','condition'),
  ex('Cool-down Walk',1,'5 min','easy','-','condition'),
]};
SESSIONS.mobility = { title:'Mobility & Recovery', tag:'mobility', outdoor:false, playlist:PL('Stretching & Recovery'), ex:[
  ex('Full-Body Mobility Flow',1,'12 min','easy','-','mobility'),
  ex('Foam Rolling',1,'8 min','full body','-','mobility'),
  ex('Hip & T-Spine Openers',1,'8 min','easy','-','mobility'),
  ex('Breathing',1,'5 min','box breathing','-','mobility'),
]};

// What shows in the "Change today's workout" picker
const SESSION_PICKER = [
  {key:'push', emoji:'💪', label:'Upper Push'},
  {key:'pull', emoji:'🎯', label:'Upper Pull'},
  {key:'legs', emoji:'🦵', label:'Lower / Legs'},
  {key:'pump', emoji:'🔥', label:'Arms & Delts'},
  {key:'power', emoji:'⚡', label:'Athletic / Power'},
  {key:'fullbody', emoji:'🏋️', label:'Full Body'},
  {key:'conditioning', emoji:'🏞️', label:'Long Conditioning'},
  {key:'cardio', emoji:'❤️', label:'Cardio Session'},
  {key:'core', emoji:'🧱', label:'Core & Abs'},
  {key:'bodyweight', emoji:'✈️', label:'Bodyweight / Travel'},
  {key:'mobility', emoji:'🧘', label:'Mobility & Recovery'},
];

// Rotating opener: verse/quote + grounding reflection + matching song
const OPENERS = [
  { verse:'"Here am I. Send me!"', ref:'Isaiah 6:8',
    why:'Isaiah volunteers the instant he’s called — before he knows the assignment or the cost. That’s the posture: commit first, figure out the how later. Today’s win isn’t feeling ready, it’s raising your hand — to the session, the hard conversation, the opportunity — before doubt talks you out of it.',
    song:'Eye of the Tiger', artist:'Survivor' },
  { verse:'"I can do all things through Christ who strengthens me."', ref:'Philippians 4:13',
    why:'Paul wrote this from prison, not a mountaintop — his point is that the strength to endure comes from outside himself. So it’s less a lifting slogan than permission to meet a hard day, a plateau, or a setback from a place of supply, not strain. You don’t have to manufacture it — draw on it.',
    song:'Stronger', artist:'Kanye West' },
  { verse:'"They that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles."', ref:'Isaiah 40:31',
    why:'The word for “wait” means to hope with tension — like a coiled spring, not passive sitting. Strength here is renewed through trust and recovery, not grinding. On a deload day, bad sleep, or a slow season, this is your reminder that rest and patience are part of getting stronger — not a break from it.',
    song:'Rise Up', artist:'Andra Day' },
  { verse:'"Be strong and courageous. Do not be afraid; do not be discouraged."', ref:'Joshua 1:9',
    why:'God says this to Joshua right before the biggest, scariest assignment of his life. Courage isn’t the absence of fear — it’s moving forward anyway, and not alone. The last heavy set, the interview, the leap you’ve been putting off — same charge: step in.',
    song:'Till I Collapse', artist:'Eminem' },
  { verse:'"You have power over your mind — not outside events. Realize this, and you will find strength."', ref:'Marcus Aurelius',
    why:'Aurelius ran an empire and still fought to separate what was his — his choices — from what wasn’t: everything else. You can’t control the weather, your soreness, the market, or other people’s decisions. You can control whether you show up and how you respond, so spend your energy only there.',
    song:'Can’t Hold Us', artist:'Macklemore & Ryan Lewis' },
  { verse:'"I have fought the good fight, I have finished the race, I have kept the faith."', ref:'2 Timothy 4:7',
    why:'Paul writes this near the end, looking back — fought, finished, kept: the report card of a whole life. It reframes today’s work as one more entry in a story you’ll eventually review. Train and live so the summary reads, “I finished well.”',
    song:'Remember the Name', artist:'Fort Minor' },
  { verse:'"As iron sharpens iron, so one person sharpens another."', ref:'Proverbs 27:17',
    why:'Sharpening only happens through friction and contact — a blade left alone stays dull. The heavy set, the honest friend, the demanding day: that’s the iron. Don’t resent the resistance in your training or your relationships — it’s the exact thing giving you an edge.',
    song:'Lose Yourself', artist:'Eminem' },
  { verse:'"The credit belongs to the man who is actually in the arena… who spends himself in a worthy cause."', ref:'Theodore Roosevelt',
    why:'Roosevelt’s point: applause is cheap and criticism cheaper — only the one actually attempting the hard thing has skin in the game. Today you’re in the arena: training, building, putting yourself out there. Whatever the result, you’re spending yourself on something real — and that already sets you apart from the commentators.',
    song:'Hall of Fame', artist:'The Script' },
  { verse:'"Run in such a way as to get the prize. Everyone who competes goes into strict training."', ref:'1 Corinthians 9:24–27',
    why:'Paul literally compares the life of faith to an athlete’s strict training — same discipline, higher stakes. Every clean rep, early alarm, and disciplined meal is practice for who you’re becoming everywhere else. You’re not just training a body — you’re training a will that carries into your work and relationships.',
    song:'The Champion', artist:'Carrie Underwood' },
  { verse:'"You will never always be motivated. You have to learn to be disciplined."', ref:'David Goggins',
    why:'Goggins’ whole message: feelings are unreliable teammates — motivation shows up when it wants, discipline shows up on schedule. The days you don’t feel like it are the ones that actually build the identity. Do the work anyway, and “someone who follows through” stops being a goal and becomes who you are.',
    song:'Numb / Encore', artist:'Jay-Z & Linkin Park' },
];
const spotifySearch = (o) => 'https://open.spotify.com/search/' + encodeURIComponent(o.song + ' ' + o.artist);
function dayOfYear(d){ const s=new Date(d.getFullYear(),0,0); return Math.floor((d-s)/864e5); }
function openerFor(d){ return OPENERS[dayOfYear(d) % OPENERS.length]; }

const GEO = { lat:40.7265, lon:-73.9815, tz:'America/New_York', place:'East Village' };
const WMO = {
  0:['☀️','Clear'],1:['🌤️','Mostly clear'],2:['⛅','Partly cloudy'],3:['☁️','Overcast'],
  45:['🌫️','Fog'],48:['🌫️','Fog'],51:['🌦️','Light drizzle'],53:['🌦️','Drizzle'],55:['🌧️','Drizzle'],
  61:['🌧️','Light rain'],63:['🌧️','Rain'],65:['🌧️','Heavy rain'],66:['🌧️','Freezing rain'],67:['🌧️','Freezing rain'],
  71:['🌨️','Light snow'],73:['🌨️','Snow'],75:['❄️','Heavy snow'],77:['🌨️','Snow grains'],
  80:['🌦️','Showers'],81:['🌧️','Showers'],82:['⛈️','Heavy showers'],85:['🌨️','Snow showers'],86:['❄️','Snow showers'],
  95:['⛈️','Thunderstorm'],96:['⛈️','Thunderstorm'],99:['⛈️','Thunderstorm'],
};
