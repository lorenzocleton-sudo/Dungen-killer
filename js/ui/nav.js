// Spatial focus navigation for gamepad / arrow keys inside an overlay.
// Moves to the nearest .focusable element in the pressed direction.
export class SpatialNav {
  constructor(root) { this.root = root; this.current = null; }

  items() {
    return [...this.root.querySelectorAll('.focusable')].filter((e) => e.offsetParent !== null && !e.disabled);
  }

  focus(el, scroll = true) {
    if (this.current) this.current.classList.remove('focused');
    this.current = el;
    if (el) {
      el.classList.add('focused');
      if (scroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  ensure() {
    const list = this.items();
    if (!this.current || !list.includes(this.current)) this.focus(list[0] || null, false);
  }

  clear() { if (this.current) this.current.classList.remove('focused'); this.current = null; }

  move(dx, dy) {
    const list = this.items();
    if (!list.length) return;
    if (!this.current || !list.includes(this.current)) { this.focus(list[0]); return; }
    const r0 = this.current.getBoundingClientRect();
    const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bs = Infinity;
    for (const el of list) {
      if (el === this.current) continue;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2 - cx, ey = r.top + r.height / 2 - cy;
      const along = ex * dx + ey * dy;
      if (along <= 4) continue;
      const across = Math.abs(ex * dy - ey * dx);
      const score = along + across * 2.2;
      if (score < bs) { bs = score; best = el; }
    }
    if (best) this.focus(best);
  }

  /** Handle nav_* actions. Returns true if something was activated. */
  handle(input) {
    if (input.consume('nav_up')) this.move(0, -1);
    if (input.consume('nav_down')) this.move(0, 1);
    if (input.consume('nav_left')) this.move(-1, 0);
    if (input.consume('nav_right')) this.move(1, 0);
    if (input.consume('nav_ok') && this.current) { this.current.click(); return true; }
    return false;
  }
}
