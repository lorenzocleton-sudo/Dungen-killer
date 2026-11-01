// Loot: enemies, chests and bosses drop static items (materials, potions,
// relics) from drop tables PLUS generated gear (base x material x rarity x
// affixes) at the area's item level. Drops appear as glowing pickups coloured
// by rarity. Anything picked up in a dungeon goes into the RUN inventory.
import * as THREE from '../../lib/three.module.min.js';
import { events } from '../engine/events.js';
import { spriteMaterial, litMaterial } from '../engine/materials.js';
import { ITEMS, DROP_TABLES, defOf } from './items.js';
import { generateItem, rollRarity, RARITY, gemId, GEM_TYPES, MATERIALS, materialFor } from './itemgen.js';

const ORE_BY_TIER = ['ore_iron', 'ore_iron', 'ore_steel', 'ore_blackiron', 'ore_sunsteel', 'ore_voidglass', 'ore_hearth'];

export class LootSystem {
  constructor(game) {
    this.game = game;
    this.pickups = [];
    this.ilvlOverride = null;
    events.on('enemyKilled', ({ enemy }) => {
      if (enemy.def.boss || enemy.escaped) return;
      const lv = enemy.level || this.areaIlvl();
      this.roll(enemy.type, enemy.pos, enemy.elite ? 2 : 0);
      this.rollExtras(enemy.pos, lv, enemy.elite ? 3 : 1);
      // gear: rare on common foes, likely on elites, a hoard from the Ash Hoarder
      const gearChance = enemy.def.flee ? 1 : enemy.elite || enemy.guardian ? 0.85 : 0.07;
      if (Math.random() < gearChance * (1 + this.dropPct() / 100)) this.spawnGen(generateItem({ ilvl: lv, rarity: rollRarity(enemy.elite ? 4 : 1) }), enemy.pos, 1);
      if (enemy.def.flee) for (let i = 0; i < 3; i++) this.spawnGen(generateItem({ ilvl: lv + 2, rarity: rollRarity(10) }), enemy.pos, i + 2);
      if (enemy.elite) this.roll('chest', enemy.pos, 2);
      if (enemy.tags && enemy.tags.key) this.spawn('vault_key', enemy.pos, 9);
    });
    events.on('areaChanged', () => this.clear());
  }

  dropPct() { const m = this.game.area && this.game.area.mapMod; return ((this.game.player.stats && this.game.player.stats.dropPct) || 0) + ((m && m.loot) || 0); }

  /** Item level of the current area. */
  areaIlvl() {
    if (this.ilvlOverride) return this.ilvlOverride;
    const a = this.game.area;
    if (a && a.level) return a.level + ((a.mapMod && a.mapMod.ilvl) || 0);
    if (a && a.waveLevel) return a.waveLevel;
    return Math.max(1, Math.round((this.game.state.world.deepest || 1) * 0.8));
  }

  /** Roll a static drop table at a position. `min` guarantees at least that many drops. */
  roll(table, pos, min = 0) {
    const t = DROP_TABLES[table] || [];
    const mul = 1 + this.dropPct() / 100;
    const got = [];
    for (const [id, chance] of t) if (ITEMS[id] && ITEMS[id].kind !== 'gear' && Math.random() < chance * mul) got.push(id);
    while (got.length < min && t.length) { const id = t[Math.floor(Math.random() * t.length)][0]; if (ITEMS[id] && ITEMS[id].kind !== 'gear') got.push(id); else break; }
    got.forEach((id, i) => this.spawn(id, pos, i));
    if (table === 'chest') {
      const il = this.areaIlvl();
      this.spawnGen(generateItem({ ilvl: il, rarity: rollRarity(3) }), pos, got.length + 1);
      this.rollExtras(pos, il, 3);
    }
  }

