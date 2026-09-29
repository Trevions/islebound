// The Island Well — a calm Tetris. Pieces earned in dives fall here;
// every full row becomes a permanent strip of land on your island.
import { WELL_W, WELL_H, LINE_CLEAR_COINS } from '../data/balance.js';
import { drawBlock, PIECE_COLORS, roundRect } from '../core/draw.js';
import { Save } from '../core/save.js';
import { sfx } from '../core/audio.js';
import { hexA } from '../core/util.js';

export const SHAPES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
const KEYS = Object.keys(SHAPES);
export const randomPiece = () => KEYS[Math.floor(Math.random() * KEYS.length)];

export class Well {
  constructor(onChange) {
    const I = Save.state.island;
    if (!I.well || I.well.length !== WELL_W * WELL_H) I.well = new Array(WELL_W * WELL_H).fill(0);
    this.I = I; this.onChange = onChange;
    this.cur = null; this.anim = []; this.flashRows = [];
    this.spawn();
  }
  get grid() { return this.I.well; }
  cell(x, y) { if (x < 0 || x >= WELL_W || y >= WELL_H) return 1; if (y < 0) return 0; return this.grid[y * WELL_W + x]; }
  cellsOf(p, dx = 0, dy = 0, rot = p.rot) {
    return SHAPES[p.type].map(([x, y]) => {
      let rx = x, ry = y;
      const size = p.type === 'I' ? 4 : 3, c = (size - 1) / 2;
      for (let i = 0; i < rot; i++) { const nx = c - (ry - c), ny = c + (rx - c); rx = nx; ry = ny; }
      return [Math.round(rx) + p.x + dx, Math.round(ry) + p.y + dy];
    });
  }
  fits(p, dx = 0, dy = 0, rot = p.rot) { return this.cellsOf(p, dx, dy, rot).every(([x, y]) => !this.cell(x, y)); }
  spawn() {
    if (!this.I.queue.length) { this.cur = null; return; }
    const type = this.I.queue[0];
    this.cur = { type, x: type === 'I' ? 2 : 2, y: -1, rot: 0, color: KEYS.indexOf(type) + 1 };
    if (!this.fits(this.cur)) this.cur.y = -2;
    if (!this.fits(this.cur)) this.settle();
  }
  settle() {
    // top-out: the well compresses into land (half value) and empties
    const filled = this.grid.filter((c) => c).length;
    const lands = Math.floor(filled / WELL_W / 2);
    this.I.lands += lands;
    this.I.well = new Array(WELL_W * WELL_H).fill(0);
    this.onChange && this.onChange({ settled: true, lands });
    this.spawn();
  }
  move(dx) { if (this.cur && this.fits(this.cur, dx, 0)) { this.cur.x += dx; sfx('move'); } }
  rotate() {
    if (!this.cur) return;
    const r = (this.cur.rot + 1) % 4;
    for (const kick of [0, -1, 1, -2, 2]) if (this.fits(this.cur, kick, 0, r)) { this.cur.x += kick; this.cur.rot = r; sfx('move'); return; }
  }
  soft() { if (this.cur && this.fits(this.cur, 0, 1)) { this.cur.y++; sfx('move'); } }
  ghostY() { let dy = 0; while (this.cur && this.fits(this.cur, 0, dy + 1)) dy++; return dy; }
  drop() {
    if (!this.cur) return null;
    const dy = this.ghostY();
    this.cur.y += dy;
    for (const [x, y] of this.cellsOf(this.cur)) if (y >= 0) this.grid[y * WELL_W + x] = this.cur.color;
    this.anim.push({ cells: this.cellsOf(this.cur), t: 0.25 });
    this.I.queue.shift();
    Save.state.stats.pieces++;
    sfx('place');
    // line clears
    const rows = [];
    for (let y = 0; y < WELL_H; y++) { let full = true; for (let x = 0; x < WELL_W; x++) if (!this.grid[y * WELL_W + x]) { full = false; break; } if (full) rows.push(y); }
    let coins = 0;
    if (rows.length) {
      for (const y of rows) { this.grid.splice(y * WELL_W, WELL_W); this.grid.unshift(...new Array(WELL_W).fill(0)); }
      this.I.lands += rows.length;
      coins = LINE_CLEAR_COINS[Math.min(4, rows.length)];
      Save.state.coins += coins;
      Save.state.stats.lines += rows.length;
      if (rows.length >= 4) Save.state.stats.quads++;
      this.flashRows = rows.map((y) => ({ y, t: 0.5 }));
      sfx('line', rows.length);
    }
    this.cur = null;
    this.spawn();
    Save.save();
    const res = { lines: rows.length, coins };
    this.onChange && this.onChange(res);
    return res;
  }
  draw(ctx, W, H, t) {
    const s = Math.floor(Math.min(W / WELL_W, H / WELL_H));
    const ox = Math.floor((W - s * WELL_W) / 2), oy = Math.floor((H - s * WELL_H) / 2);
    ctx.clearRect(0, 0, W, H);
    // well backdrop
    ctx.fillStyle = 'rgba(10,8,24,0.55)'; roundRect(ctx, ox - 6, oy - 6, s * WELL_W + 12, s * WELL_H + 12, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let x = 0; x <= WELL_W; x++) { ctx.beginPath(); ctx.moveTo(ox + x * s, oy); ctx.lineTo(ox + x * s, oy + s * WELL_H); ctx.stroke(); }
    for (let y = 0; y <= WELL_H; y++) { ctx.beginPath(); ctx.moveTo(ox, oy + y * s); ctx.lineTo(ox + s * WELL_W, oy + y * s); ctx.stroke(); }
    for (let y = 0; y < WELL_H; y++) for (let x = 0; x < WELL_W; x++) { const c = this.grid[y * WELL_W + x]; if (c) drawBlock(ctx, ox + x * s, oy + y * s, s, PIECE_COLORS[(c - 1) % PIECE_COLORS.length]); }
    if (this.cur) {
      const gy = this.ghostY();
      for (const [x, y] of this.cellsOf(this.cur, 0, gy)) if (y >= 0) { ctx.strokeStyle = hexA(PIECE_COLORS[this.cur.color - 1], 0.7); ctx.lineWidth = 2; ctx.setLineDash([4, 3]); roundRect(ctx, ox + x * s + 3, oy + y * s + 3, s - 6, s - 6, s * 0.2); ctx.stroke(); ctx.setLineDash([]); }
      const pulse = 0.85 + Math.sin(t * 5) * 0.15;
      for (const [x, y] of this.cellsOf(this.cur)) if (y >= 0) drawBlock(ctx, ox + x * s, oy + y * s, s, PIECE_COLORS[this.cur.color - 1], pulse);
    }
    for (const f of this.flashRows) { ctx.fillStyle = `rgba(255,255,255,${f.t})`; ctx.fillRect(ox, oy + f.y * s, s * WELL_W, s); f.t -= 0.02; }
    this.flashRows = this.flashRows.filter((f) => f.t > 0);
    this.layout = { ox, oy, s };
  }
}

// Mini preview of a piece for the queue
export function drawPiece(ctx, type, x, y, s) {
  const cells = SHAPES[type];
  const color = PIECE_COLORS[KEYS.indexOf(type)];
  const minx = Math.min(...cells.map((c) => c[0])), maxx = Math.max(...cells.map((c) => c[0]));
  const miny = Math.min(...cells.map((c) => c[1])), maxy = Math.max(...cells.map((c) => c[1]));
  const w = (maxx - minx + 1) * s, h = (maxy - miny + 1) * s;
  for (const [cx, cy] of cells) drawBlock(ctx, x - w / 2 + (cx - minx) * s, y - h / 2 + (cy - miny) * s, s, color);
}
