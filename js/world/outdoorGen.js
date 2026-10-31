// Outdoor / cave layout generators for the non-crypt biomes.
// Output is a tile map (2 m tiles) with heights; outdoor.js turns it into
// terrain, collision, instanced borders and props.
//
// Tile types:
export const T = { BLOCK: 0, GROUND: 1, TRAIL: 2, WATER: 3, DEEP: 4, LAVA: 5, BRIDGE: 6, BOARD: 7 };
export const WALKABLE = new Set([T.GROUND, T.TRAIL, T.WATER, T.BRIDGE, T.BOARD]);
export const TILE = 2;
import { makeRng } from '../engine/textures.js';

const W = 60, H = 60;

function noise2(rnd, cells) {
  const g = []; for (let i = 0; i <= cells; i++) { g.push([]); for (let j = 0; j <= cells; j++) g[i].push(rnd()); }
  return (x, y) => {
    const fx = (x / W) * cells, fy = (y / H) * cells, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g[ix][iy], b = g[ix + 1][iy], c = g[ix][iy + 1], d = g[ix + 1][iy + 1];
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}

/** Breadth-first flood over walkable tiles. Returns Int32 distance map (-1 = unreached). */
export function flood(tile, start) {
  const dist = new Int32Array(W * H).fill(-1);
  const q = [start]; dist[start] = 0;
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (dist[nk] !== -1 || !WALKABLE.has(tile[nk])) continue;
      dist[nk] = dist[k] + 1; q.push(nk);
    }
  }
  return dist;
}

/** Clearings connected by winding trails (forest, jungle, snowfields, swamp islands). */
function clearingsLayout(rnd, o) {
  const tile = new Uint8Array(W * H).fill(o.fill ?? T.BLOCK);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const cl = [];
  cl.push({ x: ri(24, 36), y: 6, r: 4, entrance: true });
  for (let tries = 0; tries < 600 && cl.length < o.count; tries++) {
    const r = ri(o.rMin, o.rMax), x = ri(r + 3, W - r - 4), y = ri(r + 3, H - r - 4);
    if (cl.every((c) => Math.hypot(c.x - x, c.y - y) > c.r + r + o.gap)) cl.push({ x, y, r });
  }
  const carveDisc = (cx, cy, r, type) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
      const wob = r * (0.85 + 0.25 * Math.sin(Math.atan2(y - cy, x - cx) * 3 + cx));
      if (Math.hypot(x - cx, y - cy) <= wob) tile[y * W + x] = type;
    }
  };
  for (const c of cl) carveDisc(c.x, c.y, c.r, o.clearType ?? T.GROUND);
  // minimum spanning tree + a couple of loops
  const edges = [];
  const inTree = [0];
  while (inTree.length < cl.length) {
    let best = null;
    for (const a of inTree) for (let b = 0; b < cl.length; b++) {
      if (inTree.includes(b)) continue;
      const d = Math.hypot(cl[a].x - cl[b].x, cl[a].y - cl[b].y);
      if (!best || d < best.d) best = { a, b, d };
    }
    edges.push([best.a, best.b]); inTree.push(best.b);
  }
  for (let i = 0; i < 2; i++) { const a = ri(1, cl.length - 1), b = ri(1, cl.length - 1); if (a !== b) edges.push([a, b]); }
  const trails = [];
  for (const [a, b] of edges) {
    const A = cl[a], B = cl[b], pts = [];
    const len = Math.hypot(B.x - A.x, B.y - A.y), steps = Math.ceil(len * 2);
    const px = -(B.y - A.y) / len, py = (B.x - A.x) / len, ph = rnd() * 6, amp = 2 + rnd() * 3;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, wob = Math.sin(t * Math.PI * (1.5 + (ph % 1)) + ph) * amp * Math.sin(t * Math.PI);
      const x = A.x + (B.x - A.x) * t + px * wob, y = A.y + (B.y - A.y) * t + py * wob;
      pts.push([x, y]);
      carveDisc(x, y, o.trailW, o.trailType ?? T.TRAIL);
    }
    trails.push(pts);
  }
  return { tile, clearings: cl, trails };
}

