// Permanent bonuses from the island (buildings + lands + housed Echoes).
import { BUILDINGS, BUILDING_ORDER } from '../data/progression.js';
import { CREATURES } from '../data/creatures.js';
import { landBonus, BUILDING_SLOT_LANDS } from '../data/balance.js';

export function slotCount(lands) { return BUILDING_SLOT_LANDS.filter((l) => lands >= l).length; }
export function unlockedBuildings(lands) { return BUILDING_ORDER.slice(0, slotCount(lands)); }

export function metaBonuses(S) {
  const b = { dmg: 0, hp: 0, speed: 0, cd: 0, pickup: 0, coins: 0, regen: 0, crit: 0, rerolls: 1, revive: 0, nestCap: 3, garden: 0 };
  const lb = landBonus(S.island.lands);
  b.dmg += lb.dmg; b.hp += lb.hp;
  for (const id of unlockedBuildings(S.island.lands)) {
    const lvl = S.island.buildings[id] || 0;
    const e = BUILDINGS[id].effect(lvl);
    for (const k in e) {
      if (k === 'nestCap' || k === 'revive' || k === 'garden') b[k] = e[k];
      else if (k === 'rerolls') b.rerolls += e[k];
      else b[k] = (b[k] || 0) + e[k];
    }
  }
  const housed = S.housed.slice(0, b.nestCap);
  for (const id of housed) { const c = CREATURES[id]; if (c) b[c.bonus] = (b[c.bonus] || 0) + c.value; }
  return b;
}
