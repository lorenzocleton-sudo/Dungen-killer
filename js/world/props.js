// Reusable low-poly props. Static parts go into the area's batcher +
// collision; animated parts (flames, portals, NPCs) are standalone meshes.
import * as THREE from '../../lib/three.module.min.js';
import { boxGeo, roofGeo, trs } from '../engine/geometry.js';
import { litMaterial, glowMaterial, spriteMaterial, basicMaterial } from '../engine/materials.js';
import { getTexture } from '../engine/textures.js';

const M = (name, o) => litMaterial(name, o);

/** Darken toward the ground: cheap baked ambient occlusion. */
export const groundAO = (base = 0) => (x, y) => 0.55 + Math.min(1, Math.max(0, (y - base) / 1.6)) * 0.45;

/**
 * Static box. (x,y,z) is the centre. rot is a Y rotation (or [rx,ry,rz]).
 * Collision is added as an AABB for unrotated boxes / 90 degree turns.
 */
export function box(area, mat, x, y, z, w, h, d, o = {}) {
  const geo = boxGeo(w, h, d, o.tex || 2);
  area.batcher.add(geo, typeof mat === 'string' ? M(mat) : mat, trs(x, y, z, o.rot || 0), {
    worldUV: o.worldUV, tint: o.tint, shade: o.shade === undefined ? groundAO(o.aoBase ?? 0) : o.shade,
  });
  geo.dispose();
  if (o.collide !== false) {
    let cw = w, cd = d;
    const ry = Array.isArray(o.rot) ? o.rot[1] : (o.rot || 0);
    if (Math.abs(Math.sin(ry)) > 0.7) { cw = d; cd = w; }
    area.collision.addCentered(x, y, z, cw, h, cd, o.tag);
  }
}

/** Static arbitrary geometry. */
export function mesh(area, mat, geo, matrix, o = {}) {
  area.batcher.add(geo, typeof mat === 'string' ? M(mat) : mat, matrix, {
    worldUV: o.worldUV, tint: o.tint, shade: o.shade === undefined ? groundAO(o.aoBase ?? 0) : o.shade,
  });
}

// ------------------------------------------------------------------ fire

const flameMat = () => spriteMaterial('flame', 0xffc080);

/** Flame sprite + flickering pooled light + embers. */
export function fire(area, x, y, z, o = {}) {
  const s = new THREE.Sprite(flameMat());
  const size = o.size || 0.45;
  s.scale.set(size * 0.7, size, 1);
  s.position.set(x, y + size * 0.3, z);
  area.scene.add(s);
  const core = new THREE.Sprite(spriteMaterial('glow', 0xff7020));
  core.scale.set(size * 2.2, size * 2.2, 1);
  core.position.set(x, y + size * 0.2, z);
  core.material.opacity = 0.35;
  area.scene.add(core);
  const src = area.lights.add(new THREE.Vector3(x, y + 0.3, z), {
    color: o.color ?? 0xff8a3a, intensity: o.intensity ?? 9, range: o.range ?? 12,
    onFlicker: (f) => { s.scale.set(size * 0.7 * (0.9 + (1 - f) * 0.8), size * (0.75 + f * 0.35), 1); },
  });
  area.addEmitter(new THREE.Vector3(x, y + size * 0.4, z), o.embers ?? 3, (a, p) => {
    a.glow.emit(p.x + (Math.random() - 0.5) * 0.15, p.y, p.z + (Math.random() - 0.5) * 0.15,
      (Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.9, (Math.random() - 0.5) * 0.4,
      1 + Math.random() * 1.4, [1, 0.45 + Math.random() * 0.25, 0.1], 0.035, 0.15, 0.4);
  });
  return { sprite: s, light: src };
}

/**
 * Wall torch. (x,z) is the wall surface point, `yaw` the direction the wall
 * faces (torch sticks out along it).
 */
export function wallTorch(area, x, y, z, yaw) {
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  box(area, 'ironDark', x + dx * 0.08, y - 0.15, z + dz * 0.08, 0.12, 0.3, 0.12, { rot: yaw, collide: false, shade: null });
  const stick = boxGeo(0.08, 0.5, 0.08, 1);
  // handle leans out from the wall
  const lean = new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeRotationX(0.45));
  lean.setPosition(x + dx * 0.2, y, z + dz * 0.2);
  mesh(area, 'woodDark', stick, lean, { shade: null });
  stick.dispose();
  box(area, 'ironDark', x + dx * 0.32, y + 0.25, z + dz * 0.32, 0.16, 0.12, 0.16, { collide: false, shade: null });
  return fire(area, x + dx * 0.32, y + 0.33, z + dz * 0.32, { size: 0.4 });
}

/** Free-standing torch on a wooden post. */
export function postTorch(area, x, z, y0 = 0, h = 2.2) {
  box(area, 'beam', x, y0 + h / 2, z, 0.18, h, 0.18, { tag: 'prop' });
  box(area, 'ironDark', x, y0 + h + 0.06, z, 0.3, 0.14, 0.3, { collide: false, shade: null });
  return fire(area, x, y0 + h + 0.15, z, { size: 0.5, intensity: 10 });
}

/** Iron brazier bowl with a large fire. */
export function brazier(area, x, y0, z) {
  const legs = new THREE.CylinderGeometry(0.08, 0.12, 0.9, 5);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    mesh(area, 'ironDark', legs, trs(x + Math.cos(a) * 0.3, y0 + 0.45, z + Math.sin(a) * 0.3, [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2]));
  }
  const bowl = new THREE.CylinderGeometry(0.55, 0.3, 0.35, 8, 1, false);
  mesh(area, 'iron', bowl, trs(x, y0 + 1.05, z));
  area.collision.addCentered(x, y0 + 0.6, z, 0.9, 1.2, 0.9, 'prop');
  return fire(area, x, y0 + 1.2, z, { size: 0.85, intensity: 16, range: 16, embers: 6 });
}

// ------------------------------------------------------------------ portal

/**
 * Stone arch with a swirling magic surface. Walk into it to travel.
 * o: { x, y, z, yaw (direction the portal faces), target, color: 'green'|'blue', label }
 */
