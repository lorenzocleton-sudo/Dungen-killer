// Generic enemy actor: idle -> alert -> chase -> windup -> strike -> recover,
// with stagger, damage-over-time, chill, ranged attacks and death.
// Stats and models come from ENEMY_TYPES. Bosses delegate their combat to a
// BossBrain (bosses.js) but share movement, animation and death.
import * as THREE from '../../lib/three.module.min.js';
import { ENEMY_TYPES } from './enemyTypes.js';
import { events } from '../engine/events.js';
import { BossBrain } from './bosses.js';

const STEP = 0.45;
const _wp = new THREE.Vector3();
let nextId = 1;

export class Enemy {
  /** opts: level (main-dungeon depth scaling), hpMul, dmgMul, elite (mini-boss) */
  constructor(type, pos, area, opts = {}) {
    this.id = nextId++;
    this.type = type;
    this.def = ENEMY_TYPES[type];
    this.area = area;
    this.model = this.def.build();
    this.group = this.model.root;
    this.elite = !!opts.elite;
    const base = this.group.scale.x || 1;
    this.sizeMul = base * (this.elite ? 1.45 : 1);
    this.group.scale.setScalar(this.sizeMul);
    this.pos = pos.clone();
    this.home = pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.level = opts.level || 1;
    this.hpMul = (opts.hpMul || 1) * (this.elite ? 4 : 1) * (1 + (this.level - 1) * 0.3);
    this.dmgMul = (opts.dmgMul || 1) * (this.elite ? 1.5 : 1) * (1 + (this.level - 1) * 0.18);
    this.hp = Math.round(this.def.hp * this.hpMul);
    this.maxHp = this.hp;
    this.name = this.elite ? `Elder ${this.def.name}` : this.def.name;
    this.state = 'idle';
    this.timer = Math.random();
    this.anim = Math.random() * 10;
    this.flash = 0;
    this.poiseDmg = 0;
    this.dead = false;
    this.remove = false;
    this.senseTimer = Math.random() * 0.3;
    this.lostTimer = 0;
    this.vy = 0;
    this.rangedCd = 1 + Math.random();
    this.group.position.copy(this.pos);
    this.group.rotation.order = 'YXZ';
    area.scene.add(this.group);
    if (this.def.boss) this.brain = new BossBrain(this);
  }

  // the model is authored at scale 1; radius/height grow with size
  get radius() { return this.def.radius * this.sizeMul / (this.def.modelScale || 1); }
  get height() { return this.def.height * this.sizeMul / (this.def.modelScale || 1); }
  get alive() { return !this.dead; }
  get showsBar() { return (this.def.boss || this.elite) && !this.dead && this.state !== 'idle'; }

