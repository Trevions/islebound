// The Echodex — 60 rescuable creatures (5 per realm).
// Rescue them from cages during dives. House them in your island's Nest
// and each one grants its bonus to every future dive.
import { REALMS } from './realms.js';

export const RARITY = {
  common:    { w: 60, color: '#b9c3d6', label: { en: 'Common', bg: 'Обикновено' }, mult: 1 },
  rare:      { w: 26, color: '#6bc7ff', label: { en: 'Rare', bg: 'Рядко' }, mult: 1.6 },
  epic:      { w: 11, color: '#c78bff', label: { en: 'Epic', bg: 'Епично' }, mult: 2.4 },
  legendary: { w: 3,  color: '#ffcf5a', label: { en: 'Legendary', bg: 'Легендарно' }, mult: 3.5 },
};

// bonus base values (× rarity mult)
export const BONUS = {
  dmg:    { base: 0.02, fmt: (v) => `+${Math.round(v * 100)}% ⚔` },
  hp:     { base: 6,    fmt: (v) => `+${Math.round(v)} ♥` },
  speed:  { base: 0.015, fmt: (v) => `+${Math.round(v * 100)}% ➤` },
  cd:     { base: 0.012, fmt: (v) => `-${Math.round(v * 100)}% ⌛` },
  pickup: { base: 0.05, fmt: (v) => `+${Math.round(v * 100)}% ⊕` },
  coins:  { base: 0.03, fmt: (v) => `+${Math.round(v * 100)}% ◉` },
  regen:  { base: 0.08, fmt: (v) => `+${v.toFixed(2)} ✚/s` },
  crit:   { base: 0.012, fmt: (v) => `+${Math.round(v * 100)}% ☘` },
};

const NAMES = [
  ['Mossbun', 'Dewdrop', 'Thistlepup', 'Clovermoth', 'Elder Fernwhale'],
  ['Bubbit', 'Shelly', 'Coralpaw', 'Anemoon', 'Leviathling'],
  ['Cindermouse', 'Ashlet', 'Kilnfox', 'Magmawl', 'Phoenixa'],
  ['Snowmote', 'Icicub', 'Frostfawn', 'Glacierowl', 'Borealis Ram'],
  ['Mudpip', 'Glowtoad', 'Reedhare', 'Lanternkin', 'Bog Oracle'],
  ['Shardling', 'Gemmet', 'Prismole', 'Quartzhorn', 'Diamond Seraph'],
  ['Puffcloud', 'Zapkit', 'Galewing', 'Thundercalf', 'Tempest Roc'],
  ['Cogbug', 'Tickit', 'Springhound', 'Pendulynx', 'Chronodrake'],
  ['Sporeling', 'Petalpuff', 'Thornkit', 'Orchidra', 'Mother Bloom'],
  ['Gloomkin', 'Obsidimp', 'Voidhound', 'Riftcrow', 'The Quiet Beast'],
  ['Glimmerfly', 'Aurafox', 'Driftseal', 'Veilstag', 'Aurora Wyrmling'],
  ['Heartling', 'Echoette', 'Hollowbird', 'Memorywing', 'First Light'],
];
const RARITIES = ['common', 'common', 'rare', 'epic', 'legendary'];
const BONUS_CYCLE = ['dmg', 'hp', 'speed', 'cd', 'pickup', 'coins', 'regen', 'crit'];
const EARS = ['none', 'cat', 'bunny', 'horn', 'antenna', 'fin', 'leaf', 'crown'];
const BODIES = ['round', 'tall', 'wide', 'drop'];

export const CREATURES = [];
REALMS.forEach((realm, ri) => {
  NAMES[ri].forEach((name, i) => {
    const idx = ri * 5 + i;
    const rarity = RARITIES[i];
    const bonus = BONUS_CYCLE[(idx * 3 + ri) % BONUS_CYCLE.length];
    CREATURES.push({
      id: idx, name, realm: ri, rarity, bonus,
      value: BONUS[bonus].base * RARITY[rarity].mult,
      look: {
        body: BODIES[(idx * 7) % BODIES.length],
        ears: EARS[(idx * 5 + 3) % EARS.length],
        color: i % 2 ? realm.accent : realm.ground,
        belly: realm.glow,
        eyes: 1 + ((idx * 11) % 3 === 0 ? 1 : 0), // some have 2 big eyes, some single cyclops
        pattern: (idx * 13) % 4, // 0 plain, 1 spots, 2 stripes, 3 star
      },
    });
  });
});

// Pick a creature to put in a cage for a given realm (weighted by rarity).
export function rollCreature(rng, realmIndex, luck = 0) {
  const pool = CREATURES.filter((c) => c.realm === realmIndex);
  return rng.weighted(pool, (c) => {
    const w = RARITY[c.rarity].w;
    return c.rarity === 'common' ? w : w * (1 + luck * 4);
  });
}
