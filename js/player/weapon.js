// First-person weapon view model + swing animation + slash trail. Lives in
// the overlay scene (drawn after the world with a cleared depth buffer so it
// never clips into walls). The model changes with the equipped weapon.
import * as THREE from '../../lib/three.module.min.js';
import { litMaterial, basicMaterial } from '../engine/materials.js';

const POSES = {
  rest: { p: [0.36, -0.42, -0.66], r: [-0.6, 0.25, -0.3] },
  windup: { p: [0.5, -0.18, -0.55], r: [-0.35, -0.55, -1.25] },
  end: { p: [-0.4, -0.42, -0.58], r: [0.35, 0.9, 1.45] },
};
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const BASE_DURATION = 0.48;

// ------------------------------------------------------------ weapon models
const box = (w, h, d, m, y = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.y = y; return o; };

export function buildWeaponModel(model) {
  const g = new THREE.Group();
  const iron = litMaterial('iron'), dark = litMaterial('ironDark'), grip = litMaterial('woodDark');
  const hand = box(0.1, 0.12, 0.11, litMaterial('clothBrown'));
  g.add(hand);
  if (model === 'axe') {
    g.add(box(0.045, 0.95, 0.045, grip, 0.3));
    const head = box(0.03, 0.26, 0.3, iron, 0.66); head.position.z = 0.12; g.add(head);
    const edge = box(0.02, 0.34, 0.06, iron, 0.66); edge.position.z = 0.29; g.add(edge);
    g.add(box(0.06, 0.08, 0.06, dark, 0.8));
  } else {
    const long = model === 'longsword', ash = model === 'ashblade';
    const len = long ? 1.0 : ash ? 0.9 : 0.78;
    g.add(box(long ? 0.05 : 0.055, len, 0.018, iron, 0.11 + len / 2));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.039, 0.12, 4), iron);
    tip.position.y = 0.11 + len + 0.06; tip.rotation.y = Math.PI / 4; tip.scale.z = 0.35; g.add(tip);
    g.add(box(long ? 0.3 : 0.24, 0.045, 0.06, dark, 0.1));
    g.add(box(0.04, long ? 0.26 : 0.2, 0.04, grip, long ? -0.02 : 0));
    g.add(box(0.06, 0.06, 0.06, dark, long ? -0.17 : -0.12));
    if (ash) { // glowing ember edge
      const glow = box(0.07, len * 0.85, 0.008, basicMaterial(0xff6a20), 0.11 + len / 2);
      glow.position.z = 0.012; g.add(glow);
    }
  }
  g.scale.setScalar(0.8);
  return g;
}

// ------------------------------------------------------------ slash trail
const SLASH_VS = `
attribute float aT; attribute float aR;
varying float vT; varying float vR;
void main(){ vT = aT; vR = aR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SLASH_FS = `
uniform float uHead; uniform float uFade; uniform vec3 uColor;
varying float vT; varying float vR;
void main(){
  float behind = uHead - vT;
  if (behind < 0.0 || behind > 0.55) discard;
  float a = pow(1.0 - behind / 0.55, 1.6);
  // thin bright edge on the outside of the arc, fading inward
  a *= smoothstep(0.0, 0.8, vR) * (1.0 - smoothstep(0.85, 1.0, vR));
  a *= uFade * 0.5 * (1.0 - smoothstep(0.85, 1.0, vT));
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

function slashGeometry() {
  const seg = 24, pos = [], t = [], r = [], idx = [];
  const cx = 0.1, cy = 0.38, a0 = -0.15, a1 = -2.75;
  for (let i = 0; i <= seg; i++) {
    const k = i / seg, a = a0 + (a1 - a0) * k;
    for (const [rad, rr] of [[0.8, 0], [0.92, 1]]) {
      pos.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.85, -0.95 + Math.sin(k * Math.PI) * 0.12);
      t.push(k); r.push(rr);
    }
    if (i < seg) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(r, 1));
  g.setIndex(idx);
  return g;
}

