// All art is drawn in code: hero, 60 Echoes, 13 enemy types, 12 Guardians,
// island, blocks, glows. Nothing is loaded from disk.
import { TAU, hexA, mixHex } from './util.js';
import { hashString } from './rng.js';

// ── cached glow sprites (cheap soft light, no shadowBlur) ──────────
const glowCache = new Map();
export function glowSprite(color, size = 64) {
  const key = color + size;
  if (glowCache.has(key)) return glowCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, hexA(color, 0.9)); grd.addColorStop(0.35, hexA(color, 0.35)); grd.addColorStop(1, hexA(color, 0));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}
export function glow(ctx, x, y, r, color, alpha = 1) {
  const s = glowSprite(color);
  ctx.globalAlpha = alpha;
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ── HERO: Pip ─────────────────────────────────────────────────────
export function drawHero(ctx, x, y, r, t, o = {}) {
  const face = o.face ?? 1;
  const moving = o.moving ?? 0;
  const bob = Math.sin(t * (moving ? 14 : 3)) * (moving ? 0.08 : 0.04);
  const sx = 1 + bob * 0.8 + (o.squash || 0), sy = 1 - bob - (o.squash || 0);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.95, r * 0.9, r * 0.28, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(x, y - (o.lift || 0));
  // scarf tail flowing behind
  const sc = o.scarf || '#ff6b6b';
  const wave = Math.sin(t * 10) * 3;
  ctx.fillStyle = sc;
  ctx.beginPath();
  ctx.moveTo(-face * r * 0.3, r * 0.25);
  ctx.quadraticCurveTo(-face * r * 1.2, r * 0.3 + wave, -face * r * 1.65, r * 0.05 - wave);
  ctx.lineTo(-face * r * 1.45, r * 0.45 + wave * 0.5);
  ctx.quadraticCurveTo(-face * r * 1.0, r * 0.55, -face * r * 0.2, r * 0.5);
  ctx.fill();
  ctx.scale(sx, sy);
  // body
  const body = o.hurt ? '#ffd0d0' : '#fff6e8';
  const grd = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.6, body); grd.addColorStop(1, '#f1d9bf');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.lineWidth = r * 0.09; ctx.strokeStyle = '#3a2a3f'; ctx.stroke();
  // scarf wrap
  ctx.fillStyle = sc;
  roundRect(ctx, -r * 0.82, r * 0.22, r * 1.64, r * 0.34, r * 0.17); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = r * 0.05; ctx.stroke();
  // eyes
  const ex = face * r * 0.18;
  const blink = (Math.sin(t * 0.9) > 0.985) ? 0.15 : 1;
  ctx.fillStyle = '#231a2b';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(ex + s * r * 0.3, -r * 0.12, r * 0.13, r * 0.19 * blink, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(ex + s * r * 0.3 + r * 0.04, -r * 0.2, r * 0.05, 0, TAU); ctx.fill(); }
  // blush
  ctx.fillStyle = 'rgba(255,120,140,0.45)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(ex + s * r * 0.52, r * 0.06, r * 0.12, r * 0.07, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  // hat / sprout drawn un-squashed on top
  drawHat(ctx, x, y - r * sy - (o.lift || 0), r, t, o.hat || 'none', face);
}

