// Enemy archetypes: stats + low-poly models built from primitives.
// Add a new enemy by adding an entry here - the AI in enemy.js is generic,
// bosses get attack patterns from bosses.js (by `attacks` name).
//   kind: biped | crawler | spider | float  (animation rig)
//   ranged: { range, keep, cooldown, damage, count, projectile: {...} }
//   onHit: { slow: seconds }       renown: kill weight for the Renown system
import * as THREE from '../../lib/three.module.min.js';
import { litMaterial, basicMaterial, spriteMaterial } from '../engine/materials.js';
import { buildWeapon, buildBow, handMount } from './weaponModels.js';

const base = (o) => ({ turn: 6, giveUp: 28, strike: 0.15, recover: 0.7, poise: 0, lunge: 2.5, ...o });

export const ENEMY_TYPES = {
  hollow: base({ name: 'Hollow Soldier', hp: 45, speed: 2.3, notice: 11, range: 1.7, reach: 2.1, damage: 12, windup: 0.55, recover: 0.75, radius: 0.4, height: 1.8, xp: 20, ashes: [4, 9], renown: 2, hitColor: [0.22, 0.05, 0.03], build: () => buildHollow() }),
  ghoul: base({ name: 'Crawling Ghoul', hp: 28, speed: 4.1, turn: 9, notice: 9, range: 1.35, reach: 1.8, damage: 7, windup: 0.3, strike: 0.12, recover: 0.5, radius: 0.45, height: 0.9, xp: 14, ashes: [2, 6], renown: 1.5, hitColor: [0.18, 0.12, 0.04], build: () => buildGhoul() }),
  knight: base({ name: 'Fallen Knight', hp: 140, speed: 1.75, turn: 3, notice: 13, giveUp: 32, range: 2.3, reach: 2.8, damage: 26, windup: 0.95, strike: 0.2, recover: 1.1, radius: 0.55, height: 2.3, poise: 35, xp: 60, ashes: [18, 30], renown: 8, armored: true, heavy: true, modelScale: 1.22, hitColor: [0.6, 0.45, 0.25], build: () => buildKnight() }),
  wolf: base({ name: 'Grave Wolf', hp: 34, speed: 5.4, turn: 10, notice: 13, range: 1.6, reach: 2.0, damage: 9, windup: 0.32, strike: 0.12, recover: 0.45, lunge: 6, radius: 0.45, height: 1.0, xp: 16, ashes: [3, 7], renown: 2, hitColor: [0.2, 0.08, 0.05], build: () => buildWolf() }),
  spider: base({ name: 'Giant Spider', hp: 55, speed: 3.6, turn: 8, notice: 11, range: 1.7, reach: 2.1, damage: 13, windup: 0.45, recover: 0.6, radius: 0.7, height: 1.0, xp: 26, ashes: [5, 11], renown: 3, onHit: { slow: 1.5 }, hitColor: [0.15, 0.25, 0.08],
    ranged: { range: 9, keep: 3, cooldown: 4.5, damage: 6, windup: 0.6, projectile: { color: 0xc8d8b0, size: 0.18, speed: 11, slow: 2.2 } }, build: () => buildSpider() }),
  hag: base({ name: 'Swamp Hag', hp: 50, speed: 2.0, notice: 14, range: 1.5, reach: 1.9, damage: 10, windup: 0.5, radius: 0.45, height: 1.7, xp: 30, ashes: [6, 12], renown: 3, hitColor: [0.15, 0.2, 0.08],
    ranged: { range: 15, keep: 6, cooldown: 2.6, damage: 13, windup: 0.75, projectile: { color: 0x8ad050, size: 0.24, speed: 9, poison: 4 } }, build: () => buildHag() }),
  wraith: base({ name: 'Frost Wraith', hp: 48, speed: 3.0, turn: 7, notice: 12, range: 1.8, reach: 2.2, damage: 11, windup: 0.6, radius: 0.45, height: 1.9, xp: 28, ashes: [5, 11], renown: 3, float: true, onHit: { slow: 2.5 }, hitColor: [0.5, 0.7, 0.9], build: () => buildWraith() }),
  imp: base({ name: 'Fire Imp', hp: 26, speed: 4.2, turn: 10, notice: 13, range: 1.3, reach: 1.7, damage: 7, windup: 0.3, radius: 0.35, height: 1.0, xp: 18, ashes: [3, 8], renown: 2, float: true, hitColor: [1, 0.45, 0.1],
    ranged: { range: 13, keep: 5, cooldown: 2.2, damage: 10, windup: 0.5, projectile: { color: 0xff7a20, size: 0.22, speed: 12, burn: 4 } }, build: () => buildImp() }),
  brute: base({ name: 'Armored Brute', hp: 220, speed: 1.4, turn: 2.5, notice: 11, range: 2.4, reach: 3.0, damage: 34, windup: 1.15, strike: 0.25, recover: 1.3, lunge: 1, radius: 0.75, height: 2.6, poise: 60, xp: 80, ashes: [22, 36], renown: 10, armored: true, heavy: true, modelScale: 1.45, hitColor: [0.5, 0.4, 0.3], build: () => buildBrute() }),
  archer: base({ name: 'Skeleton Archer', hp: 30, speed: 2.6, notice: 16, range: 1.4, reach: 1.8, damage: 6, windup: 0.4, radius: 0.35, height: 1.8, xp: 20, ashes: [4, 9], renown: 2, hitColor: [0.6, 0.55, 0.45],
    ranged: { range: 18, keep: 7, cooldown: 2.4, damage: 12, windup: 0.9, projectile: { color: 0xd8d0b8, size: 0.1, speed: 22, arrow: true } }, build: () => buildArcher() }),

  vine_creeper: base({ name: 'Vine Creeper', hp: 60, speed: 0.9, turn: 4, notice: 9, range: 2.6, reach: 3.2, damage: 12, windup: 0.7, lunge: 0, radius: 0.5, height: 2.2, xp: 26, ashes: [5, 10], renown: 3, onHit: { slow: 1.2 }, hitColor: [0.2, 0.4, 0.1], build: () => buildCreeper() }),
  panther: base({ name: 'Jungle Panther', hp: 50, speed: 6, turn: 11, notice: 15, range: 1.7, reach: 2.1, damage: 13, windup: 0.35, strike: 0.12, recover: 0.5, lunge: 7, radius: 0.5, height: 1.1, xp: 24, ashes: [4, 9], renown: 3, hitColor: [0.15, 0.1, 0.05], build: () => buildWolf({ scale: 1.15, fur: 'chitin', eye: 0x90e050 }) }),
  poison_frog: base({ name: 'Poison Frog', hp: 14, speed: 4.5, turn: 12, notice: 9, range: 1.1, reach: 1.5, damage: 4, windup: 0.25, strike: 0.1, recover: 0.4, radius: 0.3, height: 0.5, xp: 6, ashes: [1, 3], renown: 0.8, swarm: true, onHit: { poison: 4 }, hitColor: [0.3, 0.6, 0.1], build: () => buildFrog() }),

  // ---------------------------------------------------------------- deep enemies (levels 6-30, Abyss)
  bone_colossus: base({ name: 'Bone Colossus', hp: 420, speed: 1.3, turn: 2, notice: 14, giveUp: 30, range: 3.2, reach: 3.8, damage: 38, windup: 1.2, strike: 0.25, recover: 1.4, lunge: 0.5, radius: 1.2, height: 4.2, poise: 120, xp: 160, ashes: [40, 70], renown: 14, heavy: true, armored: true, modelScale: 2.4, hitColor: [0.7, 0.65, 0.55], build: () => buildColossus() }),
  plague_bearer: base({ name: 'Plague Bearer', hp: 120, speed: 1.7, turn: 4, notice: 11, range: 1.8, reach: 2.2, damage: 14, windup: 0.7, radius: 0.6, height: 2.0, poise: 30, xp: 50, ashes: [10, 20], renown: 5, onHit: { poison: 6 }, aura: { kind: 'poison', r: 2.4, dps: 5 }, deathCloud: true, hitColor: [0.4, 0.6, 0.15], build: () => buildPlague() }),
  shade_assassin: base({ name: 'Shade Assassin', hp: 55, speed: 5.2, turn: 12, notice: 16, range: 1.5, reach: 1.9, damage: 22, windup: 0.32, strike: 0.1, recover: 0.4, lunge: 5, radius: 0.35, height: 1.8, xp: 45, ashes: [8, 16], renown: 5, invisible: true, hitColor: [0.15, 0.1, 0.2], build: () => buildShade() }),
  ember_golem: base({ name: 'Ember Golem', hp: 300, speed: 1.6, turn: 3, notice: 13, range: 2.4, reach: 2.9, damage: 30, windup: 1.0, strike: 0.2, recover: 1.1, lunge: 1, radius: 0.85, height: 2.8, poise: 80, xp: 110, ashes: [26, 44], renown: 10, heavy: true, armored: true, modelScale: 1.6, onHit: { burn: 6 }, aura: { kind: 'burn', r: 2.0, dps: 4 }, hitColor: [1, 0.5, 0.15],
    ranged: { range: 14, keep: 4, cooldown: 3.5, damage: 18, windup: 0.8, projectile: { color: 0xff6a20, size: 0.3, speed: 11, burn: 6 } }, build: () => buildGolem() }),
  drowned_knight: base({ name: 'Drowned Knight', hp: 180, speed: 2.0, turn: 3.5, notice: 13, giveUp: 32, range: 2.3, reach: 2.8, damage: 28, windup: 0.85, strike: 0.2, recover: 1.0, radius: 0.55, height: 2.3, poise: 45, xp: 75, ashes: [18, 32], renown: 8, armored: true, heavy: true, modelScale: 1.22, onHit: { slow: 1.2 }, hitColor: [0.3, 0.5, 0.45], build: () => buildKnight({ weapon: 'axe', drowned: true }) }),
  rime_giant: base({ name: 'Rime Giant', hp: 520, speed: 1.2, turn: 2, notice: 14, giveUp: 30, range: 3.0, reach: 3.6, damage: 40, windup: 1.3, strike: 0.25, recover: 1.4, lunge: 0.5, radius: 1.3, height: 4.4, poise: 140, xp: 190, ashes: [44, 76], renown: 16, heavy: true, armored: true, frost: true, modelScale: 2.4, onHit: { slow: 2 }, hitColor: [0.6, 0.8, 1], build: () => buildBrute({ scale: 2.4, frost: true }) }),
  gargoyle: base({ name: 'Gargoyle', hp: 90, speed: 4.4, turn: 7, notice: 15, range: 1.8, reach: 2.3, damage: 18, windup: 0.5, recover: 0.7, lunge: 4, radius: 0.6, height: 1.6, xp: 48, ashes: [9, 18], renown: 5, armored: true, flying: 2.6, hitColor: [0.5, 0.5, 0.5], build: () => buildGargoyle() }),
  mimic: base({ name: 'Mimic', hp: 160, speed: 3.8, turn: 8, notice: 2.2, range: 1.8, reach: 2.3, damage: 26, windup: 0.4, strike: 0.15, recover: 0.6, lunge: 4, radius: 0.6, height: 1.0, poise: 40, xp: 70, ashes: [40, 90], renown: 6, mimic: true, hitColor: [0.4, 0.25, 0.1], build: () => buildMimic() }),
  ash_hoarder: base({ name: 'Ash Hoarder', hp: 70, speed: 6.4, turn: 12, notice: 14, range: 0, reach: 0, damage: 0, windup: 1, radius: 0.4, height: 1.2, xp: 60, ashes: [180, 320], renown: 6, flee: true, hitColor: [0.6, 0.5, 0.3], build: () => buildHoarder() }),

  // ---------------------------------------------------------------- bosses (story guardians every 5 levels)
  grave_warden: base({ name: 'The Grave Warden', boss: true, hp: 900, speed: 2.4, turn: 2.6, notice: 18, giveUp: 99, range: 3.5, reach: 4, damage: 30, windup: 1, radius: 1.1, height: 4.4, xp: 400, ashes: [200, 260], renown: 40, armored: true, heavy: true, modelScale: 2.3, hitColor: [0.6, 0.45, 0.25],
    attacks: ['sweep', 'slam', 'charge'], phase2: ['nova', 'summon:hollow:2', 'sweep'], build: () => buildKnight({ scale: 2.3, cape: true }) }),
  brood_mother: base({ name: 'The Brood Mother', boss: true, hp: 1000, speed: 3.2, turn: 3.5, notice: 18, giveUp: 99, range: 3.2, reach: 3.8, damage: 26, windup: 0.9, radius: 1.6, height: 2.6, xp: 450, ashes: [240, 300], renown: 45, modelScale: 2.7, onHit: { slow: 1.5 }, hitColor: [0.15, 0.25, 0.08],
    attacks: ['volley:web', 'leap', 'sweep', 'summon:spider:2'], phase2: ['summon:spider:3', 'nova:poison', 'volley:web'], build: () => buildSpider({ scale: 2.7, sac: true }) }),
  kings_hound: base({ name: 'Hollow King\'s Hound', boss: true, hp: 1150, speed: 5.5, turn: 4.5, notice: 20, giveUp: 99, range: 3.2, reach: 3.6, damage: 28, windup: 0.75, radius: 1.2, height: 2.5, xp: 520, ashes: [280, 340], renown: 50, modelScale: 2.5, hitColor: [0.2, 0.08, 0.05],
    attacks: ['charge', 'sweep', 'leap'], phase2: ['charge2', 'nova', 'leap'], build: () => buildWolf({ scale: 2.5, spikes: true }) }),
  ashen_abbot: base({ name: 'The Ashen Abbot', boss: true, hp: 1250, speed: 2.2, turn: 3, notice: 20, giveUp: 99, range: 2.6, reach: 3.2, damage: 30, windup: 0.9, radius: 0.9, height: 3.6, xp: 600, ashes: [320, 400], renown: 55, modelScale: 1.9, hitColor: [1, 0.45, 0.1],
    attacks: ['volley:fire', 'nova:fire', 'blink', 'summon:imp:2'], phase2: ['rain', 'volley:fire5', 'nova:fire'], build: () => buildAbbot() }),
  hollow_king: base({ name: 'The Hollow King', boss: true, hp: 2600, speed: 2.6, turn: 3, notice: 24, giveUp: 99, range: 3.6, reach: 4.4, damage: 44, windup: 0.95, radius: 1.2, height: 5.2, xp: 2000, ashes: [900, 1200], renown: 120, armored: true, heavy: true, modelScale: 2.5, hitColor: [0.8, 0.7, 0.4],
    phase3Line: 'lets the crown fall \u2014 the hollow beneath is burning', attacks: ['sweep', 'slam', 'charge', 'volley:fire'], phase2: ['summon:knight:2', 'nova', 'leap', 'shockwave'], phase3: ['rain', 'charge2', 'blink', 'nova:fire', 'shockwave'], build: () => buildKnight({ scale: 2.5, cape: true, crown: true, weapon: 'greatsword' }) }),
  drowned_lord: base({ name: 'The Drowned Lord', boss: true, hp: 1500, speed: 2.3, turn: 2.6, notice: 20, giveUp: 99, range: 3.8, reach: 4.4, damage: 36, windup: 1.05, radius: 1.3, height: 4.6, xp: 750, ashes: [400, 500], renown: 65, armored: true, heavy: true, modelScale: 2.2, onHit: { slow: 1.5 }, hitColor: [0.3, 0.5, 0.45],
    attacks: ['slam', 'sweep', 'volley:water'], phase2: ['nova:water', 'summon:wraith:2', 'charge', 'rain'], build: () => buildBrute({ scale: 2.2, drowned: true }) }),
};

