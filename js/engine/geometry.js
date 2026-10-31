// Geometry helpers + a static batcher that merges level geometry into one
// mesh per material (few draw calls = good framerate on tablets).
import * as THREE from '../../lib/three.module.min.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Build a transform matrix. rot = [rx, ry, rz] or a single ry number. */
export function trs(x, y, z, rot = 0, scale = 1) {
  const r = Array.isArray(rot) ? rot : [0, rot, 0];
  _e.set(r[0], r[1], r[2]);
  _q.setFromEuler(_e);
  const sc = Array.isArray(scale) ? scale : [scale, scale, scale];
  _s.set(sc[0], sc[1], sc[2]);
  _v.set(x, y, z);
  return new THREE.Matrix4().compose(_v, _q, _s);
}

/** Box with UVs scaled to its size, so textures keep a constant texel density. */
export function boxGeo(w, h, d, texWorld = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0] / texWorld, uv.getY(k) * dims[f][1] / texWorld);
  }
  return g;
}

/** Gable roof prism, ridge along X. Base at y=0, apex at y=h. */
export function roofGeo(w, d, h, texWorld = 2) {
  const hw = w / 2, hd = d / 2;
  const slope = Math.sqrt(hd * hd + h * h);
  const pos = [], uv = [];
  const quad = (a, b, c, dd, ua, ub, uc, ud) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...dd);
    uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
  };
  const U = w / texWorld, V = slope / texWorld;
  // south slope (+z)
  quad([-hw, 0, hd], [hw, 0, hd], [hw, h, 0], [-hw, h, 0], [0, 0], [U, 0], [U, V], [0, V]);
  // north slope (-z)
  quad([hw, 0, -hd], [-hw, 0, -hd], [-hw, h, 0], [hw, h, 0], [0, 0], [U, 0], [U, V], [0, V]);
  // gables
  const gu = d / texWorld, gv = h / texWorld;
  pos.push(-hw, 0, -hd, -hw, 0, hd, -hw, h, 0); uv.push(0, 0, gu, 0, gu / 2, gv);
  pos.push(hw, 0, hd, hw, 0, -hd, hw, h, 0); uv.push(0, 0, gu, 0, gu / 2, gv);
  // underside
  quad([-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [0, 0], [U, 0], [U, gu], [0, gu]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Re-map UVs from world position (box projection) for seamless tiling. */
function worldUV(g, scale) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; }
    else if (nx >= nz) { u = z * Math.sign(n.getX(i) || 1); v = y; }
    else { u = -x * Math.sign(n.getZ(i) || 1); v = y; }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

const vcCache = new WeakMap();
/** Batched meshes carry baked vertex colours, so they use a vertexColors twin. */
function vcMaterial(mat) {
  if (mat.vertexColors) return mat;
  let m = vcCache.get(mat);
  if (!m) {
    m = mat.clone();
    m.vertexColors = true;
    vcCache.set(mat, m);
  }
  return m;
}

export class StaticBatcher {
  constructor() { this.groups = new Map(); }

  /**
   * opts.worldUV: meters per texture tile (box projection) - omit to keep UVs
   * opts.tint: [r,g,b] vertex tint (0..1)
   * opts.shade: (x,y,z,nx,ny,nz) => brightness factor, baked into vertex colors
   */
  add(geometry, material, matrix, opts = {}) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (matrix) g.applyMatrix4(matrix);
    if (opts.worldUV) worldUV(g, opts.worldUV);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const p = g.attributes.position, n = g.attributes.normal;
    const col = new Float32Array(p.count * 3);
    const t = opts.tint || [1, 1, 1];
    for (let i = 0; i < p.count; i++) {
      const f = opts.shade ? opts.shade(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)) : 1;
      col[i * 3] = t[0] * f; col[i * 3 + 1] = t[1] * f; col[i * 3 + 2] = t[2] * f;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!this.groups.has(material)) this.groups.set(material, []);
    this.groups.get(material).push(g);
  }

  /** Merge everything and add the meshes to `parent`. */
  build(parent) {
    const meshes = [];
    for (const [mat, list] of this.groups) {
      let count = 0;
      for (const g of list) count += g.attributes.position.count;
      const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
      const uv = new Float32Array(count * 2), col = new Float32Array(count * 3);
      let o = 0;
      for (const g of list) {
        pos.set(g.attributes.position.array, o * 3);
        nor.set(g.attributes.normal.array, o * 3);
        uv.set(g.attributes.uv.array, o * 2);
        col.set(g.attributes.color.array, o * 3);
        o += g.attributes.position.count;
        g.dispose();
      }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, vcMaterial(mat));
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }
}
