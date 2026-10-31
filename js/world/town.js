// TOWN - walled safe hub. No enemies. Lighting follows the world clock phase
// (which only advances while the player is in the dungeon).
import * as THREE from '../../lib/three.module.min.js';
import { Area } from './area.js';
import { Sky } from './sky.js';
import { basicMaterial, litMaterial } from '../engine/materials.js';
import { boxGeo, trs } from '../engine/geometry.js';
import {
  box, mesh, wallTorch, postTorch, portal, house, barrel, crate, cart, well,
  gravestone, deadTree, npc, groundAO,
} from './props.js';

const HALF = 23;     // wall centre line
const WALL_H = 6.5;
const WALL_T = 2;

export const PHASES = {
  day: {
    fog: 0x6a6862, near: 8, far: 70,
    sky: { top: 0x545a62, horizon: 0x76746c, bottom: 0x3a3832, clouds: 0x9a978e, cloudOpacity: 0.85, stars: false, orbColor: 0xb0aaa0, orbOpacity: 0.3, moon: false },
    hemiSky: 0xa0a8b0, hemiGround: 0x40362a, hemi: 1.7,
    sun: 0xd8d0c0, sunI: 1.5, sunPos: [-40, 70, 30],
    torch: 0.3, lantern: 0, window: 0x161210, mountains: 0x3c3c3a, dust: [0.5, 0.48, 0.44],
  },
  night: {
    fog: 0x07090e, near: 2, far: 30,
    sky: { top: 0x010205, horizon: 0x0a0d15, bottom: 0x040506, clouds: 0x161a22, cloudOpacity: 0.7, stars: true, orbColor: 0x6a7a9a, orbOpacity: 0.5, moon: true },
    hemiSky: 0x2a3550, hemiGround: 0x080706, hemi: 0.32,
    sun: 0x7080a8, sunI: 0.28, sunPos: [-60, 90, -90],
    torch: 1.0, lantern: 3.2, window: 0xb85a1c, mountains: 0x05060a, dust: [0.3, 0.3, 0.34],
  },
};

export class Town extends Area {
  constructor(game) {
    super(game, 'town', 'Ashen Hollow');
    this.hostile = false;
    this.phase = null;
  }