/** Story guardians at levels 5, 10, 15, 20, 25 and 30. */
export const BOSS_BY_LEVEL = ['grave_warden', 'brood_mother', 'ashen_abbot', 'kings_hound', 'drowned_lord', 'hollow_king'];
export const STORY_LEVELS = { 5: 'grave_warden', 10: 'brood_mother', 15: 'ashen_abbot', 20: 'kings_hound', 25: 'drowned_lord', 30: 'hollow_king' };

// Per-enemy material clones so each one can flash when hit.
function mats(names) {
  const out = {};
  for (const n of names) out[n] = litMaterial(n, { unique: true });
  return out;
}
const boxM = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
function limb(w, h, d, m, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const mesh = boxM(w, h, d, m);
  mesh.position.y = -h / 2;
  pivot.add(mesh);
  return pivot;
}
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
function eyes(parent, color, y, z, spread = 0.07, size = 0.045) {
  const m = basicMaterial(color);
  for (const s of [-1, 1]) { const e = boxM(size, size * 0.7, 0.02, m); e.position.set(s * spread, y, z); parent.add(e); }
}
function glowAt(parent, color, x, y, z, s = 0.8, op = 0.6) {
  const g = new THREE.Sprite(spriteMaterial('glow', color)); g.scale.set(s, s, 1); g.material.opacity = op; g.position.set(x, y, z); parent.add(g); return g;
}

