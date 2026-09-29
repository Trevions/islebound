// Save system — localStorage with versioning + export/import codes.
const KEY = 'islebound.save.v1';

export function defaultState() {
  return {
    v: 1,
    lang: (navigator.language || 'en').toLowerCase().startsWith('bg') ? 'bg' : 'en',
    sound: { sfx: true, music: true, vol: 0.7 },
    coins: 0, gems: 0,
    progress: {},   // "r-s": { stars, best }
    night: {},      // Nightfall (hard mode) progress, same shape
    cleared: 0, totalStars: 0,
    dex: {}, housed: [], lore: {},
    island: { lands: 0, well: [], queue: [], buildings: { nest: 0 }, gardenAt: Date.now(), name: 'Pip\'s Isle' },
    stats: { dives: 0, kills: 0, bosses: 0, legendaries: 0, evolutions: 0, lines: 0, quads: 0, flawless: 0, seconds: 0, pieces: 0 },
    evosSeen: {}, achievements: {},
    daily: { lastKey: null, streak: 0, bestStreak: 0, played: 0, results: {} },
    endless: { best: 0, runs: 0 },
    cosmetics: { hat: 'none', trail: 'none', scarf: 0, hats: ['none'], trails: ['none'] },
    weaponsUsed: {}, lastWeapon: 'spark',
    tutorialDone: false, createdAt: Date.now(),
  };
}

function merge(base, loaded) {
  for (const k in loaded) {
    if (loaded[k] && typeof loaded[k] === 'object' && !Array.isArray(loaded[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], loaded[k]);
    else base[k] = loaded[k];
  }
  return base;
}

export const Save = {
  state: defaultState(),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = merge(defaultState(), JSON.parse(raw));
    } catch (e) { /* storage unavailable — play without persistence */ }
    return this.state;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  },
  reset() { this.state = defaultState(); this.save(); },
  exportCode() {
    return btoa(unescape(encodeURIComponent(JSON.stringify(this.state))));
  },
  importCode(code) {
    const obj = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!obj || obj.v !== 1) throw new Error('bad save');
    this.state = merge(defaultState(), obj);
    this.save();
  },
};
