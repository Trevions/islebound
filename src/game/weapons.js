// Weapon behaviours. Each weapon ticks every frame; stats come from data/weapons.js.
import { WEAPONS } from '../data/weapons.js';
import { TAU, dist2, rnd } from '../core/util.js';
import { sfx } from '../core/audio.js';

export function wstat(w, key) {
  const def = WEAPONS[w.id];
  let v = def.base[key] ?? 0;
  for (let i = 0; i < w.lvl - 1; i++) if (def.lvl[i][key] !== undefined) v += def.lvl[i][key];
  return v;
}

function nearest(run, x, y, maxD = 1e9, exclude) {
  let best = null, bd = maxD * maxD;
  for (const e of run.enemies) {
    if (e.dead || (exclude && exclude.has(e))) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  if (run.boss && !run.boss.dead && !(exclude && exclude.has(run.boss))) {
    const d = dist2(x, y, run.boss.x, run.boss.y);
    if (d < bd) best = run.boss;
  }
  return best;
}
function nearestN(run, x, y, n, maxD = 520) {
  const arr = [];
  for (const e of run.enemies) if (!e.dead) { const d = dist2(x, y, e.x, e.y); if (d < maxD * maxD) arr.push([d, e]); }
  if (run.boss && !run.boss.dead) arr.push([dist2(x, y, run.boss.x, run.boss.y), run.boss]);
  arr.sort((a, b) => a[0] - b[0]);
  return arr.slice(0, n).map((a) => a[1]);
}
function eachInRadius(run, x, y, r, fn) {
  const r2 = r * r;
  for (const e of run.enemies) if (!e.dead && dist2(x, y, e.x, e.y) < (r + e.r) * (r + e.r)) fn(e);
  if (run.boss && !run.boss.dead && dist2(x, y, run.boss.x, run.boss.y) < (r + run.boss.r) ** 2) fn(run.boss);
  return r2;
}

export function tickWeapon(run, w, dt) {
  const P = run.player, st = run.stats;
  const def = WEAPONS[w.id];
  const area = st.area;
  const cdm = st.cd;
  const dmg = (k = 1) => wstat(w, 'dmg') * st.dmg * k * (w.evo ? 2 : 1);
  w.t -= dt;
  switch (w.id) {
    case 'spark': {
      if (w.t > 0) return;
      const cnt = wstat(w, 'count') + (w.evo ? 2 : 0);
      const targets = nearestN(run, P.x, P.y, cnt);
      if (!targets.length) { w.t = 0.1; return; }
      w.t = wstat(w, 'cd') * cdm;
      targets.forEach((tg, i) => {
        const a = Math.atan2(tg.y - P.y, tg.x - P.x) + (i ? rnd(-0.08, 0.08) : 0);
        const sp = wstat(w, 'speed');
        run.addProj({ x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: dmg(), r: 6 * area, pierce: w.evo ? 99 : wstat(w, 'pierce'), life: 1.1, color: def.color, kind: 'bolt', burst: w.evo });
      });
      sfx('shoot');
      return;
    }
    case 'petals': {
      const cnt = w.evo ? 12 : wstat(w, 'count');
      const rad = wstat(w, 'radius') * area * (w.evo ? 1.25 : 1);
      w.ang = (w.ang || 0) + wstat(w, 'speed') * dt * (w.evo ? 1.2 : 1);
      w.pos = [];
      for (let i = 0; i < cnt; i++) {
        const a = w.ang + (i / cnt) * TAU;
        const px = P.x + Math.cos(a) * rad, py = P.y + Math.sin(a) * rad;
        w.pos.push([px, py, a]);
        eachInRadius(run, px, py, 11 * area, (e) => {
          e.hitBy = e.hitBy || {};
          if ((e.hitBy.petals || 0) > run.time) return;
          e.hitBy.petals = run.time + 0.35;
          run.damage(e, dmg(), px, py, 60);
          if (w.evo) run.heal(0.35);
        });
      }
      return;
    }
    case 'nova': {
      if (w.t > 0) return;
      w.t = wstat(w, 'cd') * cdm * (w.evo ? 0.8 : 1);
      const rad = wstat(w, 'radius') * area * (w.evo ? 1.3 : 1);
      const pulse = (delay, k) => run.later(delay, () => {
        run.fx.ring(P.x, P.y, rad, def.color, 0.4);
        eachInRadius(run, P.x, P.y, rad, (e) => run.damage(e, dmg(k), P.x, P.y, w.evo ? -140 : 120));
        sfx('whoosh');
      });
      pulse(0, 1);
      if (w.evo) pulse(0.35, 0.8);
      return;
    }
    case 'chain': {
      if (w.t > 0) return;
      w.t = wstat(w, 'cd') * cdm;
      const chains = w.evo ? 3 : 1;
      const range = wstat(w, 'range') * area;
      let any = false;
      for (let c = 0; c < chains; c++) {
        const hit = new Set();
        let from = { x: P.x, y: P.y };
        const jumps = wstat(w, 'jumps') + (w.evo ? 6 : 0);
        const pts = [[P.x, P.y]];
        for (let j = 0; j < jumps; j++) {
          const tg = nearest(run, from.x, from.y, j === 0 ? range * 1.4 : range, hit);
          if (!tg) break;
          hit.add(tg); any = true;
          run.damage(tg, dmg(), from.x, from.y, 20);
          pts.push([tg.x, tg.y]);
          from = tg;
        }
        if (pts.length > 1) run.fx.lightning(pts, def.color);
      }
      if (any) sfx('zap'); else w.t = 0.2;
      return;
    }
    case 'boomerang': {
      if (w.t > 0) return;
      w.t = wstat(w, 'cd') * cdm;
      const cnt = wstat(w, 'count') + (w.evo ? 1 : 0);
      for (let i = 0; i < cnt; i++) {
        const a = P.faceA + (i - (cnt - 1) / 2) * 0.5;
        const sp = wstat(w, 'speed');
        run.addProj({ x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: dmg(), r: (w.evo ? 26 : 14) * area, pierce: 999, life: 4, color: def.color, kind: 'boomer', range: wstat(w, 'range') * area, traveled: 0, back: false, rehit: 0.3 });
      }
      sfx('whoosh');
      return;
    }
    case 'frost': {
      if (w.t > 0) return;
      const tg = nearest(run, P.x, P.y, 480);
      if (!tg) { w.t = 0.15; return; }
      w.t = wstat(w, 'cd') * cdm;
      const cnt = wstat(w, 'count');
      const base = Math.atan2(tg.y - P.y, tg.x - P.x);
      for (let i = 0; i < cnt; i++) {
        const a = base + (i - (cnt - 1) / 2) * 0.16;
        const sp = wstat(w, 'speed');
        run.addProj({ x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: dmg(), r: 6 * area, pierce: 0, life: 0.9, color: def.color, kind: 'shard', slow: wstat(w, 'slow'), slowT: 1.5 * run.stats.dur, freeze: w.evo ? 1.2 * run.stats.dur : 0 });
      }
      sfx('shoot');
      return;
    }
    case 'ember': {
      if (w.t > 0) return;
      w.t = wstat(w, 'cd') * cdm;
      const moved = Math.hypot(P.x - (w.lx ?? P.x + 99), P.y - (w.ly ?? 0));
      if (moved < 10 && !w.evo) return;
      w.lx = P.x; w.ly = P.y;
      run.zones.push({ kind: 'fire', x: P.x + rnd(-4, 4), y: P.y + rnd(-4, 4), r: wstat(w, 'radius') * area, life: wstat(w, 'life') * run.stats.dur, max: wstat(w, 'life') * run.stats.dur, dmg: dmg(), tick: 0, color: def.color });
      if (w.evo) {
        w.burst = (w.burst || 0) + 1;
        if (w.burst % 5 === 0) { run.zones.push({ kind: 'fire', x: P.x, y: P.y, r: wstat(w, 'radius') * area * 3, life: 1.2, max: 1.2, dmg: dmg(1.5), tick: 0, color: '#ffd166' }); run.fx.ring(P.x, P.y, 70 * area, '#ff9a4d', 0.4); }
      }
      return;
    }
    case 'tetra': {
      if (w.t > 0) return;
      w.t = wstat(w, 'cd') * cdm;
      const cnt = wstat(w, 'count');
      const cands = nearestN(run, P.x, P.y, 20, 420);
      if (!cands.length) { w.t = 0.3; return; }
      for (let i = 0; i < cnt; i++) {
        const tg = cands[Math.floor(Math.random() * cands.length)];
        const rad = wstat(w, 'radius') * area;
        run.telegraph({ x: tg.x, y: tg.y, r: rad, t: 0.45, color: def.color, friendly: true, block: true, onDone: (tx, ty) => {
          eachInRadius(run, tx, ty, rad, (e) => run.damage(e, dmg(), tx, ty, 80));
          run.fx.burst(tx, ty, def.color, 10); run.shake(3); sfx('place');
        } });
      }
      if (w.evo) {
        w.lc = (w.lc || 0) + 1;
        if (w.lc % 3 === 0) {
          const ly = P.y + rnd(-120, 120);
          run.fx.lineClear(P.x, ly, run.view.ww);
          for (const e of run.enemies) if (!e.dead && Math.abs(e.y - ly) < 40 && Math.abs(e.x - P.x) < run.view.ww / 2) run.damage(e, dmg(2.5), e.x, ly, 0);
          if (run.boss && Math.abs(run.boss.y - ly) < 60) run.damage(run.boss, dmg(2.5), run.boss.x, ly, 0);
          sfx('line', 4); run.shake(6);
        }
      }
      return;
    }
    case 'chomp': {
      if (w.t > 0) return;
      w.t = wstat(w, 'cd') * cdm;
      const range = wstat(w, 'range') * area;
      const arc = w.evo ? Math.PI : wstat(w, 'arc');
      const a0 = P.faceA;
      run.fx.chomp(P.x, P.y, range, a0, arc, def.color);
      const hitCone = (e) => {
        const a = Math.atan2(e.y - P.y, e.x - P.x);
        let d = Math.abs(((a - a0 + Math.PI * 3) % TAU) - Math.PI);
        if (d < arc + 0.15) run.damage(e, dmg(), P.x, P.y, 160);
      };
      eachInRadius(run, P.x, P.y, range, hitCone);
      if (w.evo) for (const g of run.gems) if (dist2(g.x, g.y, P.x, P.y) < (range * 2.2) ** 2) g.magnet = true;
      sfx('kill');
      return;
    }
    case 'bees': {
      if (w.evo) {
        const alive = run.projs.filter((p) => p.kind === 'bee' && p.perm).length;
        if (alive < 8 && w.t <= 0) { w.t = 0.4; run.addProj(bee(run, w, dmg(), true)); }
        return;
      }
      if (w.t > 0) return;
      w.t = wstat(w, 'cd') * cdm;
      for (let i = 0; i < wstat(w, 'count'); i++) run.addProj(bee(run, w, dmg(), false));
      return;
    }
    case 'sling': {
      if (w.t > 0) return;
      w.t = wstat(w, 'cd') * cdm;
      const cnt = wstat(w, 'count');
      for (let i = 0; i < cnt; i++) {
        const a = P.faceA + (i - (cnt - 1) / 2) * 0.18;
        const sp = wstat(w, 'speed');
        run.addProj({ x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: dmg(), r: (w.evo ? 13 : 8) * area, pierce: wstat(w, 'pierce'), life: 1.2, color: def.color, kind: 'stone', explode: w.evo ? 60 * area : 0 });
      }
      sfx('shoot');
      return;
    }
    case 'tide': {
      if (w.t > 0) return;
      w.t = wstat(w, 'cd') * cdm * (w.evo ? 0.5 : 1);
      const rad = wstat(w, 'radius') * area;
      run.fx.ring(P.x, P.y, rad, def.color, 0.7, 10);
      eachInRadius(run, P.x, P.y, rad, (e) => run.damage(e, dmg(), P.x, P.y, wstat(w, 'push')));
      for (const b of run.ebullets) if (dist2(b.x, b.y, P.x, P.y) < rad * rad) b.life = 0; // waves wash away bullets
      if (w.evo) run.heal(3);
      sfx('whoosh');
      return;
    }
  }
}

function bee(run, w, dmg, perm) {
  const P = run.player;
  const a = rnd(TAU);
  return { x: P.x + Math.cos(a) * 16, y: P.y + Math.sin(a) * 16, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, dmg, r: 5, pierce: perm ? 999 : 2, life: perm ? 1e9 : wstat(w, 'life') * run.stats.dur, color: WEAPONS.bees.color, kind: 'bee', speed: wstat(w, 'speed'), perm, rehit: 0.4 };
}

// Projectile update shared by all weapons.
export function updateProj(run, p, dt) {
  const P = run.player;
  if (p.kind === 'boomer') {
    p.traveled += Math.hypot(p.vx, p.vy) * dt;
    p.spin = (p.spin || 0) + dt * 18;
    if (!p.back && p.traveled > p.range) p.back = true;
    if (p.back) {
      const a = Math.atan2(P.y - p.y, P.x - p.x), sp = Math.hypot(p.vx, p.vy);
      p.vx += (Math.cos(a) * sp - p.vx) * Math.min(1, dt * 6); p.vy += (Math.sin(a) * sp - p.vy) * Math.min(1, dt * 6);
      if (dist2(p.x, p.y, P.x, P.y) < 400) p.life = 0;
    }
  } else if (p.kind === 'bee') {
    if (!p.tg || p.tg.dead) p.tg = nearest(run, p.x, p.y, 380);
    let tx = P.x, ty = P.y;
    if (p.tg) { tx = p.tg.x; ty = p.tg.y; }
    const a = Math.atan2(ty - p.y, tx - p.x);
    p.vx += (Math.cos(a) * p.speed - p.vx) * Math.min(1, dt * 5);
    p.vy += (Math.sin(a) * p.speed - p.vy) * Math.min(1, dt * 5);
    if (p.perm && !p.tg && dist2(p.x, p.y, P.x, P.y) < 2500) { p.vx += rnd(-80, 80); p.vy += rnd(-80, 80); }
  }
  p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
  // collisions
  const hit = (e) => {
    if (p.rehit) { e.hitBy = e.hitBy || {}; const k = 'p' + p.id; if ((e.hitBy[k] || 0) > run.time) return false; e.hitBy[k] = run.time + p.rehit; }
    else { p.hits = p.hits || new Set(); if (p.hits.has(e)) return false; p.hits.add(e); }
    run.damage(e, p.dmg, p.x - p.vx * 0.02, p.y - p.vy * 0.02, p.kind === 'stone' ? 90 : 40, p);
    if (p.slow) { e.slowT = p.slowT; e.slow = p.slow; }
    if (p.freeze) e.frozen = p.freeze;
    if (p.burst) { run.fx.burst(p.x, p.y, '#ffe27a', 5); for (const o of run.enemies) if (!o.dead && o !== e && dist2(o.x, o.y, p.x, p.y) < 1600) run.damage(o, p.dmg * 0.5, p.x, p.y, 20); }
    if (p.explode) { run.fx.ring(p.x, p.y, p.explode, '#ffb070', 0.3); for (const o of run.enemies) if (!o.dead && dist2(o.x, o.y, p.x, p.y) < p.explode ** 2) run.damage(o, p.dmg * 0.6, p.x, p.y, 80); }
    p.pierce--;
    if (p.pierce < 0) p.life = 0;
    return true;
  };
  for (const e of run.enemies) {
    if (e.dead) continue;
    const rr = e.r + p.r;
    if (Math.abs(e.x - p.x) < rr && Math.abs(e.y - p.y) < rr && dist2(e.x, e.y, p.x, p.y) < rr * rr) { hit(e); if (p.life <= 0) return; }
  }
  const b = run.boss;
  if (b && !b.dead && dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) ** 2) hit(b);
}
