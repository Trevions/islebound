// Balance simulator for 30-minute dives: plays the 360-stage campaign with a
// "typical player" model and prints power, economy, score and playtime curves.
// Run: node tools/balance.mjs
import * as B from '../src/data/balance.js';
import { BUILDINGS, BUILDING_ORDER, buildingCost, BUILDING_MAX } from '../src/data/progression.js';
import { WEAPONS } from '../src/data/weapons.js';
import { CREATURES, RARITY } from '../src/data/creatures.js';

const ATTEMPTS = { normal: 1.3, boss: 1.9 };   // average tries per stage
const FAIL_AT = 0.55;                           // failed tries end on average at 55% of the timer
const KILL_RATIO = 0.62;                        // share of spawned enemies killed
const AVG_STARS = 2.2;
const WELL_EFFICIENCY = 0.72;
const DAILY_MIN = 32;                           // one 30-min daily world + menus
const DAILY_SHARE = 0.35;                       // share of days the player also plays the daily

const st = { coins: 0, earned: 0, spent: 0, lands: 0, cells: 0, blds: {}, dex: new Set(), minutes: 0, total: 0 };
BUILDING_ORDER.forEach((b) => (st.blds[b] = 0));
const slots = () => B.BUILDING_SLOT_LANDS.filter((l) => st.lands >= l).length;
function bonus() {
  let dmg = Math.min(st.lands, 250) * 0.002, hp = 0, coins = 0;
  for (const b of BUILDING_ORDER.slice(0, slots())) { const e = BUILDINGS[b].effect(st.blds[b]); dmg += e.dmg || 0; hp += e.hp || 0; coins += e.coins || 0; }
  const cap = BUILDINGS.nest.effect(st.blds.nest).nestCap;
  const housed = [...st.dex].map((i) => CREATURES[i]).sort((a, b) => RARITY[b.rarity].mult - RARITY[a.rarity].mult).slice(0, cap);
  for (const c of housed) { if (c.bonus === 'dmg') dmg += c.value; if (c.bonus === 'hp') hp += c.value; if (c.bonus === 'coins') coins += c.value; }
  return { dmg, hp, coins };
}
function spend() {
  for (;;) {
    const opts = BUILDING_ORDER.slice(0, slots()).filter((b) => st.blds[b] < BUILDING_MAX).sort((a, b) => buildingCost(a, st.blds[a]) - buildingCost(b, st.blds[b]));
    const b = opts[0];
    if (!b || buildingCost(b, st.blds[b]) > st.coins) return;
    st.coins -= buildingCost(b, st.blds[b]); st.spent += buildingCost(b, st.blds[b]); st.blds[b]++;
  }
}
const weaponsUnlocked = (cleared) => Object.values(WEAPONS).filter((w) => !w.unlock || (w.unlock.g && w.unlock.g <= cleared) || (w.unlock.creatures && st.dex.size >= w.unlock.creatures)).length;

let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rows = [];
for (let r = 0; r < B.REALM_COUNT; r++) for (let s = 1; s <= B.STAGES_PER_REALM; s++) {
  const g = B.globalIndex(r, s);
  let spawned = 0;
  for (let m = 0; m < 30; m++) spawned += Math.min(B.spawnPerSecond(m + 0.5, g) * 60, B.maxAlive(g, m) * 6);
  const kills = spawned * KILL_RATIO;
  const boss = B.BOSS_STAGES.includes(s);
  const tries = boss ? ATTEMPTS.boss : ATTEMPTS.normal;
  const b = bonus();
  const coinMult = 1 + b.coins;
  const collected = (kills * (0.93 * B.COIN_DROP.small * B.COIN_VALUE.small + 0.07 * B.COIN_DROP.mid * B.COIN_VALUE.mid) + 4 * B.COIN_VALUE.champion + 3 * 40 * B.COIN_VALUE.rainDrop / 0.12 * 0.5 + 4 * B.COIN_VALUE.sprite * 0.6) * coinMult;
  const winCoins = collected + B.clearBonusCoins(g) * coinMult;
  const coins = winCoins + collected * FAIL_AT * (tries - 1);
  st.coins += coins; st.earned += coins;
  const pieces = B.runPieces({ stars: AVG_STARS, boss, champions: 4 });
  st.cells += pieces * 4 * WELL_EFFICIENCY;
  const nl = Math.floor(st.cells / B.WELL_W); st.lands += nl; st.cells -= nl * B.WELL_W; st.coins += nl * 90;
  for (let c = 0; c < 3; c++) if (rand() < 0.8) st.dex.add(r * 5 + Math.min(4, Math.floor(-Math.log(1 - rand() * 0.99) * 1.1)));
  spend();
  st.minutes += 30 * (1 + FAIL_AT * (tries - 1)) + 3;
  const score = B.targetScore(g) / 0.6;
  st.total += score;
  if (s === 1 || s % 10 === 0) {
    const b2 = bonus();
    const dmg = 1 + b2.dmg, wf = 1 + 0.12 * (weaponsUnlocked(g) - 3);
    rows.push({ level: `${r + 1}-${s}`, g, enemyHP: B.enemyHpMult(g).toFixed(2), enemyHP_30min: (B.enemyHpMult(g) * B.inRunHpRamp(30)).toFixed(1), heroDMG: dmg.toFixed(2), heroHP: Math.round(B.HERO.hp + b2.hp), songs: weaponsUnlocked(g), power_vs_hp: ((dmg * wf) / B.enemyHpMult(g)).toFixed(2), kills: Math.round(kills), coinsWin: Math.round(winCoins), target: B.targetScore(g), lands: st.lands, bldLv: Object.values(st.blds).reduce((a, x) => a + x, 0), echoes: st.dex.size, hours: (st.minutes / 60).toFixed(0) });
  }
}
console.table(rows);
const days = st.minutes / 30;
console.log(`Campaign: ${(st.minutes / 60).toFixed(0)} h of play ≈ ${Math.round(days)} sessions of 30 min (one stage a day ≈ ${(days / 365).toFixed(2)} years)`);
console.log(`Daily World on ${Math.round(DAILY_SHARE * 100)}% of days: +${((365 * DAILY_SHARE * DAILY_MIN) / 60).toFixed(0)} h`);
console.log(`Nightfall (second pass, harder): ≈ +${((st.minutes * 1.25) / 60).toFixed(0)} h`);
console.log(`Top-100 all-time score of a full clear (target÷0.6 per stage): ≈ ${(st.total / 1e6).toFixed(1)} M`);
console.log(`Building levels bought: ${Object.values(st.blds).reduce((a, x) => a + x, 0)} / ${BUILDING_ORDER.length * BUILDING_MAX}`);
let totalCost = 0; BUILDING_ORDER.forEach((bb) => { for (let l = 0; l < BUILDING_MAX; l++) totalCost += buildingCost(bb, l); });
console.log(`Coins earned: ${Math.round(st.earned)}, spent: ${st.spent}, cost to max all buildings: ${totalCost}`);
