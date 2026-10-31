// Enemy projectiles (arrows, poison spit, fireballs, water bolts, webs) and
// ground telegraphs (red warning shapes for boss attacks).
import * as THREE from '../../lib/three.module.min.js';
import { basicMaterial, spriteMaterial } from '../engine/materials.js';

const _v = new THREE.Vector3();

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  /** opts: speed, damage, color, size, slow, burn, poison, arrow, spread (radians), owner */
  fire(from, to, o) {
    const area = this.game.area;
    const dir = _v.subVectors(to, from).normalize().clone();
    if (o.spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), o.spread);
    const g = new THREE.Group();
    if (o.arrow) {
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.7), basicMaterial(0x8a7a60));
      g.add(shaft);
      g.lookAt(dir);
    } else {
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(o.size || 0.2, 0), basicMaterial(o.color));
      g.add(core);
      const glow = new THREE.Sprite(spriteMaterial('glow', o.color));
      glow.scale.setScalar((o.size || 0.2) * 6); glow.material.opacity = 0.7;
      g.add(glow);
    }
    g.position.copy(from);
    area.scene.add(g);
    this.list.push({ g, dir, speed: o.speed || 10, o, life: 4, area, lookFix: !!o.arrow });
  }

  clear() {
    for (const p of this.list) p.area.scene.remove(p.g);
    this.list.length = 0;
  }

  update(dt) {
    const g = this.game, pl = g.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      const step = p.speed * dt;
      const pos = p.g.position;
      pos.addScaledVector(p.dir, step);
      if (p.lookFix) p.g.lookAt(pos.x + p.dir.x, pos.y + p.dir.y, pos.z + p.dir.z);
      if (Math.random() < 0.6) p.area.glow.emit(pos.x, pos.y, pos.z, 0, 0, 0, 0.3, p.o.arrow ? [0.4, 0.38, 0.3] : new THREE.Color(p.o.color).toArray(), 0.05);
      let done = p.life <= 0;
      // walls
      if (!done && !g.area.collision.lineOfSight(pos.x - p.dir.x * step, pos.y - p.dir.y * step, pos.z - p.dir.z * step, pos.x, pos.y, pos.z)) done = true;
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
        p.area.glow.burst(pos.x, pos.y, pos.z, 10, 2, 0.4, c, 0.04, -4, 1);
        p.area.scene.remove(p.g);
        this.list.splice(i, 1);
      }
    }
  }
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

/** A red warning shape that fills up over `time` seconds. */
export class Telegraph {
  constructor(area, shape, x, y, z, yaw, time) {
    this.area = area;
    const geo = shape.type === 'rect' ? rectGeo(shape.w, shape.len) : sectorGeo(shape.r, shape.angle);
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

  update(dt) {
    this.t += dt;
    const k = Math.min(1, this.t / this.time);
    this.mesh.scale.setScalar(Math.max(0.01, k));
    this.mesh.material.opacity = 0.25 + k * 0.3;
    this.edge.material.opacity = 0.25 + Math.sin(this.t * 20) * 0.1;
    return k >= 1;
  }

  remove() {
    this.area.scene.remove(this.mesh, this.edge);
    this.mesh.geometry.dispose();
  }
}
