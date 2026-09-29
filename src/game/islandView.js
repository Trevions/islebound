// Side-view of your floating island. It literally grows downward with every land you clear.
import { REALMS } from '../data/realms.js';
import { BUILDINGS } from '../data/progression.js';
import { CREATURES } from '../data/creatures.js';
import { drawCreature, drawHero, glow, roundRect } from '../core/draw.js';
import { mixHex, hexA, TAU } from '../core/util.js';
import { unlockedBuildings } from './meta.js';

export function drawIsland(ctx, W, H, t, S, o = {}) {
  ctx.clearRect(0, 0, W, H);
  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a1840'); g.addColorStop(0.6, '#2b1f4f'); g.addColorStop(1, '#0d0a1f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) { const x = (i * 97.3) % W, y = (i * 53.7) % (H * 0.7); ctx.fillStyle = `rgba(255,246,232,${0.25 + 0.35 * Math.sin(t * 1.5 + i)})`; ctx.fillRect(x, y, 1.6, 1.6); }
  // distant islands
  for (let i = 0; i < 4; i++) {
    const x = ((i * 0.29 + 0.1) * W + Math.sin(t * 0.2 + i) * 10), y = H * (0.18 + (i % 2) * 0.1) + Math.sin(t * 0.5 + i) * 4;
    ctx.fillStyle = hexA(REALMS[i * 3].ground, 0.25); ctx.beginPath(); ctx.ellipse(x, y, 26, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = hexA(REALMS[i * 3].groundDark, 0.2); ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.quadraticCurveTo(x, y + 30, x + 26, y); ctx.fill();
  }
  const lands = S.island.lands;
  const cx = W / 2, top = H * 0.46 + Math.sin(t * 0.8) * 4;
  const iw = Math.min(W * 0.86, 150 + Math.min(lands, 120) * 2.2);
  // underside strata: one strip per land (compressed)
  const strips = Math.min(lands, 40);
  const sh = strips ? Math.min(7, (H * 0.4) / strips) : 0;
  let y = top + 12;
  for (let i = 0; i < strips; i++) {
    const realm = REALMS[Math.floor((lands - strips + i) / 10) % 12];
    const w = iw * (1 - (i / (strips + 6)) * 0.85);
    ctx.fillStyle = mixHex(realm.groundDark, '#1a1030', 0.25 + (i % 3) * 0.08);
    ctx.fillRect(cx - w / 2, y, w, sh + 0.6);
    y += sh;
  }
  ctx.fillStyle = mixHex('#3a2a4f', '#1a1030', 0.3);
  ctx.beginPath(); ctx.moveTo(cx - iw * 0.5 * (strips ? 1 - (strips / (strips + 6)) * 0.85 : 1), y);
  ctx.quadraticCurveTo(cx, y + 50, cx + iw * 0.5 * (strips ? 1 - (strips / (strips + 6)) * 0.85 : 1), y); ctx.fill();
  glow(ctx, cx, y + 30, 50, '#b5a1ff', 0.35 + Math.sin(t * 2) * 0.1);
  // waterfall
  if (lands >= 10) { ctx.fillStyle = 'rgba(143,227,255,0.35)'; ctx.fillRect(cx + iw * 0.32, top + 6, 6, H - top); for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx + iw * 0.32 + 1, top + ((t * 90 + i * 50) % (H - top)), 4, 10); } }
  // top surface
  ctx.fillStyle = '#3e8f5a'; ctx.beginPath(); ctx.ellipse(cx, top + 8, iw / 2, 16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7bd389'; ctx.beginPath(); ctx.ellipse(cx, top, iw / 2, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#9ee6a6'; ctx.beginPath(); ctx.ellipse(cx - iw * 0.1, top - 3, iw * 0.3, 6, 0, 0, TAU); ctx.fill();
  // buildings
  const blds = unlockedBuildings(lands).filter((b) => (S.island.buildings[b] || 0) > 0);
  const n = blds.length;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  blds.forEach((id, i) => {
    const bx = cx - iw * 0.4 + (n > 1 ? (i / (n - 1)) * iw * 0.8 : iw * 0.4);
    const lvl = S.island.buildings[id];
    const size = 20 + Math.min(10, lvl) * 1.4;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(bx, top + 2, size * 0.5, 4, 0, 0, TAU); ctx.fill();
    ctx.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
    ctx.fillText(BUILDINGS[id].icon, bx, top + 3 + Math.sin(t * 2 + i) * 0.8);
  });
  // housed echoes wandering
  const housed = S.housed.slice(0, 12);
  housed.forEach((id, i) => {
    const c = CREATURES[id]; if (!c) return;
    const ph = t * 0.35 + i * 1.7;
    const x = cx + Math.sin(ph) * iw * 0.36;
    drawCreature(ctx, x, top - 7, 6, c.look, t, { phase: i });
  });
  drawHero(ctx, cx - 6 + Math.sin(t * 0.3) * 20, top - 10, 9, t, { face: Math.cos(t * 0.3) > 0 ? 1 : -1, hat: S.cosmetics.hat, scarf: o.scarf, moving: true });
  return { top, iw };
}
