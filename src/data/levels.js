// Deterministic generator for all 360 campaign stages + the Daily World + Endless.
// Every stage is a 30-minute dive made of 6 waves of 5 minutes.
import { REALMS, STAGE_ADJ, STAGE_NOUN } from './realms.js';
import { RNG } from '../core/rng.js';
import * as B from './balance.js';
import { BOSS_FORMS } from './bosses.js';

export const MUTATORS = {
  frenzy:   { icon: '⚡', name: { en: 'Frenzy' }, desc: { en: '+40% enemies, +30% XP' } },
  heavy:    { icon: '🪨', name: { en: 'Heavy' }, desc: { en: 'Enemies have +50% HP but move slower' } },
  swarm:    { icon: '🦇', name: { en: 'Swarm' }, desc: { en: 'Flitter packs arrive every few seconds' } },
  glass:    { icon: '🔮', name: { en: 'Glass' }, desc: { en: 'You deal AND take +50% damage' } },
  fog:      { icon: '🌫️', name: { en: 'Fog' }, desc: { en: 'You can only see a short distance' } },
  goldrush: { icon: '💰', name: { en: 'Gold Rush' }, desc: { en: 'Double coins, triple elites' } },
  tiny:     { icon: '🐜', name: { en: 'Tiny' }, desc: { en: 'Enemies are small, fast and numerous' } },
  gravity:  { icon: '🧲', name: { en: 'Gravity' }, desc: { en: 'Gems and coins fly to you from far away' } },
};
const MUT_KEYS = Object.keys(MUTATORS);

// A wave's theme changes who comes and how many.
export const WAVE_THEMES = {
  drift:    { name: 'First Contact', desc: 'The Void wakes up. Learn the ground, grab every gem.', spawn: 1, hp: 1, mix: null },
  swarm:    { name: 'The Swarm', desc: 'Fast, fragile packs. Area Songs shine here.', spawn: 1.5, hp: 0.6, mix: ['bat', 'blob', 'orbiter'] },
  heavy:    { name: 'Heavy Stone', desc: 'Fewer enemies, much tougher. Keep your distance.', spawn: 0.65, hp: 1.8, mix: ['brute', 'shielder', 'splitter'] },
  ranged:   { name: 'Crossfire', desc: 'Spitters from every side. Watch for red orbs.', spawn: 1, hp: 1, mix: ['spitter', 'blinker', 'dasher'] },
  haunt:    { name: 'The Haunting', desc: 'Ghosts drift through the crowd. They scatter, then return.', spawn: 1.1, hp: 1, mix: ['wisp', 'bat'] },
  hunt:     { name: 'Elite Hunt', desc: 'Crowned elites everywhere. Each one drops a chest.', spawn: 0.9, hp: 1, mix: null, elites: 5 },
  mines:    { name: 'Minefield', desc: 'Sowmites and Poplets. Mind where you step.', spawn: 1, hp: 1, mix: ['minelayer', 'bomber'] },
  surge:    { name: 'Void Surge', desc: 'The final push. Everything, all at once. Survive!', spawn: 1.8, hp: 1.1, mix: null },
  guardian: { name: "Guardian's Hour", desc: 'The Guardian of this realm arrives at 25:00. Defeat it to clear the stage.', spawn: 0.8, hp: 1, mix: null },
};
const MID_THEMES = ['swarm', 'heavy', 'ranged', 'haunt', 'hunt', 'mines'];

export function getLevel(realm, stage) {
  const R = REALMS[realm];
  const g = B.globalIndex(realm, stage);
  const rng = new RNG(`islebound-${realm}-${stage}`);
  const isBoss = B.BOSS_STAGES.includes(stage);
  const size = Math.max(2, Math.min(R.enemies.length, 1 + Math.floor((stage + 3) / 5)));
  const pool = R.enemies.slice(0, size);
  if (realm > 0 && !pool.includes('blob')) pool.push('blob');
  const mutators = [];
  if (stage > 5 && !isBoss) { if (rng.chance(stage >= 25 ? 0.55 : 0.3)) mutators.push(rng.pick(MUT_KEYS)); }
  const mids = rng.shuffle(MID_THEMES).slice(0, 4);
  const waves = ['drift', ...mids, isBoss ? 'guardian' : 'surge'];
  const nameIdx = (realm * 31 + stage * 7) % 20;
  const nounIdx = (realm * 17 + stage * 13) % 20;
  return {
    kind: 'campaign', realm, stage, g,
    seed: `L${realm}-${stage}`,
    name: { en: `${STAGE_ADJ.en[nameIdx]} ${STAGE_NOUN.en[nounIdx]}` },
    duration: B.STAGE_DURATION, waves,
    boss: isBoss ? { id: R.boss, form: BOSS_FORMS[stage] } : null,
    pool, elite: R.elite, mutators,
    cages: B.CAGES_PER_LEVEL, loreChance: 0.6,
    target: B.targetScore(g),
  };
}

export function getDaily(date = new Date()) {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const rng = new RNG(`daily-${key}`);
  const start = new Date(date.getFullYear(), 0, 1);
  const doy = Math.floor((date - start) / 86400000) + 1;
  const realm = rng.int(0, 11);
  const R = REALMS[realm];
  const muts = rng.shuffle(MUT_KEYS).slice(0, 2);
  const g = Math.round(B.DAILY_BASE_G(doy));
  return {
    kind: 'daily', realm, stage: 15, g,
    seed: `D${key}`, dayKey: key,
    name: { en: `Daily World · ${key}` },
    duration: B.DAILY_DURATION, waves: ['drift', ...rng.shuffle(MID_THEMES).slice(0, 4), 'surge'],
    boss: null, pool: R.enemies.slice(), elite: R.elite, mutators: muts,
    cages: 3, loreChance: 0, target: B.targetScore(g),
  };
}

export function getEndless(realm = 11) {
  const R = REALMS[realm];
  return {
    kind: 'endless', realm, stage: 30, g: 40,
    seed: `E${Date.now()}`,
    name: { en: 'The Endless Abyss' },
    duration: Infinity, waves: ['drift', 'swarm', 'heavy', 'ranged', 'haunt', 'hunt', 'mines', 'surge'],
    boss: null, pool: R.enemies.slice(), elite: R.elite, mutators: [],
    cages: 0, loreChance: 0, target: 0,
  };
}

export const waveIndex = (t) => Math.floor(t / B.WAVE_LEN);
