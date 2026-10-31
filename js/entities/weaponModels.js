// Shared low-poly weapon models for the player's view model and for enemies.
//
// ONE convention for every model (so idle, swing, block and inventory agree):
//   * the grip is at the origin, the hand closes around it
//   * the weapon extends along +Y (pommel/butt slightly below 0, head at the top)
//   * the edge / striking face / spear point side faces +Z
// Holders only rotate the whole model: the first-person mount turns +Z toward
// the swing direction, an enemy hand mount turns +Y forward and +Z downward
// (the direction an overhead chop travels).
import * as THREE from '../../lib/three.module.min.js';
import { litMaterial, basicMaterial } from '../engine/materials.js';

const B = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };

/** Material-tinted metal (rusted .. hearthforged). */
function metal(tint, tex = 'iron') {
  const m = litMaterial(tex, tint != null ? { color: tint } : {});
  return m;
}

/**
 * Build a weapon. o: { tint (metal colour), glow (emissive edge colour), len (scale) }.
 * Returns a THREE.Group following the convention above.
 */
export function buildWeapon(type, o = {}) {
  const g = new THREE.Group();
  const iron = metal(o.tint), dark = litMaterial('ironDark'), wood = litMaterial('woodDark'), leather = litMaterial('clothBrown');
  const glow = o.glow != null ? basicMaterial(o.glow) : null;
  const blade = (len, w, base = 0.11) => {
    // edges along +-Z (the convention), flat sides facing +-X
    g.add(B(0.018, len, w, iron, 0, base + len / 2, 0));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 0.12, 4), iron);
    tip.position.y = base + len + 0.06; tip.rotation.y = Math.PI / 4; tip.scale.x = 0.35; g.add(tip);
    if (glow) g.add(B(0.006, len * 0.85, w * 1.2, glow, 0.011, base + len / 2, 0));
  };
  switch (type) {
    case 'axe': case 'greataxe': {
      const big = type === 'greataxe';
      const L = big ? 1.25 : 0.95;
      g.add(B(0.045, L, 0.045, wood, 0, L / 2 - 0.2));            // haft: grip low, head at the top
      const hy = L - 0.32;
      // head: cheek behind the haft, a broad bit flaring FORWARD (+Z) into a curved edge
      g.add(B(0.035, big ? 0.3 : 0.22, 0.14, iron, 0, hy, 0.07));
      g.add(B(0.03, big ? 0.46 : 0.34, 0.1, iron, 0, hy, 0.19));
      g.add(B(0.022, big ? 0.52 : 0.4, 0.04, iron, 0, hy, 0.26));   // the edge
      if (glow) g.add(B(0.03, big ? 0.5 : 0.38, 0.012, glow, 0, hy, 0.285));
      g.add(B(0.06, 0.08, 0.06, dark, 0, hy + (big ? 0.17 : 0.13), 0)); // butt cap
      if (big) g.add(B(0.03, 0.14, 0.12, iron, 0, hy, -0.1));          // back spike
      break;
    }
    case 'mace': {
      g.add(B(0.045, 0.62, 0.045, wood, 0, 0.18));
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), iron); head.position.y = 0.56; g.add(head);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const s = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), iron); s.position.set(Math.cos(a) * 0.11, 0.56, Math.sin(a) * 0.11); s.rotation.set(Math.sin(a) * Math.PI / 2, 0, -Math.cos(a) * Math.PI / 2); g.add(s); }
      if (glow) { const gl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), glow); gl.position.y = 0.56; g.add(gl); }
      break;
    }
    case 'warhammer': case 'hammer': {
      const big = type === 'hammer';
      const L = big ? 1.3 : 1.0;
      g.add(B(0.05, L, 0.05, big ? dark : wood, 0, L / 2 - 0.22));
      const hy = L - 0.3;
      g.add(B(0.16, 0.16, big ? 0.5 : 0.36, iron, 0, hy, 0.02));       // head runs along Z
      g.add(B(0.2, 0.2, 0.06, iron, 0, hy, big ? 0.27 : 0.2));           // flat striking face toward +Z
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), iron); spike.position.set(0, hy, big ? -0.3 : -0.24); spike.rotation.x = -Math.PI / 2; g.add(spike);
      if (glow) g.add(B(0.18, 0.18, 0.01, glow, 0, hy, (big ? 0.27 : 0.2) + 0.035));
      break;
    }
    case 'scythe': {
      g.add(B(0.04, 1.5, 0.04, wood, 0, 0.5));
      // blade leaves the top of the snath and curves FORWARD then down (+Z)
      const segs = 5;
      for (let i = 0; i < segs; i++) {
        const t = i / segs, a = 0.3 + t * 1.0;
        const seg = B(0.02, 0.06, 0.16, iron, 0, 1.22 - Math.sin(t * 1.2) * 0.12, 0.06 + i * 0.13);
        seg.rotation.x = a * 0.6; g.add(seg);
      }
      if (glow) g.add(B(0.006, 0.05, 0.6, glow, 0.012, 1.16, 0.33));
      g.add(B(0.05, 0.08, 0.05, dark, 0, 1.26));
      break;
    }
    case 'spear': case 'halberd': case 'trident': {
      const L = type === 'halberd' ? 1.7 : 1.6;
      g.add(B(0.04, L, 0.04, wood, 0, L / 2 - 0.45));
      const top = L - 0.45;
      if (type === 'trident') {
        g.add(B(0.26, 0.04, 0.04, iron, 0, top + 0.02));
        for (const x of [-0.11, 0, 0.11]) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.28, 4), iron); p.position.set(x, top + 0.18, 0); g.add(p); }
      } else {
        const p = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.34, 4), iron); p.position.y = top + 0.17; p.scale.z = 0.4; g.add(p);
        if (type === 'halberd') {
          g.add(B(0.025, 0.3, 0.2, iron, 0, top - 0.05, 0.12));          // axe blade forward
          g.add(B(0.02, 0.34, 0.04, iron, 0, top - 0.05, 0.23));
          const hook = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 4), iron); hook.position.set(0, top - 0.05, -0.1); hook.rotation.x = -Math.PI / 2; g.add(hook);
        }
      }
      if (glow) g.add(B(0.05, 0.3, 0.01, glow, 0, top + 0.12, 0.02));
      break;
    }
    case 'dagger': case 'knives':
      blade(type === 'knives' ? 0.24 : 0.3, 0.04, 0.07);
      g.add(B(0.04, 0.03, 0.12, dark, 0, 0.065));
      g.add(B(0.035, 0.12, 0.035, leather, 0, 0.0));
      break;
    case 'twinblades':
      blade(0.5, 0.045, 0.09);
      g.add(B(0.05, 0.035, 0.18, dark, 0, 0.08));
      g.add(B(0.035, 0.15, 0.035, leather, 0, 0.0));
      break;
    case 'whip': {
      g.add(B(0.04, 0.24, 0.04, leather, 0, 0.04));
      for (let i = 0; i < 8; i++) { const s = B(0.025, 0.14, 0.025, leather, 0, 0.2 + i * 0.12, Math.sin(i * 0.6) * 0.05 * i); s.rotation.x = Math.sin(i * 0.6) * 0.3; g.add(s); }
      break;
    }
    case 'staff': case 'wand': {
      const L = type === 'staff' ? 1.5 : 0.42;
      g.add(B(type === 'staff' ? 0.045 : 0.03, L, type === 'staff' ? 0.045 : 0.03, wood, 0, L / 2 - (type === 'staff' ? 0.5 : 0.08)));
      const top = L - (type === 'staff' ? 0.5 : 0.08);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(type === 'staff' ? 0.09 : 0.05, 0), glow || basicMaterial(0x8ab0ff));
      orb.position.y = top + 0.08; g.add(orb);
      if (type === 'staff') for (const s of [-1, 1]) { const p = B(0.02, 0.18, 0.02, iron, s * 0.06, top + 0.02); p.rotation.z = s * 0.3; g.add(p); }
      g.userData.tip = new THREE.Vector3(0, top + 0.08, 0);
      break;
    }
    case 'tome': {
      g.add(B(0.05, 0.28, 0.22, leather, 0, 0.12, 0.05));
      g.add(B(0.055, 0.25, 0.2, litMaterial('plaster'), 0.004, 0.12, 0.06));
      if (glow) g.add(B(0.06, 0.08, 0.08, glow, 0, 0.16, 0.06));
      g.userData.tip = new THREE.Vector3(0, 0.3, 0.05);
      break;
    }
    case 'lantern': {
      g.add(B(0.03, 0.18, 0.03, dark, 0, 0.09));
      g.add(B(0.16, 0.22, 0.16, dark, 0, 0.3));
      const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), glow || basicMaterial(0xffa040)); f.position.y = 0.3; g.add(f);
      g.userData.tip = new THREE.Vector3(0, 0.3, 0);
      break;
    }
    case 'shield': {
      g.add(B(0.06, 0.12, 0.06, leather, 0, 0));
      g.add(B(0.62, 0.8, 0.06, iron, 0, 0.1, 0.06));     // face toward +Z
      g.add(B(0.68, 0.06, 0.07, dark, 0, 0.5, 0.06));
      g.add(B(0.14, 0.14, 0.04, dark, 0, 0.1, 0.11));     // boss
      if (glow) g.add(B(0.4, 0.04, 0.01, glow, 0, 0.1, 0.1));
      break;
    }
    case 'crossbow': {
      g.add(B(0.05, 0.08, 0.6, wood, 0, 0.05, 0.12));      // stock forward along +Z
      g.add(B(0.62, 0.04, 0.04, iron, 0, 0.08, 0.38));     // prod
      g.add(B(0.6, 0.008, 0.008, basicMaterial(0xc8c0a8), 0, 0.09, 0.3));
      g.userData.tip = new THREE.Vector3(0, 0.1, 0.45);
      break;
    }
    case 'bow': {
      const bow = buildBow({ len: o.len || 1.0, wood: o.tint != null ? metal(o.tint, 'woodDark') : null });
      g.add(bow.group);
      g.userData.bow = bow;
      break;
    }
    default: { // swords
      const long = type === 'longsword', great = type === 'greatsword', ash = type === 'ashblade';
      const len = great ? 1.3 : long ? 1.0 : ash ? 0.9 : 0.78;
      const w = great ? 0.075 : long ? 0.05 : 0.055;
      g.add(B(0.018, len, w, iron, 0, 0.11 + len / 2, 0));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 0.12, 4), iron);
      tip.position.y = 0.11 + len + 0.06; tip.rotation.y = Math.PI / 4; tip.scale.x = 0.35; g.add(tip);
      g.add(B(0.06, 0.045, great ? 0.36 : long ? 0.3 : 0.24, dark, 0, 0.1));   // crossguard spans the edge plane
      g.add(B(0.04, great ? 0.34 : long ? 0.26 : 0.2, 0.04, wood, 0, great ? -0.06 : long ? -0.02 : 0));
      g.add(B(0.06, 0.06, 0.06, dark, 0, great ? -0.24 : long ? -0.17 : -0.12));
      if (ash || glow) g.add(B(0.008, len * 0.85, w * 1.3, glow || basicMaterial(0xff6a20), 0.012, 0.11 + len / 2, 0));
    }
  }
  return g;
}

