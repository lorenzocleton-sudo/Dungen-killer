// Navigation grid + A* for enemies, built from the area's collision boxes.
// Each cell stores the walkable floor height (highest surface with headroom
// above it). Cells are blocked if a wall is within ~enemy radius. Neighbour
// moves are allowed when the height step is small (stairs, gentle slopes).
// MAX_STEP is per nav cell: a 1.5 m staircase over 2.5 m rises ~0.5-0.6 per 0.8 m cell
const HEAD_MIN = 0.45, HEAD_MAX = 1.6, MAX_STEP = 0.8, MAX_FLOOR_THICK = 2.6;

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

export class NavGrid {
  constructor(collision, bounds, cell = 0.8, inflate = 0.32) {
    this.col = collision;
    this.cell = cell;
    this.x0 = bounds.x0; this.z0 = bounds.z0;
    this.W = Math.ceil((bounds.x1 - bounds.x0) / cell);
    this.H = Math.ceil((bounds.z1 - bounds.z0) / cell);
    this.h = new Float32Array(this.W * this.H).fill(NaN);
    this.inflate = inflate;
    this._q = [];
    this.build();
  }

  /** Floor height at a point (highest top with headroom), or NaN. */
  floorAt(x, z, below = Infinity) {
    const list = this.col.query(x, z, x, z, this._q);
    let best = NaN;
    for (const b of list) {
      if (b.disabled || b.tag === 'npc' || b.tag === 'guard') continue;
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      const T = b.maxY;
      if (T > below || (T <= best)) continue;
      if (b.maxY - b.minY > MAX_FLOOR_THICK && b.tag !== 'ground') continue; // wall tops are not floor
      let free = true;
      for (const c of list) {
        if (c === b || c.disabled || c.tag === 'npc' || c.tag === 'guard') continue;
        if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
        if (c.maxY > T + HEAD_MIN && c.minY < T + HEAD_MAX) { free = false; break; }
      }
      if (free) best = T;
    }
    return best;
  }

  /** Is there a wall (relative to floor T) at this point? */
  wallAt(x, z, T) {
    const list = this.col.query(x, z, x, z, this._q);
    for (const c of list) {
      if (c.disabled || c.tag === 'npc' || c.tag === 'guard') continue;
      if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
      if (c.maxY > T + HEAD_MIN && c.minY < T + HEAD_MAX) return true;
    }
    return false;
  }

