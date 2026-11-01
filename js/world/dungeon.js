// DUNGEON - catacombs built from an ASCII grid.
//   #  solid rock         0-3  floor at that depth level (each level = 1.5 m lower)
//   A  great hall floor (level 1, tall ceiling)     I  hall pillar
//   P  portal back to town (level 0)                v ^ < >  stairs, descending that way
// Enemy spawns, props and lights are placed from data below, so new dungeon
// layouts are mostly a matter of new maps.
import * as THREE from '../../lib/three.module.min.js';
import { Area } from './area.js';
import { boxGeo, trs } from '../engine/geometry.js';
import { litMaterial } from '../engine/materials.js';
import { box, mesh, wallTorch, brazier, portal, chest, interactable } from './props.js';
import { generateDungeon } from './dungeonGen.js';
import { BIOMES, BIOME_IDS, mainLevelEnemies, bandFor } from './biomes.js';
import { BOSS_BY_LEVEL, STORY_LEVELS } from '../entities/enemyTypes.js';
import { gate, remains, spikeTrap, healingShrine } from './props.js';
import { AFFIX_IDS, levelDmgMul } from '../entities/enemy.js';
import { ascensionMul } from '../systems/progression.js';
import { MAPS } from '../systems/shops.js';

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
    this.biome = BIOMES.crypt;
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
        const base = -s.level * LEVEL_DROP;
        s.floorY = base + (s.raise || 0);
        s.minY = s.floorY;
        s.ceilY = s.secret ? s.floorY + 2.3 : base + (s.hall ? HALL_CEIL : CEIL);
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
    this.cellSize = CELL;
    const A = this, g = this.grid;
    const B = this.biome;
    this.scene.fog = new THREE.Fog(B.fog, 1, B.fogFar);
    this.scene.background = new THREE.Color(B.fog);
    this.hemi.color.set(B.hemi[0]); this.hemi.groundColor.set(B.hemi[1]); this.hemi.intensity = B.hemi[2];
    this.sun.intensity = 0;
    this.lanternIntensity = B.lantern;
    this.dustColor = B.dust;
    const waterMat = B.water ? litMaterial('water', { transparent: true, color: 0x8aa080 }) : null;
    if (waterMat) { waterMat.opacity = 0.75; }

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
          lo = Math.min(lo, n.minY); hi = Math.max(hi, n.ceilY + (n.sky ? 3.5 : 0));
        }
        if (lo === Infinity) continue;
        const nearHall = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dc, dr]) => this.at(r + dr, c + dc).hall);
        const y0 = lo - 0.6, y1 = hi + (B.open ? 4 : 0.6);
        box(A, nearHall ? B.hallWall : B.wall, cx, (y0 + y1) / 2, cz, CELL, y1 - y0, CELL, { worldUV: 2.5, shade: wallShade(lo, hi) });
        continue;
      }
      // ---- floor (extends down to the lowest neighbour so ledges are solid)
      let low = s.minY;
      for (const [dc, dr] of N4) { const n = this.at(r + dr, c + dc); if (n.type !== 'wall') low = Math.min(low, n.minY); }
      if (s.type === 'floor') {
        const bot = low - 0.4;
        box(A, s.hall ? B.hallFloor : B.floor, cx, (bot + s.floorY) / 2, cz, CELL, s.floorY - bot, CELL, { worldUV: 2.5, shade: null });
        if (waterMat && s.roomId !== undefined && !s.portal) box(A, waterMat, cx, s.floorY + 0.1, cz, CELL, 0.06, CELL, { worldUV: 2.5, collide: false, shade: null });
      } else {
        // stairs: 8 steps along the descent direction
        const [dx, dz] = s.dir, steps = 8, depth = CELL / steps;
        const bot = s.minY - 0.4;
        for (let i = 0; i < steps; i++) {
          const top = s.floorY - LEVEL_DROP * (i + 0.5) / steps;
          const off = -CELL / 2 + depth * (i + 0.5);
          const sx = cx + dx * off, sz = cz + dz * off;
          const w = dx ? depth : CELL, d = dz ? depth : CELL;
          box(A, B.stair, sx, (bot + top) / 2, sz, w, top - bot, d, { worldUV: 1.25, shade: (x, y) => (y > top - 0.01 ? 0.95 : 0.55) });
        }
      }
      // ---- ceiling
      if (!B.open && !s.sky) box(A, B.ceiling, cx, s.ceilY + 0.25, cz, CELL, 0.5, CELL, { worldUV: 2.5, collide: false, shade: () => 0.6 });
      // ---- lintels where neighbouring ceilings differ (right + down to avoid duplicates)
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        const n = this.at(r + dr, c + dc);
        if (B.open || s.sky || n.sky || n.type === 'wall' || Math.abs(n.ceilY - s.ceilY) < 0.01) continue;
        const lo = Math.min(n.ceilY, s.ceilY), hi = Math.max(n.ceilY, s.ceilY);
        const bx = cx + dc * CELL / 2, bz = cz + dr * CELL / 2;
        box(A, B.wall, bx, (lo + hi) / 2 + 0.25, bz, dc ? 0.4 : CELL, hi - lo + 0.5, dc ? CELL : 0.4, { worldUV: 2.5, collide: false, shade: () => 0.55 });
      }
      if (s.pillar) {
        const h = s.ceilY - s.floorY;
        mesh(A, B.pillar, new THREE.CylinderGeometry(0.62, 0.7, h, 8), trs(cx, s.floorY + h / 2, cz), { worldUV: 2, shade: wallShade(s.floorY, s.ceilY) });
        box(A, 'stoneDark', cx, s.floorY + 0.3, cz, 1.7, 0.6, 1.7, { worldUV: 1.5 });
        box(A, 'stoneDark', cx, s.ceilY - 0.35, cz, 1.6, 0.5, 1.6, { worldUV: 1.5, collide: false, shade: null });
        A.collision.addCentered(cx, s.floorY + h / 2, cz, 1.35, h, 1.35);
      }
    }

    this._torches();
    if (this.decorate) this.decorate(); else this._decorate();
    // vaults (locked, a key is carried by one enemy) and cracked walls (break them open)
    this.breakables = [];
    for (const [c, r, dc, dr, kind] of (this.layout && this.layout.niches) || []) {
      const p = this.cellCenter(c, r);
      const bx = p.x - dc * CELL / 2, bz = p.z - dr * CELL / 2;          // the opening between room and niche
      const w = dc ? 0.5 : CELL, d = dc ? CELL : 0.5;
      const cx = p.x + dc * 0.45, cz = p.z + dr * 0.45;
      if (kind === 'vault') {
        const door = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, d), litMaterial('ironDark'));
        door.position.set(bx, p.y + 1.3, bz); this.scene.add(door);
        const col = this.collision.addCentered(bx, p.y + 1.6, bz, w, 3.2, d, 'vault');
        this.mapMarkers.push({ x: bx, z: bz, type: 'gate' });
        const it = interactable(this, new THREE.Vector3(bx - dc * 1.0, p.y, bz - dr * 1.0), 2.2, 'Locked vault (needs a Vault Key)', () => {
          if (!this.game.state.consume('vault_key')) { this.game.hud.feed('Locked. One of the dead down here carries the key.', '#d8b040'); return; }
          col.disabled = true; this.scene.remove(door); it.enabled = false;
          this.game.hud.banner('The vault opens', 'old riches, older dust');
        });
        chest(A, cx, p.y, cz, Math.atan2(-dc, -dr), () => { const rar = this.game.rewards.roll(); this.game.rewards.open(rar === 'normal' ? 'special' : rar, new THREE.Vector3(cx - dc * 1.2, p.y, cz - dr * 1.2)); }, { glow: 0xd8b040 });
        this.vaultKey = true;
      } else {
        const wallM = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), litMaterial(this.biome.wall, { color: 0xb8a890 }));
        wallM.position.set(bx, p.y + 1.6, bz); this.scene.add(wallM);
        // cracks
        for (let i = 0; i < 4; i++) { const cr = new THREE.Mesh(new THREE.BoxGeometry(dc ? 0.52 : 0.08, 0.9, dc ? 0.08 : 0.52), litMaterial('ironDark')); cr.position.set(bx + (dc ? 0 : (i - 1.5) * 0.5), p.y + 0.8 + (i % 2) * 1.2, bz + (dc ? (i - 1.5) * 0.5 : 0)); cr.rotation.set(0.4 * (i % 2 ? 1 : -1), 0, 0.5); this.scene.add(cr); wallM.add(cr); cr.position.sub(wallM.position); }
        const col = this.collision.addCentered(bx, p.y + 1.6, bz, w, 3.2, d, 'breakable');
        const b = { pos: new THREE.Vector3(bx, p.y + 1, bz), hp: 3, broken: false, hit: () => {
          if (b.broken) return;
          b.hp--; this.dust.burst(bx, p.y + 1.4, bz, 14, 2, 0.6, [0.35, 0.32, 0.28], 0.12, -6, 1);
          wallM.position.x += (Math.random() - 0.5) * 0.05;
          if (b.hp > 0) { this.game.hud.feed('The wall cracks...', '#c0b090'); return; }
          b.broken = true; col.disabled = true; this.scene.remove(wallM);
          this.dust.burst(bx, p.y + 1.4, bz, 50, 4, 1.2, [0.35, 0.32, 0.28], 0.18, -6, 1);
          this.game.hud.banner('A hidden chamber', 'not everything down here is solid');
        } };
        this.breakables.push(b);
        chest(A, cx, p.y, cz, Math.atan2(-dc, -dr), () => { this.game.loot.roll('chest', new THREE.Vector3(cx - dc * 1.2, p.y, cz - dr * 1.2), 4); });
      }
    }
    // high secret alcoves: a chest you can only reach by mantling / double-jumping
    for (const [c, r, dc, dr] of (this.layout && this.layout.secrets) || []) {
      const p = this.cellCenter(c, r);
      const x = p.x + dc * 0.55, z = p.z + dr * 0.55;   // at the back, leaving room to stand
      chest(A, x, p.y, z, Math.atan2(-dc, -dr), () => {
        this.game.loot.roll('chest', new THREE.Vector3(x - dc * 1.2, p.y, z - dr * 1.2), 4);
        if (this.game.loot.secretBonus) this.game.loot.secretBonus(new THREE.Vector3(x - dc * 1.2, p.y, z - dr * 1.2));
        this.game.hud.feed('A hidden cache!', '#f0d070');
      });
      wallTorch(A, p.x + dc * 1.2, p.y + 1.6, p.z + dr * 1.2, Math.atan2(-dc, -dr));
    }

    // portal back to town, against the north wall of the entrance room
    let pr = 0, pc = 0;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[r][c].portal) { pr = r; pc = c; }
    if (!this.noAutoPortal) portal(A, { x: (pc + 0.5) * CELL, z: pr * CELL + 0.9, y: 0, yaw: 0, target: 'town', spawn: this.returnSpawn, color: 'blue', label: 'Return to Emberwick' });
    this.spawns.portal = { pos: new THREE.Vector3((pc + 0.5) * CELL, 0, (pr + 2.7) * CELL), yaw: Math.PI };
    // arrive facing away from the portal (it sits on the room's north wall)
    this.spawns.start = this.spawns.portal;

    this.enemySpawns = this.spawnList.map(([c, r, type, opts]) => ({ type, pos: this.cellCenter(c, r), opts: { ...this.enemyOpts, ...opts } }));
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
        if (((r * 7 + c * 13 + dc * 3 + dr * 5) % this.biome.torchRate) !== 0) continue;
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
    if (this.rewardChest) this.addRemains();
    let seed = this.layout.seed || 77;
    const rnd = () => { seed = (seed * 16807 + 11) % 2147483647; return seed / 2147483647; };
    const cc = (c, r) => [(c + 0.5) * CELL, (r + 0.5) * CELL, this.at(r, c).floorY];
    for (const [c, r, kind] of this.layout.decor) {
      const [x, z, y] = cc(c, r);
      if (kind === 'sarcophagus') {
        const rot = rnd() < 0.5 ? 0 : Math.PI / 2;
        box(A, 'stoneDark', x, y + 0.45, z, 1.1, 0.9, 2.1, { worldUV: 1, rot });
        box(A, 'stone', x, y + 0.97, z, 1.25, 0.16, 2.25, { worldUV: 1, collide: false, rot: rot + (rnd() - 0.5) * 0.3, shade: null });
      } else if (kind === 'tree' || kind === 'deadtree') {
        const h = 5 + rnd() * 3;
        mesh(A, 'bark', new THREE.CylinderGeometry(0.22, 0.42, h, 6), trs(x, y + h / 2, z, rnd() * 6));
        A.collision.addCentered(x, y + h / 2, z, 0.7, h, 0.7, 'prop');
        if (kind === 'tree') for (let i = 0; i < 3; i++) mesh(A, 'hedge', new THREE.IcosahedronGeometry(1.1 + rnd() * 0.6, 0), trs(x + (rnd() - 0.5) * 1.2, y + h - 0.6 + i * 0.5, z + (rnd() - 0.5) * 1.2, rnd() * 6), { shade: null });
        else for (let i = 0; i < 3; i++) mesh(A, 'bark', new THREE.CylinderGeometry(0.03, 0.09, 1.4, 4), trs(x, y + h * 0.6 + i * 0.5, z, [0.9, rnd() * 6, 0]), { shade: null });
      } else if (kind === 'stump' || kind === 'mushroom') {
        mesh(A, kind === 'stump' ? 'bark' : 'bone', new THREE.CylinderGeometry(0.35, 0.45, 0.6, 6), trs(x, y + 0.3, z, rnd()));
        if (kind === 'mushroom') { mesh(A, 'impSkin', new THREE.ConeGeometry(0.7, 0.5, 7), trs(x, y + 0.85, z, rnd()), { shade: null }); A.addEmitter(new THREE.Vector3(x, y + 0.8, z), 1.5, (a, p) => a.glow.emit(p.x + (Math.random() - 0.5), p.y, p.z + (Math.random() - 0.5), 0, 0.3, 0, 2, [0.4, 0.9, 0.5], 0.04)); }
        A.collision.addCentered(x, y + 0.4, z, 0.9, 0.8, 0.9, 'prop');
      } else if (kind === 'reeds') {
        for (let i = 0; i < 9; i++) mesh(A, 'hedge', boxGeo(0.04, 1 + rnd(), 0.04, 0.5), trs(x + (rnd() - 0.5) * 1.6, y + 0.6, z + (rnd() - 0.5) * 1.6, [rnd() * 0.3, 0, rnd() * 0.3]), { shade: null });
      } else if (kind === 'icicle' || kind === 'crystal') {
        for (let i = 0; i < 4; i++) {
          const h = 0.6 + rnd() * 1.4;
          const up = kind === 'crystal';
          mesh(A, 'ice', new THREE.ConeGeometry(0.15 + rnd() * 0.15, h, 5), trs(x + (rnd() - 0.5) * 1.4, up ? y + h / 2 : this.at(r, c).ceilY - h / 2, z + (rnd() - 0.5) * 1.4, [up ? 0 : Math.PI, 0, 0]), { shade: null });
        }
        if (kind === 'crystal') A.collision.addCentered(x, y + 0.6, z, 1.2, 1.2, 1.2, 'prop');
      } else if (kind === 'beam') {
        const top = this.at(r, c).ceilY;
        for (const s of [-1, 1]) box(A, 'beam', x + s * 1.0, (y + top) / 2, z, 0.25, top - y, 0.25, { tag: 'prop' });
        box(A, 'beam', x, top - 0.2, z, 2.3, 0.25, 0.3, { collide: false, shade: null });
      } else if (kind === 'lavapool') {
        box(A, 'lava', x, y + 0.03, z, 1.8, 0.06, 1.8, { collide: false, shade: () => 1 });
        A.lights.add(new THREE.Vector3(x, y + 0.5, z), { color: 0xff5010, intensity: 5, range: 6, flicker: 0.5 });
        A.addEmitter(new THREE.Vector3(x, y + 0.1, z), 3, (a, p) => a.glow.emit(p.x + (Math.random() - 0.5) * 1.5, p.y, p.z + (Math.random() - 0.5) * 1.5, 0, 1, 0, 1, [1, 0.4, 0.1], 0.04));
      } else if (kind === 'cart') {
        box(A, 'woodDark', x, y + 0.6, z, 1.0, 0.6, 1.5, { tex: 1 });
        mesh(A, 'rock', new THREE.IcosahedronGeometry(0.45, 0), trs(x, y + 1.0, z, rnd()), { shade: null });
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
      if (this.rewardChest) {
        // end-of-run reward: rarity decided now (glow), pity updated when opened
        const rarity = this.game.rewards.roll();
        this.chestRarity = rarity;
        chest(A, x, y, z - CELL / 2 + 0.7, 0, () => this.game.rewards.open(rarity, new THREE.Vector3(x, y, z)), { glow: this.game.rewards.color(rarity) });
      } else chest(A, x, y, z - CELL / 2 + 0.7, 0, () => this.game.loot.roll('chest', new THREE.Vector3(x, y, z), 3));
    }
  }

  /** Random crypt: two sets of remains. */
  addRemains() {
    const rooms = (this.layout.roomRects || []).slice(1);
    for (let i = 0; i < Math.min(2, rooms.length); i++) {
      const o = rooms[(i * 3 + 1) % rooms.length];
      const p = this.cellCenter(o.x, o.y + Math.floor(o.h / 2));
      remains(this, p.x + 0.6, p.y, p.z, ['catacombs', 'any']);
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
    this.getNav();
    if (this.game.spawnEnemies) this.game.spawnEnemies(this);
    // one enemy carries the vault key
    if (this.vaultKey) {
      const c = this.game.enemies.list.filter((e) => !e.def.boss && !e.def.flee);
      const e = c[Math.floor(Math.random() * c.length)];
      if (e) { e.tags.key = true; this.game.hud.feed('Somewhere here, a vault. Someone carries its key.', '#d8b040'); }
    }
  }

  onExit() {
    if (this.game.clearEnemies) this.game.clearEnemies(this);
  }

  update(dt, player) {
    this.updateFlow(player.pos);
    super.update(dt, player);
  }
}

