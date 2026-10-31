// Outdoor / cave dungeons for the non-crypt biomes. Builds:
//  * a smooth terrain mesh from the tile heights (one draw call)
//  * one collision box per walkable tile (gentle steps) + tall invisible
//    borders on blocked tiles, so the nav grid and minimap work unchanged
//  * natural borders (dead trees, giant trees, ice cliffs, rock, deep water)
//    drawn with InstancedMesh for tablet performance
//  * biome features: fallen logs, temple ruins, fortress walls, frozen
//    soldiers, sunken houses, bell towers, lava + bridges, rails and carts
import * as THREE from '../../lib/three.module.min.js';
import { Area } from './area.js';
import { generateOutdoor, T, WALKABLE, TILE } from './outdoorGen.js';
import { BIOMES } from './biomes.js';
import { litMaterial, basicMaterial, spriteMaterial } from '../engine/materials.js';
import { boxGeo, trs } from '../engine/geometry.js';
import { box, mesh, portal, fire, chest } from './props.js';
import { ENEMY_TYPES } from '../entities/enemyTypes.js';

/** Collects instance transforms per (geometry, material) and builds InstancedMeshes. */
class Instancer {
  constructor() { this.groups = new Map(); }
  add(key, geo, mat, matrix) {
    let g = this.groups.get(key);
    if (!g) { g = { geo, mat, list: [] }; this.groups.set(key, g); }
    g.list.push(matrix);
  }
  build(scene) {
    for (const g of this.groups.values()) {
      const im = new THREE.InstancedMesh(g.geo, g.mat, g.list.length);
      g.list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      scene.add(im);
    }
    this.groups.clear();
  }
}

export class OutdoorDungeon extends Area {
  constructor(game, biomeId) {
    const B = BIOMES[biomeId];
    super(game, 'depths', B.title);
    this.biome = B;
    this.biomeId = biomeId;
    this.hostile = true;
    this.transient = true;
    this.returnSpawn = 'portal_depths';
    this.layout = generateOutdoor(biomeId, (Math.random() * 1e9) | 0);
    this.hasMiniBoss = game.forceMiniBoss || Math.random() < 1 / 3;
  }

  tileAt(x, z) {
    const L = this.layout, i = Math.floor(x / TILE), j = Math.floor(z / TILE);
    if (i < 0 || j < 0 || i >= L.W || j >= L.H) return T.BLOCK;
    return L.tile[j * L.W + i];
  }

  /** Movement multiplier for the ground under (x,z): shallow water slows. */
  terrainSlow(x, z) { return this.tileAt(x, z) === T.WATER ? 0.6 : 1; }

  /** Rendered/collision top height of a tile. */
  top(k) {
    const L = this.layout, t = L.tile[k], h = L.height[k];
    switch (t) {
      case T.WATER: return h - 0.3;
      case T.DEEP: return h - 0.7;
      case T.LAVA: return h - 0.6;
      case T.BOARD: return h + 0.02;
      case T.BRIDGE: return h + 0.05;
      case T.BLOCK: return h + 0.3;
      default: return h;
    }
  }