  build() {
    const A = this;
    this.windowMat = basicMaterial(0x161210);
    this.scene.fog = new THREE.Fog(0x5e5d58, 6, 62);
    this.sky = new Sky(this.scene);

    // ---------------------------------------------------------- ground
    box(A, 'dirt', 0, -0.5, 0, 160, 1, 160, { worldUV: 2.5, shade: null });
    // square + paths (slightly raised cobbles)
    const cob = { worldUV: 2, shade: null };
    box(A, 'cobble', 0, 0.02, 0, 22, 0.04, 20, cob);
    box(A, 'cobble', 0, 0.02, 15.5, 5, 0.04, 13, cob);
    box(A, 'cobble', 0, 0.02, -14.5, 5, 0.04, 11, cob);
    box(A, 'cobbleDark', -14.5, 0.02, -1, 9, 0.04, 3.5, cob);
    box(A, 'cobbleDark', 14.5, 0.02, -1, 9, 0.04, 3.5, cob);
    // muddy patches
    box(A, 'mud', -8, 0.01, 13, 6, 0.02, 4, cob);
    box(A, 'dirtMoss', 17, 0.01, -2, 9, 0.02, 12, cob);

    // ---------------------------------------------------------- walls
    const wallMat = 'stoneWall';
    const ws = { worldUV: 2.5 };
    box(A, wallMat, 0, WALL_H / 2, -HALF, HALF * 2 + WALL_T, WALL_H, WALL_T, ws);
    box(A, wallMat, -HALF, WALL_H / 2, 0, WALL_T, WALL_H, HALF * 2 + WALL_T, ws);
    box(A, wallMat, HALF, WALL_H / 2, 0, WALL_T, WALL_H, HALF * 2 + WALL_T, ws);
    const gateHalf = 2.5;
    const sideLen = HALF - gateHalf;
    box(A, wallMat, -(gateHalf + sideLen / 2), WALL_H / 2, HALF, sideLen, WALL_H, WALL_T, ws);
    box(A, wallMat, gateHalf + sideLen / 2, WALL_H / 2, HALF, sideLen, WALL_H, WALL_T, ws);
    // crenellations along the top, inner + outer edge
    const merlon = (x, z, alongX) => box(A, wallMat, x, WALL_H + 0.45, z, alongX ? 1.1 : 0.5, 0.9, alongX ? 0.5 : 1.1, { collide: false, shade: null, worldUV: 2.5 });
    for (let t = -HALF + 1; t <= HALF - 1; t += 2) {
      for (const e of [-0.75, 0.75]) {
        merlon(t, -HALF + e, true);
        merlon(-HALF + e, t, false);
        merlon(HALF + e, t, false);
        if (Math.abs(t) > gateHalf + 2) merlon(t, HALF + e, true);
      }
    }
    // wall-walk ledge and buttresses (inner face) for silhouette
    for (let t = -18; t <= 18; t += 9) {
      box(A, 'stoneDark', t, 1.6, -HALF + 1.3, 1.2, 3.2, 0.7, { worldUV: 2 });
      box(A, 'stoneDark', -HALF + 1.3, 1.6, t, 0.7, 3.2, 1.2, { worldUV: 2 });
      box(A, 'stoneDark', HALF - 1.3, 1.6, t, 0.7, 3.2, 1.2, { worldUV: 2 });
    }
    // corner towers
    for (const [cx, cz] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) {
      const tg = new THREE.CylinderGeometry(3, 3.3, 10, 8);
      mesh(A, 'stoneWall', tg, trs(cx, 5, cz), { worldUV: 2.5 });
      A.collision.addCentered(cx, 5, cz, 6, 10, 6);
      mesh(A, 'roof', new THREE.ConeGeometry(3.7, 4, 8), trs(cx, 12, cz), { shade: null });
      box(A, 'beam', cx, 10.1, cz, 7.2, 0.25, 7.2, { collide: false, shade: null });
    }

    // ---------------------------------------------------------- gatehouse (south, barred)
    for (const s of [-1, 1]) {
      box(A, 'stoneWall', s * 4.2, 4.5, HALF, 3.4, 9, 4, { worldUV: 2.5 });
      mesh(A, 'roof', new THREE.ConeGeometry(2.6, 3, 4), trs(s * 4.2, 10.5, HALF, Math.PI / 4), { shade: null });
    }
    box(A, 'stoneWall', 0, 7.2, HALF, 5, 3.6, 4, { worldUV: 2.5, collide: false });
    // closed wooden gate behind an iron portcullis
    box(A, 'woodDark', 0, 2.7, HALF + 0.9, 5, 5.4, 0.3, { tex: 2.7 });
    const bars = boxGeo(0.12, 5.4, 0.12, 2);
    for (let x = -2.3; x <= 2.31; x += 0.46) mesh(A, 'iron', bars, trs(x, 2.7, HALF - 1.2), { shade: null });
    const hbar = boxGeo(5, 0.14, 0.14, 2);
    for (const y of [1.0, 2.6, 4.2]) mesh(A, 'iron', hbar, trs(0, y, HALF - 1.2), { shade: null });
    A.collision.addCentered(0, 2.7, HALF - 1.2, 5, 5.4, 0.4);
    wallTorch(A, -3.1, 3.2, HALF - 2.0, Math.PI);
    wallTorch(A, 3.1, 3.2, HALF - 2.0, Math.PI);

    // ---------------------------------------------------------- portal (north)
    this.portalOut = portal(A, { x: 0, z: -19.6, yaw: 0, target: 'dungeon', color: 'green', label: 'Descend into the Catacombs' });
    postTorch(A, -3.4, -17.2);
    postTorch(A, 3.4, -17.2);
    // standing stones flanking the approach
    for (const s of [-1, 1]) for (const zz of [-14, -11]) {
      mesh(A, 'stoneDark', boxGeo(0.7, 1.8, 0.5, 1), trs(s * 3.3, 0.8, zz, [0.05 * s, 0.2 * s, 0.06]));
      A.collision.addCentered(s * 3.3, 0.9, zz, 0.7, 1.8, 0.6, 'prop');
    }

    // ---------------------------------------------------------- houses
    const H = [
      { x: -15, z: -13, w: 8, d: 6, door: 's', windows: [['s', 2.5], ['s', -2.6], ['e', 0]] },
      { x: 15, z: -13, w: 7, d: 7, door: 's', h: 4.4, windows: [['s', -2.2], ['w', 0.5]] },
      { x: -15, z: 6, w: 7, d: 8, door: 'e', windows: [['e', 2.6], ['e', -2.6], ['n', 0]] },
      { x: 15.5, z: 8, w: 8, d: 6, door: 'w', h: 3.8, windows: [['w', -1.8], ['n', 1.5]] },
      { x: -12, z: 17.5, w: 6, d: 5, door: 'e', h: 3.6, windows: [['n', 0]] },
      { x: 12.5, z: 17.5, w: 6, d: 5, door: 'w', h: 3.6, chimney: false, windows: [['n', -1]] },
    ];
    for (const h of H) {
      const door = house(A, h);
      // torch beside every door
      const side = door.nz !== 0 ? [1.1, 0] : [0, 1.1];
      wallTorch(A, door.x + side[0] - door.nx * 0.02, 2.4, door.z + side[1] - door.nz * 0.02, Math.atan2(door.nx, door.nz));
    }

    // ---------------------------------------------------------- square
    well(A, 0, 0);
    for (const [x, z] of [[-9.5, -8.5], [9.5, -8.5], [-9.5, 8.5], [9.5, 8.5]]) postTorch(A, x, z);
    // wall torches along the inner walls
    for (const t of [-12, 12]) {
      wallTorch(A, t, 3.4, -HALF + 1.0, 0);
      wallTorch(A, -HALF + 1.0, 3.4, t, Math.PI / 2);
      wallTorch(A, HALF - 1.0, 3.4, t, -Math.PI / 2);
    }
    // clutter
    barrel(A, -10.6, -9.5); barrel(A, -11.4, -9.0); barrel(A, -10.9, -8.2, 0, 0.5);
    crate(A, -18.2, -9.2); crate(A, -18.3, -9.2, 0.9, 0.7, 0.4); crate(A, -17.1, -9.4, 0, 0.8, 0.2);
    barrel(A, 11.2, -9.3); crate(A, 12.3, -9.6, 0, 0.9, 0.3);
    barrel(A, 10.9, 4.2); barrel(A, 11.6, 4.8); crate(A, 10.6, 5.3, 0, 0.8, 0.6);
    cart(A, -6.5, 12.5, 0.4);
    crate(A, 7.8, 13.2); crate(A, 8.6, 13.4, 0, 0.7, 0.5); barrel(A, 8.2, 14.4);
    // a market stall: posts + sagging cloth roof
    for (const [x, z] of [[-6, -6.4], [-3, -6.4], [-6, -4.4], [-3, -4.4]]) box(A, 'beam', x, 1.15, z, 0.14, 2.3, 0.14, { tag: 'prop' });
    box(A, 'clothBrown', -4.5, 2.32, -5.4, 3.4, 0.06, 2.4, { collide: false, shade: null, rot: [0.12, 0, 0] });
    box(A, 'woodDark', -4.5, 0.85, -6.1, 3.0, 0.12, 0.8, { collide: false });
    box(A, 'woodDark', -4.5, 0.42, -6.1, 3.0, 0.84, 0.1, {});
    crate(A, -5.4, -6.1, 0.91, 0.45, 0.3); barrel(A, -3.6, -6.0, 0.91, 0);

    // graveyard corner (east)
    const rnd = (() => { let s = 99; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    for (let i = 0; i < 9; i++) {
      gravestone(A, 16.5 + (i % 3) * 1.8 + rnd() * 0.4, -4.5 + Math.floor(i / 3) * 2.2 + rnd() * 0.3, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.35);
    }
    deadTree(A, 20.2, 1.5, 5);
    deadTree(A, -19.5, 13.5, 11);
    // low fence around graveyard
    for (let z = -6; z <= 3; z += 1.5) box(A, 'beam', 14.6, 0.5, z, 0.1, 1.0, 0.1, { tag: 'prop' });
    box(A, 'beam', 14.6, 0.8, -1.5, 0.08, 0.08, 9, { collide: false, shade: null });

    // ---------------------------------------------------------- NPC placeholders
    this.npcDefs = [
      { id: 'smith', name: 'The Smith', role: 'blacksmith', x: -9.8, z: -7.3, yaw: 0.6, variant: 'hunched', cloth: 'clothBrown' },
      { id: 'pilgrim', name: 'Weary Pilgrim', role: 'quest', x: 3.0, z: 2.6, yaw: -2.2, variant: 'staff' },
      { id: 'widow', name: 'Grieving Widow', role: 'story', x: 14.0, z: -1.2, yaw: 1.6, cloth: 'clothRed' },
      { id: 'warden', name: 'Gate Warden', role: 'guard', x: 3.6, z: 19.6, yaw: Math.PI, scale: 1.15 },
      { id: 'merchant', name: 'Hooded Merchant', role: 'merchant', x: -4.5, z: -3.6, yaw: Math.PI },
      { id: 'beggar', name: 'Mad Beggar', role: 'lore', x: -2.4, z: -12.4, yaw: 0.4, variant: 'hunched', cloth: 'cloth', scale: 0.9 },
    ];
    for (const d of this.npcDefs) npc(A, d);

    // ---------------------------------------------------------- distant hills (silhouettes)
    this.mountainMat = basicMaterial(0x3c3c3a, { fog: false });
    const hills = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rnd() * 0.2;
      const r = 95 + rnd() * 25, h = 14 + rnd() * 22;
      const c = new THREE.Mesh(new THREE.ConeGeometry(18 + rnd() * 14, h, 5), this.mountainMat);
      c.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
      c.rotation.y = rnd() * 3;
      hills.add(c);
    }
    this.scene.add(hills);

    this.spawns.portal = { pos: new THREE.Vector3(0, 0, -15.5), yaw: Math.PI };
    this.spawns.respawn = { pos: new THREE.Vector3(0, 0, 4.5), yaw: 0 };
    this.spawns.start = { pos: new THREE.Vector3(0, 0, 14), yaw: 0 };

    this.finish();
  }

  /** Apply DAY / NIGHT lighting. */
  applyPhase(phase) {
    if (this.phase === phase) return;
    this.phase = phase;
    const p = PHASES[phase];
    this.scene.fog.color.set(p.fog);
    this.scene.fog.near = p.near; this.scene.fog.far = p.far;
    this.scene.background = new THREE.Color(p.fog);
    this.sky.setPalette(p.sky);
    this.hemi.color.set(p.hemiSky); this.hemi.groundColor.set(p.hemiGround); this.hemi.intensity = p.hemi;
    this.sun.color.set(p.sun); this.sun.intensity = p.sunI; this.sun.position.set(...p.sunPos);
    this.lights.scale = p.torch;
    this.lanternIntensity = p.lantern;
    this.windowMat.color.set(p.window);
    this.mountainMat.color.set(p.mountains);
    this.dustColor = p.dust;
  }

  onEnter() {
    this.applyPhase(this.game.clock.phase);
  }

  update(dt, player) {
    super.update(dt, player);
    this.sky.update(dt, this.game.camera);
  }
}