export function portal(area, o) {
  const { x, z } = o, y = o.y || 0, yaw = o.yaw || 0;
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const L = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  const rot = yaw;
  // steps / base slab
  { const [px, pz] = L(0, 0.2); box(area, 'stoneDark', px, y + 0.12, pz, 4.8, 0.24, 2.6, { rot, worldUV: 1.5, collide: true }); }
  // pillars
  for (const sx of [-1.65, 1.65]) {
    const [px, pz] = L(sx, 0);
    box(area, 'stoneMoss', px, y + 2.25, pz, 0.8, 4.5, 0.9, { rot, aoBase: y });
    const [cx, cz] = L(sx, 0);
    box(area, 'stoneDark', cx, y + 0.4, cz, 1.0, 0.8, 1.1, { rot, collide: false });
    box(area, 'stoneDark', cx, y + 4.4, cz, 1.0, 0.3, 1.1, { rot, collide: false, shade: null });
  }
  { const [px, pz] = L(0, 0); box(area, 'stoneMoss', px, y + 4.85, pz, 4.3, 0.7, 1.0, { rot, collide: false, shade: null }); }
  { const [px, pz] = L(0, 0.05); box(area, 'stoneDark', px, y + 5.35, pz, 0.9, 0.6, 1.1, { rot, collide: false, shade: null }); }
  // horns / spikes on top
  for (const sx of [-1.9, 1.9]) {
    const [px, pz] = L(sx, 0);
    mesh(area, 'stoneDark', new THREE.ConeGeometry(0.3, 1.0, 4), trs(px, y + 5.6, pz, [0, rot + Math.PI / 4, sx * -0.15]), { shade: null });
  }

  const pal = o.color === 'purple'
    ? { tex: 'portalBlue', light: 0xb070ff, mote: [0.75, 0.45, 1.0], tint: 0xe0b0ff }
    : o.color === 'gold'
      ? { tex: 'portalRed', light: 0xffc060, mote: [1.0, 0.8, 0.4], tint: 0xffe8a0 }
      : o.color === 'blue'
    ? { tex: 'portalBlue', light: 0x6ea8ff, mote: [0.45, 0.65, 1.0], tint: 0xbfd8ff }
    : o.color === 'red'
      ? { tex: 'portalRed', light: 0xff5a3a, mote: [1.0, 0.4, 0.25], tint: 0xffc8b8 }
      : { tex: 'portalGreen', light: 0x5cff9a, mote: [0.4, 1.0, 0.6], tint: 0xc8ffd8 };
  const group = new THREE.Group();
  group.position.set(x, y + 2.25, z);
  group.rotation.y = yaw;
  const layers = [];
  for (let i = 0; i < 2; i++) {
    const m = glowMaterial(pal.tex, pal.tint, { fog: true });
    m.map = getTexture(pal.tex).clone();
    m.map.center.set(0.5, 0.5);
    m.map.needsUpdate = true;
    m.opacity = i === 0 ? 0.95 : 0.6;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 3.9), m);
    plane.position.z = 0.02 + i * 0.03;
    group.add(plane);
    layers.push(m);
  }
  // dark backing so the swirl reads against bright day fog
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 4.0), basicMaterial(0x020304));
  back.position.z = -0.05;
  group.add(back);
  const glow = new THREE.Sprite(spriteMaterial('glow', pal.light));
  glow.scale.set(6, 7, 1);
  glow.material.opacity = 0.25;
  glow.position.z = 0.3;
  group.add(glow);
  area.scene.add(group);

  const lp = L(0, 1.2);
  area.lights.add(new THREE.Vector3(lp[0], y + 2.2, lp[1]), { color: pal.light, intensity: 9, range: 12, flicker: 0.3 });
  const mp = L(0, 0.3);
  area.addEmitter(new THREE.Vector3(mp[0], y + 0.3, mp[1]), 9, (a, p) => {
    const lx = (Math.random() - 0.5) * 2.4;
    a.glow.emit(p.x + lx * cs, p.y + Math.random() * 3.6, p.z - lx * sn,
      (Math.random() - 0.5) * 0.2 + sn * 0.3, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2 + cs * 0.3,
      1.5 + Math.random(), pal.mote, 0.04, 0, 0.2);
  });
  area.animated.push({
    update(dt, t) {
      layers[0].map.rotation = t * 0.6;
      layers[1].map.rotation = -t * 0.9;
      layers[1].opacity = 0.5 + Math.sin(t * 2.3) * 0.15;
      glow.material.opacity = 0.22 + Math.sin(t * 1.7) * 0.06;
    },
  });
  const tp = L(0, 0.15);
  const p = { pos: new THREE.Vector3(tp[0], y, tp[1]), radius: 1.05, target: o.target, spawn: o.spawn, descend: !!o.descend, label: o.label || 'Portal', yaw, layers, baseTint: pal.tint };
  area.portals.push(p);
  return p;
}

// ------------------------------------------------------------------ town props

export function barrel(area, x, z, y0 = 0, rotY = 0) {
  const g = new THREE.CylinderGeometry(0.38, 0.38, 1.0, 8);
  // squash UVs so the planks wrap a sensible number of times
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 2);
  mesh(area, 'wood', g, trs(x, y0 + 0.5, z, rotY));
  const band = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 8, 1, true);
  mesh(area, 'ironDark', band, trs(x, y0 + 0.2, z, rotY));
  mesh(area, 'ironDark', band, trs(x, y0 + 0.8, z, rotY));
  area.collision.addCentered(x, y0 + 0.5, z, 0.76, 1.0, 0.76, 'prop');
}

export function crate(area, x, z, y0 = 0, s = 0.9, rotY = 0) {
  box(area, 'wood', x, y0 + s / 2, z, s, s, s, { rot: rotY, tex: s, tag: 'prop' });
  box(area, 'beam', x, y0 + s / 2, z, s + 0.04, 0.1, s + 0.04, { rot: rotY, collide: false, shade: null });
}

export function cart(area, x, z, rotY = 0) {
  const cs = Math.cos(rotY), sn = Math.sin(rotY);
  const L = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  box(area, 'woodDark', x, 0.9, z, 1.6, 0.15, 2.6, { rot: rotY, collide: false });
  for (const s of [-0.75, 0.75]) { const [px, pz] = L(s, 0); box(area, 'woodDark', px, 1.2, pz, 0.08, 0.5, 2.6, { rot: rotY, collide: false }); }
  const wheel = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 8);
  for (const [lx, lz] of [[-0.9, 0.6], [0.9, 0.6], [-0.9, -0.7], [0.9, -0.7]]) {
    const [px, pz] = L(lx, lz);
    mesh(area, 'beam', wheel, trs(px, 0.55, pz, [0, rotY, Math.PI / 2]));
  }
  { const [px, pz] = L(0, 2.0); box(area, 'beam', px, 0.75, pz, 0.1, 0.1, 1.6, { rot: [0.25, rotY, 0], collide: false }); }
  area.collision.addCentered(x, 0.8, z, Math.abs(cs) > 0.5 ? 2 : 2.8, 1.6, Math.abs(cs) > 0.5 ? 2.8 : 2, 'prop');
}

