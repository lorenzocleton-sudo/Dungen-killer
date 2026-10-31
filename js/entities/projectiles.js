// Enemy projectiles (arrows, poison spit, fireballs, water bolts, webs) and
// ground telegraphs (red warning shapes for boss attacks).
import * as THREE from '../../lib/three.module.min.js';
import { basicMaterial, spriteMaterial } from '../engine/materials.js';

const _v = new THREE.Vector3();

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.stuck = [];   // arrows left in walls (fade out)
    this.waves = [];   // ground shockwaves (jump over them)
  }

  /** opts: speed, damage, color, size, slow, burn, poison, arrow, spread (radians), owner */
  fire(from, to, o) {
    const area = this.game.area;
    const dir = _v.subVectors(to, from).normalize().clone();
    if (o.spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), o.spread);
    const g = new THREE.Group();
    let vel = null;
    if (o.arrow) {
      // shaft along +Z with the head at the front: lookAt() points +Z along the flight, tip first
      const shaft = new THREE.Mesh(ARROW_SHAFT, ARROW_MAT); shaft.position.z = -0.3; g.add(shaft);
      const head = new THREE.Mesh(ARROW_HEAD, ARROW_HEAD_MAT); head.rotation.x = Math.PI / 2; head.position.z = 0.08; g.add(head);
      const fl = new THREE.Mesh(ARROW_FLETCH, ARROW_FLETCH_MAT); fl.position.z = -0.6; g.add(fl);
      // slight ballistic arc: aim a little high so gravity brings it onto the target
      const dist = from.distanceTo(to), sp = o.speed || 20, tt = dist / sp;
      vel = dir.clone().multiplyScalar(sp); vel.y += ARROW_G * tt * 0.5;
    } else {
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(o.size || 0.2, 0), basicMaterial(o.color));
      g.add(core);
      const glow = new THREE.Sprite(spriteMaterial('glow', o.color));
      glow.scale.setScalar((o.size || 0.2) * 6); glow.material.opacity = 0.7;
      g.add(glow);
    }
    g.position.copy(from);
    area.scene.add(g);
    if (vel) g.lookAt(from.x + vel.x, from.y + vel.y, from.z + vel.z);
    this.list.push({ g, dir, vel, speed: o.speed || 10, o, life: 4, area, lookFix: !!o.arrow });
  }

  clear() {
    for (const p of this.list) p.area.scene.remove(p.g);
    for (const p of this.stuck) p.area.scene.remove(p.g);
    for (const w of this.waves) w.dispose();
    for (const z of this.zones || []) z.area.scene.remove(z.m);
    this.list.length = 0; this.stuck.length = 0; this.waves.length = 0; this.zones = [];
  }

  /** Lingering ground zone (poison cloud, fire pool): hurts the player standing in it. */
  zone(area, x, y, z, o = {}) {
    const r = o.r || 3, col = o.color ?? 0x80d040;
    const geo = new THREE.CircleGeometry(r, 24); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.position.set(x, y + 0.08, z); area.scene.add(m);
    const zz = { m, area, x, y, z, r, t: o.dur || 5, dps: o.dps || 6, kind: o.kind || 'poison', col: new THREE.Color(col).toArray(), enemies: !!o.hurtsEnemies, dmg: o.enemyDps || 0 };
    (this.zones || (this.zones = [])).push(zz);
    return zz;
  }

  /** Ground shockwave ring from a heavy slam: fixed on the ground, jump to avoid it. */
  shockwave(area, x, y, z, o) { const w = new Shockwave(area, x, y, z, o); this.waves.push(w); return w; }

  update(dt) {
    const g = this.game, pl = g.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      const pos = p.g.position;
      let step;
      if (p.vel) {
        p.vel.y -= ARROW_G * dt;
        step = p.vel.length() * dt;
        p.dir.copy(p.vel).normalize();
        pos.addScaledVector(p.vel, dt);
        p.g.lookAt(pos.x + p.vel.x, pos.y + p.vel.y, pos.z + p.vel.z);
      } else {
        step = p.speed * dt;
        pos.addScaledVector(p.dir, step);
        if (p.lookFix) p.g.lookAt(pos.x + p.dir.x, pos.y + p.dir.y, pos.z + p.dir.z);
      }
      if (Math.random() < 0.6) p.area.glow.emit(pos.x, pos.y, pos.z, 0, 0, 0, 0.3, p.o.arrow ? [0.4, 0.38, 0.3] : new THREE.Color(p.o.color).toArray(), 0.05);
      let done = p.life <= 0, wall = false;
      // walls
      if (!done && !g.area.collision.lineOfSight(pos.x - p.dir.x * step, pos.y - p.dir.y * step, pos.z - p.dir.z * step, pos.x, pos.y, pos.z)) done = wall = true;
      if (!done && pos.y < -40) done = true;
      // player hit (capsule)
      const dx = pos.x - pl.pos.x, dz = pos.z - pl.pos.z;
      if (!done && !pl.dead && dx * dx + dz * dz < 0.36 && pos.y > pl.pos.y - 0.1 && pos.y < pl.pos.y + 1.9) {
        const dealt = pl.damage(Math.round(p.o.damage * (0.85 + Math.random() * 0.3)), pos.clone(), p.o.owner && !p.o.owner.dead ? p.o.owner : null);
        if (dealt) {
          if (p.o.slow) pl.slowT = Math.max(pl.slowT || 0, p.o.slow);
          if (p.o.burn) pl.addDot(p.o.burn, 3, 'burn');
          if (p.o.poison) pl.addDot(p.o.poison, 4, 'poison');
        }
        done = true;
      }
      if (done) {
        const c = p.o.arrow ? [0.5, 0.45, 0.35] : new THREE.Color(p.o.color).toArray();
        p.area.glow.burst(pos.x, pos.y, pos.z, p.o.arrow ? 4 : 10, 2, 0.4, c, 0.04, -4, 1);
        this.list.splice(i, 1);
        if (p.o.arrow && wall) {
          // the arrow sticks in the wall, then fades
          pos.addScaledVector(p.dir, -step * 0.5);
          this.stuck.push({ g: p.g, area: p.area, life: 4 });
          if (this.stuck.length > 24) { const o = this.stuck.shift(); o.area.scene.remove(o.g); }
        } else p.area.scene.remove(p.g);
      }
    }
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const a = this.stuck[i];
      a.life -= dt;
      if (a.life < 0.6) a.g.scale.setScalar(Math.max(0.01, a.life / 0.6));
      if (a.life <= 0) { a.area.scene.remove(a.g); this.stuck.splice(i, 1); }
    }
    for (let i = this.waves.length - 1; i >= 0; i--) if (this.waves[i].update(dt, g)) { this.waves[i].dispose(); this.waves.splice(i, 1); }
    for (let i = (this.zones || []).length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t -= dt;
      z.m.material.opacity = 0.18 + Math.sin(z.t * 6) * 0.05;
      if (Math.random() < dt * 20) z.area.dust.emit(z.x + (Math.random() - 0.5) * z.r * 1.6, z.y + 0.2, z.z + (Math.random() - 0.5) * z.r * 1.6, 0, 0.5, 0, 1.2, z.col, 0.12);
      if (!z.enemies && !pl.dead && Math.hypot(pl.pos.x - z.x, pl.pos.z - z.z) < z.r && Math.abs(pl.pos.y - z.y) < 2) pl.addDot(z.dps, 0.6, z.kind);
      if (z.enemies) for (const e of g.enemies.list) if (!e.dead && Math.hypot(e.pos.x - z.x, e.pos.z - z.z) < z.r) { z.acc = (z.acc || 0); e.dot(z.kind === 'burn' ? 'burn' : 'poison', z.dmg, 1); }
      if (z.t <= 0) { z.area.scene.remove(z.m); z.m.geometry.dispose(); z.m.material.dispose(); this.zones.splice(i, 1); }
    }
  }
}

