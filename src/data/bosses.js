// Realm Guardians. Each appears three times per realm:
//   stage 10 → "Echo" form   (55% HP, phase 1 only)
//   stage 20 → "Wrath" form  (80% HP, phases 1–2)
//   stage 30 → "True" form   (100% HP, phases 1–3)
// Patterns are implemented in game/bossAI.js.
export const BOSSES = {
  bramblehart:  { hp: 900,  r: 46, speed: 42, color: '#6fcf7f', eye: '#fff4b0', shape: 'bramble',
    phases: [['aimed', 'summon'], ['radial', 'charge'], ['spiral', 'summon', 'rain']], minion: 'blob',
    name: { en: 'Bramblehart', bg: 'Трънчосърд' } },
  tidemaw:      { hp: 1000, r: 50, speed: 38, color: '#53d6c8', eye: '#ffffff', shape: 'maw',
    phases: [['radial', 'aimed'], ['spiral', 'charge'], ['slam', 'spiral', 'summon']], minion: 'orbiter',
    name: { en: 'Tidemaw', bg: 'Приливна паст' } },
  cinderking:   { hp: 1100, r: 48, speed: 46, color: '#ff8a3d', eye: '#fff1a8', shape: 'crown',
    phases: [['rain', 'aimed'], ['charge', 'slam'], ['spiral', 'rain', 'summon']], minion: 'bomber',
    name: { en: 'Cinder King', bg: 'Пепелният крал' } },
  glacimoth:    { hp: 1150, r: 52, speed: 50, color: '#bfe6ff', eye: '#3a78c2', shape: 'moth',
    phases: [['radial', 'laser'], ['spiral', 'aimed'], ['laser', 'rain', 'summon']], minion: 'bat',
    name: { en: 'Glacimoth', bg: 'Ледомолец' } },
  lanternwitch: { hp: 1200, r: 44, speed: 55, color: '#dfff6b', eye: '#2b3a12', shape: 'lantern',
    phases: [['summon', 'aimed'], ['spiral', 'rain'], ['laser', 'summon', 'radial']], minion: 'wisp',
    name: { en: 'Lantern Witch', bg: 'Фенерната вещица' } },
  prismarch:    { hp: 1300, r: 50, speed: 40, color: '#c7a6ff', eye: '#7ef0ff', shape: 'prism',
    phases: [['laser', 'radial'], ['laser', 'spiral'], ['laser', 'rain', 'aimed']], minion: 'blinker',
    name: { en: 'Prismarch', bg: 'Призмарх' } },
  thunderwyrm:  { hp: 1400, r: 48, speed: 70, color: '#f7ee6b', eye: '#1c2638', shape: 'wyrm',
    phases: [['charge', 'rain'], ['charge', 'spiral'], ['charge', 'laser', 'rain']], minion: 'dasher',
    name: { en: 'Thunderwyrm', bg: 'Гръмозмей' } },
  grandgear:    { hp: 1500, r: 56, speed: 34, color: '#e0b872', eye: '#ff6b3d', shape: 'gear',
    phases: [['spiral', 'summon'], ['slam', 'spiral'], ['spiral', 'laser', 'slam']], minion: 'shielder',
    name: { en: 'The Grand Gear', bg: 'Великото зъбно колело' } },
  rotqueen:     { hp: 1600, r: 50, speed: 44, color: '#ff8ccf', eye: '#b6ff8c', shape: 'bloom',
    phases: [['summon', 'radial'], ['rain', 'aimed'], ['summon', 'spiral', 'slam']], minion: 'splitter',
    name: { en: 'Rot Queen', bg: 'Кралицата на гнилото' } },
  maw:          { hp: 1750, r: 60, speed: 48, color: '#8a6fb0', eye: '#ff5d73', shape: 'maw',
    phases: [['charge', 'slam'], ['radial', 'laser'], ['charge', 'spiral', 'summon']], minion: 'brute',
    name: { en: 'The Maw', bg: 'Пастта' } },
  aurorax:      { hp: 1900, r: 52, speed: 52, color: '#7dffc8', eye: '#c58bff', shape: 'aurora',
    phases: [['laser', 'aimed'], ['spiral', 'laser'], ['laser', 'rain', 'spiral']], minion: 'healer',
    name: { en: 'Aurorax', bg: 'Аврорекс' } },
  hollowone:    { hp: 2200, r: 58, speed: 50, color: '#ffd6e0', eye: '#2a0f1f', shape: 'heart',
    phases: [['radial', 'summon', 'aimed'], ['spiral', 'charge', 'laser'], ['rain', 'slam', 'spiral', 'summon']], minion: 'wisp',
    name: { en: 'The Hollow One', bg: 'Кухият' } },
};
export const BOSS_FORMS = {
  10: { hpMult: 0.55, phases: 1, title: { en: 'Echo of', bg: 'Ехо на' } },
  20: { hpMult: 0.8, phases: 2, title: { en: 'Wrath of', bg: 'Гневът на' } },
  30: { hpMult: 1.0, phases: 3, title: { en: '', bg: '' } },
};
// Boss spawns at this fraction of the stage timer
export const BOSS_SPAWN_AT = 0.55;
