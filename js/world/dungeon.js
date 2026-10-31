// DUNGEON - catacombs built from an ASCII grid.
//   #  solid rock         0-3  floor at that depth level (each level = 1.5 m lower)
//   A  great hall floor (level 1, tall ceiling)     I  hall pillar
//   P  portal back to town (level 0)                v ^ < >  stairs, descending that way
// Enemy spawns, props and lights are placed from data below, so new dungeon
// layouts are mostly a matter of new maps.
import * as THREE from '../../lib/three.module.min.js';
import { Area } from './area.js';
import { boxGeo, trs } from '../engine/geometry.js';
import { box, mesh, wallTorch, brazier, portal, chest } from './props.js';
import { generateDungeon } from './dungeonGen.js';

export const CELL = 2.5;
const LEVEL_DROP = 1.5;
const CEIL = 3.4;
const HALL_CEIL = 7.5;

export const DUNGEON_MAP = [
  '################################',
  '###########00P00################',
  '###########00000################',
  '###########00000################',
  '###########00000################',
  '#############0##################',
  '#############0##################',
  '#############v##################',
  '#############1##################',
  '#####111111111111111############',
  '#####1#######1#####1############',
  '###11111#####1###11111##########',
  '###11111#####1###11111##########',
  '###11111#####1###11111##########',
  '#####1#######1##################',
  '#####1#######1##################',
  '#####1####AAAAAAAAA#############',
  '#####1####AIAAAAAIA#############',
  '#####11111AAAAAAAAA#############',
  '##########AAAAAAAAA#############',
  '##########AIAAAAAIA#############',
  '##########AAAAAAAAA#############',
  '##########AAAAAAAAA#############',
  '##########AIAAAAAIA#############',
  '##########AAAAAAAAA#############',
  '##############v#################',
  '##############2#################',
  '##############2#################',
  '############22222###############',
  '############22222###############',
  '############22222###############',
  '################################',
];

// [col, row, type] - consumed by the enemy system (step 3)
export const DUNGEON_SPAWNS = [
  [13, 9, 'hollow'], [7, 9, 'hollow'],
  [4, 12, 'ghoul'], [6, 13, 'ghoul'], [5, 11, 'hollow'],
  [19, 12, 'hollow'], [20, 13, 'ghoul'],
  [13, 15, 'hollow'],
  [12, 19, 'hollow'], [16, 19, 'hollow'], [14, 22, 'knight'], [11, 22, 'ghoul'],
  [7, 18, 'ghoul'],
  [14, 29, 'knight'], [13, 28, 'hollow'],
];

const STAIR_DIRS = { v: [0, 1], '^': [0, -1], '>': [1, 0], '<': [-1, 0] };

const FIXED_BRAZIERS = [[11, 3], [15, 3], [12, 18], [16, 18], [12, 22], [16, 22], [12, 30], [16, 30]];

export class Dungeon extends Area {
  constructor(game, id = 'dungeon', name = 'The Sunken Catacombs') {
    super(game, id, name);
    this.hostile = true;
    this.map = DUNGEON_MAP;
    this.braziers = FIXED_BRAZIERS;
    this.spawnList = DUNGEON_SPAWNS;
    this.fixedDecor = true;
    this.returnSpawn = 'portal';
  }

