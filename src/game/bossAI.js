// Guardian pattern engine. Patterns are telegraphed so every hit is avoidable.
import { TAU, rnd } from '../core/util.js';
import { sfx } from '../core/audio.js';

export function updateBoss(run, b, dt) {
  const P = run.player;
  const dx = P.x - b.x, dy = P.y - b.y, d = Math.hypot(dx, dy) || 1;
  if (b.flash > 0) b.flash -= dt;
  b.t += dt;
  // phase from HP
  const frac = b.hp / b.maxHp;
  const n = b.form.phases;
  const phase = Math.min(n - 1, Math.floor((1 - frac) * n));
  if (phase !== b.phase) { b.phase = phase; b.cool = 1.2; run.fx.ring(b.x, b.y, 220, b.def.color, 0.8, 12); run.shake(10); sfx('boss'); run.banner(`${'I'.repeat(phase + 1)}`); }
  const patterns = b.def.phases[b.phase];

  if (b.action) { b.action.update(dt); if (b.action.done) b.action = null; }
  else {
    // drift to a comfortable distance
    const want = 190;
    const sp = b.def.speed * (d > want ? 1 : -0.6);
    b.x += (dx / d) * sp * dt; b.y += (dy / d) * sp * dt;
    b.cool -= dt;
    if (b.cool <= 0) {
      const p = patterns[b.pi++ % patterns.length];
      b.action = makeAction(run, b, p);
      b.cool = Math.max(0.9, 2.2 - b.phase * 0.35);
    }
  }
  // contact damage
  if (d < b.r + P.r) run.hurtPlayer(b.dmg * 1.2, b.x, b.y);
}

function makeAction(run, b, p) {
  const P = run.player;
  const spd = 170 + b.phase * 25;
  const dmg = b.dmg;
  const act = { t: 0, done: false, update(dt) { this.t += dt; this.step(dt); } };
  switch (p) {
    case 'aimed': {
      let shots = 0;
      act.step = () => {
        if (act.t > shots * 0.45 && shots < 3) {
          shots++;
          const a = Math.atan2(P.y - b.y, P.x - b.x);
          for (let i = -2; i <= 2; i++) run.enemyShot(b.x, b.y, a + i * 0.18, spd, dmg, 8);
          sfx('shoot');
        }
        if (act.t > 1.4) act.done = true;
      };
      break;
    }
    case 'radial': {
      let waves = 0;
      act.step = () => {
        if (act.t > waves * 0.6 && waves < 2) {
          const cnt = 16 + b.phase * 4, off = waves * (Math.PI / cnt);
          for (let i = 0; i < cnt; i++) run.enemyShot(b.x, b.y, off + (i / cnt) * TAU, spd * 0.85, dmg, 8);
          waves++; sfx('boom');
        }
        if (act.t > 1.3) act.done = true;
      };
      break;
    }
    case 'spiral': {
      let acc = 0, ang = rnd(TAU);
      act.step = (dt) => {
        acc += dt;
        while (acc > 0.07) { acc -= 0.07; ang += 0.33; for (let k = 0; k < 2 + (b.phase > 1 ? 1 : 0); k++) run.enemyShot(b.x, b.y, ang + (k * TAU) / (2 + (b.phase > 1 ? 1 : 0)), spd * 0.8, dmg, 7); }
        if (act.t > 2.4) act.done = true;
      };
      break;
    }
    case 'charge': {
      let a = 0, st = 0;
      act.step = (dt) => {
        if (st === 0) { a = Math.atan2(P.y - b.y, P.x - b.x); run.telegraphLine(b.x, b.y, a, 520, b.r * 1.6, 0.75); st = 1; }
        else if (st === 1 && act.t > 0.75) { st = 2; sfx('launch'); }
        else if (st === 2) { b.x += Math.cos(a) * 620 * dt; b.y += Math.sin(a) * 620 * dt; run.fx.trail(b.x, b.y, b.def.color); if (act.t > 1.55) { st = 3; run.shake(8); } }
        else if (act.t > 1.9) act.done = true;
      };
      break;
    }
    case 'summon': {
      act.step = () => {
        if (act.t === 0 || !act.did) {
          act.did = true;
          const cnt = 4 + b.phase * 2;
          for (let i = 0; i < cnt; i++) { const a = (i / cnt) * TAU; run.spawnEnemy(b.def.minion, b.x + Math.cos(a) * (b.r + 30), b.y + Math.sin(a) * (b.r + 30)); }
          run.fx.ring(b.x, b.y, b.r * 2, b.def.color, 0.5); sfx('boss');
        }
        if (act.t > 0.8) act.done = true;
      };
      break;
    }
    case 'slam': {
      act.step = () => {
        if (!act.did) {
          act.did = true;
          const tx = P.x, ty = P.y;
          run.telegraph({ x: tx, y: ty, r: 90, t: 1.0, color: '#ff4d6d', onDone: (x, y) => {
            run.hazardHit(x, y, 90, dmg * 1.6); run.shake(12); sfx('boom');
            const cnt = 12 + b.phase * 4;
            for (let i = 0; i < cnt; i++) run.enemyShot(x, y, (i / cnt) * TAU, spd * 0.7, dmg, 7);
          } });
        }
        if (act.t > 1.3) act.done = true;
      };
      break;
    }
    case 'rain': {
      act.step = () => {
        if (!act.did) {
          act.did = true;
          const cnt = 6 + b.phase * 3;
          for (let i = 0; i < cnt; i++) {
            const x = P.x + rnd(-200, 200), y = P.y + rnd(-200, 200);
            run.telegraph({ x, y, r: 48, t: 0.9 + i * 0.08, color: '#ff4d6d', onDone: (tx, ty) => { run.hazardHit(tx, ty, 48, dmg); run.fx.burst(tx, ty, b.def.color, 10); } });
          }
        }
        if (act.t > 1.6) act.done = true;
      };
      break;
    }
    case 'laser': {
      let a0 = 0, st = 0;
      const sweep = (b.phase + 1) * 0.6 * (Math.random() < 0.5 ? -1 : 1);
      act.step = () => {
        if (st === 0) { a0 = Math.atan2(P.y - b.y, P.x - b.x) - sweep / 2; run.laser = { x: b.x, y: b.y, a: a0, w: 26, len: 700, live: false }; st = 1; }
        if (st === 1) { run.laser.x = b.x; run.laser.y = b.y; if (act.t > 0.8) { st = 2; run.laser.live = true; sfx('zap'); } }
        if (st === 2) {
          const k = Math.min(1, (act.t - 0.8) / 1.3);
          run.laser.a = a0 + sweep * k; run.laser.x = b.x; run.laser.y = b.y;
          // hit test
          const L = run.laser, px = P.x - L.x, py = P.y - L.y;
          const along = px * Math.cos(L.a) + py * Math.sin(L.a);
          const perp = Math.abs(-px * Math.sin(L.a) + py * Math.cos(L.a));
          if (along > 0 && along < L.len && perp < L.w / 2 + P.r) run.hurtPlayer(dmg * 1.3, L.x, L.y);
          if (k >= 1) { run.laser = null; act.done = true; }
        }
      };
      break;
    }
    default: act.step = () => { act.done = true; };
  }
  return act;
}