/** Main dungeon: 30 numbered levels, then the endless Abyss (31+). */
export const MAIN_LEVELS = 30;

/**
 * Each level ends in a guardian arena with two gates (Descend / Return).
 * Story bosses guard levels 5, 10, 15, 20, 25 and 30 (the Hollow King); other
 * levels have an elite guardian from the band's pool with affixes.
 * Difficulty is FIXED per level. Conquest (game.conquest) is the optional hard
 * mode: +150% HP/damage, more elites, a stronger guardian, extra traps, no
 * healing shrines, and every enemy must die.
 */
export class MainDungeon extends Dungeon {
  constructor(game) {
    const level = Math.max(1, game.dungeonLevel || 1);
    const abyss = level > MAIN_LEVELS;
    const bandId = bandFor(level);
    const B = BIOMES[bandId];
    super(game, 'dungeon', abyss ? `The Abyss \u2014 Depth ${level}` : `${bandId === 'crypt' ? 'The Catacombs' : B.title} \u2014 Level ${level}`);
    this.loreKey = abyss ? 'abyss' : level <= 5 ? 'dungeon' : bandId;
    this.level = level;
    this.abyss = abyss;
    const rest = game.restoration ? game.restoration.value : 0;
    // the first levels heal with the world: lighter, with plants growing back (never 26+ / the Abyss)
    const k = level <= 5 ? rest / 100 : 0;
    this.biome = k ? { ...B, hemi: [B.hemi[0], B.hemi[1], B.hemi[2] * (1 + k * 0.7)], fogFar: B.fogFar + k * 14, lantern: B.lantern * (1 - k * 0.2), decor: rest >= 60 ? [...B.decor, 'mushroom', 'reeds', 'stump'] : B.decor } : B;
    this.biomeId = bandId;
    this.transient = true;
    this.returnSpawn = 'portal';
    this.conquestMode = !!game.conquest;
    const asc = ascensionMul(game.state);
    // cartographer map for this level
    const mapId = game.state.world.mapMod; this.mapMod = mapId ? (MAPS[mapId] || {}).mod || {} : {};
    if (mapId) { game.state.world.mapMod = null; this.mapName = MAPS[mapId] && MAPS[mapId].name; }
    if (this.mapMod.hoarder) game.forceHoarder = true;
    this.layout = generateDungeon(level * 104729 + 17, { arena: true, enemies: mainLevelEnemies(level), decor: this.biome.decor });
    this.cells = this.layout.cells;
    this.braziers = this.layout.braziers;
    // the world healing thins out the first levels (never below level 26 / the Abyss)
    let spawns = this.layout.spawns;
    if (level <= 5 && rest >= 60 && !this.conquestMode) spawns = spawns.filter((_, i) => i % 4 !== 3);
    this.spawnList = spawns;
    this.fixedDecor = false;
    const cq = this.conquestMode ? 2.5 : 1;
    this.enemyOpts = { level, hpMul: cq * asc, dmgMul: cq * asc * (this.mapMod.dmg || 1), ...(this.mapMod.haste ? { affixes: ['hasted'] } : {}) };
    // guardian
    const story = STORY_LEVELS[level] || (abyss && level % 10 === 0 ? BOSS_BY_LEVEL[Math.floor(Math.random() * BOSS_BY_LEVEL.length)] : null);
    this.bossType = story;
    if (!story) {
      const pool = B.guardians || B.mini || ['knight', 'brute'];
      this.guardianType = pool[(level * 7) % pool.length];
      const n = Math.min(4, 1 + Math.floor(level / 10) + (this.conquestMode ? 1 : 0) + (abyss ? 1 : 0));
      const ids = AFFIX_IDS.slice();
      this.guardianAffixes = [];
      for (let i = 0; i < n; i++) this.guardianAffixes.push(ids.splice((level * 13 + i * 5 + (game.conquest ? 3 : 0)) % ids.length, 1)[0]);
    }
  }

