// THE KING'S CASTLE - non-hostile, reached through the gate at the north end
// of town. Built on the dungeon cell builder (merged geometry, minimap rooms)
// from a room list. Guards hold doorways open only for those of enough Renown:
//   Wanderer  -> courtyard (enter the castle at all)
//   Sellsword -> great hall and its wings
//   Champion  -> throne room
//   King's Blade -> an audience with the King
import * as THREE from '../../lib/three.module.min.js';
import { Dungeon, CELL } from './dungeon.js';
import { RANKS } from '../systems/renown.js';
import { box, mesh, portal, hero, npc, interactable, brazier, fire, chest } from './props.js';
import { boxGeo, trs } from '../engine/geometry.js';
import { litMaterial, basicMaterial } from '../engine/materials.js';
import { Sky } from './sky.js';
import { PHASES } from './town.js';
import { KING_LINES, NPC_LINES, pick } from '../../data/lore.js';

const W = 40, H = 34;
// [char, col, row, w, h, name]  levels: T/u = up one storey, d/D = down one
const ROOMS = [
  ['h', 3, 2, 7, 6, 'Chapel'], ['T', 15, 2, 10, 6, 'Throne Room'], ['d', 30, 2, 7, 6, 'Dungeon Cells'],
  ['l', 3, 10, 5, 5, 'Library'], ['H', 13, 9, 14, 8, 'Great Hall'], ['a', 32, 10, 5, 5, 'Armory'],
  ['c', 10, 19, 20, 9, 'Courtyard'], ['b', 2, 21, 6, 6, 'Barracks'], ['k', 32, 21, 6, 6, 'Kitchen'],
  ['u', 10, 29, 3, 3, 'West Tower'], ['u', 27, 29, 3, 3, 'East Tower'],
];
const CORRIDORS = [
  ['.', 5, 8, 1, 2], ['.', 8, 12, 5, 1], ['.', 27, 12, 5, 1], ['D', 34, 8, 1, 1],
  ['.', 19, 17, 2, 2], ['.', 8, 23, 2, 1], ['.', 30, 23, 2, 1],
];
const STAIRS = [['v', 19, 8], ['v', 20, 8], ['^', 34, 9], ['^', 11, 28], ['^', 28, 28]];
const LEVEL = { T: -1, u: -1, d: 1, D: 1 };
const DIRS = { v: [0, 1], '^': [0, -1], '>': [1, 0], '<': [-1, 0] };

function castleLayout() {
  const cells = [];
  for (let r = 0; r < H; r++) { cells.push([]); for (let c = 0; c < W; c++) cells[r].push({ type: 'wall' }); }
  const rects = [];
  ROOMS.forEach(([ch, x, y, w, h, name], i) => {
    rects.push({ x, y, w, h, name });
    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) {
      cells[r][c] = { type: 'floor', level: LEVEL[ch] || 0, hall: 'HTh'.includes(ch), sky: 'cu'.includes(ch), roomId: i, ch };
      // pillars in the tall rooms
      if ('HT'.includes(ch) && (r - y) % 3 === 1 && (c === x + 1 || c === x + w - 2)) cells[r][c].pillar = true;
    }
  });
  for (const [ch, x, y, w, h] of CORRIDORS) for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) cells[r][c] = { type: 'floor', level: LEVEL[ch] || 0, ch };
  for (const [ch, c, r] of STAIRS) {
    const dir = DIRS[ch];
    const hi = cells[r - dir[1]][c - dir[0]];
    cells[r][c] = { type: 'stair', dir, level: hi.level };
  }
  return { cells, rows: H, cols: W, roomRects: rects, spawns: [], braziers: [], decor: [], seed: 7 };
}

export const CASTLE_BIOME = {
  name: 'Castle', wall: 'stoneWall', hallWall: 'stoneWall', floor: 'flagstone', hallFloor: 'cobble', stair: 'stone', ceiling: 'ceiling', pillar: 'stoneWall',
  fog: 0x1c1a16, fogFar: 46, hemi: [0xa8a090, 0x3a3028, 1.9], lantern: 2.6, torch: 0xff9a48, torchRate: 3, dust: [0.5, 0.48, 0.44],
};

export class Castle extends Dungeon {
  constructor(game) {
    super(game, 'castle', 'The King\'s Castle');
    this.hostile = false;
    this.biome = CASTLE_BIOME;
    this.layout = castleLayout();
    this.cells = this.layout.cells;
    this.braziers = [];
    this.spawnList = [];
    this.noAutoPortal = true;
    this.guards = [];
  }

