// Boss behaviour. A BossBrain picks attacks from the boss's `attacks` list
// (plus `phase2` below 50% HP). Every attack has a clear wind-up with a red
// ground telegraph, so a well-timed dodge roll avoids it.
//   sweep          cone in front            slam     circle ahead
//   nova[:kind]    ring around the boss     charge   dash along a line (charge2 = twice)
//   leap           jumps onto your spot     volley[:kind]  projectile spread
//   summon:type:n  calls adds               blink    teleports away
//   rain           circles rain down around you
import * as THREE from '../../lib/three.module.min.js';
import { Telegraph } from './projectiles.js';
import { events } from '../engine/events.js';

const VOLLEYS = {
  web: { n: 3, projectile: { color: 0xc8d8b0, size: 0.3, speed: 12, slow: 2.5 }, dmg: 0.45 },
  fire: { n: 3, projectile: { color: 0xff7020, size: 0.3, speed: 13, burn: 6 }, dmg: 0.6 },
  fire5: { n: 5, projectile: { color: 0xff5010, size: 0.32, speed: 14, burn: 7 }, dmg: 0.55 },
  water: { n: 4, projectile: { color: 0x50c0b0, size: 0.32, speed: 12, slow: 2 }, dmg: 0.5 },
};

export class BossBrain {
  constructor(e) {
    this.e = e;
    this.phase = 1;
    this.cool = 1.2;
    this.atk = null;
    this.teles = [];
    this.adds = [];
  }

  get winding() { return !!(this.atk && this.atk.stage === 'wind'); }
  get striking() { return !!(this.atk && this.atk.stage === 'act'); }
  get leaping() { return !!(this.atk && this.atk.kind === 'leap' && this.atk.stage === 'act'); }
  get windK() { return this.atk ? Math.min(1, this.atk.t / this.atk.wind) : 0; }

  onHit() {}

  clear() { for (const t of this.teles) t.remove(); this.teles = []; }

  pick(dist) {
    const d = this.e.def;
    const list = this.phase === 2 ? [...d.attacks, ...d.phase2] : d.attacks;
    // close-range attacks only when close, ranged ones otherwise
    const near = ['sweep', 'slam', 'nova'];
    let options = list.filter((a) => (dist < d.reach * 1.6 ? true : !near.includes(a.split(':')[0])));
    if (!options.length) options = list;
    let a = options[Math.floor(Math.random() * options.length)];
    if (a === this.lastAtk && options.length > 1) a = options[(options.indexOf(a) + 1) % options.length];
    this.lastAtk = a;
    return a;
  }

