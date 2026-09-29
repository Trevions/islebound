// Deterministic generator for all 360 campaign stages + the Daily World + Endless.
import { REALMS, STAGE_ADJ, STAGE_NOUN } from './realms.js';
import { RNG } from '../core/rng.js';
import * as B from './balance.js';
import { BOSS_FORMS } from './bosses.js';

export const MUTATORS = {
  frenzy:   { icon: '⚡', name: { en: 'Frenzy', bg: 'Бяс' }, desc: { en: '+40% spawns, +30% XP', bg: '+40% врагове, +30% опит' } },
  heavy:    { icon: '🪨', name: { en: 'Heavy', bg: 'Тежест' }, desc: { en: 'Enemies +50% HP but slower', bg: 'Враговете +50% живот, но по-бавни' } },
  swarm:    { icon: '🦇', name: { en: 'Swarm', bg: 'Рояк' }, desc: { en: 'Flitter swarms join the fight', bg: 'Ята пърхалки се включват' } },
  glass:    { icon: '🔮', name: { en: 'Glass', bg: 'Стъкло' }, desc: { en: 'You deal and take +50% damage', bg: '+50% нанесена и поета щета' } },
  fog:      { icon: '🌫️', name: { en: 'Fog', bg: 'Мъгла' }, desc: { en: 'You can see less', bg: 'Виждаш по-малко' } },
  goldrush: { icon: '💰', name: { en: 'Gold Rush', bg: 'Златна треска' }, desc: { en: '+100% coins, more elites', bg: '+100% монети, повече елити' } },
  tiny:     { icon: '🐜', name: { en: 'Tiny', bg: 'Дребни' }, desc: { en: 'Enemies small, fast and many', bg: 'Малки, бързи и много врагове' } },
  gravity:  { icon: '🧲', name: { en: 'Gravity', bg: 'Гравитация' }, desc: { en: 'Gems fly to you', bg: 'Кристалите летят към теб' } },
};
const MUT_KEYS = Object.keys(MUTATORS);

export function getLevel(realm, stage) {
  const R = REALMS[realm];
  const g = B.globalIndex(realm, stage);
  const rng = new RNG(`islebound-${realm}-${stage}`);
  const isBoss = B.BOSS_STAGES.includes(stage);
  const size = Math.max(1, Math.min(R.enemies.length, 1 + Math.floor((stage + 3) / 5)));
  const pool = R.enemies.slice(0, size);
  if (realm > 0 && !pool.includes('blob') && stage < 20) pool.push('blob');
  const mutators = [];
  if (stage > 5 && !isBoss) {
    const p = stage >= 25 ? 0.55 : 0.3;
    if (rng.chance(p)) mutators.push(rng.pick(MUT_KEYS));
  }
  const nameIdx = (realm * 31 + stage * 7) % 20;
  const nounIdx = (realm * 17 + stage * 13) % 20;
  return {
    kind: 'campaign', realm, stage, g,
    seed: `L${realm}-${stage}`,
    name: { en: `${STAGE_ADJ.en[nameIdx]} ${STAGE_NOUN.en[nounIdx]}`, bg: `${STAGE_ADJ.bg[nameIdx]} ${STAGE_NOUN.bg[nounIdx]}` },
    duration: B.stageDuration(stage),
    boss: isBoss ? { id: R.boss, form: BOSS_FORMS[stage] } : null,
    pool, elite: stage >= 4 ? R.elite : null,
    mutators,
    cages: B.CAGES_PER_LEVEL,
    loreChance: 0.35,
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
  return {
    kind: 'daily', realm, stage: 15, g: Math.round(B.DAILY_BASE_G(doy)),
    seed: `D${key}`, dayKey: key,
    name: { en: `Daily World · ${key}`, bg: `Дневен свят · ${key}` },
    duration: B.DAILY_DURATION, boss: null,
    pool: R.enemies.slice(), elite: R.elite, mutators: muts,
    cages: 3, loreChance: 0,
  };
}

export function getEndless(realm = 11) {
  const R = REALMS[realm];
  return {
    kind: 'endless', realm, stage: 30, g: 40,
    seed: `E${Date.now()}`,
    name: { en: 'The Endless Abyss', bg: 'Безкрайната бездна' },
    duration: Infinity, boss: null,
    pool: R.enemies.slice(), elite: R.elite, mutators: [],
    cages: 0, loreChance: 0,
  };
}
