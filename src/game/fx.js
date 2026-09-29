// Juice: particles, rings, lightning, damage numbers, trails.
import { TAU, rnd, hexA } from '../core/util.js';
import { glow, drawBlock } from '../core/draw.js';

export class FX {
  constructor() { this.parts = []; this.rings = []; this.bolts = []; this.texts = []; this.chomps = []; this.lines = []; }
  burst(x, y, color, n = 8, speed = 160, size = 3) {
    if (this.parts.length > 450) n = Math.min(n, 2);
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), s = rnd(speed * 0.3, speed);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.25, 0.6), max: 0.6, color, size: rnd(size * 0.6, size * 1.4) });
    }
  }
  trail(x, y, color) { if (this.parts.length < 450) this.parts.push({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: 0, vy: -10, life: 0.4, max: 0.4, color, size: rnd(2, 5) }); }
  ring(x, y, r, color, dur = 0.4, width = 5) { this.rings.push({ x, y, r, color, t: 0, dur, width }); }
  lightning(pts, color) { this.bolts.push({ pts: pts.map(([x, y]) => [x, y]), color, life: 0.16 }); }
  text(x, y, str, color = '#fff', big = false) {
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({ x: x + rnd(-6, 6), y, str, color, life: big ? 0.9 : 0.6, max: big ? 0.9 : 0.6, big });
  }
  chomp(x, y, r, a, arc, color) { this.chomps.push({ x, y, r, a, arc, color, life: 0.22 }); }
  lineClear(x, y, w) { this.lines.push({ x, y, w, life: 0.5 }); }

  update(dt) {
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.dur);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter((b) => b.life > 0);
    for (const t of this.texts) { t.y -= 40 * dt; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const c of this.chomps) c.life -= dt;
    this.chomps = this.chomps.filter((c) => c.life > 0);
    for (const l of this.lines) l.life -= dt;
    this.lines = this.lines.filter((l) => l.life > 0);
  }

  draw(ctx, t) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const k = r.t / r.dur;
      ctx.strokeStyle = hexA(r.color, (1 - k) * 0.9); ctx.lineWidth = r.width * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.2 + 0.8 * Math.sqrt(k)), 0, TAU); ctx.stroke();
    }
    for (const b of this.bolts) {
      ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.globalAlpha = b.life / 0.16;
      ctx.beginPath();
      b.pts.forEach(([x, y], i) => {
        if (i === 0) { ctx.moveTo(x, y); return; }
        const [px, py] = b.pts[i - 1];
        for (let s = 1; s <= 3; s++) { const k = s / 4; ctx.lineTo(px + (x - px) * k + rnd(-7, 7), py + (y - py) * k + rnd(-7, 7)); }
        ctx.lineTo(x, y);
      });
      ctx.stroke();
      for (const [x, y] of b.pts) glow(ctx, x, y, 16, b.color, 0.7);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const c of this.chomps) {
      const open = Math.sin((c.life / 0.22) * Math.PI) * c.arc;
      ctx.fillStyle = hexA(c.color, 0.35 * (c.life / 0.22) + 0.1);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, c.r, c.a - open, c.a + open); ctx.closePath(); ctx.fill();
    }
    for (const l of this.lines) {
      const s = 26; const n = Math.ceil(l.w / s);
      for (let i = 0; i < n; i++) drawBlock(ctx, l.x - l.w / 2 + i * s, l.y - s / 2, s, ['#7ef0ff', '#ffd166', '#ff8ccf', '#9df28a'][i % 4], l.life / 0.5);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const tx of this.texts) {
      ctx.globalAlpha = Math.min(1, tx.life / tx.max * 2);
      ctx.font = `800 ${tx.big ? 18 : 12}px 'Baloo 2', system-ui`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,10,30,0.8)'; ctx.strokeText(tx.str, tx.x, tx.y);
      ctx.fillStyle = tx.color; ctx.fillText(tx.str, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
  }
}