  start(name, ctx) {
    const e = this.e, d = e.def, p = ctx.player;
    const [kind, arg, arg2] = name.split(':');
    const speed = this.phase === 2 ? 0.75 : 1;
    const a = { name, kind, arg, arg2, t: 0, stage: 'wind', wind: d.windup * speed, act: 0.35, hits: false, n: 1 };
    const y = e.pos.y;
    const fwdYaw = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
    e.yaw = fwdYaw;
    const tele = (shape, x, z, yaw = 0, o) => { const t = new Telegraph(e.area, shape, x, y, z, yaw, a.wind, o); this.teles.push(t); return t; };
    const R = e.radius;
    switch (kind) {
      // melee zones are parented to the boss: if it is knocked back or turns, the zone goes with it
      case 'sweep': a.r = d.reach * 1.1 + R * 0.4; a.angle = 2.2; a.zone = tele({ r: a.r, angle: a.angle }, e.pos.x, e.pos.z, fwdYaw, { follow: e }); a.yaw = fwdYaw; break;
      case 'slam': {
        a.r = 2.6 + R * 0.3; const off = R + 1.6;
        a.zone = tele({ r: a.r }, e.pos.x + Math.sin(fwdYaw) * off, e.pos.z + Math.cos(fwdYaw) * off, 0, { follow: e, fwd: off }); a.wind *= 1.1; break;
      }
      case 'nova': a.r = 4.6 + R * 0.5; a.zone = tele({ r: a.r }, e.pos.x, e.pos.z, 0, { follow: e }); a.wind *= 1.25; break;
      case 'charge': case 'charge2':
        a.yaw = fwdYaw; a.len = Math.min(16, Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) + 5);
        if (e.leash) { // stop the charge at the arena edge
          const L = e.leash, dx = Math.sin(fwdYaw), dz = Math.cos(fwdYaw);
          const tx = dx > 0 ? (L.x1 - e.pos.x) / dx : dx < 0 ? (L.x0 - e.pos.x) / dx : 99;
          const tz = dz > 0 ? (L.z1 - e.pos.z) / dz : dz < 0 ? (L.z0 - e.pos.z) / dz : 99;
          a.len = Math.max(2, Math.min(a.len, tx, tz));
        }
        tele({ type: 'rect', w: R + 0.4, len: a.len }, e.pos.x, e.pos.z, fwdYaw);
        a.wind *= 0.8; a.act = a.len / 15; a.n = kind === 'charge2' ? 2 : 1; break;
      case 'leap': a.r = 2.8 + R * 0.3; a.tx = p.pos.x; a.tz = p.pos.z; a.ty = p.pos.y; a.sx = e.pos.x; a.sz = e.pos.z; a.sy = e.pos.y;
        if (e.leash) { const L = e.leash; a.tx = Math.max(L.x0, Math.min(L.x1, a.tx)); a.tz = Math.max(L.z0, Math.min(L.z1, a.tz)); a.ty = e.pos.y; }
        tele({ r: a.r }, a.tx, a.tz); a.wind *= 1.2; a.act = 0.55; break;
      case 'volley': a.wind *= 0.75; break;
      case 'summon': a.wind = 1.0; break;
      case 'blink': a.wind = 0.5; break;
      case 'rain':
        a.spots = [];
        for (let i = 0; i < 5; i++) {
          const ang = Math.random() * Math.PI * 2, rr = i === 0 ? 0 : 2.5 + Math.random() * 3;
          const sx = p.pos.x + Math.cos(ang) * rr, sz = p.pos.z + Math.sin(ang) * rr;
          a.spots.push([sx, sz]); tele({ r: 2.0 }, sx, sz);
        }
        a.wind *= 1.4; break;
    }
    this.atk = a;
  }

  /** Apply damage of the current attack if the player is inside its area. */
  resolve(ctx) {
    const e = this.e, a = this.atk, p = ctx.player, d = e.def;
    const pdx = p.pos.x - e.pos.x, pdz = p.pos.z - e.pos.z, pd = Math.hypot(pdx, pdz);
    const inCircle = (x, z, r) => Math.hypot(p.pos.x - x, p.pos.z - z) < r + 0.3 && Math.abs(p.pos.y - e.pos.y) < 2.5;
    const area = e.area;
    const boom = (x, z, r, col = [1, 0.4, 0.15]) => { area.glow.burst(x, e.pos.y + 0.3, z, Math.round(18 + r * 6), r * 1.6, 0.6, col, 0.08, -3, 0.6); area.dust.burst(x, e.pos.y + 0.2, z, 16, r, 1, [0.25, 0.22, 0.2], 0.12, -2, 1); };
    // hits are checked against the zone's CURRENT position, never where it spawned
    if (a.zone) a.zone._sync();
    switch (a.kind) {
      case 'sweep': {
        const zx = a.zone.x, zz = a.zone.z, zy = a.zone.yaw;
        const qx = p.pos.x - zx, qz = p.pos.z - zz;
        let diff = Math.atan2(qx, qz) - zy; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (Math.hypot(qx, qz) < a.r + 0.3 && Math.abs(diff) < a.angle / 2 && Math.abs(p.pos.y - e.pos.y) < 2.5) e.hitPlayer(p, d.damage);
        boom(zx + Math.sin(zy) * a.r * 0.6, zz + Math.cos(zy) * a.r * 0.6, 1.5);
        break;
      }
      case 'slam': if (inCircle(a.zone.x, a.zone.z, a.r)) e.hitPlayer(p, d.damage, 1.25); boom(a.zone.x, a.zone.z, a.r); p.shake = Math.max(p.shake, 0.6); break;
      case 'nova': {
        const col = a.arg === 'poison' ? [0.5, 0.9, 0.2] : a.arg === 'water' ? [0.3, 0.8, 0.8] : a.arg === 'fire' ? [1, 0.5, 0.1] : [0.8, 0.7, 0.6];
        if (inCircle(a.zone.x, a.zone.z, a.r)) {
          e.hitPlayer(p, d.damage, 0.9);
          if (a.arg === 'poison') p.addDot(6, 4, 'poison');
          if (a.arg === 'fire') p.addDot(8, 3, 'burn');
          if (a.arg === 'water') p.slowT = Math.max(p.slowT || 0, 2.5);
        }
        for (let i = 0; i < 40; i++) { const ang = (i / 40) * Math.PI * 2; area.glow.emit(e.pos.x, e.pos.y + 0.3, e.pos.z, Math.cos(ang) * a.r * 2.2, 0.4, Math.sin(ang) * a.r * 2.2, 0.45, col, 0.1, 0, 1); }
        p.shake = Math.max(p.shake, 0.5);
        break;
      }
      case 'leap': if (inCircle(a.tx, a.tz, a.r)) e.hitPlayer(p, d.damage, 1.2); boom(a.tx, a.tz, a.r); p.shake = Math.max(p.shake, 0.8); break;
      case 'rain': for (const [x, z] of a.spots) { if (inCircle(x, z, 2.0)) e.hitPlayer(p, d.damage, 0.7); boom(x, z, 2, [1, 0.45, 0.1]); } break;
      case 'volley': {
        const v = VOLLEYS[a.arg] || VOLLEYS.fire;
        const from = new THREE.Vector3(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z);
        const to = new THREE.Vector3(p.pos.x, p.eyeY - 0.5, p.pos.z);
        for (let i = 0; i < v.n; i++) ctx.game.projectiles.fire(from, to, { ...v.projectile, damage: d.damage * v.dmg * e.dmgMul, spread: (i - (v.n - 1) / 2) * 0.2, owner: e });
        break;
      }
      case 'summon': {
        this.adds = this.adds.filter((m) => !m.dead);
        const n = Math.min(+a.arg2 || 2, 5 - this.adds.length);
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * Math.PI * 2;
          const pos = new THREE.Vector3(e.pos.x + Math.cos(ang) * (e.radius + 1.5), e.pos.y, e.pos.z + Math.sin(ang) * (e.radius + 1.5));
          const add = ctx.game.enemies.spawnAt(a.arg, pos, area, { level: e.level });
          this.adds.push(add);
          area.dust.burst(pos.x, pos.y + 0.3, pos.z, 20, 2, 0.8, [0.2, 0.18, 0.16], 0.1, -2, 1);
        }
        break;
      }
      case 'blink': {
        for (let tries = 0; tries < 12; tries++) {
          const ang = Math.random() * Math.PI * 2, rr = 6 + Math.random() * 3;
          const q = { x: p.pos.x + Math.cos(ang) * rr, z: p.pos.z + Math.sin(ang) * rr };
          const g = ctx.collision.groundHeight(q.x, q.z, 0.4, e.pos.y + 1, 1);
          const before = { ...q };
          ctx.collision.resolve(q, e.radius, e.pos.y, 2, 0.45);
          if (g > -Infinity && Math.abs(g - e.pos.y) < 0.6 && Math.hypot(q.x - before.x, q.z - before.z) < 0.05 && ctx.collision.lineOfSight(q.x, e.pos.y + 1, q.z, p.pos.x, p.eyeY, p.pos.z)) {
            area.glow.burst(e.pos.x, e.pos.y + 1, e.pos.z, 30, 3, 0.6, [1, 0.5, 0.15], 0.08, 0, 1);
            e.pos.x = q.x; e.pos.z = q.z;
            area.glow.burst(e.pos.x, e.pos.y + 1, e.pos.z, 30, 3, 0.6, [1, 0.5, 0.15], 0.08, 0, 1);
            break;
          }
        }
        break;
      }
    }
  }

  update(dt, ctx, dist, faceYaw) {
    const e = this.e, d = e.def, p = ctx.player;
    let moveSpeed = 0, targetYaw = faceYaw;
    // phase 2 at half health
    if (this.phase === 1 && e.hp < e.maxHp * 0.5) {
      this.phase = 2;
      e.dmgMul *= 1.2;
      this.atk = null; this.clear(); this.cool = 1.2;
      e.area.glow.burst(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z, 60, 6, 1, [1, 0.3, 0.1], 0.1, 0, 1);
      ctx.game.hud.banner(e.name, 'is enraged');
      p.shake = 1;
      events.emit('bossPhase', { enemy: e, phase: 2 });
    }
    for (let i = this.teles.length - 1; i >= 0; i--) this.teles[i].update(dt);

    if (!this.atk) {
      this.cool -= dt;
      if (!p.dead) {
        // close in (walk), using the flow field when out of sight
        moveSpeed = dist > d.reach * 0.9 ? d.speed * (this.phase === 2 ? 1.15 : 1) : 0;
        if (this.cool <= 0 && !p.dead) this.start(this.pick(dist), ctx);
      }
      return { moveSpeed, targetYaw };
    }

    const a = this.atk;
    a.t += dt;
    if (a.stage === 'wind') {
      if (!['charge', 'charge2', 'leap', 'rain', 'slam', 'sweep'].includes(a.kind)) targetYaw = faceYaw; else targetYaw = e.yaw;
      if (a.t >= a.wind) {
        a.stage = 'act'; a.t = 0;
        if (!['charge', 'charge2', 'leap'].includes(a.kind)) { this.resolve(ctx); this.clear(); }
      }
      return { moveSpeed: 0, targetYaw };
    }
    if (a.stage === 'act') {
      if (a.kind === 'charge' || a.kind === 'charge2') {
        this.clear();
        targetYaw = a.yaw; e.yaw = a.yaw;
        moveSpeed = 15;
        if (!a.hits && dist < e.radius + 0.7 && Math.abs(p.pos.y - e.pos.y) < 2) { a.hits = e.hitPlayer(p, d.damage, 1.1) || true; p.shake = 0.7; }
        if (Math.random() < 0.5) e.area.dust.emit(e.pos.x, e.pos.y + 0.2, e.pos.z, 0, 0.5, 0, 0.6, [0.3, 0.27, 0.24], 0.15);
        if (a.t >= a.act) {
          if (--a.n > 0) { this.start(a.name, ctx); this.atk.n = a.n; this.atk.wind *= 0.6; return { moveSpeed: 0, targetYaw }; }
          a.stage = 'rec'; a.t = 0;
        }
        return { moveSpeed, targetYaw };
      }
      if (a.kind === 'leap') {
        const k = Math.min(1, a.t / a.act);
        e.pos.x = a.sx + (a.tx - a.sx) * k; e.pos.z = a.sz + (a.tz - a.sz) * k;
        e.pos.y = a.sy + (a.ty - a.sy) * k + Math.sin(k * Math.PI) * 3;
        e.group.position.copy(e.pos);
        if (k >= 1) { e.pos.y = a.ty; this.resolve(ctx); this.clear(); a.stage = 'rec'; a.t = 0; }
        return { moveSpeed: 0, targetYaw: e.yaw };
      }
      if (a.t >= a.act) { a.stage = 'rec'; a.t = 0; }
      return { moveSpeed: 0, targetYaw: e.yaw };
    }
    // recovery: an opening to punish
    if (a.t >= (this.phase === 2 ? 0.5 : 0.8)) { this.atk = null; this.cool = (this.phase === 2 ? 0.6 : 1.1) + Math.random() * 0.6; }
    return { moveSpeed: 0, targetYaw: e.yaw };
  }
}