  build() {
    super.build();
    const a = this.layout.arena, [sx, sz] = a.entryDir;
    const lv = this.level, cq = this.conquestMode;
    // Conquest: some ordinary foes are elites with an affix
    if (cq) for (const sp of this.enemySpawns) if (Math.random() < 0.25) { sp.opts = { ...sp.opts, elite: true, affixes: [AFFIX_IDS[Math.floor(Math.random() * AFFIX_IDS.length)]] }; }
    // the guardian waits in the middle of its arena, sealed inside (leash)
    const pad = 1.2;
    const leash = { x0: a.x * CELL + pad, z0: a.y * CELL + pad, x1: (a.x + a.w) * CELL - pad, z1: (a.y + a.h) * CELL - pad };
    this.arenaRect = leash;
    const gMul = cq ? 1.5 : 1;
    const bossOpts = { ...this.enemyOpts, level: lv, leash, guardian: true, hpMul: this.enemyOpts.hpMul * gMul, dmgMul: this.enemyOpts.dmgMul * (cq ? 1.2 : 1) };
    if (this.bossType) this.enemySpawns.push({ type: this.bossType, pos: this.cellCenter(a.cx, a.cy), opts: { ...bossOpts, affixes: cq ? ['hasted'] : [] } });
    else this.enemySpawns.push({ type: this.guardianType, pos: this.cellCenter(a.cx, a.cy), opts: { ...bossOpts, elite: true, affixes: this.guardianAffixes } });
    // a rare Ash Hoarder somewhere on the level
    if (Math.random() < 0.08 || this.game.forceHoarder) {
      const rooms = this.layout.roomRects.filter((o) => !o.arena).slice(1);
      const o = rooms[Math.floor(Math.random() * rooms.length)];
      if (o) this.enemySpawns.push({ type: 'ash_hoarder', pos: this.cellCenter(o.x + Math.floor(o.w / 2), o.y + Math.floor(o.h / 2)), opts: { level: lv } });
      this.game.forceHoarder = false;
    }
    // two gates on the far side of the arena
    const ex = a.cx + sx * Math.floor(a.w / 2), ez = a.cy + sz * Math.floor(a.h / 2);
    const px = -sz, pz = sx;
    const yaw = Math.atan2(-sx, -sz);
    const mk = (off, o) => {
      const c = ex + px * off, r = ez + pz * off;
      const pos = this.cellCenter(c, r);
      return gate(this, { x: pos.x + sx * CELL * 0.25, z: pos.z + sz * CELL * 0.25, y: pos.y, yaw, ...o });
    };
    const next = lv + 1;
    this.gates = [
      mk(-2, { target: 'dungeon', descend: true, color: 'red', sign: next > MAIN_LEVELS ? 'ABYSS' : 'DESCEND', label: next > MAIN_LEVELS ? `Descend into the Abyss (depth ${next})` : `Descend to level ${next}`,
        lockedLabel: 'Sealed until the guardian falls' }),
      mk(2, { target: 'town', spawn: 'portal', color: 'blue', sign: 'RETURN', label: 'Return to town (your loot is kept)', lockedLabel: 'Sealed until the guardian falls' }),
    ];
    // remains of earlier Wanderers, each with a note
    const rooms = this.layout.roomRects.filter((o) => !o.arena).slice(1);
    for (let i = 0; i < Math.min(3, rooms.length); i++) {
      const o = rooms[Math.floor((i + 0.5) * rooms.length / 3)];
      const p = this.cellCenter(o.x + Math.floor(o.w / 2), o.y);
      remains(this, p.x + 0.6, p.y, p.z + 0.4, [`catacombs:${Math.min(lv, 5)}`, 'catacombs']);
    }
    // traps (more in Conquest) and a healing shrine (never in Conquest)
    let seed = lv * 7919 + (cq ? 1 : 0);
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const nTraps = (lv >= 3 ? 2 + Math.floor(lv / 8) : 0) + (cq ? 6 : 0);
    const used = new Set(this.layout.spawns.map(([c, r]) => r * 1000 + c));
    let placed = 0;
    for (let t = 0; t < 400 && placed < nTraps; t++) {
      const o = rooms[Math.floor(rnd() * rooms.length)];
      if (!o) break;
      const c = o.x + Math.floor(rnd() * o.w), r = o.y + Math.floor(rnd() * o.h);
      const cell = this.at(r, c);
      if (cell.type !== 'floor' || cell.raise || cell.pillar || used.has(r * 1000 + c)) continue;
      used.add(r * 1000 + c);
      const p = this.cellCenter(c, r);
      spikeTrap(this, p.x, p.y, p.z, { damage: Math.round(14 * levelDmgMul(lv) * (cq ? 1.6 : 1)) });
      placed++;
    }
    if (!cq && rooms.length > 2) {
      const o = rooms[Math.floor(rooms.length / 2)];
      for (let t = 0; t < 20; t++) {
        const c = o.x + Math.floor(rnd() * o.w), r = o.y + Math.floor(rnd() * o.h);
        const cell = this.at(r, c);
        if (cell.type !== 'floor' || cell.raise || cell.pillar || used.has(r * 1000 + c)) continue;
        const p = this.cellCenter(c, r);
        healingShrine(this, p.x, p.y, p.z);
        break;
      }
    }
    this.arenaCenter = this.cellCenter(a.cx, a.cy);
    this.arenaEntry = this.cellCenter(a.cx - sx * (Math.floor(a.w / 2) - 1), a.cy - sz * (Math.floor(a.h / 2) - 1));
    this.arenaEntryYaw = Math.atan2(-sx, -sz) + Math.PI;
    this.mapMarkers.push({ x: this.arenaCenter.x, z: this.arenaCenter.z, type: 'boss' });
    for (const gt of this.gates) this.mapMarkers.push({ x: gt.pos.x, z: gt.pos.z, type: 'gate' });
  }