export function well(area, x, z) {
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const geo = boxGeo(0.72, 0.9, 0.32, 1);
    mesh(area, 'stoneMoss', geo, trs(x + Math.cos(a) * 1.08, 0.45, z + Math.sin(a) * 1.08, -a + Math.PI / 2));
    const cap = boxGeo(0.76, 0.12, 0.42, 1);
    mesh(area, 'stoneDark', cap, trs(x + Math.cos(a) * 1.08, 0.96, z + Math.sin(a) * 1.08, -a + Math.PI / 2), { shade: null });
  }
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.95, 10), basicMaterial(0x05080a));
  water.rotation.x = -Math.PI / 2; water.position.set(x, 0.35, z);
  area.scene.add(water);
  for (const s of [-1.15, 1.15]) box(area, 'beam', x + s, 1.3, z, 0.18, 2.6, 0.18, { collide: false });
  box(area, 'beam', x, 2.45, z, 2.6, 0.16, 0.16, { collide: false, shade: null });
  mesh(area, 'roof', roofGeo(3.0, 1.9, 0.8, 1.5), trs(x, 2.55, z), { shade: null });
  const bucket = new THREE.CylinderGeometry(0.16, 0.13, 0.28, 6);
  mesh(area, 'woodDark', bucket, trs(x + 0.3, 1.7, z), { shade: null });
  area.collision.addCentered(x, 0.5, z, 2.6, 1.0, 2.6, 'prop');
}

export function gravestone(area, x, z, rot = 0, tilt = 0) {
  const geo = boxGeo(0.6, 1.0, 0.18, 1);
  mesh(area, 'stoneDark', geo, trs(x, 0.4, z, [tilt, rot, tilt * 0.5]));
  area.collision.addCentered(x, 0.5, z, 0.6, 1.0, 0.4, 'prop');
}

export function deadTree(area, x, z, seed = 1) {
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  mesh(area, 'woodDark', new THREE.CylinderGeometry(0.16, 0.35, 4.5, 6), trs(x, 2.25, z, [0.05, 0, -0.04]));
  for (let i = 0; i < 6; i++) {
    const h = 2 + r() * 2.2, a = r() * Math.PI * 2, len = 1 + r() * 1.4;
    const g = new THREE.CylinderGeometry(0.03, 0.1, len, 4);
    const tilt = 0.7 + r() * 0.6;
    const ox = Math.cos(a) * Math.sin(tilt) * len / 2, oz = Math.sin(a) * Math.sin(tilt) * len / 2;
    const m = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -tilt);
    m.setPosition(x + ox, h + Math.cos(tilt) * len / 2, z + oz);
    mesh(area, 'woodDark', g, m, { shade: null });
  }
  area.collision.addCentered(x, 1.5, z, 0.6, 3, 0.6, 'prop');
}

/**
 * Timber-framed house. Axis aligned; `door` is the side the door is on
 * ('n' = -z, 's' = +z, 'e' = +x, 'w' = -x). Returns door world position.
 */
export function house(area, o) {
  const { x, z, w, d } = o;
  const h = o.h || 4;
  const base = 0.9;
  // stone foundation & plaster walls
  box(area, 'stoneMoss', x, base / 2, z, w, base, d, { worldUV: 1.5 });
  box(area, 'plaster', x, base + (h - base) / 2, z, w - 0.12, h - base, d - 0.12, { worldUV: 2, collide: false, shade: groundAO(base) });
  area.collision.addCentered(x, h / 2, z, w, h, d, 'house');
  // timber frame
  const bt = 0.22, out = 0.05;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    box(area, 'beam', x + sx * (w / 2 - bt / 2 + out), h / 2 + base / 2, z + sz * (d / 2 - bt / 2 + out), bt, h - base, bt, { collide: false, aoBase: base });
  for (const yy of [base + 0.1, h - 0.1, base + (h - base) * 0.55]) {
    box(area, 'beam', x, yy, z + d / 2 + out - 0.06, w, 0.16, 0.14, { collide: false, shade: null });
    box(area, 'beam', x, yy, z - d / 2 - out + 0.06, w, 0.16, 0.14, { collide: false, shade: null });
    box(area, 'beam', x + w / 2 + out - 0.06, yy, z, 0.14, 0.16, d, { collide: false, shade: null });
    box(area, 'beam', x - w / 2 - out + 0.06, yy, z, 0.14, 0.16, d, { collide: false, shade: null });
  }
  // diagonal braces on the long walls
  const mid = base + (h - base) * 0.55;
  const braceLen = Math.hypot(w * 0.3, h - mid);
  const ang = Math.atan2(h - mid, w * 0.3);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const g = boxGeo(braceLen, 0.14, 0.12, 2);
      mesh(area, 'beam', g, trs(x + sx * w * 0.3, (mid + h) / 2, z + sz * (d / 2 + out - 0.06), [0, 0, sx * ang]), { shade: null });
    }
  }
  // roof: ridge along the longer side
  const roofH = o.roofH || Math.min(w, d) * 0.55;
  const along = w >= d;
  const rg = along ? roofGeo(w + 0.9, d + 1.0, roofH, 1.6) : roofGeo(d + 0.9, w + 1.0, roofH, 1.6);
  mesh(area, 'roof', rg, trs(x, h, z, along ? 0 : Math.PI / 2), { shade: null });
  // ridge beam
  box(area, 'beam', x, h + roofH, z, along ? w + 1 : 0.2, 0.2, along ? 0.2 : d + 1, { collide: false, shade: null });
  // chimney
  if (o.chimney !== false) {
    const cx = along ? x + w * 0.3 : x + w * 0.15, cz = along ? z - d * 0.15 : z + d * 0.3;
    box(area, 'stoneDark', cx, h + roofH * 0.5 + 0.4, cz, 0.7, roofH + 1.2, 0.7, { collide: false, shade: null, worldUV: 1.2 });
    area.addEmitter(new THREE.Vector3(cx, h + roofH + 1.1, cz), 2.5, (a, p) => {
      a.dust.emit(p.x, p.y, p.z, 0.2 + Math.random() * 0.2, 0.6 + Math.random() * 0.3, (Math.random() - 0.5) * 0.2,
        3.5, [0.22, 0.22, 0.22], 0.3, 0, 0.1, 0.35);
    });
  }
  // door + windows
  const side = o.door || 's';
  const dirs = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
  const [nx, nz] = dirs[side];
  const half = nx ? w / 2 : d / 2;
  const doorOff = o.doorOffset || 0;
  const dx = x + nx * (half + 0.04) + (nz ? doorOff : 0), dz = z + nz * (half + 0.04) + (nx ? doorOff : 0);
  const along2 = nz !== 0; // door on a z-facing wall -> door spans x
  box(area, 'woodDark', dx, 1.05 + base * 0.0, dz, along2 ? 1.2 : 0.1, 2.1, along2 ? 0.1 : 1.2, { collide: false, tex: 1.2, shade: null });
  box(area, 'beam', dx, 2.2, dz, along2 ? 1.6 : 0.2, 0.2, along2 ? 0.2 : 1.6, { collide: false, shade: null });
  for (const s of [-0.7, 0.7]) box(area, 'beam', dx + (along2 ? s : 0), 1.1, dz + (along2 ? 0 : s), 0.18, 2.2, 0.18, { collide: false, shade: null });
  // stone step
  box(area, 'stoneDark', dx + nx * 0.4, 0.08, dz + nz * 0.4, along2 ? 1.6 : 0.8, 0.16, along2 ? 0.8 : 1.6, { collide: true, shade: null });

  const winMat = area.windowMat;
  const windows = o.windows || [];
  const addWindow = (wx, wy, wz, facingX) => {
    const ww = 0.7, wh = 0.65;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), winMat);
    pane.position.set(wx, wy, wz);
    pane.rotation.y = facingX ? (wx > x ? Math.PI / 2 : -Math.PI / 2) : (wz > z ? 0 : Math.PI);
    area.scene.add(pane);
    // frame + cross
    box(area, 'beam', wx, wy + wh / 2 + 0.05, wz, facingX ? 0.16 : ww + 0.2, 0.1, facingX ? ww + 0.2 : 0.16, { collide: false, shade: null });
    box(area, 'beam', wx, wy - wh / 2 - 0.05, wz, facingX ? 0.2 : ww + 0.3, 0.1, facingX ? ww + 0.3 : 0.2, { collide: false, shade: null });
    box(area, 'beam', wx, wy, wz, facingX ? 0.12 : 0.06, wh, facingX ? 0.06 : 0.12, { collide: false, shade: null });
    box(area, 'beam', wx, wy, wz, facingX ? 0.12 : ww, 0.06, facingX ? ww : 0.12, { collide: false, shade: null });
  };
  for (const wdef of windows) {
    const [ws, wo, wy] = wdef; // side, offset, height
    const [wnx, wnz] = dirs[ws];
    const wh2 = wnx ? w / 2 : d / 2;
    addWindow(x + wnx * (wh2 + 0.01) + (wnz ? wo : 0), wy || 2.6, z + wnz * (wh2 + 0.01) + (wnx ? wo : 0), wnx !== 0);
  }
  return { x: dx, z: dz, nx, nz };
}

