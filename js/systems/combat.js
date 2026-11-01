// Player combat: every weapon type has its own moveset (swing, heavy, thrust,
// cast, bow, throw, bash) and damage profile; ranged weapons fire player
// projectiles. All hits go through one pipeline (hitEnemy) that applies derived
// stats and item/skill effects: crits, bleed/burn/poison/chill, chain
// lightning, quakes, cast-on-hit, lifesteal, sets, named legendaries and
// mythics. Also: block, potions, throwables, oils, the return scroll.
import * as THREE from '../../lib/three.module.min.js';
import { Weapon } from '../player/weapon.js';
import { events } from '../engine/events.js';
import { computeStats } from './stats.js';
import { ITEMS, defOf } from './items.js';
import { xpMul } from './progression.js';
import { basicMaterial, spriteMaterial } from '../engine/materials.js';
import { buildWeapon } from '../entities/weaponModels.js';
import { installActives } from './actives.js';

const _v = new THREE.Vector3();

/** Weapon movesets. range = metres beyond the enemy's radius, arc = half-angle. */
export const MOVESETS = {
  sword: { range: 2.1, arc: 1.05, speed: 1, st: 12, pose: 'swing' },
  greatsword: { range: 2.6, arc: 1.3, speed: 0.62, st: 22, pose: 'heavy', stagger: 60 },
  axe: { range: 2.0, arc: 1.0, speed: 0.85, st: 14, pose: 'swing', bleed: 3 },
  greataxe: { range: 2.4, arc: 1.2, speed: 0.56, st: 24, pose: 'heavy', bleed: 5 },
  mace: { range: 1.9, arc: 1.0, speed: 0.9, st: 13, pose: 'swing', stagger: 60 },
  warhammer: { range: 2.2, arc: 1.1, speed: 0.52, st: 25, pose: 'heavy', stagger: 120, quake: 1.6 },
  spear: { range: 3.0, arc: 0.42, speed: 0.95, st: 12, pose: 'thrust', pierce: true },
  halberd: { range: 3.0, arc: 1.0, speed: 0.66, st: 20, pose: 'heavy' },
  dagger: { range: 1.7, arc: 0.8, speed: 1.6, st: 7, pose: 'thrust', crit: 10 },
  twinblades: { range: 1.9, arc: 1.0, speed: 1.3, st: 10, pose: 'swing', hits: 2 },
  scythe: { range: 2.7, arc: 1.6, speed: 0.7, st: 18, pose: 'heavy' },
  whip: { range: 3.6, arc: 0.7, speed: 0.9, st: 10, pose: 'swing' },
  shield: { range: 1.8, arc: 0.9, speed: 1.0, st: 10, pose: 'bash', stagger: 90, shieldBlock: true },
  staff: { speed: 0.8, st: 10, pose: 'cast', shot: { speed: 20, size: 0.2, color: 0x8ab0ff } },
  wand: { speed: 1.7, st: 6, pose: 'cast', shot: { speed: 26, size: 0.12, color: 0xc0a0ff, homing: 2 } },
  bow: { speed: 0.75, st: 10, pose: 'bow', shot: { speed: 34, arrow: true, pierce: 1, grav: 3 } },
  crossbow: { speed: 0.45, st: 14, pose: 'cast', shot: { speed: 44, arrow: true, pierce: 2 } },
  knives: { speed: 1.1, st: 9, pose: 'throw', shot: { speed: 28, knife: true, count: 3, spread: 0.1 } },
  tome: { speed: 0.9, st: 9, pose: 'cast', shot: { speed: 14, size: 0.16, color: 0xffd070, homing: 6, count: 2, spread: 0.25 } },
  lantern: { speed: 1.0, st: 10, pose: 'cast', cone: { r: 4.4, angle: 0.8 } },
};