  build() {
    const r = this.inflate;
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
      const x = this.x0 + (i + 0.5) * this.cell, z = this.z0 + (j + 0.5) * this.cell;
      const T = this.floorAt(x, z);
      if (Number.isNaN(T)) continue;
      if (this.wallAt(x + r, z, T) || this.wallAt(x - r, z, T) || this.wallAt(x, z + r, T) || this.wallAt(x, z - r, T)) continue;
      this.h[j * this.W + i] = T;
    }
  }

  idx(x, z) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.W || j >= this.H) return -1;
    return j * this.W + i;
  }

  walkable(k) { return k >= 0 && !Number.isNaN(this.h[k]); }

  /** Nearest walkable cell to a point (searching a few cells out), height-aware. */
  snap(x, z, y) {
    const k0 = this.idx(x, z);
    if (this.walkable(k0) && Math.abs(this.h[k0] - y) < 1.2) return k0;
    const i0 = Math.floor((x - this.x0) / this.cell), j0 = Math.floor((z - this.z0) / this.cell);
    let best = -1, bd = Infinity;
    for (let d = 1; d <= 3; d++) for (let j = j0 - d; j <= j0 + d; j++) for (let i = i0 - d; i <= i0 + d; i++) {
      if (i < 0 || j < 0 || i >= this.W || j >= this.H) continue;
      const k = j * this.W + i;
      if (!this.walkable(k) || Math.abs(this.h[k] - y) > 1.2) continue;
      const dd = (i - i0) ** 2 + (j - j0) ** 2;
      if (dd < bd) { bd = dd; best = k; }
    }
    return best;
  }

  center(k) {
    const i = k % this.W, j = (k / this.W) | 0;
    return { x: this.x0 + (i + 0.5) * this.cell, z: this.z0 + (j + 0.5) * this.cell, y: this.h[k] };
  }

  /** Straight walk between two cells stays on walkable, gentle ground. */
  lineClear(a, b) {
    const A = this.center(a), B = this.center(b);
    const n = Math.ceil(Math.hypot(B.x - A.x, B.z - A.z) / (this.cell * 0.5));
    let prev = a;
    for (let s = 1; s <= n; s++) {
      const t = s / n, k = this.idx(A.x + (B.x - A.x) * t, A.z + (B.z - A.z) * t);
      if (!this.walkable(k) || Math.abs(this.h[k] - this.h[prev]) > MAX_STEP) return false;
      prev = k;
    }
    return true;
  }

  /** A* from (sx,sz) to (tx,tz). Returns smoothed world waypoints or null. */
  findPath(sx, sz, sy, tx, tz, ty, maxNodes = 20000) {
    const s = this.snap(sx, sz, sy), g = this.snap(tx, tz, ty);
    if (s < 0 || g < 0) return null;
    if (s === g) return [this.center(g)];
    const W = this.W, h = this.h;
    const gs = this._gs || (this._gs = new Float32Array(W * this.H));
    const from = this._from || (this._from = new Int32Array(W * this.H));
    const seen = this._seen || (this._seen = new Uint32Array(W * this.H));
    const closed = this._closed || (this._closed = new Uint32Array(W * this.H));
    this._stamp = (this._stamp || 0) + 1;
    const stamp = this._stamp;
    const gi = g % W, gj = (g / W) | 0;
    const heur = (k) => { const dx = Math.abs(k % W - gi), dz = Math.abs(((k / W) | 0) - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const open = new MinHeap();
    gs[s] = 0; from[s] = -1; seen[s] = stamp;
    open.push(heur(s), s);
    let found = false, n = 0;
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (open.size && n++ < maxNodes) {
      const k = open.pop();
      if (closed[k] === stamp) { n--; continue; }   // stale heap entry
      closed[k] = stamp;
      if (k === g) { found = true; break; }
      const i = k % W, j = (k / W) | 0;
      for (const [di, dj, c] of D) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= this.H) continue;
        const nk = nj * W + ni;
        if (Number.isNaN(h[nk]) || Math.abs(h[nk] - h[k]) > MAX_STEP) continue;
        if (di && dj && (Number.isNaN(h[j * W + ni]) || Number.isNaN(h[nj * W + i]))) continue; // no corner cutting
        const ng = gs[k] + c + Math.abs(h[nk] - h[k]) * 0.5;
        if (seen[nk] === stamp && ng >= gs[nk]) continue;
        seen[nk] = stamp; gs[nk] = ng; from[nk] = k;
        open.push(ng + heur(nk), nk);
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = g; k !== -1; k = from[k]) cells.push(k);
    cells.reverse();
    // string-pulling: keep only the turning points
    const out = [];
    let a = 0;
    while (a < cells.length - 1) {
      let b = cells.length - 1;
      while (b > a + 1 && !this.lineClear(cells[a], cells[b])) b--;
      out.push(this.center(cells[b]));
      a = b;
    }
    return out;
  }
}

/** Bounds of an area's collision (ignoring giant ground slabs). */
export function collisionBounds(col, pad = 2) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const b of col.boxes) {
    if (b.maxX - b.minX > 120 || b.maxZ - b.minZ > 120) continue;
    x0 = Math.min(x0, b.minX); z0 = Math.min(z0, b.minZ); x1 = Math.max(x1, b.maxX); z1 = Math.max(z1, b.maxZ);
  }
  return { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad };
}