/** Cellular-automata caves (Kilnworks). */
function cavesLayout(rnd) {
  let tile = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) { const x = k % W, y = (k / W) | 0; tile[k] = x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || rnd() < 0.45 ? T.BLOCK : T.GROUND; }
  for (let it = 0; it < 5; it++) {
    const nt = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || tile[yy * W + xx] === T.BLOCK) n++; }
      nt[y * W + x] = x < 2 || y < 2 || x >= W - 2 || y >= H - 2 ? T.BLOCK : n >= 5 ? T.BLOCK : T.GROUND;
    }
    tile = nt;
  }
  // caves as "clearings": sample open pockets for spawns / props
  const cl = [];
  for (let tries = 0; tries < 400 && cl.length < 12; tries++) {
    const x = 4 + Math.floor(rnd() * (W - 8)), y = 4 + Math.floor(rnd() * (H - 8));
    if (tile[y * W + x] !== T.GROUND) continue;
    let r = 1; while (r < 5 && [[r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dy]) => tile[(y + dy) * W + x + dx] === T.GROUND)) r++;
    if (r >= 3 && cl.every((c) => Math.hypot(c.x - x, c.y - y) > 9)) cl.push({ x, y, r: r - 1 });
  }
  return { tile, clearings: cl, trails: [] };
}

/** Meandering river across the map. Returns list of tiles it covers. */
function river(rnd, width, axis = 'x') {
  const out = [];
  let c = H * (0.35 + rnd() * 0.3), ph = rnd() * 6;
  for (let t = 0; t < (axis === 'x' ? W : H); t++) {
    c += Math.sin(t * 0.18 + ph) * 0.9;
    for (let d = -width; d <= width; d++) {
      const a = t, b = Math.round(c + d);
      if (b < 1 || b >= H - 1) continue;
      out.push(axis === 'x' ? [a, b] : [b, a]);
    }
  }
  return out;
}

/** Generate one biome layout (retries until connectivity validates). */
export function generateOutdoor(biome, seed) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const out = tryOutdoor(biome, seed + attempt * 7717);
    if (out) return out;
  }
  throw new Error('outdoor generation failed: ' + biome);
}