/**
 * A recurve bow held at its grip (origin). The bow stands along Y; the limbs
 * curve AWAY from the archer (toward +Z, the target) and the string runs
 * straight between the tips on the archer's side (-Z). setDraw(k) pulls the
 * nock back toward the archer (k 0..1) so the string becomes a V.
 */
export function buildBow(o = {}) {
  const len = o.len || 1.0, half = len / 2;
  const wood = o.wood || litMaterial('wood', { color: 0xc8a070 });
  const grip = litMaterial('clothBrown');
  const group = new THREE.Group();
  group.add(B(0.05, 0.14, 0.05, grip, 0, 0, 0));
  const tips = [];
  for (const s of [1, -1]) {
    // each limb: 4 segments following a curve that bends forward (+Z) then back at the tip (recurve)
    let prev = new THREE.Vector3(0, s * 0.06, 0);
    const N = 4;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const y = s * (0.06 + (half - 0.06) * t);
      const z = Math.sin(t * Math.PI * 0.85) * 0.13 * len - (t > 0.85 ? (t - 0.85) * 0.25 : 0);
      const p = new THREE.Vector3(0, y, z);
      const mid = prev.clone().add(p).multiplyScalar(0.5);
      const segLen = prev.distanceTo(p);
      const seg = B(0.035 - t * 0.012, segLen + 0.01, 0.03, wood);
      seg.position.copy(mid);
      seg.rotation.x = Math.atan2(p.z - prev.z, p.y - prev.y);
      group.add(seg);
      prev = p;
    }
    tips.push(prev.clone());
  }
  // string: tip -> nock -> tip (a straight line at rest, a V when drawn)
  const brace = -0.05;               // string sits slightly behind the grip (archer side)
  const top = tips[0], bot = tips[1];
  const sgeo = new THREE.BufferGeometry();
  const pos = new Float32Array(9);
  sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const string = new THREE.Line(sgeo, new THREE.LineBasicMaterial({ color: 0xd8d0b8 }));
  string.frustumCulled = false;
  group.add(string);
  // arrow resting on the bow, pointing forward (+Z), shown while nocked
  const arrow = new THREE.Group();
  arrow.add(B(0.02, 0.02, 0.72, litMaterial('woodDark'), 0, 0, 0.36));
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4), litMaterial('iron')); head.rotation.x = Math.PI / 2; head.position.z = 0.75; arrow.add(head);
  arrow.add(B(0.05, 0.01, 0.1, basicMaterial(0xa04030), 0, 0, 0.06));
  arrow.visible = false;
  group.add(arrow);
  const maxDraw = 0.48 * len;
  const nock = new THREE.Vector3();
  const setDraw = (k) => {
    k = Math.max(0, Math.min(1, k));
    nock.set(0, 0, brace - k * maxDraw);
    pos[0] = top.x; pos[1] = top.y; pos[2] = top.z + brace * 0.3;
    pos[3] = nock.x; pos[4] = nock.y; pos[5] = nock.z;
    pos[6] = bot.x; pos[7] = bot.y; pos[8] = bot.z + brace * 0.3;
    sgeo.attributes.position.needsUpdate = true;
    arrow.position.set(0.02, 0.0, nock.z);
  };
  setDraw(0);
  return {
    group, string, arrow, setDraw,
    /** World position of the nocked arrow's head (for launching). */
    arrowTip(out = new THREE.Vector3()) { return arrow.localToWorld(out.set(0, 0, 0.78)); },
  };
}

/** Enemy hand mount: model +Y points forward along a hanging arm, +Z (edge) down. */
export function handMount(model, armLen) {
  const m = new THREE.Group();
  m.userData.weapon = true;     // excluded from body bounds (collision radius)
  m.position.y = -armLen;
  m.rotation.x = Math.PI / 2;
  m.add(model);
  return m;
}