// ------------------------------------------------------------------ NPCs

/** Hooded placeholder townsfolk. No dialogue yet - just presence. */
export function npc(area, def) {
  const g = new THREE.Group();
  const clothM = litMaterial(def.cloth || 'cloth');
  const dark = basicMaterial(0x050404);
  const variant = def.variant || 'hooded';
  const scale = def.scale || 1;
  const body = new THREE.Group();
  g.add(body);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.45, 1.3, 7), clothM);
  robe.position.y = 0.65; body.add(robe);
  const upper = new THREE.Group();
  upper.position.y = 1.25;
  body.add(upper);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.35, 7), clothM);
  chest.position.y = 0.05; upper.add(chest);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.55, 7), clothM);
  hood.position.set(0, 0.42, -0.02); upper.add(hood);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.05), dark);
  face.position.set(0, 0.32, 0.17); upper.add(face);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.14), clothM);
    arm.position.set(s * 0.3, -0.2, 0.04); arm.rotation.z = s * 0.12; upper.add(arm);
  }
  if (variant === 'hunched') { upper.rotation.x = 0.5; upper.position.z = 0.12; }
  if (variant === 'staff') {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.0, 5), litMaterial('beam'));
    staff.position.set(0.35, 1.0, 0.15); g.add(staff);
  }
  g.scale.setScalar(scale);
  g.position.set(def.x, def.y || 0, def.z);
  g.rotation.y = def.yaw || 0;
  area.scene.add(g);
  const col = area.collision.addCentered(def.x, (def.y || 0) + 0.9, def.z, 0.8, 1.8, 0.8, 'npc');
  const baseYaw = def.yaw || 0;
  const phase = Math.random() * 10;
  const n = { def, group: g, pos: new THREE.Vector3(def.x, 0, def.z), col };
  area.animated.push({
    update(dt, t, player) {
      body.scale.y = 1 + Math.sin(t * 1.3 + phase) * 0.015;
      body.rotation.z = Math.sin(t * 0.7 + phase) * 0.02;
      // slowly turn to watch the player when close - unsettling, wordless
      const dx = player.pos.x - def.x, dz = player.pos.z - def.z;
      const near = dx * dx + dz * dz < 25;
      const target = near ? Math.atan2(dx, dz) : baseYaw;
      let diff = target - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * 1.2);
    },
  });
  (area.npcs || (area.npcs = [])).push(n);
  if (def.name && def.talk !== false) {
    const it = interactable(area, n.pos, 2.2, `Talk to ${def.name}`, () => {
      const g = area.game;
      if (def.note && !g.journal.has(def.note) && Math.random() < 0.5) { g.journal.add(def.note); return; }
      const line = def.lines ? def.lines[Math.floor(Math.random() * def.lines.length)] : def.line;
      g.hud.speak(line ? `${def.name}: "${line}"` : g.renown.greeting(def.name));
    }, true);
    n.talk = it;
  }
  return n;
}

// ------------------------------------------------------------------ interactables

/** Register something the player can use with E / Y / the USE button. */
export function interactable(area, pos, radius, label, onUse, live = false) {
  const it = { pos: live ? pos : pos.clone(), radius, label, onUse, enabled: true };
  area.interactables.push(it);
  return it;
}

