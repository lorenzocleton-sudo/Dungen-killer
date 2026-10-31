// THE PROVING PIT - a wave arena reached by a portal in Emberwick.
// Pick a tier (up to your deepest main-dungeon level). Each wave is harder;
// every 5th wave is elite, every 10th brings a guardian. Between waves there
// is a 10 s break with "Leave now" (keeps the run's loot). Death loses it.
// Loot drops every wave, a reward chest every 10. Best wave per tier is saved.
import * as THREE from '../../lib/three.module.min.js';
import { Area } from './area.js';
import { box, mesh, brazier, portal, chest } from './props.js';
import { trs } from '../engine/geometry.js';
import { mainLevelEnemies, BIOMES, bandFor } from './biomes.js';
import { AFFIX_IDS } from '../entities/enemy.js';
import { ascensionMul } from '../systems/progression.js';
import { events } from '../engine/events.js';

const R = 15;          // arena radius
const BREAK = 10;

export class ProvingPit extends Area {
  constructor(game) {
    super(game, 'pit', 'The Proving Pit');
    this.loreKey = 'pit';
    this.hostile = true;
    this.transient = true;
    this.tier = Math.max(1, game.pitTier || 1);
    this.name = `The Proving Pit — Tier ${this.tier}`;
    this.wave = 0;
    this.phase = 'break';
    this.timer = 6;
    this.toSpawn = [];
    this.waveEnemies = new Set();
    this.mapBounds = { x0: -R - 3, z0: -R - 3, x1: R + 3, z1: R + 3 };
    this.navBounds = this.mapBounds;
  }

