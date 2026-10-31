// TOWN - walled safe hub. No enemies. Lighting follows the world clock phase
// (which only advances while the player is in the dungeon).
import * as THREE from '../../lib/three.module.min.js';
import { Area } from './area.js';
import { Sky } from './sky.js';
import { basicMaterial, litMaterial } from '../engine/materials.js';
import { boxGeo, trs } from '../engine/geometry.js';
import {
  box, mesh, wallTorch, postTorch, portal, house, barrel, crate, cart, well,
  gravestone, deadTree, npc, groundAO, fire, hollowHouse, interactable, hero, bonfire, anvil, trainingDummy,
} from './props.js';

const HALF = 34;     // wall centre line
const WALL_H = 6.5;
const WALL_T = 2;

export const PHASES = {
  day: {
    fog: 0x6a6862, near: 8, far: 70,
    sky: { top: 0x545a62, horizon: 0x76746c, bottom: 0x3a3832, clouds: 0x9a978e, cloudOpacity: 0.85, stars: false, orbColor: 0xb0aaa0, orbOpacity: 0.3, moon: false },
    hemiSky: 0xa0a8b0, hemiGround: 0x40362a, hemi: 1.7,
    sun: 0xd8d0c0, sunI: 1.5, sunPos: [-40, 70, 30],
    torch: 0.3, lantern: 0.7, window: 0x161210, mountains: 0x3c3c3a, dust: [0.5, 0.48, 0.44],
  },
  night: {
    fog: 0x07090e, near: 2, far: 30,
    sky: { top: 0x010205, horizon: 0x0a0d15, bottom: 0x040506, clouds: 0x161a22, cloudOpacity: 0.7, stars: true, orbColor: 0x6a7a9a, orbOpacity: 0.5, moon: true },
    hemiSky: 0x2a3550, hemiGround: 0x080706, hemi: 0.5,
    sun: 0x7080a8, sunI: 0.28, sunPos: [-60, 90, -90],
    torch: 1.0, lantern: 4.2, window: 0xb85a1c, mountains: 0x05060a, dust: [0.3, 0.3, 0.34],
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
    this.interiors = [];
    this.mapBounds = { x0: -HALF - 3, z0: -HALF - 3, x1: HALF + 3, z1: HALF + 3 };
    const rnd = (() => { let s = 99; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

    // ---------------------------------------------------------- ground
    box(A, 'dirt', 0, -0.5, 0, 200, 1, 200, { worldUV: 2.5, shade: null });
    const cob = { worldUV: 2, shade: null };
    box(A, 'cobble', 0, 0.02, 3, 24, 0.04, 22, cob);                 // square
    box(A, 'cobble', 0, 0.02, 24, 5, 0.04, 20, cob);                 // to the gate
    box(A, 'cobble', 0, 0.02, -15, 5, 0.04, 16, cob);                // to the portals
    box(A, 'cobble', 0, 0.02, -26, 20, 0.04, 6, cob);                // portal plaza
    box(A, 'cobbleDark', -11.5, 0.02, -12, 3, 0.04, 4, cob);         // market doorstep
    box(A, 'cobbleDark', 11.5, 0.02, -12, 3, 0.04, 4, cob);          // hall doorstep
    box(A, 'cobbleDark', -20, 0.02, 4, 16, 0.04, 3.5, cob);          // west street
    box(A, 'cobbleDark', 20, 0.02, 6, 16, 0.04, 3.5, cob);           // east street
    box(A, 'mud', -9, 0.01, 19, 7, 0.02, 5, cob);
    box(A, 'dirtMoss', 27.5, 0.01, -3, 9, 0.02, 10, cob);
    box(A, 'mud', -9, 0.01, -22, 8, 0.02, 6, cob);

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
    const merlon = (x, z, alongX) => box(A, wallMat, x, WALL_H + 0.45, z, alongX ? 1.1 : 0.5, 0.9, alongX ? 0.5 : 1.1, { collide: false, shade: null, worldUV: 2.5 });
    for (let t = -HALF + 1; t <= HALF - 1; t += 2) {
      for (const e of [-0.75, 0.75]) {
        merlon(t, -HALF + e, true);
        merlon(-HALF + e, t, false);
        merlon(HALF + e, t, false);
        if (Math.abs(t) > gateHalf + 2) merlon(t, HALF + e, true);
      }
    }
    for (let t = -27; t <= 27; t += 9) {
      if (Math.abs(t) > 4) box(A, 'stoneDark', t, 1.6, -HALF + 1.3, 1.2, 3.2, 0.7, { worldUV: 2 });
      box(A, 'stoneDark', -HALF + 1.3, 1.6, t, 0.7, 3.2, 1.2, { worldUV: 2 });
      box(A, 'stoneDark', HALF - 1.3, 1.6, t, 0.7, 3.2, 1.2, { worldUV: 2 });
    }
    for (const [cx, cz] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) {
      mesh(A, 'stoneWall', new THREE.CylinderGeometry(3, 3.3, 10, 8), trs(cx, 5, cz), { worldUV: 2.5 });
      A.collision.addCentered(cx, 5, cz, 6, 10, 6);
      mesh(A, 'roof', new THREE.ConeGeometry(3.7, 4, 8), trs(cx, 12, cz), { shade: null });
      box(A, 'beam', cx, 10.1, cz, 7.2, 0.25, 7.2, { collide: false, shade: null });
    }
    // gatehouse (south, barred)
    for (const s of [-1, 1]) {
      box(A, 'stoneWall', s * 4.2, 4.5, HALF, 3.4, 9, 4, { worldUV: 2.5 });
      mesh(A, 'roof', new THREE.ConeGeometry(2.6, 3, 4), trs(s * 4.2, 10.5, HALF, Math.PI / 4), { shade: null });
    }
    box(A, 'stoneWall', 0, 7.2, HALF, 5, 3.6, 4, { worldUV: 2.5, collide: false });
    box(A, 'woodDark', 0, 2.7, HALF + 0.9, 5, 5.4, 0.3, { tex: 2.7 });
    const bars = boxGeo(0.12, 5.4, 0.12, 2);
    for (let x = -2.3; x <= 2.31; x += 0.46) mesh(A, 'iron', bars, trs(x, 2.7, HALF - 1.2), { shade: null });
    const hbar = boxGeo(5, 0.14, 0.14, 2);
    for (const y of [1.0, 2.6, 4.2]) mesh(A, 'iron', hbar, trs(0, y, HALF - 1.2), { shade: null });
    A.collision.addCentered(0, 2.7, HALF - 1.2, 5, 5.4, 0.4);
    wallTorch(A, -3.1, 3.2, HALF - 2.0, Math.PI);
    wallTorch(A, 3.1, 3.2, HALF - 2.0, Math.PI);

    // ---------------------------------------------------------- portals (north plaza)
    this.portalOut = portal(A, { x: -7, z: -30.4, yaw: 0, target: 'dungeon', color: 'green', label: 'The Sunken Catacombs' });
    this.portalDepths = portal(A, { x: 7, z: -30.4, yaw: 0, target: 'depths', color: 'red', label: 'The Shifting Depths (changes every visit)' });
    for (const x of [-11, -3, 3, 11]) postTorch(A, x, -27.5);
    for (const s of [-1, 1]) for (const zz of [-21, -17]) {
      mesh(A, 'stoneDark', boxGeo(0.7, 1.8, 0.5, 1), trs(s * 3.3, 0.8, zz, [0.05 * s, 0.2 * s, 0.06]));
      A.collision.addCentered(s * 3.3, 0.9, zz, 0.7, 1.8, 0.6, 'prop');
    }

    // ---------------------------------------------------------- the Ashen Market (enterable)
    const market = hollowHouse(A, {
      x: -16, z: -12, w: 10, d: 8, h: 4.4, door: 'e', sign: 'MARKET',
      furnish: (a, r) => {
        box(a, 'woodDark', -16.6, 0.5, -12, 0.8, 1.0, 4.6, { tex: 1 });
        box(a, 'beam', -16.6, 1.04, -12, 1.0, 0.08, 4.9, { collide: false, shade: null });
        for (const zz of [-15, -9]) box(a, 'woodDark', -20.3, 1.3, zz, 0.5, 2.6, 1.8, { tex: 1 });
        for (let i = 0; i < 4; i++) box(a, 'beam', -20.25, 0.6 + i * 0.6, -12, 0.55, 0.06, 4.6, { collide: false, shade: null });
        barrel(a, -19.8, -14.9, 0); barrel(a, -19.8, -9.1, 0); crate(a, -13, -15, 0, 0.8); crate(a, -13, -15, 0.8, 0.6, 0.4);
        mesh(a, 'iron', boxGeo(0.4, 0.5, 0.06, 0.5), trs(-16.6, 1.35, -13.2, 0.3), { shade: null });
        mesh(a, 'bone', boxGeo(0.25, 0.25, 0.25, 0.5), trs(-16.6, 1.2, -10.8, 0.6), { shade: null });
        box(a, 'stoneDark', -20.3, 0.5, -10.9, 0.7, 1.0, 1.0, { tex: 1 });
        fire(a, -20.1, 0.9, -10.9, { size: 0.45, intensity: 7, range: 8, embers: 2 });
        npc(a, { id: 'merchant', name: 'Hooded Merchant', role: 'merchant', x: -18.2, z: -12, yaw: Math.PI / 2, cloth: 'clothBrown' });
      },
    });
    this.interiors.push(market);
    interactable(A, new THREE.Vector3(-15.8, 0, -12), 2.4, 'Trade at the Ashen Market', () => this.game.openScreen('shop'));

    // ---------------------------------------------------------- the Hall of Paths (skill trainer, enterable)
    const hall = hollowHouse(A, {
      x: 16, z: -12, w: 10, d: 8, h: 4.8, door: 'w', sign: 'HALL OF PATHS',
      furnish: (a) => {
        const paths = [['cloth', 0xd0d8ff, -14.5], ['clothRed', 0xff7a30, -12], ['dirtMoss', 0x9ad070, -9.5]];
        for (const [tex, col, zz] of paths) {
          box(a, tex, 20.6, 2.4, zz, 0.06, 2.2, 1.1, { collide: false, shade: () => 0.85 });
          box(a, 'stoneDark', 19.8, 0.45, zz, 0.6, 0.9, 0.6, { tex: 1 });
          fire(a, 19.8, 0.95, zz, { size: 0.4, intensity: 5, range: 7, color: col, embers: 2 });
        }
        trainingDummy(a, 13.5, -15.2, 0.4);
        box(a, 'beam', 12.2, 1.0, -8.6, 2.2, 0.1, 0.4, { collide: false, shade: null });
        for (let i = 0; i < 4; i++) mesh(a, 'iron', boxGeo(0.05, 1.3, 0.02, 0.5), trs(11.6 + i * 0.4, 0.9, -8.5, [0.15, 0, 0]), { shade: null });
        npc(a, { id: 'master', name: 'The Old Master', role: 'trainer', x: 18.3, z: -12, yaw: -Math.PI / 2, variant: 'staff', cloth: 'cloth', scale: 1.05 });
      },
    });
    this.interiors.push(hall);
    interactable(A, new THREE.Vector3(16.6, 0, -12), 2.5, 'Study with the Old Master (skills)', () => this.game.openScreen('trainer'));

    // ---------------------------------------------------------- houses
    const H = [
      { x: -25, z: -24, w: 8, d: 6, door: 's', windows: [['s', 2.5], ['s', -2.6]] },
      { x: 25, z: -24, w: 7, d: 7, door: 's', h: 4.4, windows: [['s', -2.2], ['w', 0.5]] },
      { x: -27, z: 9, w: 7, d: 8, door: 'e', windows: [['e', 2.6], ['n', 0]] },
      { x: 27, z: 11, w: 8, d: 6, door: 'w', h: 3.8, windows: [['w', -1.8], ['n', 1.5]] },
      { x: -22, z: 23, w: 8, d: 6, door: 'e', windows: [['n', 1.5], ['e', -1.6]] },
      { x: 22, z: 24, w: 7, d: 6, door: 'w', h: 3.6, chimney: false, windows: [['n', -1]] },
      { x: -9, z: 28, w: 6, d: 5, door: 'n', h: 3.6, windows: [['n', 1.8]] },
      { x: 11, z: 28, w: 6, d: 5, door: 'n', h: 3.6, windows: [['n', -1.8]] },
      { x: -28.5, z: -8, w: 5, d: 7, door: 'e', h: 3.6, windows: [['e', 2]] },
      { x: 28.5, z: -13, w: 5, d: 6, door: 'w', h: 3.6, chimney: false, windows: [] },
    ];
    for (const h of H) {
      const door = house(A, h);
      const side = door.nz !== 0 ? [1.1, 0] : [0, 1.1];
      wallTorch(A, door.x + side[0] - door.nx * 0.02, 2.4, door.z + side[1] - door.nz * 0.02, Math.atan2(door.nx, door.nz));
    }

    // ---------------------------------------------------------- square + bonfire
    well(A, 0, 3);
    for (const [x, z] of [[-12, -8], [12, -8], [-12, 14], [12, 14]]) postTorch(A, x, z);
    for (const t of [-20, 0, 20]) {
      if (t !== 0) wallTorch(A, t, 3.4, -HALF + 1.0, 0);
      wallTorch(A, -HALF + 1.0, 3.4, t, Math.PI / 2);
      wallTorch(A, HALF - 1.0, 3.4, t, -Math.PI / 2);
    }
    bonfire(A, -5, 8);

    // ---------------------------------------------------------- smithy (outdoor)
    box(A, 'stoneDark', -9, 0.6, -24.5, 2.4, 1.2, 1.6, { worldUV: 1 });
    fire(A, -9, 1.25, -24.5, { size: 0.6, intensity: 10, range: 10, embers: 5 });
    box(A, 'stoneDark', -9, 3.2, -24.8, 0.9, 4, 0.9, { worldUV: 1.2, collide: false });
    anvil(A, -7, -22.5, 0.3);
    for (const [x, z] of [[-11.5, -21], [-12, -24]]) box(A, 'beam', x, 1.3, z, 0.18, 2.6, 0.18, { tag: 'prop' });
    box(A, 'roof', -11.8, 2.65, -22.5, 0.6, 0.08, 4, { collide: false, shade: null });
    barrel(A, -12.5, -19.5); crate(A, -6, -20, 0, 0.8, 0.3);

    // training ground beside the Hall
    for (const [x, z] of [[9.5, -20], [12.5, -21], [15.5, -20]]) trainingDummy(A, x, z, rnd());

    // clutter
    barrel(A, -10.6, -6.5); barrel(A, -11.4, -6.0); crate(A, -10.4, -5.2, 0, 0.8, 0.4);
    barrel(A, 11.2, -6.3); crate(A, 10.4, -5.6, 0, 0.9, 0.3);
    barrel(A, 10.9, 12.2); barrel(A, 11.6, 12.8); crate(A, 10.6, 11.3, 0, 0.8, 0.6);
    cart(A, -8, 17, 0.4);
    crate(A, 8, 18.2); crate(A, 8.8, 18.4, 0, 0.7, 0.5); barrel(A, 8.4, 19.4);
    // market stall in the square
    for (const [x, z] of [[4, -5.4], [7, -5.4], [4, -3.4], [7, -3.4]]) box(A, 'beam', x, 1.15, z, 0.14, 2.3, 0.14, { tag: 'prop' });
    box(A, 'clothBrown', 5.5, 2.32, -4.4, 3.4, 0.06, 2.4, { collide: false, shade: null, rot: [0.12, 0, 0] });
    box(A, 'woodDark', 5.5, 0.42, -5.1, 3.0, 0.84, 0.1, {});
    box(A, 'woodDark', 5.5, 0.85, -5.1, 3.0, 0.12, 0.8, { collide: false });

    // graveyard corner (east)
    for (let i = 0; i < 12; i++) {
      gravestone(A, 24.5 + (i % 4) * 1.8 + rnd() * 0.4, -7 + Math.floor(i / 4) * 2.2 + rnd() * 0.3, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.35);
    }
    for (let z = -9; z <= 2; z += 1.5) box(A, 'beam', 22.6, 0.5, z, 0.1, 1.0, 0.1, { tag: 'prop' });
    box(A, 'beam', 22.6, 0.8, -3.5, 0.08, 0.08, 11, { collide: false, shade: null });
    deadTree(A, 30.2, 1.5, 5);
    deadTree(A, -30, 16.5, 11);
    deadTree(A, -18, -30, 23);

    // ---------------------------------------------------------- townsfolk + heroes
    this.npcDefs = [
      { id: 'widow', name: 'Grieving Widow', role: 'story', x: 23.5, z: -2.2, yaw: 1.6, cloth: 'clothRed' },
      { id: 'warden', name: 'Gate Warden', role: 'guard', x: 3.6, z: 30.4, yaw: Math.PI, scale: 1.15 },
      { id: 'beggar', name: 'Mad Beggar', role: 'lore', x: -2.4, z: -17.4, yaw: 0.4, variant: 'hunched', cloth: 'cloth', scale: 0.9 },
      { id: 'smith', name: 'The Smith', role: 'blacksmith', x: -7.6, z: -21.2, yaw: 2.6, variant: 'hunched', cloth: 'clothBrown' },
    ];
    for (const d of this.npcDefs) npc(A, d);
    const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
    this.heroDefs = [
      { name: 'Ser Aldric', look: 'knight', x: -3.2, z: -24.5, yaw: 0.2 },
      { name: 'Ysolde of the Pale', look: 'sorceress', x: -7, z: 8.3, pose: 'sit', yaw: face(-7, 8.3, -5, 8) },
      { name: 'Brann the Kindled', look: 'pyromancer', x: -3.1, z: 8.5, pose: 'sit', yaw: face(-3.1, 8.5, -5, 8) },
      { name: 'Wren', look: 'hunter', x: -9.6, z: -15.2, pose: 'lean', yaw: Math.PI / 2 },
      { name: 'Brother Hale', look: 'paladin', x: -10, z: -6, path: [[-10, -6], [10, -6], [10, 12], [-10, 12]] },
      { name: 'Kestrel', look: 'sellsword', x: -4, z: 24, path: [[-4, 24], [4, 24], [4, 30], [-4, 30]] },
      { name: 'Dame Orsa', look: 'knight', x: 9.6, z: -14.6, pose: 'lean', yaw: -Math.PI / 2 },
    ];
    for (const d of this.heroDefs) hero(A, d);

    // ---------------------------------------------------------- distant hills
    this.mountainMat = basicMaterial(0x3c3c3a, { fog: false });
    const hills = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rnd() * 0.2;
      const r = 110 + rnd() * 25, h = 16 + rnd() * 24;
      const c = new THREE.Mesh(new THREE.ConeGeometry(20 + rnd() * 14, h, 5), this.mountainMat);
      c.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
      c.rotation.y = rnd() * 3;
      hills.add(c);
    }
    this.scene.add(hills);

    this.spawns.portal = { pos: new THREE.Vector3(-7, 0, -26.5), yaw: Math.PI };
    this.spawns.portal_depths = { pos: new THREE.Vector3(7, 0, -26.5), yaw: Math.PI };
    this.spawns.respawn = { pos: new THREE.Vector3(-5, 0, 11.5), yaw: 0 };
    this.spawns.start = { pos: new THREE.Vector3(0, 0, 26), yaw: 0 };

    this.finish();
  }

  /** 0 outdoors .. 1 deep inside a building (dims sky light indoors). */
  indoorFactor(p) {
    for (const r of this.interiors) {
      if (p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1) {
        const edge = Math.min(p.x - r.x0, r.x1 - p.x, p.z - r.z0, r.z1 - p.z);
        return Math.min(1, edge / 1.5);
      }
    }
    return 0;
  }

  /** Apply DAY / NIGHT lighting. */
  applyPhase(phase) {
    if (this.phase === phase) return;
    this.phase = phase;
    const p = PHASES[phase];
    this.scene.fog.color.set(p.fog);
    this.scene.fog.near = p.near; this.scene.fog.far = p.far + (phase === 'day' ? 10 : 6);
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

  weaponLighting() { return this.phase === 'day' ? [1.6, 0.1] : [0.5, 2.2]; }

  onEnter() {
    this.applyPhase(this.game.townPhase());
  }

  update(dt, player) {
    if (this.game.townPhase() !== this.phase) this.applyPhase(this.game.townPhase());
    super.update(dt, player);
    this.sky.update(dt, this.game.camera);
    // dim sky/sun light when indoors so interiors read as interiors
    const p = PHASES[this.phase];
    const k = 1 - this.indoorFactor(player.pos) * 0.75;
    this._indoor = this._indoor === undefined ? k : this._indoor + (k - this._indoor) * Math.min(1, dt * 4);
    this.hemi.intensity = p.hemi * this._indoor;
    this.sun.intensity = p.sunI * this._indoor;
    this.lights.scale = p.torch + (1 - this._indoor) * (1 - p.torch);
  }
}