function buildHollow(o = {}) {
  const M = mats(['flesh', 'cloth', 'iron']);
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const legL = limb(0.15, 0.95, 0.16, M.cloth, -0.13, 0, 0); hips.add(legL);
  const legR = limb(0.15, 0.95, 0.16, M.cloth, 0.13, 0, 0); hips.add(legR);
  const torso = new THREE.Group(); hips.add(torso); torso.rotation.x = 0.25;
  const chest = boxM(0.48, 0.62, 0.28, M.flesh); chest.position.y = 0.31; torso.add(chest);
  const rag = boxM(0.52, 0.4, 0.31, M.cloth); rag.position.y = 0.12; torso.add(rag);
  const ribs = boxM(0.5, 0.06, 0.3, M.iron); ribs.position.y = 0.48; torso.add(ribs);
  const head = new THREE.Group(); head.position.set(0, 0.72, 0.04); torso.add(head);
  const skull = boxM(0.26, 0.3, 0.27, M.flesh); skull.position.y = 0.1; head.add(skull);
  const jaw = boxM(0.2, 0.08, 0.2, M.flesh); jaw.position.set(0, -0.06, 0.04); head.add(jaw);
  eyes(head, 0xc8501a, 0.13, 0.14);
  const armL = limb(0.11, 0.7, 0.12, M.flesh, -0.32, 0.58, 0); torso.add(armL);
  const armR = limb(0.11, 0.7, 0.12, M.flesh, 0.32, 0.58, 0); torso.add(armR);
  armR.add(handMount(buildWeapon(o.weapon || (Math.random() < 0.35 ? 'axe' : 'sword'), { tint: 0x9a8a78 }), 0.68));
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 1.55, hipY: 0.95, lean: 0.25 };
}

