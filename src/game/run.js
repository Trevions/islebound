// A single 30-minute dive: slingshot launch → 6 waves → champions → Guardian → results.
// Pure game logic. Drawing lives in render3d.js (world) and overlay() below (HUD-space).
import * as B from '../data/balance.js';
import { REALMS } from '../data/realms.js';
import { ENEMIES, ENEMY_ORDER, ELITE, eliteRate } from '../data/enemies.js';
import { BOSSES } from '../data/bosses.js';
import { WEAPONS, PASSIVES, WEAPON_MAX, PASSIVE_MAX } from '../data/weapons.js';
import { rollCreature, CREATURES } from '../data/creatures.js';
import { LORE } from '../data/lore.js';
import { WAVE_THEMES } from '../data/levels.js';
import { RNG } from '../core/rng.js';
import { TAU, clamp, dist2, rnd, pick, mixHex, hexA, fmtTime, fmtNum } from '../core/util.js';
import { Input } from '../core/input.js';
import { sfx, playMusic } from '../core/audio.js';
import { L } from '../core/i18n.js';
import { Save } from '../core/save.js';
import { metaBonuses } from './meta.js';
import { tickWeapon, updateProj } from './weapons.js';
import { updateEnemy, separate } from './enemyAI.js';
import { updateBoss } from './bossAI.js';
import { FX } from './fx.js';

let PID = 1;

export class Run {
  constructor(app, level, opts = {}) {
    this.app = app; this.level = level; this.opts = opts;
    this.S = Save.state;
    this.realm = REALMS[level.realm];
    this.night = !!opts.night;
    this.rng = new RNG(level.kind === 'daily' ? level.seed : `${level.seed}-${Date.now()}`);
    this.muts = new Set(level.mutators || []);
    const g = level.g;
    this.hpMult = B.enemyHpMult(g) * (this.muts.has('heavy') ? 1.5 : 1) * (this.muts.has('tiny') ? 0.6 : 1) * (this.night ? 1.8 : 1);
    this.dmgMult = B.enemyDmgMult(g) * (this.muts.has('glass') ? 1.5 : 1) * (this.night ? 1.5 : 1);
    this.spawnK = (this.muts.has('frenzy') ? 1.4 : 1) * (this.muts.has('tiny') ? 1.6 : 1);
    this.scoreMult = B.levelScoreMult(g, this.night);
    const R = this.realm;
    this.pal = { body: mixHex('#1d1530', R.void, 0.3), rim: R.accent, eye: R.glow };
    // which enemy archetypes the player is ready for (introduced gradually)
    this.allowed = new Set([...level.pool, ...ENEMY_ORDER.slice(0, 3 + Math.floor(g / 8))]);

    this.time = 0; this.phase = 'launch'; this.paused = false;
    this.enemies = []; this.projs = []; this.ebullets = []; this.gems = []; this.coins = []; this.zones = []; this.teles = []; this.pickups = [];
    this.timers = []; this.fx = new FX(); this.cages = []; this.boss = null; this.laser = null;
    this.kills = 0; this.spawnAcc = 0; this.shakeT = 0; this.shakeMag = 0; this.hitCount = 0; this.bannerText = null;
    this.rescued = []; this.loreFound = null; this.chests = 0; this.evolved = [];
    this.score = 0; this.combo = 0; this.comboT = 0; this.bestCombo = 0; this.coinsGot = 0;
    this.breakdown = { kills: 0, coins: 0, echoes: 0, stones: 0, time: 0, waves: 0, clear: 0, hp: 0 };
    this.wave = -1; this.waveHits = 0; this.cleanWaves = 0; this.champions = 0;
    this.events = { champ: 0, cage: 0, rain: 0, sprite: 0 };
    this.rainT = 0;
    this.cam = { x: 0, y: 0 };

    const mb = metaBonuses(this.S);
    this.meta = mb;
    this.baseStats = {
      dmg: 1 + mb.dmg, cd: 1 - Math.min(0.5, mb.cd), area: 1, dur: 1, speed: B.HERO.speed * (1 + mb.speed),
      maxHp: B.HERO.hp + mb.hp, pickup: B.HERO.pickup * (1 + mb.pickup) * (this.muts.has('gravity') ? 4 : 1), armor: 0, regen: mb.regen,
      crit: 0.05 + mb.crit, luck: 0, coins: (1 + mb.coins) * (this.muts.has('goldrush') ? 2 : 1) * (this.night ? 1.5 : 1),
    };
    if (this.muts.has('glass')) this.baseStats.dmg *= 1.5;
    this.rerolls = mb.rerolls; this.revive = mb.revive;
    this.weapons = [{ id: opts.weapon || 'spark', lvl: 1, t: 0.5 }];
    this.passives = {};
    this.recompute();
    this.player = { x: 0, y: 0, r: 13, hp: this.stats.maxHp, iframe: 0, faceA: 0, face: 1, moving: 0, lift: 0, squash: 0 };
    this.xp = 0; this.plevel = 1; this.xpNeed = B.xpToNext(1);
    this.pendingLevels = 0;

    // launch: a sleeping void-nest to aim at
    this.launch = { pulling: false, px: 0, py: 0, fly: null };
    const na = rnd(TAU), nd = rnd(230, 330);
    this.nest = { x: Math.cos(na) * nd, y: Math.sin(na) * nd };
    const nestCount = 7 + Math.min(8, Math.floor(level.g / 20));
    for (let i = 0; i < nestCount; i++) { const e = this.spawnEnemy(level.pool[0], this.nest.x + rnd(-55, 55), this.nest.y + rnd(-55, 55)); e.asleep = true; }
    // memory stone appears at a random minute
    if (level.loreChance && Math.random() < level.loreChance) {
      const idxs = [0, 1, 2].map((k) => level.realm * 3 + k).filter((k) => !this.S.lore[k]);
      if (idxs.length) this.stonePlan = { at: rnd(90, 1400), idx: pick(idxs) };
    }
    this.hazardCurrent = null;
    this.bossSpawned = false;
    this.flawless = true;
    this.duration = level.duration;
    this.autosaveT = B.AUTOSAVE_EVERY;
    if (opts.resume) this.applySnapshot(opts.resume);
    playMusic(this.realm, 0.3);
    Input.handlers.down = (p) => this.onDown(p);
    Input.handlers.move = (p) => this.onMove(p);
    Input.handlers.up = (p) => this.onUp(p);
  }

  destroy() { Input.handlers.down = Input.handlers.move = Input.handlers.up = null; }
  get minute() { return this.time / 60; }

