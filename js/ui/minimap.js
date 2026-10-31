// Corner minimap + full-screen map with fog of war.
//  * grid areas (dungeons, castle): rooms reveal when you step into them,
//    corridors reveal around you
//  * open areas (town): reveal in a radius around you
// Shows the player arrow, portals/gates, chests, stairs and the boss room.

const COLORS = {
  floor: '#5e5444', hall: '#6a5e4a', stair: '#a08c68', blocked: '#1e1a16', open: '#4a4436',
  bg: 'rgba(8,6,5,0.85)', fog: '#0a0807',
};
const MARK = { portal: '#60b0ff', gate: '#c080ff', chest: '#f0c040', boss: '#ff3020', door: '#d0a060' };

export class Minimap {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('minimap');
    this.ctx = this.el.getContext('2d');
    this.big = document.getElementById('bigmap');
    this.bigCanvas = this.big.querySelector('canvas');
    this.bctx = this.bigCanvas.getContext('2d');
    this.open = false;
    this.t = 0;
    const toggle = (e) => { e.preventDefault(); e.stopPropagation(); this.game.toggleMap(); };
    this.el.addEventListener('click', toggle);
    this.el.addEventListener('touchstart', toggle, { passive: false });
    this.big.addEventListener('click', toggle);
    this.big.addEventListener('touchstart', toggle, { passive: false });
  }

  /** Build the map image for a freshly entered area. */
  setArea(area) {
    this.area = area;
    const base = document.createElement('canvas');
    if (area.grid) {
      this.mode = 'grid';
      this.cell = area.cellSize || 2.5;
      this.W = area.cols; this.H = area.rows;
      this.ox = 0; this.oz = 0;
      base.width = this.W; base.height = this.H;
      const c = base.getContext('2d');
      for (let r = 0; r < this.H; r++) for (let q = 0; q < this.W; q++) {
        const s = area.grid[r][q];
        if (s.type === 'wall') continue;
        c.fillStyle = s.type === 'stair' ? COLORS.stair : s.hall ? COLORS.hall : COLORS.floor;
        c.fillRect(q, r, 1, 1);
      }
      this.rooms = area.layout && area.layout.roomRects ? area.layout.roomRects : [];
    } else {
      // raster the collision world at 1 m: tall boxes are walls/buildings
      this.mode = 'raster';
      const b = area.mapBounds || { x0: -40, z0: -40, x1: 40, z1: 40 };
      this.cell = 1; this.ox = b.x0; this.oz = b.z0;
      this.W = Math.ceil(b.x1 - b.x0); this.H = Math.ceil(b.z1 - b.z0);
      base.width = this.W; base.height = this.H;
      const c = base.getContext('2d');
      c.fillStyle = COLORS.open; c.fillRect(0, 0, this.W, this.H);
      c.fillStyle = COLORS.blocked;
      for (const bx of area.collision.boxes) {
        if (bx.maxY < 1.2 || bx.tag === 'npc' || bx.maxX - bx.minX > 100) continue;
        c.fillRect(bx.minX - this.ox, bx.minZ - this.oz, Math.max(1, bx.maxX - bx.minX), Math.max(1, bx.maxZ - bx.minZ));
      }
      this.rooms = [];
    }
    this.base = base;
    this.fog = document.createElement('canvas');
    this.fog.width = this.W; this.fog.height = this.H;
    const f = this.fog.getContext('2d');
    f.fillStyle = COLORS.fog; f.fillRect(0, 0, this.W, this.H);
    this.revealed = new Uint8Array(this.W * this.H);
    this.revealedRooms = new Set();
    this.t = 1;
  }

  revealRect(x, y, w, h) {
    const f = this.fog.getContext('2d');
    x = Math.max(0, x); y = Math.max(0, y);
    w = Math.min(this.W - x, w); h = Math.min(this.H - y, h);
    if (w <= 0 || h <= 0) return;
    f.clearRect(x, y, w, h);
    for (let r = y; r < y + h; r++) this.revealed.fill(1, r * this.W + x, r * this.W + x + w);
  }

  revealAll() { if (this.fog) this.revealRect(0, 0, this.W, this.H); }

  isRevealed(wx, wz) {
    const q = Math.floor((wx - this.ox) / this.cell), r = Math.floor((wz - this.oz) / this.cell);
    return q >= 0 && r >= 0 && q < this.W && r < this.H && this.revealed[r * this.W + q];
  }

  update(dt) {
    const g = this.game;
    const show = g.settings.minimap !== false && !!this.area;
    this.el.style.display = show ? 'block' : 'none';
    if (!this.area || this.area !== g.area) this.setArea(g.area);
    const p = g.player.pos;
    const q = Math.floor((p.x - this.ox) / this.cell), r = Math.floor((p.z - this.oz) / this.cell);
    if (this.mode === 'grid') {
      const s = this.area.grid[r] && this.area.grid[r][q];
      if (s && s.roomId !== undefined && !this.revealedRooms.has(s.roomId) && this.rooms[s.roomId]) {
        const o = this.rooms[s.roomId];
        this.revealedRooms.add(s.roomId);
        this.revealRect(o.x - 1, o.y - 1, o.w + 2, o.h + 2);
      }
      this.revealRect(q - 2, r - 2, 5, 5);
    } else {
      const R = 16;
      if (!this._lastRev || Math.hypot(p.x - this._lastRev[0], p.z - this._lastRev[1]) > 2) {
        this._lastRev = [p.x, p.z];
        const f = this.fog.getContext('2d');
        f.save(); f.globalCompositeOperation = 'destination-out';
        f.beginPath(); f.arc(q, r, R, 0, Math.PI * 2); f.fill(); f.restore();
        for (let y = Math.max(0, r - R); y < Math.min(this.H, r + R); y++) for (let x = Math.max(0, q - R); x < Math.min(this.W, q + R); x++) if ((x - q) ** 2 + (y - r) ** 2 < R * R) this.revealed[y * this.W + x] = 1;
      }
    }
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.12;
      if (show) this.draw(this.ctx, this.el.width, this.el.height, false);
      if (this.open) this.draw(this.bctx, this.bigCanvas.width, this.bigCanvas.height, true);
    }
  }

  markers() {
    const a = this.area, out = [];
    for (const p of a.portals) out.push({ x: p.pos.x, z: p.pos.z, type: p.locked !== undefined ? 'gate' : 'portal' });
    for (const m of a.mapMarkers || []) out.push(m);
    return out;
  }

  draw(ctx, w, h, full) {
    const g = this.game, p = g.player.pos;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, w, h);
    // pixels per map cell
    let s, cx, cy;
    if (full) {
      s = Math.max(1, Math.floor(Math.min(w / this.W, h / this.H)));
      cx = (w - this.W * s) / 2; cy = (h - this.H * s) / 2;
    } else {
      s = this.mode === 'grid' ? 6 : 2;
      cx = w / 2 - ((p.x - this.ox) / this.cell) * s; cy = h / 2 - ((p.z - this.oz) / this.cell) * s;
    }
    ctx.drawImage(this.base, cx, cy, this.W * s, this.H * s);
    ctx.drawImage(this.fog, cx, cy, this.W * s, this.H * s);
    const toPx = (wx, wz) => [cx + ((wx - this.ox) / this.cell) * s, cy + ((wz - this.oz) / this.cell) * s];
    for (const m of this.markers()) {
      if (!this.isRevealed(m.x, m.z)) continue;
      const [mx, my] = toPx(m.x, m.z);
      ctx.fillStyle = MARK[m.type] || '#fff';
      const r = full ? 5 : 3;
      if (m.type === 'boss') { ctx.font = `bold ${full ? 16 : 11}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('☠', mx, my); }
      else if (m.type === 'gate' || m.type === 'chest') ctx.fillRect(mx - r, my - r, r * 2, r * 2);
      else { ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill(); }
    }
    // player arrow
    const [px, py] = toPx(p.x, p.z);
    const f = g.player.forward, ang = Math.atan2(f.z, f.x);
    const L = full ? 9 : 6;
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
    ctx.fillStyle = '#f0e0b0'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(-L * 0.6, L * 0.6); ctx.lineTo(-L * 0.3, 0); ctx.lineTo(-L * 0.6, -L * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (!full) { ctx.strokeStyle = '#4a3e30'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2); }
    else { ctx.fillStyle = '#c8b890'; ctx.font = '16px Georgia, serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(this.area.name, 12, 10); }
  }

  showBig(on) {
    this.open = on;
    this.big.classList.toggle('hidden', !on);
    if (on) {
      this.bigCanvas.width = Math.floor(window.innerWidth * 0.9); this.bigCanvas.height = Math.floor(window.innerHeight * 0.85);
      this.draw(this.bctx, this.bigCanvas.width, this.bigCanvas.height, true);
    }
  }
}
