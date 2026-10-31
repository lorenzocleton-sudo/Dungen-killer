// Enemy archetypes: stats + low-poly model builders.
// Add a new enemy by adding an entry here - the AI in enemy.js is generic.
import * as THREE from '../../lib/three.module.min.js';
import { litMaterial, basicMaterial } from '../engine/materials.js';

export const ENEMY_TYPES = {
  hollow: {
    name: 'Hollow Soldier',
    hp: 45, speed: 2.3, turn: 6, notice: 11, giveUp: 28,
    range: 1.7, reach: 2.1, damage: 12, windup: 0.55, strike: 0.15, recover: 0.75,
    radius: 0.4, height: 1.8, poise: 0, xp: 20, ashes: [4, 9],
    hitColor: [0.22, 0.05, 0.03], build: buildHollow,
  },
  ghoul: {
    name: 'Crawling Ghoul',
    hp: 28, speed: 4.1, turn: 9, notice: 9, giveUp: 24,
    range: 1.35, reach: 1.8, damage: 7, windup: 0.3, strike: 0.12, recover: 0.5,
    radius: 0.45, height: 0.9, poise: 0, xp: 14, ashes: [2, 6],
    hitColor: [0.18, 0.12, 0.04], build: buildGhoul,
  },
  knight: {
    name: 'Fallen Knight',
    hp: 140, speed: 1.75, turn: 3, notice: 13, giveUp: 32,
    range: 2.3, reach: 2.8, damage: 26, windup: 0.95, strike: 0.2, recover: 1.1,
    radius: 0.55, height: 2.3, poise: 35, xp: 60, ashes: [18, 30], armored: true,
    hitColor: [0.6, 0.45, 0.25], build: buildKnight,
  },
};

// Per-enemy material clones so each one can flash when hit.
function mats(names) {
  const out = {};
  for (const n of names) out[n] = litMaterial(n, { unique: true });
  return out;
}

const boxM = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

/** Limb that pivots at its top: returns { pivot, mesh }. */
function limb(w, h, d, m, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const mesh = boxM(w, h, d, m);
  mesh.position.y = -h / 2;
  pivot.add(mesh);
  return pivot;
}

function eyes(parent, color, y, z, spread = 0.07, size = 0.045) {
  const m = basicMaterial(color);
  for (const s of [-1, 1]) {
    const e = boxM(size, size * 0.7, 0.02, m);
    e.position.set(s * spread, y, z);
    parent.add(e);
  }
}

function buildHollow() {
  const M = mats(['flesh', 'cloth', 'iron', 'beam']);
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const legL = limb(0.15, 0.95, 0.16, M.cloth, -0.13, 0, 0); hips.add(legL);
  const legR = limb(0.15, 0.95, 0.16, M.cloth, 0.13, 0, 0); hips.add(legR);
  const torso = new THREE.Group(); hips.add(torso);
  torso.rotation.x = 0.25; // hunched
  const chest = boxM(0.48, 0.62, 0.28, M.flesh); chest.position.y = 0.31; torso.add(chest);
  const rag = boxM(0.52, 0.4, 0.31, M.cloth); rag.position.y = 0.12; torso.add(rag);
  const ribs = boxM(0.5, 0.06, 0.3, M.iron); ribs.position.y = 0.48; torso.add(ribs);
  const head = new THREE.Group(); head.position.set(0, 0.72, 0.04); torso.add(head);
  const skull = boxM(0.26, 0.3, 0.27, M.flesh); skull.position.y = 0.1; head.add(skull);
  const jaw = boxM(0.2, 0.08, 0.2, M.flesh); jaw.position.set(0, -0.06, 0.04); head.add(jaw);
  eyes(head, 0xc8501a, 0.13, 0.14);
  const armL = limb(0.11, 0.7, 0.12, M.flesh, -0.32, 0.58, 0); torso.add(armL);
  const armR = limb(0.11, 0.7, 0.12, M.flesh, 0.32, 0.58, 0); torso.add(armR);
  // broken sword in the right hand
  const sword = new THREE.Group(); sword.position.y = -0.68; armR.add(sword);
  const blade = boxM(0.05, 0.75, 0.02, M.iron); blade.position.set(0, -0.05, 0.36); blade.rotation.x = Math.PI / 2; sword.add(blade);
  const guard = boxM(0.22, 0.04, 0.05, M.iron); guard.position.z = 0; sword.add(guard);
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 1.55 };
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
  // four long, bent limbs
  const armL = limb(0.09, 0.75, 0.09, M.flesh, -0.26, 0.05, 0.62); torso.add(armL);
  const armR = limb(0.09, 0.75, 0.09, M.flesh, 0.26, 0.05, 0.62); torso.add(armR);
  armL.rotation.x = armR.rotation.x = -0.35;
  const legL = limb(0.1, 0.6, 0.1, M.flesh, -0.22, 0.0, -0.12); hips.add(legL);
  const legR = limb(0.1, 0.6, 0.1, M.flesh, 0.22, 0.0, -0.12); hips.add(legR);
  legL.rotation.x = legR.rotation.x = 0.3;
  const rag = boxM(0.45, 0.2, 0.5, M.cloth); rag.position.set(0, -0.08, 0); torso.add(rag);
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'crawler', eyeH: 0.7 };
}