function buildGhoul() {
  const M = mats(['flesh', 'bone', 'cloth']);
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.55; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const body = boxM(0.42, 0.32, 0.9, M.flesh); body.position.set(0, 0.05, 0.25); torso.add(body);
  const spine = boxM(0.12, 0.1, 0.8, M.bone); spine.position.set(0, 0.24, 0.25); torso.add(spine);
  const head = new THREE.Group(); head.position.set(0, 0.08, 0.78); torso.add(head);
  const skull = boxM(0.26, 0.24, 0.3, M.flesh); skull.position.z = 0.1; head.add(skull);
  const jaw = boxM(0.22, 0.07, 0.26, M.bone); jaw.position.set(0, -0.14, 0.12); head.add(jaw);
  eyes(head, 0x9ac060, 0.04, 0.26, 0.07, 0.04);
  const armL = limb(0.09, 0.75, 0.09, M.flesh, -0.26, 0.05, 0.62); torso.add(armL);
  const armR = limb(0.09, 0.75, 0.09, M.flesh, 0.26, 0.05, 0.62); torso.add(armR);
  const legL = limb(0.1, 0.6, 0.1, M.flesh, -0.22, 0.0, -0.12); hips.add(legL);
  const legR = limb(0.1, 0.6, 0.1, M.flesh, 0.22, 0.0, -0.12); hips.add(legR);
  const rag = boxM(0.45, 0.2, 0.5, M.cloth); rag.position.set(0, -0.08, 0); torso.add(rag);
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'crawler', eyeH: 0.7, hipY: 0.55 };
}

function buildKnight(o = {}) {
  const M = mats(['ironPlate', 'iron', o.drowned ? 'moss' : 'clothRed', 'ironDark']);
  M.clothRed = M[o.drowned ? 'moss' : 'clothRed'];
  if (o.drowned) { M.ironPlate.color.setHex(0x80a090); M.iron.color.setHex(0x90a8a0); }
  if (o.crown) { M.ironPlate.color.setHex(0x6a6070); M.ironDark.color.setHex(0x40384a); }
  const root = new THREE.Group();
  root.scale.setScalar(o.scale || 1.22);
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const legL = limb(0.19, 0.95, 0.2, M.ironDark, -0.15, 0, 0); hips.add(legL);
  const legR = limb(0.19, 0.95, 0.2, M.ironDark, 0.15, 0, 0); hips.add(legR);
  const torso = new THREE.Group(); hips.add(torso); torso.rotation.x = 0.08;
  const chest = boxM(0.6, 0.66, 0.36, M.ironPlate); chest.position.y = 0.34; torso.add(chest);
  const tabard = boxM(0.4, 0.75, 0.38, M.clothRed); tabard.position.y = 0.05; torso.add(tabard);
  for (const s of [-1, 1]) { const p = boxM(0.3, 0.16, 0.36, M.iron); p.position.set(s * 0.38, 0.66, 0); p.rotation.z = s * -0.35; torso.add(p); }
  if (o.cape) {
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.5), litMaterial('clothRed', { side: THREE.DoubleSide })); cape.position.set(0, -0.05, -0.22); cape.rotation.x = 0.12; torso.add(cape);
    for (const s of [-1, 1]) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 4), M.ironDark); sp.position.set(s * 0.42, 0.82, 0); torso.add(sp); }
  }
  const head = new THREE.Group(); head.position.set(0, 0.8, 0); torso.add(head);
  const helm = boxM(0.32, 0.38, 0.34, M.iron); helm.position.y = 0.12; head.add(helm);
  const crest = boxM(0.05, 0.12, 0.34, M.ironDark); crest.position.y = 0.36; head.add(crest);
  const slit = boxM(0.24, 0.035, 0.02, basicMaterial(0x050302)); slit.position.set(0, 0.15, 0.175); head.add(slit);
  eyes(head, o.crown ? 0xffd060 : o.drowned ? 0x60e0c0 : o.cape ? 0x60c0ff : 0xd06020, 0.15, 0.18, 0.06, 0.035);
  if (o.crown) {
    const gold = basicMaterial(0xc8a040);
    for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), gold); const a = (i / 5) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.15, 0.4, Math.sin(a) * 0.15); head.add(sp); }
    head.add(at(boxM(0.36, 0.06, 0.36, gold), 0, 0.31, 0));
    glowAt(head, 0xffc040, 0, 0.3, 0, 0.9, 0.4);
  }
  if (o.cape) glowAt(head, 0x60a0ff, 0, 0.15, 0.25, 0.6, 0.5);
  const armL = limb(0.16, 0.72, 0.17, M.ironDark, -0.42, 0.6, 0); torso.add(armL);
  const armR = limb(0.16, 0.72, 0.17, M.ironDark, 0.42, 0.6, 0); torso.add(armR);
  const shield = boxM(0.08, 0.95, 0.6, M.ironPlate); shield.position.set(-0.08, -0.45, 0.25); armL.add(shield);
  armL.rotation.set(-0.5, 0, 0.1);
  armR.add(handMount(buildWeapon(o.weapon || (o.cape ? 'greatsword' : 'longsword')), 0.7));
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 2.2, hipY: 0.95, lean: 0.08, fixedLeft: true };
}

function buildWolf(o = {}) {
  const M = mats([o.fur || 'fur', 'bone']);
  M.fur = M[o.fur || 'fur'];
  const root = new THREE.Group();
  root.scale.setScalar(o.scale || 1);
  const hips = new THREE.Group(); hips.position.y = 0.6; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const body = boxM(0.4, 0.42, 1.0, M.fur); body.position.set(0, 0.08, 0.2); torso.add(body);
  const chest = boxM(0.46, 0.5, 0.4, M.fur); chest.position.set(0, 0.12, 0.55); torso.add(chest);
  const head = new THREE.Group(); head.position.set(0, 0.25, 0.82); torso.add(head);
  head.add(boxM(0.3, 0.28, 0.3, M.fur));
  const snout = boxM(0.16, 0.14, 0.28, M.fur); snout.position.set(0, -0.06, 0.24); head.add(snout);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), M.fur); ear.position.set(s * 0.1, 0.2, -0.05); head.add(ear); }
  const fang = boxM(0.12, 0.04, 0.04, M.bone); fang.position.set(0, -0.14, 0.32); head.add(fang);
  eyes(head, o.eye || (o.spikes ? 0xff3010 : 0xe0a030), 0.05, 0.16, 0.08, 0.04);
  if (o.spikes) for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 4), M.bone); sp.position.set(0, 0.36, -0.2 + i * 0.18); sp.rotation.x = -0.4; torso.add(sp); }
  const armL = limb(0.1, 0.55, 0.1, M.fur, -0.17, 0, 0.55); torso.add(armL);
  const armR = limb(0.1, 0.55, 0.1, M.fur, 0.17, 0, 0.55); torso.add(armR);
  const legL = limb(0.11, 0.55, 0.12, M.fur, -0.16, 0, -0.18); hips.add(legL);
  const legR = limb(0.11, 0.55, 0.12, M.fur, 0.16, 0, -0.18); hips.add(legR);
  const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.3); torso.add(tail);
  const tm = boxM(0.08, 0.08, 0.5, M.fur); tm.position.z = -0.25; tm.rotation.x = 0.4; tail.add(tm);
  return { root, hips, torso, head, armL, armR, legL, legR, tail, mats: M, kind: 'crawler', eyeH: 0.85, hipY: 0.6 };
}