const ARROW_G = 6;
const ARROW_SHAFT = new THREE.BoxGeometry(0.025, 0.025, 0.7);
const ARROW_HEAD = new THREE.ConeGeometry(0.03, 0.1, 4);
const ARROW_FLETCH = new THREE.BoxGeometry(0.07, 0.01, 0.1);
const ARROW_MAT = basicMaterial(0x8a7a60), ARROW_HEAD_MAT = basicMaterial(0xa0a0a8), ARROW_FLETCH_MAT = basicMaterial(0xa04030);

/**
 * Expanding ground ring. After a short red warning it races outward; it hurts
 * whoever is ON THE GROUND inside its band. Jumping over it (or being far
 * enough away) avoids it. Ground-targeted: never follows its source.
 */
export class Shockwave {
  constructor(area, x, y, z, o = {}) {
    this.area = area; this.x = x; this.y = y; this.z = z;
    this.maxR = o.radius || 8; this.speed = o.speed || 9; this.damage = o.damage || 20; this.delay = o.delay ?? 0.55;
    this.owner = o.owner || null; this.frost = !!o.frost; this.r = 0.5; this.hit = false;
    this.warn = new Telegraph(area, { r: this.maxR }, x, y, z, 0, this.delay);
    const geo = new THREE.RingGeometry(0.85, 1, 40, 1); geo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: this.frost ? 0x80d0ff : 0xff6a30, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.ring.position.set(x, y + 0.12, z); this.ring.visible = false; this.ring.renderOrder = 4;
    area.scene.add(this.ring);
  }

