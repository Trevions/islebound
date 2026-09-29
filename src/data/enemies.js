// Enemy archetypes. Base stats at g=1; balance.js multiplies HP/damage by level.
// ai: movement/attack routine implemented in game/enemyAI.js
// shape: drawing routine in core/draw.js
export const ENEMIES = {
  blob:      { hp: 9,  speed: 58, dmg: 8,  r: 13, xp: 'small', ai: 'chase',   shape: 'blob',    tip: "Slow and steady. They chase you in a straight line — keep moving and let your Songs work.", name: { en: 'Voidling', bg: 'Празнушко' } },
  bat:       { hp: 5,  speed: 98, dmg: 5,  r: 9,  xp: 'small', ai: 'swoop',   shape: 'bat',     tip: "Fast and fragile, they come in packs and weave side to side. Area Songs (Nova, Petals) shred them.", name: { en: 'Flitter', bg: 'Пърхалка' } },
  brute:     { hp: 70, speed: 36, dmg: 16, r: 24, xp: 'mid',   ai: 'chase',   shape: 'brute',   tip: "Very tough, hits hard, but slow. Kite it in wide circles and never let it corner you.", name: { en: 'Hulkstone', bg: 'Каменяк' } },
  dasher:    { hp: 18, speed: 50, dmg: 12, r: 13, xp: 'small', ai: 'dash',    shape: 'dasher',  tip: "Stops, flashes and shows a RED LINE — then dashes along it. Step sideways out of the line.", name: { en: 'Lunger', bg: 'Хвърлячко' } },
  spitter:   { hp: 14, speed: 44, dmg: 7,  r: 12, xp: 'small', ai: 'ranged',  shape: 'spitter', tip: "Keeps its distance and spits red orbs. Dodge the orbs; close in or use homing Songs.", name: { en: 'Spitbud', bg: 'Плюнчо' } },
  splitter:  { hp: 24, speed: 46, dmg: 9,  r: 16, xp: 'small', ai: 'chase',   shape: 'splitter', split: 2, tip: "Splits into two smaller jellies when it dies. Don't stand next to it when it pops.", name: { en: 'Twinjelly', bg: 'Двойно желе' } },
  wisp:      { hp: 12, speed: 70, dmg: 10, r: 12, xp: 'small', ai: 'ghost',   shape: 'wisp',    tip: "A ghost: chases for 5 seconds, then scatters and fades. It drifts through other enemies.", name: { en: 'Mirewisp', bg: 'Блатен дух' } },
  bomber:    { hp: 12, speed: 80, dmg: 22, r: 12, xp: 'small', ai: 'kamikaze', shape: 'bomber', tip: "Rushes you and starts a fuse when close. Back away when it blinks red — the blast hurts.", name: { en: 'Poplet', bg: 'Пуканче' } },
  shielder:  { hp: 32, speed: 40, dmg: 10, r: 16, xp: 'mid',   ai: 'shield',  shape: 'shielder', tip: "Its frost shield blocks 75% of damage from the FRONT. Circle around and hit its back.", name: { en: 'Bulwark', bg: 'Щитоносец' } },
  orbiter:   { hp: 16, speed: 76, dmg: 8,  r: 11, xp: 'small', ai: 'orbit',   shape: 'orbiter', tip: "Circles you and slowly tightens the ring. Break out of the circle early.", name: { en: 'Circler', bg: 'Кръжач' } },
  blinker:   { hp: 20, speed: 40, dmg: 11, r: 13, xp: 'small', ai: 'blink',   shape: 'blinker', tip: "Teleports right next to you every few seconds. Keep an eye on the purple flash.", name: { en: 'Blinkeye', bg: 'Мигач' } },
  healer:    { hp: 22, speed: 38, dmg: 6,  r: 14, xp: 'mid',   ai: 'healer',  shape: 'healer',  tip: "Heals nearby enemies with a green pulse. Kill it first!", name: { en: 'Mender', bg: 'Лечител' } },
  minelayer: { hp: 26, speed: 48, dmg: 8,  r: 15, xp: 'mid',   ai: 'mines',   shape: 'minelayer', tip: "Drops red mines that arm after a moment. Don't walk back over your own path.", name: { en: 'Sowmite', bg: 'Сеяч' } },
  sprite:    { hp: 60, speed: 120, dmg: 0, r: 12, xp: 'mid', ai: 'flee', shape: 'sprite', tip: "A Coin Sprite! It runs away and vanishes after 15 seconds. Catch it for a pile of coins.", name: { en: 'Coin Sprite' } },
};

// Order in which archetypes first appear across the campaign (for the Bestiary)
export const ENEMY_ORDER = ['blob', 'bat', 'splitter', 'brute', 'orbiter', 'spitter', 'shielder', 'bomber', 'dasher', 'blinker', 'wisp', 'healer', 'minelayer'];

// Elite modifier: any enemy can spawn as elite (crowned). Drops a chest.
export const ELITE = { hpMult: 9, dmgMult: 1.5, rMult: 1.5, speedMult: 0.9 };
// Chance of an elite spawning per second, by stage within a realm (1..30)
export const eliteRate = (stage) => 0.004 + stage * 0.0006;