  /** Parse the ASCII map (or take generated cells) into cell records. */
  parse() {
    if (this.cells) return this._finalize(this.cells, this.cells.length, this.cells[0].length);
    const rows = this.map.length, cols = Math.max(...this.map.map((r) => r.length));
    this.rows = rows; this.cols = cols;
    const g = [];
    for (let r = 0; r < rows; r++) {
      g.push([]);
      for (let c = 0; c < cols; c++) {
        const ch = this.map[r][c] || '#';
        let cell = { type: 'wall', ch };
        if (/[0-9]/.test(ch)) cell = { type: 'floor', level: +ch };
        else if (ch === 'P') cell = { type: 'floor', level: 0, portal: true };
        else if (ch === 'A') cell = { type: 'floor', level: 1, hall: true };
        else if (ch === 'I') cell = { type: 'floor', level: 1, hall: true, pillar: true };
        else if (STAIR_DIRS[ch]) cell = { type: 'stair', dir: STAIR_DIRS[ch] };
        cell.ch = ch;
        g[r].push(cell);
      }
    }
    const at = (r, c) => (g[r] && g[r][c]) || { type: 'wall' };
    // stairs inherit their level from the cell they descend from
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const s = g[r][c];
      if (s.type !== 'stair') continue;
      const hi = at(r - s.dir[1], c - s.dir[0]);
      s.level = hi.level ?? 0;
    }
    this._finalize(g, rows, cols);
  }

  _finalize(g, rows, cols) {
    this.rows = rows; this.cols = cols;
    const at = (r, c) => (g[r] && g[r][c]) || { type: 'wall' };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const s = g[r][c];
      if (s.type === 'floor') {
        s.floorY = -s.level * LEVEL_DROP;
        s.minY = s.floorY;
        s.ceilY = s.floorY + (s.hall ? HALL_CEIL : CEIL);
      } else if (s.type === 'stair') {
        s.floorY = -s.level * LEVEL_DROP;           // high end
        s.minY = s.floorY - LEVEL_DROP;              // low end
        s.ceilY = s.floorY + CEIL;
      }
    }
    this.grid = g;
    this.at = at;
  }

  cellCenter(c, r, out = new THREE.Vector3()) {
    const cell = this.at(r, c);
    return out.set((c + 0.5) * CELL, cell.floorY ?? 0, (r + 0.5) * CELL);
  }

  open(r, c) { const t = this.at(r, c).type; return t === 'floor' || t === 'stair'; }

  build() {
    this.parse();
    const A = this, g = this.grid;
    this.scene.fog = new THREE.Fog(0x040403, 1, 24);
    this.scene.background = new THREE.Color(0x030303);
    this.hemi.color.set(0x4a4640); this.hemi.groundColor.set(0x0a0806); this.hemi.intensity = 1.3;
    this.sun.intensity = 0;
    this.lanternIntensity = 5.6;
    this.dustColor = [0.32, 0.3, 0.27];

    const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const wallShade = (lo, hi) => (x, y) => {
      const t = (y - lo) / Math.max(0.1, hi - lo);
      return 0.45 + Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * 0.25 + 0.15;
    };

    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const s = g[r][c];
      const cx = (c + 0.5) * CELL, cz = (r + 0.5) * CELL;
      if (s.type === 'wall') {
        let lo = Infinity, hi = -Infinity;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const n = this.at(r + dr, c + dc);
          if (n.type === 'wall') continue;
          lo = Math.min(lo, n.minY); hi = Math.max(hi, n.ceilY);
        }
        if (lo === Infinity) continue;
        const nearHall = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dc, dr]) => this.at(r + dr, c + dc).hall);
        const y0 = lo - 0.6, y1 = hi + 0.6;
        box(A, nearHall ? 'stoneWall' : 'stoneDark', cx, (y0 + y1) / 2, cz, CELL, y1 - y0, CELL, { worldUV: 2.5, shade: wallShade(lo, hi) });
        continue;
      }
      // ---- floor (extends down to the lowest neighbour so ledges are solid)
      let low = s.minY;
      for (const [dc, dr] of N4) { const n = this.at(r + dr, c + dc); if (n.type !== 'wall') low = Math.min(low, n.minY); }
      if (s.type === 'floor') {
        const bot = low - 0.4;
        box(A, s.hall ? 'cobbleDark' : 'flagstone', cx, (bot + s.floorY) / 2, cz, CELL, s.floorY - bot, CELL, { worldUV: 2.5, shade: null });
      } else {
        // stairs: 8 steps along the descent direction
        const [dx, dz] = s.dir, steps = 8, depth = CELL / steps;
        const bot = s.minY - 0.4;
        for (let i = 0; i < steps; i++) {
          const top = s.floorY - LEVEL_DROP * (i + 0.5) / steps;
          const off = -CELL / 2 + depth * (i + 0.5);
          const sx = cx + dx * off, sz = cz + dz * off;
          const w = dx ? depth : CELL, d = dz ? depth : CELL;
          box(A, 'stone', sx, (bot + top) / 2, sz, w, top - bot, d, { worldUV: 1.25, shade: (x, y) => (y > top - 0.01 ? 0.95 : 0.55) });
        }
      }
      // ---- ceiling
      box(A, 'ceiling', cx, s.ceilY + 0.25, cz, CELL, 0.5, CELL, { worldUV: 2.5, collide: false, shade: () => 0.6 });
      // ---- lintels where neighbouring ceilings differ (right + down to avoid duplicates)
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        const n = this.at(r + dr, c + dc);
        if (n.type === 'wall' || Math.abs(n.ceilY - s.ceilY) < 0.01) continue;
        const lo = Math.min(n.ceilY, s.ceilY), hi = Math.max(n.ceilY, s.ceilY);
        const bx = cx + dc * CELL / 2, bz = cz + dr * CELL / 2;
        box(A, 'stoneDark', bx, (lo + hi) / 2 + 0.25, bz, dc ? 0.4 : CELL, hi - lo + 0.5, dc ? CELL : 0.4, { worldUV: 2.5, collide: false, shade: () => 0.55 });
      }
      if (s.pillar) {
        const h = s.ceilY - s.floorY;
        mesh(A, 'stoneWall', new THREE.CylinderGeometry(0.62, 0.7, h, 8), trs(cx, s.floorY + h / 2, cz), { worldUV: 2, shade: wallShade(s.floorY, s.ceilY) });
        box(A, 'stoneDark', cx, s.floorY + 0.3, cz, 1.7, 0.6, 1.7, { worldUV: 1.5 });
        box(A, 'stoneDark', cx, s.ceilY - 0.35, cz, 1.6, 0.5, 1.6, { worldUV: 1.5, collide: false, shade: null });
        A.collision.addCentered(cx, s.floorY + h / 2, cz, 1.35, h, 1.35);
      }
    }

    this._torches();
    this._decorate();

    // portal back to town, against the north wall of the entrance room
    let pr = 0, pc = 0;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[r][c].portal) { pr = r; pc = c; }
    portal(A, { x: (pc + 0.5) * CELL, z: pr * CELL + 0.9, y: 0, yaw: 0, target: 'town', spawn: this.returnSpawn, color: 'blue', label: 'Return to Ashen Hollow' });
    this.spawns.portal = { pos: new THREE.Vector3((pc + 0.5) * CELL, 0, (pr + 2.7) * CELL), yaw: Math.PI };
    if (this.layout && this.layout.exit) {
      // face the way out of the entrance room
      const [ec, er] = this.layout.exit, sp = this.spawns.portal.pos;
      this.spawns.portal.yaw = Math.atan2(-((ec + 0.5) * CELL - sp.x), -((er + 0.5) * CELL - sp.z));
    }
    this.spawns.start = this.spawns.portal;

    this.enemySpawns = this.spawnList.map(([c, r, type]) => ({ type, pos: this.cellCenter(c, r) }));
    this.finish();
  }

  /** Wall torches at regular intervals; a few braziers in rooms. */
  _torches() {
    const placed = [];
    const ok = (x, z, minD) => placed.every((p) => (p[0] - x) ** 2 + (p[1] - z) ** 2 > minD * minD);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const s = this.grid[r][c];
      if (s.type !== 'floor' || s.pillar) continue;
      for (const [dc, dr, yaw] of [[0, -1, 0], [1, 0, -Math.PI / 2], [0, 1, Math.PI], [-1, 0, Math.PI / 2]]) {
        if (this.at(r + dr, c + dc).type !== 'wall') continue;
        const x = (c + 0.5) * CELL + dc * CELL / 2, z = (r + 0.5) * CELL + dr * CELL / 2;
        if (!ok(x, z, s.hall ? 7.5 : 6.5)) continue;
        if (((r * 7 + c * 13 + dc * 3 + dr * 5) & 3) !== 0) continue;
        placed.push([x, z]);
        wallTorch(this, x - dc * 0.02, s.floorY + 2.1, z - dr * 0.02, yaw);
      }
    }
    // braziers
    const cc = (c, r) => [(c + 0.5) * CELL, (r + 0.5) * CELL];
    for (const [c, r] of this.braziers) {
      const [x, z] = cc(c, r);
      brazier(this, x, this.at(r, c).floorY, z);
    }
  }

  _decorate() {
    if (!this.fixedDecor) { this._decorateRandom(); return; }
    const A = this;
    let seed = 1234;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const cc = (c, r) => [(c + 0.5) * CELL, (r + 0.5) * CELL, this.at(r, c).floorY];

    // west crypt: rows of sarcophagi
    for (const [c, r] of [[3, 11], [3, 13], [7, 11], [7, 13]]) {
      const [x, z, y] = cc(c, r);
      box(A, 'stoneDark', x, y + 0.45, z, 1.1, 0.9, 2.1, { worldUV: 1 });
      const lidOff = rnd() < 0.5 ? 0.25 : 0;
      box(A, 'stone', x + lidOff, y + 0.97, z - lidOff, 1.25, 0.16, 2.25, { worldUV: 1, collide: false, rot: lidOff ? 0.12 : 0, shade: null });
    }
    // east ossuary: bone piles + skulls
    const bonePile = (x, y, z, n) => {
      for (let i = 0; i < n; i++) {
        const geo = boxGeo(0.06 + rnd() * 0.05, 0.06, 0.4 + rnd() * 0.3, 0.5);
        mesh(A, 'bone', geo, trs(x + (rnd() - 0.5) * 1.2, y + 0.04 + rnd() * 0.15, z + (rnd() - 0.5) * 1.2, [rnd() * 0.4, rnd() * 6, rnd() * 0.4]), { shade: null });
      }
      for (let i = 0; i < 2; i++) {
        const sx = x + (rnd() - 0.5) * 0.8, sz = z + (rnd() - 0.5) * 0.8;
        mesh(A, 'bone', boxGeo(0.22, 0.22, 0.26, 0.5), trs(sx, y + 0.13, sz, rnd() * 6), { shade: null });
        mesh(A, 'ironDark', boxGeo(0.16, 0.05, 0.04, 0.5), trs(sx, y + 0.17, sz, 0), { shade: () => 0.1 });
      }
    };
    for (const [c, r] of [[18, 11], [21, 12], [19, 13], [21, 11], [17, 13]]) { const [x, z, y] = cc(c, r); bonePile(x, y, z, 10); }
    for (const [c, r] of [[13, 6], [5, 15], [13, 13], [14, 28], [5, 9]]) { const [x, z, y] = cc(c, r); bonePile(x, y, z, 4); }
    // rubble
    for (const [c, r] of [[19, 9], [5, 18], [10, 24], [18, 16]]) {
      const [x, z, y] = cc(c, r);
      for (let i = 0; i < 6; i++) {
        const s = 0.2 + rnd() * 0.35;
        mesh(A, 'stoneDark', boxGeo(s, s * 0.7, s, 0.6), trs(x + (rnd() - 0.5) * 1.6, y + s * 0.3, z + (rnd() - 0.5) * 1.6, [rnd(), rnd() * 6, rnd()]));
      }
    }
    // hall: hanging chains + a cracked central dais
    for (const [c, r] of [[12, 17], [16, 17], [14, 20], [12, 23], [16, 23]]) {
      const [x, z, y] = cc(c, r);
      const len = 2.2 + rnd() * 2;
      box(A, 'ironDark', x, y + HALL_CEIL - len / 2, z, 0.06, len, 0.06, { collide: false, shade: null });
      box(A, 'ironDark', x, y + HALL_CEIL - len, z, 0.25, 0.25, 0.08, { collide: false, shade: null, rot: 0.6 });
    }
    { const [x, z, y] = cc(14, 20); box(A, 'flagstone', x, y + 0.12, z, 3.2, 0.24, 3.2, { worldUV: 2, shade: null }); }
    // deepest chamber: altar
    {
      const [x, z, y] = cc(14, 30);
      box(A, 'stoneDark', x, y + 0.5, z + 0.6, 2.6, 1.0, 1.2, { worldUV: 1 });
      box(A, 'stone', x, y + 1.05, z + 0.6, 2.9, 0.12, 1.4, { worldUV: 1, collide: false, shade: null });
      mesh(A, 'bone', boxGeo(0.25, 0.25, 0.3, 0.5), trs(x - 0.6, y + 1.24, z + 0.6, 0.3), { shade: null });
    }
    // a chest beside the altar, for whoever survives the knight
    { const [x, z, y] = cc(12, 30); chest(A, x, y, z, Math.PI / 2, () => this.game.loot.roll('chest', new THREE.Vector3(x + 1, y, z), 3)); }
    // entrance room: old banners (rotten cloth)
    for (const c of [11, 15]) {
      const [x, , y] = cc(c, 1);
      box(A, 'clothRed', x, y + 2.3, 1 * CELL + 0.05, 1.0, 1.9, 0.04, { collide: false, shade: () => 0.7 });
    }
  }

  /** Decoration for generated layouts: bones, rubble, sarcophagi, a chest. */
  _decorateRandom() {
    const A = this;
    let seed = this.layout.seed || 77;
    const rnd = () => { seed = (seed * 16807 + 11) % 2147483647; return seed / 2147483647; };
    const cc = (c, r) => [(c + 0.5) * CELL, (r + 0.5) * CELL, this.at(r, c).floorY];
    for (const [c, r, kind] of this.layout.decor) {
      const [x, z, y] = cc(c, r);
      if (kind === 'sarcophagus') {
        const rot = rnd() < 0.5 ? 0 : Math.PI / 2;
        box(A, 'stoneDark', x, y + 0.45, z, 1.1, 0.9, 2.1, { worldUV: 1, rot });
        box(A, 'stone', x, y + 0.97, z, 1.25, 0.16, 2.25, { worldUV: 1, collide: false, rot: rot + (rnd() - 0.5) * 0.3, shade: null });
      } else if (kind === 'rubble') {
        for (let i = 0; i < 6; i++) {
          const s = 0.2 + rnd() * 0.35;
          mesh(A, 'stoneDark', boxGeo(s, s * 0.7, s, 0.6), trs(x + (rnd() - 0.5) * 1.6, y + s * 0.3, z + (rnd() - 0.5) * 1.6, [rnd(), rnd() * 6, rnd()]));
        }
      } else {
        for (let i = 0; i < 8; i++) {
          const geo = boxGeo(0.06 + rnd() * 0.05, 0.06, 0.4 + rnd() * 0.3, 0.5);
          mesh(A, 'bone', geo, trs(x + (rnd() - 0.5) * 1.2, y + 0.04 + rnd() * 0.15, z + (rnd() - 0.5) * 1.2, [rnd() * 0.4, rnd() * 6, rnd() * 0.4]), { shade: null });
        }
        mesh(A, 'bone', boxGeo(0.22, 0.22, 0.26, 0.5), trs(x + (rnd() - 0.5) * 0.6, y + 0.13, z + (rnd() - 0.5) * 0.6, rnd() * 6), { shade: null });
      }
    }
    if (this.layout.chest) {
      const [c, r] = this.layout.chest;
      const [x, z, y] = cc(c, r);
      chest(A, x, y, z - CELL / 2 + 0.7, 0, () => this.game.loot.roll('chest', new THREE.Vector3(x, y, z), 3));
    }
  }

  /**
   * Flow-field pathing over the grid (BFS from the player's cell). Enemies
   * call stepToward() to get the next waypoint toward the player.
   */
  updateFlow(playerPos) {
    const c = Math.floor(playerPos.x / CELL), r = Math.floor(playerPos.z / CELL);
    if (c === this._flowC && r === this._flowR) return;
    this._flowC = c; this._flowR = r;
    const dist = this.flow || (this.flow = new Int16Array(this.rows * this.cols));
    dist.fill(-1);
    if (!this.open(r, c)) return;
    const q = [r * this.cols + c];
    dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], rr = Math.floor(i / this.cols), cc = i % this.cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = rr + dr, nc = cc + dc;
        if (!this.open(nr, nc)) continue;
        const ni = nr * this.cols + nc;
        if (dist[ni] !== -1) continue;
        // stairs only connect along their direction
        const a = this.grid[rr][cc], b = this.grid[nr][nc];
        if (a.type === 'stair' && (a.dir[0] === 0) !== (dc === 0)) continue;
        if (b.type === 'stair' && (b.dir[0] === 0) !== (dc === 0)) continue;
        dist[ni] = dist[i] + 1;
        q.push(ni);
      }
    }
  }

  /** Next waypoint (world XZ) from `pos` toward the player, or null. */
  stepToward(pos, out) {
    if (!this.flow) return null;
    const c = Math.floor(pos.x / CELL), r = Math.floor(pos.z / CELL);
    if (!this.open(r, c)) return null;
    const here = this.flow[r * this.cols + c];
    if (here <= 0) return null;
    let best = null, bd = here;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (!this.open(nr, nc)) continue;
      const d = this.flow[nr * this.cols + nc];
      if (d >= 0 && d < bd) { bd = d; best = [nc, nr]; }
    }
    if (!best) return null;
    return out.set((best[0] + 0.5) * CELL, 0, (best[1] + 0.5) * CELL);
  }

  dispose() {
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }

  onEnter() {
    this._flowC = null;
    if (this.game.spawnEnemies) this.game.spawnEnemies(this);
  }

  onExit() {
    if (this.game.clearEnemies) this.game.clearEnemies(this);
  }

  update(dt, player) {
    this.updateFlow(player.pos);
    super.update(dt, player);
  }
}

/** A freshly generated layout every visit. */
export class RandomDungeon extends Dungeon {
  constructor(game) {
    super(game, 'depths', 'The Shifting Depths');
    this.transient = true;
    this.returnSpawn = 'portal_depths';
    this.layout = generateDungeon((Math.random() * 1e9) | 0);
    this.cells = this.layout.cells;
    this.braziers = this.layout.braziers;
    this.spawnList = this.layout.spawns;
    this.fixedDecor = false;
  }
}
