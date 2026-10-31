// Spawns, updates and cleans up enemies for the current area.
import { Enemy } from './enemy.js';

export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  /** Fresh enemies every visit (the dead return when you come back). */
  spawn(area) {
    this.clear(area);
    for (const s of area.enemySpawns || []) this.list.push(new Enemy(s.type, s.pos, area));
  }

  clear() {
    for (const e of this.list) e.dispose();
    this.list.length = 0;
  }

  get alive() { return this.list.filter((e) => !e.dead); }

  update(dt) {
    const g = this.game;
    const ctx = { player: g.player, collision: g.area.collision, enemies: this.list };
    for (const e of this.list) {
      // far-away enemies sleep to save CPU on tablets
      if (!e.dead && e.state === 'idle' && e.pos.distanceToSquared(g.player.pos) > 900) continue;
      e.update(dt, ctx);
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].remove) { this.list[i].dispose(); this.list.splice(i, 1); }
    }
  }
}
