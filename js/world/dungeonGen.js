// Procedural catacomb generator. Produces the same cell format the Dungeon
// builder uses: rooms on different depth levels joined by corridors, with a
// stair cell wherever a corridor drops into a deeper room. Every layout is
// validated (all rooms reachable on foot) before it is used.
import { makeRng } from '../engine/textures.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * opts.enemies: [[type, weight], ...]   enemy mix (heavy types get rarer in small rooms)
 * opts.arena:   reserve a big boss arena, connected last (a dead end)
 */
export function generateDungeon(seed, opts = {}) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const out = tryGenerate(seed + attempt * 7919, opts);
    if (out) return out;
  }
  throw new Error('dungeon generation failed');
}

function tryGenerate(seed, opts) {
  const rnd = makeRng(seed);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const W = 46, H = 46;
  const cells = [];
  for (let r = 0; r < H; r++) { cells.push([]); for (let c = 0; c < W; c++) cells[r].push({ type: 'wall' }); }
  const open = (r, c) => cells[r] && cells[r][c] && cells[r][c].type !== 'wall';

  // ---------------------------------------------------------- rooms
  const rooms = [];
  const fits = (x, y, w, h) => {
    if (x < 2 || y < 2 || x + w > W - 2 || y + h > H - 2) return false;
    for (const o of rooms) if (x < o.x + o.w + 3 && x + w + 3 > o.x && y < o.y + o.h + 3 && y + h + 3 > o.y) return false;
    return true;
  };
  // entrance room: portal on its north wall
  const ex = ri(14, W - 20);
  rooms.push({ x: ex, y: 2, w: 5, h: 4, level: 0, entrance: true });
  let arena = null;
  if (opts.arena) {
    for (let i = 0; i < 200 && !arena; i++) {
      const w = 9, h = 9, x = ri(3, W - w - 3), y = ri(H - h - 12, H - h - 2);
      if (fits(x, y, w, h)) { arena = { x, y, w, h, arena: true, hall: true }; rooms.push(arena); }
    }
    if (!arena) return null;
  }
  const target = ri(9, 12) + (arena ? 1 : 0);
  let hallPlaced = !!arena;
  for (let i = 0; i < 400 && rooms.length < target; i++) {
    const hall = !hallPlaced && rooms.length >= 3 && rnd() < 0.35;
    const w = hall ? ri(7, 9) : ri(3, 7), h = hall ? ri(6, 8) : ri(3, 6);
    const x = ri(2, W - w - 2), y = ri(4, H - h - 2);
    if (!fits(x, y, w, h)) continue;
    rooms.push({ x, y, w, h, hall });
    if (hall) hallPlaced = true;
  }
  if (rooms.length < 7) return null;

  // ---------------------------------------------------------- connect (Prim-style tree from the entrance)
  const center = (o) => [o.x + Math.floor(o.w / 2), o.y + Math.floor(o.h / 2)];
  const inRoom = (o, c, r) => c >= o.x && c < o.x + o.w && r >= o.y && r < o.y + o.h;
  const roomAt = (c, r) => rooms.find((o) => inRoom(o, c, r));
  const carveRoom = (o) => {
    for (let r = o.y; r < o.y + o.h; r++) for (let c = o.x; c < o.x + o.w; c++) cells[r][c] = { type: 'floor', level: o.level, hall: !!o.hall, room: o };
  };
  carveRoom(rooms[0]);
  const connected = [rooms[0]];
  const pending = rooms.slice(1);
  const corridors = [];
  let exitCell = null;

  // L-shaped path between two rooms (list of [c, r]); `hFirst` picks the bend
  const lPath = (a, b, hFirst) => {
    const [x0, y0] = center(a), [x1, y1] = center(b);
    const p = [];
    let x = x0, y = y0;
    const stepX = () => { while (x !== x1) { x += Math.sign(x1 - x); p.push([x, y]); } };
    const stepY = () => { while (y !== y1) { y += Math.sign(y1 - y); p.push([x, y]); } };
    if (hFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
    return p;
  };

  const tryConnect = (a, b, level, hFirst) => {
    const path = lPath(a, b, hFirst);
    // corridor = cells between leaving room a and entering room b
    let start = 0;
    while (start < path.length && inRoom(a, path[start][0], path[start][1])) start++;
    let end = path.findIndex(([c, r]) => inRoom(b, c, r));
    if (end < 0 || end - start < 2) return null;
    const corr = path.slice(start, end);
    const allowed = (c, r) => inRoom(a, c, r) || inRoom(b, c, r) || corr.some(([cc, rr]) => cc === c && rr === r);
    for (const [c, r] of corr) {
      if (c < 1 || r < 1 || c >= W - 1 || r >= H - 1) return null;
      if (open(r, c)) return null;
      for (const [dc, dr] of DIRS) if (open(r + dr, c + dc) && !allowed(c + dc, r + dr)) return null;
      if (roomAt(c, r)) return null;
    }
    // stairs: the last corridor cell drops into the deeper room, along a straight run
    let stair = null;
    if (level !== a.level) {
      const [lc, lr] = corr[corr.length - 1];
      const [nc, nr] = path[end];
      const dir = [nc - lc, nr - lr];
      const [pc, pr] = corr.length > 1 ? corr[corr.length - 2] : path[start - 1];
      if (pc !== lc - dir[0] || pr !== lr - dir[1]) return null;   // must not be on the bend
      stair = { c: lc, r: lr, dir };
    }
    return { corr, stair };
  };

  while (pending.length) {
    // nearest pending room to any connected room (the arena always goes last)
    let best = null;
    const cands = pending.length > 1 ? pending.filter((r) => !r.arena) : pending;
    for (const b of cands) for (const a of connected) {
      const [ax, ay] = center(a), [bx, by] = center(b);
      const d = Math.abs(ax - bx) + Math.abs(ay - by);
      if (!best || d < best.d) best = { a, b, d };
    }
    const { b } = best;
    // try every connected room as a parent, closest first
    const parents = connected.slice().sort((p, q) => {
      const [bx, by] = center(b);
      const [px, py] = center(p), [qx, qy] = center(q);
      return (Math.abs(px - bx) + Math.abs(py - by)) - (Math.abs(qx - bx) + Math.abs(qy - by));
    });
    let done = false;
    for (const a of parents) {
      const deeper = a.level < 3 && (b.hall ? true : rnd() < 0.5);
      const level = b.hall ? Math.min(3, Math.max(1, a.level + 1)) : deeper ? a.level + 1 : a.level;
      if (level - a.level > 1) continue;
      const res = tryConnect(a, b, level, rnd() < 0.5) || tryConnect(a, b, level, true) || tryConnect(a, b, level, false);
      if (!res) continue;
      b.level = level; b.parent = a; b.depth = (a.depth || 0) + 1;
      carveRoom(b);
      for (const [c, r] of res.corr) cells[r][c] = { type: 'floor', level: a.level };
      if (res.stair) cells[res.stair.r][res.stair.c] = { type: 'stair', dir: res.stair.dir, level: a.level };
      corridors.push(res);
      if (a === rooms[0] && !exitCell) exitCell = res.corr[0];
      if (b.arena) {
        const [lc, lr] = res.corr[res.corr.length - 1];
        b.entryCell = [lc, lr];
        b.entryDir = [Math.sign(center(b)[0] - lc) * (Math.abs(center(b)[0] - lc) > Math.abs(center(b)[1] - lr) ? 1 : 0), Math.sign(center(b)[1] - lr) * (Math.abs(center(b)[1] - lr) >= Math.abs(center(b)[0] - lc) ? 1 : 0)];
      }
      connected.push(b);
      done = true;
      break;
    }
    pending.splice(pending.indexOf(b), 1);
    if (!done) { /* unreachable room is simply dropped */ }
  }
  const used = connected;
  if (used.length < 7) return null;
  if (arena && !used.includes(arena)) return null;

  // pillars in the hall (inner grid, never next to a doorway)
  for (const o of used) {
    if (!o.hall) continue;
    for (let r = o.y + 1; r < o.y + o.h - 1; r += 3) for (let c = o.x + 1; c < o.x + o.w - 1; c += 3) {
      if (c === center(o)[0] || o.arena) continue;
      cells[r][c].pillar = true;
    }
  }
  // portal cell
  const e = rooms[0];
  const portal = [e.x + 2, e.y];
  cells[portal[1]][portal[0]].portal = true;

  if (!validate(cells, W, H, portal, used)) return null;

  // ---------------------------------------------------------- population
  const pickType = (o) => {
    const tbl = opts.enemies || [['hollow', 5], ['ghoul', 3], ['knight', 1]];
    const heavyBoost = 0.5 + o.level * 0.35 + (o.hall ? 0.4 : 0);
    const w = tbl.map(([t, wt]) => [t, wt * (['knight', 'brute'].includes(t) ? heavyBoost : 1)]);
    let roll = rnd() * w.reduce((s, [, x]) => s + x, 0);
    for (const [t, x] of w) { roll -= x; if (roll <= 0) return t; }
    return w[0][0];
  };
  const far = used.slice(1).filter((o) => !o.arena).sort((p, q) => (q.depth * 10 + q.level * 5 + q.w * q.h * 0.1) - (p.depth * 10 + p.level * 5 + p.w * p.h * 0.1))[0];
  const spawns = [];
  const braziers = [];
  const decor = [];
  const freeCell = (o, avoid = []) => {
    for (let i = 0; i < 30; i++) {
      const c = ri(o.x, o.x + o.w - 1), r = ri(o.y, o.y + o.h - 1);
      if (cells[r][c].pillar || avoid.some(([ac, ar]) => ac === c && ar === r)) continue;
      return [c, r];
    }
    return null;
  };
  for (const o of used) {
    if (o.entrance || o.arena) continue;
    const taken = [];
    const area = o.w * o.h;
    let n = Math.min(4, 1 + Math.floor(area / 12) + (o.level >= 2 ? 1 : 0));
    if (o === far) n += 1;
    for (let i = 0; i < n; i++) {
      const p = freeCell(o, taken);
      if (!p) continue;
      taken.push(p);
      spawns.push([p[0], p[1], pickType(o)]);
    }
    if (area >= 16 && !o.hall) {
      const [cx, cy] = center(o);
      if (!taken.some(([c, r]) => c === cx && r === cy)) braziers.push([cx, cy]);
    }
    if (o.hall) for (const [dx, dy] of [[1, 1], [o.w - 2, 1], [1, o.h - 2], [o.w - 2, o.h - 2]]) if (!cells[o.y + dy][o.x + dx].pillar) braziers.push([o.x + dx, o.y + dy]);
    const kinds = ['bones', 'bones', 'rubble', 'sarcophagus'];
    for (let i = 0; i < Math.floor(area / 10); i++) {
      const p = freeCell(o, taken);
      if (p) { taken.push(p); decor.push([p[0], p[1], kinds[Math.floor(rnd() * kinds.length)]]); }
    }
  }
  // the deepest room guards the reward chest (random dungeons)
  const [fc, fr] = center(far);
  const chest = arena ? null : [fc, far.y];
  braziers.push([far.x, far.y + far.h - 1], [far.x + far.w - 1, far.y + far.h - 1]);
  if (arena) for (const [dx, dy] of [[0, 0], [arena.w - 1, 0], [0, arena.h - 1], [arena.w - 1, arena.h - 1]]) braziers.push([arena.x + dx, arena.y + dy]);
  // ---------------------------------------------------------- verticality
  // daises (raised, jump up), pits (sunken, mantle out), trenches (jump across)
  // and high secret alcoves (mantle / double jump) - never on the room's edge
  // ring, so walking routes through every room stay open.
  const occupied = new Set([...spawns, ...braziers, ...decor].map(([c, r]) => r * W + c));
  if (opts.vertical !== false) {
    for (const o of used) {
      if (o.entrance || o.arena || o.w < 5 || o.h < 5) continue;
      const ok = (c, r) => c > o.x && c < o.x + o.w - 1 && r > o.y && r < o.y + o.h - 1 && !cells[r][c].pillar && !occupied.has(r * W + c) && !cells[r][c].raise;
      const roll = rnd();
      for (let attempt = 0; attempt < 8; attempt++) {
      if (roll < 0.3) {          // dais 2x2, 1 m up
        const c0 = ri(o.x + 1, o.x + o.w - 3), r0 = ri(o.y + 1, o.y + o.h - 3);
        const blk = [[c0, r0], [c0 + 1, r0], [c0, r0 + 1], [c0 + 1, r0 + 1]];
        if (blk.every(([c, r]) => ok(c, r))) for (const [c, r] of blk) cells[r][c].raise = 1.0;
      } else if (roll < 0.5) {   // pit 2x2, 2 m down
        const c0 = ri(o.x + 1, o.x + o.w - 3), r0 = ri(o.y + 1, o.y + o.h - 3);
        const blk = [[c0, r0], [c0 + 1, r0], [c0, r0 + 1], [c0 + 1, r0 + 1]];
        if (blk.every(([c, r]) => ok(c, r))) for (const [c, r] of blk) { cells[r][c].raise = -2.0; cells[r][c].pit = true; }
      } else if (roll < 0.65 && o.w >= 6) {   // trench: a 1-wide gap across the interior (a jump shortcut)
        const c = ri(o.x + 2, o.x + o.w - 3);
        const col = []; for (let r = o.y + 1; r < o.y + o.h - 1; r++) col.push([c, r]);
        if (col.every(([cc, rr]) => ok(cc, rr))) for (const [cc, rr] of col) { cells[rr][cc].raise = -2.5; cells[rr][cc].pit = true; }
      }
      if (cells[o.y + 1].slice(o.x, o.x + o.w).some((x) => x.raise) || o.h > 2 && cells.slice(o.y + 1, o.y + o.h - 1).some((row) => row.slice(o.x + 1, o.x + o.w - 1).some((x) => x.raise))) break;
      }
    }
    // one high secret alcove per level (sometimes two): a wall niche 2.4 m up with a chest
    const secrets = [];
    const want = rnd() < 0.6 ? 1 : 2;
    for (let tries = 0; tries < 300 && secrets.length < want; tries++) {
      const o = used[1 + Math.floor(rnd() * (used.length - 1))];
      if (!o || o.arena) continue;
      const side = Math.floor(rnd() * 4);
      let c, r, dc, dr;
      if (side === 0) { c = ri(o.x + 1, o.x + o.w - 2); r = o.y - 1; dc = 0; dr = -1; }
      else if (side === 1) { c = ri(o.x + 1, o.x + o.w - 2); r = o.y + o.h; dc = 0; dr = 1; }
      else if (side === 2) { c = o.x - 1; r = ri(o.y + 1, o.y + o.h - 2); dc = -1; dr = 0; }
      else { c = o.x + o.w; r = ri(o.y + 1, o.y + o.h - 2); dc = 1; dr = 0; }
      if (c < 2 || r < 2 || c >= W - 2 || r >= H - 2 || cells[r][c].type !== 'wall') continue;
      // must be a niche: behind it and both sides are solid rock
      const rock = (cc, rr) => cells[rr] && cells[rr][cc] && cells[rr][cc].type === 'wall';
      const solid = rock(c + dc, r + dr) && rock(c + dr, r + dc) && rock(c - dr, r - dc) && rock(c + dc + dr, r + dr + dc) && rock(c + dc - dr, r + dr - dc);
      const front = cells[r - dr][c - dc];
      if (!solid || occupied.has((r - dr) * W + (c - dc)) || front.raise || front.pillar) continue;
      cells[r][c] = { type: 'floor', level: o.level, raise: 2.4, secret: true, alcove: [dc, dr] };
      secrets.push([c, r, dc, dr]);
    }
    var secretSpots = secrets;
  }
  // map of cell -> room index (for the minimap's room reveal)
  used.forEach((o, i) => { for (let r = o.y; r < o.y + o.h; r++) for (let c = o.x; c < o.x + o.w; c++) cells[r][c].roomId = i; });

  return {
    cells, rows: H, cols: W, spawns, braziers, decor, chest, portal, seed, rooms: used.length, exit: exitCell, secrets: secretSpots || [],
    roomRects: used.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h, arena: !!o.arena })),
    far: { x: far.x, y: far.y, w: far.w, h: far.h, cx: fc, cy: fr },
    arena: arena && { x: arena.x, y: arena.y, w: arena.w, h: arena.h, cx: center(arena)[0], cy: center(arena)[1], entryDir: arena.entryDir || [0, 1] },
  };
}