export class Weapon {
  constructor(camera, overlayScene) {
    this.root = new THREE.Group();
    camera.add(this.root);
    this.setModel('sword');

    this.slashUniforms = { uHead: { value: 0 }, uFade: { value: 0 }, uColor: { value: new THREE.Color(0.9, 0.82, 0.7) } };
    this.slash = new THREE.Mesh(slashGeometry(), new THREE.ShaderMaterial({
      vertexShader: SLASH_VS, fragmentShader: SLASH_FS, uniforms: this.slashUniforms,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    }));
    this.slash.frustumCulled = false;
    this.slash.renderOrder = 5;
    camera.add(this.slash);

    // overlay lighting, driven by the current area
    this.hemi = new THREE.HemisphereLight(0x908070, 0x201810, 1);
    this.point = new THREE.PointLight(0xffa860, 1, 3, 1);
    this.point.position.set(0.3, 0.2, 0.2);
    overlayScene.add(this.hemi);
    camera.add(this.point);

    this.t = -1;
    this.speed = 1;          // attack speed multiplier
    this.cooldown = 0;
    this.onStrike = null;
    this.bob = 0;
  }

  setModel(model) {
    if (this.model === model) return;
    this.model = model;
    if (this.sword) { this.root.remove(this.sword); this.sword.traverse((o) => o.geometry && o.geometry.dispose()); }
    this.sword = buildWeaponModel(model);
    this.root.add(this.sword);
  }

  /** Fiery trail when the Path of Ash is in use. */
  setSlashColor(fire) {
    this.slashUniforms.uColor.value.setRGB(...(fire ? [1.0, 0.55, 0.2] : [0.85, 0.8, 0.72]));
  }

  get ready() { return this.t < 0 && this.cooldown <= 0; }

  swing() {
    if (!this.ready) return false;
    this.t = 0;
    this._struck = false;
    this.slash.rotation.z = (Math.random() - 0.5) * 0.35;
    return true;
  }

  setLighting(hemi, point) {
    this.hemi.intensity = hemi;
    this.point.intensity = point;
  }

  update(dt, player) {
    if (this.cooldown > 0) this.cooldown -= dt;
    let pose;
    const D = BASE_DURATION / this.speed;
    if (this.t >= 0) {
      this.t += dt * this.speed;
      const t = this.t;
      if (t < 0.13) pose = blend(POSES.rest, POSES.windup, ease(t / 0.13));
      else if (t < 0.27) pose = blend(POSES.windup, POSES.end, ease((t - 0.13) / 0.14));
      else pose = blend(POSES.end, POSES.rest, ease(Math.min(1, (t - 0.27) / (BASE_DURATION - 0.27))));
      if (!this._struck && t >= 0.2) { this._struck = true; if (this.onStrike) this.onStrike(); }
      // slash trail follows the blade during the strike, then fades
      const head = (t - 0.11) / 0.16;
      this.slashUniforms.uHead.value = Math.min(1.55, head);
      this.slashUniforms.uFade.value = t < 0.11 ? 0 : Math.max(0, 1 - Math.max(0, t - 0.27) / 0.12);
      if (t >= BASE_DURATION) { this.t = -1; this.cooldown = 0.08 / this.speed; }
    } else {
      pose = POSES.rest;
      this.slashUniforms.uFade.value = 0;
    }
    void D;
    this.bob += dt * (player.moving ? (player.sprinting ? 14 : 9) : 1.6);
    const amp = player.moving ? (player.sprinting ? 0.03 : 0.018) : 0.006;
    this.root.position.set(pose.p[0] + Math.cos(this.bob * 0.5) * amp, pose.p[1] + Math.sin(this.bob) * amp - (player.sprinting && this.t < 0 ? 0.06 : 0), pose.p[2]);
    this.root.rotation.set(pose.r[0], pose.r[1], pose.r[2]);
    this.root.visible = !player.dead;
    this.slash.visible = !player.dead;
  }
}

function blend(a, b, t) {
  return {
    p: [lerp(a.p[0], b.p[0], t), lerp(a.p[1], b.p[1], t), lerp(a.p[2], b.p[2], t)],
    r: [lerp(a.r[0], b.r[0], t), lerp(a.r[1], b.r[1], t), lerp(a.r[2], b.r[2], t)],
  };
}