function drawHat(ctx, x, y, r, t, hat, face) {
  ctx.save(); ctx.translate(x, y);
  ctx.lineJoin = 'round';
  const outline = () => { ctx.strokeStyle = '#3a2a3f'; ctx.lineWidth = r * 0.07; ctx.stroke(); };
  switch (hat) {
    case 'cap':
      ctx.fillStyle = '#4cc9f0'; ctx.beginPath(); ctx.ellipse(0, r * 0.12, r * 0.62, r * 0.4, 0, Math.PI, 0); ctx.fill(); outline();
      ctx.beginPath(); ctx.ellipse(face * r * 0.5, r * 0.12, r * 0.4, r * 0.1, 0, 0, TAU); ctx.fill(); outline(); break;
    case 'crown':
      ctx.fillStyle = '#ffd166'; ctx.beginPath();
      ctx.moveTo(-r * 0.45, r * 0.15); ctx.lineTo(-r * 0.45, -r * 0.3); ctx.lineTo(-r * 0.22, -r * 0.05); ctx.lineTo(0, -r * 0.4);
      ctx.lineTo(r * 0.22, -r * 0.05); ctx.lineTo(r * 0.45, -r * 0.3); ctx.lineTo(r * 0.45, r * 0.15); ctx.closePath(); ctx.fill(); outline();
      ctx.fillStyle = '#ff6b9a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.08, 0, TAU); ctx.fill(); break;
    case 'wizard':
      ctx.fillStyle = '#5b4bdb'; ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.15); ctx.lineTo(face * r * 0.3, -r * 1.1); ctx.lineTo(r * 0.6, r * 0.15); ctx.closePath(); ctx.fill(); outline();
      ctx.fillStyle = '#ffe27a'; star(ctx, face * r * 0.05, -r * 0.35, r * 0.13, 5); ctx.fill(); break;
    case 'flower':
      ['#ff9fd0', '#ffd166', '#9df28a', '#8fe3ff', '#ff9fd0'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-r * 0.5 + i * r * 0.25, r * 0.05 - Math.sin(i * 1.2) * r * 0.08, r * 0.14, 0, TAU); ctx.fill(); }); break;
    case 'horns':
      ctx.fillStyle = '#2b1f3a';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.25, r * 0.2); ctx.quadraticCurveTo(s * r * 0.7, -r * 0.1, s * r * 0.55, -r * 0.6); ctx.quadraticCurveTo(s * r * 0.45, -r * 0.1, s * r * 0.05, r * 0.2); ctx.fill(); }
      break;
    case 'halo':
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.ellipse(0, -r * 0.35 + Math.sin(t * 3) * r * 0.05, r * 0.5, r * 0.15, 0, 0, TAU); ctx.stroke();
      glow(ctx, 0, -r * 0.35, r, '#ffe27a', 0.5); break;
    case 'beanie':
      ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.ellipse(0, r * 0.2, r * 0.66, r * 0.55, 0, Math.PI, 0); ctx.fill(); outline();
      ctx.fillStyle = '#fff6e8'; ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.16, 0, TAU); ctx.fill(); outline(); break;
    case 'propeller': {
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(0, r * 0.15, r * 0.5, r * 0.35, 0, Math.PI, 0); ctx.fill(); outline();
      ctx.fillStyle = '#3a2a3f'; ctx.fillRect(-r * 0.03, -r * 0.35, r * 0.06, r * 0.2);
      const w = Math.cos(t * 30) * r * 0.55; ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.ellipse(0, -r * 0.38, Math.abs(w), r * 0.07, 0, 0, TAU); ctx.fill(); break;
    }
    case 'bunny':
      ctx.fillStyle = '#fff6e8';
      for (const s of [-1, 1]) { ctx.save(); ctx.rotate(s * 0.2); ctx.beginPath(); ctx.ellipse(s * r * 0.25, -r * 0.45, r * 0.16, r * 0.5, 0, 0, TAU); ctx.fill(); outline(); ctx.fillStyle = '#ffb3c6'; ctx.beginPath(); ctx.ellipse(s * r * 0.25, -r * 0.45, r * 0.07, r * 0.35, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff6e8'; ctx.restore(); }
      break;
    default: { // sprout
      const sw = Math.sin(t * 2.4) * 0.25;
      ctx.strokeStyle = '#3e8f5a'; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.moveTo(0, r * 0.1); ctx.quadraticCurveTo(0, -r * 0.2, sw * r, -r * 0.35); ctx.stroke();
      ctx.fillStyle = '#7bd389';
      ctx.save(); ctx.translate(sw * r, -r * 0.35);
      ctx.beginPath(); ctx.ellipse(-r * 0.18, 0, r * 0.2, r * 0.1, -0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.18, -r * 0.04, r * 0.2, r * 0.1, 0.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

export function star(ctx, x, y, r, n = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// ── ECHO CREATURES ───────────────────────────────────────────────
export function drawCreature(ctx, x, y, r, look, t = 0, o = {}) {
  const bob = Math.sin(t * 3 + (o.phase || 0)) * r * 0.06;
  ctx.save(); ctx.translate(x, y + bob);
  if (o.silhouette) ctx.globalAlpha = 0.9;
  const col = o.silhouette ? '#2a2540' : look.color;
  const belly = o.silhouette ? '#2a2540' : look.belly;
  const line = o.silhouette ? '#1a1628' : '#2b1f33';
  ctx.lineWidth = r * 0.08; ctx.strokeStyle = line; ctx.lineJoin = 'round';
  // ears / features behind body
  ctx.fillStyle = col;
  switch (look.ears) {
    case 'cat': for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.75, -r * 0.3); ctx.lineTo(s * r * 0.6, -r * 1.05); ctx.lineTo(s * r * 0.15, -r * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
    case 'bunny': for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.38, -r * 1.0, r * 0.18, r * 0.5, s * 0.15, 0, TAU); ctx.fill(); ctx.stroke(); } break;
    case 'horn': ctx.fillStyle = o.silhouette ? col : '#fff4d6'; ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 0.8); ctx.lineTo(0, -r * 1.45); ctx.lineTo(r * 0.15, -r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'antenna': for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.25, -r * 0.8); ctx.quadraticCurveTo(s * r * 0.5, -r * 1.3, s * r * 0.7, -r * 1.25); ctx.stroke(); ctx.fillStyle = o.silhouette ? col : belly; ctx.beginPath(); ctx.arc(s * r * 0.7, -r * 1.25, r * 0.14, 0, TAU); ctx.fill(); ctx.stroke(); } break;
    case 'fin': ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.8); ctx.quadraticCurveTo(r * 0.1, -r * 1.5, r * 0.5, -r * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'leaf': ctx.fillStyle = o.silhouette ? col : '#7bd389'; ctx.beginPath(); ctx.ellipse(r * 0.2, -r * 1.0, r * 0.18, r * 0.36, 0.6, 0, TAU); ctx.fill(); ctx.stroke(); break;
    case 'crown': ctx.fillStyle = o.silhouette ? col : '#ffd166'; ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.75); ctx.lineTo(-r * 0.4, -r * 1.15); ctx.lineTo(-r * 0.15, -r * 0.95); ctx.lineTo(0, -r * 1.25); ctx.lineTo(r * 0.15, -r * 0.95); ctx.lineTo(r * 0.4, -r * 1.15); ctx.lineTo(r * 0.4, -r * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
  }
  // body
  ctx.fillStyle = col;
  ctx.beginPath();
  switch (look.body) {
    case 'tall': ctx.ellipse(0, 0, r * 0.75, r * 1.0, 0, 0, TAU); break;
    case 'wide': ctx.ellipse(0, r * 0.1, r * 1.1, r * 0.8, 0, 0, TAU); break;
    case 'drop': ctx.moveTo(0, -r * 1.05); ctx.bezierCurveTo(r * 1.1, -r * 0.1, r * 0.95, r * 0.9, 0, r * 0.9); ctx.bezierCurveTo(-r * 0.95, r * 0.9, -r * 1.1, -r * 0.1, 0, -r * 1.05); break;
    default: ctx.arc(0, 0, r * 0.9, 0, TAU);
  }
  ctx.fill(); ctx.stroke();
  if (!o.silhouette) {
    // belly
    ctx.fillStyle = hexA(belly, 0.75);
    ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.5, r * 0.4, 0, 0, TAU); ctx.fill();
    // pattern
    ctx.fillStyle = hexA('#000000', 0.12);
    if (look.pattern === 1) [[-0.5, -0.3], [0.45, -0.45], [0.55, 0.15]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a * r, b * r, r * 0.12, 0, TAU); ctx.fill(); });
    if (look.pattern === 2) for (let i = -1; i <= 1; i++) { ctx.fillRect(i * r * 0.28 - r * 0.05, -r * 0.85, r * 0.1, r * 0.35); }
    if (look.pattern === 3) { ctx.fillStyle = hexA('#ffffff', 0.5); star(ctx, r * 0.45, -r * 0.4, r * 0.14); ctx.fill(); }
    // eyes
    const ey = -r * 0.15;
    if (look.eyes === 2) {
      ctx.fillStyle = '#1b1422'; ctx.beginPath(); ctx.arc(0, ey, r * 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 0.09, ey - r * 0.1, r * 0.1, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#1b1422';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.3, ey, r * 0.11, r * 0.16, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#fff';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.3 + r * 0.04, ey - r * 0.06, r * 0.045, 0, TAU); ctx.fill(); }
    }
    ctx.strokeStyle = '#1b1422'; ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.arc(0, r * 0.08, r * 0.1, 0.2, Math.PI - 0.2); ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = `bold ${r}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, r * 0.05);
  }
  ctx.restore();
}

const creatureCache = new Map();
export function creatureImage(look, size = 96, silhouette = false) {
  const key = JSON.stringify(look) + size + silhouette;
  if (creatureCache.has(key)) return creatureCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  drawCreature(g, size / 2, size * 0.58, size * 0.3, look, 0, { silhouette });
  const url = c.toDataURL();
  creatureCache.set(key, url);
  return url;
}
export function heroImage(size = 128, o = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  drawHero(g, size / 2, size * 0.6, size * 0.26, 0.3, o);
  return c.toDataURL();
}

// ── ENEMIES (void creatures: dark bodies, realm-colored glow) ─────
export function drawEnemy(ctx, e, t, pal) {
  const r = e.r;
  const flash = e.flash > 0;
  const body = flash ? '#ffffff' : e.frozen > 0 ? '#9fd8ff' : pal.body;
  const rim = pal.rim;
  const eye = pal.eye;
  ctx.save(); ctx.translate(e.x, e.y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 0.85, r * 0.25, 0, 0, TAU); ctx.fill();
  if (e.elite) glow(ctx, 0, 0, r * 2.2, '#ffd166', 0.35);
  const wob = Math.sin(t * 8 + e.seed) * 0.08;
  ctx.fillStyle = body; ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1.5, r * 0.12);
  const face = e.vx >= 0 ? 1 : -1;
  switch (e.shape) {
    case 'bat': {
      const f = Math.sin(t * 22 + e.seed) * 0.5;
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (const s of [-1, 1]) { ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * r * 1.2, -r * (0.9 + f), s * r * 1.8, -r * f * 0.6); ctx.quadraticCurveTo(s * r * 1.1, r * 0.1, 0, r * 0.3); }
      ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.fill(); ctx.stroke(); break;
    }
    case 'brute':
      roundRect(ctx, -r, -r * 0.9, r * 2, r * 1.8, r * 0.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = hexA(rim, 0.35); ctx.fillRect(-r * 0.7, -r * 0.55, r * 0.35, r * 0.2); ctx.fillRect(r * 0.3, r * 0.1, r * 0.4, r * 0.2); break;
    case 'dasher':
      ctx.rotate(Math.atan2(e.vy, e.vx));
      ctx.beginPath(); ctx.moveTo(r * 1.3, 0); ctx.lineTo(-r * 0.8, -r * 0.85); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.8, r * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.rotate(-Math.atan2(e.vy, e.vx)); break;
    case 'spitter':
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * (0.9 + wob), 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(face * r * 0.7, r * 0.2, r * 0.3, 0, TAU); ctx.fill(); break;
    case 'splitter':
      ctx.beginPath(); ctx.arc(-r * 0.3, 0, r * 0.75, 0, TAU); ctx.arc(r * 0.35, -r * 0.1, r * 0.7, 0, TAU); ctx.fill(); ctx.stroke(); break;
    case 'wisp': {
      ctx.globalAlpha = e.ghostAlpha ?? 0.85;
      glow(ctx, 0, 0, r * 2.4, rim, 0.5);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, -r * 0.2, r, Math.PI, 0);
      for (let i = 0; i <= 4; i++) ctx.lineTo(r - (i * r * 2) / 4, r * 0.7 + (i % 2 ? -r * 0.25 : r * 0.1) + Math.sin(t * 10 + i) * 2);
      ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    }
    case 'bomber': {
      const pulse = e.fuse > 0 ? (Math.sin(t * 40) > 0 ? '#ff4d6d' : body) : body;
      ctx.fillStyle = pulse; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.3, -r * 1.5, r * 0.5, -r * 1.4); ctx.stroke();
      glow(ctx, r * 0.5, -r * 1.4, 8, '#ffd166', 0.8 + Math.sin(t * 30) * 0.2); break;
    }
    case 'shielder': {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      const a = e.shieldA ?? 0;
      ctx.strokeStyle = '#cfe9ff'; ctx.lineWidth = r * 0.35; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.3, a - 1, a + 1); ctx.stroke(); ctx.globalAlpha = 1; break;
    }
    case 'orbiter':
      ctx.beginPath(); star(ctx, 0, 0, r * 1.15, 4, 0.55); ctx.fill(); ctx.stroke(); break;
    case 'blinker': {
      const s = e.blinkT > 0 ? 1 - e.blinkT / 0.3 : 1;
      ctx.scale(s, s);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * 0.8, 0, 0, TAU); ctx.fill(); ctx.stroke(); break;
    }
    case 'healer':
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7dffc8'; ctx.fillRect(-r * 0.12, -r * 0.5, r * 0.24, r); ctx.fillRect(-r * 0.5, -r * 0.12, r, r * 0.24);
      if (e.healPulse > 0) { ctx.strokeStyle = hexA('#7dffc8', e.healPulse); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 130 * (1 - e.healPulse), 0, TAU); ctx.stroke(); }
      break;
    case 'minelayer':
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t; ctx.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1); ctx.lineTo(Math.cos(a + 0.4) * r * 0.8, Math.sin(a + 0.4) * r * 0.8); }
      ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    default: // blob
      ctx.beginPath(); ctx.ellipse(0, r * 0.05, r * (1 + wob), r * (0.92 - wob), 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  // eye(s)
  if (e.shape !== 'bat' || true) {
    ctx.fillStyle = flash ? '#ff4d6d' : eye;
    const ey = e.shape === 'dasher' ? 0 : -r * 0.15;
    if (e.shape === 'brute' || e.shape === 'splitter' || e.shape === 'shielder') {
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(face * r * 0.2 + s * r * 0.3, ey, r * 0.16, 0, TAU); ctx.fill(); }
    } else {
      ctx.beginPath(); ctx.ellipse(face * r * 0.18, ey, r * 0.28, r * 0.3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#12091a'; ctx.beginPath(); ctx.arc(face * r * 0.26, ey, r * 0.12, 0, TAU); ctx.fill();
    }
  }
  if (e.elite) { ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#6a4a00'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 1.05); ctx.lineTo(-r * 0.5, -r * 1.5); ctx.lineTo(-r * 0.2, -r * 1.25); ctx.lineTo(0, -r * 1.6); ctx.lineTo(r * 0.2, -r * 1.25); ctx.lineTo(r * 0.5, -r * 1.5); ctx.lineTo(r * 0.5, -r * 1.05); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

// ── GUARDIANS ────────────────────────────────────────────────────
export function drawBoss(ctx, b, t) {
  const r = b.r, c = b.def.color, eye = b.def.eye;
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, r * 0.9, r, r * 0.3, 0, 0, TAU); ctx.fill();
  glow(ctx, 0, 0, r * 2.6, c, 0.45 + Math.sin(t * 3) * 0.1);
  const flash = b.flash > 0;
  const dark = mixHex(c, '#120a1a', 0.55);
  ctx.fillStyle = flash ? '#ffffff' : dark; ctx.strokeStyle = c; ctx.lineWidth = r * 0.08;
  const s = b.def.shape;
  const breathe = 1 + Math.sin(t * 2.5) * 0.04;
  ctx.scale(breathe, 2 - breathe);
  ctx.beginPath();
  if (s === 'gear') { for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t * 0.6; ctx.lineTo(Math.cos(a - 0.12) * r, Math.sin(a - 0.12) * r); ctx.lineTo(Math.cos(a - 0.08) * r * 1.2, Math.sin(a - 0.08) * r * 1.2); ctx.lineTo(Math.cos(a + 0.08) * r * 1.2, Math.sin(a + 0.08) * r * 1.2); ctx.lineTo(Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r); } }
  else if (s === 'prism') { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 0.4; ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); } }
  else if (s === 'moth') { ctx.ellipse(0, 0, r * 0.55, r * 0.9, 0, 0, TAU); for (const sd of [-1, 1]) { ctx.moveTo(0, 0); ctx.ellipse(sd * r * 0.9, -r * 0.2 + Math.sin(t * 6) * 5, r * 0.8, r * 0.55, sd * 0.4, 0, TAU); } }
  else if (s === 'wyrm') { for (let i = 0; i < 5; i++) { const off = Math.sin(t * 5 - i) * r * 0.25; ctx.moveTo(-i * r * 0.45 + r * 0.9, off); ctx.arc(-i * r * 0.45, off, r * (0.9 - i * 0.12), 0, TAU); } }
  else if (s === 'crown' || s === 'heart') {
    if (s === 'heart') { ctx.moveTo(0, r * 0.9); ctx.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.6, -r * 1.3, 0, -r * 0.45); ctx.bezierCurveTo(r * 0.6, -r * 1.3, r * 1.6, -r * 0.2, 0, r * 0.9); }
    else ctx.arc(0, 0, r, 0, TAU);
  }
  else if (s === 'bloom') { for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + t * 0.3; ctx.moveTo(Math.cos(a) * r * 0.6 + r * 0.5, Math.sin(a) * r * 0.6); ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.5, 0, TAU); } }
  else if (s === 'lantern') { roundRect(ctx, -r * 0.7, -r, r * 1.4, r * 2, r * 0.4); }
  else if (s === 'aurora') { for (let i = 0; i < 5; i++) { ctx.moveTo(r, 0); ctx.ellipse(0, 0, r * (1 - i * 0.1), r * (0.6 + i * 0.1), t * 0.5 + i * 0.6, 0, TAU); } }
  else if (s === 'bramble') { for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; const rr = i % 2 ? r * 0.85 : r * 1.25; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } }
  else { ctx.arc(0, 0, r, 0, TAU); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (s === 'crown') { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.7); ctx.lineTo(-r * 0.7, -r * 1.35); ctx.lineTo(-r * 0.35, -r * 1.0); ctx.lineTo(0, -r * 1.5); ctx.lineTo(r * 0.35, -r * 1.0); ctx.lineTo(r * 0.7, -r * 1.35); ctx.lineTo(r * 0.7, -r * 0.7); ctx.closePath(); ctx.fill(); }
  if (s === 'maw') { ctx.fillStyle = '#12091a'; ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.65, r * (0.2 + Math.abs(Math.sin(t * 3)) * 0.25), 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.16 - r * 0.06, r * 0.1); ctx.lineTo(i * r * 0.16, r * 0.25); ctx.lineTo(i * r * 0.16 + r * 0.06, r * 0.1); ctx.fill(); } }
  // eyes
  glow(ctx, -r * 0.3, -r * 0.2, r * 0.5, eye, 0.7); glow(ctx, r * 0.3, -r * 0.2, r * 0.5, eye, 0.7);
  ctx.fillStyle = eye;
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * r * 0.3, -r * 0.2, r * 0.13, r * 0.18, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ── TETROMINO BLOCK (island well) ─────────────────────────────────
export const PIECE_COLORS = ['#7bd389', '#5fe0d0', '#ff9a4d', '#8fb2d9', '#c9a7ff', '#ff8ccf', '#ffd166'];
export function drawBlock(ctx, x, y, s, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  const top = mixHex(color, '#ffffff', 0.35), dark = mixHex(color, '#000000', 0.35);
  ctx.fillStyle = dark; roundRect(ctx, x + 1, y + 1, s - 2, s - 2, s * 0.22); ctx.fill();
  ctx.fillStyle = color; roundRect(ctx, x + 1, y + 1, s - 2, s - 2 - s * 0.14, s * 0.22); ctx.fill();
  ctx.fillStyle = top; roundRect(ctx, x + s * 0.18, y + s * 0.14, s * 0.64, s * 0.2, s * 0.1); ctx.fill();
  // tiny grass tuft on top
  ctx.fillStyle = hexA('#ffffff', 0.25); ctx.fillRect(x + s * 0.2, y + s * 0.55, s * 0.08, s * 0.08);
  ctx.globalAlpha = 1;
}

// ── floor decoration (deterministic per tile) ─────────────────────
export function tileHash(ix, iy, salt = 0) { return hashString(`${ix},${iy},${salt}`); }
