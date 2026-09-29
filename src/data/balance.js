// ─────────────────────────────────────────────────────────────
//  ISLEBOUND · Balance sheet
//  Every number that shapes difficulty or progression lives here.
//  tools/balance.mjs imports this file and prints the full curves
//  (see docs/BALANCE.md). Change a number → rerun the tool.
// ─────────────────────────────────────────────────────────────

export const REALM_COUNT = 12;          // one realm per month of the year
export const STAGES_PER_REALM = 30;     // one stage per day of the month
export const TOTAL_LEVELS = REALM_COUNT * STAGES_PER_REALM; // 360
export const BOSS_STAGES = [10, 20, 30];

// g = global level index, 1..360
export const globalIndex = (realm, stage) => realm * STAGES_PER_REALM + stage;

// Duration of a dive: 60s on stage 1 → 180s on stage 30 of every realm.
export const stageDuration = (stage) => 60 + Math.round((120 * (stage - 1)) / (STAGES_PER_REALM - 1));

// Enemy scaling by global index (linear keeps late game fair, not exponential walls).
export const enemyHpMult = (g) => 1 + 0.015 * (g - 1);    // 1.00 → 6.39
export const enemyDmgMult = (g) => 1 + 0.009 * (g - 1);   // 1.00 → 4.23
export const spawnMult = (g) => 1 + 0.0035 * (g - 1);     // 1.00 → 2.26
export const maxAlive = (g) => Math.round(70 + g / 4);     // 70 → 160

// Inside a dive, pressure ramps with elapsed time t (0..1 of duration).
export const inRunHpRamp = (p) => 1 + 0.6 * p;             // +60% HP by the end
export const spawnPerSecond = (p, g) => (1.2 + 2.8 * p) * spawnMult(g);

// Hero base stats
export const HERO = {
  hp: 100, speed: 150, pickup: 55, armor: 0, regen: 0, iframes: 0.45,
};

// XP needed for next in-run level L (1-based)
export const xpToNext = (L) => Math.round(2 + 3 * L + 0.5 * L * L);
export const GEM_XP = { small: 1, mid: 4, big: 12, boss: 40 };

// Rewards
export const runCoins = ({ kills, g, stars, greed }) =>
  Math.floor((kills * 0.35 + 15 + g * 1.2) * (stars > 0 ? 1 : 0.4) * greed);
export const runPieces = ({ stars, boss }) => stars + (boss && stars > 0 ? 2 : 0);
export const firstClearGems = (stage) => (BOSS_STAGES.includes(stage) ? 5 : 1);

// Stars: 1 = survived, 2 = ended with ≥50% HP, 3 = also freed all 3 caged Echoes
export const STAR_HP_RATIO = 0.5;
export const CAGES_PER_LEVEL = 3;
export const CAGE_OPEN_TIME = 1.2; // seconds standing next to it

// Gate: a realm opens when the previous realm's final stage is cleared
// AND the player has at least this many stars in total.
export const realmStarGate = (realm) => Math.round(realm * STAGES_PER_REALM * 1.6);

// Permanent upgrades (Forge). cost(level) = base * growth^level
export const UPGRADE_GROWTH = 1.6;
export const upgradeCost = (base, lvl) => Math.round(base * Math.pow(UPGRADE_GROWTH, lvl));

// Island
export const WELL_W = 8;
export const WELL_H = 12;
export const LINE_CLEAR_COINS = [0, 40, 120, 260, 500]; // per 1..4 lines at once
export const landBonus = (lands) => ({ dmg: Math.min(lands, 250) * 0.002, hp: Math.min(lands, 250) * 0.2 });
export const BUILDING_SLOT_LANDS = [0, 4, 10, 18, 28, 42, 60, 85, 115, 150];

// Daily world
export const DAILY_DURATION = 180;
export const DAILY_BASE_G = (dayOfYear) => 20 + Math.min(200, dayOfYear * 0.55);

// Endless Abyss
export const ENDLESS_UNLOCK_REALM = 2; // after clearing realm index 2 (third realm)
