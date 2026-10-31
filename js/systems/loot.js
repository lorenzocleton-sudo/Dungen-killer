// Loot placeholder system. Enemies roll on a drop table; drops appear as
// glowing pickups. Anything picked up in the dungeon goes into the RUN
// inventory (lost on death, kept when you leave through the portal).
// Real items/stats come later - this just proves the pipeline.
import * as THREE from '../../lib/three.module.min.js';
import { events } from '../engine/events.js';
import { spriteMaterial, litMaterial } from '../engine/materials.js';

export const ITEMS = {
  bone_shard: { id: 'bone_shard', name: 'Bone Shard', kind: 'material' },
  grave_wax: { id: 'grave_wax', name: 'Grave Wax', kind: 'material' },
  rusted_ring: { id: 'rusted_ring', name: 'Rusted Ring', kind: 'trinket' },
  ember_relic: { id: 'ember_relic', name: 'Smouldering Relic', kind: 'relic' },
  hollow_helm: { id: 'hollow_helm', name: 'Dented Helm', kind: 'gear', slot: 'head' },
  knight_gauntlet: { id: 'knight_gauntlet', name: 'Fallen Gauntlet', kind: 'gear', slot: 'hands' },
};

// per enemy type: [itemId, chance]
export const DROP_TABLES = {
  hollow: [['bone_shard', 0.35], ['hollow_helm', 0.08], ['rusted_ring', 0.05]],
  ghoul: [['grave_wax', 0.35], ['bone_shard', 0.2]],
  knight: [['ember_relic', 0.6], ['knight_gauntlet', 0.35]],
};

export class LootSystem {
  constructor(game) {
    this.game = game;
    this.pickups = [];
    events.on('enemyKilled', ({ enemy }) => this.roll(enemy));
    events.on('areaChanged', () => this.clear());
  }

  roll(enemy) {
    const table = DROP_TABLES[enemy.type] || [];
    let i = 0;
    for (const [id, chance] of table) {
      if (Math.random() < chance) this.spawn(ITEMS[id], enemy.pos, i++);
    }
  }

  spawn(item, pos, offset = 0) {
    const area = this.game.area;
    const g = new THREE.Group();
    const a = offset * 2.1;
    g.position.set(pos.x + Math.cos(a) * 0.4 * offset, pos.y, pos.z + Math.sin(a) * 0.4 * offset);
    const isGear = item.kind === 'gear';
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(isGear ? 0.16 : 0.11, 0), litMaterial(isGear ? 'iron' : 'bone', { emissive: isGear ? 0x302010 : 0x201408 }));
    core.position.y = 0.45;
    const glow = new THREE.Sprite(spriteMaterial('glow', isGear ? 0xd09040 : 0xc8a060));
    glow.scale.set(0.9, 0.9, 1); glow.material.opacity = 0.5; glow.position.y = 0.45;
    g.add(core, glow);
    area.scene.add(g);
    this.pickups.push({ item, group: g, core, area, t: Math.random() * 6, delay: 0.8 });
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
      if (p.delay <= 0 && d < 1.1 && !pl.dead && Math.abs(pl.pos.y - p.group.position.y) < 1.5) {
        if (p.item.kind === 'gear') g.state.addGear(p.item.slot, { id: p.item.id, name: p.item.name });
        else g.state.addItem({ id: p.item.id, name: p.item.name, kind: p.item.kind, qty: 1 });
        g.hud.feed(`Picked up: ${p.item.name}`, '#d8c080');
        events.emit('itemPickedUp', { item: p.item });
        p.area.scene.remove(p.group);
        this.pickups.splice(i, 1);
      }
    }
  }
}
