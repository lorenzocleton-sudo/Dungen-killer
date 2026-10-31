// Player melee: one HIT action -> swing -> arc hit test against enemies.
// Applies derived stats + skill effects (crit, burn, lifesteal, ember burst,
// pyre nova, execute, death's dance), damage feedback and kill rewards.
// Also handles the healing flask.
import * as THREE from '../../lib/three.module.min.js';
import { Weapon } from '../player/weapon.js';
import { events } from '../engine/events.js';
import { addXp } from './skills.js';
import { computeStats } from './stats.js';
import { ITEMS } from './items.js';

const _v = new THREE.Vector3();

export const PLAYER_ATTACK = {
  range: 2.1,       // metres beyond the enemy's radius
  arc: 1.05,        // half-angle in radians
  damage: [15, 21],
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

    events.on('playerDamaged', ({ amount }) => {
      this.flash = Math.min(1, 0.5 + amount / 30);
      const p = game.player;
      game.hud.damageNumber(_v.set(p.pos.x + p.forward.x * 0.8, p.eyeY - 0.3, p.pos.z + p.forward.z * 0.8), amount, 'player');
    });
    events.on('enemyKilled', ({ enemy }) => this.reward(enemy));
    events.on('enemyDot', ({ enemy, amount }) => game.hud.damageNumber(enemy.headPos(_v), amount, 'burn'));
    events.on('equipmentChanged', () => this.refreshStats());
  }

  get stats() { return this.game.player.stats; }

  /** Re-derive stats from gear + skills and update weapon visuals. */
  refreshStats() {
    const g = this.game;
    const s = computeStats(g.state);
    g.player.applyStats(s);
    this.weapon.speed = 1 + s.attackSpeedPct / 100;
    const w = g.state.equippedDefs().weapon;
    this.weapon.setModel(w ? (ITEMS[w.id].model || 'sword') : 'sword');
    this.weapon.setSlashColor(s.burnDps > 0 || (w && w.id === 'ash_blade'));
  }

  _damageEnemy(e, dmg, kind, knock = 1) {
    const g = this.game;
    e.takeHit(dmg, g.player.pos, knock);
    g.hud.damageNumber(e.headPos(_v), dmg, kind);
  }

  strike() {
    const g = this.game, p = g.player, s = this.stats;
    const range = PLAYER_ATTACK.range + s.reach;
    const arc = PLAYER_ATTACK.arc * (1 + s.arcPct / 100);
    let hits = 0;
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
      const dist = Math.hypot(dx, dz) - e.radius;
      if (dist > range) continue;
      if (Math.abs(e.pos.y - p.pos.y) > 1.6) continue;
      const fwd = Math.atan2(p.forward.x, p.forward.z), ang = Math.atan2(dx, dz);
      let diff = ang - fwd; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) > arc && dist > 0.3) continue;
      if (!g.area.collision.lineOfSight(p.pos.x, p.eyeY, p.pos.z, e.pos.x, e.pos.y + e.def.height * 0.5, e.pos.z)) continue;

      const [lo, hi] = PLAYER_ATTACK.damage;
      let dmg = (lo + Math.random() * (hi - lo)) * (1 + s.damagePct / 100);
      if (s.executePct && e.hp < e.maxHp * 0.3) dmg *= 1 + s.executePct / 100;
      const crit = this.nextCrit || Math.random() * 100 < s.critChance;
      this.nextCrit = false;
      if (crit) dmg *= 1 + s.critDmgPct / 100;
      dmg = Math.round(dmg);
      this._damageEnemy(e, dmg, crit ? 'crit' : '');
      if (s.lifesteal) p.heal(dmg * s.lifesteal / 100);
      if (s.burnDps && !e.dead) e.ignite(s.burnDps * (1 + s.burnPct / 100), 3 * (1 + s.burnPct / 100));
      if (crit && s.emberBurst) this.emberBurst(e, s.emberBurst);

      const hx = e.pos.x - dx * 0.25, hz = e.pos.z - dz * 0.25, hy = e.pos.y + e.def.height * 0.55;
      if (e.def.armored) g.area.glow.burst(hx, hy, hz, 14, 4, 0.35, [1, 0.75, 0.35], 0.035, -9, 1);
      else g.area.dust.burst(hx, hy, hz, 12, 2.5, 0.6, e.def.hitColor, 0.06, -9, 1);
      hits++;
      events.emit('enemyHit', { enemy: e, damage: dmg, crit });
    }
    if (hits) {
      p.shake = Math.max(p.shake, 0.35);
      if (s.pyre && ++this.hitCounter % 5 === 0) this.pyreNova(s.pyre);
    }
  }

  emberBurst(center, dmg) {
    const g = this.game;
    g.area.glow.burst(center.pos.x, center.pos.y + 0.8, center.pos.z, 30, 5, 0.6, [1, 0.5, 0.15], 0.06, -2, 1);
    for (const e of g.enemies.list) {
      if (e.dead || e.pos.distanceTo(center.pos) > 2.5) continue;
      this._damageEnemy(e, dmg, 'burn', 0.5);
    }
  }

  pyreNova(dmg) {
    const g = this.game, p = g.player;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      g.area.glow.emit(p.pos.x, p.pos.y + 0.4, p.pos.z, Math.cos(a) * 7, 0.5 + Math.random(), Math.sin(a) * 7, 0.6, [1, 0.45, 0.12], 0.09, 0, 1.5);
    }
    for (const e of g.enemies.list) {
      if (e.dead || e.pos.distanceTo(p.pos) > 4) continue;
      this._damageEnemy(e, dmg, 'burn', 1.5);
      e.ignite(4, 2);
    }
    g.hud.feed('Pyre!', '#ff9a50');
  }

  reward(enemy) {
    const g = this.game, d = enemy.def, s = this.stats;
    const ashes = Math.round((d.ashes[0] + Math.random() * (d.ashes[1] - d.ashes[0])) * (1 + s.ashPct / 100));
    g.state.addCurrency(ashes);
    g.state.stats.kills++;
    if (s.killHeal) g.player.heal(s.killHeal);
    if (s.deathDance) this.nextCrit = true;
    const lv = addXp(g.state.progression, d.xp);
    g.hud.feed(`${d.name} falls  +${ashes} ashes`);
    if (lv) g.hud.feed(`Level ${g.state.progression.level}! Skill point gained - visit the Hall of Paths`, '#e0b060');
    events.emit('loot', { enemy, ashes });
  }

  drinkFlask() {
    const g = this.game, p = g.player;
    if (this.flaskCooldown > 0 || p.dead) return;
    if (!g.state.count('ashen_flask')) { g.hud.feed('No flasks left.', '#a08060'); return; }
    if (p.hp >= p.maxHp) { g.hud.feed('You are not wounded.', '#a08060'); return; }
    g.state.consume('ashen_flask');
    p.healOverTime += ITEMS.ashen_flask.heal * (1 + this.stats.flaskPct / 100);
    this.flaskCooldown = 1.2;
    g.area.glow.burst(p.pos.x, p.pos.y + 1, p.pos.z, 20, 1.5, 1, [1, 0.6, 0.25], 0.04, 1, 1);
    g.hud.feed(`Drank a flask (${g.state.count('ashen_flask')} left)`, '#d8a050');
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (g.input.consume('hit') && !p.dead && !g.transitioning) this.weapon.swing();
    if (g.input.consume('flask')) this.drinkFlask();
    if (this.flaskCooldown > 0) this.flaskCooldown -= dt;
    this.weapon.update(dt, p);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    g.renderer.postUniforms.uFlash.value = this.flash;
    // the hub is safe: wounds slowly close in town
    if (!g.area.hostile && !p.dead && p.hp < p.maxHp) p.heal(dt * 12);
  }
}