export class CombatSystem {
  constructor(game) {
    this.game = game;
    this.weapon = new Weapon(game.camera, game.overlayScene);
    this.weapon.onStrike = () => this.strike();
    this.flash = 0;
    this.hitCounter = 0;
    this.nextCrit = false;
    this.flaskCooldown = 0;
    this.shots = [];
    this.runKills = 0;
    this.buffs = {};          // temporary stat buffs { key: { v, t } }
    this.cds = {};            // internal cooldowns of item effects
    this.oil = null;
    installActives(this, game);

    events.on('playerDamaged', ({ amount, source, sourcePos }) => {
      const s = this.stats;
      const th = s && s.thornsPct;
      if (th && source && !source.dead && source.takeHit) {
        const r = Math.max(1, Math.round(amount * th / 100));
        source.takeHit(r, game.player.pos, 0.2);
        game.hud.damageNumber(source.headPos(_v), r, 'burn');
      }
      this.flash = Math.min(1, 0.5 + amount / 30);
      const p = game.player;
      game.hud.damageNumber(_v.set(p.pos.x + p.forward.x * 0.8, p.eyeY - 0.3, p.pos.z + p.forward.z * 0.8), amount, 'player');
      // The Stilled Hour: time slows around you when you're nearly dead
      if (s && s.stillTime && p.hp < p.maxHp * 0.3 && this.ready('still', 60)) { game.enemySlowT = 4; game.hud.banner('The hour stills', 'the world slows around you'); }
    });
    events.on('playerBlocked', ({ sourcePos }) => {
      const s = this.stats;
      game.area.glow.burst(game.player.pos.x + game.player.forward.x * 0.7, game.player.eyeY - 0.4, game.player.pos.z + game.player.forward.z * 0.7, 10, 3, 0.3, [1, 0.8, 0.5], 0.04, -6, 1);
      if (s && s.oathBulwark && this.ready('bulwark', 1.5)) this.nova(game.player.pos, 3.5, Math.round(25 * this.dmgScale()), [0.8, 0.85, 1], 1.5);
    });
    events.on('guardBreak', () => game.hud.feed('Guard broken!', '#e07050'));
    events.on('enemyKilled', ({ enemy }) => {
      this.reward(enemy);
      const s = this.stats;
      // Phoenix Brand / Band of Embers: flames jump from burning corpses
      if (s && s.burnSpread && enemy.burning) {
        for (const e of game.enemies.list) if (!e.dead && e !== enemy && e.pos.distanceTo(enemy.pos) < 4) e.ignite(s.burnDps * (1 + s.burnPct / 100) || 4, 3);
        game.area.glow.burst(enemy.pos.x, enemy.pos.y + 0.5, enemy.pos.z, 24, 4, 0.6, [1, 0.5, 0.15], 0.06, -2, 1);
      }
      if (s && s.raiseDead && game.allies && Math.random() < 0.35) game.allies.summon('skeleton', enemy.pos, { life: 30 });
    });
    events.on('playerDash', () => {
      const s = this.stats, p = game.player;
      if (s && s.dashFreeze && this.ready('freeze', 20)) {
        for (const e of game.enemies.list) if (!e.dead && e.pos.distanceTo(p.pos) < 7) { e.chill(100, 3); if (!e.brain) { e.state = 'stagger'; e.timer = 3; } }
        game.area.glow.burst(p.pos.x, p.pos.y + 1, p.pos.z, 50, 6, 0.8, [0.7, 0.85, 1], 0.06, 0, 1);
        game.hud.feed('Time stops.', '#a0d0ff');
      }
      if (s && s.dashInvis) p.hiddenT = 2;
    });
    game.player.cheatDeath = () => {
      if (!this.stats || !this.stats.cheatDeath || this.lastStandUsed || !game.area.hostile) return false;
      this.lastStandUsed = true;
      game.hud.feed('Death refused!', '#ff7050');
      game.hud.banner('DEATH REFUSED', 'once per run');
      return true;
    };
    events.on('runStarted', () => { this.lastStandUsed = false; this.runKills = 0; this.refreshStats(); });
    events.on('areaChanged', () => { this.clearShots(); });
    // ground slam (movement unlock): shockwave where you land
    events.on('playerSlam', ({ pos, height }) => {
      const dmg = Math.round((25 + Math.min(12, height) * 5) * this.dmgScale());
      game.area.dust.burst(pos.x, pos.y + 0.2, pos.z, 36, 5, 0.8, [0.35, 0.3, 0.25], 0.14, -3, 0.6);
      this.nova(pos, 3.8, dmg, [1, 0.6, 0.3], 2.2, true);
    });
    events.on('playerFallDamage', ({ amount }) => game.hud.feed(`Fall damage: ${amount}`, '#c06040'));
    events.on('enemyDot', ({ enemy, amount }) => game.hud.damageNumber(enemy.headPos(_v), amount, 'burn'));
    events.on('equipmentChanged', () => this.refreshStats());
  }

  get stats() { return this.game.player.stats; }

  /** Internal cooldown helper for item effects. */
  ready(key, secs) {
    const now = performance.now() / 1000;
    if ((this.cds[key] || 0) > now) return false;
    this.cds[key] = now + secs * (1 - ((this.stats && this.stats.cdrPct) || 0) / 100);
    return true;
  }

