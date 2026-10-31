// Fixed-size pool of point lights that follows the torches nearest to the
// player. Keeping the light count constant avoids shader recompiles and keeps
// mobile GPUs happy even with dozens of torches in a level.
import * as THREE from '../../lib/three.module.min.js';

export class TorchLightPool {
  constructor(scene, count = 6) {
    this.lights = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xff9040, 0, 12, 1.15);
      scene.add(l);
      this.lights.push(l);
    }
    this.sources = [];
    this.time = 0;
    this.scale = 1; // global multiplier (day: torches matter less)
  }

  /** Register a light source. Returns the source so it can be changed later. */
  add(pos, opts = {}) {
    const s = {
      pos: pos.clone(),
      color: new THREE.Color(opts.color ?? 0xff8a3a),
      intensity: opts.intensity ?? 9,
      range: opts.range ?? 11,
      flicker: opts.flicker ?? 1,
      phase: Math.random() * 100,
      enabled: true,
      onFlicker: opts.onFlicker || null,
    };
    this.sources.push(s);
    return s;
  }

  update(dt, playerPos) {
    this.time += dt;
    const t = this.time;
    for (const s of this.sources) {
      s._d = s.enabled ? s.pos.distanceToSquared(playerPos) : Infinity;
      // layered sines read as fire flicker
      const f = 1 - s.flicker * (0.12 * Math.sin(t * 9.1 + s.phase) * Math.sin(t * 3.7 + s.phase * 2) + 0.08 * Math.sin(t * 23 + s.phase) + 0.05);
      s.current = f;
      if (s.onFlicker) s.onFlicker(f);
    }
    const sorted = this.sources.filter((s) => s.enabled).sort((a, b) => a._d - b._d);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i], s = sorted[i];
      if (!s) { l.intensity = 0; continue; }
      l.position.copy(s.pos);
      l.color.copy(s.color);
      l.distance = s.range;
      // fade the furthest pooled light so swaps don't pop
      let fade = 1;
      if (i === this.lights.length - 1 && sorted[i + 1]) {
        const d0 = Math.sqrt(s._d), d1 = Math.sqrt(sorted[i + 1]._d);
        fade = Math.min(1, (d1 - d0) / 3);
      }
      l.intensity = s.intensity * s.current * this.scale * fade;
    }
  }
}