function buildSpider(o = {}) {
  const M = mats(['chitin', 'flesh']);
  const root = new THREE.Group();
  root.scale.setScalar(o.scale || 1);
  const body = new THREE.Group(); body.position.y = 0.55; root.add(body);
  const thorax = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), M.chitin); thorax.scale.set(1, 0.7, 1.1); thorax.position.z = 0.2; body.add(thorax);
  const abd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 0), M.chitin); abd.scale.set(1, 0.85, 1.25); abd.position.set(0, 0.15, -0.45); body.add(abd);
  if (o.sac) { const sac = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), M.flesh); sac.position.set(0, 0.2, -1.0); body.add(sac); glowAt(body, 0x90c040, 0, 0.2, -1.0, 1.2, 0.35); }
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), M.chitin); head.position.set(0, 0.02, 0.5); body.add(head);
  const em = basicMaterial(0xd03020);
  for (let i = 0; i < 4; i++) { const e = boxM(0.04, 0.04, 0.02, em); e.position.set(-0.07 + i * 0.045, 0.08, 0.66); body.add(e); }
  const legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const leg = new THREE.Group(); leg.position.set(s * 0.22, 0, 0.35 - i * 0.18);
    leg.userData.baseY = s * (0.6 - i * 0.4) + (s > 0 ? 0 : Math.PI); leg.userData.baseZ = 0;
    leg.rotation.y = leg.userData.baseY;
    const upper = boxM(0.6, 0.06, 0.06, M.chitin); upper.position.set(0.28, 0.18, 0); upper.rotation.z = 0.6; leg.add(upper);
    const lower = boxM(0.06, 0.7, 0.06, M.chitin); lower.position.set(0.56, -0.05, 0); lower.rotation.z = -0.3; leg.add(lower);
    body.add(leg); legs.push(leg);
  }
  return { root, body, legs, mats: M, kind: 'spider', eyeH: 0.7, hipY: 0.55 };
}

function buildHag() {
  const M = mats(['cloth', 'flesh', 'beam']);
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.85; root.add(hips);
  const legL = limb(0.14, 0.85, 0.14, M.cloth, -0.12, 0, 0); hips.add(legL);
  const legR = limb(0.14, 0.85, 0.14, M.cloth, 0.12, 0, 0); hips.add(legR);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 0.9, 7), M.cloth); skirt.position.y = -0.4; hips.add(skirt);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = boxM(0.42, 0.55, 0.3, M.cloth); chest.position.y = 0.28; torso.add(chest);
  const head = new THREE.Group(); head.position.set(0, 0.66, 0.08); torso.add(head);
  const face = boxM(0.24, 0.3, 0.24, M.flesh); face.position.y = 0.06; head.add(face);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 4), M.flesh); nose.position.set(0, 0.04, 0.16); nose.rotation.x = Math.PI / 2; head.add(nose);
  const hair = boxM(0.32, 0.4, 0.3, litMaterial('moss')); hair.position.set(0, 0.06, -0.06); head.add(hair);
  eyes(head, 0x9ad050, 0.1, 0.125, 0.06, 0.035);
  const armL = limb(0.08, 0.85, 0.08, M.flesh, -0.28, 0.5, 0); torso.add(armL);
  const armR = limb(0.08, 0.85, 0.08, M.flesh, 0.28, 0.5, 0); torso.add(armR);
  const staff = boxM(0.05, 1.6, 0.05, M.beam); staff.position.set(0, -0.4, 0.1); armR.add(staff);
  glowAt(armR, 0x8ad050, 0, 0.3, 0.12, 0.7, 0.6);
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 1.4, hipY: 0.85, lean: 0.45 };
}

function buildWraith() {
  const M = mats(['ice', 'cloth']);
  M.ice.transparent = true; M.ice.opacity = 0.8;
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.4; root.add(body);
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 7, 1, true), M.ice); robe.position.y = 0.5; robe.rotation.x = Math.PI; body.add(robe);
  const chest = boxM(0.4, 0.5, 0.3, M.ice); chest.position.y = 1.1; body.add(chest);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.55, 6), M.cloth); hood.position.y = 1.55; body.add(hood);
  const face = boxM(0.18, 0.2, 0.04, basicMaterial(0x020408)); face.position.set(0, 1.45, 0.15); body.add(face);
  eyes(body, 0xa0e0ff, 1.48, 0.18, 0.05, 0.04);
  glowAt(body, 0x80c0ff, 0, 1.0, 0, 1.6, 0.25);
  const armL = limb(0.08, 0.75, 0.08, M.ice, -0.28, 1.25, 0); body.add(armL);
  const armR = limb(0.08, 0.75, 0.08, M.ice, 0.28, 1.25, 0); body.add(armR);
  return { root, body, armL, armR, mats: M, kind: 'float', eyeH: 1.6 };
}

function buildImp() {
  const M = mats(['impSkin', 'chitin']);
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.3; root.add(body);
  const torso = boxM(0.3, 0.38, 0.24, M.impSkin); torso.position.y = 0.4; body.add(torso);
  const head = boxM(0.26, 0.24, 0.24, M.impSkin); head.position.y = 0.72; body.add(head);
  for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), M.chitin); horn.position.set(s * 0.09, 0.9, 0); horn.rotation.z = -s * 0.4; body.add(horn); }
  eyes(body, 0xffd040, 0.74, 0.125, 0.06, 0.04);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.12, 0.5, -0.12);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), litMaterial('chitin', { side: THREE.DoubleSide })); m.position.x = s * 0.25; w.add(m);
    body.add(w); wings.push(w);
  }
  const armL = limb(0.07, 0.35, 0.07, M.impSkin, -0.2, 0.55, 0); body.add(armL);
  const armR = limb(0.07, 0.35, 0.07, M.impSkin, 0.2, 0.55, 0); body.add(armR);
  glowAt(armR, 0xff7020, 0, -0.35, 0.05, 0.6, 0.7);
  return { root, body, armL, armR, wings, mats: M, kind: 'float', eyeH: 1.0 };
}