/** Iron-bound chest. Opens once, then rolls loot via onOpen(). */
export function chest(area, x, y, z, yaw, onOpen, opts = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = yaw;
  const wood = litMaterial('woodDark'), iron = litMaterial('ironDark');
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.7), wood); base.position.y = 0.28; g.add(base);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.55, -0.35); g.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.22, 0.74), wood); lid.position.set(0, 0.11, 0.35); lidPivot.add(lid);
  for (const sx of [-0.4, 0.4]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.74), iron); band.position.set(sx, 0.3, 0); g.add(band);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.06), iron); lock.position.set(0, 0.5, 0.37); g.add(lock);
  area.scene.add(g);
  area.collision.addCentered(x, y + 0.4, z, 1.1, 0.8, 1.1, 'prop');
  area.mapMarkers.push({ x, z, type: 'chest' });
  if (opts.glow) {
    const gl = new THREE.Sprite(spriteMaterial('glow', opts.glow)); gl.scale.set(3.2, 2.4, 1); gl.material.opacity = 0.55; gl.position.y = 0.8; g.add(gl);
    area.lights.add(new THREE.Vector3(x, y + 1.2, z), { color: opts.glow, intensity: 6, range: 7, flicker: 0.2 });
    area.addEmitter(new THREE.Vector3(x, y + 0.5, z), 6, (a, p) => a.glow.emit(p.x + (Math.random() - 0.5) * 0.8, p.y, p.z + (Math.random() - 0.5) * 0.8, 0, 0.8, 0, 1.2, new THREE.Color(opts.glow).toArray(), 0.04));
  }
  let open = 0;
  const it = interactable(area, new THREE.Vector3(x, y, z), 2.0, 'Open chest', () => {
    it.enabled = false; open = 0.001;
    onOpen && onOpen();
  });
  area.animated.push({ update(dt) { if (open > 0 && open < 1) { open = Math.min(1, open + dt * 2.5); lidPivot.rotation.x = -open * 1.9; } } });
  return it;
}

/** Ring of stones with a fire - where heroes rest. */
export function bonfire(area, x, z) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    mesh(area, 'stoneDark', boxGeo(0.35, 0.25, 0.3, 0.6), trs(x + Math.cos(a) * 0.75, 0.12, z + Math.sin(a) * 0.75, -a));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI + 0.3;
    mesh(area, 'woodDark', new THREE.CylinderGeometry(0.06, 0.08, 1.1, 5), trs(x, 0.25, z, [Math.PI / 2 - 0.3, a, 0]), { shade: null });
  }
  area.collision.addCentered(x, 0.3, z, 1.6, 0.6, 1.6, 'prop');
  // logs to sit on
  for (const [dx, dz, r] of [[-2, 0.3, 1.5], [1.9, 0.5, -1.4], [0.2, 2.1, 0.1]]) {
    mesh(area, 'woodDark', new THREE.CylinderGeometry(0.22, 0.22, 1.5, 6), trs(x + dx, 0.22, z + dz, [0, r, Math.PI / 2]));
  }
  return fire(area, x, 0.2, z, { size: 0.9, intensity: 14, range: 14, embers: 7 });
}

export function anvil(area, x, z, rot = 0) {
  box(area, 'woodDark', x, 0.3, z, 0.6, 0.6, 0.6, { rot, tag: 'prop' });
  box(area, 'ironDark', x, 0.72, z, 1.0, 0.24, 0.38, { rot, collide: false, shade: null });
  box(area, 'ironDark', x, 0.66, z, 0.5, 0.14, 0.3, { rot, collide: false, shade: null });
}

export function trainingDummy(area, x, z, rot = 0) {
  box(area, 'beam', x, 0.9, z, 0.15, 1.8, 0.15, { rot, tag: 'prop' });
  box(area, 'beam', x, 1.45, z, 1.1, 0.12, 0.12, { rot, collide: false, shade: null });
  mesh(area, 'clothBrown', new THREE.CylinderGeometry(0.28, 0.3, 0.75, 6), trs(x, 1.2, z, rot));
  mesh(area, 'clothBrown', boxGeo(0.3, 0.3, 0.3, 0.6), trs(x, 1.78, z, rot + 0.3));
}

/** Hanging wooden sign with painted text (low-res canvas). */
export function sign(area, x, y, z, yaw, text) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#2a1e14'; ctx.fillRect(0, 0, 128, 32);
  ctx.strokeStyle = '#120c08'; ctx.lineWidth = 3; ctx.strokeRect(1, 1, 126, 30);
  ctx.fillStyle = '#c8a870'; ctx.font = 'bold 15px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 17);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshLambertMaterial({ map: tex });
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.06), [m, m, m, m, m, m]);
  board.position.set(x, y, z); board.rotation.y = yaw;
  area.scene.add(board);
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  box(area, 'beam', x - dx * 0.35, y + 0.42, z - dz * 0.35, Math.abs(dz) > 0.5 ? 0.08 : 0.9, 0.08, Math.abs(dz) > 0.5 ? 0.9 : 0.08, { collide: false, shade: null });
}

/**
 * A building you can walk into. Hollow walls with a doorway, wooden floor,
 * hearth, ceiling and the same roof as house(). `furnish(area, inner)` adds
 * the interior. door: 'n' | 's' | 'e' | 'w'.
 */