  /** Crafting materials, potions, gems, consumables and keys by depth. */
  rollExtras(pos, ilvl, n = 1) {
    const tier = Math.min(6, MATERIALS[materialFor(ilvl)].tier);
    const pg = Math.min(4, Math.floor(ilvl / 7));
    const opts = [
      [ORE_BY_TIER[tier], 0.18], ['hide', 0.08], [['ess_fire', 'ess_frost', 'ess_storm', 'ess_shadow', 'ess_life'][Math.floor(Math.random() * 5)], 0.06],
      ['hp_potion_' + pg, 0.07], ['st_potion_' + pg, 0.025], ['mp_potion_' + pg, 0.025],
      [gemId(Object.keys(GEM_TYPES)[Math.floor(Math.random() * 7)], Math.min(2, Math.floor(ilvl / 12))), 0.03],
      ['bomb', 0.02], ['fire_flask', 0.015], ['smoke_bomb', 0.012], ['antidote', 0.015], [['oil_fire', 'oil_frost', 'oil_poison'][Math.floor(Math.random() * 3)], 0.01],
      ['return_scroll', 0.0015],
    ];
    let i = 0;
    for (let k = 0; k < n; k++) for (const [id, c] of opts) if (Math.random() < c * (1 + this.dropPct() / 100)) this.spawn(id, pos, 3 + i++);
  }

  spawn(id, pos, offset = 0) {
    const def = ITEMS[id];
    if (!def) return;
    this._spawn({ id, def }, pos, offset);
  }

  /** Drop a generated item record. */
  spawnGen(g, pos, offset = 0) {
    if (this.ilvlOverride && g.il < this.ilvlOverride) g.il = this.ilvlOverride;
    const def = defOf({ id: 'gen', g });
    this._spawn({ id: 'gen', g, def }, pos, offset);
  }

  _spawn(o, pos, offset) {
    const def = o.def;
    const area = this.game.area;
    const g = new THREE.Group();
    const a = offset * 2.1 + Math.random();
    const r = offset ? 0.6 + offset * 0.08 : 0.15;
    g.position.set(pos.x + Math.cos(a) * r, pos.y, pos.z + Math.sin(a) * r);
    const valuable = def.kind === 'gear' || def.kind === 'relic' || def.kind === 'gem';
    const col = def.rarity ? parseInt(RARITY[def.rarity].color.slice(1), 16) : valuable ? 0xe0a040 : 0xb89a60;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(valuable ? 0.16 : 0.11, 0),
      litMaterial(valuable ? 'iron' : 'bone', { emissive: valuable ? 0x302010 : 0x201408 }));
    core.position.y = 0.45;
    const big = def.rarity === 'legendary' || def.rarity === 'mythic';
    const glow = new THREE.Sprite(spriteMaterial('glow', col)); glow.scale.set(big ? 2.4 : valuable ? 1.3 : 0.9, big ? 3 : valuable ? 1.3 : 0.9, 1); glow.material.opacity = big ? 0.8 : 0.55; glow.position.y = 0.45;
    g.add(core, glow);
    if (big) { const beam = new THREE.Sprite(spriteMaterial('glow', col)); beam.scale.set(0.5, 6, 1); beam.position.y = 3; beam.material.opacity = 0.5; g.add(beam); }
    area.scene.add(g);
    this.pickups.push({ ...o, group: g, core, area, t: Math.random() * 6, delay: 0.6, col: new THREE.Color(col).toArray() });
    if (big) this.game.hud.feed(`${RARITY[def.rarity].name} drop: ${def.name}!`, RARITY[def.rarity].color);
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
      if (Math.random() < dt * 4) p.area.glow.emit(p.group.position.x, p.group.position.y + 0.4, p.group.position.z, (Math.random() - 0.5) * 0.2, 0.5, (Math.random() - 0.5) * 0.2, 1, p.col, 0.03);
      const d = Math.hypot(pl.pos.x - p.group.position.x, pl.pos.z - p.group.position.z);
      if (p.delay <= 0 && d < 1.3 && !pl.dead && Math.abs(pl.pos.y - p.group.position.y) < 1.6) {
        if (p.id === 'gen') g.state.addGen(p.g); else g.state.addItem(p.id, 1);
        g.hud.feed(`Picked up: ${p.def.name}`, p.def.rarity ? RARITY[p.def.rarity].color : p.def.kind === 'gear' ? '#f0c060' : '#d8c080');
        events.emit('itemPickedUp', { id: p.id });
        p.area.scene.remove(p.group);
        this.pickups.splice(i, 1);
      }
    }
  }
}
