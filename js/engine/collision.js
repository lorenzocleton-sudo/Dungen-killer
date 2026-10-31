// Axis-aligned box collision world.
// Every solid thing is a box. A box whose top is within STEP of your feet is
// "ground" (floors, stair steps); anything taller is a wall. Actors are
// vertical cylinders (circle in XZ + feet/height).
const CELL = 4;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.grid = new Map();
  }

  _key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }

  add(minX, minY, minZ, maxX, maxY, maxZ, tag = 'solid') {
    const b = { minX, minY, minZ, maxX, maxY, maxZ, tag, id: this.boxes.length };
    this.boxes.push(b);
    for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++)
      for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz++) {
        const k = this._key(ix, iz);
        let l = this.grid.get(k);
        if (!l) { l = []; this.grid.set(k, l); }
        l.push(b);
      }
    return b;
  }

  /** Add box from center + size. */
  addCentered(x, y, z, w, h, d, tag) {
    return this.add(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2, tag);
  }

  /** Boxes near an XZ region (deduplicated). */
  query(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++)
      for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz++) {
        const l = this.grid.get(this._key(ix, iz));
        if (!l) continue;
        for (const b of l) if (!seen.has(b.id)) { seen.add(b.id); out.push(b); }
      }
    return out;
  }

  /** Highest walkable surface under a circle that can be stepped onto. */
  groundHeight(x, z, r, feetY, step) {
    let best = -Infinity;
    const list = this.query(x - r, z - r, x + r, z + r, this._q1 || (this._q1 = []));
    for (const b of list) {
      if (b.disabled || b.maxY > feetY + step) continue;
      if (x + r < b.minX || x - r > b.maxX || z + r < b.minZ || z - r > b.maxZ) continue;
      if (b.maxY > best) best = b.maxY;
    }
    return best;
  }

  /**
   * Push a circle out of all walls. Mutates pos {x,z}. Returns true if hit.
   */
  resolve(pos, r, feetY, height, step) {
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      const list = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, this._q2 || (this._q2 = []));
      for (const b of list) {
        if (b.disabled || b.maxY <= feetY + step || b.minY >= feetY + height) continue;
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), push = r - d;
          pos.x += (dx / d) * push; pos.z += (dz / d) * push;
        } else {
          // centre inside the box: leave by the shallowest side
          const pl = pos.x - b.minX, pr = b.maxX - pos.x, pb = pos.z - b.minZ, pf = b.maxZ - pos.z;
          const m = Math.min(pl, pr, pb, pf);
          if (m === pl) pos.x = b.minX - r; else if (m === pr) pos.x = b.maxX + r;
          else if (m === pb) pos.z = b.minZ - r; else pos.z = b.maxZ + r;
        }
        moved = hit = true;
      }
      if (!moved) break;
    }
    return hit;
  }

  /** Coarse line-of-sight test between two points (eye heights). */
  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const steps = Math.ceil(len / 0.5);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
      const list = this.query(x, z, x, z, this._q3 || (this._q3 = []));
      for (const b of list) {
        if (!b.disabled && b.tag !== 'npc' && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && y > b.minY && y < b.maxY) return false;
      }
    }
    return true;
  }
}
