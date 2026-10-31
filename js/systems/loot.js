// Loot: enemies (and chests) roll on drop tables from items.js; drops appear
// as glowing pickups. Anything picked up in the dungeon goes into the RUN
// inventory (lost on death, kept when you leave through a portal).
import * as THREE from '../../lib/three.module.min.js';
import { events } from '../engine/events.js';
import { spriteMaterial, litMaterial } from '../engine/materials.js';
import { ITEMS, DROP_TABLES } from './items.js';

export class LootSystem {
  constructor(game) {
    this.game = game;
    this.pickups = [];
    events.on('enemyKilled', ({ enemy }) => this.roll(enemy.type, enemy.pos));
    events.on('areaChanged', () => this.clear());
  }

  /** Roll a drop table at a position. `min` guarantees at least that many drops. */
  roll(table, pos, min = 0) {
    const t = DROP_TABLES[table] || [];
    const mul = 1 + (this.game.player.stats?.dropPct || 0) / 100;
    const got = [];
    for (const [id, chance] of t) if (Math.random() < chance * mul) got.push(id);
    while (got.length < min && t.length) got.push(t[Math.floor(Math.random() * t.length)][0]);
    got.forEach((id, i) => this.spawn(id, pos, i));
  }

  spawn(id, pos, offset = 0) {
    const def = ITEMS[id];
    if (!def) return;
    const area = this.game.area;
    const g = new THREE.Group();
    const a = offset * 2.1 + Math.random();
    const r = offset ? 0.6 : 0.15;
    g.position.set(pos.x + Math.cos(a) * r, pos.y, pos.z + Math.sin(a) * r);
    const valuable = def.kind === 'gear' || def.kind === 'relic';
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(valuable ? 0.16 : 0.11, 0),
      litMaterial(valuable ? 'iron' : 'bone', { emissive: valuable ? 0x302010 : 0x201408 }));
    core.position.y = 0.45;
    const glow = new THREE.Sprite(spriteMaterial('glow', valuable ? 0xe0a040 : 0xb89a60));
    glow.scale.set(valuable ? 1.3 : 0.9, valuable ? 1.3 : 0.9, 1); glow.material.opacity = 0.55; glow.position.y = 0.45;
    g.add(core, glow);
    area.scene.add(g);
    this.pickups.push({ id, def, group: g, core, area, t: Math.random() * 6, delay: 0.6 });
  }

  clear() {
    for (const p of this.pickups) p.area.scene.remove(p.group);
    this.pickups.length = 0;
  }

  update(dt) {
    const g = this.game, pl = g.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt; p.delay -= dt;
      p.core.rotation.y += dt * 1.5;
      p.core.position.y = 0.45 + Math.sin(p.t * 2) * 0.06;
      if (Math.random() < dt * 4) p.area.glow.emit(p.group.position.x, p.group.position.y + 0.4, p.group.position.z, (Math.random() - 0.5) * 0.2, 0.5, (Math.random() - 0.5) * 0.2, 1, [0.9, 0.7, 0.35], 0.03);
      const d = Math.hypot(pl.pos.x - p.group.position.x, pl.pos.z - p.group.position.z);
      if (p.delay <= 0 && d < 1.2 && !pl.dead && Math.abs(pl.pos.y - p.group.position.y) < 1.5) {
        g.state.addItem(p.id, 1);
        g.hud.feed(`Picked up: ${p.def.name}`, p.def.kind === 'gear' ? '#f0c060' : '#d8c080');
        events.emit('itemPickedUp', { id: p.id });
        p.area.scene.remove(p.group);
        this.pickups.splice(i, 1);
      }
    }
  }
}