function buildBrute(o = {}) {
  const M = mats(o.drowned ? ['ironDark', 'moss', 'flesh', 'iron'] : o.frost ? ['ice', 'iceWall', 'snow', 'iron'] : ['ironPlate', 'ironDark', 'flesh', 'iron']);
  const armorM = o.drowned ? M.ironDark : o.frost ? M.ice : M.ironPlate, under = o.drowned ? M.moss : o.frost ? M.iceWall : M.ironDark;
  if (o.frost) M.flesh = M.snow;
  const root = new THREE.Group();
  root.scale.setScalar(o.scale || 1.45);
  const hips = new THREE.Group(); hips.position.y = 0.85; root.add(hips);
  const legL = limb(0.24, 0.85, 0.26, under, -0.18, 0, 0); hips.add(legL);
  const legR = limb(0.24, 0.85, 0.26, under, 0.18, 0, 0); hips.add(legR);
  const torso = new THREE.Group(); hips.add(torso); torso.rotation.x = 0.2;
  const belly = boxM(0.72, 0.7, 0.5, M.flesh); belly.position.y = 0.3; torso.add(belly);
  const plate = boxM(0.78, 0.5, 0.54, armorM); plate.position.y = 0.55; torso.add(plate);
  const head = new THREE.Group(); head.position.set(0, 0.92, 0.1); torso.add(head);
  head.add(boxM(0.3, 0.3, 0.3, armorM));
  eyes(head, o.drowned ? 0x60e0c0 : o.frost ? 0xa0e8ff : 0xd06020, 0.02, 0.16, 0.07, 0.04);
  if (o.frost) glowAt(head, 0x80d0ff, 0, 0, 0.2, 1.2, 0.4);
  if (o.drowned) { for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), M.iron); c.position.set(-0.1 + i * 0.1, 0.25, 0); head.add(c); } glowAt(head, 0x40c0a0, 0, 0, 0.2, 0.8, 0.5); }
  const armL = limb(0.22, 0.8, 0.24, under, -0.5, 0.7, 0); torso.add(armL);
  const armR = limb(0.22, 0.8, 0.24, under, 0.5, 0.7, 0); torso.add(armR);
  const wpn = buildWeapon(o.weapon || (o.drowned ? 'trident' : 'hammer'), o.frost ? { tint: 0xa0d0ff } : {});
  wpn.scale.setScalar(o.drowned ? 1.3 : 1.15);
  armR.add(handMount(wpn, 0.8));
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 2.2, hipY: 0.85, lean: 0.2 };
}

function buildArcher() {
  const M = mats(['bone', 'clothBrown']);
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const legL = limb(0.07, 0.95, 0.07, M.bone, -0.12, 0, 0); hips.add(legL);
  const legR = limb(0.07, 0.95, 0.07, M.bone, 0.12, 0, 0); hips.add(legR);
  const torso = new THREE.Group(); hips.add(torso); torso.rotation.x = 0.1;
  for (let i = 0; i < 4; i++) { const r = boxM(0.36, 0.04, 0.2, M.bone); r.position.y = 0.2 + i * 0.1; torso.add(r); }
  const spine = boxM(0.06, 0.6, 0.06, M.bone); spine.position.y = 0.3; torso.add(spine);
  const hood = boxM(0.4, 0.3, 0.32, M.clothBrown); hood.position.set(0, 0.55, -0.02); torso.add(hood);
  const head = new THREE.Group(); head.position.set(0, 0.72, 0.03); torso.add(head);
  head.add(boxM(0.22, 0.26, 0.24, M.bone));
  eyes(head, 0xe0d070, 0.03, 0.125, 0.05, 0.035);
  const armL = limb(0.06, 0.66, 0.06, M.bone, -0.24, 0.5, 0); torso.add(armL);
  const armR = limb(0.06, 0.66, 0.06, M.bone, 0.24, 0.5, 0); torso.add(armR);
  // the bow is parented to the LEFT hand; bowMount cancels the arm's pitch so
  // the bow always stands vertical (limbs curving toward the target)
  const bow = buildBow({ len: 1.0 });
  const bowMount = new THREE.Group(); bowMount.position.y = -0.66; bowMount.rotation.order = 'ZYX'; bowMount.userData.weapon = true; armL.add(bowMount);
  bowMount.add(bow.group);
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 1.6, hipY: 0.95, lean: 0.1, bow, bowMount, archer: true };
}

function buildAbbot() {
  const M = mats(['cloth', 'clothRed', 'flesh', 'iron']);
  const root = new THREE.Group();
  root.scale.setScalar(1.9);
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const legL = limb(0.15, 0.95, 0.16, M.cloth, -0.13, 0, 0); hips.add(legL);
  const legR = limb(0.15, 0.95, 0.16, M.cloth, 0.13, 0, 0); hips.add(legR);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.55, 1.0, 8), M.clothRed); robe.position.y = -0.45; hips.add(robe);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = boxM(0.5, 0.65, 0.32, M.clothRed); chest.position.y = 0.32; torso.add(chest);
  const stole = boxM(0.16, 0.8, 0.35, M.cloth); stole.position.y = 0.25; torso.add(stole);
  const head = new THREE.Group(); head.position.set(0, 0.8, 0); torso.add(head);
  head.add(boxM(0.26, 0.3, 0.26, M.flesh));
  const mitre = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 4), M.cloth); mitre.position.y = 0.42; mitre.rotation.y = Math.PI / 4; head.add(mitre);
  const face = boxM(0.2, 0.18, 0.02, basicMaterial(0x0a0402)); face.position.set(0, 0.0, 0.135); head.add(face);
  eyes(head, 0xff8030, 0.03, 0.15, 0.06, 0.04);
  const armL = limb(0.13, 0.72, 0.14, M.clothRed, -0.36, 0.58, 0); torso.add(armL);
  const armR = limb(0.13, 0.72, 0.14, M.clothRed, 0.36, 0.58, 0); torso.add(armR);
  const staff = boxM(0.06, 2.2, 0.06, M.iron); staff.position.set(0, -0.4, 0.12); armR.add(staff);
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), basicMaterial(0xff7020)); orb.position.set(0, 0.75, 0.12); armR.add(orb);
  glowAt(armR, 0xff7020, 0, 0.75, 0.12, 1.4, 0.7);
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 1.6, hipY: 0.95, lean: 0.05 };
}

