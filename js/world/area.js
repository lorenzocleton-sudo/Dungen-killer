// Base class for a game area (town, dungeon, future zones). An area owns its
// scene, collision, light pool, particles, portals and (optionally) enemies.
import * as THREE from '../../lib/three.module.min.js';
import { CollisionWorld } from '../engine/collision.js';
import { StaticBatcher } from '../engine/geometry.js';
import { TorchLightPool } from '../engine/lights.js';
import { ParticleSystem } from '../engine/particles.js';

export class Area {
  constructor(game, id, name) {
    this.game = game;
    this.id = id;
    this.name = name;
    this.hostile = false;
    this.scene = new THREE.Scene();
    this.collision = new CollisionWorld();
    this.batcher = new StaticBatcher();
    // Every area has the same light rig (hemi + sun + pooled points + lantern)
    // so materials compile to the same shader variants everywhere.
    this.hemi = new THREE.HemisphereLight(0x808080, 0x202020, 0.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 0);
    this.sun.position.set(-30, 60, 20);
    this.scene.add(this.sun, this.sun.target);
    this.lights = new TorchLightPool(this.scene, 6);
    // player-carried lantern: a soft warm light that follows the camera
    this.lantern = new THREE.PointLight(0xffa860, 0, 9, 1.4);
    this.scene.add(this.lantern);
    this.lanternIntensity = 0;
    this.glow = new ParticleSystem(this.scene, 500, true);   // embers, sparks, magic
    this.dust = new ParticleSystem(this.scene, 400, false);  // dust, ash, gore
    this.portals = [];
    this.emitters = [];   // { pos, rate, acc, fn }
    this.animated = [];   // objects with update(dt, t)
    this.enemies = [];
    this.pickups = [];
    this.spawns = {};     // named spawn points: { pos, yaw }
    this.time = 0;
    this.dustTimer = 0;
    this.dustColor = [0.42, 0.40, 0.36];
    this.ambientDust = 1;
  }

  /** Build static geometry. Subclasses add to this.batcher then call finish(). */
  build() {}

  finish() {
    this.batcher.build(this.scene);
  }

  addEmitter(pos, rate, fn) {
    const e = { pos: pos.clone(), rate, acc: Math.random(), fn };
    this.emitters.push(e);
    return e;
  }

  onEnter(from) {}
  onExit() {}

  update(dt, player) {
    this.time += dt;
    const pp = player.pos;
    this.lights.update(dt, pp);
    this.lantern.position.set(pp.x, player.eyeY + 0.2, pp.z).addScaledVector(player.forward, 0.4);
    this.lantern.intensity = this.lanternIntensity * (0.95 + Math.sin(this.time * 7) * 0.03 + Math.sin(this.time * 17) * 0.02);

    for (const e of this.emitters) {
      if (Math.abs(e.pos.x - pp.x) > 24 || Math.abs(e.pos.z - pp.z) > 24) continue;
      e.acc += dt * e.rate;
      while (e.acc >= 1) { e.acc -= 1; e.fn(this, e.pos); }
    }
    for (const a of this.animated) a.update(dt, this.time, player);

    // ambient dust motes drifting around the player
    this.dustTimer += dt * 14 * this.ambientDust;
    while (this.dustTimer > 1) {
      this.dustTimer -= 1;
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 7;
      const c = this.dustColor, f = 0.7 + Math.random() * 0.5;
      this.dust.emit(pp.x + Math.cos(a) * r, pp.y + Math.random() * 3.5, pp.z + Math.sin(a) * r,
        (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.2,
        4 + Math.random() * 3, [c[0] * f, c[1] * f, c[2] * f], 0.03, 0, 0);
    }
    const rh = this.game.renderer.height;
    this.glow.update(dt, this.scene, rh);
    this.dust.update(dt, this.scene, rh);
  }

  /** Check portal triggers. Returns the portal the player stands in, if any. */
  checkPortals(player) {
    for (const p of this.portals) {
      const dx = player.pos.x - p.pos.x, dz = player.pos.z - p.pos.z;
      const dy = player.pos.y - p.pos.y;
      if (dx * dx + dz * dz < p.radius * p.radius && Math.abs(dy) < 2) return p;
    }
    return null;
  }

  /** Nearest portal distance (for "enter the portal" hints). */
  nearestPortal(player) {
    let best = null, bd = Infinity;
    for (const p of this.portals) {
      const d = player.pos.distanceTo(p.pos);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { portal: best, dist: bd } : null;
  }
}