  build() {
    const A = this, B = this.biome, L = this.layout, W = L.W, H = L.H;
    let s = L.seed;
    const rnd = () => { s = (s * 16807 + 7) % 2147483647; return s / 2147483647; };
    this.scene.fog = new THREE.Fog(B.fog, 1, B.fogFar);
    this.scene.background = new THREE.Color(B.fog);
    this.hemi.color.set(B.hemi[0]); this.hemi.groundColor.set(B.hemi[1]); this.hemi.intensity = B.hemi[2];
    this.sun.intensity = 0;
    this.lanternIntensity = B.lantern;
    this.dustColor = B.dust;
    this.mapBounds = { x0: 0, z0: 0, x1: W * TILE, z1: H * TILE };
    this.navBounds = this.mapBounds;
    const k = (i, j) => j * W + i;
    const cx = (i) => (i + 0.5) * TILE;
    const nearWalk = new Int8Array(W * H).fill(99);
    // distance (in tiles, up to 4) from each blocked tile to walkable ground
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (!WALKABLE.has(L.tile[k(i, j)])) continue;
      for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const d = Math.max(Math.abs(di), Math.abs(dj));
        if (d < nearWalk[k(ii, jj)]) nearWalk[k(ii, jj)] = d;
      }
    }

    // ---------------------------------------------------------- terrain mesh
    const pos = [], col = [], uv = [], idx = [];
    for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) {
      let hs = 0, n = 0, shade = 0;
      for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const kk = k(ii, jj), t = L.tile[kk];
        hs += this.top(kk) - (t === T.BOARD || t === T.BRIDGE ? (t === T.BRIDGE ? 0.6 : 0.3) : 0); n++;
        shade += t === T.TRAIL ? 0.72 : t === T.BLOCK ? 0.55 : t === T.WATER || t === T.DEEP ? 0.45 : t === T.LAVA ? 0.25 : 1;
      }
      const h = hs / Math.max(1, n), f = shade / Math.max(1, n);
      pos.push(i * TILE, h, j * TILE);
      const tint = B.groundTint || [1, 1, 1];
      col.push(f * tint[0], f * tint[1], f * tint[2]);
      uv.push(i * TILE / 2.5, j * TILE / 2.5);
    }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const a = j * (W + 1) + i, b = a + 1, c = a + W + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    tg.setIndex(idx); tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, litMaterial(B.floor, { vertexColors: true, unique: true }));
    this.scene.add(terrain);

    // ---------------------------------------------------------- collision (row-merged borders)
    for (let j = 0; j < H; j++) {
      let run = -1;
      for (let i = 0; i <= W; i++) {
        const kk = i < W ? k(i, j) : -1;
        const blocked = kk >= 0 && !WALKABLE.has(L.tile[kk]);
        if (blocked && run < 0) run = i;
        if ((!blocked || i === W) && run >= 0) {
          const end = blocked ? i : i - 1;
          let lo = Infinity; for (let q = run; q <= end; q++) lo = Math.min(lo, this.top(k(q, j)));
          A.collision.add(run * TILE, lo - 1.5, j * TILE, (end + 1) * TILE, lo + 4.5, (j + 1) * TILE, 'border');
          run = -1;
        }
        if (kk >= 0 && WALKABLE.has(L.tile[kk])) { const t = this.top(kk); A.collision.add(i * TILE, t - 1.5, j * TILE, (i + 1) * TILE, t, (j + 1) * TILE, 'ground'); }
      }
    }

    // ---------------------------------------------------------- water, lava, planks
    const waterMat = litMaterial('water', { transparent: true, color: B.waterColor || 0x8aa080, unique: true }); waterMat.opacity = 0.78;
    const lavaMat = basicMaterial(0xffffff, { map: null });
    const lavaTex = litMaterial('lava'); lavaMat.map = lavaTex.map;
    const quad = new THREE.PlaneGeometry(TILE, TILE).rotateX(-Math.PI / 2);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const kk = k(i, j), t = L.tile[kk], h = L.height[kk];
      if (t === T.WATER || t === T.DEEP || t === T.BOARD) {
        if (t === T.DEEP && nearWalk[kk] > 4) continue;
        A.batcher.add(quad, waterMat, trs(cx(i), h - 0.08, cx(j)), { worldUV: 3, shade: () => (t === T.DEEP ? 0.6 : 0.9) });
      }
      if (t === T.LAVA || (t === T.BRIDGE && B.lava)) {
        A.batcher.add(quad, lavaMat, trs(cx(i), h - 0.55, cx(j)), { worldUV: 2, shade: () => 1 });
        if ((i * 7 + j * 3) % 9 === 0) A.lights.add(new THREE.Vector3(cx(i), h, cx(j)), { color: 0xff5010, intensity: 6, range: 9, flicker: 0.4 });
        if ((i + j) % 4 === 0) A.addEmitter(new THREE.Vector3(cx(i), h - 0.4, cx(j)), 1.2, (a, p) => a.glow.emit(p.x + (Math.random() - 0.5) * 2, p.y, p.z + (Math.random() - 0.5) * 2, 0, 1.2, 0, 1.2, [1, 0.4, 0.1], 0.05));
      }
      if (t === T.BOARD || t === T.BRIDGE) {
        const top = this.top(kk);
        for (let p = 0; p < 4; p++) box(A, 'woodDark', cx(i) - 0.75 + p * 0.5, top - 0.06, cx(j), 0.42, 0.12, TILE * 0.95, { collide: false, shade: null, rot: (i + j) % 2 ? 0 : Math.PI / 2 });
        if ((i + j) % 2 === 0) for (const sx of [-0.9, 0.9]) box(A, 'beam', cx(i) + sx, top - 0.5, cx(j) + sx * 0.3, 0.14, 1.4, 0.14, { collide: false, shade: null });
      }
    }

    // ---------------------------------------------------------- natural borders (instanced)
    const inst = new Instancer();
    const M = (tex, o) => litMaterial(tex, o);
    const G = {
      trunk: new THREE.CylinderGeometry(0.16, 0.38, 6, 6).translate(0, 3, 0),
      branch: new THREE.CylinderGeometry(0.04, 0.1, 2.2, 4).translate(0, 1.1, 0),
      bigTrunk: new THREE.CylinderGeometry(0.6, 1.1, 12, 7).translate(0, 6, 0),
      canopy: new THREE.IcosahedronGeometry(3.2, 0),
      bush: new THREE.IcosahedronGeometry(1.1, 0),
      vine: new THREE.BoxGeometry(0.06, 4, 0.06).translate(0, -2, 0),
      cliff: new THREE.ConeGeometry(1.6, 7, 5).translate(0, 3.5, 0),
      rockCol: new THREE.BoxGeometry(2.2, 8, 2.2).translate(0, 4, 0),
      ore: new THREE.OctahedronGeometry(0.35, 0),
      reed: new THREE.BoxGeometry(0.05, 1.4, 0.05).translate(0, 0.7, 0),
    };
    const Mx = (x, y, z, ry = 0, s = 1, rx = 0, rz = 0) => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s)); return m; };
    const oreMat = basicMaterial(0xff8a30);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const kk = k(i, j), t = L.tile[kk], d = nearWalk[kk];
      if (WALKABLE.has(t) || d > 4) continue;
      const x = cx(i) + (rnd() - 0.5) * 1.2, z = cx(j) + (rnd() - 0.5) * 1.2, y = this.top(kk) - 0.3, r = rnd();
      switch (this.biomeId) {
        case 'forest':
          if (r < 0.92) {
            const sc = 0.7 + rnd() * 0.7, ry = rnd() * 6;
            inst.add('trunk', G.trunk, M('bark'), Mx(x, y, z, ry, sc, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12));
            for (let b = 0; b < 2; b++) inst.add('branch', G.branch, M('bark'), Mx(x, y + (3 + rnd() * 2.5) * sc, z, rnd() * 6, sc, 0.9 + rnd() * 0.5, 0));
          }
          break;
        case 'jungle':
          if ((i + j) % 2 === 0 && r < 0.8) {
            const sc = 0.8 + rnd() * 0.5;
            inst.add('bigTrunk', G.bigTrunk, M('bark'), Mx(x, y, z, rnd() * 6, sc));
            inst.add('canopy', G.canopy, M('hedge'), Mx(x, y + 11 * sc, z, rnd() * 6, sc * (1 + rnd() * 0.5)));
            for (let v = 0; v < 3; v++) inst.add('vine', G.vine, M('moss'), Mx(x + (rnd() - 0.5) * 4, y + 10 * sc, z + (rnd() - 0.5) * 4, 0, 1 + rnd() * 0.8));
          }
          if (d <= 2) inst.add('bush', G.bush, M('hedge'), Mx(x, y + 0.3, z, rnd() * 6, 0.8 + rnd() * 0.9));
          break;
        case 'frozen':
          inst.add('cliff', G.cliff, M('iceWall'), Mx(x, y - 0.5, z, rnd() * 6, 0.8 + rnd() * 0.9 + (4 - d) * 0.1, (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.2));
          break;
        case 'swamp':
          if (d <= 3 && r < 0.18) {
            inst.add('trunk', G.trunk, M('bark'), Mx(x, y - 0.4, z, rnd() * 6, 0.6 + rnd() * 0.5, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3));
          } else if (d <= 2 && r < 0.5) for (let q = 0; q < 4; q++) inst.add('reed', G.reed, M('hedge'), Mx(x + (rnd() - 0.5) * 1.5, y + 0.3, z + (rnd() - 0.5) * 1.5, 0, 1, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3));
          break;
        case 'mine':
          if (d <= 2) {
            inst.add('rockCol', G.rockCol, M('rock'), Mx(cx(i), y - 0.5, cx(j), rnd() * 0.4, 1, 0, 0));
            if (d === 1 && r < 0.12) {
              const ox = cx(i) + (rnd() - 0.5) * 1.6, oz = cx(j) + (rnd() - 0.5) * 1.6, oy = y + 0.8 + rnd() * 2;
              inst.add('ore', G.ore, oreMat, Mx(ox, oy, oz, rnd() * 6, 0.8 + rnd() * 0.6));
              if (r < 0.04) A.lights.add(new THREE.Vector3(ox, oy, oz), { color: 0xff8a30, intensity: 3, range: 6, flicker: 0.1 });
            }
          }
          break;
      }
    }
    // deep water / swamp: border fog walls of dead trees far out
    inst.build(this.scene);

    // ---------------------------------------------------------- features
    const at = (c) => ({ x: cx(c.x), z: cx(c.y), y: this.top(k(c.x, c.y)) });
    for (const f of L.features) {
      const p = f.x !== undefined ? at(f) : null;
      switch (f.type) {
        case 'logs': for (let q = 0; q < 2; q++) {
          const a = rnd() * 6, ox = p.x + Math.cos(a) * (f.r - 1.5) * TILE * 0.5, oz = p.z + Math.sin(a) * (f.r - 1.5) * TILE * 0.5;
          const len = 3 + rnd() * 2, ry = rnd() * Math.PI;
          mesh(A, 'bark', new THREE.CylinderGeometry(0.35, 0.4, len, 6), trs(ox, p.y + 0.3, oz, [0, ry, Math.PI / 2]));
          const c2 = Math.abs(Math.cos(ry)), s2 = Math.abs(Math.sin(ry));
          A.collision.addCentered(ox, p.y + 0.35, oz, Math.max(0.8, c2 * len), 0.7, Math.max(0.8, s2 * len), 'prop');
        } break;
        case 'ruin': {
          box(A, 'stoneMoss', p.x, p.y + 0.2, p.z, 6, 0.4, 6, { worldUV: 2 });
          for (const [dx, dz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) {
            const hgt = 1.5 + rnd() * 3;
            box(A, 'stoneMoss', p.x + dx, p.y + 0.4 + hgt / 2, p.z + dz, 0.8, hgt, 0.8, { worldUV: 1.5 });
          }
          box(A, 'stoneMoss', p.x, p.y + 1.2, p.z - 2.6, 3, 1.6, 0.6, { worldUV: 1.5 });
          mesh(A, 'stoneDark', new THREE.ConeGeometry(0.9, 1.8, 4), trs(p.x, p.y + 1.3, p.z, Math.PI / 4));
          A.collision.addCentered(p.x, p.y + 1.2, p.z, 1.2, 1.8, 1.2, 'prop');
          for (let v = 0; v < 5; v++) box(A, 'moss', p.x + (rnd() - 0.5) * 5, p.y + 2.5, p.z - 2.6, 0.05, 2, 0.05, { collide: false, shade: null });
          fire(A, p.x + 2.4, p.y + 0.6, p.z + 2.4, { size: 0.4, color: 0x9ad070, intensity: 6 });
        } break;
        case 'fortwall': {
          const ry = rnd() < 0.5 ? 0 : Math.PI / 2;
          for (let q = -2; q <= 2; q++) {
            if (q === 0 || rnd() < 0.25) continue;
            const hgt = 1.5 + rnd() * 2.5, ox = ry ? 0 : q * 1.6, oz = ry ? q * 1.6 : 0;
            box(A, 'stoneWall', p.x + ox, p.y + hgt / 2, p.z + oz, ry ? 0.8 : 1.6, hgt, ry ? 1.6 : 0.8, { worldUV: 2 });
            box(A, 'snow', p.x + ox, p.y + hgt + 0.05, p.z + oz, ry ? 0.9 : 1.7, 0.1, ry ? 1.7 : 0.9, { collide: false, shade: null });
          }
        } break;
        case 'frozen': {
          // a soldier still at his post, sealed in ice
          const sx = p.x + (rnd() - 0.5) * 3, sz = p.z + (rnd() - 0.5) * 3;
          const soldier = ENEMY_TYPES.hollow.build().root;
          soldier.position.set(sx, p.y, sz); soldier.rotation.y = rnd() * 6;
          this.scene.add(soldier);
          const ice = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.2), litMaterial('ice', { transparent: true, unique: true }));
          ice.material.opacity = 0.45; ice.position.set(sx, p.y + 1.1, sz); ice.rotation.y = rnd();
          this.scene.add(ice);
          A.collision.addCentered(sx, p.y + 1.1, sz, 1.2, 2.2, 1.2, 'prop');
          this.frozenSoldiers = (this.frozenSoldiers || 0) + 1;
        } break;
        case 'sunken': {
          const ry = rnd() * 0.4;
          box(A, 'stoneDark', p.x + 2, p.y + 0.9, p.z, 0.4, 2.4, 4, { rot: [0.12, ry, 0.1], worldUV: 2 });
          box(A, 'stoneDark', p.x, p.y + 0.6, p.z + 2, 4, 1.8, 0.4, { rot: [0.1, ry, -0.08], worldUV: 2 });
          mesh(A, 'roof', new THREE.ConeGeometry(2.6, 1.6, 4), trs(p.x + 0.4, p.y + 0.3, p.z + 0.4, [0.35, Math.PI / 4, 0.2]), { shade: null });
        } break;
        case 'belltower': {
          const y0 = this.top(k(f.x, f.y));
          box(A, 'swampRock', p.x, y0 + 4, p.z, 3, 9, 3, { worldUV: 2, collide: false });
          for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) box(A, 'beam', p.x + dx, y0 + 9.6, p.z + dz, 0.25, 1.4, 0.25, { collide: false, shade: null });
          mesh(A, 'roof', new THREE.ConeGeometry(2.4, 2.4, 4), trs(p.x, y0 + 11.4, p.z, Math.PI / 4), { shade: null });
          const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 0.9, 8), litMaterial('ironDark', { emissive: 0x101810 }));
          bell.position.set(p.x, y0 + 9.6, p.z); this.scene.add(bell);
          this.animated.push({ update(dt, t) { bell.rotation.z = Math.sin(t * 0.8) * 0.15; } });
        } break;
        case 'cart': {
          box(A, 'woodDark', p.x, p.y + 0.6, p.z, 1.1, 0.7, 1.6, { tex: 1 });
          mesh(A, 'rock', new THREE.IcosahedronGeometry(0.5, 0), trs(p.x, p.y + 1.05, p.z, rnd()), { shade: null });
          inst.add('ore2', G.ore, oreMat, Mx(p.x + 0.2, p.y + 1.3, p.z - 0.3, rnd() * 6, 0.7));
        } break;
        case 'bridge': break;
        case 'rails': for (const kk of f.tiles) {
          const i = kk % W, j = (kk / W) | 0, y = this.top(kk);
          if (L.tile[kk] === T.BRIDGE) continue;
          box(A, 'beam', cx(i), y + 0.04, cx(j), 1.6, 0.08, 0.3, { collide: false, shade: null });
          box(A, 'ironDark', cx(i) - 0.5, y + 0.1, cx(j), 0.07, 0.07, TILE, { collide: false, shade: null });
          box(A, 'ironDark', cx(i) + 0.5, y + 0.1, cx(j), 0.07, 0.07, TILE, { collide: false, shade: null });
        } break;
      }
    }
    inst.build(this.scene);

    // ---------------------------------------------------------- fires in clearings
    for (const c of L.clearings) {
      if (c.entrance || rnd() < 0.35) continue;
      const p = at(c);
      if (this.biomeId === 'swamp') { box(A, 'beam', p.x + 1.5, p.y + 1, p.z, 0.15, 2, 0.15, {}); fire(A, p.x + 1.5, p.y + 2.1, p.z, { size: 0.35, color: 0x9ad070, intensity: 7 }); }
      else if (this.biomeId !== 'mine') {
        for (let q = 0; q < 6; q++) { const a = (q / 6) * Math.PI * 2; mesh(A, 'stoneDark', boxGeo(0.3, 0.2, 0.3, 0.6), trs(p.x - 1.8 + Math.cos(a) * 0.6, p.y + 0.1, p.z + Math.sin(a) * 0.6, a)); }
        fire(A, p.x - 1.8, p.y + 0.15, p.z, { size: 0.6, intensity: 9, range: 12 });
        A.collision.addCentered(p.x - 1.8, p.y + 0.3, p.z, 1.2, 0.6, 1.2, 'prop');
      }
    }

    // ---------------------------------------------------------- portal, spawn, reward chest
    const e = L.entrance, ep = at(e);
    const back = Math.max(1, Math.min(e.r - 1, 3));
    const portalPos = { x: ep.x, z: cx(e.y - back) };
    portal(A, { x: portalPos.x, z: portalPos.z, y: this.top(k(e.x, e.y - back)), yaw: 0, target: 'town', spawn: this.returnSpawn, color: 'blue', label: 'Return to Emberwick' });
    const sj = Math.min(H - 3, e.y - back + 3);
    this.spawns.portal = { pos: new THREE.Vector3(portalPos.x, this.top(k(e.x, sj)), cx(sj)), yaw: Math.PI };
    this.spawns.start = this.spawns.portal;
    const xp = at(L.exit);
    this.rewardRarity = this.game.rewards.roll();
    chest(A, xp.x, xp.y, xp.z, 0, () => this.game.rewards.open(this.rewardRarity, new THREE.Vector3(xp.x, xp.y, xp.z + 1.5)), { glow: this.game.rewards.color(this.rewardRarity) });
    this.chestRarity = this.rewardRarity;
    fire(A, xp.x + 2.2, xp.y + 0.1, xp.z + 1, { size: 0.5 });

    // ---------------------------------------------------------- enemies
    const tbl = B.enemies;
    const pick = () => { let r = rnd() * tbl.reduce((a, [, w]) => a + w, 0); for (const [t, w] of tbl) { r -= w; if (r <= 0) return t; } return tbl[0][0]; };
    this.enemySpawns = [];
    for (const c of L.clearings) {
      if (c.entrance) continue;
      const n = Math.min(5, 1 + Math.floor((c.r * c.r) / 9));
      for (let q = 0; q < n; q++) {
        const type = pick();
        const group = ENEMY_TYPES[type] && ENEMY_TYPES[type].swarm ? 3 : 1;
        for (let g = 0; g < group; g++) {
          const a = rnd() * 6, rr = rnd() * (c.r - 1) * TILE * 0.6;
          const x = cx(c.x) + Math.cos(a) * rr, z = cx(c.y) + Math.sin(a) * rr;
          const kk = k(Math.floor(x / TILE), Math.floor(z / TILE));
          if (!WALKABLE.has(L.tile[kk])) continue;
          this.enemySpawns.push({ type, pos: new THREE.Vector3(x, this.top(kk), z), opts: {} });
        }
      }
    }
    if (this.hasMiniBoss) this.enemySpawns.push({ type: B.mini[Math.floor(rnd() * B.mini.length)], pos: new THREE.Vector3(xp.x, xp.y, xp.z + 3), opts: { elite: true } });
    this.finish();
  }

  onEnter() {
    this.getNav();
    this.game.spawnEnemies(this);
  }

  onExit() { this.game.clearEnemies(this); }

  dispose() { this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
}