export function hollowHouse(area, o) {
  const { x, z, w, d } = o;
  const h = o.h || 4.2, t = 0.35, base = 0.9, doorW = 1.8, doorH = 2.6;
  const seg = (x0, z0, x1, z1) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, lx = Math.abs(x1 - x0) || t, lz = Math.abs(z1 - z0) || t;
    box(area, 'stoneMoss', cx, base / 2, cz, lx, base, lz, { worldUV: 1.5, collide: false });
    box(area, 'plaster', cx, base + (h - base) / 2, cz, lx, h - base, lz, { worldUV: 2, collide: false, shade: groundAO(base) });
    area.collision.addCentered(cx, h / 2, cz, lx, h, lz, 'house');
  };
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const side = o.door || 's';
  const wall = (name, ax0, az0, ax1, az1) => {
    if (name !== side) { seg(ax0, az0, ax1, az1); return; }
    // split around the doorway + lintel above it
    const horiz = az0 === az1;
    const mid = horiz ? (ax0 + ax1) / 2 : (az0 + az1) / 2;
    if (horiz) { seg(ax0, az0, mid - doorW / 2, az1); seg(mid + doorW / 2, az0, ax1, az1); }
    else { seg(ax0, az0, ax1, mid - doorW / 2); seg(ax0, mid + doorW / 2, ax1, az1); }
    const lx = horiz ? doorW : t, lz = horiz ? t : doorW;
    box(area, 'plaster', horiz ? mid : ax0, doorH + (h - doorH) / 2, horiz ? az0 : mid, lx, h - doorH, lz, { worldUV: 2, collide: false, shade: null });
    box(area, 'beam', horiz ? mid : ax0, doorH + 0.1, horiz ? az0 : mid, horiz ? doorW + 0.5 : t + 0.1, 0.22, horiz ? t + 0.1 : doorW + 0.5, { collide: false, shade: null });
    for (const s of [-1, 1]) box(area, 'beam', horiz ? mid + s * (doorW / 2 + 0.08) : ax0, doorH / 2, horiz ? az0 : mid + s * (doorW / 2 + 0.08), 0.2, doorH, 0.2 + t, { collide: false, shade: null });
  };
  wall('n', x0, z0, x1, z0);
  wall('s', x0, z1, x1, z1);
  wall('w', x0, z0, x0, z1);
  wall('e', x1, z0, x1, z1);
  // corner posts + roof
  for (const [sx, sz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box(area, 'beam', sx, h / 2, sz, 0.32, h, 0.32, { collide: false });
  const roofH = Math.min(w, d) * 0.5;
  const along = w >= d;
  mesh(area, 'roof', along ? roofGeo(w + 0.9, d + 1.0, roofH, 1.6) : roofGeo(d + 0.9, w + 1.0, roofH, 1.6), trs(x, h, z, along ? 0 : Math.PI / 2), { shade: null });
  box(area, 'beam', x, h + roofH, z, along ? w + 1 : 0.2, 0.2, along ? 0.2 : d + 1, { collide: false, shade: null });
  // interior: floor, ceiling beams, hearth
  box(area, 'wood', x, 0.04, z, w - t, 0.08, d - t, { worldUV: 1.5, shade: null });
  box(area, 'beam', x, h - 0.05, z, w - t, 0.1, d - t, { worldUV: 2, collide: false, shade: () => 0.45 });
  for (let k = -1; k <= 1; k++) box(area, 'beam', along ? x + k * w / 3 : x, h - 0.25, along ? z : z + k * d / 3, along ? 0.22 : w - t, 0.22, along ? d - t : 0.22, { collide: false, shade: null });
  // door frame outside: threshold step
  const dirs = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
  const [nx, nz] = dirs[side];
  const doorPos = new THREE.Vector3(x + nx * (w / 2), 0, z + nz * (d / 2));
  if (o.sign) sign(area, doorPos.x + nx * 0.5, doorH + 0.75, doorPos.z + nz * 0.5, nz !== 0 ? 0 : Math.PI / 2, o.sign);
  wallTorch(area, doorPos.x + nx * (t / 2 + 0.02) + (nz ? 1.6 : 0), 2.4, doorPos.z + nz * (t / 2 + 0.02) + (nx ? 1.6 : 0), Math.atan2(nx, nz));
  const inner = { x0: x0 + t / 2, x1: x1 - t / 2, z0: z0 + t / 2, z1: z1 - t / 2, x, z, h, nx, nz, door: doorPos };
  if (o.furnish) o.furnish(area, inner);
  return inner;
}

// ------------------------------------------------------------------ heroes

/**
 * Hero NPCs: armoured, caped adventurers with distinct silhouettes.
 * def: { x, z, yaw, look: 'knight'|'sorceress'|'hunter'|'paladin'|'sellsword', pose: 'stand'|'sit'|'lean',
 *        path: [[x,z],...] (optional patrol), name }
 */
export function hero(area, def) {
  const L = HERO_LOOKS[def.look] || HERO_LOOKS.knight;
  const g = new THREE.Group();
  const M = {
    armor: litMaterial(L.armor), under: litMaterial(L.under), cape: litMaterial(L.cape, { side: THREE.DoubleSide }),
    skin: litMaterial('flesh', { color: 0xc8a890 }), trim: litMaterial(L.trim || 'ironDark'),
  };
  const B = (w, h, d, m, x, y, z, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
  const hips = new THREE.Group(); hips.position.y = 0.95; g.add(hips);
  const legL = new THREE.Group(); legL.position.set(-0.13, 0, 0); hips.add(legL);
  const legR = new THREE.Group(); legR.position.set(0.13, 0, 0); hips.add(legR);
  B(0.17, 0.9, 0.19, M.under, 0, -0.45, 0, legL); B(0.17, 0.9, 0.19, M.under, 0, -0.45, 0, legR);
  B(0.2, 0.18, 0.28, M.trim, 0, -0.86, 0.04, legL); B(0.2, 0.18, 0.28, M.trim, 0, -0.86, 0.04, legR);
  const torso = new THREE.Group(); hips.add(torso);
  B(0.52, 0.6, 0.3, M.armor, 0, 0.3, 0, torso);
  B(0.56, 0.12, 0.33, M.trim, 0, 0.02, 0, torso); // belt
  if (L.tabard) B(0.3, 0.7, 0.33, litMaterial(L.tabard), 0, 0.05, 0.01, torso);
  for (const s of [-1, 1]) {
    const pd = B(L.bulky ? 0.32 : 0.24, 0.14, 0.34, M.armor, s * 0.36, 0.6, 0, torso);
    pd.rotation.z = s * -0.3;
  }
  // head
  const head = new THREE.Group(); head.position.set(0, 0.72, 0); torso.add(head);
  if (L.helm === 'great') { B(0.3, 0.36, 0.32, M.armor, 0, 0.12, 0, head); B(0.22, 0.03, 0.02, basicMaterial(0x040302), 0, 0.15, 0.165, head); }
  else if (L.helm === 'hood') { B(0.24, 0.26, 0.24, M.skin, 0, 0.1, 0, head); const hd = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 6), M.cape); hd.position.set(0, 0.24, -0.03); head.add(hd); B(0.18, 0.12, 0.03, basicMaterial(0x0a0806), 0, 0.12, 0.12, head); }
  else if (L.helm === 'hat') { B(0.24, 0.26, 0.24, M.skin, 0, 0.1, 0, head); const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 8), M.cape); brim.position.y = 0.25; head.add(brim); const top = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 7), M.cape); top.position.set(0, 0.52, -0.04); top.rotation.x = -0.25; head.add(top); B(0.24, 0.12, 0.05, litMaterial('cloth', { color: 0x777777 }), 0, -0.02, 0.1, head); }
  else if (L.helm === 'crown') {
    B(0.24, 0.28, 0.24, M.skin, 0, 0.1, 0, head);
    B(0.26, 0.14, 0.26, litMaterial('cloth', { color: 0xdddddd }), 0, -0.04, 0.02, head); // beard
    const gold = basicMaterial(0xb89038);
    B(0.28, 0.07, 0.28, gold, 0, 0.27, 0, head);
    for (const [px, pz] of [[-0.11, 0.11], [0.11, 0.11], [-0.11, -0.11], [0.11, -0.11], [0, 0.13]]) B(0.05, 0.12, 0.05, gold, px, 0.35, pz, head);
  }
  else { B(0.26, 0.28, 0.26, M.armor, 0, 0.11, 0, head); B(0.2, 0.06, 0.02, basicMaterial(0x040302), 0, 0.12, 0.135, head); }
  if (L.plume) { const pl = B(0.05, 0.22, 0.32, litMaterial(L.plume), 0, 0.38, -0.05, head); pl.rotation.x = 0.3; }
  // arms
  const armL = new THREE.Group(); armL.position.set(-0.36, 0.56, 0); torso.add(armL);
  const armR = new THREE.Group(); armR.position.set(0.36, 0.56, 0); torso.add(armR);
  B(0.14, 0.66, 0.15, M.armor, 0, -0.33, 0, armL); B(0.14, 0.66, 0.15, M.armor, 0, -0.33, 0, armR);
  // cape
  if (L.cape) {
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.3, 1, 3), M.cape);
    cape.position.set(0, -0.05, -0.19); cape.rotation.x = 0.08; torso.add(cape);
    g.userData.cape = cape;
  }
  // gear
  if (L.weapon === 'greatsword') { const s = B(0.08, 1.4, 0.03, litMaterial('iron'), 0, 0.15, -0.22, torso); s.rotation.z = 0.5; B(0.36, 0.06, 0.06, M.trim, 0.22, 0.6, -0.22, torso).rotation.z = 0.5; }
  if (L.weapon === 'staff') {
    const st = B(0.05, 1.9, 0.05, litMaterial('beam'), 0, -0.4, 0.12, armR); st.rotation.x = 0.1;
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), basicMaterial(L.orb)); orb.position.set(0, 0.6, 0.18); armR.add(orb);
    const glow = new THREE.Sprite(spriteMaterial('glow', L.orb)); glow.scale.set(0.8, 0.8, 1); glow.material.opacity = 0.6; glow.position.copy(orb.position); armR.add(glow);
    armR.rotation.x = -0.5;
  }
  if (L.weapon === 'bow') {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 4, 10, Math.PI * 0.9), litMaterial('beam'));
    bow.position.set(0.05, 0.2, -0.24); bow.rotation.set(0, Math.PI / 2, Math.PI / 2 + 0.3); torso.add(bow);
    const quiver = B(0.14, 0.6, 0.14, litMaterial('woodDark'), -0.15, 0.35, -0.22, torso); quiver.rotation.z = -0.4;
  }
  if (L.weapon === 'shield') {
    const sh = B(0.08, 0.8, 0.58, M.armor, -0.1, -0.35, 0.2, armL); sh.rotation.y = 0.2;
    const sig = new THREE.Mesh(new THREE.CircleGeometry(0.14, 6), basicMaterial(L.orb)); sig.position.set(-0.15, -0.35, 0.24); sig.rotation.y = -Math.PI / 2 + 0.2; armL.add(sig);
    armL.rotation.x = -0.4;
    const mace = B(0.05, 0.7, 0.05, litMaterial('beam'), 0, -0.6, 0.05, armR); mace.rotation.x = 0.2; B(0.16, 0.18, 0.16, litMaterial('iron'), 0, -0.95, 0.12, armR);
  }
  if (L.weapon === 'twin') { for (const s of [-1, 1]) { const k = B(0.04, 0.5, 0.02, litMaterial('iron'), s * 0.22, -0.05, -0.12, torso); k.rotation.z = s * 0.4; } }

  g.scale.setScalar(L.scale || 1);
  if (def.pose === 'sit') { hips.position.y = 0.5; legL.rotation.x = legR.rotation.x = -1.4; }
  if (def.pose === 'lean') { torso.rotation.x = -0.12; armR.rotation.x = -0.25; }
  g.position.set(def.x, def.y || 0, def.z);
  g.rotation.y = def.yaw || 0;
  area.scene.add(g);
  const pos = new THREE.Vector3(def.x, def.y || 0, def.z);
  const blocker = def.path ? null : area.collision.addCentered(def.x, (def.y || 0) + 0.9, def.z, 0.8, 1.8, 0.8, 'npc');
  void blocker;
  const phase = Math.random() * 10;
  let wp = 0, wait = 0;
  area.animated.push({
    update(dt, t, player) {
      const cape = g.userData.cape;
      if (cape) cape.rotation.x = 0.08 + Math.sin(t * 1.7 + phase) * 0.05;
      torso.rotation.z = Math.sin(t * 0.9 + phase) * 0.02;
      if (def.path) {
        // slow patrol between waypoints, pausing at each
        const [tx, tz] = def.path[wp];
        const dx = tx - pos.x, dz = tz - pos.z, dd = Math.hypot(dx, dz);
        if (wait > 0) { wait -= dt; legL.rotation.x = legR.rotation.x = 0; }
        else if (dd < 0.2) { wp = (wp + 1) % def.path.length; wait = 2 + Math.random() * 4; }
        else {
          const sp = 1.3 * dt;
          pos.x += dx / dd * sp; pos.z += dz / dd * sp;
          let diff = Math.atan2(dx, dz) - g.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          g.rotation.y += diff * Math.min(1, dt * 5);
          const sw = Math.sin(t * 6 + phase);
          legL.rotation.x = sw * 0.5; legR.rotation.x = -sw * 0.5; armL.rotation.x = -sw * 0.3; armR.rotation.x = sw * 0.3 + (L.weapon === 'staff' ? -0.5 : 0);
        }
        g.position.set(pos.x, pos.y, pos.z);
      } else {
        const dx = player.pos.x - def.x, dz = player.pos.z - def.z;
        if (def.pose !== 'sit' && dx * dx + dz * dz < 16) {
          let diff = Math.atan2(dx, dz) - g.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          g.rotation.y += diff * Math.min(1, dt * 1.5);
        }
      }
    },
  });
  (area.npcs || (area.npcs = [])).push({ def, group: g, pos });
  if (def.name && def.talk !== false) interactable(area, pos, 2.4, `Talk to ${def.name}`, () => area.game.hud.speak(area.game.renown.heroComment(def.name)), true);
  return g;
}