  // ── stats ──────────────────────────────────────────
  recompute() {
    const b = this.baseStats, p = this.passives;
    const lv = (k) => p[k] || 0;
    const oldMax = this.stats ? this.stats.maxHp : b.maxHp;
    this.stats = {
      dmg: b.dmg * (1 + lv('might') * PASSIVES.might.per),
      cd: b.cd * Math.pow(1 - PASSIVES.haste.per, lv('haste')),
      area: b.area * (1 + lv('area') * PASSIVES.area.per),
      dur: b.dur * (1 + lv('duration') * PASSIVES.duration.per),
      speed: b.speed * (1 + lv('swift') * PASSIVES.swift.per),
      maxHp: b.maxHp + lv('vigor') * PASSIVES.vigor.per,
      pickup: b.pickup * (1 + lv('magnet') * PASSIVES.magnet.per),
      armor: b.armor + lv('armor') * PASSIVES.armor.per,
      regen: b.regen + lv('regen') * PASSIVES.regen.per,
      crit: b.crit + lv('luck') * PASSIVES.luck.per,
      luck: lv('luck'),
      coins: b.coins,
    };
    if (this.player && this.stats.maxHp > oldMax) this.player.hp += this.stats.maxHp - oldMax;
  }

  // ── score & coins ──────────────────────────────────
  addScore(pts, cat, x, y) {
    const v = Math.round(pts * this.scoreMult);
    this.score += v;
    if (cat) this.breakdown[cat] += v;
    if (x !== undefined && v >= 500) this.fx.text(x, y, `+${fmtNum(v)}`, '#7dffc8', true);
    return v;
  }
  dropCoin(x, y, value) {
    const v = value * this.stats.coins;
    if (this.coins.length > 150) { const c = this.coins[(Math.random() * this.coins.length) | 0]; c.v += v; return; }
    this.coins.push({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), v, t: rnd(10), magnet: false, big: value >= 10 });
  }

  // ── spawning ───────────────────────────────────────
  theme() { const w = this.level.waves[Math.min(this.level.waves.length - 1, this.waveIdx())]; return WAVE_THEMES[w] || WAVE_THEMES.drift; }
  waveIdx() { const i = Math.floor(this.time / B.WAVE_LEN); return this.level.kind === 'endless' ? i % this.level.waves.length : Math.min(B.WAVES - 1, i); }
  spawnEnemy(type, x, y, elite = false) {
    const d = ENEMIES[type] || ENEMIES.blob;
    const tiny = this.muts.has('tiny');
    const m = this.phase === 'play' ? this.minute : 0;
    const th = this.phase === 'play' ? this.theme() : WAVE_THEMES.drift;
    const endless = this.level.kind === 'endless' ? 1 + Math.max(0, m - 30) * 0.4 : 1;
    const hp = d.hp * this.hpMult * B.inRunHpRamp(Math.min(m, 30)) * th.hp * endless * (elite ? ELITE.hpMult : 1);
    const e = {
      type, x, y, vx: 0, vy: 0, t: 0, seed: rnd(100), hp, maxHp: hp,
      r: d.r * (elite ? ELITE.rMult : 1) * (tiny ? 0.7 : 1),
      speed: d.speed * (elite ? ELITE.speedMult : 1) * (tiny ? 1.25 : 1) * (this.muts.has('heavy') ? 0.85 : 1) * rnd(0.92, 1.08),
      dmg: d.dmg * this.dmgMult * B.inRunDmgRamp(Math.min(m, 30)) * (elite ? ELITE.dmgMult : 1),
      ai: d.ai, shape: d.shape, xp: d.xp, elite, split: d.split, flash: 0, kx: 0, ky: 0,
    };
    this.enemies.push(e);
    if (!this.S.seenEnemies) this.S.seenEnemies = {};
    if (!this.S.seenEnemies[type] && this.phase === 'play') { this.S.seenEnemies[type] = true; this.app.tip(type); }
    return e;
  }
  // spawn just outside the visible area (an ellipse matching the tilted 3D view)
  spawnRing(type, elite = false, extra = 40) {
    const a = rnd(TAU), rx = this.view.ww / 2 + extra, ry = this.view.wh / 2 + extra;
    const k = Math.sin(a) < 0 ? 1.15 : 0.9; // the far (top) side of the screen reaches further
    return this.spawnEnemy(type, this.player.x + Math.cos(a) * rx, this.player.y + Math.sin(a) * ry * k, elite);
  }
  pickType() {
    const th = this.theme();
    if (th.mix && Math.random() < 0.6) {
      const mix = th.mix.filter((t) => this.allowed.has(t));
      if (mix.length) return this.rng.pick(mix);
    }
    return this.rng.pick(this.level.pool);
  }
  spawnChampion() {
    const type = this.level.elite || 'brute';
    const e = this.spawnRing(type, true, 60);
    e.champion = true; e.hp = e.maxHp = (e.maxHp / ELITE.hpMult) * 28; e.r *= 1.5; e.dmg *= 1.3; e.speed *= 0.9;
    this.champions++;
    this.banner('⚔ A Champion approaches!', 'Defeat it for a golden chest and a Resonance.');
    sfx('boss'); this.shake(8);
  }
  spawnBoss(saved) {
    const lb = this.level.boss;
    const def = BOSSES[lb.id];
    const hp = def.hp * lb.form.hpMult * this.hpMult * 9;
    const a = rnd(TAU);
    this.boss = { def, form: lb.form, x: this.player.x + Math.cos(a) * 330, y: this.player.y + Math.sin(a) * 330, r: def.r, hp: saved ?? hp, maxHp: hp, t: 0, phase: 0, pi: 0, cool: 2, action: null, dmg: 14 * this.dmgMult * B.inRunDmgRamp(25), flash: 0, isBoss: true, kx: 0, ky: 0 };
    this.bossSpawned = true;
    this.banner(`${L(lb.form.title)} ${L(def.name)}`.trim(), 'The Guardian has arrived. Defeat it to clear the stage!');
    sfx('boss'); this.shake(14);
    playMusic(this.realm, 0.95);
  }
  spawnCage() {
    const a = rnd(TAU), d = rnd(480, 720);
    const c = this.level.kind === 'daily' ? rollCreature(this.rng, this.level.realm, 0) : rollCreature(new RNG((Math.random() * 1e9) | 0), this.level.realm, this.stats.luck);
    this.cages.push({ x: this.player.x + Math.cos(a) * d, y: this.player.y + Math.sin(a) * d, creature: c, progress: 0, open: false, t: rnd(10) });
    this.banner('🐾 An Echo is calling for help!', 'Follow the arrow and stand next to the cage to free it.');
    sfx('cage');
  }

  // ── combat API used by weapons/AI ─────────────────────
  addProj(p) { p.id = PID++; this.projs.push(p); }
  enemyShot(x, y, a, sp, dmg, r = 6) { if (this.ebullets.length < 400) this.ebullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg, r, life: 5 }); }
  telegraph(o) { this.teles.push({ ...o, max: o.t }); }
  telegraphLine(x, y, a, len, w, t) { this.teles.push({ line: true, x, y, a, len, w, t, max: t, color: '#ff4d6d' }); }
  later(delay, fn) { if (delay <= 0) fn(); else this.timers.push({ t: delay, fn }); }
  shake(m) { this.shakeMag = Math.max(this.shakeMag, m); this.shakeT = 0.25; }
  banner(text, sub = '') { this.bannerText = { text, sub, t: 3.2 }; }
  heal(n) { const P = this.player; P.hp = Math.min(this.stats.maxHp, P.hp + n); }
  hazardHit(x, y, r, dmg) { const P = this.player; if (dist2(x, y, P.x, P.y) < (r + P.r) ** 2) this.hurtPlayer(dmg, x, y); }
  explodeAt(x, y, r, dmg) { this.fx.ring(x, y, r, '#ff8a3d', 0.35, 8); this.fx.burst(x, y, '#ffb070', 14, 220); this.hazardHit(x, y, r, dmg); sfx('boom'); this.shake(5); }

  damage(e, dmg, sx, sy, knock = 0) {
    if (e.dead) return;
    let d = dmg;
    const crit = Math.random() < this.stats.crit;
    if (crit) d *= 2;
    if (e.ai === 'shield' && !e.isBoss) {
      const a = Math.atan2(sy - e.y, sx - e.x);
      const diff = Math.abs(((a - (e.shieldA || 0) + Math.PI * 3) % TAU) - Math.PI);
      if (diff < 1) { d *= 0.25; this.fx.burst(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, '#cfe9ff', 2, 90, 2); }
    }
    e.hp -= d; e.flash = 0.08;
    if (e.asleep) e.asleep = false;
    if (knock && !e.isBoss && !e.champion) {
      const a = Math.atan2(e.y - sy, e.x - sx), k = knock * (e.elite ? 0.3 : 1) * (e.type === 'brute' ? 0.4 : 1);
      e.kx += Math.cos(a) * k; e.ky += Math.sin(a) * k;
    }
    if (this.fx.texts.length < 50 || crit) this.fx.text(e.x, e.y - e.r, Math.round(d).toString(), crit ? '#ffd166' : '#ffffff', crit);
    sfx('hit');
    if (e.hp <= 0) e.isBoss ? this.killBoss() : this.kill(e);
  }
  kill(e, silent = false) {
    if (e.dead) return;
    e.dead = true; this.kills++;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = B.COMBO_WINDOW;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const kind = e.champion ? 'champion' : e.elite ? 'elite' : e.xp === 'mid' ? 'mid' : 'small';
    this.addScore(B.SCORE.kill[kind] * B.comboMult(this.combo), 'kills', e.x, e.y - 20);
    this.fx.burst(e.x, e.y, this.pal.rim, e.elite ? 24 : 8, 180);
    if (!silent) sfx('kill');
    if (e.split && e.r > 9) for (let i = 0; i < e.split; i++) { const c = this.spawnEnemy('blob', e.x + rnd(-8, 8), e.y + rnd(-8, 8)); c.r = e.r * 0.62; c.hp = c.maxHp = e.maxHp * 0.3; c.shape = 'splitter'; }
    this.dropGem(e.x, e.y, e.champion ? B.GEM_XP.boss : e.elite ? B.GEM_XP.big * 2 : B.GEM_XP[e.xp] || 1);
    if (e.type === 'sprite') { for (let i = 0; i < 12; i++) this.dropCoin(e.x + rnd(-30, 30), e.y + rnd(-30, 30), B.COIN_VALUE.sprite / 12); this.banner('💰 Coin Sprite caught!'); }
    else if (Math.random() < B.COIN_DROP[kind]) this.dropCoin(e.x, e.y, B.COIN_VALUE[kind]);
    if (e.champion) { this.pickups.push({ kind: 'chest', gold: true, x: e.x, y: e.y, t: 0 }); this.shake(10); sfx('boom'); this.banner('🏆 Champion defeated!', 'Grab the golden chest.'); }
    else if (e.elite) { this.pickups.push({ kind: 'chest', x: e.x, y: e.y, t: 0 }); this.shake(6); }
    else if (Math.random() < 0.01 + this.stats.luck * 0.004) this.pickups.push({ kind: 'heart', x: e.x, y: e.y, t: 0 });
    else if (Math.random() < 0.003) this.pickups.push({ kind: 'magnet', x: e.x, y: e.y, t: 0 });
  }
  killBoss() {
    const b = this.boss; if (b.dead) return;
    b.dead = true; this.bossKilled = true;
    this.addScore(B.SCORE.kill.guardian, 'kills', b.x, b.y);
    for (let i = 0; i < 6; i++) this.later(i * 0.12, () => { this.fx.burst(b.x + rnd(-40, 40), b.y + rnd(-40, 40), b.def.color, 30, 300, 5); sfx('boom'); this.shake(12); });
    for (let i = 0; i < 12; i++) this.dropGem(b.x + rnd(-60, 60), b.y + rnd(-60, 60), B.GEM_XP.boss / 4);
    for (let i = 0; i < 16; i++) this.dropCoin(b.x + rnd(-70, 70), b.y + rnd(-70, 70), B.COIN_VALUE.guardian / 16);
    this.ebullets.length = 0; this.laser = null;
    for (const e of this.enemies) if (!e.dead) this.kill(e, true);
    this.banner('👑 Guardian defeated!', 'Collect the loot — the stage clears in a few seconds.');
    playMusic(this.realm, 0.4);
    this.later(6, () => this.end(true));
  }
  dropGem(x, y, v) {
    const xpK = this.muts.has('frenzy') ? 1.3 : 1;
    if (this.gems.length > 260) { const g = this.gems[(Math.random() * this.gems.length) | 0]; g.v += v * xpK; g.big = true; return; }
    this.gems.push({ x: x + rnd(-5, 5), y: y + rnd(-5, 5), v: v * xpK, magnet: false, t: rnd(10), big: v >= 4 });
  }
  hurtPlayer(dmg, sx, sy) {
    const P = this.player;
    if (P.iframe > 0 || this.phase !== 'play') return;
    const d = Math.max(1, dmg - this.stats.armor);
    P.hp -= d; P.iframe = B.HERO.iframes; this.flawless = false; this.hitCount++; this.waveHits++;
    if (this.combo >= 10) this.fx.text(P.x, P.y - 36, 'Combo lost', '#ff9fb2', true);
    this.combo = 0; this.comboT = 0;
    this.fx.text(P.x, P.y - 20, `-${Math.round(d)}`, '#ff4d6d', true);
    this.fx.burst(P.x, P.y, '#ff4d6d', 10, 160);
    this.shake(7); sfx('hurt');
    this.app.flashHurt();
    if (P.hp <= 0) {
      if (this.revive > 0) {
        this.revive = 0; P.hp = this.stats.maxHp * this.meta.revive; P.iframe = 2.5;
        this.fx.ring(P.x, P.y, 260, '#ffd166', 0.8, 14); this.banner('🔔 The Bell Tower calls you back!'); sfx('levelup');
        for (const e of this.enemies) if (!e.dead && dist2(e.x, e.y, P.x, P.y) < 260 * 260) this.damage(e, 9999, P.x, P.y, 300);
        this.ebullets.length = 0;
      } else this.end(false);
    }
  }

  // ── leveling ───────────────────────────────────────
  gainXp(v) {
    this.xp += v;
    while (this.xp >= this.xpNeed) { this.xp -= this.xpNeed; this.plevel++; this.xpNeed = B.xpToNext(this.plevel); this.pendingLevels++; }
  }
  unlockedWeapons() {
    const S = this.S;
    return Object.keys(WEAPONS).filter((id) => {
      const u = WEAPONS[id].unlock;
      if (!u) return true;
      if (u.g) return S.cleared >= u.g;
      if (u.creatures) return Object.keys(S.dex).length >= u.creatures;
      return false;
    });
  }
  buildChoices() {
    const evos = [];
    for (const w of this.weapons) { const def = WEAPONS[w.id]; if (!w.evo && w.lvl >= WEAPON_MAX && this.passives[def.pair]) evos.push({ kind: 'evo', id: w.id, w: 10 }); }
    const pool = [];
    for (const w of this.weapons) if (w.lvl < WEAPON_MAX) pool.push({ kind: 'wup', id: w.id, w: 3 });
    if (this.weapons.length < 6) for (const id of this.unlockedWeapons()) if (!this.weapons.find((w) => w.id === id)) pool.push({ kind: 'wnew', id, w: 1.6 });
    const pk = Object.keys(this.passives);
    for (const id of pk) if (this.passives[id] < PASSIVE_MAX) pool.push({ kind: 'pup', id, w: 2 });
    if (pk.length < 6) for (const id of Object.keys(PASSIVES)) if (!this.passives[id]) pool.push({ kind: 'pnew', id, w: 1.2 });
    const n = 3 + (this.stats.luck >= 3 ? 1 : 0);
    const picked = evos.slice(0, 1);
    while (picked.length < n && pool.length) { const o = this.rng.weighted(pool, (x) => x.w); picked.push(o); pool.splice(pool.indexOf(o), 1); }
    if (picked.length < 2) picked.push({ kind: 'heal', w: 1 }, { kind: 'gold', w: 1 });
    return picked.slice(0, n);
  }
  applyChoice(o) {
    if (o.kind === 'wup') this.weapons.find((w) => w.id === o.id).lvl++;
    else if (o.kind === 'wnew') { this.weapons.push({ id: o.id, lvl: 1, t: 0.2 }); this.S.weaponsUsed[o.id] = true; }
    else if (o.kind === 'pup' || o.kind === 'pnew') { this.passives[o.id] = (this.passives[o.id] || 0) + 1; if (o.id === 'vigor') this.heal(20); }
    else if (o.kind === 'evo') {
      const w = this.weapons.find((x) => x.id === o.id); w.evo = true;
      this.evolved.push(o.id); this.S.evosSeen[o.id] = true;
      this.fx.ring(this.player.x, this.player.y, 300, WEAPONS[o.id].color, 1, 16); sfx('evolve'); this.shake(8);
      this.banner(`✨ ${L(WEAPONS[o.id].evo.name)}`, L(WEAPONS[o.id].evo.desc));
    } else if (o.kind === 'heal') this.heal(40);
    else if (o.kind === 'gold') this.dropCoin(this.player.x, this.player.y, 25);
    this.recompute();
  }
  openLevelUp(fromChest = false) {
    this.paused = true;
    const choices = this.buildChoices();
    sfx('levelup');
    this.app.ui.levelUp(this, choices, (o) => { this.applyChoice(o); sfx('pick'); this.paused = false; this.app.ui.hud(this, true); }, fromChest);
  }

  // ── slingshot input ────────────────────────────────
  onDown(p) {
    if (this.phase !== 'launch' || this.launch.fly || this.paused) return;
    this.launch.pulling = true; this.launch.sx = p.x; this.launch.sy = p.y; this.launch.px = 0; this.launch.py = 0;
  }
  onMove(p) {
    if (!this.launch.pulling) return;
    const k0 = this.view.scale * 0.9;
    const dx = (p.x - this.launch.sx) / k0, dy = (p.y - this.launch.sy) / k0;
    const d = Math.hypot(dx, dy), max = 110;
    const k = d > max ? max / d : 1;
    const nx = dx * k, ny = dy * k;
    if (Math.abs(Math.hypot(nx, ny) - Math.hypot(this.launch.px, this.launch.py)) > 10) sfx('stretch');
    this.launch.px = nx; this.launch.py = ny;
  }
  onUp() {
    if (!this.launch.pulling) return;
    this.launch.pulling = false;
    const pull = Math.hypot(this.launch.px, this.launch.py);
    if (pull < 18) { this.launch.px = this.launch.py = 0; return; }
    this.launch.fly = { sx: this.launch.px, sy: this.launch.py, tx: -this.launch.px * 3.4, ty: -this.launch.py * 3.4, t: 0, dur: 0.8, power: pull / 110 };
    Input.release();
    sfx('launch');
  }

  // ── main update ────────────────────────────────────
  update(dt, view) {
    this.view = view;
    view.ww = view.worldW || view.w / view.scale; view.wh = view.worldH || view.h / view.scale;
    if (this.phase === 'end') { this.fx.update(dt); return; }
    if (this.paused) return;
    const P = this.player;
    if (this.bannerText) { this.bannerText.t -= dt; if (this.bannerText.t <= 0) this.bannerText = null; }

    if (this.phase === 'launch') {
      if (this.launch.fly) {
        const f = this.launch.fly; f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        P.x = f.sx + (f.tx - f.sx) * k; P.y = f.sy + (f.ty - f.sy) * k;
        P.lift = Math.sin(k * Math.PI) * 140 * (0.4 + f.power * 0.6);
        P.faceA = Math.atan2(f.ty, f.tx); P.face = f.tx >= 0 ? 1 : -1;
        this.fx.trail(P.x, P.y, '#ffffff');
        if (k >= 1) this.land(f.power);
      } else if (this.launch.pulling) { P.x = this.launch.px; P.y = this.launch.py; }
      else { P.x = 0; P.y = 0; }
      this.cam.x += (P.x - this.cam.x) * Math.min(1, dt * 5);
      this.cam.y += (P.y - this.cam.y) * Math.min(1, dt * 5);
      this.fx.update(dt);
      return;
    }

    // ── play ──
    this.time += dt;
    this.S.stats.seconds += dt;
    const st = this.stats;
    const m = this.minute;
    this.secAcc = (this.secAcc || 0) + dt;
    if (this.secAcc >= 1) { this.secAcc -= 1; this.addScore(B.SCORE.perSecond, 'time'); }
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) tm.fn(); }
    this.timers = this.timers.filter((tm) => tm.t > 0);

    // waves
    const wi = Math.floor(this.time / B.WAVE_LEN);
    if (wi !== this.wave) {
      if (this.wave >= 0 && this.waveHits === 0) { this.cleanWaves++; this.addScore(B.SCORE.cleanWave, 'waves', P.x, P.y - 40); }
      this.wave = wi; this.waveHits = 0;
      const th = this.theme();
      const total = isFinite(this.duration) ? `/${B.WAVES}` : '';
      this.banner(`Wave ${wi + 1}${total} · ${th.name}`, th.desc);
      if (wi > 0) playMusic(this.realm, Math.min(0.9, 0.35 + wi * 0.1));
    }
    // timed events
    const ev = this.events;
    if (ev.champ < B.CHAMPION_AT.length && this.time >= B.CHAMPION_AT[ev.champ]) { ev.champ++; this.spawnChampion(); }
    if (this.level.cages && ev.cage < B.CAGE_AT.length && this.time >= B.CAGE_AT[ev.cage]) { ev.cage++; this.spawnCage(); }
    if (ev.rain < B.COIN_RAIN_AT.length && this.time >= B.COIN_RAIN_AT[ev.rain]) { ev.rain++; this.rainT = 40; this.banner('💰 Coin Rain!', 'Coins fall from the sky for 40 seconds. Grab them!'); }
    if (ev.sprite < B.SPRITE_AT.length && this.time >= B.SPRITE_AT[ev.sprite]) { ev.sprite++; const s = this.spawnRing('sprite', false, 0); s.hp = s.maxHp = 60 * this.hpMult * B.inRunHpRamp(m) * 0.5; }
    if (this.rainT > 0) { this.rainT -= dt; this.rainAcc = (this.rainAcc || 0) + dt; while (this.rainAcc > 0.12) { this.rainAcc -= 0.12; const a = rnd(TAU), d = rnd(40, 320); this.dropCoin(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, B.COIN_VALUE.rainDrop); } }
    if (this.stonePlan && !this.stone && this.time >= this.stonePlan.at) { const a = rnd(TAU), d = rnd(400, 650); this.stone = { x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d, idx: this.stonePlan.idx, taken: false }; this.banner('📜 A Memory Stone glows nearby', 'Find it to learn more of the story (+500 points).'); }
    if (this.level.boss && !this.bossSpawned && this.time >= B.GUARDIAN_AT) this.spawnBoss();

    // movement
    const ax = Input.axis();
    P.moving = Math.hypot(ax.x, ax.y);
    if (P.moving > 0.05) { P.faceA = Math.atan2(ax.y, ax.x); if (Math.abs(ax.x) > 0.1) P.face = ax.x > 0 ? 1 : -1; }
    P.x += ax.x * st.speed * dt; P.y += ax.y * st.speed * dt;
    if (this.hazardCurrent) { P.x += this.hazardCurrent.x * dt; P.y += this.hazardCurrent.y * dt; }
    if (P.iframe > 0) P.iframe -= dt;
    if (P.squash) P.squash *= 0.85;
    P.hp = Math.min(st.maxHp, P.hp + st.regen * dt);
    if (P.moving && this.S.cosmetics.trail !== 'none' && Math.random() < 0.5) this.fx.trail(P.x, P.y + 8, this.trailColor());

    // spawning
    if (!this.bossKilled) {
      const th = this.theme();
      const cap = B.maxAlive(this.level.g, Math.min(30, m));
      const endless = this.level.kind === 'endless' ? 1 + Math.max(0, m - 30) / 20 : 1;
      const rate = B.spawnPerSecond(Math.min(30, m), this.level.g) * this.spawnK * th.spawn * (this.boss ? 0.5 : 1) * endless;
      this.spawnAcc += rate * dt;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        if (this.enemies.length < cap) {
          const type = this.pickType();
          const e = this.spawnRing(type);
          if (type === 'bat' && Math.random() < 0.3) for (let i = 0; i < 3; i++) this.spawnEnemy('bat', e.x + rnd(-20, 20), e.y + rnd(-20, 20));
        }
      }
      if (this.level.elite && Math.random() < eliteRate(Math.min(30, 4 + m)) * dt * (th.elites || 1) * (this.muts.has('goldrush') ? 3 : 1)) this.spawnRing(this.level.elite, true);
      if (this.muts.has('swarm')) { this.swarmT = (this.swarmT || 8) - dt; if (this.swarmT <= 0) { this.swarmT = 9; const a = rnd(TAU); for (let i = 0; i < 12; i++) this.spawnEnemy('bat', P.x + Math.cos(a) * 380 + rnd(-40, 40), P.y + Math.sin(a) * 380 + rnd(-40, 40)); } }
    }
    this.updateHazards(dt);
    if (this.boss && !this.boss.dead) updateBoss(this, this.boss, dt);

    for (const w of this.weapons) tickWeapon(this, w, dt);
    for (const p of this.projs) updateProj(this, p, dt);
    this.projs = this.projs.filter((p) => p.life > 0);

    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.asleep) { e.t += dt; continue; }
      updateEnemy(this, e, dt);
      const rr = e.r + P.r - 4;
      if (e.dmg > 0 && Math.abs(e.x - P.x) < rr && Math.abs(e.y - P.y) < rr && dist2(e.x, e.y, P.x, P.y) < rr * rr) this.hurtPlayer(e.dmg, e.x, e.y);
      if (dist2(e.x, e.y, P.x, P.y) > 1150 * 1150 && !e.elite && e.type !== 'sprite') { const a = rnd(TAU), d = Math.hypot(this.view.ww, this.view.wh) / 2 + 40; e.x = P.x + Math.cos(a) * d; e.y = P.y + Math.sin(a) * d; }
    }
    separate(this);
    this.enemies = this.enemies.filter((e) => !e.dead);

    for (const b of this.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (dist2(b.x, b.y, P.x, P.y) < (b.r + P.r - 3) ** 2) { this.hurtPlayer(b.dmg, b.x, b.y); b.life = 0; }
    }
    this.ebullets = this.ebullets.filter((b) => b.life > 0);

    for (const z of this.zones) {
      z.life -= dt;
      if (z.kind === 'fire') {
        z.tick -= dt;
        if (z.tick <= 0) { z.tick = 0.3; for (const e of this.enemies) if (!e.dead && dist2(e.x, e.y, z.x, z.y) < (z.r + e.r) ** 2) this.damage(e, z.dmg, z.x, z.y, 0); if (this.boss && !this.boss.dead && dist2(this.boss.x, this.boss.y, z.x, z.y) < (z.r + this.boss.r) ** 2) this.damage(this.boss, z.dmg, z.x, z.y); }
      } else if (z.kind === 'mine') {
        if (z.arm > 0) z.arm -= dt;
        else if (dist2(z.x, z.y, P.x, P.y) < (z.r + P.r + 6) ** 2) { this.explodeAt(z.x, z.y, 55, z.dmg); z.life = 0; }
      }
    }
    this.zones = this.zones.filter((z) => z.life > 0);
    for (const tl of this.teles) { tl.t -= dt; if (tl.t <= 0 && !tl.line) tl.onDone && tl.onDone(tl.x, tl.y); }
    this.teles = this.teles.filter((tl) => tl.t > 0);

    // gems & coins
    const pr = st.pickup;
    for (const g of this.gems) {
      const d2 = dist2(g.x, g.y, P.x, P.y);
      if (g.magnet || d2 < pr * pr) {
        g.magnet = true;
        const d = Math.sqrt(d2) || 1, sp = 420 + (pr * pr) / d;
        g.x += ((P.x - g.x) / d) * sp * dt; g.y += ((P.y - g.y) / d) * sp * dt;
        if (d < P.r + 6) { g.got = true; this.gainXp(g.v); this.gemCombo = (this.gemCombo || 0) + 1; sfx('gem', this.gemCombo % 12); }
      }
    }
    this.gems = this.gems.filter((g) => !g.got);
    if (Math.random() < dt * 2) this.gemCombo = 0;
    for (const c of this.coins) {
      c.t += dt;
      const d2 = dist2(c.x, c.y, P.x, P.y);
      if (c.magnet || d2 < pr * pr * 1.1) {
        c.magnet = true;
        const d = Math.sqrt(d2) || 1, sp = 460 + (pr * pr) / d;
        c.x += ((P.x - c.x) / d) * sp * dt; c.y += ((P.y - c.y) / d) * sp * dt;
        if (d < P.r + 7) { c.got = true; this.coinsGot += c.v; this.addScore(B.SCORE.coin * c.v, 'coins'); sfx('coin'); }
      }
    }
    this.coins = this.coins.filter((c) => !c.got);
    for (const pk of this.pickups) {
      pk.t += dt;
      if (dist2(pk.x, pk.y, P.x, P.y) < (P.r + 18) ** 2) {
        pk.got = true;
        if (pk.kind === 'heart') { this.heal(25); this.fx.text(P.x, P.y - 24, '+25 HP', '#7dffc8', true); sfx('pick'); }
        else if (pk.kind === 'magnet') { for (const g of this.gems) g.magnet = true; for (const c of this.coins) c.magnet = true; this.banner('🧲 Magnet!', 'Every gem and coin flies to you.'); sfx('coin'); }
        else if (pk.kind === 'chest') { this.chests++; this.dropCoin(P.x, P.y, pk.gold ? B.COIN_VALUE.champion : B.COIN_VALUE.elite); sfx('coin'); this.openLevelUp(true); }
      }
    }
    this.pickups = this.pickups.filter((p) => !p.got);
    for (const c of this.cages) {
      c.t += dt;
      if (c.open) continue;
      if (dist2(c.x, c.y, P.x, P.y) < 60 * 60) {
        c.progress += dt / B.CAGE_OPEN_TIME;
        if (c.progress >= 1) {
          c.open = true; this.rescued.push(c.creature.id);
          this.addScore(B.SCORE.echo, 'echoes', c.x, c.y - 30);
          this.fx.burst(c.x, c.y, c.creature.look.color, 30, 220, 4); this.fx.ring(c.x, c.y, 120, '#ffffff', 0.6);
          sfx('cage');
          const isNew = !this.S.dex[c.creature.id];
          this.app.toast(`${isNew ? '✨ New Echo! ' : 'Echo freed: '}${c.creature.name}`, c.creature, 'It will join your island after the dive.');
        }
      } else c.progress = Math.max(0, c.progress - dt * 0.5);
    }
    if (this.stone && !this.stone.taken && dist2(this.stone.x, this.stone.y, P.x, P.y) < 40 * 40) {
      this.stone.taken = true; this.loreFound = this.stone.idx; sfx('cage');
      this.addScore(B.SCORE.stone, 'stones', P.x, P.y - 30);
      this.app.toast('📜 Memory Stone found', null, L(LORE[this.stone.idx]));
    }

    if (this.pendingLevels > 0 && !this.paused) { this.pendingLevels--; this.openLevelUp(); }

    this.cam.x += (P.x - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (P.y - this.cam.y) * Math.min(1, dt * 8);
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeMag = 0; }
    this.fx.update(dt);

    this.autosaveT -= dt;
    if (this.autosaveT <= 0) { this.autosaveT = B.AUTOSAVE_EVERY; this.checkpoint(); }

    if (isFinite(this.duration) && this.time >= this.duration && (!this.level.boss || this.bossKilled)) this.end(true);
  }

  updateHazards(dt) {
    const hz = this.realm.hazard;
    const P = this.player;
    if (hz === 'current') { this.curT = (this.curT || 0) + dt; const a = Math.floor(this.curT / 10) * 1.7; this.hazardCurrent = { x: Math.cos(a) * 28, y: Math.sin(a) * 28 }; }
    if ((hz === 'lightning' || hz === 'rifts' || hz === 'embers') && this.time > 20) {
      this.hzT = (this.hzT ?? 5) - dt;
      if (this.hzT <= 0) {
        this.hzT = Math.max(2.2, 6 - this.minute * 0.12);
        const x = P.x + rnd(-160, 160), y = P.y + rnd(-160, 160);
        const col = hz === 'lightning' ? '#fff36b' : hz === 'embers' ? '#ff8a3d' : '#ff5d73';
        this.telegraph({ x, y, r: 44, t: 1.1, color: col, onDone: (tx, ty) => { this.hazardHit(tx, ty, 44, 10 * this.dmgMult); this.fx.burst(tx, ty, col, 14, 240); for (const e of this.enemies) if (!e.dead && dist2(e.x, e.y, tx, ty) < 44 * 44) this.damage(e, 30 * this.hpMult, tx, ty, 100); sfx(hz === 'lightning' ? 'zap' : 'boom'); } });
      }
    }
  }

  land(power) {
    const P = this.player;
    P.lift = 0; P.squash = 0.35;
    this.phase = 'play';
    this.launch.fly = null;
    const R = 70 + power * 60;
    this.fx.ring(P.x, P.y, R * 1.2, '#ffffff', 0.5, 12); this.fx.burst(P.x, P.y, this.realm.ground, 30, 280, 4);
    this.shake(10); sfx('land');
    for (const e of this.enemies) { e.asleep = false; if (dist2(e.x, e.y, P.x, P.y) < R * R) this.damage(e, 9999, P.x, P.y, 300); }
    const hit = this.kills;
    if (hit >= 3) { this.addScore(hit * 200, 'kills'); this.banner(`💥 Perfect landing ×${hit}`, `+${fmtNum(Math.round(hit * 200 * this.scoreMult))} points`); }
    if (this.resumeCages || this.resumeBoss) this.afterResumeLanding();
    playMusic(this.realm, 0.4);
    this.app.ui.hud(this, true);
  }

  trailColor() {
    const t2 = this.S.cosmetics.trail;
    const map = { stardust: '#ffe27a', petal: '#ff9fd0', frost: '#bfe9ff', flame: '#ff8a3d' };
    if (t2 === 'rainbow') return `hsl(${(this.time * 300) % 360},90%,70%)`;
    return map[t2] || '#ffffff';
  }

  // ── checkpoint (resume a 30-minute dive later) ─────
  snapshot() {
    return {
      v: 1, level: { kind: this.level.kind, realm: this.level.realm, stage: this.level.stage, dayKey: this.level.dayKey }, night: this.night,
      time: this.time, hp: this.player.hp, weapons: this.weapons.map((w) => ({ id: w.id, lvl: w.lvl, evo: !!w.evo })), passives: { ...this.passives },
      plevel: this.plevel, xp: this.xp, score: this.score, breakdown: { ...this.breakdown }, coinsGot: this.coinsGot, kills: this.kills,
      rescued: this.rescued.slice(), cages: this.cages.filter((c) => !c.open).map((c) => c.creature.id), events: { ...this.events }, loreFound: this.loreFound,
      stonePlan: this.stonePlan && !this.stone?.taken ? this.stonePlan : null, champions: this.champions, cleanWaves: this.cleanWaves, wave: this.wave,
      bestCombo: this.bestCombo, flawless: this.flawless, hitCount: this.hitCount, revive: this.revive, rerolls: this.rerolls, evolved: this.evolved.slice(),
      bossHp: this.boss && !this.boss.dead ? this.boss.hp : null, savedAt: Date.now(), weapon: this.opts.weapon,
    };
  }
  applySnapshot(s) {
    Object.assign(this, { time: s.time, plevel: s.plevel, xp: s.xp, score: s.score, breakdown: s.breakdown, coinsGot: s.coinsGot, kills: s.kills, rescued: s.rescued, events: s.events, loreFound: s.loreFound, stonePlan: s.stonePlan, champions: s.champions, cleanWaves: s.cleanWaves, wave: s.wave, bestCombo: s.bestCombo, flawless: s.flawless, hitCount: s.hitCount, revive: s.revive, rerolls: s.rerolls, evolved: s.evolved });
    this.xpNeed = B.xpToNext(this.plevel);
    this.weapons = s.weapons.map((w) => ({ ...w, t: 0.5 }));
    this.passives = s.passives;
    this.recompute();
    this.player.hp = Math.min(this.stats.maxHp, s.hp);
    this.resumeCages = s.cages.length ? s.cages : null;
    this.resumeBoss = s.bossHp;
    this.bossSpawned = !!s.bossHp;
    this.waveHits = 0;
    this.kills0 = this.kills;
  }
  afterResumeLanding() {
    for (const id of this.resumeCages || []) {
      const a = rnd(TAU), d = rnd(480, 720);
      this.cages.push({ x: this.player.x + Math.cos(a) * d, y: this.player.y + Math.sin(a) * d, creature: CREATURES[id], progress: 0, open: false, t: rnd(10) });
    }
    if (this.resumeBoss) this.spawnBoss(this.resumeBoss);
    this.resumeCages = null; this.resumeBoss = null;
  }
  checkpoint() {
    if (this.phase !== 'play' || this.level.kind === 'endless') return;
    this.S.activeRun = this.snapshot();
    Save.save();
  }

  end(win) {
    if (this.phase === 'end') return;
    this.phase = 'end';
    this.S.activeRun = null;
    const P = this.player;
    const hpRatio = Math.max(0, P.hp / this.stats.maxHp);
    if (win) {
      this.addScore(B.SCORE.clear, 'clear');
      this.addScore(B.SCORE.hpBonus * hpRatio, 'hp');
      if (this.waveHits === 0) { this.cleanWaves++; this.addScore(B.SCORE.cleanWave, 'waves'); }
    }
    let stars = 0;
    if (win && this.level.kind !== 'endless') {
      stars = 1;
      if (this.score >= this.level.target) stars++;
      if (this.level.cages && this.rescued.length >= this.level.cages) stars++;
    }
    const clearCoins = win && this.level.kind !== 'endless' ? Math.round(B.clearBonusCoins(this.level.g) * this.stats.coins) : 0;
    const coins = Math.round(this.coinsGot) + clearCoins;
    const pieces = this.level.kind === 'endless' ? Math.floor(this.time / 120) : B.runPieces({ stars, boss: !!this.bossKilled, champions: this.champions });
    const result = {
      win, stars, coins, coinsCollected: Math.round(this.coinsGot), clearCoins, pieces, kills: this.kills, time: this.time, level: this.level, night: this.night,
      rescued: this.rescued, lore: this.loreFound, boss: !!this.bossKilled, score: Math.round(this.score), breakdown: this.breakdown, target: this.level.target,
      bestCombo: this.bestCombo, cleanWaves: this.cleanWaves, champions: this.champions,
      flawless: win && this.flawless, evolved: this.evolved, plevel: this.plevel,
      weapons: this.weapons.map((w) => ({ id: w.id, lvl: w.lvl, evo: w.evo })), hits: this.hitCount,
    };
    sfx(win ? 'win' : 'lose');
    setTimeout(() => this.app.finishRun(result), win ? 900 : 1400);
  }

  // ── screen-space overlay (2D canvas above the 3D view) ──
  overlay(ctx, view, tt, project) {
    const { w, h } = view;
    ctx.clearRect(0, 0, w, h);
    const R = this.realm;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const tx of this.fx.texts) {
      const s = project(tx.x, tx.y, 30 + (1 - tx.life / tx.max) * 30);
      if (!s) continue;
      ctx.globalAlpha = Math.min(1, (tx.life / tx.max) * 2);
      ctx.font = `800 ${tx.big ? 20 : 13}px 'Baloo 2', system-ui`;
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(20,10,30,0.85)'; ctx.strokeText(tx.str, s.x, s.y);
      ctx.fillStyle = tx.color; ctx.fillText(tx.str, s.x, s.y);
    }
    ctx.globalAlpha = 1;
    if (this.phase === 'launch') for (const e of this.enemies) if (e.asleep && Math.sin(tt * 2 + e.seed) > 0.5) { const s = project(e.x, e.y, 40); if (s) { ctx.fillStyle = '#fff'; ctx.font = "700 14px 'Baloo 2', system-ui"; ctx.fillText('z', s.x + 8, s.y - Math.sin(tt * 2 + e.seed) * 8); } }
    for (const c of this.cages) if (!c.open) { const s = project(c.x, c.y, 70); if (s && dist2(c.x, c.y, this.player.x, this.player.y) < 250 * 250) { ctx.font = "700 12px 'Baloo 2', system-ui"; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,10,30,.8)'; const lbl = c.progress > 0 ? `Freeing… ${Math.round(c.progress * 100)}%` : 'Stand here to free'; ctx.strokeText(lbl, s.x, s.y); ctx.fillStyle = '#fff6e8'; ctx.fillText(lbl, s.x, s.y); } }
    if (this.muts.has('fog')) {
      const rg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.min(w, h) * 0.6);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, hexA(R.void, 0.96));
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    }
    this.drawIndicators(ctx, view, project);
    if (Input.joy.active && this.phase === 'play') {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(Input.joy.bx, Input.joy.by, 56, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(Input.joy.bx + Input.joy.dx * 56, Input.joy.by + Input.joy.dy * 56, 22, 0, TAU); ctx.fill();
    }
    if (this.combo >= 10 && this.phase === 'play') {
      const mult = B.comboMult(this.combo);
      ctx.textAlign = 'right'; ctx.font = "800 22px 'Baloo 2', system-ui";
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,10,30,.8)';
      const y = h - 70, x = w - 18;
      const label = `${this.combo} combo  ×${mult.toFixed(1)}`;
      ctx.strokeText(label, x, y); ctx.fillStyle = mult >= 3 ? '#ffd166' : '#fff6e8'; ctx.fillText(label, x, y);
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x - 120, y + 16, 120, 4);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(x - 120, y + 16, 120 * Math.max(0, this.comboT / B.COMBO_WINDOW), 4);
    }
    if (this.bannerText) {
      const k = this.bannerText.t;
      ctx.globalAlpha = Math.max(0, Math.min(1, k * 2, (3.2 - k) * 4));
      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.min(26, w / 17)}px 'Grandstander', 'Baloo 2', system-ui`;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,10,30,0.85)'; ctx.strokeText(this.bannerText.text, w / 2, h * 0.33);
      ctx.fillStyle = '#fff6e8'; ctx.fillText(this.bannerText.text, w / 2, h * 0.33);
      if (this.bannerText.sub) { ctx.font = "600 15px 'Baloo 2', system-ui"; ctx.lineWidth = 4; this.wrap(ctx, this.bannerText.sub, w / 2, h * 0.33 + 30, Math.min(360, w - 40), 19); }
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'launch' && !this.launch.fly && !this.launch.pulling) {
      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.min(17, w / 25)}px 'Baloo 2', system-ui`; ctx.fillStyle = `rgba(255,246,232,${0.7 + Math.sin(tt * 3) * 0.25})`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,10,30,.7)';
      const lines = ['Drag BACK from Pip, then release', 'to launch. Land on the sleeping', 'nest for bonus points!'];
      lines.forEach((l, i) => { ctx.strokeText(l, w / 2, h * 0.8 + i * 24); ctx.fillText(l, w / 2, h * 0.8 + i * 24); });
    }
  }
  wrap(ctx, text, x, y, maxW, lh) {
    const words = text.split(' '); let line = '', yy = y;
    const out = (s) => { ctx.strokeText(s, x, yy); ctx.fillStyle = '#d9d3f5'; ctx.fillText(s, x, yy); yy += lh; };
    for (const wd of words) { const test = line ? line + ' ' + wd : wd; if (ctx.measureText(test).width > maxW && line) { out(line); line = wd; } else line = test; }
    if (line) out(line);
  }
  drawIndicators(ctx, view, project) {
    const { w, h } = view;
    const items = [];
    for (const c of this.cages) if (!c.open) items.push([c.x, c.y, c.creature.look.color, '🐾']);
    if (this.stone && !this.stone.taken) items.push([this.stone.x, this.stone.y, '#b5a1ff', '📜']);
    if (this.boss && !this.boss.dead) items.push([this.boss.x, this.boss.y, '#ff4d6d', '☠']);
    for (const e of this.enemies) if (e.champion) items.push([e.x, e.y, '#ffd166', '⚔']); else if (e.type === 'sprite') items.push([e.x, e.y, '#ffd166', '💰']);
    for (const pk of this.pickups) if (pk.kind === 'chest') items.push([pk.x, pk.y, '#ffd166', '🎁']);
    for (const [x, y, col, icon] of items) {
      const s = project(x, y, 0);
      if (s && s.x > 20 && s.x < w - 20 && s.y > 170 && s.y < h - 20) continue;
      const a = Math.atan2(y - this.player.y, x - this.player.x);
      const ex = clamp(w / 2 + Math.cos(a) * w, 30, w - 30), ey = clamp(h / 2 + Math.sin(a) * h, 185, h - 40);
      ctx.save(); ctx.translate(ex, ey);
      ctx.fillStyle = hexA(col, 0.92); ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
      ctx.rotate(a); ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(15, -7); ctx.lineTo(15, 7); ctx.fill(); ctx.rotate(-a);
      ctx.font = '15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, 0, 1);
      const dm = Math.round(Math.hypot(x - this.player.x, y - this.player.y) / 10);
      ctx.font = "700 10px 'Baloo 2', system-ui"; ctx.fillStyle = '#fff6e8'; ctx.fillText(`${dm}m`, 0, 25);
      ctx.restore();
    }
  }

  hudData() {
    const dur = this.duration;
    const wi = Math.max(0, this.wave);
    return {
      time: isFinite(dur) ? (this.level.boss && this.time >= dur && !this.bossKilled ? '☠' : fmtTime(Math.max(0, dur - this.time))) : fmtTime(this.time),
      prog: isFinite(dur) ? Math.min(1, this.time / dur) : (this.time % B.WAVE_LEN) / B.WAVE_LEN,
      hp: this.player.hp / this.stats.maxHp, hpText: `${Math.ceil(this.player.hp)}/${Math.round(this.stats.maxHp)}`,
      xp: this.xp / this.xpNeed, lvl: this.plevel, kills: this.kills,
      score: fmtNum(this.score), target: this.level.target, scoreRatio: this.level.target ? Math.min(1, this.score / this.level.target) : 0,
      coins: fmtNum(this.coinsGot),
      wave: isFinite(dur) ? `Wave ${wi + 1}/${B.WAVES} · ${this.theme().name}` : `Depth ${wi + 1} · ${this.theme().name}`,
      boss: this.boss && !this.boss.dead ? { name: L(this.boss.def.name), hp: this.boss.hp / this.boss.maxHp } : null,
      cages: `${this.rescued.length}/${this.level.cages || 0}`,
    };
  }
}
