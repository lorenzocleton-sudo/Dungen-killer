// Generic enemy actor: idle -> alert -> chase -> windup -> strike -> recover,
// with stagger and death. Stats and models come from ENEMY_TYPES.
import * as THREE from '../../lib/three.module.min.js';
import { ENEMY_TYPES } from './enemyTypes.js';
import { events } from '../engine/events.js';

const STEP = 0.45;
const _wp = new THREE.Vector3();
let nextId = 1;

export class Enemy {
  constructor(type, pos, area, opts = {}) {
    this.id = nextId++;
    this.type = type;
    this.def = ENEMY_TYPES[type];
    this.area = area;
    this.model = this.def.build();
    this.group = this.model.root;
    this.pos = pos.clone();
    this.home = pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.level = opts.level || 1;
    this.hpMul = (opts.hpMul || 1) * (1 + (this.level - 1) * 0.3);
    this.dmgMul = (opts.dmgMul || 1) * (1 + (this.level - 1) * 0.18);
    this.hp = Math.round(this.def.hp * this.hpMul);
    this.maxHp = this.hp;
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
    this.group.position.copy(this.pos);
    this.group.rotation.order = 'YXZ';
    area.scene.add(this.group);
  }

  get radius() { return this.def.radius; }
  get alive() { return !this.dead; }