const HERO_LOOKS = {
  knight: { armor: 'ironPlate', under: 'ironDark', cape: 'clothRed', trim: 'ironDark', helm: 'great', plume: 'clothRed', weapon: 'greatsword', bulky: true, scale: 1.08, tabard: 'clothRed' },
  sorceress: { armor: 'cloth', under: 'cloth', cape: 'cloth', trim: 'clothBrown', helm: 'hat', weapon: 'staff', orb: 0x7ab0ff, scale: 0.97 },
  pyromancer: { armor: 'clothBrown', under: 'cloth', cape: 'clothRed', trim: 'ironDark', helm: 'hood', weapon: 'staff', orb: 0xff7a30, scale: 1.0 },
  hunter: { armor: 'clothBrown', under: 'woodDark', cape: 'dirtMoss', trim: 'woodDark', helm: 'hood', weapon: 'bow', scale: 1.0 },
  paladin: { armor: 'iron', under: 'ironDark', cape: 'cloth', trim: 'ironPlate', helm: 'open', plume: 'cloth', weapon: 'shield', orb: 0xe8d090, bulky: true, scale: 1.1, tabard: 'cloth' },
  king: { armor: 'clothRed', under: 'clothRed', cape: 'clothRed', trim: 'iron', helm: 'crown', weapon: 'staff', orb: 0xf0d080, bulky: true, scale: 1.15, tabard: 'cloth' },
  guard: { armor: 'ironPlate', under: 'ironDark', cape: 'clothRed', trim: 'ironDark', helm: 'great', plume: 'clothRed', weapon: 'shield', orb: 0xc8a040, bulky: true, scale: 1.1, tabard: 'clothRed' },
  sellsword: { armor: 'clothBrown', under: 'ironDark', cape: 'clothBrown', trim: 'iron', helm: 'open', weapon: 'twin', scale: 1.0 },
};

