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
    this.buildClearance();
  }

  /**
   * Clearance field: for every walkable cell, the free radius (m) around its
   * centre before the nearest blocked cell or a ledge. Enemies only path
   * through cells whose clearance covers their own radius (size classes).
   */
  buildClearance() {
    const W = this.W, H = this.H, h = this.h, c = this.cell, CAP = 3.2;
    // 1) exact distance to the nearest wall box (relative to each cell's floor)
    const wall = new Float32Array(W * H);
    const q = [];
    for (let k = 0; k < W * H; k++) {
      const T = h[k];
      if (Number.isNaN(T)) continue;
      const x = this.x0 + (k % W + 0.5) * c, z = this.z0 + (((k / W) | 0) + 0.5) * c;
      const list = this.col.query(x - CAP, z - CAP, x + CAP, z + CAP, q);
      let best = CAP;
      for (const b of list) {
        if (b.disabled || b.tag === 'npc' || b.tag === 'guard') continue;
        if (!(b.maxY > T + HEAD_MIN && b.minY < T + HEAD_MAX)) continue;
        const dx = Math.max(b.minX - x, 0, x - b.maxX), dz = Math.max(b.minZ - z, 0, z - b.maxZ);
        const d = Math.hypot(dx, dz);
        if (d >= best) continue;
        // a box whose top is itself walkable floor (stair steps, ramps) is ground, not a wall;
        // big rises next to us are caught as ledges below
        const px = Math.max(b.minX, Math.min(x, b.maxX)), pz = Math.max(b.minZ, Math.min(z, b.maxZ));
        const kk = this.idx(px + Math.sign(px - x) * 0.05, pz + Math.sign(pz - z) * 0.05);
        if (kk >= 0 && !Number.isNaN(h[kk]) && Math.abs(h[kk] - b.maxY) < 0.06) continue;
        best = d;
      }
      wall[k] = best;
    }
    // 2) distance to ledges / pits (cells with no floor that aren't walls, or big height steps)
    const INF = 1e9, d = new Float32Array(W * H);
    for (let k = 0; k < W * H; k++) {
      d[k] = INF;                       // only ledge-adjacent cells seed the field (walls are exact above)
      if (Number.isNaN(h[k])) continue;
      const i = k % W, j = (k / W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) { d[k] = 1; break; }
        const nk = nj * W + ni;
        if (Number.isNaN(h[nk])) {
          // a neighbour blocked by a wall is handled exactly above; a hole (no wall there) is a ledge
          const x = this.x0 + (ni + 0.5) * c, z = this.z0 + (nj + 0.5) * c, T = h[k], r = this.inflate + 0.05;
          const walled = this.wallAt(x, z, T) || this.wallAt(x + r, z, T) || this.wallAt(x - r, z, T) || this.wallAt(x, z + r, T) || this.wallAt(x, z - r, T);
          if (!walled) { d[k] = 1; break; }
        } else if (Math.abs(h[nk] - h[k]) > MAX_STEP) { d[k] = 1; break; }
      }
    }
    const D1 = 1, D2 = 1.414;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; let v = d[k]; if (v <= 1) continue;
      if (i > 0) v = Math.min(v, d[k - 1] + D1);
      if (j > 0) { v = Math.min(v, d[k - W] + D1); if (i > 0) v = Math.min(v, d[k - W - 1] + D2); if (i < W - 1) v = Math.min(v, d[k - W + 1] + D2); }
      d[k] = v;
    }
    for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
      const k = j * W + i; let v = d[k]; if (v <= 1) continue;
      if (i < W - 1) v = Math.min(v, d[k + 1] + D1);
      if (j < H - 1) { v = Math.min(v, d[k + W] + D1); if (i < W - 1) v = Math.min(v, d[k + W + 1] + D2); if (i > 0) v = Math.min(v, d[k + W - 1] + D2); }
      d[k] = v;
    }
    this.clr = new Float32Array(W * H);
    for (let k = 0; k < W * H; k++) {
      if (Number.isNaN(h[k])) continue;
      const ledge = d[k] >= INF ? 99 : (d[k] - 0.5) * c;
      this.clr[k] = Math.min(wall[k] >= CAP ? 99 : wall[k], ledge);
    }
  }

  /** Free radius at a cell (m). */
  clearance(k) { return k >= 0 ? this.clr[k] : 0; }
  fits(k, r) { return this.walkable(k) && this.clr[k] >= r; }
  /** Size class of a radius: 0 S, 1 M, 2 L, 3 XL. */
  static sizeClass(r) { return r <= 0.45 ? 0 : r <= 0.8 ? 1 : r <= 1.2 ? 2 : 3; }
  /** Clearance needed by a size class (slightly forgiving so M fits doorways). */
  static need(r) { return r <= 0.45 ? 0 : r * 0.92; }

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
  snap(x, z, y, need = 0) {
    const k0 = this.idx(x, z);
    if (this.walkable(k0) && Math.abs(this.h[k0] - y) < 1.2 && this.clr[k0] >= need) return k0;
    const i0 = Math.floor((x - this.x0) / this.cell), j0 = Math.floor((z - this.z0) / this.cell);
    let best = -1, bd = Infinity;
    for (let d = 1; d <= 3; d++) for (let j = j0 - d; j <= j0 + d; j++) for (let i = i0 - d; i <= i0 + d; i++) {
      if (i < 0 || j < 0 || i >= this.W || j >= this.H) continue;
      const k = j * this.W + i;
      if (!this.walkable(k) || Math.abs(this.h[k] - y) > 1.2 || this.clr[k] < need) continue;
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
  lineClear(a, b, need = 0) {
    const A = this.center(a), B = this.center(b);
    const n = Math.ceil(Math.hypot(B.x - A.x, B.z - A.z) / (this.cell * 0.5));
    let prev = a;
    for (let s = 1; s <= n; s++) {
      const t = s / n, k = this.idx(A.x + (B.x - A.x) * t, A.z + (B.z - A.z) * t);
      if (!this.walkable(k) || Math.abs(this.h[k] - this.h[prev]) > MAX_STEP || this.clr[k] < need) return false;
      prev = k;
    }
    return true;
  }

  /** A* from (sx,sz) to (tx,tz). Returns smoothed world waypoints or null. */
  findPath(sx, sz, sy, tx, tz, ty, maxNodes = 20000, need = 0, drop = 0, jump = 0) {
    const s = this.snap(sx, sz, sy, need), g = this.snap(tx, tz, ty, need);
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
        if (Number.isNaN(h[nk]) || this.clr[nk] < need) continue;
        const dh = h[nk] - h[k];
        if (dh > MAX_STEP + jump || -dh > MAX_STEP + drop) continue;   // agile enemies drop from / jump onto ledges
        if (di && dj && (Number.isNaN(h[j * W + ni]) || Number.isNaN(h[nj * W + i]))) continue; // no corner cutting
        const ng = gs[k] + c + Math.abs(dh) * (Math.abs(dh) > MAX_STEP ? 3 : 0.5);
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
      while (b > a + 1 && !this.lineClear(cells[a], cells[b], need)) b--;
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