  onBossDefeated(enemy) {
    for (const gt of this.gates) if (!gt.permanent) gt.open();
    this.game.hud.banner(enemy.name + ' has fallen', this.conquestMode ? 'the gates open \u2014 but the level is not yet yours' : 'the gates grind open');
  }

  onEnter() {
    super.onEnter();
    if (this.mapName) this.game.hud.feed(`${this.mapName} guides you.`, '#d8c090');
    if (this.mapMod.reveal && this.game.minimap) this.game.minimap.revealAll();
    if (this.conquestMode) {
      const targets = this.game.enemies.list.filter((e) => !e.dead && !e.def.flee);
      for (const e of targets) e.tags.conquest = true;
      this.conquest = { total: targets.length, killed: 0, done: false };
    }
    if (this.game.pendingArena) {
      this.game.pendingArena = false;
      const p = this.arenaEntry;
      this.game.player.place(p.x, p.y, p.z, Math.atan2(-(this.arenaCenter.x - p.x), -(this.arenaCenter.z - p.z)));
    }
  }
}

/** A freshly generated layout every visit, in a random biome. */
export class RandomDungeon extends Dungeon {
  constructor(game) {
    const biomeId = game.nextBiome && BIOMES[game.nextBiome] ? game.nextBiome : BIOME_IDS[Math.floor(Math.random() * BIOME_IDS.length)];
    game.nextBiome = null;
    super(game, 'depths', BIOMES[biomeId].title);
    this.biome = BIOMES[biomeId];
    this.biomeId = biomeId;
    this.transient = true;
    this.returnSpawn = 'portal_depths';
    this.rewardChest = true;
    this.loreKey = 'crypt';
    this.layout = generateDungeon((Math.random() * 1e9) | 0, { enemies: this.biome.enemies });
    this.cells = this.layout.cells;
    this.braziers = this.layout.braziers;
    this.spawnList = this.layout.spawns;
    this.fixedDecor = false;
    // 1 in 3: an elder mini-boss guards the final room
    this.hasMiniBoss = game.forceMiniBoss || Math.random() < 1 / 3;
    if (this.hasMiniBoss) {
      const f = this.layout.far, mini = this.biome.mini;
      this.spawnList.push([f.cx, f.cy, mini[Math.floor(Math.random() * mini.length)], { elite: true }]);
    }
  }
}