/**
 * Sealed gate: a portal behind iron bars. Stays locked until `open()` is
 * called (e.g. when the arena boss dies).
 * o: portal options + lockedLabel
 */
export function gate(area, o) {
  const p = portal(area, o);
  p.locked = true;
  p.lockedLabel = o.lockedLabel || 'Sealed';
  const cs = Math.cos(o.yaw || 0), sn = Math.sin(o.yaw || 0);
  const bars = new THREE.Group();
  const m = litMaterial('ironDark');
  for (let i = -5; i <= 5; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.2, 0.1), m);
    b.position.set(i * 0.27, 2.1, 0); bars.add(b);
  }
  for (const y of [0.8, 2.2, 3.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 0.12), m); h.position.y = y; bars.add(h); }
  bars.position.set(o.x + sn * 0.35, o.y || 0, o.z + cs * 0.35);
  bars.rotation.y = o.yaw || 0;
  area.scene.add(bars);
  // a sign plate under the arch
  if (o.sign) sign(area, o.x + sn * 0.6, (o.y || 0) + 4.25, o.z + cs * 0.6, o.yaw || 0, o.sign);
  let t = -1;
  p.open = () => {
    if (!p.locked) return;
    p.locked = false; t = 0;
  };
  area.animated.push({ update(dt) { if (t >= 0 && t < 1) { t = Math.min(1, t + dt * 0.5); bars.position.y = (o.y || 0) - t * 4.3; if (Math.random() < 0.5) area.dust.emit(bars.position.x, (o.y || 0) + 0.2, bars.position.z, (Math.random() - 0.5), 0.6, (Math.random() - 0.5), 1, [0.3, 0.28, 0.25], 0.1); } } });
  return p;
}

/** Searchable remains of an earlier Wanderer: bones, a rag, and a note. */
export function remains(area, x, y, z, tags) {
  for (let i = 0; i < 6; i++) mesh(area, 'bone', boxGeo(0.06, 0.06, 0.45, 0.5), trs(x + (Math.random() - 0.5) * 0.9, y + 0.05, z + (Math.random() - 0.5) * 0.9, [0, Math.random() * 6, 0]), { shade: null });
  mesh(area, 'bone', boxGeo(0.22, 0.22, 0.26, 0.5), trs(x + 0.3, y + 0.12, z, 0.4), { shade: null });
  box(area, 'cloth', x - 0.2, y + 0.03, z + 0.1, 0.8, 0.04, 0.6, { collide: false, shade: null, rot: 0.5 });
  const it = interactable(area, new THREE.Vector3(x, y, z), 1.8, 'Search the remains', () => {
    it.enabled = false;
    area.game.journal.readFor(...tags);
    area.game.state.addCurrency(3 + Math.floor(Math.random() * 8));
  });
  return it;
}

/**
 * Spike trap: a floor plate that glows red, then spikes shoot up. Hurts
 * whoever is standing on it at that moment (jumping over it is safe).
 */
export function spikeTrap(area, x, y, z, o = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 2.0), litMaterial('ironDark', { unique: true }));
  plate.position.y = 0.03; g.add(plate);
  const spikes = new THREE.Group(); g.add(spikes);
  const sm = litMaterial('iron');
  for (let i = 0; i < 16; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.6, 4), sm); c.position.set(-0.75 + (i % 4) * 0.5, 0.3, -0.75 + Math.floor(i / 4) * 0.5); spikes.add(c); }
  spikes.position.y = -0.62;
  area.scene.add(g);
  area.mapMarkers.push({ x, z, type: 'trap' });
  const period = o.period || 3.2, phase = o.phase ?? Math.random() * period;
  let hitThisCycle = false;
  area.animated.push({
    update(dt, t, player) {
      const c = (t + phase) % period;
      const warn = c > period - 1.0 && c < period - 0.45;
      const up = c >= period - 0.45;
      plate.material.emissive.setRGB(warn ? 0.5 + Math.sin(t * 30) * 0.3 : 0, 0, 0);
      const target = up ? 0 : -0.62;
      spikes.position.y += (target - spikes.position.y) * Math.min(1, dt * (up ? 30 : 6));
      if (!up) { hitThisCycle = false; return; }
      if (hitThisCycle || player.dead) return;
      const onIt = Math.abs(player.pos.x - x) < 1.1 && Math.abs(player.pos.z - z) < 1.1 && player.pos.y - y < 0.35 && player.pos.y - y > -0.5;
      if (onIt) { hitThisCycle = true; player.damage(Math.round((o.damage || 18)), new THREE.Vector3(x, y, z), 'trap'); }
    },
  });
  return g;
}

/** Healing shrine: an ember in a stone bowl. Restores you fully, once. */
export function healingShrine(area, x, y, z) {
  box(area, 'stoneDark', x, y + 0.5, z, 0.9, 1.0, 0.9, { worldUV: 1 });
  box(area, 'stone', x, y + 1.05, z, 1.1, 0.12, 1.1, { worldUV: 1, collide: false, shade: null });
  const ember = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), basicMaterial(0xffa040));
  ember.position.set(x, y + 1.35, z); area.scene.add(ember);
  const light = area.lights.add(new THREE.Vector3(x, y + 1.6, z), { color: 0xffa050, intensity: 6, range: 7, flicker: 0.4 });
  area.mapMarkers.push({ x, z, type: 'shrine' });
  area.animated.push({ update(dt, t) { ember.rotation.y = t; ember.position.y = y + 1.35 + Math.sin(t * 2) * 0.06; } });
  const it = interactable(area, new THREE.Vector3(x, y, z), 2.0, 'Warm yourself at the shrine (heal)', () => {
    const p = area.game.player;
    p.hp = p.maxHp; p.stamina = p.maxStamina; p.mana = p.maxMana; p.dot = null;
    area.glow.burst(x, y + 1.3, z, 30, 2, 1, [1, 0.6, 0.25], 0.05, 1, 1);
    area.game.hud.feed('The ember warms you. It gutters out.', '#e0a050');
    it.enabled = false; light.enabled = false; ember.visible = false;
  });
  return it;
}