  update(dt, game) {
    if (this.delay > 0) { this.delay -= dt; this.warn.update(dt); if (this.delay <= 0) { this.warn.remove(); this.warn = null; this.ring.visible = true; game.player.shake = Math.max(game.player.shake, 0.5); } return false; }
    const prev = this.r;
    this.r += this.speed * dt;
    this.ring.scale.set(this.r, 1, this.r);
    this.ring.material.opacity = 0.85 * (1 - this.r / this.maxR);
    if (Math.random() < 0.8) { const a = Math.random() * Math.PI * 2; this.area.dust.emit(this.x + Math.cos(a) * this.r, this.y + 0.15, this.z + Math.sin(a) * this.r, 0, 1.2, 0, 0.6, [0.32, 0.28, 0.24], 0.14); }
    const p = game.player;
    if (!this.hit && !p.dead) {
      const d = Math.hypot(p.pos.x - this.x, p.pos.z - this.z);
      const airborne = p.pos.y - this.y > 0.35;
      if (d >= prev - 0.5 && d <= this.r + 0.3 && !airborne && Math.abs(p.pos.y - this.y) < 1.5) {
        this.hit = true;
        const dealt = p.damage(Math.round(this.damage), new THREE.Vector3(this.x, this.y, this.z), this.owner);
        if (dealt && this.frost) p.slowT = Math.max(p.slowT || 0, 2);
      }
    }
    return this.r >= this.maxR;
  }

  dispose() { if (this.warn) this.warn.remove(); this.area.scene.remove(this.ring); this.ring.geometry.dispose(); this.ring.material.dispose(); }
}

// ------------------------------------------------------------------ telegraphs

const TELE_MAT = () => new THREE.MeshBasicMaterial({
  color: 0xff2a10, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
});

/** Fan / disc on the XZ plane facing +Z. angle = full opening in radians. */
function sectorGeo(r, angle = Math.PI * 2, seg = 28) {
  const pos = [0, 0, 0];
  for (let i = 0; i <= seg; i++) { const a = -angle / 2 + (angle * i) / seg; pos.push(Math.sin(a) * r, 0, Math.cos(a) * r); }
  const idx = [];
  for (let i = 1; i <= seg; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function rectGeo(w, len) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, w, 0, len, -w, 0, len], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

const GEO_CACHE = new Map();
function cachedGeo(shape) {
  const key = shape.type === 'rect' ? `r${shape.w.toFixed(2)}_${shape.len.toFixed(2)}` : `s${shape.r.toFixed(2)}_${(shape.angle || 7).toFixed(2)}`;
  let g = GEO_CACHE.get(key);
  if (!g) { g = shape.type === 'rect' ? rectGeo(shape.w, shape.len) : sectorGeo(shape.r, shape.angle); GEO_CACHE.set(key, g); }
  return g;
}

/**
 * A red warning shape that fills up over `time` seconds.
 * opts.follow: an enemy - the zone is parented to it (moves/turns with it);
 *   opts.fwd offsets the zone forward along the enemy's facing, opts.yawOff turns it.
 * Without follow the zone is ground-targeted and stays where it was placed.
 */
export class Telegraph {
  constructor(area, shape, x, y, z, yaw, time, opts = {}) {
    this.area = area;
    this.follow = opts.follow || null;
    this.fwd = opts.fwd || 0;
    this.yawOff = opts.yawOff || 0;
    const geo = cachedGeo(shape);
    this.mesh = new THREE.Mesh(geo, TELE_MAT());
    this.edge = new THREE.Mesh(geo, TELE_MAT());
    this.edge.material.opacity = 0.35;
    this.mesh.position.set(x, y + 0.06, z); this.edge.position.set(x, y + 0.07, z);
    this.mesh.rotation.y = this.edge.rotation.y = yaw;
    this.mesh.scale.setScalar(0.01);
    this.mesh.renderOrder = this.edge.renderOrder = 3;
    area.scene.add(this.mesh, this.edge);
    this.t = 0; this.time = time;
  }

  /** Current centre/yaw of the zone (where a hit is checked). */
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  get yaw() { return this.mesh.rotation.y; }

  _sync() {
    const f = this.follow;
    if (!f) return;
    const yaw = f.yaw + this.yawOff;
    const x = f.pos.x + Math.sin(f.yaw) * this.fwd, z = f.pos.z + Math.cos(f.yaw) * this.fwd;
    this.mesh.position.set(x, f.pos.y + 0.06, z); this.edge.position.set(x, f.pos.y + 0.07, z);
    this.mesh.rotation.y = this.edge.rotation.y = yaw;
  }

  update(dt) {
    this.t += dt;
    this._sync();
    const k = Math.min(1, this.t / this.time);
    this.mesh.scale.setScalar(Math.max(0.01, k));
    this.mesh.material.opacity = 0.25 + k * 0.3;
    this.edge.material.opacity = 0.25 + Math.sin(this.t * 20) * 0.1;
    return k >= 1;
  }

  remove() {
    this.area.scene.remove(this.mesh, this.edge);
    this.mesh.material.dispose(); this.edge.material.dispose();
  }
}