function buildCreeper() {
  const M = mats(['moss', 'hedge', 'impSkin']);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.35, 1.7, 6), M.moss); stalk.position.y = 0.85; body.add(stalk);
  for (let i = 0; i < 5; i++) { const leaf = boxM(0.6, 0.04, 0.3, M.hedge); const a = (i / 5) * Math.PI * 2; leaf.position.set(Math.cos(a) * 0.4, 0.08, Math.sin(a) * 0.4); leaf.rotation.y = -a; body.add(leaf); }
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), M.impSkin); bulb.position.y = 1.9; body.add(bulb);
  const mouth = boxM(0.4, 0.1, 0.1, basicMaterial(0x0a0402)); mouth.position.set(0, 1.85, 0.36); body.add(mouth);
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 4), M.hedge); const a = (i / 4) * Math.PI * 2; p.position.set(Math.cos(a) * 0.35, 2.15, Math.sin(a) * 0.35); p.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8); body.add(p); }
  const armL = limb(0.07, 1.6, 0.07, M.moss, -0.25, 1.5, 0); body.add(armL);
  const armR = limb(0.07, 1.6, 0.07, M.moss, 0.25, 1.5, 0); body.add(armR);
  return { root, body, armL, armR, mats: M, kind: 'float', eyeH: 1.9 };
}

function buildFrog() {
  const M = mats(['moss', 'impSkin']);
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.22; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const body = boxM(0.36, 0.22, 0.44, M.moss); body.position.set(0, 0.05, 0.05); torso.add(body);
  const spots = boxM(0.3, 0.04, 0.3, M.impSkin); spots.position.set(0, 0.17, 0.05); torso.add(spots);
  const head = new THREE.Group(); head.position.set(0, 0.08, 0.3); torso.add(head);
  head.add(boxM(0.3, 0.14, 0.18, M.moss));
  eyes(head, 0xf0d030, 0.09, 0.06, 0.09, 0.06);
  const armL = limb(0.06, 0.2, 0.06, M.moss, -0.15, 0, 0.2); torso.add(armL);
  const armR = limb(0.06, 0.2, 0.06, M.moss, 0.15, 0, 0.2); torso.add(armR);
  const legL = limb(0.08, 0.24, 0.08, M.moss, -0.17, 0, -0.12); hips.add(legL);
  const legR = limb(0.08, 0.24, 0.08, M.moss, 0.17, 0, -0.12); hips.add(legR);
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'crawler', eyeH: 0.3, hipY: 0.22 };
}

// ---------------------------------------------------------------- deep enemies
function buildColossus() {
  const M = mats(['bone', 'ironDark']);
  const root = new THREE.Group(); root.scale.setScalar(2.4);
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const legL = limb(0.11, 0.95, 0.11, M.bone, -0.15, 0, 0); hips.add(legL);
  const legR = limb(0.11, 0.95, 0.11, M.bone, 0.15, 0, 0); hips.add(legR);
  hips.add(boxM(0.42, 0.14, 0.24, M.bone));
  const torso = new THREE.Group(); hips.add(torso); torso.rotation.x = 0.2;
  for (let i = 0; i < 5; i++) { const r = boxM(0.5 - i * 0.03, 0.05, 0.3, M.bone); r.position.y = 0.18 + i * 0.11; torso.add(r); }
  torso.add(at(boxM(0.08, 0.7, 0.08, M.bone), 0, 0.38, -0.08));
  const head = new THREE.Group(); head.position.set(0, 0.86, 0.05); torso.add(head);
  head.add(boxM(0.3, 0.32, 0.32, M.bone));
  const jaw = boxM(0.24, 0.08, 0.22, M.bone); jaw.position.set(0, -0.2, 0.05); head.add(jaw);
  eyes(head, 0xff5020, 0.03, 0.165, 0.07, 0.05); glowAt(head, 0xff4010, 0, 0.03, 0.2, 0.7, 0.5);
  const armL = limb(0.1, 0.9, 0.1, M.bone, -0.36, 0.72, 0); torso.add(armL);
  const armR = limb(0.1, 0.9, 0.1, M.bone, 0.36, 0.72, 0); torso.add(armR);
  const club = buildWeapon('hammer', { tint: 0xc8bca0 }); club.scale.setScalar(0.9); armR.add(handMount(club, 0.9));
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 1.8, hipY: 0.95, lean: 0.2 };
}

function buildPlague() {
  const M = mats(['flesh', 'cloth', 'moss']);
  M.flesh.color.setHex(0x9ab070);
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.8; root.add(hips);
  const legL = limb(0.16, 0.8, 0.16, M.cloth, -0.18, 0, 0); hips.add(legL);
  const legR = limb(0.16, 0.8, 0.16, M.cloth, 0.18, 0, 0); hips.add(legR);
  const torso = new THREE.Group(); hips.add(torso); torso.rotation.x = 0.15;
  const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), M.flesh); belly.position.y = 0.4; belly.scale.set(1.1, 1, 1); torso.add(belly);
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), M.moss); const a = i * 1.3; b.position.set(Math.cos(a) * 0.45, 0.3 + (i % 3) * 0.15, Math.sin(a) * 0.45); torso.add(b); }
  glowAt(torso, 0x90d040, 0, 0.4, 0, 2.2, 0.25);
  const head = new THREE.Group(); head.position.set(0, 0.95, 0.12); torso.add(head);
  head.add(boxM(0.22, 0.24, 0.22, M.flesh)); eyes(head, 0xc0ff60, 0.03, 0.115, 0.05, 0.035);
  const armL = limb(0.12, 0.7, 0.12, M.flesh, -0.5, 0.65, 0); torso.add(armL);
  const armR = limb(0.12, 0.7, 0.12, M.flesh, 0.5, 0.65, 0); torso.add(armR);
  armR.add(handMount(buildWeapon('mace', { tint: 0x708060 }), 0.7));
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 1.8, hipY: 0.8, lean: 0.15 };
}

function buildShade() {
  const M = mats(['cloth', 'ironDark']);
  M.cloth.color.setHex(0x201a28); M.cloth.transparent = true; M.ironDark.transparent = true;
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const legL = limb(0.1, 0.95, 0.1, M.cloth, -0.1, 0, 0); hips.add(legL);
  const legR = limb(0.1, 0.95, 0.1, M.cloth, 0.1, 0, 0); hips.add(legR);
  const torso = new THREE.Group(); hips.add(torso); torso.rotation.x = 0.35;
  torso.add(at(boxM(0.36, 0.6, 0.22, M.cloth), 0, 0.3, 0));
  const head = new THREE.Group(); head.position.set(0, 0.7, 0.06); torso.add(head);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 6), M.cloth); hood.position.y = 0.1; head.add(hood);
  eyes(head, 0xb070ff, 0.02, 0.13, 0.05, 0.035);
  const armL = limb(0.08, 0.66, 0.08, M.cloth, -0.26, 0.55, 0); torso.add(armL);
  const armR = limb(0.08, 0.66, 0.08, M.cloth, 0.26, 0.55, 0); torso.add(armR);
  armR.add(handMount(buildWeapon('dagger', { tint: 0x8070a0 }), 0.66));
  armL.add(handMount(buildWeapon('dagger', { tint: 0x8070a0 }), 0.66));
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 1.6, hipY: 0.95, lean: 0.35 };
}