  build() {
    const A = this;
    const B = BIOMES[bandFor(this.tier)] || BIOMES.crypt;
    this.scene.fog = new THREE.Fog(0x0a0604, 4, 46);
    this.scene.background = new THREE.Color(0x0a0604);
    this.hemi.color.set(0x8a6a50); this.hemi.groundColor.set(0x140a06); this.hemi.intensity = 1.7;
    this.lanternIntensity = 4;
    this.dustColor = [0.45, 0.32, 0.22];
    // sand floor + raised stone rim
    box(A, 'mineFloor', 0, -0.5, 0, R * 2 + 8, 1, R * 2 + 8, { worldUV: 2.5, shade: null, tag: 'ground' });
    const segs = 28;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2, x = Math.cos(a) * (R + 1), z = Math.sin(a) * (R + 1);
      if (Math.abs(a - Math.PI * 1.5) < 0.12) continue;    // leave room for the portal
      box(A, 'stoneWall', x, 2.5, z, 3.6, 5, 1.6, { worldUV: 2.5, rot: -a + Math.PI / 2, collide: false });
      if (i % 2 === 0) box(A, B.wall || 'stoneDark', x * 1.08, 6, z * 1.08, 2.6, 2.4, 1.2, { worldUV: 2.5, rot: -a + Math.PI / 2, collide: false, shade: null });
    }
    // collision ring (small boxes; rotated walls can't be AABBs)
    for (let i = 0; i < 110; i++) {
      const a = (i / 110) * Math.PI * 2;
      if (Math.abs(a - Math.PI * 1.5) < 0.09) continue;
      A.collision.addCentered(Math.cos(a) * (R + 0.6), 2.5, Math.sin(a) * (R + 0.6), 1.2, 5, 1.2, 'border');
    }
    // pillars to break line of sight, low cover, a dais in the middle
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3, x = Math.cos(a) * 8.5, z = Math.sin(a) * 8.5;
      mesh(A, 'stoneWall', new THREE.CylinderGeometry(0.7, 0.8, 4.5, 8), trs(x, 2.25, z), { worldUV: 2 });
      A.collision.addCentered(x, 2.25, z, 1.4, 4.5, 1.4);
    }
    box(A, 'flagstone', 0, 0.35, 0, 4, 0.7, 4, { worldUV: 2 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; brazier(A, Math.cos(a) * (R - 1.2), 0, Math.sin(a) * (R - 1.2)); }
    this.lights.add(new THREE.Vector3(0, 6, 0), { color: 0xffa060, intensity: 6, range: 22, flicker: 0.2 });
    portal(A, { x: 0, z: -R - 0.2, y: 0, yaw: 0, target: 'town', spawn: 'pit', color: 'blue', label: 'Leave the Pit (keep your loot)' });
    this.spawns.portal = { pos: new THREE.Vector3(0, 0, -R + 3.5), yaw: Math.PI };
    this.spawns.start = this.spawns.portal;
    this.mapMarkers.push({ x: 0, z: 0, type: 'boss' });
    this.finish();
  }

  onEnter() {
    this.getNav();
    this.game.enemies.clear();
    this.phase = 'break'; this.timer = 5; this.wave = 0;
    this._off = events.on('enemyKilled', ({ enemy }) => { if (this.waveEnemies.has(enemy)) this.waveEnemies.delete(enemy); });
    this.game.hud.banner(this.name, 'the crowd that isn’t there roars');
  }

  onExit() {
    if (this._off) this._off();
    this.game.enemies.clear();
    this.game.hud.pit(null);
  }

  dispose() { this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }

  /** Enemy level for the current wave: tier + 1 per 5 waves (endless). */
  get waveLevel() { return this.tier + Math.floor(this.wave / 5); }

  startWave() {
    this.wave++;
    const w = this.wave, lv = this.waveLevel;
    const mix = mainLevelEnemies(lv);
    const pick = () => { let r = Math.random() * mix.reduce((a, [, x]) => a + x, 0); for (const [t, x] of mix) { r -= x; if (r <= 0) return t; } return mix[0][0]; };
    const elite = w % 5 === 0, guardian = w % 10 === 0;
    const n = Math.min(4 + w, 18);
    const asc = ascensionMul(this.game.state);
    this.toSpawn = [];
    for (let i = 0; i < n; i++) {
      const o = { level: lv, hpMul: asc, dmgMul: asc };
      if (elite && i < Math.ceil(n / 3)) Object.assign(o, { elite: true, affixes: [AFFIX_IDS[(w + i) % AFFIX_IDS.length]] });
      this.toSpawn.push([pick(), o]);
    }
    if (guardian) {
      const pool = (BIOMES[bandFor(lv)] || BIOMES.crypt).mini || ['knight'];
      this.toSpawn.unshift([pool[w % pool.length], { level: lv, elite: true, guardian: true, hpMul: asc * 1.5, dmgMul: asc, affixes: [AFFIX_IDS[w % 6], AFFIX_IDS[(w + 2) % 6]] }]);
    }
    this.phase = 'fight';
    this.spawnT = 0;
    this.game.hud.banner(`Wave ${w}`, guardian ? 'a guardian enters the pit' : elite ? 'elites!' : `tier ${this.tier} · level ${lv}`);
  }

  _spawnOne() {
    const [type, opts] = this.toSpawn.shift();
    const a = Math.random() * Math.PI * 2;
    const pos = new THREE.Vector3(Math.cos(a) * (R - 2.5), 0, Math.sin(a) * (R - 2.5));
    const e = this.game.enemies.spawnAt(type, pos, this, opts);
    e.tags.pit = true;
    this.waveEnemies.add(e);
    this.dust.burst(e.pos.x, 0.3, e.pos.z, 18, 2, 0.6, [0.3, 0.25, 0.2], 0.12, -2, 1);
  }

  waveCleared() {
    const g = this.game, w = this.wave;
    const st = g.state.world;
    st.pitBest = st.pitBest || {};
    if (w > (st.pitBest[this.tier] || 0)) { st.pitBest[this.tier] = w; g.hud.feed(`New best for tier ${this.tier}: wave ${w}`, '#f0d070'); }
    // loot every wave, a reward chest every 10 (item level = wave level)
    const c = new THREE.Vector3(0, 0.7, 0);
    g.loot.ilvlOverride = this.waveLevel;
    g.loot.roll('chest', c, 1 + Math.floor(w / 3));
    g.loot.ilvlOverride = null;
    if (w % 10 === 0) {
      const rarity = g.rewards.roll();
      const lv = this.waveLevel;
      chest(this, 2.5, 0, 0, -Math.PI / 2, () => { g.loot.ilvlOverride = lv; g.rewards.open(rarity, new THREE.Vector3(3.5, 0, 0)); g.loot.ilvlOverride = null; }, { glow: g.rewards.color(rarity) });
    }
    g.state.save();
    this.phase = 'break'; this.timer = BREAK;
  }

  /** "Leave now" between waves: like walking out the portal (loot kept). */
  leaveNow() {
    if (this.phase !== 'break' || this.game.transitioning) return;
    this.game.onPortal({ target: 'town', spawn: 'pit' });
  }

  update(dt, player) {
    super.update(dt, player);
    const g = this.game;
    if (g.player.dead) return;
    if (this.phase === 'break') {
      this.timer -= dt;
      if (g.input.actions.has('interact') && this.wave > 0) { g.input.actions.delete('interact'); this.leaveNow(); return; }
      g.hud.pit(this.wave ? `Wave ${this.wave} cleared — next wave in ${Math.ceil(this.timer)}s` : `Tier ${this.tier} — first wave in ${Math.ceil(this.timer)}s`, true, () => this.leaveNow());
      if (this.timer <= 0) this.startWave();
    } else {
      // trickle spawns so the arena never holds more than the cap
      const cap = g._gfx === 'low' ? 8 : 10;
      this.spawnT -= dt;
      if (this.toSpawn.length && this.spawnT <= 0 && this.waveEnemies.size < cap) { this._spawnOne(); this.spawnT = 0.35; }
      for (const e of this.waveEnemies) if (e.dead || e.remove) this.waveEnemies.delete(e);
      g.hud.pit(`Wave ${this.wave} — ${this.waveEnemies.size + this.toSpawn.length} left`, false);
      if (!this.toSpawn.length && this.waveEnemies.size === 0) this.waveCleared();
    }
  }
}