  headPos(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + this.height * 0.8, this.pos.z);
  }

  takeHit(amount, fromPos, knock = 1) {
    if (this.dead) return;
    this.hp -= amount;
    this.flash = 0.14;
    this.poiseDmg += amount;
    const dx = this.pos.x - fromPos.x, dz = this.pos.z - fromPos.z, d = Math.hypot(dx, dz) || 1;
    const k = (this.def.heavy || this.def.boss ? 0.4 : 2.6) * knock;
    this.vel.x += (dx / d) * k; this.vel.z += (dz / d) * k;
    if (this.state === 'idle' || this.state === 'alert') this.state = 'chase';
    if (this.hp <= 0) { this.die(); return; }
    if (this.brain) { this.brain.onHit(); return; }
    if (this.poiseDmg >= this.def.poise * (this.elite ? 2 : 1)) {
      this.poiseDmg = 0;
      this.state = 'stagger'; this.timer = this.def.heavy ? 0.6 : 0.35;
    }
  }

  /** Damage-over-time: kind 'burn' | 'bleed' | 'poison'. Keeps the stronger effect. */
  dot(kind, dps, duration) {
    if (this.dead) return;
    const d = (this.dots || (this.dots = {}))[kind] || (this.dots[kind] = { dps: 0, t: 0, tick: 0.5 });
    d.dps = Math.max(d.t > 0 ? d.dps : 0, dps);
    d.t = Math.max(d.t, duration);
  }

  ignite(dps, duration) { this.dot('burn', dps, duration); }

  chill(pct, duration) {
    if (this.def.boss) pct *= 0.4;
    this.chillPct = Math.max(this.chillT > 0 ? this.chillPct : 0, pct);
    this.chillT = Math.max(this.chillT || 0, duration);
  }

  get burning() { return !!(this.dots && this.dots.burn && this.dots.burn.t > 0); }

  _updateDots(dt) {
    if (this.chillT > 0) this.chillT -= dt;
    if (!this.dots || this.dead) return;
    const col = { burn: [1, 0.45, 0.1], bleed: [0.6, 0.04, 0.02], poison: [0.4, 0.8, 0.2] };
    for (const [kind, d] of Object.entries(this.dots)) {
      if (d.t <= 0) continue;
      d.t -= dt; d.tick -= dt;
      if (Math.random() < dt * 18) {
        const sys = kind === 'burn' ? this.area.glow : this.area.dust;
        sys.emit(this.pos.x + (Math.random() - 0.5) * 0.5, this.pos.y + Math.random() * this.height, this.pos.z + (Math.random() - 0.5) * 0.5,
          0, kind === 'burn' ? 1.2 : -0.8, 0, 0.5, col[kind], 0.05, 0, 0);
      }
      if (d.tick <= 0) {
        d.tick = 0.5;
        const dmg = Math.max(1, Math.round(d.dps * 0.5));
        this.hp -= dmg;
        events.emit('enemyDot', { enemy: this, amount: dmg, kind });
        if (this.hp <= 0) { this.die(); return; }
      }
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.timer = 0;
    if (this.brain) this.brain.clear();
    events.emit('enemyKilled', { enemy: this, type: this.type, pos: this.pos.clone() });
  }

  setFlash(v) {
    for (const m of Object.values(this.model.mats)) m.emissive.setRGB(v * 0.32, v * 0.05, v * 0.02);
  }

  /** Deal damage to the player, applying this enemy's on-hit effects. */
  hitPlayer(player, base, mul = 1) {
    const dealt = player.damage(Math.round(base * this.dmgMul * mul * (0.85 + Math.random() * 0.3)), this.pos, this);
    if (dealt && this.def.onHit && this.def.onHit.slow) player.slowT = Math.max(player.slowT || 0, this.def.onHit.slow);
    if (dealt && this.def.onHit && this.def.onHit.poison) player.addDot(this.def.onHit.poison, 3, 'poison');
    return dealt;
  }

  update(dt, ctx) {
    const { player, collision } = ctx;
    const d = this.def;
    this.anim += dt;
    if (this.flash > 0) { this.flash -= dt; this.setFlash(Math.max(0, this.flash) / 0.14); }
    this.poiseDmg = Math.max(0, this.poiseDmg - dt * 8);
    this._updateDots(dt);
    if (this.dead) { this._updateDeath(dt); return; }

    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const dy = player.pos.y - this.pos.y;
    const faceYaw = Math.atan2(dx, dz);
    let moveSpeed = 0, targetYaw = this.yaw;
    this.timer -= dt;

    if (this.state === 'idle' || this.state === 'alert') {
      if (this.state === 'idle') {
        this.senseTimer -= dt;
        if (this.senseTimer <= 0 && !player.dead) {
          this.senseTimer = 0.25;
          const notice = d.notice * (this.elite || d.boss ? 1.4 : 1);
          if (dist < notice && Math.abs(dy) < 3 && this._canSee(player, collision)) {
            this.state = 'alert'; this.timer = 0.45 + Math.random() * 0.3;
            events.emit('enemyAlerted', { enemy: this });
          }
        }
        if (this.timer <= 0) { this.timer = 2 + Math.random() * 3; this.wander = !d.boss && Math.random() < 0.5 ? Math.random() * Math.PI * 2 : null; }
        if (this.wander != null) {
          const far = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) >= 2.5;
          targetYaw = far ? Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z) : this.wander;
          moveSpeed = d.speed * 0.25;
        }
      } else {
        targetYaw = faceYaw;
        if (this.timer <= 0) this.state = 'chase';
      }
    } else if (this.brain) {
      const r = this.brain.update(dt, ctx, dist, faceYaw, dy);
      moveSpeed = r.moveSpeed; targetYaw = r.targetYaw;
      if (!this.brain.atk && moveSpeed > 0) {
        const wp = this.navTo(dt, player.pos.x, player.pos.z, player.pos.y);
        if (wp) targetYaw = Math.atan2(wp.x - this.pos.x, wp.z - this.pos.z);
      }
    } else {
      switch (this.state) {
        case 'chase': {
          if (player.dead) { this.state = 'idle'; break; }
          const canSee = dist < 15 && Math.abs(dy) < 1.4 && this._canSee(player, collision);
          // ranged: keep distance and shoot when there is a line of fire
          if (d.ranged && canSee && dist < d.ranged.range) {
            targetYaw = faceYaw;
            this.rangedCd -= dt;
            if (dist < d.ranged.keep) { targetYaw = faceYaw + Math.PI; moveSpeed = d.speed * 0.8; }
            if (dist < d.range) { this.state = 'windup'; this.timer = d.windup; this.shooting = false; }
            else if (this.rangedCd <= 0) { this.state = 'windup'; this.timer = d.ranged.windup || d.windup; this.shooting = true; }
            break;
          }
          if (dist < d.range * this.sizeMul && Math.abs(dy) < 1.2) { this.state = 'windup'; this.timer = d.windup; this.shooting = false; break; }
          const wp = this.navTo(dt, player.pos.x, player.pos.z, player.pos.y);
          if (wp) { targetYaw = Math.atan2(wp.x - this.pos.x, wp.z - this.pos.z); moveSpeed = d.speed; }
          // give up when unreachable or the player is far away: walk back home
          if (!wp || dist > d.giveUp) { this.lostTimer += dt; if (this.lostTimer > (wp ? 4 : 2.5)) { this.state = 'return'; this.lostTimer = 0; this.path = null; } }
          else this.lostTimer = 0;
          break;
        }
        case 'return': {
          const hd = Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z);
          if (hd < 1.2) { this.state = 'idle'; this.timer = 1; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25); break; }
          const wp = this.navTo(dt, this.home.x, this.home.z, this.home.y);
          if (wp) { targetYaw = Math.atan2(wp.x - this.pos.x, wp.z - this.pos.z); moveSpeed = d.speed * 0.7; }
          else { this.state = 'idle'; this.home.copy(this.pos); }
          // re-engage if the player shows up close again
          this.senseTimer -= dt;
          if (this.senseTimer <= 0) { this.senseTimer = 0.4; if (dist < d.notice * 0.7 && Math.abs(dy) < 2 && this._canSee(player, collision)) this.state = 'chase'; }
          break;
        }
        case 'windup':
          targetYaw = faceYaw;
          if (this.timer <= 0) { this.state = 'strike'; this.timer = d.strike; this._struck = false; }
          break;
        case 'strike':
          if (!this._struck && this.timer <= d.strike * 0.5) {
            this._struck = true;
            if (this.shooting) this._shoot(ctx);
            else {
              let ang = faceYaw - this.yaw; ang = Math.atan2(Math.sin(ang), Math.cos(ang));
              if (dist < d.reach * this.sizeMul + 0.3 && Math.abs(ang) < 1.2 && Math.abs(dy) < 1.4) this.hitPlayer(player, d.damage);
              const l = d.lunge ?? 2.5;
              this.vel.x += Math.sin(this.yaw) * l; this.vel.z += Math.cos(this.yaw) * l;
            }
          }
          if (this.timer <= 0) { this.state = 'recover'; this.timer = this.shooting ? 0.35 : d.recover; }
          break;
        case 'recover':
          targetYaw = faceYaw;
          if (this.timer <= 0) this.state = 'chase';
          break;
        case 'stagger':
          if (this.timer <= 0) this.state = 'chase';
          break;
      }
    }

    if (this.chillT > 0) moveSpeed *= 1 - this.chillPct / 100;
    // stuck detection: barely moved for ~1s while trying to walk -> sidestep + repath
    if (moveSpeed > 0.5 && (this.state === 'chase' || this.state === 'return' || this.brain)) {
      this.stuckT = (this.stuckT || 0) + dt;
      if (this.stuckT >= 1) {
        const moved = this.stuckPos ? Math.hypot(this.pos.x - this.stuckPos.x, this.pos.z - this.stuckPos.z) : 9;
        if (moved < 0.35) { this.path = null; this.repathT = 0; this.sidestep = { t: 0.6, dir: Math.random() < 0.5 ? -1 : 1 }; }
        this.stuckPos = { x: this.pos.x, z: this.pos.z }; this.stuckT = 0;
      }
    } else this.stuckT = 0;
    if (this.sidestep && this.sidestep.t > 0) { this.sidestep.t -= dt; targetYaw += this.sidestep.dir * Math.PI / 2; this.yaw = targetYaw; }
    let diff = targetYaw - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turnRate = this.state === 'windup' ? d.turn * 0.5 : d.turn;
    this.yaw += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    if (Math.abs(diff) > 1.2 && !this.brain) moveSpeed *= 0.3;
    if (this.brain && this.brain.leaping) { this.group.rotation.y = this.yaw; this._animate(dt, 0); return; }
    this.move(dt, moveSpeed, ctx);
    this._animate(dt, moveSpeed);
  }

  /**
   * Next point to walk toward (x,z) using the area's nav grid. Walks straight
   * when the grid says the line is clear; otherwise follows an A* path that is
   * recomputed every ~0.6-1.1s (or when the goal moves). null = unreachable.
   */
  navTo(dt, tx, tz, ty) {
    const nav = this.area.getNav && this.area.getNav();
    if (!nav) return { x: tx, z: tz };
    const mk = nav.idx(this.pos.x, this.pos.z), tk = nav.idx(tx, tz);
    if (nav.walkable(mk) && nav.walkable(tk) && Math.abs(ty - this.pos.y) < 0.6 && Math.hypot(tx - this.pos.x, tz - this.pos.z) < 14 && nav.lineClear(mk, tk)) {
      this.path = null;
      return { x: tx, z: tz };
    }
    this.repathT = (this.repathT ?? 0) - dt;
    const moved = !this.navGoal || Math.hypot(tx - this.navGoal.x, tz - this.navGoal.z) > 1.5;
    if (!this.path || this.repathT <= 0 || moved) {
      if (Enemy.pathBudget <= 0) { this.repathT = 0.05; if (!this.path) return { x: tx, z: tz }; }
      else {
        Enemy.pathBudget--;
        this.repathT = 0.6 + Math.random() * 0.5;
        this.navGoal = { x: tx, z: tz };
        this.path = nav.findPath(this.pos.x, this.pos.z, this.pos.y, tx, tz, ty);
        this.pathI = 0;
        if (!this.path) return null;
      }
    }
    const P = this.path;
    while (this.pathI < P.length - 1 && Math.hypot(P[this.pathI].x - this.pos.x, P[this.pathI].z - this.pos.z) < 0.7) this.pathI++;
    return P[this.pathI];
  }

  _shoot(ctx) {
    const r = this.def.ranged, player = ctx.player;
    this.rangedCd = r.cooldown * (0.8 + Math.random() * 0.4);
    const from = new THREE.Vector3(this.pos.x, this.pos.y + this.height * 0.7, this.pos.z);
    const to = new THREE.Vector3(player.pos.x, player.eyeY - 0.5, player.pos.z);
    const n = r.count || 1;
    for (let i = 0; i < n; i++) {
      const spread = n > 1 ? (i - (n - 1) / 2) * 0.16 : 0;
      ctx.game.projectiles.fire(from, to, { ...r.projectile, damage: r.damage * this.dmgMul, spread, owner: this });
    }
  }

  /** Move along the facing direction (+ knockback velocity) with collision. */
  move(dt, moveSpeed, { player, collision, enemies }) {
    const vx = Math.sin(this.yaw) * moveSpeed + this.vel.x;
    const vz = Math.cos(this.yaw) * moveSpeed + this.vel.z;
    this.vel.multiplyScalar(Math.max(0, 1 - dt * 7));
    const r = this.radius, cr = Math.min(r, 1.1);
    const steps = Math.max(1, Math.ceil(Math.hypot(vx, vz) * dt / 0.2));
    const p = { x: this.pos.x, z: this.pos.z };
    for (let i = 0; i < steps; i++) {
      p.x += vx * dt / steps; p.z += vz * dt / steps;
      for (const o of enemies) {
        if (o === this || o.dead) continue;
        const ox = p.x - o.pos.x, oz = p.z - o.pos.z, od = Math.hypot(ox, oz), min = cr + Math.min(o.radius, 1.1);
        if (od < min && od > 1e-4) { const k = o.def.boss ? 1 : 0.5; p.x += (ox / od) * (min - od) * k; p.z += (oz / od) * (min - od) * k; }
      }
      const ox = p.x - player.pos.x, oz = p.z - player.pos.z, od = Math.hypot(ox, oz), min = cr + 0.35;
      if (od < min && od > 1e-4 && Math.abs(player.pos.y - this.pos.y) < 1.5 && !player.roll) { p.x += (ox / od) * (min - od); p.z += (oz / od) * (min - od); }
      collision.resolve(p, cr, this.pos.y, Math.min(this.height, 2.2), STEP);
    }
    this.pos.x = p.x; this.pos.z = p.z;
    const g = collision.groundHeight(this.pos.x, this.pos.z, cr * 0.5, this.pos.y, STEP);
    if (g > this.pos.y - STEP && g > -Infinity) { this.pos.y += (g - this.pos.y) * Math.min(1, dt * 20); this.vy = 0; }
    else { this.vy -= 20 * dt; this.pos.y = Math.max(g, this.pos.y + this.vy * dt); }
    this.group.position.copy(this.pos);
    if (this.def.float) this.group.position.y += 0.35 + Math.sin(this.anim * 2) * 0.12;
    this.group.rotation.y = this.yaw;
  }

  _canSee(player, collision) {
    return collision.lineOfSight(this.pos.x, this.pos.y + this.height * 0.85, this.pos.z, player.pos.x, player.eyeY, player.pos.z);
  }

  _animate(dt, speed) {
    const m = this.model, d = this.def, t = this.anim;
    const walk = Math.min(1, Math.abs(speed) / d.speed);
    const b = this.brain;
    const winding = this.state === 'windup' || (b && b.winding);
    const k = winding ? (b ? b.windK : 1 - Math.max(0, this.timer) / d.windup) : 0;
    const striking = this.state === 'strike' || (b && b.striking);
    if (m.kind === 'biped') {
      const ph = t * 7 * (0.4 + walk * 0.6), sw = Math.sin(ph) * walk;
      m.legL.rotation.x = sw * 0.6; m.legR.rotation.x = -sw * 0.6;
      m.hips.position.y = m.hipY + Math.abs(Math.cos(ph)) * 0.04 * walk;
      m.head.rotation.z = Math.sin(t * 1.3) * 0.08;
      let armR = -sw * 0.4, armL = sw * 0.4;
      if (winding) { armR = this.shooting ? -1.4 : -2.6 * k; m.torso.rotation.y = -0.5 * k; if (this.shooting) armL = -1.4; }
      else if (striking) { armR = this.shooting ? -1.2 : 0.9; m.torso.rotation.y = 0.4; }
      else if (this.state === 'recover') { const q = Math.max(0, this.timer) / d.recover; armR = 0.9 * q; m.torso.rotation.y = 0.4 * q; }
      else m.torso.rotation.y *= 0.9;
      const lean = m.lean ?? 0.1;
      if (this.state === 'stagger') m.torso.rotation.x = lean - 0.4; else m.torso.rotation.x += (lean - m.torso.rotation.x) * 0.2;
      m.armR.rotation.x = armR;
      if (!m.fixedLeft) m.armL.rotation.x = armL;
    } else if (m.kind === 'crawler') {
      const ph = t * 11 * (0.4 + walk * 0.6), sw = Math.sin(ph) * walk;
      m.armL.rotation.x = -0.35 + sw * 0.7; m.armR.rotation.x = -0.35 - sw * 0.7;
      m.legL.rotation.x = 0.3 - sw * 0.6; m.legR.rotation.x = 0.3 + sw * 0.6;
      m.hips.position.y = m.hipY + Math.abs(Math.sin(ph)) * 0.05 * walk;
      m.head.rotation.y = Math.sin(t * 2.3) * 0.15;
      if (m.tail) m.tail.rotation.y = Math.sin(t * 5) * 0.4;
      if (winding) { m.torso.rotation.x = -0.4 * k; m.hips.position.y = m.hipY - 0.15 * k; }
      else if (striking) { m.torso.rotation.x = 0.25; m.armL.rotation.x = m.armR.rotation.x = -1.5; }
      else m.torso.rotation.x *= 0.85;
    } else if (m.kind === 'spider') {
      const ph = t * 14 * (0.3 + walk * 0.7);
      m.legs.forEach((leg, i) => { leg.rotation.y = leg.userData.baseY + Math.sin(ph + i * 1.3) * 0.25 * walk; leg.rotation.z = leg.userData.baseZ + Math.max(0, Math.sin(ph + i * 1.3)) * 0.2 * walk; });
      m.body.position.y = m.hipY + Math.sin(ph * 2) * 0.03 * walk - (winding ? 0.15 * k : 0);
      m.body.rotation.x = winding ? -0.3 * k : striking ? 0.25 : 0;
    } else if (m.kind === 'float') {
      m.body.rotation.x = winding ? -0.3 * k : striking ? 0.35 : Math.sin(t * 1.5) * 0.05;
      if (m.armR) m.armR.rotation.x = winding ? -2.2 * k : striking ? 0.6 : -0.3 + Math.sin(t * 2) * 0.1;
      if (m.armL) m.armL.rotation.x = winding ? -2.2 * k : striking ? 0.6 : -0.3 + Math.sin(t * 2 + 1) * 0.1;
      if (m.wings) m.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.4 + Math.sin(t * 18) * 0.5); });
    }
  }

  _updateDeath(dt) {
    this.timer += dt;
    const m = this.model;
    const t = Math.min(1, this.timer / 0.7);
    const low = m.kind !== 'biped';
    this.group.rotation.x = -t * t * (low ? 0.3 : 1.45);
    if (m.hips) m.hips.position.y = m.hipY * (1 - t * 0.6);
    if (m.body && low) m.body.position.y = (m.hipY || 0.5) * (1 - t * 0.7);
    if (this.timer > 0.7 && !this._burst) {
      this._burst = true;
      const s = this.sizeMul;
      this.area.dust.burst(this.pos.x, this.pos.y + 0.4 * s, this.pos.z, Math.round(26 * s), 2.2 * s, 1.6, [0.24, 0.22, 0.2], 0.12 * s, -2, 1.2);
      this.area.glow.burst(this.pos.x, this.pos.y + 0.5 * s, this.pos.z, Math.round(14 * s), 1.8 * s, 1.2, [0.9, 0.45, 0.15], 0.04, 1.5, 1.5);
    }
    if (this.timer > 1.4) this.group.position.y = this.pos.y - (this.timer - 1.4) * 0.6 * this.sizeMul;
    if (this.timer > (this.def.boss ? 4.5 : 3.2)) this.remove = true;
  }

  dispose() {
    this.area.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of Object.values(this.model.mats)) m.dispose();
  }
}

/** A* searches allowed per frame across all enemies (reset by the manager). */
Enemy.pathBudget = 4;
