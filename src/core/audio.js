// Procedural audio: every sound and every note is synthesized — zero audio files.
import { Save } from './save.js';

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const last = {}; // throttle identical sfx

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = Save.state.sound.vol ?? 0.7;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function tone({ f = 440, f2, type = 'sine', dur = 0.12, vol = 0.3, att = 0.005, bus = sfxBus, when = 0, detune = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise({ dur = 0.2, vol = 0.3, freq = 1200, q = 1, type = 'bandpass', when = 0, f2 }) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(sfxBus);
  s.start(t); s.stop(t + dur + 0.02);
}

const SFX = {
  shoot: () => tone({ f: 880, f2: 1320, type: 'triangle', dur: 0.06, vol: 0.05 }),
  hit: () => tone({ f: 300, f2: 120, type: 'square', dur: 0.05, vol: 0.04 }),
  kill: () => { tone({ f: 520, f2: 260, type: 'triangle', dur: 0.09, vol: 0.08 }); noise({ dur: 0.08, vol: 0.05, freq: 2400 }); },
  gem: (p = 0) => tone({ f: 900 + p * 40, type: 'sine', dur: 0.07, vol: 0.06 }),
  coin: () => { tone({ f: 1320, type: 'square', dur: 0.05, vol: 0.04 }); tone({ f: 1760, type: 'square', dur: 0.08, vol: 0.04, when: 0.05 }); },
  hurt: () => { tone({ f: 220, f2: 90, type: 'sawtooth', dur: 0.18, vol: 0.14 }); noise({ dur: 0.15, vol: 0.12, freq: 600 }); },
  levelup: () => [0, 4, 7, 12, 16].forEach((n, i) => tone({ f: 523 * Math.pow(2, n / 12), type: 'triangle', dur: 0.22, vol: 0.12, when: i * 0.06 })),
  pick: () => { tone({ f: 660, type: 'sine', dur: 0.1, vol: 0.12 }); tone({ f: 990, type: 'sine', dur: 0.16, vol: 0.1, when: 0.07 }); },
  evolve: () => [0, 7, 12, 19, 24, 31].forEach((n, i) => tone({ f: 330 * Math.pow(2, n / 12), type: 'sawtooth', dur: 0.4, vol: 0.07, when: i * 0.07 })),
  launch: () => { noise({ dur: 0.5, vol: 0.2, freq: 400, f2: 3000, q: 2 }); tone({ f: 200, f2: 800, type: 'sine', dur: 0.4, vol: 0.12 }); },
  stretch: () => tone({ f: 180, f2: 240, type: 'triangle', dur: 0.05, vol: 0.03 }),
  land: () => { tone({ f: 120, f2: 40, type: 'sine', dur: 0.35, vol: 0.4 }); noise({ dur: 0.3, vol: 0.2, freq: 300, type: 'lowpass' }); },
  boom: () => { tone({ f: 90, f2: 30, type: 'sine', dur: 0.4, vol: 0.3 }); noise({ dur: 0.35, vol: 0.2, freq: 500, type: 'lowpass' }); },
  cage: () => [0, 5, 9, 12].forEach((n, i) => tone({ f: 784 * Math.pow(2, n / 12), type: 'sine', dur: 0.3, vol: 0.1, when: i * 0.08 })),
  boss: () => { tone({ f: 70, f2: 45, type: 'sawtooth', dur: 1.2, vol: 0.25 }); noise({ dur: 1.2, vol: 0.15, freq: 200, type: 'lowpass' }); },
  line: (n = 1) => [0, 4, 7, 11, 14, 19].slice(0, 2 + n).forEach((s, i) => tone({ f: 440 * Math.pow(2, s / 12), type: 'square', dur: 0.18, vol: 0.06, when: i * 0.05 })),
  place: () => tone({ f: 200, f2: 140, type: 'square', dur: 0.06, vol: 0.06 }),
  move: () => tone({ f: 500, type: 'square', dur: 0.025, vol: 0.02 }),
  ui: () => tone({ f: 740, type: 'sine', dur: 0.05, vol: 0.05 }),
  win: () => [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => tone({ f: 392 * Math.pow(2, n / 12), type: 'triangle', dur: 0.3, vol: 0.1, when: i * 0.1 })),
  lose: () => [12, 7, 3, 0].forEach((n, i) => tone({ f: 330 * Math.pow(2, n / 12), type: 'triangle', dur: 0.4, vol: 0.1, when: i * 0.18 })),
  zap: () => noise({ dur: 0.12, vol: 0.06, freq: 3000, q: 4 }),
  whoosh: () => noise({ dur: 0.2, vol: 0.05, freq: 800, f2: 2400, q: 1.5 }),
};

export function sfx(name, arg) {
  if (!ctx || !Save.state.sound.sfx) return;
  const now = performance.now();
  if (last[name] && now - last[name] < 45) return;
  last[name] = now;
  SFX[name] && SFX[name](arg);
}

// ── Generative music ─────────────────────────────────────────
let music = null;
export function playMusic(realm, intensity = 0.5) {
  if (!ctx) return;
  stopMusic();
  if (!Save.state.sound.music) return;
  const scale = realm ? realm.scale : [0, 2, 4, 7, 9];
  const root = realm ? realm.root : 196;
  const bpm = 88 + intensity * 20;
  const step = 60 / bpm / 2;
  const chords = [[0, 2, 4], [3, 0, 2], [4, 1, 3], [2, 4, 1]];
  let n = 0, next = ctx.currentTime + 0.1;
  const note = (deg, oct = 0) => root * Math.pow(2, (scale[((deg % scale.length) + scale.length) % scale.length] + 12 * (oct + Math.floor(deg / scale.length))) / 12);
  const tick = () => {
    while (next < ctx.currentTime + 0.25) {
      const bar = Math.floor(n / 8), beat = n % 8;
      const ch = chords[bar % 4];
      const when = next - ctx.currentTime;
      if (beat === 0) ch.forEach((d, i) => tone({ f: note(d, -1), type: 'sine', dur: step * 8.2, vol: 0.05, att: 0.4, bus: musicBus, when, detune: i * 4 - 4 }));
      if (beat === 0 || beat === 4) tone({ f: note(ch[0], -2), type: 'triangle', dur: step * 3, vol: 0.09, bus: musicBus, when });
      const arp = [0, 1, 2, 1, 2, 3, 2, 1][beat];
      if (Math.random() < 0.55 + intensity * 0.35) tone({ f: note(ch[arp % 3] + (arp === 3 ? 2 : 0), 1), type: 'triangle', dur: step * 1.6, vol: 0.035, bus: musicBus, when });
      if (intensity > 0.4 && (beat === 0 || beat === 4)) tone({ f: 60, f2: 40, type: 'sine', dur: 0.2, vol: 0.12 * intensity, bus: musicBus, when });
      if (intensity > 0.6 && beat % 2 === 1) noiseHat(when);
      next += step; n++;
    }
  };
  const noiseHat = (when) => {
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(fl).connect(g).connect(musicBus); s.start(t); s.stop(t + 0.06);
  };
  music = setInterval(tick, 80);
  tick();
}
export function stopMusic() { if (music) clearInterval(music); music = null; }
export function setVolume(v) { if (master) master.gain.value = v; }
