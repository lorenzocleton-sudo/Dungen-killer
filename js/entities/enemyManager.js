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
    for (const s of area.enemySpawns || []) this.list.push(new Enemy(s.type, s.pos, area, s.opts || {}));
  }

  /** Spawn one enemy (or boss) at a world position - used by the admin menu and bosses. */
  spawnAt(type, pos, area = this.game.area, opts = {}) {
    const g = area.collision.groundHeight(pos.x, pos.z, 0.3, pos.y + 2, 4);
    const p = pos.clone(); if (g > -Infinity) p.y = g;
    const e = new Enemy(type, p, area, opts);
    if (opts.aggro !== false) { e.state = 'alert'; e.timer = 0.3; }
    this.list.push(e);
    return e;
  }

  clear() {
    for (const e of this.list) e.dispose();
    this.list.length = 0;
  }

  get alive() { return this.list.filter((e) => !e.dead); }

  update(dt) {
    const g = this.game;
    const ctx = { player: g.player, collision: g.area.collision, enemies: this.list, game: g };
    for (const e of this.list) {
      // far-away enemies sleep (and hide inside the fog) to save CPU/GPU on tablets
      const d2 = e.pos.distanceToSquared(g.player.pos);
      e.group.visible = d2 < 900 || e.def.boss;
      if (!e.dead && e.state === 'idle' && d2 > 900) continue;
      e.update(dt, ctx);
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].remove) { this.list[i].dispose(); this.list.splice(i, 1); }
    }
  }
}
