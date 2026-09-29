// Enemy archetypes. Base stats at g=1; balance.js multiplies HP/damage by level.
// ai: movement/attack routine implemented in game/enemyAI.js
// shape: drawing routine in core/draw.js
export const ENEMIES = {
  blob:      { hp: 9,  speed: 58, dmg: 8,  r: 13, xp: 'small', ai: 'chase',   shape: 'blob',    name: { en: 'Voidling', bg: 'Празнушко' } },
  bat:       { hp: 5,  speed: 98, dmg: 5,  r: 9,  xp: 'small', ai: 'swoop',   shape: 'bat',     name: { en: 'Flitter', bg: 'Пърхалка' } },
  brute:     { hp: 70, speed: 36, dmg: 16, r: 24, xp: 'mid',   ai: 'chase',   shape: 'brute',   name: { en: 'Hulkstone', bg: 'Каменяк' } },
  dasher:    { hp: 18, speed: 50, dmg: 12, r: 13, xp: 'small', ai: 'dash',    shape: 'dasher',  name: { en: 'Lunger', bg: 'Хвърлячко' } },
  spitter:   { hp: 14, speed: 44, dmg: 7,  r: 12, xp: 'small', ai: 'ranged',  shape: 'spitter', name: { en: 'Spitbud', bg: 'Плюнчо' } },
  splitter:  { hp: 24, speed: 46, dmg: 9,  r: 16, xp: 'small', ai: 'chase',   shape: 'splitter', split: 2, name: { en: 'Twinjelly', bg: 'Двойно желе' } },
  wisp:      { hp: 12, speed: 70, dmg: 10, r: 12, xp: 'small', ai: 'ghost',   shape: 'wisp',    name: { en: 'Mirewisp', bg: 'Блатен дух' } },
  bomber:    { hp: 12, speed: 80, dmg: 22, r: 12, xp: 'small', ai: 'kamikaze', shape: 'bomber', name: { en: 'Poplet', bg: 'Пуканче' } },
  shielder:  { hp: 32, speed: 40, dmg: 10, r: 16, xp: 'mid',   ai: 'shield',  shape: 'shielder', name: { en: 'Bulwark', bg: 'Щитоносец' } },
  orbiter:   { hp: 16, speed: 76, dmg: 8,  r: 11, xp: 'small', ai: 'orbit',   shape: 'orbiter', name: { en: 'Circler', bg: 'Кръжач' } },
  blinker:   { hp: 20, speed: 40, dmg: 11, r: 13, xp: 'small', ai: 'blink',   shape: 'blinker', name: { en: 'Blinkeye', bg: 'Мигач' } },
  healer:    { hp: 22, speed: 38, dmg: 6,  r: 14, xp: 'mid',   ai: 'healer',  shape: 'healer',  name: { en: 'Mender', bg: 'Лечител' } },
  minelayer: { hp: 26, speed: 48, dmg: 8,  r: 15, xp: 'mid',   ai: 'mines',   shape: 'minelayer', name: { en: 'Sowmite', bg: 'Сеяч' } },
};

// Order in which archetypes first appear across the campaign (for the Bestiary)
export const ENEMY_ORDER = ['blob', 'bat', 'splitter', 'brute', 'orbiter', 'spitter', 'shielder', 'bomber', 'dasher', 'blinker', 'wisp', 'healer', 'minelayer'];

// Elite modifier: any enemy can spawn as elite (crowned). Drops a chest.
export const ELITE = { hpMult: 9, dmgMult: 1.5, rMult: 1.5, speedMult: 0.9 };
// Chance of an elite spawning per second, by stage within a realm (1..30)
export const eliteRate = (stage) => 0.004 + stage * 0.0006;