function tryOutdoor(biome, seed) {
  const rnd = makeRng(seed);
  const n1 = noise2(rnd, 5), n2 = noise2(rnd, 11);
  let L;
  const features = [];
  if (biome === 'forest') L = clearingsLayout(rnd, { count: 10, rMin: 3, rMax: 5, gap: 4, trailW: 1.3 });
  else if (biome === 'jungle') L = clearingsLayout(rnd, { count: 9, rMin: 3, rMax: 6, gap: 4, trailW: 1.4 });
  else if (biome === 'frozen') L = clearingsLayout(rnd, { count: 8, rMin: 5, rMax: 8, gap: 3, trailW: 2.2 });
  else if (biome === 'swamp') L = clearingsLayout(rnd, { count: 10, rMin: 3, rMax: 5, gap: 3, trailW: 1.6, fill: T.DEEP, trailType: T.WATER });
  else L = cavesLayout(rnd);
  const { tile, clearings } = L;
  const height = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) {
    const x = k % W, y = (k / W) | 0;
    height[k] = biome === 'mine' ? (n1(x, y) - 0.5) * 2.0 : biome === 'swamp' ? (n2(x, y) - 0.5) * 0.3 : (n1(x, y) - 0.5) * 3.2 + (n2(x, y) - 0.5) * 0.6;
  }

  if (biome === 'jungle') {
    // a river winds through; trails ford it
    for (const [x, y] of river(rnd, 1)) { const k = y * W + x; if (tile[k] !== T.BLOCK) tile[k] = T.WATER; }
  }
  if (biome === 'swamp') {
    // around each island a ring of shallow water; boardwalks over some trails
    for (const c of clearings) for (let y = c.y - c.r - 2; y <= c.y + c.r + 2; y++) for (let x = c.x - c.r - 2; x <= c.x + c.r + 2; x++) {
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
      const k = y * W + x;
      if (tile[k] === T.DEEP && Math.hypot(x - c.x, y - c.y) < c.r + 2) tile[k] = T.WATER;
    }
    L.trails.forEach((pts, i) => { if (i % 2 === 0) for (const [x, y] of pts) { const k = Math.round(y) * W + Math.round(x); if (tile[k] === T.WATER) tile[k] = T.BOARD; } });
    for (let tries = 0, n = 0; tries < 300 && n < 4; tries++) {
      const x = 4 + Math.floor(rnd() * (W - 8)), y = 4 + Math.floor(rnd() * (H - 8));
      if (tile[y * W + x] !== T.DEEP) continue;
      if (![[3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dy]) => WALKABLE.has(tile[(y + dy) * W + x + dx]))) continue;
      features.push({ type: 'belltower', x, y }); n++;
    }
  }
  if (biome === 'mine') {
    // a lava river, crossed by bridges every few tiles where it cuts the caves
    const lav = river(rnd, 1, rnd() < 0.5 ? 'x' : 'y');
    for (const [x, y] of lav) { const k = y * W + x; if (tile[k] === T.GROUND) tile[k] = T.LAVA; }
  }

  // entrance / exit
  let ent = clearings[0];
  if (biome === 'mine') {
    // entrance: the open pocket closest to the top
    ent = clearings.slice().sort((a, b) => a.y - b.y)[0];
    if (!ent) return null;
    ent.entrance = true;
  }
  const ek = ent.y * W + ent.x;
  if (!WALKABLE.has(tile[ek])) return null;
  let dist = flood(tile, ek);
  if (biome === 'mine') {
    // bridge the lava wherever it splits the caves
    for (let pass = 0; pass < 8; pass++) {
      let bridged = false;
      for (let k = 0; k < W * H && !bridged; k++) {
        if (tile[k] !== T.LAVA) continue;
        const x = k % W, y = (k / W) | 0;
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const a = (y - dy * 2) * W + x - dx * 2, b = (y + dy * 2) * W + x + dx * 2;
          if (a < 0 || b >= W * H) continue;
          const reachedA = dist[a] >= 0, reachedB = dist[b] >= 0;
          if (WALKABLE.has(tile[a]) && WALKABLE.has(tile[b]) && reachedA !== reachedB) {
            for (let s = -2; s <= 2; s++) for (let w = 0; w <= 1; w++) { const kk = (y + dy * s + dx * w) * W + x + dx * s + dy * w; if (tile[kk] === T.LAVA) { tile[kk] = T.BRIDGE; } }
            features.push({ type: 'bridge', x, y, axis: dx ? 'x' : 'y' });
            bridged = true; break;
          }
        }
      }
      if (!bridged) break;
      dist = flood(tile, ek);
    }
  }
  // drop unreachable walkable pockets, require most of the map to be reachable
  let walk = 0, reach = 0;
  for (let k = 0; k < W * H; k++) if (WALKABLE.has(tile[k])) { walk++; if (dist[k] >= 0) reach++; else tile[k] = biome === 'swamp' ? T.DEEP : T.BLOCK; }
  if (reach < 350 || reach < walk * 0.6) return null;
  const rooms = clearings.filter((c) => dist[c.y * W + c.x] >= 0);
  if (rooms.length < 5) return null;
  const exit = rooms.slice().sort((a, b) => dist[b.y * W + b.x] - dist[a.y * W + a.x])[0];
  if (dist[exit.y * W + exit.x] < 20) return null;
  exit.exit = true;

  // biome features inside clearings
  for (const c of rooms) {
    if (c.entrance || c.exit) continue;
    const roll = rnd();
    if (biome === 'forest') features.push({ type: 'logs', x: c.x, y: c.y, r: c.r });
    if (biome === 'jungle' && roll < 0.5) features.push({ type: 'ruin', x: c.x, y: c.y, r: c.r });
    if (biome === 'frozen') { features.push({ type: roll < 0.55 ? 'fortwall' : 'frozen', x: c.x, y: c.y, r: c.r }); if (roll < 0.3) features.push({ type: 'frozen', x: c.x + 2, y: c.y - 1, r: c.r }); }
    if (biome === 'swamp' && roll < 0.45) features.push({ type: 'sunken', x: c.x, y: c.y, r: c.r });
    if (biome === 'mine' && roll < 0.6) features.push({ type: 'cart', x: c.x, y: c.y, r: c.r });
  }
  if (biome === 'mine') {
    // rails along the shortest route from entrance to exit
    let k = exit.y * W + exit.x;
    const rail = [];
    while (dist[k] > 0) {
      rail.push(k);
      const x = k % W, y = (k / W) | 0;
      let nk = k;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t2 = (y + dy) * W + x + dx; if (dist[t2] >= 0 && dist[t2] < dist[nk]) nk = t2; }
      if (nk === k) break; k = nk;
    }
    features.push({ type: 'rails', tiles: rail });
  }
  return { W, H, tile, height, clearings: rooms, entrance: ent, exit, features, seed, dist };
}