function buildGolem() {
  const M = mats(['rock', 'lava']);
  const root = new THREE.Group(); root.scale.setScalar(1.6);
  const hips = new THREE.Group(); hips.position.y = 0.8; root.add(hips);
  const legL = limb(0.26, 0.8, 0.26, M.rock, -0.2, 0, 0); hips.add(legL);
  const legR = limb(0.26, 0.8, 0.26, M.rock, 0.2, 0, 0); hips.add(legR);
  const torso = new THREE.Group(); hips.add(torso); torso.rotation.x = 0.15;
  torso.add(at(boxM(0.8, 0.75, 0.5, M.rock), 0, 0.4, 0));
  torso.add(at(boxM(0.5, 0.12, 0.52, M.lava), 0, 0.45, 0.01));
  glowAt(torso, 0xff6020, 0, 0.45, 0.3, 1.4, 0.5);
  const head = new THREE.Group(); head.position.set(0, 0.9, 0.1); torso.add(head);
  head.add(boxM(0.32, 0.26, 0.3, M.rock)); eyes(head, 0xffa020, 0.02, 0.155, 0.07, 0.05);
  const armL = limb(0.24, 0.85, 0.24, M.rock, -0.55, 0.7, 0); torso.add(armL);
  const armR = limb(0.24, 0.85, 0.24, M.rock, 0.55, 0.7, 0); torso.add(armR);
  for (const a of [armL, armR]) { const f = boxM(0.3, 0.3, 0.3, M.lava); f.position.y = -0.9; a.add(f); }
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 2.4, hipY: 0.8, lean: 0.15 };
}

function buildGargoyle() {
  const M = mats(['stoneDark', 'stone']);
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.4; root.add(body);
  body.add(at(boxM(0.5, 0.6, 0.4, M.stoneDark), 0, 0.6, 0));
  const head = boxM(0.3, 0.28, 0.32, M.stoneDark); head.position.set(0, 1.05, 0.1); body.add(head);
  for (const s2 of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 4), M.stone); h.position.set(s2 * 0.1, 1.28, 0.05); h.rotation.x = -0.4; body.add(h); }
  eyes(body, 0xff3020, 1.07, 0.27, 0.07, 0.04);
  const wings = [];
  for (const s2 of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s2 * 0.2, 0.85, -0.15);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), litMaterial('stoneDark', { side: THREE.DoubleSide })); m.position.x = s2 * 0.5; w.add(m);
    body.add(w); wings.push(w);
  }
  const armL = limb(0.1, 0.6, 0.1, M.stoneDark, -0.3, 0.8, 0.05); body.add(armL);
  const armR = limb(0.1, 0.6, 0.1, M.stoneDark, 0.3, 0.8, 0.05); body.add(armR);
  for (const s2 of [-1, 1]) body.add(at(boxM(0.12, 0.45, 0.14, M.stoneDark), s2 * 0.14, 0.15, 0));
  return { root, body, armL, armR, wings, mats: M, kind: 'float', eyeH: 1.1 };
}

function buildMimic() {
  const M = mats(['woodDark', 'ironDark', 'flesh']);
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.55; root.add(body);
  body.add(at(boxM(1.1, 0.55, 0.7, M.woodDark), 0, -0.27, 0));
  const lid = new THREE.Group(); lid.position.set(0, 0, -0.35); body.add(lid);
  lid.add(at(boxM(1.14, 0.22, 0.74, M.woodDark), 0, 0.11, 0.35));
  for (const x of [-0.4, 0.4]) body.add(at(boxM(0.08, 0.6, 0.74, M.ironDark), x, -0.25, 0));
  const teeth = new THREE.Group(); body.add(teeth);
  for (let i = 0; i < 7; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), litMaterial('bone')); t.position.set(-0.45 + i * 0.15, 0.04, 0.33); t.rotation.x = Math.PI; teeth.add(t); }
  const tongue = boxM(0.2, 0.05, 0.5, M.flesh); tongue.position.set(0, 0.0, 0.3); teeth.add(tongue);
  const legs = [];
  for (const s2 of [-1, 1]) for (let i = 0; i < 3; i++) {
    const leg = new THREE.Group(); leg.position.set(s2 * 0.45, -0.4, 0.22 - i * 0.22);
    leg.userData.baseY = s2 > 0 ? 0 : Math.PI; leg.userData.baseZ = 0; leg.rotation.y = leg.userData.baseY;
    const up = boxM(0.4, 0.05, 0.05, M.flesh); up.position.set(0.18, 0.08, 0); up.rotation.z = 0.5; leg.add(up);
    const lo = boxM(0.05, 0.45, 0.05, M.flesh); lo.position.set(0.36, -0.1, 0); leg.add(lo);
    body.add(leg); legs.push(leg);
  }
  return { root, body, legs, lid, teeth, mats: M, kind: 'spider', eyeH: 0.7, hipY: 0.55, mimic: true };
}

function buildHoarder() {
  const M = mats(['clothBrown', 'flesh', 'cloth']);
  M.flesh.color.setHex(0x8a9a60);
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.55; root.add(hips);
  const legL = limb(0.1, 0.55, 0.1, M.flesh, -0.1, 0, 0); hips.add(legL);
  const legR = limb(0.1, 0.55, 0.1, M.flesh, 0.1, 0, 0); hips.add(legR);
  const torso = new THREE.Group(); hips.add(torso); torso.rotation.x = 0.5;
  torso.add(at(boxM(0.3, 0.4, 0.22, M.clothBrown), 0, 0.2, 0));
  const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), M.cloth); sack.position.set(0, 0.35, -0.3); torso.add(sack);
  glowAt(torso, 0xffc060, 0, 0.4, -0.3, 1.2, 0.45);
  const head = new THREE.Group(); head.position.set(0, 0.5, 0.08); torso.add(head);
  head.add(boxM(0.22, 0.2, 0.22, M.flesh));
  for (const s2 of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), M.flesh); e.position.set(s2 * 0.15, 0.05, 0); e.rotation.z = -s2 * 1.2; head.add(e); }
  eyes(head, 0xffe060, 0.02, 0.115, 0.05, 0.035);
  const armL = limb(0.07, 0.45, 0.07, M.flesh, -0.2, 0.35, 0); torso.add(armL);
  const armR = limb(0.07, 0.45, 0.07, M.flesh, 0.2, 0.35, 0); torso.add(armR);
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 1.0, hipY: 0.55, lean: 0.5 };
}
