// Procedural 64x64 texture library. Everything is painted into canvases at
// startup - no external image assets. All generators are seeded so the world
// looks the same on every load.
import * as THREE from '../../lib/three.module.min.js';

export const TEX_SIZE = 64;
const S = TEX_SIZE;

export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);

/** Tileable value noise, `cells` lattice points across the texture. */
function valueNoise(r, cells) {
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const fy = (y / S) * cells, iy = Math.floor(fy), ty = smooth(fy - iy);
    const y0 = iy % cells, y1 = (iy + 1) % cells;
    for (let x = 0; x < S; x++) {
      const fx = (x / S) * cells, ix = Math.floor(fx), tx = smooth(fx - ix);
      const x0 = ix % cells, x1 = (ix + 1) % cells;
      const a = g[y0 * cells + x0], b = g[y0 * cells + x1];
      const c = g[y1 * cells + x0], d = g[y1 * cells + x1];
      out[y * S + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

function fbm(r, octaves = [4, 8, 16, 32], gain = 0.5) {
  const out = new Float32Array(S * S);
  let amp = 1, total = 0;
  for (const c of octaves) {
    const n = valueNoise(r, c);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Float RGB pixel buffer that gets clamped and written to a canvas. */
class Pix {
  constructor() { this.d = new Float32Array(S * S * 3); }
  set(x, y, r, g, b) {
    x = ((x % S) + S) % S; y = ((y % S) + S) % S;
    const i = (y * S + x) * 3; this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b;
  }
  get(x, y) {
    x = ((x % S) + S) % S; y = ((y % S) + S) % S;
    const i = (y * S + x) * 3; return [this.d[i], this.d[i + 1], this.d[i + 2]];
  }
  mul(x, y, f) {
    x = ((x % S) + S) % S; y = ((y % S) + S) % S;
    const i = (y * S + x) * 3; this.d[i] *= f; this.d[i + 1] *= f; this.d[i + 2] *= f;
  }
  mix(x, y, c, t) {
    x = ((x % S) + S) % S; y = ((y % S) + S) % S;
    const i = (y * S + x) * 3;
    for (let k = 0; k < 3; k++) this.d[i + k] += (c[k] - this.d[i + k]) * t;
  }
  fill(fn) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const c = fn(x, y, y * S + x); this.set(x, y, c[0], c[1], c[2]);
    }
  }
  canvas(alpha) {
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      img.data[i * 4] = clamp(this.d[i * 3], 0, 255);
      img.data[i * 4 + 1] = clamp(this.d[i * 3 + 1], 0, 255);
      img.data[i * 4 + 2] = clamp(this.d[i * 3 + 2], 0, 255);
      img.data[i * 4 + 3] = alpha ? clamp(alpha[i], 0, 255) : 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

/** Random-walk crack, darkening pixels. */
function crack(p, r, len, dark = 0.45) {
  let x = r() * S, y = r() * S, a = r() * Math.PI * 2;
  for (let i = 0; i < len; i++) {
    p.mul(Math.floor(x), Math.floor(y), dark);
    p.mul(Math.floor(x) + 1, Math.floor(y), 0.5 + dark * 0.5);
    a += (r() - 0.5) * 1.1; x += Math.cos(a); y += Math.sin(a);
  }
}

// ---------------------------------------------------------------- generators

/** Stone blocks with mortar, used for walls. */
function stoneBlocks(seed, o = {}) {
  const r = makeRng(seed);
  const base = o.base || [76, 72, 66];
  const rowH = o.rowH || 16;
  const widthSets = o.widthSets || [[20, 22, 22], [16, 24, 24], [24, 20, 20], [32, 32], [21, 21, 22]];
  const mortar = o.mortar || [30, 28, 25];
  const n1 = fbm(r), n2 = fbm(r, [8, 16, 32]);
  const moss = o.moss ? fbm(r, [4, 8, 16]) : null;
  const rows = S / rowH;
  const rowData = [];
  for (let i = 0; i < rows; i++) {
    const ws = widthSets[Math.floor(r() * widthSets.length)];
    const off = Math.floor(r() * S);
    const shades = ws.map(() => 0.78 + r() * 0.36);
    const tints = ws.map(() => [(r() - 0.5) * 10, (r() - 0.5) * 8, (r() - 0.5) * 8]);
    rowData.push({ ws, off, shades, tints });
  }
  const p = new Pix();
  p.fill((x, y, i) => {
    const row = Math.floor(y / rowH), ly = y % rowH;
    const rd = rowData[row];
    let lx = (x - rd.off + S) % S, bi = 0, acc = 0;
    while (bi < rd.ws.length - 1 && lx >= acc + rd.ws[bi]) { acc += rd.ws[bi]; bi++; }
    const bx = lx - acc, bw = rd.ws[bi];
    if (ly === 0 || bx === 0 || (o.thickMortar && (ly === 1 || bx === 1))) {
      const m = 0.8 + n2[i] * 0.4;
      return [mortar[0] * m, mortar[1] * m, mortar[2] * m];
    }
    let f = rd.shades[bi] * (0.75 + n1[i] * 0.5) * (0.9 + r() * 0.2);
    // bevel: light top/left edge, dark bottom/right edge
    if (ly === 1 || bx === 1) f *= 1.15;
    if (ly === rowH - 1 || bx === bw - 1) f *= 0.72;
    const t = rd.tints[bi];
    let c = [(base[0] + t[0]) * f, (base[1] + t[1]) * f, (base[2] + t[2]) * f];
    if (moss) {
      const m = moss[i] + (y / S) * (o.mossBottom || 0) - (o.mossBias || 0.62);
      if (m > 0) {
        const k = clamp(m * 4, 0, 0.85);
        const mc = [46 * f, 58 * f, 30 * f];
        c = [c[0] + (mc[0] - c[0]) * k, c[1] + (mc[1] - c[1]) * k, c[2] + (mc[2] - c[2]) * k];
      }
    }
    return c;
  });
  for (let i = 0; i < (o.cracks ?? 4); i++) crack(p, r, 10 + r() * 18);
  return p;
}

/** Rounded cobblestones via tileable voronoi. */
function cobble(seed, o = {}) {
  const r = makeRng(seed);
  const n = o.count || 16;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([r() * S, r() * S, 0.75 + r() * 0.4, (r() - 0.5) * 10]);
  const base = o.base || [80, 76, 70];
  const gap = o.gap || [38, 33, 27];
  const nz = fbm(r);
  const p = new Pix();
  p.fill((x, y, i) => {
    let d1 = 1e9, d2 = 1e9, best = 0;
    for (let k = 0; k < n; k++) {
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const dx = x - (pts[k][0] + ox * S), dy = y - (pts[k][1] + oy * S);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2) d2 = d;
      }
    }
    const edge = d2 - d1;
    const g = 0.8 + nz[i] * 0.4;
    if (edge < 2.2) return [gap[0] * g, gap[1] * g, gap[2] * g];
    const pt = pts[best];
    let f = pt[2] * (1.1 - clamp(d1 / 12, 0, 1) * 0.35) * g * (0.92 + r() * 0.16);
    if (edge < 3.4) f *= 0.75;
    return [(base[0] + pt[3]) * f, (base[1] + pt[3] * 0.8) * f, (base[2] + pt[3] * 0.6) * f];
  });
  for (let i = 0; i < 3; i++) crack(p, r, 8 + r() * 8, 0.6);
  return p;
}

/** Rotten planks running vertically. */
function wood(seed, o = {}) {
  const r = makeRng(seed);
  const base = o.base || [72, 55, 38];
  const plankW = o.plankW || 16;
  const n = fbm(r, [4, 8, 16]), rot = fbm(r, [4, 8]);
  const shades = [];
  for (let i = 0; i < S / plankW; i++) shades.push([0.8 + r() * 0.35, r() * 6.28, Math.floor(r() * S)]);
  const p = new Pix();
  p.fill((x, y, i) => {
    const pi = Math.floor(x / plankW), lx = x % plankW;
    const [sh, ph, seam] = shades[pi];
    if (lx === 0) return [base[0] * 0.3, base[1] * 0.3, base[2] * 0.3];
    if (o.seams !== false && y === seam) return [base[0] * 0.4, base[1] * 0.4, base[2] * 0.4];
    const grain = Math.sin(lx * 0.9 + n[i] * 9 + ph) * 0.5 + 0.5;
    let f = sh * (0.7 + grain * 0.3) * (0.85 + n[i] * 0.3) * (0.93 + r() * 0.14);
    if (lx === 1) f *= 1.12;
    if (lx === plankW - 1) f *= 0.7;
    let c = [base[0] * f, base[1] * f, base[2] * f];
    const rv = rot[i] - (o.rot ?? 0.6);
    if (rv > 0) {
      const k = clamp(rv * 5, 0, 0.9);
      c = [c[0] * (1 - k) + 26 * k, c[1] * (1 - k) + 28 * k, c[2] * (1 - k) + 18 * k];
    }
    return c;
  });
  // knots / nail holes
  for (let i = 0; i < 4; i++) {
    const kx = Math.floor(r() * S), ky = Math.floor(r() * S);
    p.mul(kx, ky, 0.4); p.mul(kx + 1, ky, 0.55); p.mul(kx, ky + 1, 0.55);
  }
  return p;
}

/** Rusted iron plate. */
function iron(seed, o = {}) {
  const r = makeRng(seed);
  const base = o.base || [58, 57, 56];
  const n = fbm(r), rust = fbm(r, [4, 8, 16, 32]);
  const p = new Pix();
  p.fill((x, y, i) => {
    let f = 0.75 + n[i] * 0.45 + (r() - 0.5) * 0.08;
    let c = [base[0] * f, base[1] * f, base[2] * f];
    const rv = rust[i] - (o.rustBias ?? 0.5);
    if (rv > 0) {
      const k = clamp(rv * 4, 0, 0.95);
      const rc = [92 * f, 52 * f, 30 * f];
      c = [c[0] + (rc[0] - c[0]) * k, c[1] + (rc[1] - c[1]) * k, c[2] + (rc[2] - c[2]) * k];
    }
    if (o.plates && (x % 32 === 0 || y % 32 === 0)) c = c.map((v) => v * 0.45);
    if (o.plates && (x % 32 === 1 || y % 32 === 1)) c = c.map((v) => v * 1.2);
    return c;
  });
  if (o.plates) {
    for (const [rx, ry] of [[4, 4], [27, 4], [4, 27], [27, 27], [36, 4], [59, 4], [36, 27], [59, 27],
      [4, 36], [27, 36], [4, 59], [27, 59], [36, 36], [59, 36], [36, 59], [59, 59]]) {
      p.mix(rx, ry, [110, 104, 96], 0.7); p.mul(rx + 1, ry + 1, 0.4);
    }
  }
  for (let i = 0; i < 6; i++) { // scratches
    let x = r() * S, y = r() * S; const a = r() * 6.28;
    for (let k = 0; k < 8; k++) { p.mul(Math.floor(x), Math.floor(y), 1.25); x += Math.cos(a); y += Math.sin(a); }
  }
  return p;
}

function dirt(seed, o = {}) {
  const r = makeRng(seed);
  const base = o.base || [60, 49, 37];
  const n = fbm(r), m = fbm(r, [4, 8]);
  const p = new Pix();
  p.fill((x, y, i) => {
    const f = 0.7 + n[i] * 0.5 + (r() - 0.5) * 0.14;
    let c = [base[0] * f, base[1] * f, base[2] * f];
    if (o.moss) {
      const k = clamp((m[i] - 0.55) * 4, 0, 0.7);
      c = [c[0] * (1 - k) + 44 * k * f, c[1] * (1 - k) + 54 * k * f, c[2] * (1 - k) + 30 * k * f];
    }
    return c;
  });
  for (let i = 0; i < 40; i++) { // pebbles
    const x = Math.floor(r() * S), y = Math.floor(r() * S);
    const v = r() < 0.5 ? 1.35 : 0.6;
    p.mul(x, y, v); if (r() < 0.5) p.mul(x + 1, y, v);
  }
  return p;
}

function moss(seed) {
  const r = makeRng(seed);
  const n = fbm(r, [8, 16, 32]);
  const p = new Pix();
  p.fill((x, y, i) => {
    const f = 0.6 + n[i] * 0.6 + (r() - 0.5) * 0.2;
    return [42 * f, 54 * f, 28 * f];
  });
  return p;
}

/** Dirty plaster for timber-frame houses. */
function plaster(seed) {
  const r = makeRng(seed);
  const n = fbm(r), stain = fbm(r, [2, 4, 8]);
  const p = new Pix();
  p.fill((x, y, i) => {
    let f = 0.82 + n[i] * 0.25 + (r() - 0.5) * 0.06;
    f *= 1 - clamp((stain[i] - 0.5) * 1.6, 0, 0.45);
    f *= 0.85 + (1 - y / S) * 0.15; // grime toward the bottom
    return [108 * f, 100 * f, 86 * f];
  });
  for (let i = 0; i < 3; i++) crack(p, r, 14, 0.6);
  return p;
}

/** Wooden shingles. */
function roof(seed) {
  const r = makeRng(seed);
  const n = fbm(r), mo = fbm(r, [4, 8]);
  const p = new Pix();
  const rowH = 8;
  const rows = [];
  for (let i = 0; i < S / rowH; i++) {
    const shades = []; for (let k = 0; k < 8; k++) shades.push(0.7 + r() * 0.45);
    rows.push({ off: (i % 2) * 4 + Math.floor(r() * 2), shades });
  }
  p.fill((x, y, i) => {
    const ri = Math.floor(y / rowH), ly = y % rowH, rd = rows[ri];
    const lx = (x + rd.off) % S, si = Math.floor(lx / 8);
    if (lx % 8 === 0) return [16, 13, 11];
    let f = rd.shades[si] * (0.75 + n[i] * 0.4) * (0.6 + (ly / rowH) * 0.5);
    if (ly === rowH - 1) f *= 0.4;
    let c = [62 * f, 50 * f, 42 * f];
    const k = clamp((mo[i] - 0.6) * 4, 0, 0.7);
    return [c[0] * (1 - k) + 40 * k, c[1] * (1 - k) + 50 * k, c[2] * (1 - k) + 28 * k];
  });
  return p;
}

function cloth(seed, base = [44, 40, 36]) {
  const r = makeRng(seed);
  const n = fbm(r, [8, 16]);
  const p = new Pix();
  p.fill((x, y, i) => {
    const fold = Math.sin(x * 0.45 + n[i] * 4) * 0.15 + 0.85;
    const f = fold * (0.8 + n[i] * 0.35) * (0.94 + r() * 0.12);
    return [base[0] * f, base[1] * f, base[2] * f];
  });
  for (let i = 0; i < 5; i++) crack(p, r, 6, 0.6); // tears
  return p;
}

/** Pale, mottled dead flesh. */
function flesh(seed) {
  const r = makeRng(seed);
  const n = fbm(r, [4, 8, 16, 32]), v = fbm(r, [8, 16]);
  const p = new Pix();
  p.fill((x, y, i) => {
    const f = 0.7 + n[i] * 0.45 + (r() - 0.5) * 0.1;
    let c = [92 * f, 90 * f, 74 * f];
    const k = clamp((v[i] - 0.58) * 4, 0, 0.6);
    return [c[0] * (1 - k) + 50 * k, c[1] * (1 - k) + 34 * k, c[2] * (1 - k) + 30 * k];
  });
  return p;
}

function bone(seed) {
  const r = makeRng(seed);
  const n = fbm(r, [8, 16, 32]);
  const p = new Pix();
  p.fill((x, y, i) => {
    const f = 0.75 + n[i] * 0.35 + (r() - 0.5) * 0.1;
    return [132 * f, 124 * f, 102 * f];
  });
  for (let i = 0; i < 4; i++) crack(p, r, 8, 0.6);
  return p;
}

/** Soft radial glow (alpha) for flames, portal light etc. */
function glow(seed, colorIn, colorOut, flame) {
  const r = makeRng(seed);
  const p = new Pix();
  const a = new Float32Array(S * S);
  p.fill((x, y, i) => {
    const dx = (x - S / 2 + 0.5) / (S / 2);
    let dy = (y - S / 2 + 0.5) / (S / 2);
    if (flame) dy = dy < 0 ? dy * 0.55 : dy * 1.4; // teardrop: tall tip at the top
    const d = Math.sqrt(dx * dx + dy * dy);
    const k = clamp(1 - d, 0, 1);
    a[i] = Math.pow(k, flame ? 1.2 : 2.0) * 255 * (flame ? 0.9 + r() * 0.1 : 1);
    const t = Math.pow(k, 0.7);
    return [colorOut[0] + (colorIn[0] - colorOut[0]) * t,
      colorOut[1] + (colorIn[1] - colorOut[1]) * t,
      colorOut[2] + (colorIn[2] - colorOut[2]) * t];
  });
  return { p, a };
}

/** Swirling magic texture for portals. */
function portalSwirl(seed, c1, c2) {
  const r = makeRng(seed);
  const n = fbm(r, [4, 8, 16]);
  const p = new Pix();
  const a = new Float32Array(S * S);
  p.fill((x, y, i) => {
    const dx = (x - 31.5) / 32, dy = (y - 31.5) / 32;
    const d = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx);
    const s = Math.sin(ang * 3 + d * 14 + n[i] * 5) * 0.5 + 0.5;
    const k = clamp(1 - d, 0, 1);
    a[i] = clamp(k * 3, 0, 1) * 255;
    const t = s * (0.4 + k * 0.6);
    return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
  });
  return { p, a };
}

/** Wispy cloud layer (alpha). */
function clouds(seed) {
  const r = makeRng(seed);
  const n = fbm(r, [2, 4, 8, 16], 0.55);
  const p = new Pix();
  const a = new Float32Array(S * S);
  p.fill((x, y, i) => {
    const v = clamp((n[i] - 0.38) * 2.6, 0, 1);
    a[i] = v * 255;
    const f = 0.7 + n[i] * 0.4;
    return [255 * f, 255 * f, 255 * f];
  });
  return { p, a };
}

// ---------------------------------------------------------------- registry
const GENERATORS = {
  stone: () => stoneBlocks(11),
  stoneMoss: () => stoneBlocks(12, { moss: true, mossBottom: 0.5, mossBias: 0.7 }),
  stoneDark: () => stoneBlocks(13, { base: [60, 58, 55], moss: true, mossBottom: 0.35, mossBias: 0.78, cracks: 6 }),
  stoneWall: () => stoneBlocks(14, { base: [84, 80, 72], rowH: 16, thickMortar: true, moss: true, mossBottom: 0.6, mossBias: 0.75 }),
  flagstone: () => stoneBlocks(15, { base: [64, 61, 56], rowH: 32, widthSets: [[32, 32], [24, 40], [40, 24]], cracks: 9, moss: true, mossBias: 0.8 }),
  ceiling: () => stoneBlocks(16, { base: [46, 44, 42], rowH: 16, cracks: 5 }),
  cobble: () => cobble(21),
  cobbleDark: () => cobble(22, { base: [62, 60, 56], gap: [28, 26, 22], count: 12 }),
  wood: () => wood(31),
  woodDark: () => wood(32, { base: [50, 39, 29], rot: 0.5 }),
  beam: () => wood(33, { base: [44, 33, 24], plankW: 64, seams: false, rot: 0.55 }),
  iron: () => iron(41),
  ironPlate: () => iron(42, { plates: true, rustBias: 0.55 }),
  ironDark: () => iron(43, { base: [40, 40, 42], rustBias: 0.6 }),
  dirt: () => dirt(51),
  dirtMoss: () => dirt(52, { moss: true }),
  mud: () => dirt(53, { base: [44, 36, 28] }),
  moss: () => moss(61),
  plaster: () => plaster(71),
  roof: () => roof(81),
  cloth: () => cloth(91),
  clothRed: () => cloth(92, [58, 30, 26]),
  clothBrown: () => cloth(93, [56, 46, 34]),
  flesh: () => flesh(101),
  bone: () => bone(111),
};

const ALPHA_GENERATORS = {
  flame: () => glow(201, [255, 224, 150], [200, 70, 10], true),
  glow: () => glow(202, [255, 255, 255], [255, 255, 255], false),
  portalGreen: () => portalSwirl(203, [10, 40, 30], [120, 220, 160]),
  portalBlue: () => portalSwirl(204, [10, 22, 44], [130, 180, 230]),
  portalRed: () => portalSwirl(206, [40, 8, 10], [230, 90, 60]),
  clouds: () => clouds(205),
};

const cache = new Map();

/** Returns a cached THREE texture for a named generator. */
export function getTexture(name) {
  if (cache.has(name)) return cache.get(name);
  let canvas;
  if (GENERATORS[name]) canvas = GENERATORS[name]().canvas();
  else if (ALPHA_GENERATORS[name]) { const { p, a } = ALPHA_GENERATORS[name](); canvas = p.canvas(a); }
  else throw new Error('Unknown texture ' + name);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 1;
  cache.set(name, tex);
  return tex;
}

export const textureNames = () => [...Object.keys(GENERATORS), ...Object.keys(ALPHA_GENERATORS)];