  /** World position of the head (for damage numbers / hit sparks). */
  headPos(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + this.def.height * 0.8, this.pos.z);
  }

  takeHit(amount, fromPos, knock = 1) {
    if (this.dead) return;
    this.hp -= amount;
    this.flash = 0.14;
    this.poiseDmg += amount;
    // knock back
    const dx = this.pos.x - fromPos.x, dz = this.pos.z - fromPos.z, d = Math.hypot(dx, dz) || 1;
    const k = (this.def.heavy ? 0.6 : 2.6) * knock;
    this.vel.x += (dx / d) * k; this.vel.z += (dz / d) * k;
    if (this.state === 'idle' || this.state === 'alert') { this.state = 'chase'; }
    if (this.hp <= 0) { this.die(); return; }
    if (this.poiseDmg >= this.def.poise) {
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

  /** Slow movement + attacks (frost effects). */
  chill(pct, duration) { this.chillPct = Math.max(this.chillT > 0 ? this.chillPct : 0, pct); this.chillT = Math.max(this.chillT || 0, duration); }

  get burning() { return !!(this.dots && this.dots.burn && this.dots.burn.t > 0); }

  _updateBurn(dt) {
    if (this.chillT > 0) this.chillT -= dt;
    if (!this.dots || this.dead) return;
    const col = { burn: [1, 0.45, 0.1], bleed: [0.6, 0.04, 0.02], poison: [0.4, 0.8, 0.2] };
    for (const [kind, d] of Object.entries(this.dots)) {
      if (d.t <= 0) continue;
      d.t -= dt; d.tick -= dt;
      if (Math.random() < dt * 18) {
        const sys = kind === 'burn' ? this.area.glow : this.area.dust;
        sys.emit(this.pos.x + (Math.random() - 0.5) * 0.5, this.pos.y + Math.random() * this.def.height, this.pos.z + (Math.random() - 0.5) * 0.5,
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
    this.dead = true;
    this.state = 'dead';
    this.timer = 0;
    events.emit('enemyKilled', { enemy: this, type: this.type, pos: this.pos.clone() });
  }

  setFlash(v) {
    for (const m of Object.values(this.model.mats)) m.emissive.setRGB(v * 0.32, v * 0.05, v * 0.02);
  }

  update(dt, ctx) {
    const { player, collision, enemies } = ctx;
    const d = this.def;
    this.anim += dt;
    if (this.flash > 0) { this.flash -= dt; this.setFlash(Math.max(0, this.flash) / 0.14); }
    this.poiseDmg = Math.max(0, this.poiseDmg - dt * 8);

    this._updateBurn(dt);
    if (this.dead) { this._updateDeath(dt); return; }

    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const dy = player.pos.y - this.pos.y;
    const faceYaw = Math.atan2(dx, dz);
    let moveSpeed = 0, targetYaw = this.yaw;

    this.timer -= dt;
    switch (this.state) {
      case 'idle': {
        this.senseTimer -= dt;
        if (this.senseTimer <= 0 && !player.dead) {
          this.senseTimer = 0.25;
          if (dist < d.notice && Math.abs(dy) < 3 && this._canSee(player, collision)) {
            this.state = 'alert'; this.timer = 0.45 + Math.random() * 0.3;
            events.emit('enemyAlerted', { enemy: this });
          }
        }
        // shuffle around home
        if (this.timer <= 0) { this.timer = 2 + Math.random() * 3; this.wander = Math.random() < 0.5 ? Math.random() * Math.PI * 2 : null; }
        if (this.wander != null && Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) < 2.5) { targetYaw = this.wander; moveSpeed = d.speed * 0.25; }
        else if (this.wander != null) { targetYaw = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z); moveSpeed = d.speed * 0.25; }
        break;
      }
      case 'alert':
        targetYaw = faceYaw;
        if (this.timer <= 0) this.state = 'chase';
        break;
      case 'chase': {
        if (player.dead) { this.state = 'idle'; break; }
        if (dist < d.range && Math.abs(dy) < 1.2) { this.state = 'windup'; this.timer = d.windup; break; }
        // direct line if visible & on same level, else follow the dungeon flow field
        let tx = player.pos.x, tz = player.pos.z;
        const direct = Math.abs(dy) < 0.8 && dist < 6 && this._canSee(player, collision);
        if (!direct && this.area.stepToward) {
          const wp = this.area.stepToward(this.pos, _wp);
          if (wp) { tx = wp.x; tz = wp.z; }
        }
        targetYaw = Math.atan2(tx - this.pos.x, tz - this.pos.z);
        moveSpeed = d.speed;
        // lose interest when far away for a while
        if (dist > d.giveUp) { this.lostTimer += dt; if (this.lostTimer > 4) { this.state = 'idle'; this.lostTimer = 0; } }
        else this.lostTimer = 0;
        break;
      }
      case 'windup':
        targetYaw = faceYaw;
        if (this.timer <= 0) { this.state = 'strike'; this.timer = d.strike; this._struck = false; }
        break;
      case 'strike':
        if (!this._struck && this.timer <= d.strike * 0.5) {
          this._struck = true;
          let ang = faceYaw - this.yaw; ang = Math.atan2(Math.sin(ang), Math.cos(ang));
          if (dist < d.reach + 0.3 && Math.abs(ang) < 1.2 && Math.abs(dy) < 1.4) {
            player.damage(Math.round(d.damage * this.dmgMul * (0.85 + Math.random() * 0.3)), this.pos, this);
          }
          // lunge
          this.vel.x += Math.sin(this.yaw) * 2.5; this.vel.z += Math.cos(this.yaw) * 2.5;
        }
        if (this.timer <= 0) { this.state = 'recover'; this.timer = d.recover; }
        break;
      case 'recover':
        targetYaw = faceYaw;
        if (this.timer <= 0) this.state = 'chase';
        break;
      case 'stagger':
        if (this.timer <= 0) this.state = 'chase';
        break;
    }

    if (this.chillT > 0) moveSpeed *= 1 - this.chillPct / 100;
    // turn
    let diff = targetYaw - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turnRate = this.state === 'windup' ? d.turn * 0.5 : d.turn;
    this.yaw += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    // only walk forward roughly in the facing direction
    if (Math.abs(diff) > 1.2) moveSpeed *= 0.3;

    // movement + knockback velocity
    const vx = Math.sin(this.yaw) * moveSpeed + this.vel.x;
    const vz = Math.cos(this.yaw) * moveSpeed + this.vel.z;
    this.vel.multiplyScalar(Math.max(0, 1 - dt * 7));
    const p = { x: this.pos.x + vx * dt, z: this.pos.z + vz * dt };
    // separation from other enemies
    for (const o of enemies) {
      if (o === this || o.dead) continue;
      const ox = p.x - o.pos.x, oz = p.z - o.pos.z, od = Math.hypot(ox, oz), min = this.radius + o.radius;
      if (od < min && od > 1e-4) { p.x += (ox / od) * (min - od) * 0.5; p.z += (oz / od) * (min - od) * 0.5; }
    }
    // don't walk into the player
    { const ox = p.x - player.pos.x, oz = p.z - player.pos.z, od = Math.hypot(ox, oz), min = this.radius + 0.35;
      if (od < min && od > 1e-4 && Math.abs(dy) < 1.5) { p.x += (ox / od) * (min - od); p.z += (oz / od) * (min - od); } }
    collision.resolve(p, this.radius, this.pos.y, d.height, STEP);
    this.pos.x = p.x; this.pos.z = p.z;
    const g = collision.groundHeight(this.pos.x, this.pos.z, this.radius * 0.5, this.pos.y, STEP);
    if (g > this.pos.y - STEP && g > -Infinity) { this.pos.y += (g - this.pos.y) * Math.min(1, dt * 20); this.vy = 0; }
    else { this.vy -= 20 * dt; this.pos.y = Math.max(g, this.pos.y + this.vy * dt); }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this._animate(dt, moveSpeed);
  }

  _canSee(player, collision) {
    return collision.lineOfSight(this.pos.x, this.pos.y + this.model.eyeH, this.pos.z, player.pos.x, player.eyeY, player.pos.z);
  }

  _animate(dt, speed) {
    const m = this.model, d = this.def, t = this.anim;
    const walk = Math.min(1, speed / d.speed);
    const ph = t * (m.kind === 'crawler' ? 11 : 7) * (0.4 + walk * 0.6);
    const sw = Math.sin(ph) * walk;
    if (m.kind === 'biped') {
      m.legL.rotation.x = sw * 0.6; m.legR.rotation.x = -sw * 0.6;
      m.hips.position.y = 0.95 + Math.abs(Math.cos(ph)) * 0.04 * walk;
      m.head.rotation.z = Math.sin(t * 1.3) * 0.08;
      let armR = -sw * 0.4, armL = sw * 0.4;
      if (this.state === 'windup') { const k = 1 - Math.max(0, this.timer) / d.windup; armR = -2.6 * k; m.torso.rotation.y = -0.5 * k; }
      else if (this.state === 'strike') { armR = 0.9; m.torso.rotation.y = 0.4; }
      else if (this.state === 'recover') { const k = Math.max(0, this.timer) / d.recover; armR = 0.9 * k; m.torso.rotation.y = 0.4 * k; }
      else m.torso.rotation.y *= 0.9;
      if (this.state === 'stagger') { m.torso.rotation.x = (m.heavy ? 0.08 : 0.25) - 0.4; } else m.torso.rotation.x += ((m.heavy ? 0.08 : 0.25) - m.torso.rotation.x) * 0.2;
      m.armR.rotation.x = armR;
      if (!m.heavy) m.armL.rotation.x = armL;
      if (this.state === 'idle' && speed === 0) { m.armR.rotation.x = Math.sin(t * 1.1) * 0.05; }
    } else {
      // crawler: alternating limbs, head bob, pounce
      m.armL.rotation.x = -0.35 + sw * 0.7; m.armR.rotation.x = -0.35 - sw * 0.7;
      m.legL.rotation.x = 0.3 - sw * 0.6; m.legR.rotation.x = 0.3 + sw * 0.6;
      m.hips.position.y = 0.55 + Math.abs(Math.sin(ph)) * 0.05 * walk;
      m.head.rotation.y = Math.sin(t * 2.3) * 0.15;
      if (this.state === 'windup') { const k = 1 - Math.max(0, this.timer) / d.windup; m.torso.rotation.x = -0.4 * k; m.hips.position.y = 0.55 - 0.15 * k; }
      else if (this.state === 'strike') { m.torso.rotation.x = 0.25; m.armL.rotation.x = m.armR.rotation.x = -1.5; }
      else m.torso.rotation.x *= 0.85;
    }
  }

  _updateDeath(dt) {
    this.timer += dt;
    const m = this.model;
    const t = Math.min(1, this.timer / 0.7);
    // collapse: tip backwards and crumple
    this.group.rotation.x = -t * t * (m.kind === 'crawler' ? 0.3 : 1.45);
    m.hips.position.y = (m.kind === 'crawler' ? 0.55 : 0.95) * (1 - t * 0.6);
    if (this.timer > 0.7 && !this._burst) {
      this._burst = true;
      const h = this.headPos();
      this.area.dust.burst(this.pos.x, this.pos.y + 0.4, this.pos.z, 26, 2.2, 1.6, [0.24, 0.22, 0.2], 0.12, -2, 1.2);
      this.area.glow.burst(h.x, this.pos.y + 0.5, h.z, 14, 1.8, 1.2, [0.9, 0.45, 0.15], 0.04, 1.5, 1.5);
    }
    if (this.timer > 1.4) this.group.position.y = this.pos.y - (this.timer - 1.4) * 0.6; // sink into the floor
    if (this.timer > 3.2) { this.remove = true; }
  }

  dispose() {
    this.area.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of Object.values(this.model.mats)) m.dispose();
  }
}