  /** Re-derive stats from gear + skills + buffs and update weapon visuals. */
  refreshStats() {
    const g = this.game;
    const extra = {};
    for (const [k, b] of Object.entries(this.buffs)) if (b.t > 0) extra[k] = b.v;
    if (this.runKills && g.state.equippedDefs) { /* growing damage applied in hitEnemy */ }
    const s = computeStats(g.state, extra);
    g.player.applyStats(s);
    const wdef = s.weapon;
    const wt = (wdef && wdef.wtype) || 'sword';
    this.ms = MOVESETS[wt] || MOVESETS.sword;
    if (this.ms.shieldBlock) s.shieldBlock = 1;
    this.weapon.speed = (1 + s.attackSpeedPct / 100) * this.ms.speed;
    const cos = g.state.world.cosmetics || {};
    const dye = cos.dye && ITEMS[cos.dye] ? ITEMS[cos.dye].cosmetic.color : null;
    const legacyModel = wdef && !wdef.gen ? (wdef.model || 'sword') : null;
    const model = legacyModel && wt === 'sword' ? legacyModel : wt;
    const glow = wdef && (wdef.rarity === 'mythic' ? 0xff3a5a : wdef.rarity === 'legendary' ? 0xff8a20 : s.burnDps > 4 ? 0xff6a20 : null);
    this.weapon.setModel(model, { tint: wdef && wdef.tint, glow, pose: this.ms.pose, dye });
    this.weapon.setSlashColor(s.burnDps > 0 || (wdef && wdef.id === 'ash_blade'));
  }

  /** Base weapon damage roll. */
  weaponRoll() {
    const w = this.stats.weapon;
    const [lo, hi] = (w && w.dmg) || [15, 21];
    return lo + Math.random() * (hi - lo);
  }

  /** Rough "how hard do I hit" scale for item procs. */
  dmgScale() { const w = this.stats && this.stats.weapon; const d = (w && w.dmg) || [15, 21]; return ((d[0] + d[1]) / 36) * (1 + (this.stats.damagePct || 0) / 100); }

  _damageEnemy(e, dmg, kind, knock = 1) {
    const g = this.game;
    e.takeHit(dmg, g.player.pos, knock);
    g.hud.damageNumber(e.headPos(_v), dmg, kind);
  }

  /**
   * The one hit pipeline (melee, projectiles, skills). o: { mul, skill, noProc, crit, knock, src }
   * Returns damage dealt.
   */
  hitEnemy(e, o = {}) {
    const g = this.game, p = g.player, s = this.stats, ms = this.ms || MOVESETS.sword;
    if (e.dead) return 0;
    let dmg = (o.base ?? this.weaponRoll()) * (1 + s.damagePct / 100) * (o.mul || 1);
    if (o.skill) dmg *= 1 + (s.skillDmgPct || 0) / 100;
    if (s.firstStrikePct && e.hp >= e.maxHp) dmg *= 1 + s.firstStrikePct / 100;
    if (s.berserkPct && p.hp < p.maxHp * 0.4) dmg *= 1 + s.berserkPct / 100;
    if (s.rollStrikePct && performance.now() - (p.lastRollAt || -1e9) < 1000) dmg *= 1 + s.rollStrikePct / 100;
    if (s.executePct && e.hp < e.maxHp * 0.3) dmg *= 1 + s.executePct / 100;
    if (s.eliteDmgPct && (e.elite || e.def.boss)) dmg *= 1 + s.eliteDmgPct / 100;
    if (s.growingDamage) dmg *= 1 + Math.min(1.5, this.runKills * 0.01);
    if (e.cursedT > 0) dmg *= 1.25;
    const crit = o.crit ?? (this.nextCrit || Math.random() * 100 < s.critChance + (ms.crit || 0));
    this.nextCrit = false;
    if (crit) dmg *= 1 + s.critDmgPct / 100;
    dmg = Math.max(1, Math.round(dmg));
    this._damageEnemy(e, dmg, crit ? 'crit' : '', (o.knock ?? 1) * (1 + ((s.staggerPct || 0) + (ms.stagger || 0)) / 100));
    events.emit('enemyHit', { enemy: e, damage: dmg, crit });
    if (o.noProc) return dmg;
    // ---- on-hit effects
    const elem = 1 + (s.elemDmgPct || 0) / 100;
    if ((s.bleedDps || ms.bleed) && !e.dead) e.dot('bleed', ((s.bleedDps || 0) + (ms.bleed || 0)) * elem, 4);
    if (s.poisonDps && !e.dead) e.dot('poison', s.poisonDps * elem, 4);
    if (s.chillPct && !e.dead) e.chill(Math.min(70, s.chillPct), 2.5);
    if (s.burnDps && !e.dead) e.ignite(s.burnDps * (1 + s.burnPct / 100) * elem, 3 * (1 + s.burnPct / 100));
    if (this.oil && this.oil.t > 0 && !e.dead) {
      const d = 4 + g.state.progression.level * 0.6;
      if (this.oil.kind === 'fire') e.ignite(d, 3); else if (this.oil.kind === 'frost') e.chill(40, 2.5); else e.dot('poison', d, 4);
    }
    if (s.chainHit) this.chain(e, Math.round(dmg * 0.5), s.chainHit);
    if (s.shockChance && Math.random() * 100 < s.shockChance) this.chain(e, Math.round(dmg * 0.6 * elem), 3, [0.7, 0.8, 1]);
    if (s.quakeChance && Math.random() * 100 < s.quakeChance) this.quake(e);
    if (s.castOnHit && Math.random() * 100 < s.castOnHit && this.ready('coh', 0.4)) this.fireShot({ speed: 18, size: 0.25, color: 0xff6020, aoe: 2.5, burn: 6 }, Math.round(dmg * 0.8), e);
    if (s.lifesteal) p.heal(dmg * s.lifesteal / 100);
    if (crit && s.emberBurst) this.emberBurst(e, s.emberBurst);
    if ((s.doubleStrike && Math.random() * 100 < s.doubleStrike) || s.voidDouble) {
      setTimeout(() => { if (!e.dead) this.hitEnemy(e, { base: dmg / (1 + s.damagePct / 100), noProc: true, crit: false, knock: 0.2 }); }, 90);
    }
    this.hitCounter++;
    if (s.stormCall && this.hitCounter % 4 === 0) this.chain(e, Math.round(dmg * 1.2), 3, [0.8, 0.9, 1]);
    if (s.tideNova && this.hitCounter % 6 === 0) { this.nova(e.pos, 4, Math.round(dmg * 0.8), [0.3, 0.8, 0.8], 2); for (const x of g.enemies.list) if (!x.dead && x.pos.distanceTo(e.pos) < 4) x.chill(50, 3); }
    if (s.pyre && this.hitCounter % 5 === 0) this.pyreNova(s.pyre);
    if (g.allies) g.allies.focus = e;
    return dmg;
  }