function buildKnight() {
  const M = mats(['ironPlate', 'iron', 'clothRed', 'ironDark', 'beam']);
  const root = new THREE.Group();
  root.scale.setScalar(1.22);
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const legL = limb(0.19, 0.95, 0.2, M.ironDark, -0.15, 0, 0); hips.add(legL);
  const legR = limb(0.19, 0.95, 0.2, M.ironDark, 0.15, 0, 0); hips.add(legR);
  const torso = new THREE.Group(); hips.add(torso);
  torso.rotation.x = 0.08;
  const chest = boxM(0.6, 0.66, 0.36, M.ironPlate); chest.position.y = 0.34; torso.add(chest);
  const tabard = boxM(0.4, 0.75, 0.38, M.clothRed); tabard.position.y = 0.05; torso.add(tabard);
  for (const s of [-1, 1]) {
    const pauldron = boxM(0.3, 0.16, 0.36, M.iron); pauldron.position.set(s * 0.38, 0.66, 0); pauldron.rotation.z = s * -0.35; torso.add(pauldron);
  }
  const head = new THREE.Group(); head.position.set(0, 0.8, 0); torso.add(head);
  const helm = boxM(0.32, 0.38, 0.34, M.iron); helm.position.y = 0.12; head.add(helm);
  const crest = boxM(0.05, 0.12, 0.34, M.ironDark); crest.position.y = 0.36; head.add(crest);
  const slit = boxM(0.24, 0.035, 0.02, basicMaterial(0x050302)); slit.position.set(0, 0.15, 0.175); head.add(slit);
  eyes(head, 0xd06020, 0.15, 0.18, 0.06, 0.035);
  const armL = limb(0.16, 0.72, 0.17, M.ironDark, -0.42, 0.6, 0); torso.add(armL);
  const armR = limb(0.16, 0.72, 0.17, M.ironDark, 0.42, 0.6, 0); torso.add(armR);
  // tower shield on the left arm
  const shield = boxM(0.08, 0.95, 0.6, M.ironPlate); shield.position.set(-0.08, -0.45, 0.25); armL.add(shield);
  armL.rotation.set(-0.5, 0, 0.1);
  // greatsword in the right hand
  const sword = new THREE.Group(); sword.position.y = -0.7; armR.add(sword);
  const blade = boxM(0.09, 1.35, 0.025, M.iron); blade.position.set(0, -0.05, 0.72); blade.rotation.x = Math.PI / 2; sword.add(blade);
  const guard = boxM(0.36, 0.06, 0.07, M.ironDark); sword.add(guard);
  return { root, hips, torso, head, armL, armR, legL, legR, mats: M, kind: 'biped', eyeH: 2.2, heavy: true };
}
