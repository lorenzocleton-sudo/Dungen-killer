// First-person player controller (Doom-style): fast run with instant
// acceleration (moving costs no stamina), jump with full air control and
// Quake-style strafe-jumping, ledge mantling, fall damage only from big drops,
// and a recharging DASH (any direction, i-frames, works in the air).
// Unlockable (via stats from skills/gear): double jump, extra dash charges,
// ground slam.
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
    this.tilt = 0;              // strafe camera roll
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
    this.sprinting = false;     // kept for UI compatibility (always running now)
    this.healOverTime = 0;
    this.maxStamina = 100;
    this.stamina = 100;
    this.staminaDelay = 0;
    this.exhausted = false;
    this.roll = null;           // active dash (named roll so dodge-based skills keep working)
    this.dashCharges = 2;
    this.dashCd = 0;
    this.jumpsLeft = 0;
    this.peakY = 0;
    this.mantle = null;
    this.slamming = false;
    this.headBob = true;
    this.maxMana = 100; this.mana = 100;
  }

  get maxDashes() { return 2 + ((this.stats && this.stats.dashCharges) || 0) + (this.infDash ? 99 : 0); }
  get maxJumps() { return 1 + ((this.stats && this.stats.doubleJump) ? 1 : 0) + (this.infJump ? 99 : 0); }

  /** Spend stamina; false (and nothing spent) when too tired. */
  useStamina(n) {
    if (this.infStamina) return true;
    if (this.stamina <= 1 || this.exhausted) return false;
    this.stamina = Math.max(0, this.stamina - n);
    this.staminaDelay = 0.7;
    if (this.stamina <= 0) this.exhausted = true;
    return true;
  }

  useMana(n) {
    if (this.infStamina) return true;
    if (this.mana < n) return false;
    this.mana -= n;
    return true;
  }

  /** Dash in the move direction (forward when standing still). Works in the air. */
  startDash(mx, my) {
    if (this.roll || this.dead || this.mantle) return false;
    if (this.dashCharges < 1) return false;
    this.dashCharges--;
    const st = this.stats || {};
    if (Math.hypot(mx, my) < 0.2) { mx = 0; my = 1; }
    const m = Math.hypot(mx, my); mx /= m; my /= m;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const spd = P.dashSpeed * (1 + (st.rollDistPct || 0) / 100);
    this.roll = { t: 0, dur: P.dashTime, vx: (mx * cos - my * sin) * spd, vz: (-mx * sin - my * cos) * spd, side: mx, dash: true };
    this.invuln = Math.max(this.invuln, P.dashIframes + (st.rollIframes || 0));
    this.phasing = true;        // slip past small/medium enemies while dashing
    if (!this.grounded) this.vy = Math.max(this.vy, 0);
    events.emit('playerDash', { air: !this.grounded });
    return true;
  }
  // old name used by a few callers
  startRoll(mx, my) { return this.startDash(mx, my); }

  jump() {
    if (this.dead || this.mantle) return false;
    if (this.grounded) this.jumpsLeft = this.maxJumps;
    if (this.jumpsLeft <= 0) return false;
    const first = this.grounded || this.coyote > 0;
    if (!first && this.jumpsLeft === this.maxJumps) this.jumpsLeft--; // walked off a ledge: the first jump is spent
    if (this.jumpsLeft <= 0) return false;
    this.jumpsLeft--;
    this.vy = P.jump * (1 + ((this.stats && this.stats.jumpPct) || 0) / 100) * (first ? 1 : 0.92);
    this.grounded = false; this.coyote = 0;
    this.peakY = this.pos.y;
    events.emit('playerJump', { double: !first });
    return true;
  }

  /** Ground slam: plunge from the air, shockwave on landing (needs the unlock). */
  startSlam() {
    if (this.grounded || this.slamming || this.dead || !(this.stats && this.stats.groundSlam)) return false;
    this.slamming = true; this.vy = -32; this.roll = null;
    return true;
  }

  applyStats(s) {
    const ratio = this.maxHp ? this.hp / this.maxHp : 1;
    this.stats = s;
    this.maxHp = s.maxHp;
    this.maxStamina = s.maxStamina;
    this.maxMana = s.maxMana || 100;
    this.stamina = Math.min(this.stamina, this.maxStamina);
    this.mana = Math.min(this.mana, this.maxMana);
    this.dashCharges = Math.min(this.dashCharges, this.maxDashes);
    this.hp = Math.min(this.maxHp, Math.max(1, Math.round(ratio * this.maxHp)));
  }

  place(x, y, z, yaw = 0) {
    this.pos.set(x, y, z);
    this.vy = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.eyeY = y + P.eyeHeight;
    this.velocity.set(0, 0, 0);
    this.peakY = y; this.mantle = null; this.slamming = false; this.roll = null;
  }

  damage(amount, sourcePos, source) {
    if (this.dead || this.invuln > 0 || this.god) return 0;
    if (this.stats) amount = Math.max(1, Math.round(amount * (1 - this.stats.defense / 100) * (1 + (this.stats.dmgTakenPct || 0) / 100)));
    // blocking: frontal hits are reduced, stamina pays for it (empty stamina = guard break)
    if (this.blocking && sourcePos && source !== 'fall' && source !== 'trap') {
      const ang = Math.atan2(sourcePos.x - this.pos.x, sourcePos.z - this.pos.z);
      let d = ang - Math.atan2(this.forward.x, this.forward.z); d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 1.3) {
        const st = this.stats || {};
        const red = Math.min(0.92, (st.shieldBlock ? 0.85 : 0.6) + (st.blockPct || 0) / 100);
        const cost = amount * 0.5;
        if (this.stamina >= cost * 0.3) {
          this.stamina = Math.max(0, this.stamina - cost); this.staminaDelay = 0.6;
          amount = Math.max(0, Math.round(amount * (1 - red)));
          events.emit('playerBlocked', { source, sourcePos });
          if (this.stamina <= 0) { this.exhausted = true; this.blocking = false; events.emit('guardBreak', {}); }
          if (!amount) return 0;
        }
      }
    }
    if (this.absorb > 0) { const a = Math.min(this.absorb, amount); this.absorb -= a; amount -= a; if (amount <= 0) return 0; }
    this.hp = Math.max(0, this.hp - amount);
    this.shake = Math.min(1, this.shake + 0.5 + amount / 40);
    events.emit('playerDamaged', { amount, hp: this.hp, sourcePos, source });
    if (this.hp <= 0 && this.cheatDeath && this.cheatDeath()) { this.hp = 1; this.invuln = 2; }
    if (this.hp <= 0) { this.dead = true; events.emit('playerDied', {}); }
    return amount;
  }

  /** Damage over time on the player (burning, poison). */
  addDot(dps, duration, kind = 'burn') {
    if (kind === 'poison' && this.poisonImmune > 0) return;
    const st = this.stats || {};
    const res = kind === 'burn' ? st.resFire : kind === 'poison' ? st.resPoison : 0;
    if (res >= 100) return;
    dps *= 1 - (res || 0) / 100;
    this.dot = { dps: Math.max(this.dot && this.dot.t > 0 ? this.dot.dps : 0, dps), t: Math.max(this.dot ? this.dot.t : 0, duration), tick: 0.5, kind };
  }

  heal(amount) {
    if (this.noHeal) return;
    const st = this.stats || {};
    amount *= 1 + (st.healPct || 0) / 100;
    const over = this.hp + amount - this.maxHp;
    if (over > 0 && st.overhealShield) this.absorb = Math.min(this.maxHp * 0.3, (this.absorb || 0) + over);
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** Is there room for the player's body standing at (x, y, z)? */
  _roomAt(world, x, z, y) {
    const r = P.radius * 0.9;
    const list = world.query(x - r, z - r, x + r, z + r, this._q || (this._q = []));
    for (const b of list) {
      if (b.disabled || b.maxY <= y + 0.05 || b.minY >= y + P.height) continue;
      if (x + r < b.minX || x - r > b.maxX || z + r < b.minZ || z - r > b.maxZ) continue;
      return false;
    }
    return true;
  }

  update(dt, input, world) {
    const look = this.dead ? { x: 0, y: 0 } : input.look;
    this.yaw -= look.x;
    this.pitch = Math.max(-CONFIG.look.pitchLimit, Math.min(CONFIG.look.pitchLimit, this.pitch - look.y));
    if (this.invuln > 0) this.invuln -= dt;
    if (this.poisonImmune > 0) this.poisonImmune -= dt;
    if (this.dot && this.dot.t > 0 && !this.dead) {
      this.dot.t -= dt; this.dot.tick -= dt;
      if (this.dot.tick <= 0) { this.dot.tick = 0.5; const inv = this.invuln; this.invuln = 0; this.damage(Math.max(1, Math.round(this.dot.dps * 0.5))); this.invuln = inv; this.shake *= 0.5; }
    }
    const st = this.stats || { speedPct: 0, staminaRegenPct: 0 };
    if (!this.dead && this.stats) {
      if (this.stats.regen) this.heal(this.stats.regen * dt);
      if (this.healOverTime > 0) { const h = Math.min(this.healOverTime, dt * 60); this.heal(h); this.healOverTime -= h; }
    }

    // stamina (attacks / block / skills only) and mana regenerate; moving is free
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else this.stamina = Math.min(this.maxStamina, this.stamina + 38 * (1 + (st.staminaRegenPct || 0) / 100) * dt);
    if (this.exhausted && this.stamina > this.maxStamina * 0.3) this.exhausted = false;
    this.mana = Math.min(this.maxMana, this.mana + (6 + (st.manaRegen || 0)) * dt);
    // dash charges recharge one at a time
    if (this.dashCharges < this.maxDashes) {
      this.dashCd += dt * (1 + (st.dashRechargePct || 0) / 100);
      if (this.dashCd >= P.dashRecharge) { this.dashCd = 0; this.dashCharges++; }
    } else this.dashCd = 0;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const mx = this.dead ? 0 : input.move.x, my = this.dead ? 0 : input.move.y;
    if (input.consume) {
      if (input.consume('slam') && !this.dead) this.startSlam();
      if (input.consume('roll') && !this.dead) {
        // dash; looking straight down in the air with the unlock = ground slam
        if (!this.grounded && this.pitch < -0.75 && this.stats && this.stats.groundSlam) this.startSlam();
        else this.startDash(mx, my);
      }
      if (input.consume('jump') && !this.dead) this.jump();
    }

    if (this.noclip) {
      // debug fly: move along the view direction, no collision, no gravity
      const cp = Math.cos(this.pitch), spd = P.speed * this.speedMul * 1.2;
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

    // ---------------------------------------------------------- mantle (pulling up onto a ledge)
    if (this.mantle) {
      const m = this.mantle;
      m.t += dt;
      const k = Math.min(1, m.t / m.dur);
      this.pos.y = m.y0 + (m.y1 - m.y0) * Math.min(1, k * 1.6);
      if (k > 0.5) { this.pos.x = m.x0 + (m.x1 - m.x0) * (k - 0.5) * 2; this.pos.z = m.z0 + (m.z1 - m.z0) * (k - 0.5) * 2; }
      this.velocity.set(0, 0, 0); this.vy = 0;
      if (k >= 1) { this.mantle = null; this.grounded = true; this.peakY = this.pos.y; }
      this._camera(dt);
      return;
    }

    // ---------------------------------------------------------- horizontal movement
    const speed = P.speed * this.speedMul * (1 + (st.speedPct || 0) / 100);
    const slow = (this.slowT > 0 ? 0.55 : 1) * (this.terrainMul || 1) * (this.blocking ? 0.55 : 1);
    if (this.slowT > 0) this.slowT -= dt * (1 + ((st.resFrost || 0) / 40));
    const wx = (mx * cos - my * sin), wz = (-mx * sin - my * cos);
    const wl = Math.hypot(wx, wz);
    const wishSpeed = speed * slow * Math.min(1, wl);
    const dx = wl > 0.01 ? wx / wl : 0, dz = wl > 0.01 ? wz / wl : 0;
    const v = this.velocity;
    if (this.roll) {
      this.roll.t += dt;
      const e = 1 - Math.pow(this.roll.t / this.roll.dur, 2) * 0.5;
      v.x = this.roll.vx * e; v.z = this.roll.vz * e;
      if (!this.grounded) this.vy = Math.max(this.vy, -1);   // air dash hangs for a moment
      if (this.roll.t >= this.roll.dur) {
        // leave the dash with run speed (keeps the motion snappy)
        const hs = Math.hypot(v.x, v.z) || 1, keep = Math.max(speed, Math.min(hs, speed * 1.25));
        v.x = v.x / hs * keep; v.z = v.z / hs * keep;
        this.roll = null; this.phasing = false;
      }
    } else if (this.grounded) {
      // instant acceleration; a short skid only when landing faster than running (bunny hops keep it)
      const hs = Math.hypot(v.x, v.z);
      if (hs > speed * 1.05 && this.landT < 0.12) {
        const k = Math.min(1, dt * 6);
        v.x += (dx * Math.max(wishSpeed, hs * 0.9) - v.x) * k; v.z += (dz * Math.max(wishSpeed, hs * 0.9) - v.z) * k;
      } else { v.x = dx * wishSpeed; v.z = dz * wishSpeed; }
    } else if (wl > 0.01) {
      // Quake air acceleration: full control toward the wish direction; strafing into a turn gains speed
      const cur = v.x * dx + v.z * dz;
      const add = wishSpeed - cur;
      if (add > 0) {
        const acc = Math.min(add, P.airAccel * wishSpeed * dt);
        v.x += dx * acc; v.z += dz * acc;
      }
      const hs = Math.hypot(v.x, v.z);
      if (hs > P.maxAirSpeed) { v.x *= P.maxAirSpeed / hs; v.z *= P.maxAirSpeed / hs; }
    }
    this.landT = (this.landT || 0) + dt;

    // sub-step fast movement so dashes can't tunnel through thin walls
    const dist = Math.hypot(v.x, v.z) * dt;
    const n = Math.max(1, Math.ceil(dist / 0.15));
    const p = { x: this.pos.x, z: this.pos.z };
    let hitWall = false;
    for (let i = 0; i < n; i++) {
      p.x += v.x * dt / n; p.z += v.z * dt / n;
      if (world.resolve(p, P.radius, this.pos.y, P.height, P.step)) hitWall = true;
      if (this.actorResolve) this.actorResolve(p, P.radius);   // enemies are solid: they don't get shoved
    }
    this.pos.x = p.x; this.pos.z = p.z;

    // ---------------------------------------------------------- vertical: ground, stairs, gravity, jump
    const wasGrounded = this.grounded;
    const g = world.groundHeight(this.pos.x, this.pos.z, P.radius * 0.55, this.pos.y, P.step);
    if (this.vy <= 0 && g > this.pos.y - 0.001) { this.pos.y = g; this._land(wasGrounded); }
    else if (this.grounded && this.vy <= 0 && g > this.pos.y - P.step) { this.pos.y = g; this.vy = 0; } // stick to stairs going down
    else {
      if (this.grounded) { this.coyote = 0.1; this.peakY = this.pos.y; }
      this.grounded = false;
      if (this.coyote > 0) this.coyote -= dt;
      this.vy -= P.gravity * dt * (this.vy < 0 ? 1.15 : 1);
      if (this.vy < -2.2 && st.glide && input.jumpHeld && !this.slamming) this.vy = -2.2;   // Wings of Ash
      this.pos.y += this.vy * dt;
      this.peakY = Math.max(this.peakY, this.pos.y);
      if (this.pos.y <= g) { this.pos.y = g; this._land(false); }
      // bonk the head on ceilings
      if (this.vy > 0 && !this._roomAt(world, this.pos.x, this.pos.z, this.pos.y + 0.02)) { this.pos.y -= this.vy * dt; this.vy = 0; }
    }
    // mantle: airborne, pushing into a wall whose top is within reach and has room on top
    if (!this.grounded && !this.mantle && wl > 0.3 && (hitWall || this.vy < 3)) this._tryMantle(world, dx, dz);
    if (this.pos.y < -60) events.emit('playerFellOut', {});
    this._camera(dt);
  }

  _land(wasGrounded) {
    const fell = this.peakY - this.pos.y;
    if (!wasGrounded) {
      this.landT = 0;
      if (this.slamming) { this.slamming = false; events.emit('playerSlam', { pos: this.pos.clone(), height: fell }); this.shake = Math.max(this.shake, 0.8); }
      else if (fell > P.fallSafe && !this.dead) {
        const dmg = Math.round((fell - P.fallSafe) * 9);
        const inv = this.invuln; this.invuln = 0;
        this.damage(dmg, null, 'fall');
        this.invuln = inv;
        events.emit('playerFallDamage', { amount: dmg, height: fell });
      } else if (fell > 1.2) this.shake = Math.max(this.shake, Math.min(0.5, fell * 0.06));
    }
    this.vy = 0; this.grounded = true; this.jumpsLeft = this.maxJumps; this.peakY = this.pos.y;
  }

  _tryMantle(world, dx, dz) {
    const reach = P.mantleReach;
    for (const ahead of [0.55, 0.8, 1.0]) {
      const x = this.pos.x + dx * ahead, z = this.pos.z + dz * ahead;
      const top = world.groundHeight(x, z, 0.12, this.pos.y, reach);
      if (top === -Infinity || top <= this.pos.y + 0.5 || top > this.pos.y + reach) continue;
      if (!this._roomAt(world, x, z, top)) continue;
      this.mantle = { t: 0, dur: 0.32, y0: this.pos.y, y1: top + 0.02, x0: this.pos.x, z0: this.pos.z, x1: x, z1: z };
      this.roll = null; this.phasing = false;
      events.emit('playerMantle', {});
      return true;
    }
    return false;
  }

  _camera(dt) {
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const v = this.velocity;
    const hs = this.grounded ? Math.hypot(v.x, v.z) : 0;
    this.bob += dt * hs * 1.6;
    const bobAmt = this.headBob ? Math.min(1.4, hs / P.speed) * 0.04 : 0;
    const dashDip = this.roll ? Math.sin(Math.PI * this.roll.t / this.roll.dur) * 0.12 : 0;
    const mantleDip = this.mantle ? Math.sin(Math.PI * Math.min(1, this.mantle.t / this.mantle.dur)) * 0.25 : 0;
    const targetEye = this.pos.y + (this.dead ? 0.35 : P.eyeHeight) - dashDip - mantleDip;
    const fast = this.grounded ? 14 : 40;
    this.eyeY += (targetEye - this.eyeY) * Math.min(1, dt * (this.dead ? 3 : this.roll || !this.grounded ? 40 : fast));
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake * 0.08;
    // strafe tilt: roll the camera into sideways motion
    const side = v.x * cos - v.z * sin;        // velocity along the camera's right vector
    const tiltTarget = this.headBob ? -Math.max(-1, Math.min(1, side / P.speed)) * 0.035 : 0;
    this.tilt += (tiltTarget - this.tilt) * Math.min(1, dt * 8);
    this.camera.position.set(
      this.pos.x + (Math.random() - 0.5) * sh,
      this.eyeY + Math.sin(this.bob * 2) * bobAmt + (Math.random() - 0.5) * sh,
      this.pos.z + (Math.random() - 0.5) * sh);
    this.camera.rotation.set(this.pitch, this.yaw, this.dead ? 0.5 : this.tilt + Math.sin(this.bob) * bobAmt * 0.25, 'YXZ');
    this.forward.set(-sin, 0, -cos);
    this.moving = hs > 0.5;
  }
}