  /** Melee strike (or ranged release) at the hit frame of the swing. */
  strike() {
    const g = this.game, p = g.player, s = this.stats, ms = this.ms || MOVESETS.sword;
    if (ms.shot) { this.releaseShot(); return; }
    if (ms.cone) { this.lanternCone(); return; }
    const range = ms.range + s.reach;
    const arc = ms.arc * (1 + (s.arcPct || 0) / 100);
    let hits = 0;
    const fwd = Math.atan2(p.forward.x, p.forward.z);
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
      const dist = Math.hypot(dx, dz) - e.radius;
      if (dist > range) continue;
      if (Math.abs(e.pos.y - p.pos.y) > 1.6 + (e.def.flying ? 2.5 : 0)) continue;
      let diff = Math.atan2(dx, dz) - fwd; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) > arc && dist > 0.3) continue;
      if (!g.area.collision.lineOfSight(p.pos.x, p.eyeY, p.pos.z, e.pos.x, e.pos.y + e.height * 0.5, e.pos.z)) continue;
      for (let h = 0; h < (ms.hits || 1); h++) this.hitEnemy(e, { mul: ms.hits ? 1 : 1 });
      const hx = e.pos.x - dx * 0.25, hz = e.pos.z - dz * 0.25, hy = e.pos.y + e.height * 0.55;
      if (e.def.armored) g.area.glow.burst(hx, hy, hz, 14, 4, 0.35, [1, 0.75, 0.35], 0.035, -9, 1);
      else g.area.dust.burst(hx, hy, hz, 12, 2.5, 0.6, e.def.hitColor, 0.06, -9, 1);
      if (ms.quake && !e.dead) this.nova(e.pos, ms.quake, Math.round(this.weaponRoll() * 0.4), [0.4, 0.35, 0.3], 1, true);
      hits++;
      if (!ms.pierce && ms.pose === 'thrust' && hits >= 1) break;
    }
    // breakable walls (secret rooms)
    if (g.area.breakables) for (const b of g.area.breakables) if (!b.broken && b.pos.distanceTo(p.pos) < range + 1.6) b.hit();
    if (hits) p.shake = Math.max(p.shake, ms.pose === 'heavy' ? 0.5 : 0.3);
  }

  // ------------------------------------------------------------ ranged
  releaseShot() {
    const ms = this.ms, sh = ms.shot;
    const n = sh.count || 1;
    for (let i = 0; i < n; i++) this.fireShot({ ...sh, spread: n > 1 ? (i - (n - 1) / 2) * (sh.spread || 0.1) : 0 }, null, null);
    if (this.stats.splitShot && sh.arrow) for (const sp of [-0.18, 0.18]) this.fireShot({ ...sh, spread: sp }, null, null);
  }

  /** Fire a player projectile. dmg null = weapon roll at impact. target: optional homing target. */
  fireShot(o, dmg = null, target = null, src = null) {
    const g = this.game, p = g.player, area = g.area;
    const cam = g.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    if (target) dir.copy(target.headPos(new THREE.Vector3())).sub(src || cam.position).normalize();
    if (o.spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), o.spread);
    const pos = (src ? src.clone() : cam.position.clone().addScaledVector(dir, 0.6)).add(new THREE.Vector3(0, -0.15, 0));
    const grp = new THREE.Group();
    if (o.arrow || o.knife) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, o.knife ? 0.3 : 0.7), basicMaterial(o.knife ? 0xc0c0c8 : 0x9a8060));
      grp.add(m);
    } else {
      grp.add(new THREE.Mesh(new THREE.IcosahedronGeometry(o.size || 0.18, 0), basicMaterial(o.color || 0xffffff)));
      const gl = new THREE.Sprite(spriteMaterial('glow', o.color || 0xffffff)); gl.scale.setScalar((o.size || 0.18) * 7); gl.material.opacity = 0.7; grp.add(gl);
    }
    grp.position.copy(pos);
    area.scene.add(grp);
    const pierce = this.stats.pierceAll ? 99 : (o.pierce || 0);
    this.shots.push({ grp, area, vel: dir.multiplyScalar(o.speed || 20), o, dmg, life: 2.5, pierce, hit: new Set(), target, skill: o.skill });
    if (this.shots.length > 60) { const x = this.shots.shift(); x.area.scene.remove(x.grp); }
  }

  clearShots() { for (const s of this.shots) s.area.scene.remove(s.grp); this.shots.length = 0; }

  updateShots(dt) {
    const g = this.game, col = g.area.collision;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      const pos = s.grp.position;
      if (s.o.homing) {
        let t = s.target && !s.target.dead ? s.target : null;
        if (!t) { let bd = 14; for (const e of g.enemies.list) { if (e.dead) continue; const d = e.pos.distanceTo(pos); if (d < bd) { bd = d; t = e; } } s.target = t; }
        if (t) { const want = t.headPos(_v).sub(pos).normalize().multiplyScalar(s.vel.length()); s.vel.lerp(want, Math.min(1, dt * s.o.homing)); }
      }
      if (s.o.grav) s.vel.y -= s.o.grav * dt;
      const step = s.vel.length() * dt;
      const ox = pos.x, oy = pos.y, oz = pos.z;
      pos.addScaledVector(s.vel, dt);
      s.grp.lookAt(pos.x + s.vel.x, pos.y + s.vel.y, pos.z + s.vel.z);
      let done = s.life <= 0;
      if (!done && !col.lineOfSight(ox, oy, oz, pos.x, pos.y, pos.z)) done = true;
      if (!done) for (const e of g.enemies.list) {
        if (e.dead || s.hit.has(e)) continue;
        const r = e.radius + 0.25;
        const dx = pos.x - e.pos.x, dz = pos.z - e.pos.z;
        const top = e.pos.y + e.height + (e.def.flying ? 2.8 : 0);
        if (dx * dx + dz * dz > r * r || pos.y < e.pos.y - 0.2 || pos.y > top) continue;
        s.hit.add(e);
        if (s.o.aoe) { this.nova(pos, s.o.aoe, s.dmg ?? Math.round(this.weaponRoll()), [1, 0.5, 0.2], 1, false, s.o.burn); done = true; break; }
        this.hitEnemy(e, s.dmg != null ? { base: s.dmg / (1 + this.stats.damagePct / 100), skill: s.skill } : { skill: s.skill });
        if (s.o.chill) e.chill(s.o.chill, 2.5);
        if (s.pierce-- <= 0) { done = true; break; }
      }
      if (Math.random() < 0.5) g.area.glow.emit(pos.x, pos.y, pos.z, 0, 0, 0, 0.25, s.o.arrow || s.o.knife ? [0.5, 0.45, 0.35] : new THREE.Color(s.o.color || 0xffffff).toArray(), 0.04);
      if (done) {
        if (s.o.aoe && !s.hit.size) this.nova(pos, s.o.aoe, s.dmg ?? Math.round(this.weaponRoll()), [1, 0.5, 0.2], 1, false, s.o.burn);
        s.area.scene.remove(s.grp);
        this.shots.splice(i, 1);
      }
      void step;
    }
  }

  /** Lantern: a short cone of fire in front of you. */
  lanternCone() {
    const g = this.game, p = g.player, c = this.ms.cone;
    const fwd = Math.atan2(p.forward.x, p.forward.z);
    for (let i = 0; i < 26; i++) { const a = fwd + (Math.random() - 0.5) * c.angle * 2, sp = 5 + Math.random() * 4; g.area.glow.emit(p.pos.x + p.forward.x * 0.6, p.eyeY - 0.35, p.pos.z + p.forward.z * 0.6, Math.sin(a) * sp, 0.4, Math.cos(a) * sp, 0.5, [1, 0.55, 0.15], 0.09, 0, 2); }
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz) - e.radius;
      if (d > c.r) continue;
      let diff = Math.atan2(dx, dz) - fwd; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) > c.angle) continue;
      this.hitEnemy(e, {});
      if (!e.dead) e.ignite(4 + this.dmgScale() * 3, 3);
    }
  }

  /** Damage everything in a circle (novas, bombs, slams). */
  nova(pos, r, dmg, col = [1, 0.5, 0.2], knock = 1, ground = false, burn = 0) {
    const g = this.game;
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; g.area.glow.emit(pos.x, pos.y + 0.4, pos.z, Math.cos(a) * r * 2, 0.4, Math.sin(a) * r * 2, 0.45, col, 0.09, 0, 1.5); }
    for (const e of g.enemies.list) {
      if (e.dead || e.pos.distanceTo(pos) > r + e.radius) continue;
      if (ground && e.def.flying) continue;
      this._damageEnemy(e, dmg, 'burn', knock);
      if (burn && !e.dead) e.ignite(burn, 3);
    }
  }

  /** Lightning arcs from the target to nearby enemies. */
  chain(from, dmg, n, col = [0.6, 0.8, 1]) {
    const g = this.game;
    const near = g.enemies.list.filter((e) => !e.dead && e !== from && e.pos.distanceTo(from.pos) < 6).sort((a, b) => a.pos.distanceTo(from.pos) - b.pos.distanceTo(from.pos)).slice(0, n);
    for (const e of near) {
      const a = from.headPos(), b = e.headPos();
      for (let i = 0; i <= 8; i++) { const t = i / 8; g.area.glow.emit(a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 0.3, a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 0.3, a.z + (b.z - a.z) * t, 0, 0, 0, 0.25, col, 0.06); }
      this._damageEnemy(e, dmg, 'crit', 0.3);
    }
  }

  quake(center) {
    const g = this.game;
    g.area.dust.burst(center.pos.x, center.pos.y + 0.2, center.pos.z, 30, 4, 0.8, [0.35, 0.3, 0.25], 0.12, -3, 0.5);
    g.player.shake = Math.max(g.player.shake, 0.5);
    for (const e of g.enemies.list) if (!e.dead && e.pos.distanceTo(center.pos) < 3) { this._damageEnemy(e, Math.round(45 * this.dmgScale()), 'crit', 2); if (!e.brain) { e.state = 'stagger'; e.timer = 0.5; } }
  }

  emberBurst(center, dmg) {
    this.game.area.glow.burst(center.pos.x, center.pos.y + 0.8, center.pos.z, 30, 5, 0.6, [1, 0.5, 0.15], 0.06, -2, 1);
    for (const e of this.game.enemies.list) if (!e.dead && e.pos.distanceTo(center.pos) <= 2.5) this._damageEnemy(e, Math.round(dmg * this.dmgScale()), 'burn', 0.5);
  }

  pyreNova(dmg) {
    const g = this.game, p = g.player;
    this.nova(p.pos, 4, Math.round(dmg * this.dmgScale()), [1, 0.45, 0.12], 1.5, false, 4);
    g.hud.feed('Pyre!', '#ff9a50');
  }

  reward(enemy) {
    const g = this.game, d = enemy.def, s = this.stats;
    if (enemy.escaped) return;
    const lv = enemy.level || 1;
    const ashes = Math.round((d.ashes[0] + Math.random() * (d.ashes[1] - d.ashes[0])) * (1 + (lv - 1) * 0.12) * (1 + s.ashPct / 100));
    g.state.addCurrency(ashes);
    g.state.stats.kills++;
    this.runKills++;
    const p = g.player;
    if (s.killHeal) p.heal(s.killHeal);
    if (s.killHealPct) p.heal(p.maxHp * s.killHealPct / 100);
    if (s.killStamina) p.stamina = Math.min(p.maxStamina, p.stamina + s.killStamina);
    if (s.killExplode) {
      g.area.glow.burst(enemy.pos.x, enemy.pos.y + 0.8, enemy.pos.z, 40, 5, 0.7, [1, 0.45, 0.12], 0.08, -2, 1);
      for (const e of g.enemies.list) if (!e.dead && e !== enemy && e.pos.distanceTo(enemy.pos) < 3.5) { this._damageEnemy(e, Math.round(s.killExplode * this.dmgScale()), 'burn', 1); e.ignite(5, 3); }
    }
    if (s.deathDance) this.nextCrit = true;
    g.hud.feed(`${enemy.name} falls  +${ashes} ashes`);
    g.giveXp(Math.round(d.xp * (1 + (lv - 1) * 0.25) * (lv > 1 ? xpMul(lv, g.state.progression.level) : 1) * (1 + (s.xpPct || 0) / 100) * ((g.area.mapMod && g.area.mapMod.xp) || 1)));
    if (g.restoration && lv <= 25 && g.area.hostile) g.restoration.kill();
    events.emit('loot', { enemy, ashes });
  }

  // ------------------------------------------------------------ consumables
  /** R / FLASK: drink the best healing potion you carry (or an Ashen Flask). */
  drinkFlask() {
    const g = this.game, p = g.player;
    if (this.flaskCooldown > 0 || p.dead) return;
    if (this.stats.noFlask) { g.hud.feed('The curse will not let you drink.', '#a060c0'); return; }
    const ids = ['hp_potion_4', 'hp_potion_3', 'hp_potion_2', 'hp_potion_1', 'hp_potion_0', 'ashen_flask'].filter((id) => g.state.count(id));
    if (!ids.length) { g.hud.feed('No healing potions left.', '#a08060'); return; }
    if (p.hp >= p.maxHp) { g.hud.feed('You are not wounded.', '#a08060'); return; }
    // the smallest potion that covers the wound
    const miss = p.maxHp - p.hp;
    const id = [...ids].reverse().find((x) => ITEMS[x].heal >= miss * 0.8) || ids[0];
    this.useConsumable(id);
  }

  /** Use a consumable by item id. Returns true if used. */
  useConsumable(id) {
    const g = this.game, p = g.player, d = ITEMS[id], s = this.stats;
    if (!d || !g.state.count(id) || p.dead) return false;
    if (d.heal) {
      if (s.noFlask) return false;
      g.state.consume(id);
      p.healOverTime += d.heal * (1 + ((s.flaskPct || 0)) / 100);
      this.flaskCooldown = 1.0;
      g.area.glow.burst(p.pos.x, p.pos.y + 1, p.pos.z, 20, 1.5, 1, [1, 0.6, 0.25], 0.04, 1, 1);
      g.hud.feed(`${d.name} (${g.state.count(id)} left)`, '#d8a050');
    } else if (d.stamina) { g.state.consume(id); p.stamina = Math.min(p.maxStamina, p.stamina + d.stamina); this.buff('staminaRegenPct', 50, 20); }
    else if (d.mana) { g.state.consume(id); p.mana = Math.min(p.maxMana, p.mana + d.mana); }
    else if (d.cure) { g.state.consume(id); p.dot = null; p.poisonImmune = 30; g.hud.feed('Cured.', '#90e060'); }
    else if (d.oil) { g.state.consume(id); this.oil = { kind: d.oil, t: 60 }; g.hud.feed(`${d.name}: your weapon is coated (60 s)`, '#e0c080'); }
    else if (d.throwable) { if (!g.area.hostile) { g.hud.feed('Not here.', '#a08060'); return false; } g.state.consume(id); this.throwItem(d.throwable); }
    else if (d.returnHome) {
      if (!g.area.hostile) { g.hud.feed('You are already home.', '#a08060'); return false; }
      g.state.consume(id);
      g.hud.banner('Scroll of Return', 'the ash carries you home');
      g.onPortal({ target: 'town', spawn: 'respawn' });
    } else return false;
    return true;
  }

  buff(key, v, t) { this.buffs[key] = { v, t }; this.refreshStats(); }

  /** Bombs, fire flasks, smoke bombs. */
  throwItem(kind) {
    const g = this.game, p = g.player;
    if (kind === 'smoke') {
      p.hiddenT = 4;
      g.area.dust.burst(p.pos.x, p.pos.y + 1, p.pos.z, 60, 3, 2, [0.5, 0.5, 0.5], 0.3, 0.5, 1);
      for (const e of g.enemies.list) if (!e.dead && !e.def.boss && (e.state === 'chase' || e.state === 'windup')) { e.state = 'return'; e._clearTele && e._clearTele(); }
      g.hud.feed('Smoke! They lose sight of you.', '#c0c0c0');
      return;
    }
    const lvl = Math.max(1, g.state.world.deepest || 1);
    const dmg = Math.round((kind === 'bomb' ? 70 : 30) * (1 + lvl * 0.25));
    const o = kind === 'bomb' ? { speed: 16, size: 0.22, color: 0x806040, aoe: 4, grav: 9 } : { speed: 15, size: 0.2, color: 0xff6020, aoe: 3, grav: 9, burn: 8 + lvl };
    this.fireShot(o, dmg);
    if (kind === 'fire') {
      // leave a burning pool where it lands (approximation: 6 m ahead)
      const at = p.pos.clone().addScaledVector(p.forward, 6);
      setTimeout(() => g.projectiles.zone(g.area, at.x, p.pos.y, at.z, { r: 2.5, dur: 6, color: 0xff6020, hurtsEnemies: true, enemyDps: 8 + lvl, kind: 'burn' }), 400);
    }
  }

  quickUse() {
    const g = this.game, st = g.state;
    let id = st.quick;
    if (!id || !st.count(id)) id = ['bomb', 'fire_flask', 'smoke_bomb', 'antidote', 'oil_fire', 'oil_frost', 'oil_poison', 'st_potion_2', 'mp_potion_2'].find((x) => st.count(x));
    if (!id) { g.hud.feed('No quick item (set one in the inventory).', '#a08060'); return; }
    this.useConsumable(id);
  }

  update(dt) {
    const g = this.game, p = g.player, s = this.stats;
    const ms = this.ms || MOVESETS.sword;
    p.blocking = !!g.input.block && !p.dead && !p.roll && this.weapon.t < 0 && !p.exhausted;
    this.weapon.blocking = p.blocking;
    if (g.input.consume('hit') && !p.dead && !g.transitioning && !p.roll && this.weapon.ready && !p.blocking) {
      // airborne + looking down + slam unlocked = ground slam
      if (!p.grounded && p.pitch < -0.75 && s.groundSlam) p.startSlam();
      else if (p.useStamina(ms.st * (1 - (s.attackCostPct || 0) / 100))) {
        this.weapon.swing();
        for (const e of g.enemies.list) if (!e.dead && e.pos.distanceTo(p.pos) < 3.6 + e.radius) e.tryDodge(p);
      } else g.hud.flashStamina();
    }
    if (g.input.consume('flask')) this.drinkFlask();
    if (g.input.consume('quick')) this.quickUse();
    if (this.flaskCooldown > 0) this.flaskCooldown -= dt;
    if (this.oil && this.oil.t > 0) this.oil.t -= dt;
    let changed = false;
    for (const b of Object.values(this.buffs)) if (b.t > 0) { b.t -= dt; if (b.t <= 0) changed = true; }
    if (changed) this.refreshStats();
    if (p.hiddenT > 0) p.hiddenT -= dt;
    this.weapon.update(dt, p);
    this.updateShots(dt);
    this.updateActives(dt);
    // dash nova (Shroud / Rimewatch)
    if (p.roll && !p.roll.nova && s.rollNova) {
      p.roll.nova = true;
      this.nova(p.pos, 4, Math.round(s.rollNova * this.dmgScale()), [0.6, 0.85, 1], 0.5);
      for (const e of g.enemies.list) if (!e.dead && e.pos.distanceTo(p.pos) < 4) e.chill(50, 3);
    }
    // Phantom Blade: dashing through enemies cuts them
    if (p.roll) {
      p.lastRollAt = performance.now();
      if (s.rollDamage) {
        if (!p.roll.hit) p.roll.hit = new Set();
        for (const e of g.enemies.list) {
          if (e.dead || p.roll.hit.has(e) || e.pos.distanceTo(p.pos) > e.radius + 0.9) continue;
          p.roll.hit.add(e);
          this.hitEnemy(e, { base: s.rollDamage, noProc: true });
        }
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.2);
    g.renderer.postUniforms.uFlash.value = this.flash;
    // the hub is safe: wounds slowly close in town
    if (!g.area.hostile && !p.dead && p.hp < p.maxHp) p.heal(dt * 12);
    if (this.weapon.model === 'lantern' && g.area.lantern) g.area.lanternIntensity = Math.max(g.area.lanternIntensity, 3);
    void buildWeapon; void defOf;
  }
}
