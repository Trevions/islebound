// Balance simulator: plays through the 360-stage campaign with a "typical" player
// model and prints power curves, economy and playtime. Run: node tools/balance.mjs
import * as B from '../src/data/balance.js';
import { BUILDINGS, BUILDING_ORDER, buildingCost, BUILDING_MAX } from '../src/data/progression.js';
import { WEAPONS } from '../src/data/weapons.js';
import { CREATURES, RARITY } from '../src/data/creatures.js';

const ATTEMPTS = { normal: 1.35, boss: 2.2 };  // average tries per stage
const KILL_RATIO = 0.8;                          // share of spawned enemies killed
const AVG_STARS = 2.3;
const WELL_EFFICIENCY = 0.72;                    // share of placed cells that end in cleared lines
const DAILY_MIN_PER_DAY = 3.5;                   // daily world session incl. menus
const ISLAND_MIN_PER_SESSION = 1.5;

const state = { coins: 0, earned: 0, spent: 0, lands: 0, cells: 0, blds: {}, dex: new Set(), minutes: 0 };
BUILDING_ORDER.forEach((b) => (state.blds[b] = 0));

function slots() { return B.BUILDING_SLOT_LANDS.filter((l) => state.lands >= l).length; }
function bonus() {
  let dmg = Math.min(state.lands, 250) * 0.002, hp = 0, coins = 0;
  const unlocked = BUILDING_ORDER.slice(0, slots());
  for (const b of unlocked) {
    const e = BUILDINGS[b].effect(state.blds[b]);
    dmg += e.dmg || 0; hp += e.hp || 0; coins += e.coins || 0;
  }
  const cap = BUILDINGS.nest.effect(state.blds.nest).nestCap;
  const housed = [...state.dex].map((i) => CREATURES[i]).sort((a, b) => RARITY[b.rarity].mult - RARITY[a.rarity].mult).slice(0, cap);
  for (const c of housed) { if (c.bonus === 'dmg') dmg += c.value; if (c.bonus === 'hp') hp += c.value; if (c.bonus === 'coins') coins += c.value; }
  return { dmg, hp, coins, housed: housed.length };
}
function spend() {
  let bought = true;
  while (bought) {
    bought = false;
    const unlocked = BUILDING_ORDER.slice(0, slots()).filter((b) => state.blds[b] < BUILDING_MAX);
    unlocked.sort((a, b) => buildingCost(a, state.blds[a]) - buildingCost(b, state.blds[b]));
    const b = unlocked[0];
    if (b && buildingCost(b, state.blds[b]) <= state.coins) {
      state.coins -= buildingCost(b, state.blds[b]); state.spent += buildingCost(b, state.blds[b]); state.blds[b]++; bought = true;
    }
  }
}
function weaponsUnlocked(g) {
  return Object.values(WEAPONS).filter((w) => !w.unlock || (w.unlock.g && w.unlock.g < g) || (w.unlock.creatures && state.dex.size >= w.unlock.creatures)).length;
}

const rows = [];
let seedish = 1;
const rand = () => { seedish = (seedish * 16807) % 2147483647; return seedish / 2147483647; };

for (let r = 0; r < B.REALM_COUNT; r++) {
  for (let s = 1; s <= B.STAGES_PER_REALM; s++) {
    const g = B.globalIndex(r, s);
    const dur = B.stageDuration(s);
    let spawned = 0;
    for (let t = 0; t < dur; t++) spawned += B.spawnPerSecond(t / dur, g);
    const kills = spawned * KILL_RATIO;
    const boss = B.BOSS_STAGES.includes(s);
    const tries = boss ? ATTEMPTS.boss : ATTEMPTS.normal;
    const bb = bonus();
    const greed = 1 + bb.coins;
    // failed attempts pay 40%
    const coinsWin = B.runCoins({ kills, g, stars: AVG_STARS, greed });
    const coinsFail = B.runCoins({ kills: kills * 0.6, g, stars: 0, greed });
    const coins = coinsWin + coinsFail * (tries - 1);
    state.coins += coins; state.earned += coins;
    const pieces = B.runPieces({ stars: AVG_STARS, boss });
    state.cells += pieces * 4 * WELL_EFFICIENCY;
    const newLands = Math.floor(state.cells / B.WELL_W); state.lands += newLands; state.cells -= newLands * B.WELL_W;
    state.coins += newLands * 60; // average line-clear coins
    for (let c = 0; c < 3; c++) if (rand() < 0.75) state.dex.add(r * 5 + Math.min(4, Math.floor(-Math.log(1 - rand() * 0.99) * 1.1)));
    spend();
    state.minutes += (dur / 60) * (tries - 0.35) + 0.6 + (s % 3 === 0 ? ISLAND_MIN_PER_SESSION : 0);
    if (s === 1 || s % 10 === 0) {
      const b2 = bonus();
      const playerDmg = 1 + b2.dmg;
      const enemyHp = B.enemyHpMult(g);
      const weaponFactor = 1 + 0.12 * (weaponsUnlocked(g) - 3); // more options → stronger builds
      rows.push({
        level: `${r + 1}-${s}`, g, dur: `${dur}s`,
        enemyHP: enemyHp.toFixed(2), enemyDMG: B.enemyDmgMult(g).toFixed(2),
        playerDMG: playerDmg.toFixed(2), playerHP: Math.round(B.HERO.hp + b2.hp + Math.min(state.lands, 250) * 0.2),
        weapons: weaponsUnlocked(g), power_vs_hp: ((playerDmg * weaponFactor) / enemyHp).toFixed(2),
        coinsRun: Math.round(coinsWin), earned: Math.round(state.earned), lands: state.lands, bldLv: Object.values(state.blds).reduce((a, b) => a + b, 0),
        echoes: state.dex.size, hours: (state.minutes / 60).toFixed(1),
      });
    }
  }
}
console.table(rows);
const dailyHours = (365 * DAILY_MIN_PER_DAY) / 60;
const total = state.minutes / 60 + dailyHours;
console.log(`Campaign playtime ≈ ${(state.minutes / 60).toFixed(1)} h`);
console.log(`Daily World (365 days) ≈ ${dailyHours.toFixed(1)} h`);
console.log(`Total first-year content ≈ ${total.toFixed(1)} h  (= ${(total * 60 / 365).toFixed(1)} min/day for a year, excluding Endless Abyss)`);
console.log(`Building levels bought: ${Object.values(state.blds).reduce((a, b) => a + b, 0)} / ${BUILDING_ORDER.length * BUILDING_MAX}`);
console.log(`Coins earned: ${Math.round(state.earned)}, spent: ${state.spent}, unspent: ${Math.round(state.coins)}`);
let totalCost = 0; BUILDING_ORDER.forEach((b) => { for (let l = 0; l < BUILDING_MAX; l++) totalCost += buildingCost(b, l); });
console.log(`Cost to max every building: ${totalCost}`);
