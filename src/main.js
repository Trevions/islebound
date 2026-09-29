// ISLEBOUND — app shell: canvas loop, scene switching, rewards, achievements.
import { Save } from './core/save.js';
import { Input } from './core/input.js';
import { initAudio, playMusic, sfx } from './core/audio.js';
import { t, L } from './core/i18n.js';
import { UI } from './ui/ui.js';
import { Run } from './game/run.js';
import { REALMS } from './data/realms.js';
import { CREATURES } from './data/creatures.js';
import { ACHIEVEMENTS, SCARVES } from './data/progression.js';
import { WEAPONS } from './data/weapons.js';
import { firstClearGems } from './data/balance.js';
import { randomPiece } from './game/well.js';
import { creatureImage } from './core/draw.js';
import { TAU, todayKey, hexA } from './core/util.js';
import { metaBonuses } from './game/meta.js';

class App {
  constructor() {
    Save.load();
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.view = { w: 0, h: 0, scale: 1, dpr: 1 };
    this.mode = 'title';
    this.run = null;
    this.ui = new UI(this);
    Input.attach(this.canvas);
    Input.onKey = (code) => this.onKey(code);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    document.addEventListener('pointerdown', () => initAudio(), { once: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.run && this.run.phase === 'play' && !this.run.paused) this.ui.pause(this.run); });
    this.ui.title();
    this.last = performance.now();
    this.hudT = 0;
    requestAnimationFrame((ts) => this.frame(ts));
  }
  scarfColor() { return SCARVES[Save.state.cosmetics.scarf] || SCARVES[0]; }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.view = { w, h, dpr, scale: Math.max(0.8, Math.min(w, h) / 430) };
    if (this.mode === 'hub' && this.ui.tab === 'island') this.ui.hub('island');
  }
  frame(ts) {
    let dt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;
    const tt = ts / 1000;
    const c = this.ctx;
    c.setTransform(this.view.dpr, 0, 0, this.view.dpr, 0, 0);
    if (this.run) {
      this.run.update(dt, this.view);
      this.run.render(c, this.view, tt);
      this.hudT -= dt;
      if (this.hudT <= 0) { this.hudT = 0.1; this.ui.hud(this.run); }
    } else this.renderMenu(c, tt);
    if (this.hurtT > 0) { this.hurtT -= dt; c.fillStyle = `rgba(255,77,109,${this.hurtT * 0.8})`; c.fillRect(0, 0, this.view.w, this.view.h); }
    requestAnimationFrame((x) => this.frame(x));
  }
  renderMenu(c, tt) {
    const { w, h } = this.view;
    const realm = REALMS[this.ui.realmSel || 0];
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, this.mode === 'title' ? '#1d1a45' : realm.sky[0]); g.addColorStop(1, '#07061a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) { const x = (i * 131.7) % w, y = ((i * 71.3) + tt * (4 + (i % 4) * 3)) % h; c.fillStyle = `rgba(255,246,232,${0.15 + 0.3 * Math.abs(Math.sin(tt + i))})`; c.fillRect(x, h - y, 1.5, 1.5); }
    // falling island shards drift upward (we're the ones falling)
    for (let i = 0; i < (this.mode === 'title' ? 7 : 0); i++) {
      const R = REALMS[(i * 5) % 12];
      const x = ((i * 0.17 + 0.05) % 1) * w + Math.sin(tt * 0.3 + i) * 20;
      const y = h - (((tt * (10 + i * 3) + i * 170) % (h + 200)) - 100);
      const s = 14 + (i % 3) * 10;
      c.fillStyle = hexA(R.ground, 0.35); c.beginPath(); c.ellipse(x, y, s, s * 0.3, 0, 0, TAU); c.fill();
      c.fillStyle = hexA(R.groundDark, 0.3); c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x, y + s * 1.6, x + s, y); c.fill();
    }
  }
  flashHurt() { this.hurtT = 0.25; if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) { /* no-op */ } }
  toast(msg, creature, sub) {
    const box = document.getElementById('toasts');
    const d = document.createElement('div');
    d.className = 'toast';
    d.innerHTML = `${creature ? `<img src="${creatureImage(creature.look, 48)}" alt="">` : ''}<div><b></b>${sub ? '<small></small>' : ''}</div>`;
    d.querySelector('b').textContent = msg;
    if (sub) d.querySelector('small').textContent = sub;
    box.appendChild(d);
    setTimeout(() => d.classList.add('out'), sub ? 4200 : 2200);
    setTimeout(() => d.remove(), sub ? 4700 : 2700);
  }
  onKey(code) {
    if (this.run && (code === 'Escape' || code === 'KeyP')) {
      if (this.run.paused && this.ui.cur && this.ui.cur.querySelector('.pause-sheet')) { this.ui.closeModal(); this.run.paused = false; }
      else if (!this.run.paused && this.run.phase === 'play') this.ui.pause(this.run);
    }
    if (this.run && this.run.paused && this.ui.cur) {
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[code];
      const btn = n !== undefined && this.ui.cur.querySelector(`[data-pick="${n}"]`);
      if (btn) btn.click();
    }
    if (this.mode === 'hub' && this.ui.tab === 'island' && this.ui.well) {
      const w = this.ui.well;
      if (code === 'ArrowLeft' || code === 'KeyA') w.move(-1);
      if (code === 'ArrowRight' || code === 'KeyD') w.move(1);
      if (code === 'ArrowUp' || code === 'KeyW') w.rotate();
      if (code === 'ArrowDown' || code === 'KeyS') w.soft();
      if (code === 'Space' || code === 'Enter') w.drop();
    }
  }
  startRun(level, opts = {}) {
    initAudio();
    if (this.run) this.run.destroy();
    this.lastLevel = level; this.lastOpts = opts;
    this.run = new Run(this, level, opts);
    this.run.view = this.view;
    this.ui.runScreen(this.run);
  }
  finishRun(res) {
    const S = Save.state;
    const lv = res.level;
    this.run.destroy(); this.run = null;
    const rewards = { coins: res.coins, gems: 0, newEchoes: [], lore: null, unlocks: [], share: null };
    const beforeWeapons = this.unlockedWeaponIds();
    S.stats.dives++; S.stats.kills += res.kills;
    if (res.boss) S.stats.bosses++;
    if (res.flawless) S.stats.flawless++;
    S.stats.evolutions += res.evolved.length;
    // Echoes rescued count even on defeat (you got them out!)
    for (const id of res.rescued) {
      if (!S.dex[id]) { rewards.newEchoes.push(id); if (CREATURES[id].rarity === 'legendary') S.stats.legendaries++; }
      S.dex[id] = (S.dex[id] || 0) + 1;
      const cap = metaBonuses(S).nestCap;
      if (!S.housed.includes(id) && S.housed.length < cap) S.housed.push(id);
    }
    if (res.lore !== null && res.lore !== undefined && !S.lore[res.lore]) { S.lore[res.lore] = true; rewards.lore = res.lore; }
    S.coins += res.coins;
    for (let i = 0; i < res.pieces; i++) S.island.queue.push(randomPiece());
    if (lv.kind === 'campaign') {
      const key = `${lv.realm}-${lv.stage}`;
      const P = res.night ? S.night : S.progress;
      const prev = P[key];
      if (res.win) {
        if (!prev) { rewards.gems += firstClearGems(lv.stage); if (!res.night) S.cleared++; }
        const best = Math.max(prev?.stars || 0, res.stars);
        if (!res.night) S.totalStars += best - (prev?.stars || 0);
        P[key] = { stars: best, best: Math.max(prev?.best || 0, res.kills) };
      }
    } else if (lv.kind === 'daily') {
      const key = todayKey();
      const y = new Date(Date.now() - 86400000);
      const yKey = todayKey(y);
      if (S.daily.lastKey !== key) {
        S.daily.streak = S.daily.lastKey === yKey ? S.daily.streak + 1 : 1;
        S.daily.bestStreak = Math.max(S.daily.bestStreak, S.daily.streak);
        S.daily.played++;
        S.daily.lastKey = key;
        rewards.gems += 3;
      }
      const segs = 6;
      const bar = Array.from({ length: segs }, (_, i) => (res.time >= (i + 1) * (lv.duration / segs) - 0.5 ? '🟩' : res.time >= i * (lv.duration / segs) ? '🟥' : '⬛')).join('');
      rewards.share = `ISLEBOUND 🏝️ Daily #${this.ui.dayNo()}\n${L(REALMS[lv.realm].name)} ${'⭐'.repeat(res.stars)}${'▫️'.repeat(3 - res.stars)}\n${bar}\n💀${res.kills} 🐾${res.rescued.length}/3 🔥${S.daily.streak}`;
      S.daily.results[key] = { stars: res.stars, kills: res.kills, share: rewards.share };
    } else if (lv.kind === 'endless') {
      S.endless.runs++;
      S.endless.best = Math.max(S.endless.best, Math.floor(res.time));
    }
    S.gems += rewards.gems;
    const after = this.unlockedWeaponIds();
    for (const id of after) if (!beforeWeapons.includes(id)) { rewards.unlocks.push(`${WEAPONS[id].icon} ${L(WEAPONS[id].name)}`); S.weaponsUsed[id] = true; }
    if (!S.tutorialDone) S.tutorialDone = true;
    Save.save();
    this.checkAchievements();
    rewards.gems = rewards.gems; // shown
    this.ui.results(res, rewards);
    playMusic(null, 0.2);
  }
  unlockedWeaponIds() {
    const S = Save.state;
    return Object.keys(WEAPONS).filter((id) => { const u = WEAPONS[id].unlock; if (!u) return true; if (u.g) return S.cleared >= u.g; if (u.creatures) return Object.keys(S.dex).length >= u.creatures; return false; });
  }
  checkAchievements() {
    const S = Save.state;
    for (const a of ACHIEVEMENTS) {
      if (!S.achievements[a.id] && a.test(S)) {
        S.achievements[a.id] = Date.now(); S.gems += a.gems;
        this.toast(`🏆 ${L(a.name)} · ◆${a.gems}`);
        sfx('coin');
      }
    }
    Save.save();
  }
  checkGarden() {
    const v = this.ui.gardenValue();
    if (v >= 50) this.toast(`🌷 ${t('gardenCollect')}: +${v} ◉`);
  }
}

// module scripts run after the document is parsed
window.ISLEBOUND = new App();

// installable PWA (GitHub Pages); silently skipped where service workers aren't allowed
if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.includes('claude')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
