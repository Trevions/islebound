// ─────────────────────────────────────────────────────────────
//  ISLEBOUND · Balance sheet
//  Every number that shapes difficulty, score or progression lives here.
//  tools/balance.mjs imports this file and prints the full curves
//  (see docs/BALANCE.md). Change a number → rerun the tool.
// ─────────────────────────────────────────────────────────────

export const REALM_COUNT = 12;          // one realm per month of the year
export const STAGES_PER_REALM = 30;     // one stage per day of the month
export const TOTAL_LEVELS = REALM_COUNT * STAGES_PER_REALM; // 360
export const BOSS_STAGES = [10, 20, 30];

// g = global level index, 1..360
export const globalIndex = (realm, stage) => realm * STAGES_PER_REALM + stage;

// ── A dive lasts 30 minutes, split into 6 waves of 5 minutes ──
export const STAGE_DURATION = 30 * 60;
export const WAVE_LEN = 5 * 60;
export const WAVES = 6;
export const stageDuration = () => STAGE_DURATION;
export const CHAMPION_AT = [5, 10, 15, 20].map((m) => m * 60);   // mini-boss minutes
export const GUARDIAN_AT = 25 * 60;                                // boss stages
export const CAGE_AT = [4, 13, 22].map((m) => m * 60);             // an Echo calls for help
export const COIN_RAIN_AT = [7, 17, 27].map((m) => m * 60);        // 40-second coin showers
export const SPRITE_AT = [3, 11, 19, 26].map((m) => m * 60);       // fleeing Coin Sprite

// Enemy scaling by global level index (linear: no pay-walls).
export const enemyHpMult = (g) => 1 + 0.015 * (g - 1);    // 1.00 → 6.39
export const enemyDmgMult = (g) => 1 + 0.009 * (g - 1);   // 1.00 → 4.23
export const spawnMult = (g) => 1 + 0.0035 * (g - 1);     // 1.00 → 2.26
export const maxAlive = (g, minute) => Math.min(230, Math.round(60 + g / 5 + minute * 4));

// Inside a dive, pressure grows with elapsed minutes m (0..30).
export const inRunHpRamp = (m) => 1 + 0.16 * m + 0.0045 * m * m;   // ×1 → ×9.85 at 30:00
export const inRunDmgRamp = (m) => 1 + 0.03 * m;                   // ×1 → ×1.9
export const spawnPerSecond = (m, g) => (1.1 + 0.22 * m) * spawnMult(g); // 1.1/s → 7.7/s (×g)

// Hero base stats
export const HERO = { hp: 100, speed: 150, pickup: 55, armor: 0, regen: 0, iframes: 0.5 };

// XP needed for next in-run level L (reaches ~L60 at 30:00)
export const xpToNext = (L) => Math.round(5 + 2.2 * L + 0.02 * L * L);
export const GEM_XP = { small: 1, mid: 4, big: 12, boss: 40 };

// ── Coins inside the dive ──
export const COIN_DROP = { small: 0.07, mid: 0.25, elite: 1, champion: 1, guardian: 1 };
export const COIN_VALUE = { small: 1, mid: 2, elite: 15, champion: 60, guardian: 250, sprite: 40, rainDrop: 1 };
// Coins you pick up are always yours. Clearing adds a bonus.
export const clearBonusCoins = (g) => Math.round(150 + g * 6);

// ── SCORE ──
export const SCORE = {
  kill: { small: 10, mid: 25, elite: 250, champion: 1500, guardian: 8000 },
  coin: 5, echo: 1000, stone: 500, perSecond: 5,
  cleanWave: 2000,                  // a 5-minute wave without taking a hit
  clear: 10000, hpBonus: 5000,      // + hpBonus × remaining HP ratio
};
// Combo: kills chained within COMBO_WINDOW seconds. Getting hit resets it.
export const COMBO_WINDOW = 2.5;
export const comboMult = (combo) => Math.min(5, 1 + Math.floor(combo / 25) * 0.1);
export const levelScoreMult = (g, night) => (1 + g / 100) * (night ? 1.5 : 1);
// Target score for the ★★ star (roughly 60% of a solid run)
export function targetScore(g) {
  let spawned = 0;
  for (let m = 0; m < 30; m++) spawned += spawnPerSecond(m + 0.5, g) * 60;
  const kills = spawned * 0.6;
  const base = kills * 12 * 1.6 + STAGE_DURATION * SCORE.perSecond + SCORE.clear + 4 * SCORE.kill.champion;
  return Math.round((base * levelScoreMult(g, false) * 0.6) / 1000) * 1000;
}

// Stars: ★ survive 30:00 (and beat the Guardian on stages 10/20/30)
//        ★ reach the target score   ★ free all 3 caged Echoes
export const CAGES_PER_LEVEL = 3;
export const CAGE_OPEN_TIME = 1.2;

// Island pieces: one per star, +2 for a Guardian, +1 per champion felled
export const runPieces = ({ stars, boss, champions }) => stars + (boss && stars > 0 ? 2 : 0) + Math.min(4, champions);
export const firstClearGems = (stage) => (BOSS_STAGES.includes(stage) ? 5 : 1);

// Gate: a realm opens when the previous realm's final stage is cleared
// AND the player has at least this many stars in total.
export const realmStarGate = (realm) => Math.round(realm * STAGES_PER_REALM * 1.6);

// Permanent upgrades on the island. cost(level) = base * 6 * growth^level
export const UPGRADE_GROWTH = 1.6;
export const upgradeCost = (base, lvl) => Math.round(base * 6 * Math.pow(UPGRADE_GROWTH, lvl));

// Island
export const WELL_W = 8;
export const WELL_H = 12;
export const LINE_CLEAR_COINS = [0, 60, 180, 400, 800];
export const landBonus = (lands) => ({ dmg: Math.min(lands, 250) * 0.002, hp: Math.min(lands, 250) * 0.2 });
export const BUILDING_SLOT_LANDS = [0, 4, 10, 18, 28, 42, 60, 85, 115, 150];

// Daily world (also 30 minutes, same seed for everyone)
export const DAILY_DURATION = STAGE_DURATION;
export const DAILY_BASE_G = (dayOfYear) => 20 + Math.min(200, dayOfYear * 0.55);

// Endless Abyss
export const ENDLESS_UNLOCK_REALM = 2;

// Checkpoint: an unfinished dive is saved this often (seconds)
export const AUTOSAVE_EVERY = 20;
