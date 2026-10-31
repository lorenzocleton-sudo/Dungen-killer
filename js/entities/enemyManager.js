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
    for (const s of area.enemySpawns || []) {
      const e = new Enemy(s.type, s.pos, area, s.opts || {});
      if (!this.fit(e, area)) {
        // no room for this body here: a smaller kin takes its place
        e.dispose();
        if (e.def.boss) { this.list.push(new Enemy(s.type, s.pos, area, s.opts || {})); continue; }
        const small = e.def.ranged ? 'archer' : 'hollow';
        const r = new Enemy(small, s.pos, area, s.opts || {});
        this.list.push(r);
        continue;
      }
      this.list.push(e);
    }
  }

  /**
   * Large enemies only spawn where they fit AND can move: find a cell near the
   * spawn with enough clearance (and some room around it). Moves the enemy there.
   */
  fit(e, area, always = false) {
    const nav = area.getNav && area.getNav();
    if (!nav || (e.navNeed <= 0 && !always)) return true;
    const need = e.navNeed;
    const ok = (k) => {
      if (!nav.fits(k, need)) return false;
      // must be able to move: at least a few neighbouring cells fit too
      const W = nav.W; let n = 0;
      for (const d of [1, -1, W, -W, 2, -2, 2 * W, -2 * W]) if (nav.fits(k + d, need)) n++;
      return n >= 4;
    };
    const k0 = nav.idx(e.pos.x, e.pos.z);
    if (ok(k0) && Math.abs(nav.h[k0] - e.pos.y) < 1) return true;
    const i0 = k0 % nav.W, j0 = (k0 / nav.W) | 0;
    for (let d = 1; d <= 8; d++) for (let j = j0 - d; j <= j0 + d; j++) for (let i = i0 - d; i <= i0 + d; i++) {
      if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== d || i < 0 || j < 0 || i >= nav.W || j >= nav.H) continue;
      const k = j * nav.W + i;
      if (!ok(k) || Math.abs(nav.h[k] - e.pos.y) > 1) continue;
      const c = nav.center(k);
      e.pos.set(c.x, c.y, c.z); e.home.copy(e.pos); e.group.position.copy(e.pos);
      return true;
    }
    return false;
  }

  /** Spawn one enemy (or boss) at a world position - used by the admin menu and bosses. */
  spawnAt(type, pos, area = this.game.area, opts = {}) {
    const g = area.collision.groundHeight(pos.x, pos.z, 0.3, pos.y + 2, 4);
    const p = pos.clone(); if (g > -Infinity) p.y = g;
    const e = new Enemy(type, p, area, opts);
    this.fit(e, area, true);           // snap onto open ground it fits on
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
    Enemy.pathBudget = 4;
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
