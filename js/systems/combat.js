// Player melee: one HIT action -> swing -> arc hit test against enemies.
// Also owns damage feedback (numbers, flash, particles) and kill rewards.
import * as THREE from '../../lib/three.module.min.js';
import { Weapon } from '../player/weapon.js';
import { events } from '../engine/events.js';
import { addXp } from './skills.js';

const _v = new THREE.Vector3();

export const PLAYER_ATTACK = {
  range: 2.1,       // metres beyond the enemy's radius
  arc: 1.05,        // half-angle in radians
  damage: [15, 21],
  critChance: 0.12,
  critMul: 1.75,
};

export class CombatSystem {
  constructor(game) {
    this.game = game;
    this.weapon = new Weapon(game.camera, game.overlayScene);
    this.weapon.onStrike = () => this.strike();
    this.flash = 0;

    events.on('playerDamaged', ({ amount }) => {
      this.flash = Math.min(1, 0.5 + amount / 30);
      const p = game.player;
      game.hud.damageNumber(_v.set(p.pos.x + p.forward.x * 0.8, p.eyeY - 0.3, p.pos.z + p.forward.z * 0.8), amount, 'player');
    });
    events.on('enemyKilled', ({ enemy }) => this.reward(enemy));
  }

  strike() {
    const g = this.game, p = g.player;
    let hits = 0;
    for (const e of g.enemies.list) {
      if (e.dead) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
      const dist = Math.hypot(dx, dz) - e.radius;
      if (dist > PLAYER_ATTACK.range) continue;
      if (Math.abs(e.pos.y - p.pos.y) > 1.6) continue;
      const fwd = Math.atan2(p.forward.x, p.forward.z), ang = Math.atan2(dx, dz);
      let diff = ang - fwd; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) > PLAYER_ATTACK.arc && dist > 0.3) continue;
      const head = e.headPos(_v);
      if (!g.area.collision.lineOfSight(p.pos.x, p.eyeY, p.pos.z, e.pos.x, e.pos.y + e.def.height * 0.5, e.pos.z)) continue;
      const [lo, hi] = PLAYER_ATTACK.damage;
      let dmg = lo + Math.random() * (hi - lo);
      const crit = Math.random() < PLAYER_ATTACK.critChance;
      if (crit) dmg *= PLAYER_ATTACK.critMul;
      dmg = Math.round(dmg);
      e.takeHit(dmg, p.pos);
      g.hud.damageNumber(head, dmg, crit ? 'crit' : '');
      const hx = e.pos.x - dx * 0.25, hz = e.pos.z - dz * 0.25, hy = e.pos.y + e.def.height * 0.55;
      if (e.def.armored) g.area.glow.burst(hx, hy, hz, 14, 4, 0.35, [1, 0.75, 0.35], 0.035, -9, 1);
      else g.area.dust.burst(hx, hy, hz, 12, 2.5, 0.6, e.def.hitColor, 0.06, -9, 1);
      hits++;
      events.emit('enemyHit', { enemy: e, damage: dmg, crit });
    }
    if (hits) p.shake = Math.max(p.shake, 0.35);
  }

  reward(enemy) {
    const g = this.game, d = enemy.def;
    const ashes = Math.round(d.ashes[0] + Math.random() * (d.ashes[1] - d.ashes[0]));
    g.state.addCurrency(ashes);
    g.state.stats.kills++;
    const lv = addXp(g.state.progression, d.xp);
    g.hud.feed(`${d.name} falls  +${ashes} ashes`);
    if (lv) g.hud.feed(`Level ${g.state.progression.level} - a skill point stirs`, '#e0b060');
    events.emit('loot', { enemy, ashes });
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (g.input.consume('hit') && !p.dead && !g.transitioning) this.weapon.swing();
    this.weapon.update(dt, p);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    g.renderer.postUniforms.uFlash.value = this.flash;
    // the hub is safe: wounds slowly close in town
    if (!g.area.hostile && !p.dead && p.hp < p.maxHp) p.heal(dt * 12);
  }
}