  cc(c, r) { return this.cellCenter(c, r); }

  build() {
    super.build();
    const A = this;
    this.sky = new Sky(this.scene);
    this.phase = null;
    // way back to town: gate on the courtyard's south wall
    const gp = this.cc(20, 27);
    portal(A, { x: gp.x, z: 28 * CELL - 0.9, y: 0, yaw: Math.PI, target: 'town', spawn: 'castle', color: 'blue', label: 'Return to Emberwick' });
    const sp = this.cc(20, 25);
    this.spawns.start = { pos: sp, yaw: 0 };
    this.spawns.portal = this.spawns.start;
    this.mapMarkers.push({ x: this.cc(20, 3).x, z: this.cc(20, 3).z, type: 'boss' });
  }

  /** Furnish every room (called by the dungeon builder instead of crypt decor). */
  decorate() {
    const A = this;
    const at = (c, r) => this.cc(c, r);
    const banner = (x, y, z, rot, tex = 'clothRed') => box(A, tex, x, y, z, rot ? 0.05 : 1.2, 2.6, rot ? 1.2 : 0.05, { collide: false, shade: () => 0.85 });

    // ---- courtyard: well-kept yard, braziers, training posts, patrols
    for (const [c, r] of [[11, 20], [28, 20], [11, 26], [28, 26]]) { const p = at(c, r); brazier(A, p.x, 0, p.z); }
    for (const [c, r] of [[14, 22], [25, 22]]) { const p = at(c, r); box(A, 'beam', p.x, 0.9, p.z, 0.2, 1.8, 0.2, { tag: 'prop' }); mesh(A, 'clothBrown', new THREE.CylinderGeometry(0.28, 0.3, 0.75, 6), trs(p.x, 1.2, p.z)); }
    { const p = at(20, 23); box(A, 'stoneDark', p.x, 0.5, p.z, 2.4, 1.0, 2.4, { worldUV: 1 }); mesh(A, 'stoneWall', new THREE.CylinderGeometry(0.4, 0.5, 2.4, 8), trs(p.x, 2.2, p.z)); }
    // ---- great hall: long tables, benches, chandelier fires
    for (const c of [16, 23]) for (const r of [10, 13]) {
      const p = at(c, r);
      box(A, 'woodDark', p.x, 0.8, p.z + CELL / 2, 1.2, 0.12, 5.5, { collide: false });
      box(A, 'woodDark', p.x, 0.4, p.z + CELL / 2, 1.0, 0.8, 5.0, { tex: 1 });
      for (const s of [-1, 1]) box(A, 'beam', p.x + s * 1.0, 0.25, p.z + CELL / 2, 0.35, 0.5, 5, { tag: 'prop' });
    }
    for (const [c, r] of [[17, 12], [22, 12]]) { const p = at(c, r); fire(A, p.x, 6.4, p.z, { size: 0.6, intensity: 12, range: 16 }); box(A, 'ironDark', p.x, 6.2, p.z, 1.4, 0.1, 1.4, { collide: false, shade: null }); }
    for (const c of [14, 18, 22, 26]) banner(at(c, 9).x, 3.4, 9 * CELL + 0.05, false);
    // ---- throne room: carpet, throne, the King, his guard
    const tp = at(20, 3);
    for (let r = 3; r <= 7; r++) { const p = at(19, r); box(A, 'clothRed', p.x + CELL / 2, p.y + 0.02, p.z, 2.2, 0.04, CELL, { collide: false, shade: null }); }
    box(A, 'stoneWall', tp.x, tp.y + 0.4, tp.z - 0.6, 4, 0.8, 2.2, { worldUV: 1.5 });
    box(A, 'woodDark', tp.x, tp.y + 1.6, tp.z - 1.3, 1.4, 2.4, 0.4, { tex: 1 });
    box(A, 'clothRed', tp.x, tp.y + 1.1, tp.z - 0.8, 1.2, 0.2, 1.0, { collide: false, shade: null });
    for (const c of [16, 24]) banner(at(c, 2).x, tp.y + 3.4, 2 * CELL + 0.05, false);
    fire(A, tp.x - 2.6, tp.y + 1.4, tp.z - 0.5, { size: 0.5 }); fire(A, tp.x + 2.6, tp.y + 1.4, tp.z - 0.5, { size: 0.5 });
    this.king = hero(A, { name: 'King Aldric', look: 'king', x: tp.x, z: tp.z - 0.7, y: tp.y + 0.8, pose: 'sit', yaw: 0, talk: false });
    this.king.position.y = tp.y + 0.8;
    interactable(A, new THREE.Vector3(tp.x, tp.y, tp.z + 1.4), 2.6, 'Seek an audience with the King', () => this.audience());
    // ---- library: bookshelves with lore
    for (const r of [10, 12, 14]) { const p = at(3, r); box(A, 'woodDark', p.x - 0.7, 1.4, p.z, 0.5, 2.8, 2.2, { tex: 1 }); for (let i = 0; i < 4; i++) box(A, 'clothRed', p.x - 0.42, 0.5 + i * 0.6, p.z, 0.04, 0.4, 2.0, { collide: false, shade: () => 0.6 }); }
    { const p = at(6, 12); box(A, 'woodDark', p.x, 0.75, p.z, 1.6, 0.1, 1.0, { collide: false }); box(A, 'woodDark', p.x, 0.35, p.z, 1.4, 0.7, 0.8, { tex: 1 }); fire(A, p.x, 0.95, p.z, { size: 0.25, intensity: 4, range: 6, embers: 1 }); }
    interactable(A, at(4, 12), 2.2, 'Read the chronicles', () => this.game.journal.readFor('castle'));
    // a book on the red moon, its last page torn out
    interactable(A, at(6, 14), 1.8, 'Read: "On the Red Moon"', () => this.game.journal.add('n33'));
    // the great mirror: the King has no reflection
    { const p = at(25, 12); box(A, 'woodDark', p.x + 1.0, 1.6, p.z, 0.15, 2.8, 1.6, { tex: 1 });
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.4), new THREE.MeshLambertMaterial({ color: 0x8a9aa8, emissive: 0x101418 }));
      glass.position.set(p.x + 0.92, 1.6, p.z); glass.rotation.y = -Math.PI / 2; this.scene.add(glass);
      interactable(A, p, 2.2, 'Look into the great mirror', () => {
        this.game.journal.add('n35');
        setTimeout(() => this.game.area === this && this.game.hud.speak('In the glass: the hall, the guards, the candles, the fire. The King passes behind you. In the glass, there is no one.', 7), 3500);
      }); }
    npc(A, { name: 'Castle Servant', x: at(24, 14).x, z: at(24, 14).z, cloth: 'cloth', variant: 'hunched', lines: NPC_LINES.servant, note: 'n34' });
    // ---- armory
    for (const r of [10, 14]) { const p = at(34, r); box(A, 'beam', p.x, 1.0, p.z + (r === 10 ? -0.9 : 0.9), 3, 0.12, 0.3, { collide: false, shade: null }); for (let i = 0; i < 6; i++) mesh(A, 'iron', boxGeo(0.06, 1.5, 0.03, 0.5), trs(p.x - 1.2 + i * 0.5, 1.0, p.z + (r === 10 ? -0.95 : 0.95), [0.1, 0, 0]), { shade: null }); }
    for (const c of [33, 36]) { const p = at(c, 12); box(A, 'ironPlate', p.x, 1.2, p.z, 0.6, 0.8, 0.4, { tag: 'prop' }); box(A, 'beam', p.x, 0.4, p.z, 0.1, 0.8, 0.1, { collide: false }); mesh(A, 'iron', boxGeo(0.32, 0.36, 0.34, 0.5), trs(p.x, 1.8, p.z)); }
    // ---- chapel: pews, altar, candles
    for (let r = 4; r <= 7; r++) for (const c of [4, 7]) { const p = at(c, r); box(A, 'woodDark', p.x + 0.4, 0.3, p.z, 2.2, 0.6, 0.5, { tex: 1 }); }
    { const p = at(6, 2); box(A, 'stoneWall', p.x, 0.6, p.z, 2.6, 1.2, 1.2, { worldUV: 1 }); for (const s of [-1, 0, 1]) fire(A, p.x + s * 0.9, 1.3, p.z, { size: 0.2, intensity: 3, range: 6, embers: 1, color: 0xffd090 }); }
    interactable(A, at(6, 3), 2.4, 'Pray at the altar', () => { this.game.player.hp = this.game.player.maxHp; this.game.hud.speak('A quiet warmth. Your wounds close.'); });
    // ---- dungeon cells: bars and prisoners
    for (const c of [31, 33, 35]) {
      const p = at(c, 2);
      for (let i = -3; i <= 3; i++) mesh(A, 'ironDark', boxGeo(0.07, 3, 0.07, 0.5), trs(p.x + i * 0.32, p.y + 1.5, p.z + 1.6));
      A.collision.addCentered(p.x, p.y + 1.5, p.z + 1.6, 2.2, 3, 0.2);
    }
    npc(A, { name: 'Shackled Prisoner', x: at(33, 2).x, z: at(33, 2).z, y: at(33, 2).y, variant: 'hunched', cloth: 'cloth', lines: NPC_LINES.prisoner });
    interactable(A, at(35, 3), 1.8, 'A burnt letter in the straw', () => this.game.journal.add('n06'));
    // ---- kitchen: hearth, pots, tables
    { const p = at(37, 23); box(A, 'stoneDark', p.x + 0.4, 1.0, p.z, 1.0, 2.0, 2.4, { worldUV: 1 }); fire(A, p.x, 0.5, p.z, { size: 0.7, intensity: 10, range: 10 }); }
    for (const c of [33, 35]) { const p = at(c, 24); box(A, 'woodDark', p.x, 0.45, p.z, 1.6, 0.9, 1.0, { tex: 1 }); }
    { const p = at(34, 22); mesh(A, 'ironDark', new THREE.CylinderGeometry(0.4, 0.3, 0.5, 8), trs(p.x, 0.25, p.z)); }
    npc(A, { name: 'Castle Cook', x: at(35, 22).x, z: at(35, 22).z, cloth: 'clothBrown', lines: NPC_LINES.cook });
    interactable(A, at(34, 24), 2, 'Eat from the table', () => { this.game.player.heal(30); this.game.hud.speak('Bread, salt pork, sour ale. You feel better.'); });
    // ---- barracks: bunks and footlockers
    for (let r = 21; r <= 26; r += 2) for (const c of [2, 6]) { const p = at(c, r); box(A, 'woodDark', p.x + (c === 2 ? -0.4 : 0.4), 0.35, p.z, 1.0, 0.7, 2.0, { tex: 1 }); box(A, 'cloth', p.x + (c === 2 ? -0.4 : 0.4), 0.75, p.z, 0.9, 0.1, 1.8, { collide: false, shade: null }); }
    { const p = at(4, 26); chest(A, p.x, 0, p.z + 0.5, Math.PI, () => { this.game.loot.roll('chest', p, 2); }); }
    // ---- towers: battlements
    for (const [c0, r0] of [[10, 29], [27, 29]]) {
      for (let i = 0; i < 3; i++) for (const [dx, dz] of [[i, -0.5], [i, 2.5], [-0.5, i], [2.5, i]]) {
        const p = at(c0, r0);
        box(A, 'stoneWall', p.x + dx * CELL, p.y + 0.6, p.z + dz * CELL, 1.0, 1.2, 1.0, { collide: false, shade: null });
      }
    }

    // ---- guards: each blocks a doorway until your renown is high enough
    const guard = (c, r, yaw, rank, place) => {
      const p = at(c, r);
      const blocker = A.collision.addCentered(p.x, p.y + 1, p.z, CELL * 2, 2, CELL * 0.6, 'guard');
      const g = hero(A, { name: 'Royal Guard', look: 'guard', x: p.x, z: p.z, y: p.y, yaw, talk: false });
      g.position.y = p.y;
      const it = interactable(A, new THREE.Vector3(p.x, p.y, p.z), 3, 'Speak to the guard', () => {
        const ok = this.game.renown.rankIndex >= rank;
        this.game.hud.speak(ok ? `Royal Guard: "Pass, ${this.game.renown.rank.title}. The ${place} is open to you."`
          : `Royal Guard: "Halt. The ${place} is for those known as ${RANKS[rank].title} or better."`);
      });
      this.guards.push({ blocker, group: g, rank, home: p.clone(), yaw, it });
    };
    guard(19.5, 17, 0, 3, 'great hall');
    guard(19.5, 9, 0, 4, 'throne room');
    // patrols (decorative)
    const c1 = at(12, 21), c2 = at(27, 25);
    hero(A, { name: 'Sergeant Brask', look: 'guard', x: c1.x, z: c1.z, path: [[c1.x, c1.z], [c2.x, c1.z], [c2.x, c2.z], [c1.x, c2.z]] });
    const h1 = at(15, 15), h2 = at(24, 15);
    hero(A, { name: 'Lady Ysmay', look: 'paladin', x: h1.x, z: h1.z, path: [[h1.x, h1.z], [h2.x, h2.z]] });
    hero(A, { name: 'Court Mage Orrin', look: 'sorceress', x: at(5, 13).x, z: at(5, 13).z, yaw: Math.PI / 2 });
  }

  audience() {
    const g = this.game, ri = g.renown.rankIndex;
    const say = (t, secs = 7) => g.hud.speak(`King Aldric: "${t}"`, secs);
    if (ri >= 4 && !g.state.world.kingGift) {
      // the Ash-bearer's first audience
      g.state.world.kingGift = true;
      g.state.addItemSaved('royal_signet');
      g.state.saved.currency += 1000;
      g.state.save();
      g.hud.banner('An audience with the King', 'he presses his signet into your palm');
      say('Ash-bearer. Take my seal, and a thousand ashes for the fire. Emberwick stands because of hands like yours.');
      return;
    }
    if (ri >= 5) {
      // the King's own: private errands, and the edges of the truth
      // (quest stub: see systems/ending.js)
      say(pick([KING_LINES[5], 'Go to the bottom of the catacombs, when the way opens. If something there wears my face... do not listen to it.', 'I do not sleep. Kings of Aurelan never needed to. Do not look at me like that.']), 8);
      return;
    }
    say(KING_LINES[ri]);
  }

  /** The castle shares the town's sky: same DAY / NIGHT as Emberwick. */
  applyPhase(phase) {
    this.phase = phase;
    const p = PHASES[phase];
    this.scene.fog.color.set(p.fog);
    this.scene.fog.near = p.near; this.scene.fog.far = p.far + 10;
    this.scene.background = new THREE.Color(p.fog);
    this.sky.setPalette(p.sky);
    this.hemi.color.set(p.hemiSky); this.hemi.groundColor.set(p.hemiGround);
    this.sun.color.set(p.sun); this.sun.position.set(...p.sunPos);
    this.lanternIntensity = phase === 'day' ? 1.2 : 4;
  }

  onEnter() {
    super.onEnter();
    this.applyPhase(this.game.townPhase());
    // castle gardens grow back when the world is 80% healed
    if (!this.garden && this.game.restoration && this.game.restoration.value >= 80) {
      this.garden = new THREE.Group();
      const sp = this.spawns.start.pos;
      const hedge = litMaterial('hedge', { color: 0x80a060 });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2, r = 3.2 + (i % 3) * 0.5;
        const x = sp.x + Math.cos(a) * r, z = sp.z + Math.sin(a) * r;
        if (this.collision.query(x - 0.3, z - 0.3, x + 0.3, z + 0.3, []).some((b) => b.maxY > sp.y + 0.3)) continue;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), i % 3 ? hedge : basicMaterial([0xd04050, 0xe0d050, 0xf0f0ff][i % 3]));
        m.position.set(x, sp.y + 0.3, z); this.garden.add(m);
      }
      this.scene.add(this.garden);
    }
  }

  weaponLighting() { return this.phase === 'day' ? [1.4, 0.4] : [0.5, 2.2]; }

  update(dt, player) {
    if (this.game.townPhase() !== this.phase) this.applyPhase(this.game.townPhase());
    this.sky.update(dt, this.game.camera);
    // open-air cells (courtyard, towers) get full sky light; halls are dimmer and torch-lit
    const p = PHASES[this.phase];
    const c = Math.floor(player.pos.x / CELL), r = Math.floor(player.pos.z / CELL);
    const cell = this.at(r, c);
    const out = cell && cell.sky ? 1 : 0;
    this._out = this._out === undefined ? out : this._out + (out - this._out) * Math.min(1, dt * 3);
    const k = 0.45 + this._out * 0.55;
    this.hemi.intensity = Math.max(p.hemi * k, this.phase === 'day' ? 0.9 : 0.35);
    this.sun.intensity = p.sunI * this._out;
    this.lights.scale = this.phase === 'day' ? 0.6 + (1 - this._out) * 0.4 : 1;
    super.update(dt, player);
    // guards step aside for the renowned
    const ri = this.game.renown.rankIndex;
    for (const gd of this.guards) {
      const open = ri >= gd.rank;
      gd.blocker.disabled = open;
      const tx = gd.home.x + (open ? 2.2 : 0);
      gd.group.position.x += (tx - gd.group.position.x) * Math.min(1, dt * 3);
      gd.it.label = open ? 'Speak to the guard (passage open)' : 'Speak to the guard';
    }
  }
}

