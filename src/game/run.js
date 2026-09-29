// A single dive: slingshot launch → survive → rescue Echoes → (Guardian) → results.
import * as B from '../data/balance.js';
import { REALMS } from '../data/realms.js';
import { ENEMIES, ELITE, eliteRate } from '../data/enemies.js';
import { BOSSES } from '../data/bosses.js';
import { WEAPONS, PASSIVES, WEAPON_MAX, PASSIVE_MAX } from '../data/weapons.js';
import { rollCreature, CREATURES } from '../data/creatures.js';
import { LORE } from '../data/lore.js';
import { RNG } from '../core/rng.js';
import { TAU, clamp, dist2, rnd, pick, mixHex, hexA, fmtTime } from '../core/util.js';
import { drawHero, drawEnemy, drawBoss, drawCreature, glow, star, drawBlock, tileHash, roundRect } from '../core/draw.js';
import { Input } from '../core/input.js';
import { sfx, playMusic } from '../core/audio.js';
import { t as tr, L } from '../core/i18n.js';
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
    this.maxAlive = B.maxAlive(g);
    const R = this.realm;
    this.pal = { body: mixHex('#1d1530', R.void, 0.3), rim: R.accent, eye: R.glow, floorA: mixHex(R.groundDark, R.void, 0.45), floorB: mixHex(R.groundDark, R.ground, 0.25), deco: R.ground };

    this.time = 0; this.phase = 'launch'; this.paused = false;
    this.enemies = []; this.projs = []; this.ebullets = []; this.gems = []; this.zones = []; this.teles = []; this.pickups = [];
    this.timers = []; this.fx = new FX(); this.cages = []; this.boss = null; this.laser = null;
    this.kills = 0; this.spawnAcc = 0; this.shakeT = 0; this.shakeMag = 0; this.hitCount = 0; this.bannerText = null;
    this.rescued = []; this.loreFound = null; this.chests = 0; this.evolved = [];
    this.cam = { x: 0, y: 0 };

    // stats: base + island + echoes
    const mb = metaBonuses(this.S);
    this.meta = mb;
    this.baseStats = {
      dmg: 1 + mb.dmg, cd: 1 - Math.min(0.5, mb.cd), area: 1, dur: 1, speed: B.HERO.speed * (1 + mb.speed),
      maxHp: B.HERO.hp + mb.hp, pickup: B.HERO.pickup * (1 + mb.pickup) * (this.muts.has('gravity') ? 4 : 1), armor: 0, regen: mb.regen,
      crit: 0.05 + mb.crit, luck: 0, coins: 1 + mb.coins,
    };
    if (this.muts.has('glass')) this.baseStats.dmg *= 1.5;
    this.rerolls = mb.rerolls; this.revive = mb.revive;
    this.weapons = [{ id: opts.weapon || 'spark', lvl: 1, t: 0.5 }];
    this.passives = {};
    this.recompute();
    this.player = { x: 0, y: 0, r: 13, hp: this.stats.maxHp, iframe: 0, faceA: 0, face: 1, moving: 0, lift: 0, squash: 0 };
    this.xp = 0; this.plevel = 1; this.xpNeed = B.xpToNext(1);
    this.pendingLevels = 0;

    // launch setup: a sleeping void-nest to aim at
    this.launch = { pulling: false, px: 0, py: 0, fly: null };
    const na = rnd(TAU), nd = rnd(230, 330);
    this.nest = { x: Math.cos(na) * nd, y: Math.sin(na) * nd };
    const nestCount = 7 + Math.min(8, Math.floor(level.g / 20));
    for (let i = 0; i < nestCount; i++) {
      const e = this.spawnEnemy(level.pool[0], this.nest.x + rnd(-55, 55), this.nest.y + rnd(-55, 55));
      e.asleep = true;
    }
    // cages
    const cageCount = level.cages || 0;
    for (let i = 0; i < cageCount; i++) {
      const a = (i / cageCount) * TAU + rnd(-0.5, 0.5), d = rnd(420, 820);
      const c = level.kind === 'daily' ? rollCreature(this.rng, level.realm, 0) : rollCreature(new RNG(Math.random() * 1e9 | 0), level.realm, this.stats.luck);
      this.cages.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, creature: c, progress: 0, open: false, t: rnd(10) });
    }
    // memory stone
    if (level.loreChance && Math.random() < level.loreChance) {
      const idxs = [0, 1, 2].map((k) => level.realm * 3 + k).filter((k) => !this.S.lore[k]);
      if (idxs.length) { const a = rnd(TAU), d = rnd(520, 900); this.stone = { x: Math.cos(a) * d, y: Math.sin(a) * d, idx: pick(idxs), taken: false }; }
    }
    this.hazardCurrent = null;
    this.bossSpawned = false;
    this.flawless = true;
    this.duration = level.duration;
    playMusic(this.realm, 0.3);
    Input.handlers.down = (p) => this.onDown(p);
    Input.handlers.move = (p) => this.onMove(p);
    Input.handlers.up = (p) => this.onUp(p);
  }

  destroy() { Input.handlers.down = Input.handlers.move = Input.handlers.up = null; }

  // ── stats ──────────────────────────────────────────────
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

  // ── spawning ───────────────────────────────────────────
  spawnEnemy(type, x, y, elite = false) {
    const d = ENEMIES[type] || ENEMIES.blob;
    const tiny = this.muts.has('tiny');
    const k = this.phase === 'play' ? B.inRunHpRamp(this.time / (isFinite(this.duration) ? this.duration : 600)) : 1;
    const endless = this.level.kind === 'endless' ? 1 + this.time / 60 * 0.45 : 1;
    const hp = d.hp * this.hpMult * k * endless * (elite ? ELITE.hpMult : 1);
    const e = {
      type, x, y, vx: 0, vy: 0, t: 0, seed: rnd(100), hp, maxHp: hp,
      r: d.r * (elite ? ELITE.rMult : 1) * (tiny ? 0.7 : 1),
      speed: d.speed * (elite ? ELITE.speedMult : 1) * (tiny ? 1.25 : 1) * (this.muts.has('heavy') ? 0.85 : 1) * rnd(0.92, 1.08),
      dmg: d.dmg * this.dmgMult * (elite ? ELITE.dmgMult : 1) * (this.level.kind === 'endless' ? 1 + this.time / 600 : 1),
      ai: d.ai, shape: d.shape, xp: d.xp, elite, split: d.split, flash: 0, kx: 0, ky: 0,
    };
    this.enemies.push(e);
    return e;
  }
  spawnRing(type, elite = false) {
    const a = rnd(TAU), vw = this.view.ww, vh = this.view.wh;
    const d = Math.hypot(vw, vh) / 2 + 40;
    return this.spawnEnemy(type, this.player.x + Math.cos(a) * d, this.player.y + Math.sin(a) * d, elite);
  }
  spawnBoss() {
    const lb = this.level.boss;
    const def = BOSSES[lb.id];
    const hp = def.hp * lb.form.hpMult * this.hpMult * (this.night ? 1 : 1);
    const a = rnd(TAU);
    this.boss = { def, form: lb.form, x: this.player.x + Math.cos(a) * 330, y: this.player.y + Math.sin(a) * 330, r: def.r, hp, maxHp: hp, t: 0, phase: 0, pi: 0, cool: 2, action: null, dmg: 14 * this.dmgMult, flash: 0, isBoss: true, kx: 0, ky: 0 };
    this.bossSpawned = true;
    this.banner(`${L(lb.form.title)} ${L(def.name)}`.trim());
    sfx('boss'); this.shake(14);
    playMusic(this.realm, 0.95);
  }

  // ── combat API used by weapons/AI ─────────────────────
  addProj(p) { p.id = PID++; this.projs.push(p); }
  enemyShot(x, y, a, sp, dmg, r = 6) { if (this.ebullets.length < 400) this.ebullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg, r, life: 5 }); }
  telegraph(o) { this.teles.push({ ...o, max: o.t }); }
  telegraphLine(x, y, a, len, w, t) { this.teles.push({ line: true, x, y, a, len, w, t, max: t, color: '#ff4d6d' }); }
  later(delay, fn) { if (delay <= 0) fn(); else this.timers.push({ t: delay, fn }); }
  shake(m) { this.shakeMag = Math.max(this.shakeMag, m); this.shakeT = 0.25; }
  banner(text) { this.bannerText = { text, t: 2.2 }; }
  heal(n) { const P = this.player; P.hp = Math.min(this.stats.maxHp, P.hp + n); }
  hazardHit(x, y, r, dmg) { const P = this.player; if (dist2(x, y, P.x, P.y) < (r + P.r) ** 2) this.hurtPlayer(dmg, x, y); }
  explodeAt(x, y, r, dmg) { this.fx.ring(x, y, r, '#ff8a3d', 0.35, 8); this.fx.burst(x, y, '#ffb070', 14, 220); this.hazardHit(x, y, r, dmg); sfx('boom'); this.shake(5); }

  damage(e, dmg, sx, sy, knock = 0, proj) {
    if (e.dead || e.asleep === 'x') return;
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
    if (knock && !e.isBoss) {
      const a = Math.atan2(e.y - sy, e.x - sx), k = knock * (e.elite ? 0.3 : 1) * (e.type === 'brute' ? 0.4 : 1);
      e.kx += Math.cos(a) * k; e.ky += Math.sin(a) * k;
    }
    if (this.fx.texts.length < 60 || crit) this.fx.text(e.x, e.y - e.r, Math.round(d).toString(), crit ? '#ffd166' : '#ffffff', crit);
    sfx('hit');
    if (e.hp <= 0) e.isBoss ? this.killBoss() : this.kill(e);
  }
  kill(e, silent = false) {
    if (e.dead) return;
    e.dead = true; this.kills++;
    this.fx.burst(e.x, e.y, this.pal.rim, e.elite ? 24 : 8, 180);
    if (!silent) sfx('kill');
    if (e.split && e.r > 9) for (let i = 0; i < e.split; i++) { const c = this.spawnEnemy('blob', e.x + rnd(-8, 8), e.y + rnd(-8, 8)); c.r = e.r * 0.62; c.hp = c.maxHp = e.maxHp * 0.3; c.shape = 'splitter'; }
    const val = B.GEM_XP[e.xp] || 1;
    this.dropGem(e.x, e.y, e.elite ? B.GEM_XP.big * 2 : val);
    if (e.elite) { this.pickups.push({ kind: 'chest', x: e.x, y: e.y, t: 0 }); this.shake(6); }
    else if (Math.random() < 0.012 + this.stats.luck * 0.004) this.pickups.push({ kind: 'heart', x: e.x, y: e.y, t: 0 });
    else if (Math.random() < 0.004) this.pickups.push({ kind: 'magnet', x: e.x, y: e.y, t: 0 });
  }
  killBoss() {
    const b = this.boss; if (b.dead) return;
    b.dead = true; this.bossKilled = true;
    for (let i = 0; i < 6; i++) this.later(i * 0.12, () => { this.fx.burst(b.x + rnd(-40, 40), b.y + rnd(-40, 40), b.def.color, 30, 300, 5); sfx('boom'); this.shake(12); });
    for (let i = 0; i < 12; i++) this.dropGem(b.x + rnd(-60, 60), b.y + rnd(-60, 60), B.GEM_XP.boss / 4);
    this.pickups.push({ kind: 'chest', x: b.x, y: b.y, t: 0 });
    this.ebullets.length = 0; this.laser = null;
    for (const e of this.enemies) if (!e.dead) this.kill(e, true);
    this.banner(tr('victory'));
    playMusic(this.realm, 0.4);
    this.later(2.5, () => this.end(true));
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
    P.hp -= d; P.iframe = B.HERO.iframes; this.flawless = false; this.hitCount++;
    this.fx.text(P.x, P.y - 20, `-${Math.round(d)}`, '#ff4d6d', true);
    this.fx.burst(P.x, P.y, '#ff4d6d', 10, 160);
    this.shake(7); sfx('hurt');
    this.app.flashHurt();
    if (P.hp <= 0) {
      if (this.revive > 0) {
        this.revive = 0; P.hp = this.stats.maxHp * this.meta.revive; P.iframe = 2.5;
        this.fx.ring(P.x, P.y, 260, '#ffd166', 0.8, 14); this.banner('🔔'); sfx('levelup');
        for (const e of this.enemies) if (!e.dead && dist2(e.x, e.y, P.x, P.y) < 260 * 260) this.damage(e, 9999, P.x, P.y, 300);
        this.ebullets.length = 0;
      } else this.end(false);
    }
  }

  // ── leveling ───────────────────────────────────────────
  gainXp(v) {
    this.xp += v;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed; this.plevel++; this.xpNeed = B.xpToNext(this.plevel);
      this.pendingLevels++;
    }
  }
  unlockedWeapons() {
    const S = this.S;
    return Object.keys(WEAPONS).filter((id) => {
      const u = WEAPONS[id].unlock;
      if (!u) return true;
      if (u.g) return S.cleared >= u.g || Object.keys(S.progress).length >= u.g;
      if (u.creatures) return Object.keys(S.dex).length >= u.creatures;
      return false;
    });
  }
  buildChoices(forceEvo = false) {
    const opts = [];
    // evolutions first
    for (const w of this.weapons) {
      const def = WEAPONS[w.id];
      if (!w.evo && w.lvl >= WEAPON_MAX && this.passives[def.pair]) opts.push({ kind: 'evo', id: w.id, w: 10 });
    }
    if (forceEvo && opts.length) return opts.slice(0, 1).concat(this.buildChoices().filter((o) => o.kind !== 'evo').slice(0, 2));
    const pool = [];
    for (const w of this.weapons) if (w.lvl < WEAPON_MAX) pool.push({ kind: 'wup', id: w.id, w: 3 });
    if (this.weapons.length < 6) for (const id of this.unlockedWeapons()) if (!this.weapons.find((w) => w.id === id)) pool.push({ kind: 'wnew', id, w: 1.6 });
    const pk = Object.keys(this.passives);
    for (const id of pk) if (this.passives[id] < PASSIVE_MAX) pool.push({ kind: 'pup', id, w: 2 });
    if (pk.length < 6) for (const id of Object.keys(PASSIVES)) if (!this.passives[id]) pool.push({ kind: 'pnew', id, w: 1.2 });
    const n = 3 + (this.stats.luck >= 3 ? 1 : 0);
    const picked = opts.slice(0, 1);
    while (picked.length < n && pool.length) {
      const o = this.rng.weighted(pool, (x) => x.w);
      picked.push(o); pool.splice(pool.indexOf(o), 1);
    }
    if (!picked.length) picked.push({ kind: 'heal', w: 1 }, { kind: 'gold', w: 1 });
    return picked;
  }
  applyChoice(o) {
    if (o.kind === 'wup') this.weapons.find((w) => w.id === o.id).lvl++;
    else if (o.kind === 'wnew') { this.weapons.push({ id: o.id, lvl: 1, t: 0.2 }); this.S.weaponsUsed[o.id] = true; }
    else if (o.kind === 'pup' || o.kind === 'pnew') { this.passives[o.id] = (this.passives[o.id] || 0) + 1; if (o.id === 'vigor') this.heal(20); }
    else if (o.kind === 'evo') {
      const w = this.weapons.find((x) => x.id === o.id); w.evo = true;
      this.evolved.push(o.id); this.S.evosSeen[o.id] = true;
      this.fx.ring(this.player.x, this.player.y, 300, WEAPONS[o.id].color, 1, 16); sfx('evolve'); this.shake(8);
    } else if (o.kind === 'heal') this.heal(40);
    else if (o.kind === 'gold') this.bonusCoins = (this.bonusCoins || 0) + 40;
    this.recompute();
  }
  openLevelUp(fromChest = false) {
    this.paused = true;
    const choices = this.buildChoices(fromChest);
    sfx('levelup');
    this.app.ui.levelUp(this, choices, (o) => {
      this.applyChoice(o); sfx('pick');
      this.paused = false;
      this.app.ui.hud(this, true);
    });
  }

  // ── input for slingshot ───────────────────────────────
  toWorld(p) { const v = this.view; return { x: (p.x - v.w / 2) / v.scale + this.cam.x, y: (p.y - v.h / 2) / v.scale + this.cam.y }; }
  onDown(p) {
    if (this.phase !== 'launch' || this.launch.fly) return;
    this.launch.pulling = true; this.launch.sx = p.x; this.launch.sy = p.y; this.launch.px = 0; this.launch.py = 0;
  }
  onMove(p) {
    if (!this.launch.pulling) return;
    const dx = (p.x - this.launch.sx) / this.view.scale, dy = (p.y - this.launch.sy) / this.view.scale;
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
    const tx = -this.launch.px * 3.4, ty = -this.launch.py * 3.4;
    this.launch.fly = { sx: 0, sy: 0, tx, ty, t: 0, dur: 0.75, power: pull / 110 };
    Input.release();
    sfx('launch');
  }

  // ── main update ────────────────────────────────────────
  update(dt, view) {
    this.view = view;
    view.ww = view.w / view.scale; view.wh = view.h / view.scale;
    if (this.phase === 'end') { this.fx.update(dt); return; }
    if (this.paused) return;
    const P = this.player;
    if (this.bannerText) { this.bannerText.t -= dt; if (this.bannerText.t <= 0) this.bannerText = null; }

    if (this.phase === 'launch') {
      this.idleT = (this.idleT || 0) + dt;
      if (this.launch.fly) {
        const f = this.launch.fly; f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        P.x = f.sx + (f.tx - f.sx) * k; P.y = f.sy + (f.ty - f.sy) * k;
        P.lift = Math.sin(k * Math.PI) * 120 * (0.4 + f.power * 0.6);
        P.faceA = Math.atan2(f.ty, f.tx); P.face = f.tx >= 0 ? 1 : -1;
        this.fx.trail(P.x, P.y - P.lift, '#ffffff');
        if (k >= 1) this.land(f.power);
      }
      // auto-launch hint after idle
      this.cam.x += (P.x - this.cam.x) * Math.min(1, dt * 5);
      this.cam.y += (P.y - this.cam.y) * Math.min(1, dt * 5);
      this.fx.update(dt);
      return;
    }

    // ── play ──
    this.time += dt;
    this.S.stats.seconds += dt;
    const st = this.stats;
    // timers
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) tm.fn(); }
    this.timers = this.timers.filter((tm) => tm.t > 0);

    // movement
    const ax = Input.axis();
    P.moving = Math.hypot(ax.x, ax.y);
    if (P.moving > 0.05) { P.faceA = Math.atan2(ax.y, ax.x); if (Math.abs(ax.x) > 0.1) P.face = ax.x > 0 ? 1 : -1; }
    P.x += ax.x * st.speed * dt; P.y += ax.y * st.speed * dt;
    if (this.hazardCurrent) { P.x += this.hazardCurrent.x * dt; P.y += this.hazardCurrent.y * dt; }
    if (P.iframe > 0) P.iframe -= dt;
    if (P.squash) P.squash *= 0.85;
    if (P.lift > 0) P.lift = Math.max(0, P.lift - dt * 400);
    P.hp = Math.min(st.maxHp, P.hp + st.regen * dt);
    if (P.moving && this.S.cosmetics.trail !== 'none' && Math.random() < 0.5) this.fx.trail(P.x, P.y + 8, this.trailColor());

    // spawning
    const dur = isFinite(this.duration) ? this.duration : 600;
    const prog = Math.min(1, this.time / dur);
    if (!this.bossKilled) {
      const alive = this.enemies.length;
      const rate = B.spawnPerSecond(prog, this.level.g) * this.spawnK * (this.boss ? 0.45 : 1) * (this.level.kind === 'endless' ? 1 + this.time / 240 : 1);
      this.spawnAcc += rate * dt;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        if (alive < this.maxAlive) {
          const type = this.rng.pick(this.level.pool);
          const e = this.spawnRing(type);
          // small packs for bats
          if (type === 'bat' && Math.random() < 0.3) for (let i = 0; i < 3; i++) this.spawnEnemy('bat', e.x + rnd(-20, 20), e.y + rnd(-20, 20));
        }
      }
      if (this.level.elite && Math.random() < eliteRate(this.level.stage) * dt * 60 / 60 * (this.muts.has('goldrush') ? 3 : 1)) this.spawnRing(this.level.elite, true);
      if (this.muts.has('swarm')) { this.swarmT = (this.swarmT || 8) - dt; if (this.swarmT <= 0) { this.swarmT = 9; const a = rnd(TAU); for (let i = 0; i < 12; i++) this.spawnEnemy('bat', P.x + Math.cos(a) * 380 + rnd(-40, 40), P.y + Math.sin(a) * 380 + rnd(-40, 40)); } }
    }
    // realm hazards
    this.updateHazards(dt);
    // boss
    if (this.level.boss && !this.bossSpawned && this.time >= this.duration * 0.55) this.spawnBoss();
    if (this.boss && !this.boss.dead) updateBoss(this, this.boss, dt);

    // weapons
    for (const w of this.weapons) tickWeapon(this, w, dt);
    for (const p of this.projs) updateProj(this, p, dt);
    this.projs = this.projs.filter((p) => p.life > 0);

    // enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.asleep) { e.t += dt; continue; }
      updateEnemy(this, e, dt);
      const rr = e.r + P.r - 4;
      if (Math.abs(e.x - P.x) < rr && Math.abs(e.y - P.y) < rr && dist2(e.x, e.y, P.x, P.y) < rr * rr) this.hurtPlayer(e.dmg, e.x, e.y);
      // despawn stragglers far away (re-enter from the ring)
      if (dist2(e.x, e.y, P.x, P.y) > 1100 * 1100 && !e.elite) { const a = rnd(TAU), d = Math.hypot(this.view.ww, this.view.wh) / 2 + 40; e.x = P.x + Math.cos(a) * d; e.y = P.y + Math.sin(a) * d; }
    }
    separate(this);
    this.enemies = this.enemies.filter((e) => !e.dead);

    // enemy bullets
    for (const b of this.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (dist2(b.x, b.y, P.x, P.y) < (b.r + P.r - 3) ** 2) { this.hurtPlayer(b.dmg, b.x, b.y); b.life = 0; }
    }
    this.ebullets = this.ebullets.filter((b) => b.life > 0);

    // zones (fire, mines)
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
    // telegraphs
    for (const tl of this.teles) {
      tl.t -= dt;
      if (tl.t <= 0) {
        if (tl.line) continue;
        tl.onDone && tl.onDone(tl.x, tl.y);
      }
    }
    this.teles = this.teles.filter((tl) => tl.t > 0);

    // gems
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
    // pickups
    for (const pk of this.pickups) {
      pk.t += dt;
      if (dist2(pk.x, pk.y, P.x, P.y) < (P.r + 16) ** 2) {
        pk.got = true;
        if (pk.kind === 'heart') { this.heal(25); this.fx.text(P.x, P.y - 24, '+25', '#7dffc8', true); sfx('pick'); }
        else if (pk.kind === 'magnet') { for (const g of this.gems) g.magnet = true; sfx('coin'); }
        else if (pk.kind === 'chest') { this.chests++; this.bonusCoins = (this.bonusCoins || 0) + 25; sfx('coin'); this.openLevelUp(true); }
      }
    }
    this.pickups = this.pickups.filter((p) => !p.got);
    // cages
    for (const c of this.cages) {
      c.t += dt;
      if (c.open) continue;
      if (dist2(c.x, c.y, P.x, P.y) < 60 * 60) {
        c.progress += dt / B.CAGE_OPEN_TIME;
        if (c.progress >= 1) {
          c.open = true; this.rescued.push(c.creature.id);
          this.fx.burst(c.x, c.y, c.creature.look.color, 30, 220, 4); this.fx.ring(c.x, c.y, 120, '#ffffff', 0.6);
          sfx('cage');
          const isNew = !this.S.dex[c.creature.id];
          this.app.toast(`${isNew ? '✨ ' + tr('newEcho') + ' ' : ''}${c.creature.name}`, c.creature);
        }
      } else c.progress = Math.max(0, c.progress - dt * 0.5);
    }
    if (this.stone && !this.stone.taken && dist2(this.stone.x, this.stone.y, P.x, P.y) < 40 * 40) {
      this.stone.taken = true; this.loreFound = this.stone.idx; sfx('cage');
      this.app.toast(`📜 ${tr('memoryFound')}`, null, L(LORE[this.stone.idx]));
    }

    // level-ups (one at a time)
    if (this.pendingLevels > 0 && !this.paused) { this.pendingLevels--; this.openLevelUp(); }

    // camera
    this.cam.x += (P.x - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (P.y - this.cam.y) * Math.min(1, dt * 8);
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeMag = 0; }
    this.fx.update(dt);

    // win check
    if (isFinite(this.duration) && this.time >= this.duration && (!this.level.boss || this.bossKilled)) this.end(true);
  }

  updateHazards(dt) {
    const hz = this.realm.hazard;
    const P = this.player;
    if (hz === 'current') {
      this.curT = (this.curT || 0) + dt;
      const a = Math.floor(this.curT / 10) * 1.7;
      this.hazardCurrent = { x: Math.cos(a) * 28, y: Math.sin(a) * 28 };
    }
    if ((hz === 'lightning' || hz === 'rifts' || hz === 'embers') && this.time > 8) {
      this.hzT = (this.hzT ?? 5) - dt;
      if (this.hzT <= 0) {
        this.hzT = Math.max(2.2, 6 - this.level.stage * 0.1);
        const x = P.x + rnd(-160, 160), y = P.y + rnd(-160, 160);
        const col = hz === 'lightning' ? '#fff36b' : hz === 'embers' ? '#ff8a3d' : '#ff5d73';
        this.telegraph({ x, y, r: 44, t: 1.1, color: col, onDone: (tx, ty) => { this.hazardHit(tx, ty, 44, 10 * this.dmgMult); this.fx.burst(tx, ty, col, 14, 240); for (const e of this.enemies) if (!e.dead && dist2(e.x, e.y, tx, ty) < 44 * 44) this.damage(e, 30 * this.hpMult, tx, ty, 100); if (hz === 'lightning') sfx('zap'); else sfx('boom'); } });
      }
    }
  }

  land(power) {
    const P = this.player;
    P.lift = 0; P.squash = 0.35;
    this.phase = 'play';
    this.launch.fly = null;
    const R = 70 + power * 60;
    this.fx.ring(P.x, P.y, R * 1.2, '#ffffff', 0.5, 12); this.fx.burst(P.x, P.y, this.pal.deco, 30, 280, 4);
    this.shake(10); sfx('land');
    for (const e of this.enemies) {
      e.asleep = false;
      if (dist2(e.x, e.y, P.x, P.y) < R * R) this.damage(e, (40 + power * 60) * this.stats.dmg * B.enemyHpMult(this.level.g), P.x, P.y, 300);
    }
    const hitCount = this.kills;
    if (hitCount >= 5) { this.banner(`💥 ×${hitCount}`); this.bonusCoins = (this.bonusCoins || 0) + hitCount * 2; }
    playMusic(this.realm, 0.6);
    this.app.ui.hud(this, true);
  }

  trailColor() {
    const tr2 = this.S.cosmetics.trail;
    const map = { stardust: '#ffe27a', petal: '#ff9fd0', frost: '#bfe9ff', flame: '#ff8a3d' };
    if (tr2 === 'rainbow') return `hsl(${(this.time * 300) % 360},90%,70%)`;
    return map[tr2] || '#ffffff';
  }

  end(win) {
    if (this.phase === 'end') return;
    this.phase = 'end';
    const P = this.player;
    const hpRatio = P.hp / this.stats.maxHp;
    let stars = 0;
    if (win) { stars = 1; if (hpRatio >= B.STAR_HP_RATIO) stars++; if (this.level.cages && this.rescued.length >= this.level.cages) stars++; }
    if (this.level.kind === 'endless') stars = 0;
    const greed = this.stats.coins * (this.muts.has('goldrush') ? 2 : 1) * (this.night ? 1.5 : 1);
    let coins = B.runCoins({ kills: this.kills, g: this.level.g, stars: win ? stars : 0, greed }) + (this.bonusCoins || 0);
    if (this.level.kind === 'endless') coins = Math.floor(this.kills * 0.3 + this.time * 0.8) * this.stats.coins;
    const pieces = this.level.kind === 'endless' ? Math.floor(this.time / 120) : B.runPieces({ stars, boss: !!this.level.boss });
    const result = {
      win, stars, coins: Math.round(coins), pieces, kills: this.kills, time: this.time, level: this.level, night: this.night,
      rescued: win || this.level.kind === 'endless' ? this.rescued : this.rescued, lore: this.loreFound, boss: !!this.bossKilled,
      flawless: win && this.flawless && this.duration >= 180, evolved: this.evolved, plevel: this.plevel,
      weapons: this.weapons.map((w) => ({ id: w.id, lvl: w.lvl, evo: w.evo })), hits: this.hitCount,
    };
    sfx(win ? 'win' : 'lose');
    setTimeout(() => this.app.finishRun(result), win ? 900 : 1200);
  }

  // ── rendering ──────────────────────────────────────────
  render(ctx, view, tt) {
    const { w, h, scale } = view;
    const P = this.player;
    const R = this.realm;
    // background void
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, R.sky[0]); g.addColorStop(1, R.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save();
    let sx = 0, sy = 0;
    if (this.shakeMag > 0) { sx = rnd(-this.shakeMag, this.shakeMag); sy = rnd(-this.shakeMag, this.shakeMag); }
    ctx.translate(w / 2 + sx, h / 2 + sy);
    ctx.scale(scale, scale);
    ctx.translate(-this.cam.x, -this.cam.y);
    this.drawFloor(ctx, view, tt);

    // zones
    for (const z of this.zones) {
      if (z.kind === 'fire') { const k = z.life / z.max; glow(ctx, z.x, z.y, z.r * 1.8, z.color, 0.55 * k); ctx.fillStyle = hexA('#ffd166', 0.25 * k); ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (0.6 + Math.sin(tt * 20 + z.x) * 0.1), 0, TAU); ctx.fill(); }
      else if (z.kind === 'mine') { ctx.fillStyle = z.arm > 0 ? '#6a5a7a' : (Math.sin(tt * 12) > 0 ? '#ff4d6d' : '#8a2040'); ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#1a0f22'; ctx.lineWidth = 2; ctx.stroke(); if (z.arm <= 0) glow(ctx, z.x, z.y, 22, '#ff4d6d', 0.4); }
    }
    // telegraphs
    for (const tl of this.teles) {
      const k = 1 - tl.t / tl.max;
      if (tl.line) {
        ctx.save(); ctx.translate(tl.x, tl.y); ctx.rotate(tl.a);
        ctx.fillStyle = hexA(tl.color, 0.12 + 0.2 * k); ctx.fillRect(0, -tl.w / 2, tl.len, tl.w);
        ctx.strokeStyle = hexA(tl.color, 0.6); ctx.lineWidth = 2; ctx.strokeRect(0, -tl.w / 2, tl.len, tl.w); ctx.restore();
        continue;
      }
      if (tl.block) { drawBlock(ctx, tl.x - 12, tl.y - 12 - (1 - k) * 260, 24, tl.color, 0.95); ctx.strokeStyle = hexA(tl.color, 0.5); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(tl.x, tl.y, tl.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); continue; }
      ctx.fillStyle = hexA(tl.color, 0.1 + 0.18 * k); ctx.beginPath(); ctx.arc(tl.x, tl.y, tl.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexA(tl.color, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tl.x, tl.y, tl.r * k, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(tl.x, tl.y, tl.r, 0, TAU); ctx.stroke();
    }
    // gems
    for (const gm of this.gems) {
      const s = gm.big ? 7 : 4.5, bob = Math.sin(tt * 4 + gm.t) * 1.5;
      const c = gm.v >= 10 ? '#ff8ccf' : gm.v >= 4 ? '#7ef0ff' : '#9df28a';
      glow(ctx, gm.x, gm.y + bob, s * 3, c, 0.45);
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(gm.x, gm.y - s + bob); ctx.lineTo(gm.x + s * 0.7, gm.y + bob); ctx.lineTo(gm.x, gm.y + s + bob); ctx.lineTo(gm.x - s * 0.7, gm.y + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(gm.x - 1, gm.y - s * 0.5 + bob, 2, s * 0.5);
    }
    // pickups
    for (const pk of this.pickups) {
      const bob = Math.sin(tt * 3 + pk.x) * 3;
      if (pk.kind === 'chest') { glow(ctx, pk.x, pk.y, 40, '#ffd166', 0.6); ctx.fillStyle = '#b8742a'; roundRect(ctx, pk.x - 14, pk.y - 10 + bob, 28, 20, 4); ctx.fill(); ctx.fillStyle = '#ffd166'; ctx.fillRect(pk.x - 14, pk.y - 3 + bob, 28, 4); ctx.fillRect(pk.x - 3, pk.y - 6 + bob, 6, 9); }
      else if (pk.kind === 'heart') { glow(ctx, pk.x, pk.y, 22, '#ff6b8a', 0.5); ctx.fillStyle = '#ff6b8a'; ctx.font = '18px system-ui'; ctx.textAlign = 'center'; ctx.fillText('♥', pk.x, pk.y + 6 + bob); }
      else { glow(ctx, pk.x, pk.y, 22, '#7ef0ff', 0.5); ctx.fillStyle = '#7ef0ff'; ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⊕', pk.x, pk.y + 6 + bob); }
    }
    // cages
    for (const c of this.cages) this.drawCage(ctx, c, tt);
    if (this.stone && !this.stone.taken) { const s = this.stone; glow(ctx, s.x, s.y, 40, '#b5a1ff', 0.5 + Math.sin(tt * 3) * 0.2); ctx.fillStyle = '#4a4063'; roundRect(ctx, s.x - 10, s.y - 16, 20, 28, 8); ctx.fill(); ctx.fillStyle = '#d9ccff'; ctx.fillRect(s.x - 5, s.y - 8, 10, 2); ctx.fillRect(s.x - 5, s.y - 3, 7, 2); ctx.fillRect(s.x - 5, s.y + 2, 9, 2); }
    // void nest marker during launch
    if (this.phase === 'launch') { ctx.strokeStyle = hexA(this.pal.rim, 0.5); ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.nest.x, this.nest.y, 80, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }

    // enemies
    for (const e of this.enemies) {
      if (e.asleep) { ctx.globalAlpha = 0.85; drawEnemy(ctx, e, tt * 0.3, this.pal); ctx.globalAlpha = 1; if (Math.sin(tt * 2 + e.seed) > 0.6) { ctx.fillStyle = '#fff'; ctx.font = '700 10px \'Baloo 2\''; ctx.fillText('z', e.x + e.r, e.y - e.r - Math.sin(tt * 2 + e.seed) * 6); } continue; }
      if (e.st === 'wind') { ctx.strokeStyle = 'rgba(255,77,109,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.lockA) * 180, e.y + Math.sin(e.lockA) * 180); ctx.stroke(); }
      drawEnemy(ctx, e, tt, this.pal);
      if (e.elite) { const k = e.hp / e.maxHp; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - 18, e.y - e.r - 22, 36, 4); ctx.fillStyle = '#ffd166'; ctx.fillRect(e.x - 18, e.y - e.r - 22, 36 * k, 4); }
    }
    if (this.boss && !this.boss.dead) drawBoss(ctx, this.boss, tt);
    // laser
    if (this.laser) {
      const L2 = this.laser; ctx.save(); ctx.translate(L2.x, L2.y); ctx.rotate(L2.a);
      if (L2.live) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hexA(this.boss ? this.boss.def.color : '#fff', 0.8); ctx.fillRect(0, -L2.w / 2, L2.len, L2.w); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(0, -L2.w / 6, L2.len, L2.w / 3); ctx.globalCompositeOperation = 'source-over'; }
      else { ctx.strokeStyle = 'rgba(255,77,109,0.7)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L2.len, 0); ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
    }

    // player
    const blink = P.iframe > 0 && Math.sin(tt * 40) > 0;
    // petals under/around
    for (const wpn of this.weapons) if (wpn.id === 'petals' && wpn.pos) for (const [px, py, a] of wpn.pos) { ctx.save(); ctx.translate(px, py); ctx.rotate(a * 2); ctx.fillStyle = wpn.evo ? '#ffd0ee' : '#ff9fd0'; ctx.beginPath(); ctx.ellipse(0, 0, 10 * this.stats.area, 5 * this.stats.area, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#a0406a'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
    if (!blink) drawHero(ctx, P.x, P.y, P.r, tt, { face: P.face, moving: P.moving > 0.1, hat: this.S.cosmetics.hat, scarf: this.app.scarfColor(), lift: P.lift, squash: P.squash, hurt: P.iframe > 0.3 });
    // slingshot visuals
    if (this.phase === 'launch' && !this.launch.fly) this.drawSling(ctx, tt);

    // projectiles
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.projs) {
      glow(ctx, p.x, p.y, p.r * 3, p.color, 0.6);
      if (p.kind === 'boomer') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin); ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.35, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      else if (p.kind === 'bee') { ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 4, 3, 2, Math.sin(tt * 50), 0, TAU); ctx.fill(); }
      else if (p.kind === 'shard') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(p.r * 1.6, 0); ctx.lineTo(0, -p.r * 0.6); ctx.lineTo(-p.r, 0); ctx.lineTo(0, p.r * 0.6); ctx.fill(); ctx.restore(); }
      else if (p.kind === 'stone') { ctx.fillStyle = p.explode ? '#ffb070' : p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, TAU); ctx.fill(); ctx.fillStyle = p.color; star(ctx, p.x, p.y, p.r * 1.2, 4, 0.4); ctx.fill(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    // enemy bullets — always on top, always the same "danger" look
    for (const b of this.ebullets) {
      glow(ctx, b.x, b.y, b.r * 2.8, '#ff4d6d', 0.55);
      ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe0e6'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU); ctx.fill();
    }
    this.fx.draw(ctx, tt);
    ctx.restore();

    // screen-space overlays
    if (this.muts.has('fog')) {
      const rg = ctx.createRadialGradient(w / 2, h / 2, 90 * scale, w / 2, h / 2, 260 * scale);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, hexA(R.void, 0.96));
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    } else {
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, hexA(R.void, 0.7));
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    }
    this.drawIndicators(ctx, view, tt);
    if (Input.joy.active && this.phase === 'play') {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(Input.joy.bx, Input.joy.by, 56, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(Input.joy.bx + Input.joy.dx * 56, Input.joy.by + Input.joy.dy * 56, 22, 0, TAU); ctx.fill();
    }
    if (this.bannerText) {
      const k = this.bannerText.t;
      ctx.globalAlpha = Math.min(1, k * 2, (2.2 - k) * 4);
      ctx.font = `800 ${Math.min(34, w / 14)}px 'Baloo 2', system-ui`; ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,10,30,0.85)'; ctx.strokeText(this.bannerText.text, w / 2, h * 0.3);
      ctx.fillStyle = '#fff6e8'; ctx.fillText(this.bannerText.text, w / 2, h * 0.3);
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'launch' && !this.launch.fly && !this.launch.pulling) {
      ctx.font = "700 16px 'Baloo 2', system-ui"; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,246,232,' + (0.6 + Math.sin(tt * 3) * 0.3) + ')';
      ctx.fillText(tr('pullToLaunch'), w / 2, h * 0.78);
    }
  }

  drawFloor(ctx, view, tt) {
    const R = this.realm;
    const ww = view.w / view.scale, wh = view.h / view.scale;
    const x0 = this.cam.x - ww / 2 - 60, y0 = this.cam.y - wh / 2 - 60;
    ctx.fillStyle = this.pal.floorA;
    ctx.fillRect(x0, y0, ww + 120, wh + 120);
    const T = 96;
    const ix0 = Math.floor(x0 / T), iy0 = Math.floor(y0 / T);
    for (let iy = iy0; iy < iy0 + wh / T + 3; iy++) for (let ix = ix0; ix < ix0 + ww / T + 3; ix++) {
      const hsh = tileHash(ix, iy, this.level.realm);
      const x = ix * T, y = iy * T;
      // soft patches
      if ((hsh & 7) < 2) { ctx.fillStyle = hexA(this.pal.floorB, 0.35); ctx.beginPath(); ctx.ellipse(x + (hsh % 60) + 18, y + ((hsh >> 6) % 60) + 18, 26 + (hsh % 16), 14 + ((hsh >> 3) % 10), 0, 0, TAU); ctx.fill(); }
      const kind = (hsh >> 8) % 11;
      const dx = x + ((hsh >> 12) % 80) + 8, dy = y + ((hsh >> 16) % 80) + 8;
      ctx.fillStyle = hexA(R.ground, 0.55);
      if (kind === 0 || kind === 1) { // grass tuft
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(dx + k * 4, dy); ctx.quadraticCurveTo(dx + k * 6, dy - 8, dx + k * 7 + Math.sin(tt * 2 + ix) * 1.5, dy - 12); ctx.lineTo(dx + k * 4 + 2, dy); ctx.fill(); }
      } else if (kind === 2) { ctx.fillStyle = hexA(R.accent, 0.7); ctx.beginPath(); ctx.arc(dx, dy, 3, 0, TAU); ctx.fill(); ctx.fillStyle = hexA(R.glow, 0.9); ctx.beginPath(); ctx.arc(dx, dy, 1.4, 0, TAU); ctx.fill(); }
      else if (kind === 3) { ctx.fillStyle = hexA(R.groundDark, 0.9); ctx.beginPath(); ctx.ellipse(dx, dy, 9, 6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = hexA('#ffffff', 0.12); ctx.beginPath(); ctx.ellipse(dx - 2, dy - 2, 4, 2, 0, 0, TAU); ctx.fill(); }
      else if (kind === 4 && (hsh & 15) === 3) { // void crack
        ctx.strokeStyle = hexA(R.void, 0.8); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(dx - 20, dy - 6); ctx.lineTo(dx - 6, dy + 2); ctx.lineTo(dx + 4, dy - 4); ctx.lineTo(dx + 22, dy + 6); ctx.stroke();
        glow(ctx, dx, dy, 18, R.accent, 0.12);
      }
    }
    // drifting debris particles (parallax-free, cheap)
    ctx.fillStyle = hexA(R.glow, 0.35);
    for (let i = 0; i < 26; i++) {
      const px = ((i * 137.5 + tt * (12 + (i % 5) * 6)) % (ww + 40)) + this.cam.x - ww / 2 - 20;
      const py = ((i * 91.3 + Math.sin(tt + i) * 20 + tt * 8 * (i % 3)) % (wh + 40)) + this.cam.y - wh / 2 - 20;
      ctx.beginPath(); ctx.arc(px, py, 1 + (i % 3), 0, TAU); ctx.fill();
    }
  }

  drawCage(ctx, c, tt) {
    const bob = Math.sin(tt * 2 + c.t) * 2;
    if (c.open) { ctx.globalAlpha = 0.35; }
    glow(ctx, c.x, c.y, 60, c.creature.look.color, 0.35 + (this.meta.pickup > 0 ? 0.2 : 0));
    if (!c.open) drawCreature(ctx, c.x, c.y + 4 + bob, 12, c.creature.look, tt, { phase: c.t });
    ctx.strokeStyle = '#e8d2b0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(c.x, c.y - 22 + bob, 22, 8, 0, Math.PI, 0); ctx.stroke();
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(c.x + i * 10, c.y - 22 + bob + (Math.abs(i) === 2 ? 4 : 0)); ctx.lineTo(c.x + i * 10, c.y + 18 + bob); ctx.stroke(); }
    ctx.fillStyle = '#8a6a32'; roundRect(ctx, c.x - 26, c.y + 16 + bob, 52, 8, 4); ctx.fill();
    ctx.globalAlpha = 1;
    if (!c.open && c.progress > 0) {
      ctx.strokeStyle = '#7dffc8'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(c.x, c.y, 34, -Math.PI / 2, -Math.PI / 2 + TAU * c.progress); ctx.stroke();
    }
  }

  drawSling(ctx, tt) {
    const P = this.player;
    // launch pad: a little island edge
    ctx.fillStyle = mixHex(this.realm.ground, '#ffffff', 0.1);
    ctx.beginPath(); ctx.ellipse(0, 20, 60, 22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = this.realm.groundDark; ctx.beginPath(); ctx.moveTo(-60, 20); ctx.quadraticCurveTo(0, 90, 60, 20); ctx.fill();
    const px = this.launch.px, py = this.launch.py;
    // posts
    ctx.strokeStyle = '#8a6a32'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-26, 30); ctx.lineTo(-22, -6); ctx.moveTo(26, 30); ctx.lineTo(22, -6); ctx.stroke();
    ctx.strokeStyle = '#ffe0c0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-22, -6); ctx.lineTo(P.x + px, P.y + py); ctx.lineTo(22, -6); ctx.stroke();
    if (Math.hypot(px, py) > 10) {
      // trajectory preview
      const tx = -px * 3.4, ty = -py * 3.4;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 1; i <= 14; i++) { const k = i / 14; ctx.globalAlpha = 1 - k * 0.6; ctx.beginPath(); ctx.arc(tx * k, ty * k - Math.sin(k * Math.PI) * 60, 3.2 - k * 1.5, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      const R = 70 + (Math.hypot(px, py) / 110) * 60;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(tx, ty, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if (this.launch.pulling) { P.x = px; P.y = py; } else if (!this.launch.fly) { P.x = 0; P.y = 0; }
    ctx.lineCap = 'butt';
  }

  drawIndicators(ctx, view, tt) {
    const { w, h, scale } = view;
    const items = [];
    for (const c of this.cages) if (!c.open) items.push([c.x, c.y, c.creature.look.color, '🐾']);
    if (this.stone && !this.stone.taken) items.push([this.stone.x, this.stone.y, '#b5a1ff', '📜']);
    if (this.boss && !this.boss.dead) items.push([this.boss.x, this.boss.y, '#ff4d6d', '☠']);
    for (const [x, y, col, icon] of items) {
      const sx = (x - this.cam.x) * scale + w / 2, sy = (y - this.cam.y) * scale + h / 2;
      if (sx > 20 && sx < w - 20 && sy > 70 && sy < h - 20) continue;
      const a = Math.atan2(sy - h / 2, sx - w / 2);
      const m = 30;
      const ex = clamp(w / 2 + Math.cos(a) * w, m, w - m), ey = clamp(h / 2 + Math.sin(a) * h, 90, h - m);
      ctx.save(); ctx.translate(ex, ey);
      ctx.fillStyle = hexA(col, 0.9); ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
      ctx.rotate(a); ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(14, -6); ctx.lineTo(14, 6); ctx.fill(); ctx.rotate(-a);
      ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, 0, 1);
      ctx.restore();
    }
  }

  hudData() {
    const dur = this.duration;
    return {
      time: isFinite(dur) ? (this.level.boss && this.time >= dur && !this.bossKilled ? '☠' : fmtTime(Math.max(0, dur - this.time))) : fmtTime(this.time),
      prog: isFinite(dur) ? Math.min(1, this.time / dur) : 0,
      hp: this.player.hp / this.stats.maxHp, hpText: `${Math.ceil(this.player.hp)}/${Math.round(this.stats.maxHp)}`,
      xp: this.xp / this.xpNeed, lvl: this.plevel, kills: this.kills,
      boss: this.boss && !this.boss.dead ? { name: L(this.boss.def.name), hp: this.boss.hp / this.boss.maxHp } : null,
      cages: `${this.rescued.length}/${this.level.cages || 0}`,
    };
  }
}
