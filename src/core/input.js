// Unified input: floating virtual joystick (touch/mouse) + keyboard.
export const Input = {
  keys: new Set(),
  joy: { active: false, id: null, bx: 0, by: 0, x: 0, y: 0, dx: 0, dy: 0 },
  pointer: { down: false, x: 0, y: 0, sx: 0, sy: 0 },
  handlers: { down: null, move: null, up: null },
  el: null,
  attach(el) {
    this.el = el;
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && e.target === document.body) e.preventDefault();
      this.onKey && this.onKey(e.code, e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.release(); });
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId);
      const p = this.local(e);
      this.pointer = { down: true, x: p.x, y: p.y, sx: p.x, sy: p.y };
      if (!this.joy.active) Object.assign(this.joy, { active: true, id: e.pointerId, bx: p.x, by: p.y, x: p.x, y: p.y, dx: 0, dy: 0 });
      this.handlers.down && this.handlers.down(p);
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.local(e);
      this.pointer.x = p.x; this.pointer.y = p.y;
      if (this.joy.active && e.pointerId === this.joy.id) {
        const R = 56;
        let dx = p.x - this.joy.bx, dy = p.y - this.joy.by;
        const d = Math.hypot(dx, dy);
        if (d > R) { // drag the base along so direction changes feel instant
          this.joy.bx = p.x - (dx / d) * R; this.joy.by = p.y - (dy / d) * R;
          dx = (dx / d) * R; dy = (dy / d) * R;
        }
        this.joy.x = p.x; this.joy.y = p.y;
        const m = Math.min(1, Math.hypot(dx, dy) / R);
        const dd = Math.hypot(dx, dy) || 1;
        this.joy.dx = (dx / dd) * (m < 0.15 ? 0 : m);
        this.joy.dy = (dy / dd) * (m < 0.15 ? 0 : m);
      }
      this.handlers.move && this.handlers.move(p);
    });
    const up = (e) => {
      const p = this.local(e);
      this.pointer.down = false;
      if (e.pointerId === this.joy.id) this.release();
      this.handlers.up && this.handlers.up(p);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  },
  release() { Object.assign(this.joy, { active: false, id: null, dx: 0, dy: 0 }); },
  local(e) { const r = this.el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; },
  axis() {
    let x = 0, y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x || y) { const d = Math.hypot(x, y); return { x: x / d, y: y / d }; }
    return { x: this.joy.dx, y: this.joy.dy };
  },
};
