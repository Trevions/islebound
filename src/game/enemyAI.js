// Enemy behaviours — 13 archetypes, each readable at a glance and fair.
import { TAU, dist2, rnd } from '../core/util.js';

export function updateEnemy(run, e, dt) {
  const P = run.player;
  const dx = P.x - e.x, dy = P.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  let sp = e.speed * (e.slowT > 0 ? 1 - e.slow : 1);
  if (e.slowT > 0) e.slowT -= dt;
  if (e.frozen > 0) { e.frozen -= dt; sp = 0; }
  if (e.flash > 0) e.flash -= dt;
  let tx = ux, ty = uy; // desired direction
  e.t += dt;

  switch (e.ai) {
    case 'swoop': {
      const s = Math.sin(e.t * 4 + e.seed) * 0.9;
      tx = ux - uy * s; ty = uy + ux * s; break;
    }
    case 'dash': {
      e.st = e.st || 'approach';
      if (e.st === 'approach') { if (d < 230 && e.t > 1) { e.st = 'wind'; e.timer = 0.6; e.lockA = Math.atan2(dy, dx); } }
      else if (e.st === 'wind') { sp = 0; e.flash = 0.05; e.timer -= dt; if (e.timer <= 0) { e.st = 'dash'; e.timer = 0.45; } }
      else if (e.st === 'dash') { tx = Math.cos(e.lockA); ty = Math.sin(e.lockA); sp *= 5.5; e.timer -= dt; if (e.timer <= 0) { e.st = 'rest'; e.timer = 1.2; } }
      else { sp *= 0.3; e.timer -= dt; if (e.timer <= 0) { e.st = 'approach'; e.t = 0; } }
      break;
    }
    case 'ranged': {
      if (d < 200) { tx = -ux; ty = -uy; } else if (d < 260) { tx = -uy; ty = ux; sp *= 0.5; }
      e.cool = (e.cool ?? rnd(1, 2.5)) - dt;
      if (e.cool <= 0 && d < 420) { e.cool = 2.4; run.enemyShot(e.x, e.y, Math.atan2(dy, dx), 170, e.dmg); }
      break;
    }
    case 'ghost': {
      // Pac-Man ghost: alternate chase and scatter, drift through others
      const cyc = (e.t + e.seed) % 7.5;
      if (cyc > 5) {
        if (!e.scat || cyc < 5.05) { const a = rnd(TAU); e.scat = { x: P.x + Math.cos(a) * 260, y: P.y + Math.sin(a) * 260 }; }
        const sx = e.scat.x - e.x, sy = e.scat.y - e.y, sd = Math.hypot(sx, sy) || 1;
        tx = sx / sd; ty = sy / sd; e.ghostAlpha = 0.45;
      } else { e.ghostAlpha = 0.9; sp *= 1.1; }
      e.noSep = true;
      break;
    }
    case 'kamikaze': {
      if (e.fuse > 0) {
        sp *= 0.2; e.fuse -= dt;
        if (e.fuse <= 0) { run.explodeAt(e.x, e.y, 62, e.dmg); e.hp = 0; run.kill(e, true); return; }
      } else if (d < 46) e.fuse = 0.55;
      break;
    }
    case 'shield': e.shieldA = Math.atan2(dy, dx); break;
    case 'orbit': {
      e.orbR = e.orbR ?? 220;
      e.orbR = Math.max(40, e.orbR - dt * 14);
      const a = Math.atan2(-dy, -dx) + dt * (sp / e.orbR) * 1.1;
      const gx = P.x + Math.cos(a) * e.orbR, gy = P.y + Math.sin(a) * e.orbR;
      const gdx = gx - e.x, gdy = gy - e.y, gd = Math.hypot(gdx, gdy) || 1;
      tx = gdx / gd; ty = gdy / gd; sp *= 1.3;
      break;
    }
    case 'blink': {
      e.cool = (e.cool ?? rnd(2, 4)) - dt;
      if (e.blinkT > 0) { e.blinkT -= dt; sp = 0; if (e.blinkT <= 0) { const a = rnd(TAU); e.x = P.x + Math.cos(a) * 130; e.y = P.y + Math.sin(a) * 130; run.fx.burst(e.x, e.y, run.pal.rim, 8); } }
      else if (e.cool <= 0 && d < 500) { e.cool = 3.2; e.blinkT = 0.3; run.fx.burst(e.x, e.y, run.pal.rim, 8); }
      sp *= 0.7;
      break;
    }
    case 'healer': {
      if (d < 180) { tx = -ux; ty = -uy; }
      e.cool = (e.cool ?? 3) - dt;
      if (e.healPulse > 0) e.healPulse -= dt * 1.5;
      if (e.cool <= 0) {
        e.cool = 3.2; e.healPulse = 1;
        for (const o of run.enemies) if (!o.dead && o !== e && dist2(o.x, o.y, e.x, e.y) < 130 * 130) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.25);
      }
      break;
    }
    case 'mines': {
      sp *= 0.8;
      e.cool = (e.cool ?? 2) - dt;
      if (e.cool <= 0) { e.cool = 2.6; run.zones.push({ kind: 'mine', x: e.x, y: e.y, r: 12, arm: 0.8, life: 12, max: 12, dmg: e.dmg * 1.8 }); }
      break;
    }
  }
  e.vx = tx * sp; e.vy = ty * sp;
  // knockback
  if (e.kx || e.ky) { e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= Math.pow(0.0015, dt); e.ky *= Math.pow(0.0015, dt); if (Math.abs(e.kx) + Math.abs(e.ky) < 5) e.kx = e.ky = 0; }
  if (run.hazardCurrent) { e.x += run.hazardCurrent.x * dt * 0.5; e.y += run.hazardCurrent.y * dt * 0.5; }
  e.x += e.vx * dt; e.y += e.vy * dt;
}

// cheap separation through a spatial hash
export function separate(run) {
  const cell = 40, grid = new Map();
  for (const e of run.enemies) {
    if (e.dead || e.noSep) continue;
    const k = ((e.x / cell) | 0) * 73856093 ^ ((e.y / cell) | 0) * 19349663;
    let arr = grid.get(k); if (!arr) grid.set(k, (arr = [])); arr.push(e);
  }
  for (const arr of grid.values()) {
    if (arr.length < 2) continue;
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      const dx = b.x - a.x, dy = b.y - a.y, rr = (a.r + b.r) * 0.85;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (rr - d) * 0.5, nx = dx / d, ny = dy / d;
        const wa = b.r / (a.r + b.r), wb = 1 - wa;
        a.x -= nx * push * wa; a.y -= ny * push * wa; b.x += nx * push * wb; b.y += ny * push * wb;
      }
    }
  }
}