/** BFS on foot: same-level floors connect; stairs only along their direction. */
function validate(cells, W, H, portal, rooms) {
  const key = (c, r) => r * W + c;
  const seen = new Set([key(portal[0], portal[1])]);
  const q = [portal];
  const lvl = (cell) => cell.level;
  while (q.length) {
    const [c, r] = q.pop();
    const a = cells[r][c];
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr;
      const b = cells[nr] && cells[nr][nc];
      if (!b || b.type === 'wall' || seen.has(key(nc, nr))) continue;
      let ok = false;
      if (a.type === 'floor' && b.type === 'floor') ok = lvl(a) === lvl(b);
      else if (b.type === 'stair') ok = (dc === b.dir[0] && dr === b.dir[1] && lvl(a) === b.level) || (dc === -b.dir[0] && dr === -b.dir[1] && lvl(a) === b.level + 1);
      else if (a.type === 'stair') ok = (dc === a.dir[0] && dr === a.dir[1] && lvl(b) === a.level + 1) || (dc === -a.dir[0] && dr === -a.dir[1] && lvl(b) === a.level);
      if (!ok) continue;
      seen.add(key(nc, nr));
      q.push([nc, nr]);
    }
  }
  for (const o of rooms) if (!seen.has(key(o.x, o.y))) return false;
  return true;
}
