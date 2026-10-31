// First-person weapon view model + swing animation. Lives in the overlay
// scene (drawn after the world with a cleared depth buffer so it never
// clips into walls).
import * as THREE from '../../lib/three.module.min.js';
import { litMaterial } from '../engine/materials.js';

const POSES = {
  rest: { p: [0.34, -0.36, -0.62], r: [0.25, 0.15, -0.12] },
  windup: { p: [0.52, -0.12, -0.5], r: [-0.25, -0.55, -1.25] },
  end: { p: [-0.4, -0.42, -0.58], r: [0.35, 0.9, 1.45] },
};
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export class Weapon {
  constructor(camera, overlayScene) {
    this.root = new THREE.Group();
    camera.add(this.root);
    // sword: blade points up the local Y axis from the grip
    const iron = litMaterial('iron'), dark = litMaterial('ironDark'), grip = litMaterial('woodDark');
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.78, 0.018), iron);
    blade.position.y = 0.5;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.039, 0.12, 4), iron);
    tip.position.y = 0.95; tip.rotation.y = Math.PI / 4; tip.scale.z = 0.35;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.06), dark);
    guard.position.y = 0.1;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), grip);
    const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), dark);
    pommel.position.y = -0.12;
    this.sword = new THREE.Group();
    this.sword.add(blade, tip, guard, handle, pommel);
    this.root.add(this.sword);
    // gloved hand
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.11), litMaterial('clothBrown'));
    this.sword.add(hand);

    // overlay lighting, driven by the current area
    this.hemi = new THREE.HemisphereLight(0x908070, 0x201810, 1);
    this.point = new THREE.PointLight(0xffa860, 1, 3, 1);
    this.point.position.set(0.3, 0.2, 0.2);
    overlayScene.add(this.hemi);
    camera.add(this.point);

    this.t = -1;           // swing time, -1 when idle
    this.duration = 0.48;
    this.strikeAt = 0.2;
    this.cooldown = 0;
    this.onStrike = null;
    this.bob = 0;
    this.trail = [];
  }

  get ready() { return this.t < 0 && this.cooldown <= 0; }

  swing() {
    if (!this.ready) return false;
    this.t = 0;
    this._struck = false;
    return true;
  }

  setLighting(hemi, point) {
    this.hemi.intensity = hemi;
    this.point.intensity = point;
  }

  update(dt, player) {
    if (this.cooldown > 0) this.cooldown -= dt;
    let pose;
    if (this.t >= 0) {
      this.t += dt;
      const t = this.t;
      if (t < 0.13) pose = blend(POSES.rest, POSES.windup, ease(t / 0.13));
      else if (t < 0.27) pose = blend(POSES.windup, POSES.end, ease((t - 0.13) / 0.14));
      else pose = blend(POSES.end, POSES.rest, ease(Math.min(1, (t - 0.27) / (this.duration - 0.27))));
      if (!this._struck && t >= this.strikeAt) { this._struck = true; if (this.onStrike) this.onStrike(); }
      if (t >= this.duration) { this.t = -1; this.cooldown = 0.08; }
    } else pose = POSES.rest;

    // idle sway + walk bob
    this.bob += dt * (player.moving ? 9 : 1.6);
    const amp = player.moving ? 0.018 : 0.006;
    this.root.position.set(pose.p[0] + Math.cos(this.bob * 0.5) * amp, pose.p[1] + Math.sin(this.bob) * amp, pose.p[2]);
    this.root.rotation.set(pose.r[0], pose.r[1], pose.r[2]);
    this.root.visible = !player.dead;
  }
}

function blend(a, b, t) {
  return {
    p: [lerp(a.p[0], b.p[0], t), lerp(a.p[1], b.p[1], t), lerp(a.p[2], b.p[2], t)],
    r: [lerp(a.r[0], b.r[0], t), lerp(a.r[1], b.r[1], t), lerp(a.r[2], b.r[2], t)],
  };
}
