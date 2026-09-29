// ISLEBOUND — app shell: 3D + overlay loop, scene switching, rewards, achievements, leaderboard.
import { Save } from './core/save.js';
import { Input } from './core/input.js';
import { initAudio, playMusic, sfx } from './core/audio.js';
import { L } from './core/i18n.js';
import { UI } from './ui/ui.js';
import { Run } from './game/run.js';
import { Renderer3D } from './game/render3d.js';
import { REALMS } from './data/realms.js';
import { CREATURES } from './data/creatures.js';
import { ENEMIES } from './data/enemies.js';
import { ACHIEVEMENTS, SCARVES } from './data/progression.js';
import { WEAPONS } from './data/weapons.js';
import { firstClearGems } from './data/balance.js';
import { getLevel, getDaily } from './data/levels.js';
import { randomPiece } from './game/well.js';
import { creatureImage } from './core/draw.js';
import { TAU, todayKey, hexA, fmtNum } from './core/util.js';
import { metaBonuses } from './game/meta.js';
import { Leaderboard } from './core/leaderboard.js';

class App {
  constructor() {
    Save.load();
    Save.state.lang = 'en';
    this.canvas = document.getElementById('game');     // 2D: menus backdrop + in-run overlay
    this.glCanvas = document.getElementById('gl');     // 3D world
    this.ctx = this.canvas.getContext('2d');
    this.view = { w: 0, h: 0, scale: 1, dpr: 1 };
    this.mode = 'title';
    this.run = null;
    try { this.r3d = window.THREE ? new Renderer3D(this.glCanvas) : null; } catch (e) { console.warn('WebGL unavailable', e); this.r3d = null; }
    this.ui = new UI(this);
    Input.attach(this.canvas);
    Input.onKey = (code) => this.onKey(code);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    document.addEventListener('pointerdown', () => initAudio(), { once: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.run && this.run.phase === 'play' && !this.run.paused) { this.run.checkpoint(); this.ui.pause(this.run); } });
    window.addEventListener('pagehide', () => { if (this.run) this.run.checkpoint(); });
    Leaderboard.init();
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
    if (this.r3d) { this.r3d.resize(w, h); this.view.worldW = this.r3d.worldW; this.view.worldH = this.r3d.worldH; this.view.scale = w / this.r3d.worldW; }
    if (this.mode === 'hub' && this.ui.tab === 'island') this.ui.hub('island');
  }
  frame(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;
    const tt = ts / 1000;
    const c = this.ctx;
    c.setTransform(this.view.dpr, 0, 0, this.view.dpr, 0, 0);
    if (this.run) {
      this.run.update(dt, this.view);
      if (this.r3d && this.run) {
        this.r3d.render(this.run, tt);
        this.run.overlay(c, this.view, tt, (x, y, h) => this.r3d.project(x, y, h));
      }
      this.hudT -= dt;
      if (this.hudT <= 0 && this.run) { this.hudT = 0.1; this.ui.hud(this.run); }
    } else this.renderMenu(c, tt);
    if (this.hurtT > 0) { this.hurtT -= dt; c.fillStyle = `rgba(255,77,109,${this.hurtT * 0.8})`; c.fillRect(0, 0, this.view.w, this.view.h); }
    requestAnimationFrame((x) => this.frame(x));
  }
  renderMenu(c, tt) {
    const { w, h } = this.view;
    const realm = REALMS[this.ui.realmSel || 0];
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, this.mode === 'hub' || this.mode === 'results' ? realm.sky[0] : '#1d1a45'); g.addColorStop(1, '#07061a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) { const x = (i * 131.7) % w, y = ((i * 71.3) + tt * (4 + (i % 4) * 3)) % h; c.fillStyle = `rgba(255,246,232,${0.15 + 0.3 * Math.abs(Math.sin(tt + i))})`; c.fillRect(x, h - y, 1.5, 1.5); }
    if (this.mode === 'title') for (let i = 0; i < 7; i++) {
      const R = REALMS[(i * 5) % 12];
      const x = ((i * 0.17 + 0.05) % 1) * w + Math.sin(tt * 0.3 + i) * 20;
      const y = h - (((tt * (10 + i * 3) + i * 170) % (h + 200)) - 100);
      const s = 14 + (i % 3) * 10;
      c.fillStyle = hexA(R.ground, 0.35); c.beginPath(); c.ellipse(x, y, s, s * 0.3, 0, 0, TAU); c.fill();
      c.fillStyle = hexA(R.groundDark, 0.3); c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x, y + s * 1.6, x + s, y); c.fill();
    }
  }
  flashHurt() { this.hurtT = 0.25; if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) { /* no-op */ } }
  toast(msg, creature, sub, ms) {
    const box = document.getElementById('toasts');
    if (box.children.length > 3) box.firstChild.remove();
    const d = document.createElement('div');
    d.className = 'toast';
    d.innerHTML = `${creature ? `<img src="${creatureImage(creature.look, 48)}" alt="">` : ''}<div><b></b>${sub ? '<small></small>' : ''}</div>`;
    d.querySelector('b').textContent = msg;
    if (sub) d.querySelector('small').textContent = sub;
    box.appendChild(d);
    const life = ms || (sub ? 5200 : 2400);
    setTimeout(() => d.classList.add('out'), life);
    setTimeout(() => d.remove(), life + 500);
  }
  tip(type) {
    if (Save.state.showTips === false) return;
    const e = ENEMIES[type]; if (!e) return;
    this.toast(`New enemy: ${L(e.name)}`, null, e.tip, 7000);
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
    const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (this.mode === 'hub' && this.ui.tab === 'island' && this.ui.well && !typing) {
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
    if (!this.r3d) { this.toast('3D graphics are not available in this browser.', null, 'Please use a recent Chrome, Safari, Edge or Firefox.'); return; }
    this.lastLevel = level; this.lastOpts = { ...opts, resume: undefined };
    this.run = new Run(this, level, opts);
    this.run.view = this.view;
    this.r3d.build(this.run);
    this.glCanvas.hidden = false;
    this.canvas.classList.add('overlay');
    document.body.classList.add('in-run');
    this.ui.runScreen(this.run);
  }
  resumeRun() {
    const a = Save.state.activeRun;
    if (!a) return;
    let lv;
    if (a.level.kind === 'campaign') lv = getLevel(a.level.realm, a.level.stage);
    else if (a.level.kind === 'daily') lv = getDaily();
    else return;
    this.startRun(lv, { night: a.night, weapon: a.weapon, resume: a });
    this.toast(`Continuing from ${Math.floor(a.time / 60)}:${String(Math.floor(a.time % 60)).padStart(2, '0')}`, null, 'Launch again to drop back into the fight.');
  }
  saveAndQuit() {
    if (!this.run) return;
    this.run.checkpoint();
    this.run.destroy(); this.run = null;
    this.exitRunView();
    this.toast('💾 Dive saved', null, 'Continue it from the Adventure screen whenever you like.');
    this.ui.hub(this.lastLevel.kind === 'campaign' ? 'adventure' : 'daily');
    playMusic(null, 0.2);
  }
  exitRunView() { this.glCanvas.hidden = true; this.canvas.classList.remove('overlay'); document.body.classList.remove('in-run'); document.getElementById('toasts').innerHTML = ''; }
  finishRun(res) {
    const S = Save.state;
    const lv = res.level;
    if (this.run) this.run.destroy();
    this.run = null;
    this.exitRunView();
    const rewards = { coins: res.coins, gems: 0, newEchoes: [], lore: null, unlocks: [], share: null, newBest: false };
    const beforeWeapons = this.unlockedWeaponIds();
    S.stats.dives++; S.stats.kills += res.kills;
    if (res.boss) S.stats.bosses++;
    if (res.flawless) S.stats.flawless++;
    S.stats.evolutions += res.evolved.length;
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
        rewards.newBest = res.score > (prev?.score || 0);
        P[key] = { stars: best, score: Math.max(prev?.score || 0, res.score) };
      }
    } else if (lv.kind === 'daily') {
      const key = todayKey();
      const yKey = todayKey(new Date(Date.now() - 86400000));
      if (S.daily.lastKey !== key) {
        S.daily.streak = S.daily.lastKey === yKey ? S.daily.streak + 1 : 1;
        S.daily.bestStreak = Math.max(S.daily.bestStreak, S.daily.streak);
        S.daily.played++;
        S.daily.lastKey = key;
        rewards.gems += 3;
      }
      const bar = Array.from({ length: 6 }, (_, i) => (res.time >= (i + 1) * 300 - 0.5 ? '🟩' : res.time >= i * 300 ? '🟥' : '⬛')).join('');
      const prevD = S.daily.results[key];
      const best = Math.max(prevD?.score || 0, res.score);
      rewards.newBest = !prevD || res.score > (prevD.score || 0);
      rewards.share = `ISLEBOUND 🏝️ Daily #${this.ui.dayNo()}\n${L(REALMS[lv.realm].name)} ${'⭐'.repeat(res.stars)}${'▫️'.repeat(3 - res.stars)}\n${bar}\n★ ${fmtNum(best)} · 💀${res.kills} · 🐾${res.rescued.length}/3 · 🔥${S.daily.streak}`;
      S.daily.results[key] = { stars: Math.max(prevD?.stars || 0, res.stars), kills: res.kills, score: best, share: rewards.share };
    } else if (lv.kind === 'endless') {
      S.endless.runs++;
      S.endless.best = Math.max(S.endless.best, Math.floor(res.time));
      rewards.newBest = res.score > (S.endless.bestScore || 0);
      S.endless.bestScore = Math.max(S.endless.bestScore || 0, res.score);
    }
    S.gems += rewards.gems;
    const after = this.unlockedWeaponIds();
    for (const id of after) if (!beforeWeapons.includes(id)) { rewards.unlocks.push(`${WEAPONS[id].icon} New Song: ${L(WEAPONS[id].name)}`); S.weaponsUsed[id] = true; }
    S.activeRun = null;
    Save.save();
    this.checkAchievements();
    Leaderboard.submit().catch(() => {});
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
      if (!S.achievements[a.id] && a.test(S)) { S.achievements[a.id] = Date.now(); S.gems += a.gems; this.toast(`🏆 ${L(a.name)} · +◆${a.gems}`); sfx('coin'); }
    }
    Save.save();
  }
  checkGarden() { const v = this.ui.gardenValue(); if (v >= 50) this.toast(`🌷 Your Sky Garden grew ${v} coins`, null, 'Collect them on the Island tab.'); }
}

window.ISLEBOUND = new App();

// installable PWA (GitHub Pages); silently skipped where service workers aren't allowed
if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude/.test(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
