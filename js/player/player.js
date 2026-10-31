// First-person player controller: movement, collision, camera, HP.
import * as THREE from '../../lib/three.module.min.js';
import { CONFIG } from '../config.js';
import { events } from '../engine/events.js';

const P = CONFIG.player;

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.vy = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.eyeY = 0;              // smoothed eye height (for stairs)
    this.bob = 0;
    this.maxHp = P.maxHp;
    this.hp = this.maxHp;
    this.dead = false;
    this.grounded = true;
    this.speedMul = 1;
    this.shake = 0;
    this.velocity = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.invuln = 0;
    this.stats = null;          // derived stats (see systems/stats.js)
    this.sprinting = false;
    this.healOverTime = 0;
    this.maxStamina = 100;
    this.stamina = 100;
    this.staminaDelay = 0;
    this.exhausted = false;
    this.roll = null;           // active dodge roll { t, dur, vx, vz }
  }

  /** Spend stamina; false (and nothing spent) when too tired. */
  useStamina(n) {
    if (this.stamina <= 1 || this.exhausted) return false;
    this.stamina = Math.max(0, this.stamina - n);
    this.staminaDelay = 0.7;
    return true;
  }

  /** Dodge roll in the move direction (backwards when standing still). */
  startRoll(mx, my) {
    if (this.roll || this.dead || !this.grounded) return false;
    const st = this.stats || {};
    if (!this.useStamina(25 * (1 - (st.rollCostPct || 0) / 100))) return false;
    if (Math.hypot(mx, my) < 0.2) { mx = 0; my = -1; }
    const m = Math.hypot(mx, my); mx /= m; my /= m;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const spd = 10.5 * (1 + (st.rollDistPct || 0) / 100);
    this.roll = { t: 0, dur: 0.38, vx: (mx * cos - my * sin) * spd, vz: (-mx * sin - my * cos) * spd, side: mx };
    this.invuln = Math.max(this.invuln, 0.3 + (st.rollIframes || 0));
    return true;
  }

  applyStats(s) {
    const ratio = this.maxHp ? this.hp / this.maxHp : 1;
    this.stats = s;
    this.maxHp = s.maxHp;
    this.maxStamina = s.maxStamina;
    this.stamina = Math.min(this.stamina, this.maxStamina);
    this.hp = Math.min(this.maxHp, Math.max(1, Math.round(ratio * this.maxHp)));
  }

  place(x, y, z, yaw = 0) {
    this.pos.set(x, y, z);
    this.vy = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.eyeY = y + P.eyeHeight;
    this.velocity.set(0, 0, 0);
  }

  damage(amount, sourcePos, source) {
    if (this.dead || this.invuln > 0 || this.god) return 0;
    if (this.stats) amount = Math.max(1, Math.round(amount * (1 - this.stats.defense / 100)));
    this.hp = Math.max(0, this.hp - amount);
    this.shake = Math.min(1, this.shake + 0.5 + amount / 40);
    events.emit('playerDamaged', { amount, hp: this.hp, sourcePos, source });
    if (this.hp <= 0 && this.cheatDeath && this.cheatDeath()) { this.hp = 1; this.invuln = 2; }
    if (this.hp <= 0) { this.dead = true; events.emit('playerDied', {}); }
    return amount;
  }

  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }

  update(dt, input, world) {
    const look = this.dead ? { x: 0, y: 0 } : input.look;
    this.yaw -= look.x;
    this.pitch = Math.max(-CONFIG.look.pitchLimit, Math.min(CONFIG.look.pitchLimit, this.pitch - look.y));
    if (this.invuln > 0) this.invuln -= dt;
    if (!this.dead && this.stats) {
      if (this.stats.regen) this.heal(this.stats.regen * dt);
      if (this.healOverTime > 0) { const h = Math.min(this.healOverTime, dt * 60); this.heal(h); this.healOverTime -= h; }
    }

    // desired horizontal velocity, camera-relative
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const mx = this.dead ? 0 : input.move.x, my = this.dead ? 0 : input.move.y;
    const st = this.stats || { speedPct: 0, sprintPct: 0, staminaRegenPct: 0 };
    if (input.consume && input.consume('roll') && !this.dead) this.startRoll(mx, my);
    // stamina: sprinting drains, regenerates after a short pause
    const wantSprint = !!input.sprint && (Math.abs(mx) + Math.abs(my) > 0.1) && !this.roll;
    this.sprinting = wantSprint && !this.exhausted && this.stamina > 0;
    if (this.sprinting) { this.stamina = Math.max(0, this.stamina - 20 * dt); this.staminaDelay = 0.5; if (this.stamina <= 0) this.exhausted = true; }
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else this.stamina = Math.min(this.maxStamina, this.stamina + 34 * (1 + (st.staminaRegenPct || 0) / 100) * dt);
    if (this.exhausted && this.stamina > this.maxStamina * 0.3) this.exhausted = false;
    const speed = P.speed * this.speedMul * (1 + st.speedPct / 100) * (this.sprinting ? 2 * (1 + st.sprintPct / 100) : 1);
    const slow = this.slowT > 0 ? 0.55 : 1;
    if (this.slowT > 0) this.slowT -= dt;
    const tx = (mx * cos - my * sin) * speed * slow;
    const tz = (-mx * sin - my * cos) * speed * slow;
    const acc = this.grounded ? 14 : 4;
    const k = Math.min(1, acc * dt);
    this.velocity.x += (tx - this.velocity.x) * k;
    this.velocity.z += (tz - this.velocity.z) * k;
    if (this.roll) {
      this.roll.t += dt;
      const e = 1 - Math.pow(this.roll.t / this.roll.dur, 2) * 0.6;
      this.velocity.x = this.roll.vx * e; this.velocity.z = this.roll.vz * e;
      if (this.roll.t >= this.roll.dur) this.roll = null;
    }

    if (this.noclip) {
      // debug fly: move along the view direction, no collision, no gravity
      const cp = Math.cos(this.pitch), spd = speed * 1.5;
      this.pos.x += (-sin * cp * my + cos * mx) * spd * dt;
      this.pos.z += (-cos * cp * my - sin * mx) * spd * dt;
      this.pos.y += (Math.sin(this.pitch) * my + (input.flyUp ? 1 : 0)) * spd * dt;
      this.velocity.set(0, 0, 0); this.vy = 0; this.grounded = true;
      this.eyeY = this.pos.y + P.eyeHeight;
      this.camera.position.set(this.pos.x, this.eyeY, this.pos.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.forward.set(-sin, 0, -cos);
      return;
    }
    // sub-step fast movement so sprinting can't tunnel through thin walls
    const dist = Math.hypot(this.velocity.x, this.velocity.z) * dt;
    const n = Math.max(1, Math.ceil(dist / 0.15));
    const p = { x: this.pos.x, z: this.pos.z };
    for (let i = 0; i < n; i++) {
      p.x += this.velocity.x * dt / n; p.z += this.velocity.z * dt / n;
      world.resolve(p, P.radius, this.pos.y, P.height, P.step);
    }
    this.pos.x = p.x; this.pos.z = p.z;

    // ground / stairs / gravity
    const g = world.groundHeight(this.pos.x, this.pos.z, P.radius * 0.55, this.pos.y, P.step);
    if (g > this.pos.y - 0.001) { this.pos.y = g; this.vy = 0; this.grounded = true; }
    else if (this.grounded && g > this.pos.y - P.step && this.vy <= 0) { this.pos.y = g; this.vy = 0; } // stick to stairs going down
    else {
      this.grounded = false;
      this.vy -= P.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= g) { this.pos.y = g; this.vy = 0; this.grounded = true; }
    }
    if (this.pos.y < -60) events.emit('playerFellOut', {});

    // camera
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    this.bob += dt * hs * 2.1;
    const bobAmt = Math.min(1.4, hs / P.speed) * 0.045;
    const rollDip = this.roll ? Math.sin(Math.PI * this.roll.t / this.roll.dur) * 0.75 : 0;
    const targetEye = this.pos.y + (this.dead ? 0.35 : P.eyeHeight) - rollDip;
    this.eyeY += (targetEye - this.eyeY) * Math.min(1, dt * (this.dead ? 3 : this.roll ? 30 : 14));
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake * 0.08;
    this.camera.position.set(
      this.pos.x + (Math.random() - 0.5) * sh,
      this.eyeY + Math.sin(this.bob * 2) * bobAmt + (Math.random() - 0.5) * sh,
      this.pos.z + (Math.random() - 0.5) * sh);
    this.camera.rotation.set(this.pitch - rollDip * 0.25, this.yaw, this.dead ? 0.5 : Math.sin(this.bob) * bobAmt * 0.3 - (this.roll ? this.roll.side * rollDip * 0.3 : 0), 'YXZ');
    this.forward.set(-sin, 0, -cos);
    this.moving = hs > 0.5;
  }
}
